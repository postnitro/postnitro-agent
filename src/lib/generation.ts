import { Command } from "commander";
import { PostNitroClient, extractDesignId } from "./client.js";
import { getDefaults, resolveApiKey, resolveGenerationDefaults } from "./config-store.js";
import { printResult, action } from "./output.js";
import type {
  PostOutputData,
  PostStatusData,
  GenerateImagesConfig,
  ImagePlacement,
  ImageStrategy,
  VideoSettings,
  VideoResponseType,
} from "./types.js";

/** Builds an authenticated client from the command's global options, returning the resolved key too. */
export async function clientFor(cmd: Command): Promise<{ apiKey: string; client: PostNitroClient }> {
  const globals = cmd.optsWithGlobals();
  const apiKey = await resolveApiKey(globals.apiKey);
  return { apiKey, client: new PostNitroClient(apiKey) };
}

/** Resolves templateId/brandId/(presetId)/responseType from flags, saved defaults, or single-candidate auto-select. */
export function resolveDefaultsFor(
  client: PostNitroClient,
  apiKey: string,
  params: { templateId?: string; brandId?: string; presetId?: string; responseType?: string },
  requirePreset: boolean
) {
  return resolveGenerationDefaults(
    apiKey,
    params,
    {
      templates: async () => (await client.listTemplates(1, 2)).data.templates.map((t) => ({ id: t.id, label: t.name })),
      brands: async () => (await client.listBrands(1, 2)).data.brands.map((b) => ({ id: b.id, label: b.name })),
      presets: async () =>
        (await client.listAiPresets(1, 2)).data.presets.map((p) => ({ id: p.id, label: `${p.socialPlatform}/${p.tone}` })),
    },
    { requirePreset }
  );
}

/**
 * Builds the standard output summary printed by generate/import (and `output`).
 * Render fields (type/mimeType/data) are present for PDF, PNG, and MP4 — DESIGN omits them.
 */
export function summarizeOutput(data: PostOutputData): Record<string, unknown> {
  const { result, embedPost } = data;
  const summary: Record<string, unknown> = {
    embedPostId: embedPost.id,
    status: embedPost.status,
    postType: embedPost.postType,
    responseType: embedPost.responseType,
    creditsUsed: embedPost.credits,
    designId: extractDesignId(data),
    name: result.name,
    aspectRatio: result.size?.id ?? null,
    editorUrl: result.editorUrl ?? null,
  };
  if (result.type !== undefined) summary.outputType = result.type;
  if (result.mimeType !== undefined) summary.mimeType = result.mimeType;
  if (result.data !== undefined) summary.data = result.data;
  return summary;
}

function normalizeImagePlacement(value: string): ImagePlacement {
  const v = value.toLowerCase();
  if (v !== "auto" && v !== "background" && v !== "in-line") {
    throw new Error(`Invalid --image-placement "${value}". Must be auto, background, or in-line.`);
  }
  return v as ImagePlacement;
}

function normalizeImageStrategy(value: string): ImageStrategy {
  const v = value.toLowerCase();
  if (v !== "strategic" && v !== "all") {
    throw new Error(`Invalid --image-strategy "${value}". Must be strategic or all.`);
  }
  return v as ImageStrategy;
}

/** Adds the opt-in AI-image-generation flags to a generate/import command. */
export function addImageGenerationOptions(command: Command): Command {
  return command
    .option("--generate-images", "Generate AI images and bake them into the post (requires --image-context; best-effort, uses the org's AI-image quota)", false)
    .option("--image-context <text>", "Visual brief guiding the AI image prompts — REQUIRED when generating images")
    .option("--image-placement <mode>", "AI image placement: auto | background | in-line (implies --generate-images)")
    .option("--image-strategy <mode>", "Which slides get AI images: strategic (~50%) | all (implies --generate-images)");
}

/**
 * Builds the `generateImages` request object from CLI options, or `undefined` when the
 * feature wasn't opted into. Any image flag (or `--generate-images`) counts as opt-in.
 * `--image-context` is required on opt-in (a specific visual brief yields far better
 * images than none); the two enums are validated client-side so bad input fails early.
 */
export function resolveGenerateImages(opts: Record<string, any>): GenerateImagesConfig | undefined {
  const optedIn =
    opts.generateImages === true ||
    opts.imagePlacement !== undefined ||
    opts.imageStrategy !== undefined ||
    opts.imageContext !== undefined;
  if (!optedIn) return undefined;

  const context = typeof opts.imageContext === "string" ? opts.imageContext.trim() : "";
  if (!context) {
    throw new Error(
      'AI image generation requires --image-context: a short visual brief for the images ' +
        '(e.g. "upbeat and professional, product-focused").'
    );
  }

  const config: GenerateImagesConfig = { context };
  if (opts.imagePlacement !== undefined) config.imagePlacement = normalizeImagePlacement(opts.imagePlacement);
  if (opts.imageStrategy !== undefined) config.imageStrategy = normalizeImageStrategy(opts.imageStrategy);
  return config;
}

// ============================================================
// Video posts
// ============================================================

export const VIDEO_MIN_DURATION_SECONDS = 5;
/** Exclusive: the duration must stay under a minute. */
export const VIDEO_MAX_DURATION_SECONDS = 60;

/** Adds the video render flags to a video generate/import command. */
export function addVideoOptions(command: Command): Command {
  return command
    .option(
      "--video-duration <seconds>",
      `Length of the rendered video in seconds (${VIDEO_MIN_DURATION_SECONDS} to under ${VIDEO_MAX_DURATION_SECONDS}). Required with --response-type MP4`
    )
    .option("--audio-id <id>", "Media ID of an audio track to lay over the video — an ID, not a URL (see `postnitro audio list`)");
}

