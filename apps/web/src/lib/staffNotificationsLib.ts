import { useEffect, useState } from "react";
import { ref, push, set, remove, onValue, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppNotification, NotificationAudienceType } from "@placement-app/types";

export function useAllNotifications(): AppNotification[] | null {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.notifications), (snap) => {
      const val = snap.val() as Record<string, AppNotification> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.sentAt - a.sentAt);
      setNotifications(list);
    });
  }, []);
  return notifications;
}

export interface SendNotificationInput {
  title: string;
  body: string;
  audienceType: NotificationAudienceType;
  filterValue: string;
  sentBy: string;
}

export async function sendNotification(input: SendNotificationInput) {
  const newRef = push(ref(db, DB_NODES.notifications));
  const notificationId = newRef.key as string;
  const notification: Record<string, unknown> = {
    notificationId,
    title: input.title,
    body: input.body,
    audience: { type: input.audienceType },
    sentBy: input.sentBy,
    sentAt: serverTimestamp(),
    readBy: [],
  };
  if (input.filterValue) (notification.audience as Record<string, unknown>).filterValue = input.filterValue;
  await set(newRef, notification);
}

/** Notifications have no expiry — once sent, one stays visible to every
 * matching student forever unless it's deleted. This is the only way to
 * retract a mistaken or now-outdated one. */
export async function deleteNotification(notificationId: string) {
  await remove(ref(db, `${DB_NODES.notifications}/${notificationId}`));
}
