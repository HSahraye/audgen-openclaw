import type { DailyBrief, DailyBriefItem } from "./daily-brief";

/**
 * Action queue: re-groups the pipeline-state daily brief into three
 * answer-shaped buckets so /brief can render "who do I act on today,
 * and why":
 *
 *   - callToday      hot leads worth a call this morning
 *                    (REPLIED, QUALIFIED, CALL_BOOKED)
 *   - followUp       leads waiting on a second touch
 *                    (CONTACTED stale, PROPOSAL_SENT stale)
 *   - stuckHot       high-score leads sitting in earlier stages too long
 *                    (PREPARED / AUDIT_GENERATED / SCORED / IMPORTED /
 *                    NEW with score >= 70 and lastActivityAgeMs >= 3d)
 *
 * Pure function over the existing brief output. No DB calls. NaN-safe.
 *
 * Each item carries its `reason` string from the brief and a `bucket`
 * tag so the UI can render badges cleanly.
 */

const STALE_FOLLOWUP_MS = 3 * 24 * 60 * 60 * 1000;
const HOT_SCORE_THRESHOLD = 70;
const HOT_STUCK_MS = 3 * 24 * 60 * 60 * 1000;

export type QueueBucket = "callToday" | "followUp" | "stuckHot";

export type QueuedItem = DailyBriefItem & { bucket: QueueBucket };

export type ActionQueue = {
  workspaceId: string;
  asOf: Date;
  callToday: QueuedItem[];
  followUp: QueuedItem[];
  stuckHot: QueuedItem[];
  totals: {
    callToday: number;
    followUp: number;
    stuckHot: number;
  };
};

function isStale(ageMs: number | null, threshold: number): boolean {
  return ageMs !== null && Number.isFinite(ageMs) && ageMs >= threshold;
}

function classify(item: DailyBriefItem): QueueBucket | null {
  // Hot-engagement buckets
  if (item.stage === "REPLIED" || item.stage === "QUALIFIED" || item.stage === "CALL_BOOKED") {
    return "callToday";
  }
  if (item.stage === "PROPOSAL_SENT" && isStale(item.lastActivityAgeMs, STALE_FOLLOWUP_MS)) {
    return "followUp";
  }
  if (item.stage === "CONTACTED" && isStale(item.lastActivityAgeMs, STALE_FOLLOWUP_MS)) {
    return "followUp";
  }
  // Stuck hot: high score lead languishing in the earlier stages
  const earlyStuck =
    item.stage === "PREPARED" ||
    item.stage === "AUDIT_GENERATED" ||
    item.stage === "SCORED" ||
    item.stage === "IMPORTED" ||
    item.stage === "NEW";
  if (earlyStuck && item.score >= HOT_SCORE_THRESHOLD && isStale(item.lastActivityAgeMs, HOT_STUCK_MS)) {
    return "stuckHot";
  }
  return null;
}

export function buildActionQueue(brief: DailyBrief): ActionQueue {
  const callToday: QueuedItem[] = [];
  const followUp: QueuedItem[] = [];
  const stuckHot: QueuedItem[] = [];
  for (const item of brief.items) {
    const bucket = classify(item);
    if (!bucket) continue;
    const queued: QueuedItem = { ...item, bucket };
    if (bucket === "callToday") callToday.push(queued);
    else if (bucket === "followUp") followUp.push(queued);
    else stuckHot.push(queued);
  }
  // Sort: callToday by score desc; followUp by age desc; stuckHot by score desc.
  callToday.sort((a, b) => (b.score || 0) - (a.score || 0));
  followUp.sort((a, b) => (b.lastActivityAgeMs ?? 0) - (a.lastActivityAgeMs ?? 0));
  stuckHot.sort((a, b) => (b.score || 0) - (a.score || 0));
  return {
    workspaceId: brief.workspaceId,
    asOf: brief.asOf,
    callToday,
    followUp,
    stuckHot,
    totals: {
      callToday: callToday.length,
      followUp: followUp.length,
      stuckHot: stuckHot.length,
    },
  };
}
