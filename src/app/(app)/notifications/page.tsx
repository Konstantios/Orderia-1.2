'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, CheckCheck, Trash2, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { useEffect, useRef } from 'react';

export default function NotificationsPage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('id');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`notification-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, notifications]); // dependencies might need to include notifications if they load later

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('recipientUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const handleMarkAsRead = async (id: string) => {
    if (!firestore) return;
    try {
      await updateDocumentNonBlocking(doc(firestore, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!firestore || !user || !notifications) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    setIsMarkingAll(true);
    try {
      const batch = writeBatch(firestore);
      
      // Group by wholesaler to minimize lookups if we were sending notifications back
      // For simplicity in bulk, we just mark as acknowledged and read
      unread.forEach(n => {
        const updateData: any = { read: true };
        if (n.type === 'custom_message' && !(n as any).acknowledgedAt) {
          updateData.acknowledgedAt = serverTimestamp();
        }
        batch.update(doc(firestore, 'notifications', n.id), updateData);
      });
      
      await batch.commit();
      toast({ title: 'Επιτυχία', description: 'Όλες οι ειδοποιήσεις σημειώθηκαν ως αναγνωσμένες.' });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία ενημέρωσης ειδοποιήσεων.' });
    } finally {
      setIsMarkingAll(false);
    }
  };
  
  const handleAcknowledge = async (notification: Notification & { id: string }) => {
    if (!firestore || !user) return;
    setIsAcknowledging(notification.id);
    try {
      // 1. Mark as acknowledged on the notification itself
      await updateDocumentNonBlocking(doc(firestore, 'notifications', notification.id), { 
        acknowledgedAt: serverTimestamp(),
        read: true 
      });

      // 2. Fetch Wholesaler to get admin team UIDs
      const wholesalerRef = doc(firestore, 'wholesalers', notification.wholesalerId);
      const wholesalerSnap = await getDoc(wholesalerRef);
      
      if (wholesalerSnap.exists()) {
        const wholesalerData = wholesalerSnap.data();
        const adminUids = wholesalerData.adminUids || [];
        const ownerId = wholesalerData.ownerId;
        
        const recipientUids = new Set<string>();
        if (ownerId) recipientUids.add(ownerId);
        adminUids.forEach((uid: string) => recipientUids.add(uid));

        // 3. Send notification to wholesaler admins
        const batch = writeBatch(firestore);
        const title = 'Επιβεβαίωση Ανάγνωσης';
        // Need to find store name - we can assume user.displayName or fetch from stores
        const description = `Ο πελάτης επιβεβαίωσε ότι ενημερώθηκε για το μήνυμα: "${notification.title}"`;
        
        recipientUids.forEach(uid => {
          const notifRef = doc(collection(firestore, 'notifications'));
          batch.set(notifRef, {
            title,
            description,
            date: new Date().toISOString(),
            read: false,
            recipientUid: uid,
            wholesalerId: notification.wholesalerId,
            wholesalerName: notification.wholesalerName,
            type: 'acknowledgement_received',
            createdAt: serverTimestamp(),
            fromStoreId: '', // Ideally we'd have this
            fromUserId: user.uid
          });

          // Trigger push notification to admin
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientUid: uid,
              title,
              body: description
            })
          }).catch(e => console.error('Push notification failed', e));
        });
        
        await batch.commit();
      }

      toast({ title: 'Ευχαριστούμε!', description: 'Η ενημέρωση στάλθηκε στον προμηθευτή.' });
    } catch (error) {
      console.error('Error acknowledging notification:', error);
      toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία επιβεβαίωσης.' });
    } finally {
      setIsAcknowledging(null);
    }
  };

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ειδοποιήσεις</h1>
          <p className="text-muted-foreground">
            Δείτε τις υπενθυμίσεις και τις ανακοινώσεις από τους προμηθευτές σας.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
            className="rounded-full gap-2 border-primary/20 hover:bg-primary/5"
          >
            <CheckCheck className="h-4 w-4" />
            Σημείωση όλων ως αναγνωσμένα
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications && notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card 
                key={notification.id}
                id={`notification-${notification.id}`}
                className={cn(
                    "transition-all border-l-4 cursor-pointer hover:shadow-md hover:bg-accent/5",
                    highlightId === notification.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse" : "",
                    notification.read 
                        ? "bg-background border-l-muted opacity-80" 
                        : "bg-primary/5 border-l-primary shadow-sm"
                )}
                onClick={() => {
                  if (!notification.read) handleMarkAsRead(notification.id);
                  if (notification.type !== 'custom_message') {
                      router.push('/orders/new');
                  }
                }}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    notification.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                  )}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={cn(
                        "font-semibold leading-none",
                        !notification.read && "text-primary"
                      )}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 uppercase tracking-wider">Νέα</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {notification.description}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-primary/5 mt-2">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-bold text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">
                          {notification.wholesalerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {(() => {
                            try {
                              if (notification.createdAt && typeof (notification.createdAt as any).toDate === 'function') {
                                return format(notification.createdAt.toDate(), 'eee, d MMM HH:mm', { locale: el });
                              } else if (notification.date) {
                                return format(new Date(notification.date), 'eee, d MMM HH:mm', { locale: el });
                              }
                            } catch (e) {
                              console.error('Error formatting date:', e);
                            }
                            return 'Μόλις τώρα';
                          })()}
                        </span>
                      </div>
                      {!notification.read && (
                        <div className="flex flex-wrap items-center gap-2">
                            {notification.type === 'custom_message' && !(notification as any).acknowledgedAt && (
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-8 px-4 text-[11px] font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm gap-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcknowledge(notification as any);
                                    }}
                                    disabled={isAcknowledging === notification.id}
                                >
                                    {isAcknowledging === notification.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCheck className="h-4 w-4" />
                                    )}
                                    Ενημερώθηκα
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-3 text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors rounded-xl"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification.id);
                                }}
                            >
                                Σημείωση ως αναγνωσμένο
                            </Button>
                        </div>
                      )}
                      {(notification as any).acknowledgedAt && (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1.5 py-1 px-3 text-[10px] rounded-lg">
                              <CheckCheck className="h-3 w-3" />
                              Ενημερώθηκα
                          </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center">
              <BellOff className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Δεν υπάρχουν ειδοποιήσεις</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Όταν ο προμηθευτής σας στείλει μια υπενθύμιση παραγγελίας, θα εμφανιστεί εδώ.
              </p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => window.location.reload()}>
              Ανανέωση
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
