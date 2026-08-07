import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { FileText } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Drive, JoiningReport, Offer } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useOwnedDriveRecords } from "../lib/useOwnedDriveRecords";
import { respondToOffer, setOfferLetterUrl, submitJoiningReport } from "../lib/offerActions";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

const OFFER_BADGE: Record<Offer["status"], BadgeVariant> = {
  received: "brand",
  verified: "brand",
  accepted: "success",
  declined: "danger",
};

const inputClass =
  "min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function JoiningProofForm({
  offerId,
  studentId,
  department,
}: {
  offerId: string;
  studentId: string;
  department: Department;
}) {
  const { showToast } = useToast();
  const [report, setReport] = useState<JoiningReport | null | undefined>(undefined);
  const [joiningDate, setJoiningDate] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, `${DB_NODES.joiningReports}/${offerId}`), (snap) => {
      setReport(snap.exists() ? (snap.val() as JoiningReport) : null);
    });
  }, [offerId]);

  if (report === undefined) return <Skeleton className="mt-3 h-10" />;

  if (report) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Joining proof submitted —
        <Badge variant={report.status === "verified" ? "success" : "brand"}>{report.status}</Badge>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitJoiningReport({
        studentId,
        department,
        offerId,
        joiningDate: new Date(joiningDate).getTime(),
        proofUrl,
      });
      showToast("Joining proof submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-sm font-medium text-slate-700">Submit joining proof</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          required
          value={joiningDate}
          onChange={(e) => setJoiningDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="url"
          required
          placeholder="Proof link (joining letter / ID card scan)"
          value={proofUrl}
          onChange={(e) => setProofUrl(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" loading={submitting}>
          Submit
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function OfferCard({ drive, offer, studentUid }: { drive: Drive; offer: Offer; studentUid: string }) {
  const { showToast } = useToast();
  const [letterUrl, setLetterUrl] = useState(offer.offerLetterUrl ?? "");
  const [savingLetter, setSavingLetter] = useState(false);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingResponse = offer.status === "received" || offer.status === "verified";

  async function handleRespond(status: "accepted" | "declined") {
    setError(null);
    setResponding(true);
    try {
      await respondToOffer(offer.offerId, status);
      showToast(status === "accepted" ? "Offer accepted" : "Offer declined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update offer");
    } finally {
      setResponding(false);
    }
  }

  async function handleSaveLetter() {
    setError(null);
    setSavingLetter(true);
    try {
      await setOfferLetterUrl(offer.offerId, letterUrl.trim());
      showToast("Offer letter link saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save link");
    } finally {
      setSavingLetter(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">{offer.designation}</p>
        </div>
        <Badge variant={OFFER_BADGE[offer.status]}>{offer.status}</Badge>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        CTC: <span className="font-medium text-slate-900">{offer.ctc} LPA</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="url"
          placeholder="Offer letter link (Google Drive)"
          value={letterUrl}
          onChange={(e) => setLetterUrl(e.target.value)}
          className={inputClass}
        />
        <Button variant="secondary" onClick={handleSaveLetter} loading={savingLetter}>
          Save
        </Button>
      </div>

      {pendingResponse && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <Button onClick={() => handleRespond("accepted")} loading={responding}>
            Accept
          </Button>
          <Button variant="secondary" onClick={() => handleRespond("declined")} loading={responding}>
            Decline
          </Button>
        </div>
      )}

      {offer.status === "accepted" && (
        <JoiningProofForm offerId={offer.offerId} studentId={studentUid} department={offer.department} />
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

export default function Offers() {
  const { student } = useAuth();
  const results = useOwnedDriveRecords<Offer>(student?.uid, DB_NODES.offers);

  if (!student) return null;

  const withOffers = results?.filter((r) => r.record !== null);

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Offers you've received, and joining proof once accepted."
        icon={FileText}
        gradient="from-emerald-500 to-teal-600"
      />

      {results === null && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
        </div>
      )}

      {results !== null && withOffers?.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No offers yet"
          subtitle="Offers will appear here once you're selected in a drive."
        />
      )}

      <div className="space-y-4">
        {withOffers?.map(({ drive, record }) => (
          <OfferCard key={drive.driveId} drive={drive} offer={record as Offer} studentUid={student.uid} />
        ))}
      </div>
    </div>
  );
}
