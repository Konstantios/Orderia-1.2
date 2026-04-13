'use client';

import { useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, CheckCheck, Trash2, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'notifications'),
      where('recipientUid', '==', user.uid)
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
    if (!firestore || !notifications) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    setIsMarkingAll(true);
    try {
      const batch = writeBatch(firestore);
      unread.forEach(n => {
        batch.update(doc(firestore, 'notifications', n.id), { read: true });
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
                className={cn(
                    "transition-all border-l-4 cursor-pointer hover:shadow-md hover:bg-accent/5",
                    notification.read 
                        ? "bg-background border-l-muted opacity-80" 
                        : "bg-primary/5 border-l-primary shadow-sm"
                )}
                onClick={() => {
                  if (!notification.read) handleMarkAsRead(notification.id);
                  router.push('/orders/new');
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
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-primary/80">
                          {notification.wholesalerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {notification.createdAt ? format(notification.createdAt.toDate(), 'eeee, d MMMM HH:mm', { locale: el }) : 'Μόλις τώρα'}
                        </span>
                      </div>
                      {!notification.read && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Σημείωση ως αναγνωσμένο
                        </Button>
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
