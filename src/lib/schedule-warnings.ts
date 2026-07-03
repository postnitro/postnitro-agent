import type { ScheduledPostRequest } from "./types.js";

/**
 * Soft warnings for a scheduled-post request. Notably: a post that carries media
 * post-type settings but no attached design produces a caption-only post that
 * "looks done" — flag it so callers don't silently ship a post missing its carousel/image.
 */
export function scheduleWarnings(req: ScheduledPostRequest): string[] {
  const warnings: string[] = [];
  const hasDesign = typeof req.designId === "string" && req.designId.length > 0;
  const withMedia: string[] = [];
  if (req.instagramPostSettings) withMedia.push(`Instagram (${req.instagramPostSettings.postType})`);
  if (req.tiktokPostSettings) withMedia.push(`TikTok (${req.tiktokPostSettings.postType})`);
  if (req.linkedinPostSettings) withMedia.push(`LinkedIn (${req.linkedinPostSettings.postType})`);
  if (req.threadsPostSettings) withMedia.push(`Threads (${req.threadsPostSettings.postType})`);
  if (!hasDesign && withMedia.length > 0) {
    warnings.push(
      `No design is attached (designId is null), but these platforms specify a media post type: ${withMedia.join(", ")}. ` +
        `The post will have captions but no carousel/image. Attach a design via designId, or add one later in the dashboard.`
    );
  }

  const li = req.linkedinPostSettings;
  if (req.status === "SCHEDULED" && li?.postType === "document") {
    const title = (li.postTitle ?? "").trim();
    if (title.length < 5 || title.length > 90) {
      warnings.push(
        "LinkedIn postType is 'document' but postTitle is missing or not 5-90 characters — scheduling will be rejected until a valid title is provided."
      );
    }
  }
  return warnings;
}

/** LinkedIn document posts require a 5–90 char postTitle. Derive one from the design name when the caller didn't supply it. */
export function deriveDocumentTitle(name: string | undefined): string {
  const base = (name || "").trim() || "Carousel Document";
  const clamped = base.length > 90 ? base.slice(0, 90).trim() : base;
  return clamped.length >= 5 ? clamped : `${clamped} Document`.slice(0, 90);
}
