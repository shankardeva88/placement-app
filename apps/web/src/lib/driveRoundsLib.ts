import type { Application, DriveRound } from "@placement-app/types";

export type RoundOutcome = "cleared" | "current" | "rejected" | "upcoming";

export interface RoundProgressEntry {
  round: DriveRound;
  outcome: RoundOutcome;
}

/** Applications track a single currentRoundId (which round the student is
 * at, or was stopped at) rather than a full per-round result list — a
 * drive's rounds run in a fixed sequence (Drive.rounds is ordered by array
 * position, there's no separate order field), so every round before
 * currentRoundId is inferred "cleared" and everything after is "upcoming".
 * `selected` short-circuits to all-cleared regardless of currentRoundId —
 * the final offer isn't itself a tracked round. */
export function computeRoundProgress(
  rounds: DriveRound[],
  application: Application | null | undefined
): RoundProgressEntry[] {
  if (!application) return rounds.map((round) => ({ round, outcome: "upcoming" as const }));
  if (application.status === "selected") {
    return rounds.map((round) => ({ round, outcome: "cleared" as const }));
  }

  const currentIndex = application.currentRoundId
    ? rounds.findIndex((r) => r.roundId === application.currentRoundId)
    : -1;

  return rounds.map((round, i) => {
    if (currentIndex === -1) return { round, outcome: "upcoming" as const };
    if (i < currentIndex) return { round, outcome: "cleared" as const };
    if (i === currentIndex) {
      return { round, outcome: (application.status === "rejected" ? "rejected" : "current") as RoundOutcome };
    }
    return { round, outcome: "upcoming" as const };
  });
}
