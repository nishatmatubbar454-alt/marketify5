import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { ref as rtdbRef, onValue as rtdbOnValue, push as rtdbPush, set as rtdbSet } from 'firebase/database';
import {
  primaryDb,
  secondaryDb,
  primaryRealtimeDb,
  secondaryRealtimeDb
} from '../lib/firebase';
import type { Comment } from '../types';

export function useComments(videoId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoId) return;

    let rtdbUnsubPrimary = () => {};
    let rtdbUnsubSecondary = () => {};
    let firestoreUnsub = () => {};

    const handleSnapshot = (snap: any) => {
      const val = snap.val();
      if (val) {
        const list: Comment[] = Object.entries(val).map(([id, item]) => {
          const data = item as Record<string, unknown>;
          return {
            id,
            name: (data.name as string) || 'Guest',
            text: (data.text as string) || '',
            createdAt: (data.createdAt as number) || Date.now()
          };
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setComments(list);
        setLoading(false);
      }
    };

    // 1. Primary Realtime Database comments listener with failover to secondary
    try {
      const cRefPrimary = rtdbRef(primaryRealtimeDb, `comments/${videoId}`);
      rtdbUnsubPrimary = rtdbOnValue(
        cRefPrimary,
        handleSnapshot,
        () => {
          // Secondary fallback
          try {
            const cRefSecondary = rtdbRef(secondaryRealtimeDb, `comments/${videoId}`);
            rtdbUnsubSecondary = rtdbOnValue(
              cRefSecondary,
              handleSnapshot,
              () => setLoading(false)
            );
          } catch {
            setLoading(false);
          }
        }
      );
    } catch {
      setLoading(false);
    }

    // 2. Firestore fallback listener
    try {
      const q = query(collection(primaryDb, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'));
      firestoreUnsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            setComments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) })));
          }
          setLoading(false);
        },
        () => setLoading(false)
      );
    } catch {
      setLoading(false);
    }

    return () => {
      rtdbUnsubPrimary();
      rtdbUnsubSecondary();
      firestoreUnsub();
    };
  }, [videoId]);

  return { comments, loading };
}

export async function addComment(videoId: string, name: string, text: string) {
  const now = Date.now();
  const commentPayload = { name: name || 'Guest', text, createdAt: now };

  // 1. Dual Save to both Firebase Realtime Databases
  await Promise.allSettled(
    [primaryRealtimeDb, secondaryRealtimeDb].map(async (rtdb) => {
      try {
        const listRef = rtdbRef(rtdb, `comments/${videoId}`);
        const newRef = rtdbPush(listRef);
        await rtdbSet(newRef, commentPayload);
      } catch (err) {
        console.warn('Realtime DB comment error:', err);
      }
    })
  );

  // 2. Dual Save to both Firestore databases
  await Promise.allSettled(
    [primaryDb, secondaryDb].map(async (fdb) => {
      try {
        const ref = doc(collection(fdb, 'videos', videoId, 'comments'));
        await setDoc(ref, commentPayload);
      } catch (err) {
        console.warn('Firestore comment error:', err);
      }
    })
  );
}
