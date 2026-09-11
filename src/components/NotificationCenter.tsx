import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuthStore } from '../store/authStore';

export function NotificationCenter() {
  const { activeStore } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevNotifRef = useRef<any[]>([]);

  // Request Browser Notification Permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!activeStore) return;

    const q = query(
      collection(db, 'stores', activeStore.id, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      let unread = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        notifs.push({ id: doc.id, ...data });
        if (!data.read) unread++;
        
        // Show browser notification for new ones (approximate by checking if we just loaded it)
        // A robust way is to check if it's newly added, but for now we just rely on unread state locally if we want.
      });
      
      // Check for new notifications to trigger browser API
      const prevNotifs = prevNotifRef.current;
      if (notifs.length > 0 && prevNotifs.length > 0 && notifs[0].id !== prevNotifs[0].id) {
        if (!notifs[0].read && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(notifs[0].title, {
            body: notifs[0].message,
          });
        }
      }

      prevNotifRef.current = notifs;
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [activeStore]); // Omit notifications to prevent loop

  const markAsRead = async (id: string) => {
    if (!activeStore) return;
    try {
      await updateDoc(doc(db, 'stores', activeStore.id, 'notifications', id), {
        read: true
      });
    } catch (err) {
      console.error("Error marking as read", err);
    }
  };

  const markAllAsRead = async () => {
    if (!activeStore) return;
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }}
        className="relative p-2 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">Notificações</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  Nenhuma notificação no momento.
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => markAsRead(n.id)}
                    className={`p-3 rounded-xl mb-1 cursor-pointer transition-colors flex gap-3 ${n.read ? 'hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                  >
                    <div className="mt-0.5">
                      {n.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                       n.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-500" /> :
                       <Info className="w-4 h-4 text-indigo-500" />}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</h4>
                      <p className={`text-[11px] leading-tight mt-0.5 ${n.read ? 'text-slate-500' : 'text-slate-600'}`}>{n.message}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : 'Recente'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
