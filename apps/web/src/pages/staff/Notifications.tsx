import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Bell, Plus } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Drive, NotificationAudienceType } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useAllNotifications, sendNotification } from "../../lib/staffNotificationsLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const AUDIENCE_OPTIONS: { value: NotificationAudienceType; label: string }[] = [
  { value: "all", label: "All students" },
  { value: "department", label: "One department" },
  { value: "eligible_list", label: "Eligible for a drive" },
  { value: "selected_students", label: "Selected students" },
  { value: "custom", label: "Custom" },
];
const AUDIENCE_LABEL: Record<NotificationAudienceType, string> = Object.fromEntries(
  AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
) as Record<NotificationAudienceType, string>;
const DRIVE_SCOPED_AUDIENCE_TYPES: NotificationAudienceType[] = ["eligible_list", "selected_students"];

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

function SendNotificationForm({ onDone, drives }: { onDone: () => void; drives: Drive[] }) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<NotificationAudienceType>("all");
  const [filterValue, setFilterValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedDrives = useMemo(() => drives.slice().sort((a, b) => b.driveDate - a.driveDate), [drives]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendNotification({ title, body, audienceType, filterValue, sentBy: firebaseUser.uid });
      showToast("Notification sent");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Message</label>
        <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Audience</label>
          <select
            value={audienceType}
            onChange={(e) => {
              setAudienceType(e.target.value as NotificationAudienceType);
              setFilterValue("");
            }}
            className={inputClass}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {audienceType === "department" ? (
          <div>
            <label className={labelClass}>Department</label>
            <select required value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className={inputClass}>
              <option value="">Select</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        ) : DRIVE_SCOPED_AUDIENCE_TYPES.includes(audienceType) ? (
          <div>
            <label className={labelClass}>Drive</label>
            <select required value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className={inputClass}>
              <option value="">Select a drive</option>
              {sortedDrives.map((d) => (
                <option key={d.driveId} value={d.driveId}>
                  {d.companyName} — {new Date(d.driveDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        ) : audienceType === "custom" ? (
          <div>
            <label className={labelClass}>Reference (free text)</label>
            <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className={inputClass} />
          </div>
        ) : null}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Send
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function StaffNotifications() {
  const notifications = useAllNotifications();
  const [creating, setCreating] = useState(false);
  const [drives, setDrives] = useState<Drive[]>([]);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  const drivesById = useMemo(() => Object.fromEntries(drives.map((d) => [d.driveId, d])), [drives]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Send announcements to students."
        icon={Bell}
        gradient="from-sky-500 to-cyan-600"
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Send Notification
            </Button>
          )
        }
      />

      {creating && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Send notification</h3>
          <SendNotificationForm onDone={() => setCreating(false)} drives={drives} />
        </Card>
      )}

      {notifications === null && <Skeleton className="h-24" />}
      {notifications !== null && notifications.length === 0 && !creating && (
        <EmptyState icon={Bell} title="No notifications sent yet" />
      )}

      <div className="space-y-3">
        {notifications?.map((n) => {
          // filterValue is a raw driveId for eligible_list/selected_students
          // (a Firebase push id, meaningless on screen) — resolve it to the
          // drive's company name the same way every other page does.
          const filterLabel = n.audience.filterValue
            ? DRIVE_SCOPED_AUDIENCE_TYPES.includes(n.audience.type)
              ? (drivesById[n.audience.filterValue]?.companyName ?? n.audience.filterValue)
              : n.audience.filterValue
            : "";
          return (
            <Card key={n.notificationId}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                <Badge variant="neutral">
                  {AUDIENCE_LABEL[n.audience.type] ?? n.audience.type}
                  {filterLabel ? ` · ${filterLabel}` : ""}
                </Badge>
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
