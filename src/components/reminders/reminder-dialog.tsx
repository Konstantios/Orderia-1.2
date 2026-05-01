'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Clock, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import type { OrderReminder, ReminderSchedule, WithId } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ReminderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  businessName: string;
}

const DAYS_OF_WEEK = [
  'Δευτέρα',
  'Τρίτη',
  'Τετάρτη',
  'Πέμπτη',
  'Παρασκευή',
  'Σάββατο',
  'Κυριακή'
];

export function ReminderDialog({ isOpen, onOpenChange, storeId, businessName }: ReminderDialogProps) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [schedules, setSchedules] = useState<ReminderSchedule[]>([]);
  const [newDay, setNewDay] = useState(DAYS_OF_WEEK[0]);
  const [newTime, setNewTime] = useState('09:00');
  
  const [reminderId, setReminderId] = useState<string | null>(null);

  // Fetch existing reminder for this store
  useEffect(() => {
    if (!firestore || !storeId || !isOpen) return;

    const fetchReminder = async () => {
      const remindersRef = collection(firestore, 'stores', storeId, 'reminders');
      const q = query(remindersRef, where("ownerId", "==", user.uid));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docData = snap.docs[0];
        const data = docData.data() as OrderReminder;
        setReminderId(docData.id);
        setSchedules(data.schedules || []);
      } else {
        setReminderId(null);
        setSchedules([]);
      }
    };

    fetchReminder();
  }, [firestore, storeId, isOpen]);

  const handleAddSchedule = () => {
    if (schedules.some(s => s.day === newDay && s.time === newTime)) {
      toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αυτή η υπενθύμιση υπάρχει ήδη.' });
      return;
    }
    setSchedules([...schedules, { day: newDay, time: newTime }]);
  };

  const handleRemoveSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!firestore || !user || !storeId) return;

    setIsSaving(true);
    try {
      const reminderData = {
        schedules,
        isActive: schedules.length > 0,
        storeId,
        ownerId: user.uid,
        businessName: businessName || 'Το Κατάστημά μου'
      };

      if (reminderId) {
        await updateDoc(doc(firestore, 'stores', storeId, 'reminders', reminderId), reminderData);
      } else {
        await addDoc(collection(firestore, 'stores', storeId, 'reminders'), reminderData);
      }

      toast({ title: 'Επιτυχία', description: 'Οι υπενθυμίσεις αποθηκεύτηκαν.' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving reminders:', error);
      toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία αποθήκευσης.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black font-headline">Υπενθυμίσεις Παραγγελίας</DialogTitle>
          <DialogDescription>
            Ορίστε τις ημέρες και ώρες που θέλετε να σας υπενθυμίζουμε να βάλετε την παραγγελία σας.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add New Schedule Section */}
          <div className="bg-muted/30 p-4 rounded-2xl border border-dashed border-muted-foreground/20 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ημέρα</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                  <SelectTrigger className="rounded-xl border-primary/20">
                    <SelectValue placeholder="Επιλέξτε ημέρα" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ώρα</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="time" 
                    value={newTime} 
                    onChange={(e) => setNewTime(e.target.value)}
                    className="pl-10 rounded-xl border-primary/20"
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleAddSchedule} className="w-full rounded-xl bg-accent hover:bg-accent/90 font-bold gap-2">
              <Plus className="h-4 w-4" /> ΠΡΟΣΘΗΚΗ ΣΤΗ ΛΙΣΤΑ
            </Button>
          </div>

          {/* List of Schedules */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ενεργές Υπενθυμίσεις</Label>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
              {schedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-muted">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">Δεν έχετε ορίσει ακόμα υπενθυμίσεις.</p>
                </div>
              ) : (
                schedules.map((schedule, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-card border rounded-2xl group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{schedule.day}</p>
                        <p className="text-xs text-muted-foreground">{schedule.time}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveSchedule(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            ΑΚΥΡΩΣΗ
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="rounded-xl px-8 bg-primary font-black tracking-wide"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            ΑΠΟΘΗΚΕΥΣΗ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
