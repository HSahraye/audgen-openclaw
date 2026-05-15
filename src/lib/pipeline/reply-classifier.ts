import { REPLY_CLASSIFICATIONS, type ReplyClassification } from "./replies";

/**
 * Heuristic reply classifier v1.
 *
 * Pure function: takes a reply body string and returns a best-guess
 * classification with a confidence score in [0, 1]. Used by the manual
 * reply logger as a "smart default" dropdown selection, and as the
 * baseline for the LLM-based classifier in Phase 2.
 *
 * Design decisions:
 *  - DO NOT throw. Empty / whitespace input returns NEEDS_MORE_INFO
 *    with confidence 0.
 *  - Match in priority order so a body containing both 'unsubscribe'
 *    and 'thanks' classifies as the structural event, not the polite
 *    word.
 *  - Confidence reflects how distinctive the match is. A single
 *    keyword hit on a 5-line reply scores lower than the same keyword
 *    on a one-line reply.
 *  - The classifier never invents categories; it always picks from
 *    REPLY_CLASSIFICATIONS so downstream code can treat the output
 *    as canonical.
 */

export type ClassificationGuess = {
  classification: ReplyClassification;
  confidence: number; // 0..1
  matchedKeyword?: string;
};

type Rule = {
  classification: ReplyClassification;
  // Patterns are tried in order; first hit wins.
  patterns: RegExp[];
};

// Highest priority first.
const RULES: Rule[] = [
  // Structural / non-prospect outcomes
  {
    classification: "BOUNCED",
    patterns: [
      /\b(undeliverable|mail(box)?\s+full|bounced|delivery\s+failure|message\s+not\s+delivered|550\b|domain\s+not\s+found)\b/i,
    ],
  },
  {
    classification: "WRONG_CONTACT",
    patterns: [
      /\b(wrong\s+(person|number|address|email)|no\s+longer\s+(here|work)|left\s+(the\s+)?company|not\s+(my|the)\s+role|not\s+my\s+department)\b/i,
    ],
  },
  {
    classification: "ANGRY",
    patterns: [
      /\b(stop\s+(emailing|contacting|messaging)|leave\s+me\s+alone|harass(ing)?|spam(ming)?|how\s+did\s+you\s+get\s+my|never\s+contact|do\s+not\s+contact|f\*+|fuck)\b/i,
    ],
  },
  // Strong-positive intent
  {
    classification: "BOOKED_CALL",
    patterns: [
      /\b(booked|scheduled|confirmed)\s+(a\s+)?(call|meeting|demo|chat)\b/i,
      /\b(see\s+you\s+(on|at)|talk\s+(to\s+you\s+)?(monday|tuesday|wednesday|thursday|friday|tomorrow))\b/i,
      /\bcalendly\.com\/[^\s]+/i,
    ],
  },
  {
    classification: "INTERESTED",
    patterns: [
      /\b(yes\s*,?\s*(send|please|interested|let'?s|sounds)|sounds\s+(good|great|interesting)|let'?s\s+chat|happy\s+to\s+(chat|talk|hop)|how\s+much|tell\s+me\s+more|interested\s+in\s+(learning|hearing))\b/i,
    ],
  },
  // Soft signals
  {
    classification: "PRICING_OBJECTION",
    patterns: [
      /\b(too\s+(expensive|much|pricey)|out\s+of\s+(our\s+)?budget|can'?t\s+afford|cheaper\s+option|price\s+is\s+(high|too\s+much))\b/i,
    ],
  },
  {
    classification: "ALREADY_HAS_PROVIDER",
    patterns: [
      /\b(already\s+(have|using|work\s+with)|happy\s+with\s+(our\s+)?current|under\s+contract\s+(with|until)|locked\s+in\s+with)\b/i,
    ],
  },
  {
    classification: "FOLLOW_UP_LATER",
    patterns: [
      /\b(check\s+back|circle\s+back|reach\s+out\s+(later|next\s+(week|month|quarter))|try\s+(me\s+)?again(\s+(later|next\s+(week|month|quarter|year)|in\s+\d+))?|not\s+(right\s+)?now)\b/i,
    ],
  },
  {
    classification: "NOT_INTERESTED",
    patterns: [
      /\b(no\s+thanks|not\s+interested|pass(ing)?|no\s+thank\s+you|we'?re\s+good)\b/i,
    ],
  },
  // Curiosity-only \u2014 needs more from the seller before classifying.
  {
    classification: "NEEDS_MORE_INFO",
    patterns: [
      /\b(what\s+(is|do)|can\s+you\s+explain|tell\s+me|more\s+info|info\s+please|how\s+does\s+this\s+work)\b/i,
    ],
  },
];

const MAX_TEXT_LEN = 4000;

export function classifyReplyBody(rawBody: string | null | undefined): ClassificationGuess {
  if (!rawBody) return { classification: "NEEDS_MORE_INFO", confidence: 0 };
  const text = rawBody.trim();
  if (!text) return { classification: "NEEDS_MORE_INFO", confidence: 0 };
  const clipped = text.slice(0, MAX_TEXT_LEN);

  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = clipped.match(re);
      if (m) {
        // Confidence: short replies with a single distinctive match score
        // higher; long replies dilute the signal slightly.
        const lengthPenalty = Math.min(1, 200 / Math.max(50, clipped.length));
        const base = 0.6;
        const confidence = Math.max(0, Math.min(1, base + 0.35 * lengthPenalty));
        return {
          classification: rule.classification,
          confidence,
          matchedKeyword: m[0],
        };
      }
    }
  }

  return { classification: "NEEDS_MORE_INFO", confidence: 0.1 };
}

/**
 * Re-export so consumers can iterate canonical values without pulling
 * the replies module just for the type.
 */
export { REPLY_CLASSIFICATIONS };
