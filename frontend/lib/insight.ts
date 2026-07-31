/**
 * Rule-based "AI insight" for the dashboard welcome banner. Deterministic
 * and free — combines today's recovery/sleep/strain against a trailing
 * baseline into a short coaching sentence, in the same style WHOOP's own
 * app uses. See dashboard discussion for the LLM-backed upgrade path.
 */
interface InsightInput {
  recoveryScore: number | null;
  sleepPerformance: number | null;
  strain: number | null;
  strainBaseline: number | null;
}

export function generateInsight({
  recoveryScore,
  sleepPerformance,
  strain,
  strainBaseline,
}: InsightInput): string | null {
  if (recoveryScore === null && sleepPerformance === null) return null;

  const recoveryLow = recoveryScore !== null && recoveryScore < 34;
  const recoveryMid = recoveryScore !== null && recoveryScore >= 34 && recoveryScore < 67;
  const recoveryHigh = recoveryScore !== null && recoveryScore >= 67;
  const sleepGood = sleepPerformance !== null && sleepPerformance >= 75;
  const sleepPoor = sleepPerformance !== null && sleepPerformance < 50;
  const strainNotablyHigh =
    strain !== null && strainBaseline !== null && strain > strainBaseline * 1.2 && strain - strainBaseline > 2;

  if (recoveryLow && sleepPoor) {
    return "Low-quality sleep last night means poor recovery today. Aim for an early bedtime.";
  }
  if (strainNotablyHigh && (recoveryLow || recoveryMid) && sleepGood) {
    return "Your strain was notably higher than normal yesterday, which showed up in your recovery despite a solid night of sleep. Consider a rest day to get back on track.";
  }
  if (recoveryLow) {
    return "Recovery is low today, likely from accumulated strain. Consider a lighter day to bounce back.";
  }
  if (recoveryHigh && sleepGood) {
    return "You're well recovered and well rested — a great day to push your training.";
  }
  if (recoveryMid) {
    return "Recovery is moderate today. Listen to your body and adjust intensity as needed.";
  }
  return "Here's a look at today's metrics.";
}
