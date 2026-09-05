import { useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppNotification, Drive, Student } from "@placement-app/types";
import { isDriveVisibleToStudent } from "./driveActions";

/** Marks a notification read for this student, in RTDB — not localStorage.
 * A previous version tracked "seen" only in localStorage, which meant a
 * notification you'd already opened showed as unread again on any other
 * device/browser, or after clearing site data. readBy/{uid} is carved out
 * in the rules so a student can write just their own entry without needing
 * write access to the rest of the notification (see database.rules.json). */
export async function markNotificationRead(notificationId: string, uid: string) {
  await update(ref(db, `${DB_NODES.notifications}/${notificationId}/readBy`), { [uid]: true });
}

/** Membership for freeform custom audiences isn't in the data model, so those
 * are included for everyone (see Notifications page). "department" filters
 * directly. "eligible_list"/"selected_students" filter too, but only when
 * filterValue is a real driveId (auto-sent on drive creation — see
 * createDrive in staffDriveActions.ts) — same isDriveVisibleToStudent rule
 * the student Drives page itself uses, so "who got notified" and "who can
 * see the drive" never drift apart. A manually-sent notification of either
 * type with no matching drive falls back to visible-to-everyone, same as
 * before. */
export function useRelevantNotifications(student: Student | null | undefined): AppNotification[] | null {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [drives, setDrives] = useState<Record<string, Drive> | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.notifications), (snap) => {
      const val = snap.val() as Record<string, AppNotification> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.sentAt - a.sentAt);
      setNotifications(list);
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  if (!notifications || !student) return notifications;
  return notifications.filter((n) => {
    if (n.audience.type === "department") return n.audience.filterValue === student.department;
    if (n.audience.type === "eligible_list" || n.audience.type === "selected_students") {
      const drive = n.audience.filterValue && drives ? drives[n.audience.filterValue] : undefined;
      if (drive) return isDriveVisibleToStudent(student, drive);
    }
    // System-generated, one specific student — see NotificationAudienceType
    // doc comment. Must be an exact match, not the "no membership data,
    // show everyone" fallback below, or every application status change
    // would broadcast to the entire student body.
    if (n.audience.type === "student") return n.audience.filterValue === student.uid;
    return true;
  });
}