/**
 * Builds `videoSettings` from the CLI flags, or `undefined` when neither was given.
 * The duration is parsed and range-checked here so bad input fails before the API call.
 */
export function resolveVideoSettings(opts: Record<string, any>): VideoSettings | undefined {
  const hasDuration = opts.videoDuration !== undefined;
  const audioId = typeof opts.audioId === "string" ? opts.audioId.trim() : "";

  if (!hasDuration && !audioId) return undefined;

  if (!hasDuration) {
    throw new Error("--audio-id also needs --video-duration: the video's length is what videoSettings is built around.");
  }

  const videoDuration = Number(opts.videoDuration);
  if (!Number.isFinite(videoDuration)) {
    throw new Error(`Invalid --video-duration "${opts.videoDuration}". Must be a number of seconds.`);
  }
  if (videoDuration < VIDEO_MIN_DURATION_SECONDS || videoDuration >= VIDEO_MAX_DURATION_SECONDS) {
    throw new Error(
      `Invalid --video-duration "${opts.videoDuration}". Must be at least ${VIDEO_MIN_DURATION_SECONDS} seconds and less than ${VIDEO_MAX_DURATION_SECONDS} seconds.`
    );
  }

  const settings: VideoSettings = { videoDuration };
  if (audioId) settings.audioId = audioId;
  return settings;
}

/**
 * Resolves the output format for a video command. A video only accepts MP4 or
 * DESIGN, so: an explicit flag wins (and PDF/PNG is an error, since it can't be
 * honored); otherwise a compatible saved default is used; otherwise DESIGN.
 *
 * A saved PDF/PNG default — likely left over from carousel work — is coerced to
 * DESIGN with a note rather than failing a call the user never pointed at that
 * format. The note is only emitted for a real saved default, not for the CLI's own
 * fallback, so a plain `video generate` stays quiet.
 */
export function resolveVideoResponseType(
  requested: string | undefined,
  savedDefault: string | undefined
): { responseType: VideoResponseType; note?: string } {
  if (requested !== undefined) {
    const value = String(requested).toUpperCase();
    if (value !== "MP4" && value !== "DESIGN") {
      throw new Error(
        `Invalid --response-type "${requested}" for a video. Use MP4 to render the video, or DESIGN to skip rendering.`
      );
    }
    return { responseType: value as VideoResponseType };
  }

  if (savedDefault === undefined) {
    return { responseType: "DESIGN" };
  }

  const saved = String(savedDefault).toUpperCase();
  if (saved === "MP4" || saved === "DESIGN") {
    return { responseType: saved as VideoResponseType };
  }

  return {
    responseType: "DESIGN",
    note: `Saved default response type "${savedDefault}" doesn't apply to videos — used DESIGN. Pass --response-type MP4 to render the video file.`,
  };
}

/**
 * Video output format resolved against the *saved* defaults rather than the merged
 * ones, so the CLI's own PDF fallback (which no video can use) never leaks in.
 */
export async function resolveVideoOutput(
  apiKey: string,
  requested: string | undefined
): Promise<{ responseType: VideoResponseType; note?: string }> {
  const saved = await getDefaults(apiKey);
  return resolveVideoResponseType(requested, saved?.responseType);
}

/** An MP4 render needs a duration; fail here with guidance instead of at the API. */
export function assertVideoSettings(responseType: VideoResponseType, videoSettings?: VideoSettings): void {
  if (responseType === "MP4" && !videoSettings) {
    throw new Error(
      `--response-type MP4 requires --video-duration (${VIDEO_MIN_DURATION_SECONDS} to under ${VIDEO_MAX_DURATION_SECONDS} seconds), plus an optional --audio-id. ` +
        `Use --response-type DESIGN to create the design without rendering a video.`
    );
  }
}

/** Pulls the best-effort `GENERATE_IMAGES` job-log step from a status response, if present. */
export function extractImageGenerationStep(
  status: PostStatusData
): { step: string; status: string; message: string } | undefined {
  const step = status.logs.find((l) => l.step === "GENERATE_IMAGES");
  return step ? { step: step.step, status: step.status, message: step.message } : undefined;
}

/**
 * Polls to completion, fetches output, and prints the standard summary — including the
 * best-effort `imageGeneration` step when AI image generation ran (so a COMPLETED post
 * with a FAILED image step is visible, e.g. free plan / over quota).
 */
export async function waitAndPrint(
  client: PostNitroClient,
  embedPostId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const finalStatus = await client.pollUntilComplete(embedPostId);
  const output = await client.getPostOutput(embedPostId);
  const imageGeneration = extractImageGenerationStep(finalStatus.data);
  printResult({
    success: true,
    ...summarizeOutput(output.data),
    ...(imageGeneration ? { imageGeneration } : {}),
    ...extra,
  });
}

/** Registers shared `status`/`output` inspection subcommands on a post command group (carousel, image). */
export function registerPostInspectionCommands(group: Command, noun: string): void {
  group
    .command("status <embedPostId>")
    .description(`Check generation status and processing logs for a ${noun} post`)
    .action(
      action(async (embedPostId: string, _opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const response = await client.getPostStatus(embedPostId);
        printResult({
          embedPostId: response.data.embedPostId,
          status: response.data.embedPost.status,
          createdAt: response.data.embedPost.createdAt,
          updatedAt: response.data.embedPost.updatedAt,
          logs: response.data.logs.map((l) => ({ step: l.step, status: l.status, message: l.message, timestamp: l.timestamp })),
        });
      })
    );

  group
    .command("output <embedPostId>")
    .description(`Retrieve the generated output for a completed ${noun} post`)
    .action(
      action(async (embedPostId: string, _opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const response = await client.getPostOutput(embedPostId);
        printResult(summarizeOutput(response.data));
      })
    );
}
