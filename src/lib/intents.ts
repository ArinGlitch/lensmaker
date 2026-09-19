/**
 * The scripted demo intents, in ONE place.
 *
 * IntentBar renders these as chips and scripts/warm-cache.ts pre-generates
 * them. They were previously duplicated, which meant they could drift apart —
 * and a drifted intent is a cache miss, i.e. a live model call mid-demo.
 */
export const DEMO_INTENTS = [
  "what's about to charge me?",
  "what are my hard deadlines?",
  "what's trying to scam me?",
  "what am I spending most on?",
] as const;
