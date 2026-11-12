/**
 * The publish settings the settings UI stores in Canva's publishRef and
 * publishContent reads back.
 */
export interface PublishSettings {
  /** Seconds each image page stays on screen. Videos play to their end. */
  durationSeconds: number;
  /** Screens that show this design's playlist after publishing. */
  screenIds: string[];
}

export const DEFAULT_SETTINGS: PublishSettings = {
  durationSeconds: 10,
  screenIds: [],
};

export const MIN_DURATION_SECONDS = 3;
export const MAX_DURATION_SECONDS = 3600;

export function parsePublishSettings(
  publishRef?: string,
): PublishSettings | undefined {
  if (!publishRef) return undefined;
  try {
    const parsed = JSON.parse(publishRef) as Partial<PublishSettings>;
    return {
      durationSeconds:
        typeof parsed.durationSeconds === "number"
          ? parsed.durationSeconds
          : DEFAULT_SETTINGS.durationSeconds,
      screenIds: Array.isArray(parsed.screenIds)
        ? parsed.screenIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return undefined;
  }
}

export function validDuration(seconds: number): boolean {
  return (
    Number.isInteger(seconds) &&
    seconds >= MIN_DURATION_SECONDS &&
    seconds <= MAX_DURATION_SECONDS
  );
}
