'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, Suspense } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase/provider';
import { collection, query, where, doc, updateDoc, onSnapshot, getDocs } from 'firebase/firestore';
import type { OrderReminder, WithId } from '@/lib/types';
import { AlarmOverlay } from './alarm-overlay';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface ReminderContextType {
  reminders: WithId<OrderReminder>[];
  isLoading: boolean;
  isAlarmActive: boolean;
  stopAlarm: () => void;
  snoozeAlarm: () => void;
  goToOrder: () => void;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

// Internal component to handle search params
function ReminderManager({ children }: { children: React.ReactNode }) {
  const { firestore, user } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [reminders, setReminders] = useState<WithId<OrderReminder>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [snoozeUntil, setSnoozeUntil] = useState<Date | null>(null);

  // 0. Detect alarm from URL (pushed by Cron/FCM)
  useEffect(() => {
    if (searchParams?.get('alarm') === 'true') {
      setIsAlarmActive(true);
      // Clean up the URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('alarm');
      const newQuery = newParams.toString();
      const newPath = pathname + (newQuery ? `?${newQuery}` : '');
      router.replace(newPath);
    }
  }, [searchParams, pathname, router]);

  // 1. Determine if the user is a customer and find their active store
  useEffect(() => {
    if (!firestore || !user) return;
    
    // Do not run reminder logic if we are in the admin section
    if (pathname?.startsWith('/admin')) {
      setIsLoading(false);
      return;
    }

    const findStore = async () => {
      try {
        // First, check if this user is a Wholesaler/Admin.
        // If they are, they shouldn't be getting customer order reminders.
        const wholesalersRef = collection(firestore, 'wholesalers');
        const qAdmin = query(wholesalersRef, where("adminUids", "array-contains", user.uid));
        const qWholesalerOwner = query(wholesalersRef, where("ownerId", "==", user.uid));
        
        const [adminSnap, wholesalerOwnerSnap] = await Promise.all([
            getDocs(qAdmin), 
            getDocs(qWholesalerOwner)
        ]);

        if (!adminSnap.empty || !wholesalerOwnerSnap.empty) {
            console.log('[ReminderProvider] User is a wholesaler, skipping reminders.');
            setIsLoading(false);
            return;
        }

        const storesRef = collection(firestore, 'stores');
        const qOwner = query(storesRef, where("ownerId", "==", user.uid));
        const qManager = query(storesRef, where("managerUids", "array-contains", user.uid));
        
        const [ownerSnap, managerSnap] = await Promise.all([getDocs(qOwner), getDocs(qManager)]);
        
        if (!ownerSnap.empty) {
          setActiveStoreId(ownerSnap.docs[0].id);
        } else if (!managerSnap.empty) {
          setActiveStoreId(managerSnap.docs[0].id);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[ReminderProvider] Error finding store:', err);
        setIsLoading(false);
      }
    };

    findStore();
  }, [firestore, user, pathname]);

  // 2. Listen to reminders for the active store and the current user
  useEffect(() => {
    if (!firestore || !activeStoreId || !user) return;

    const remindersRef = collection(firestore, 'stores', activeStoreId, 'reminders');
    const q = query(remindersRef, where("ownerId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as WithId<OrderReminder>));
      setReminders(items);
      setIsLoading(false);
    }, (err) => {
      console.error('Error listening to reminders:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, activeStoreId, user]);

  // 3. Time checking logic
  const checkReminders = useCallback(() => {
    if (isAlarmActive || reminders.length === 0) return;

    const now = new Date();
    
    // Check if we are currently in snooze
    if (snoozeUntil && now < snoozeUntil) {
        return;
    }

    // Get day name in Greek
    const daysGreek = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
    const currentDay = daysGreek[now.getDay()];
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const currentMinuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}T${currentTime}`;

    reminders.forEach(reminder => {
      if (!reminder.isActive) return;

      const matchingSchedule = reminder.schedules.find(s => s.day === currentDay && s.time === currentTime);
      
      if (matchingSchedule && reminder.lastTriggered !== currentMinuteKey) {
        console.log('TRIGGERING ALARM!', matchingSchedule);
        setIsAlarmActive(true);
        setSnoozeUntil(null); // Clear any existing snooze when a new (or re-trigger) alarm happens
        
        // Update lastTriggered to avoid double triggering in the same minute
        if (firestore && activeStoreId) {
          updateDoc(doc(firestore, 'stores', activeStoreId, 'reminders', reminder.id), {
            lastTriggered: currentMinuteKey
          }).catch(err => console.error('Error updating lastTriggered:', err));
        }
      }
    });
  }, [reminders, isAlarmActive, firestore, activeStoreId, snoozeUntil]);

  useEffect(() => {
    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkReminders]);

  const stopAlarm = () => {
    setIsAlarmActive(false);
    setSnoozeUntil(null);
  };

  const snoozeAlarm = () => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
    setSnoozeUntil(tenMinutesLater);
    setIsAlarmActive(false);
  };

  const goToOrder = () => {
    setIsAlarmActive(false);
    setSnoozeUntil(null);
    router.push('/orders/new');
  };

  return (
    <ReminderContext.Provider value={{ reminders, isLoading, isAlarmActive, stopAlarm, snoozeAlarm, goToOrder }}>
      {children}
      <AlarmOverlay 
        isOpen={isAlarmActive} 
        onStop={stopAlarm} 
        onSnooze={snoozeAlarm} 
        onOrder={goToOrder}
      />
    </ReminderContext.Provider>
  );
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ReminderManager>{children}</ReminderManager>
    </Suspense>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (context === undefined) {
    throw new Error('useReminders must be used within a ReminderProvider');
  }
  return context;
}
