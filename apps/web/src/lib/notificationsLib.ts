import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppNotification, Department } from "@placement-app/types";

const SEEN_KEY = "placement-app:seen-notifications";

/** "Seen" tracking is client-side only (localStorage), not written back to
 * RTDB — the readBy field on notifications is currently staff-write-only,
 * and reopening that for self-service read receipts wasn't worth it for a
 * non-essential feature. See plan notes on Notifications. */
export function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markSeen(seenIds: Set<string>, id: string): Set<string> {
  const next = new Set(seenIds).add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(next)));
  return next;
}

/** Membership for eligible_list/selected_students/custom audiences isn't in
 * the data model, so those are included for everyone (see Notifications
 * page) — only the "department" audience type can actually be filtered. */
export function useRelevantNotifications(department: Department | undefined): AppNotification[] | null {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.notifications), (snap) => {
      const val = snap.val() as Record<string, AppNotification> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.sentAt - a.sentAt);
      setNotifications(list);
    });
  }, []);

  if (!notifications || !department) return notifications;
  return notifications.filter(
    (n) => n.audience.type !== "department" || n.audience.filterValue === department
  );
}
