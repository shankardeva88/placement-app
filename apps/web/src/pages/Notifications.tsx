import { useState } from "react";
import { Bell } from "lucide-react";
import type { NotificationAudienceType } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { getSeenIds, markSeen, useRelevantNotifications } from "../lib/notificationsLib";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

// eligible_list/selected_students are filtered to real recipients when
// filterValue is a driveId (see useRelevantNotifications); "custom" has no
// membership data to filter by, so it's shown to everyone. Labels below are
// just for display, not filtering.
const AUDIENCE_LABEL: Record<NotificationAudienceType, string> = {
  all: "All students",
  department: "Department",
  eligible_list: "Eligible students",
  selected_students: "Selected students",
  custom: "Targeted",
};

export default function Notifications() {
  const { student } = useAuth();
  const notifications = useRelevantNotifications(student);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => getSeenIds());

  if (!student) return null;

  function handleOpen(id: string) {
    if (seenIds.has(id)) return;
    setSeenIds(markSeen(seenIds, id));
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Announcements relevant to you."
        icon={Bell}
        gradient="from-sky-500 to-cyan-600"
      />

      {notifications === null && <Skeleton className="h-24" />}

      {notifications !== null && notifications.length === 0 && (
        <EmptyState icon={Bell} title="No notifications yet" />
      )}

      <div className="space-y-3">
        {notifications?.map((n) => {
          const isSeen = seenIds.has(n.notificationId);
          return (
            <Card
              key={n.notificationId}
              className={`cursor-pointer ${!isSeen ? "ring-2 ring-brand-200" : ""}`}
              onClick={() => handleOpen(n.notificationId)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                  {!isSeen && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </div>
                <Badge variant="neutral">{AUDIENCE_LABEL[n.audience.type]}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{n.body}</p>
              <p className="mt-2 text-xs text-slate-400">{new Date(n.sentAt).toLocaleString()}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
