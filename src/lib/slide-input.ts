import { readJsonFile } from "./json-file.js";
import type { Slide, ImageSlide } from "./types.js";

/** Allowed fields on an IMAGE slide object — the API 422s on anything else. */
export const IMAGE_SLIDE_FIELDS = [
  "heading",
  "sub_heading",
  "description",
  "cta_button",
  "image",
  "background_image",
  "layoutType",
  "layoutConfig",
] as const;

/** The two flag names a command uses for slide input, so error messages match that command's surface. */
export interface SlideFlags {
  inline: string;
  file: string;
}

/**
 * Resolves a CAROUSEL slides array from inline JSON (wins) or a file path.
 * Accepts a bare array or `{ "slides": [...] }`.
 */
export async function resolveCarouselSlides(
  inline: string | undefined,
  file: string | undefined,
  flags: SlideFlags
): Promise<Slide[]> {
  let parsed: unknown;
  if (inline !== undefined) {
    try {
      parsed = JSON.parse(inline);
    } catch (e) {
      throw new Error(`${flags.inline} must be valid JSON: ${(e as Error).message}`);
    }
  } else if (file) {
    parsed = await readJsonFile<unknown>(file);
  } else {
    throw new Error(`Provide slides via ${flags.inline} '<json>' or ${flags.file} <path>.`);
  }
  const slides = Array.isArray(parsed) ? parsed : (parsed as { slides?: unknown })?.slides;
  if (!Array.isArray(slides) || slides.length < 3) {
    throw new Error("Slides must be an array with at least 3 entries (starting_slide, body_slide(s), ending_slide).");
  }
  return slides as Slide[];
}

/**
 * Resolves a single IMAGE slide object from inline JSON (wins) or a file path.
 * Accepts a bare object or a `{ "slides": {...} }` wrapper. Rejects arrays — those are CAROUSEL-only.
 */
export async function resolveImageSlide(
  inline: string | undefined,
  file: string | undefined,
  flags: SlideFlags
): Promise<ImageSlide> {
  let parsed: unknown;
  if (inline !== undefined) {
    try {
      parsed = JSON.parse(inline);
    } catch (e) {
      throw new Error(`${flags.inline} must be valid JSON: ${(e as Error).message}`);
    }
  } else if (file) {
    parsed = await readJsonFile<unknown>(file);
  } else {
    throw new Error(`Provide the image slide via ${flags.inline} '<json>' or ${flags.file} <path>.`);
  }

  const slide =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) && "slides" in parsed
      ? (parsed as { slides?: unknown }).slides
      : parsed;

  if (Array.isArray(slide)) {
    throw new Error("An IMAGE post takes a single slide object, not an array. (Arrays are only for carousel import.)");
  }
  if (!slide || typeof slide !== "object") {
    throw new Error("The image slide must be a JSON object with at least a `heading`.");
  }
  const heading = (slide as Record<string, unknown>).heading;
  if (typeof heading !== "string" || !heading.trim()) {
    throw new Error("The image slide requires a non-empty `heading`.");
  }
  const invalid = Object.keys(slide as Record<string, unknown>).filter(
    (k) => !(IMAGE_SLIDE_FIELDS as readonly string[]).includes(k)
  );
  if (invalid.length) {
    throw new Error(`Invalid image slide field(s): ${invalid.join(", ")}. Allowed: ${IMAGE_SLIDE_FIELDS.join(", ")}.`);
  }
  return slide as ImageSlide;
}
