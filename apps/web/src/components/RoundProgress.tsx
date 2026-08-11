import { Check, X, Clock, Circle } from "lucide-react";
import type { Application, DriveRound } from "@placement-app/types";
import type { RoundOutcome } from "../lib/driveRoundsLib";
import { computeRoundProgress } from "../lib/driveRoundsLib";
import { Badge } from "./ui/Badge";
import type { BadgeVariant } from "./ui/Badge";

const OUTCOME_BADGE: Record<RoundOutcome, BadgeVariant> = {
  cleared: "success",
  current: "warning",
  rejected: "danger",
  upcoming: "neutral",
};

const OUTCOME_ICON: Record<RoundOutcome, typeof Check> = {
  cleared: Check,
  current: Clock,
  rejected: X,
  upcoming: Circle,
};

/** Round-by-round breakdown for one application — shared across the student
 * drive list, coordinator's applicant roster, and the student detail page
 * mentors/coordinators both view, so all three surfaces render this
 * identically. Renders nothing if the drive has no defined rounds. */
export function RoundProgress({
  rounds,
  application,
}: {
  rounds: DriveRound[];
  application: Application | null | undefined;
}) {
  if (!rounds || rounds.length === 0) return null;
  const entries = computeRoundProgress(rounds, application);

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(({ round, outcome }) => {
        const Icon = OUTCOME_ICON[outcome];
        return (
          <Badge key={round.roundId} variant={OUTCOME_BADGE[outcome]}>
            <Icon className="mr-1 h-3 w-3" />
            {round.name}
          </Badge>
        );
      })}
    </div>
  );
}
