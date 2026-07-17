import { Command } from "commander";
import { PostNitroClient, extractDesignId } from "./client.js";
import { resolveApiKey, resolveGenerationDefaults } from "./config-store.js";
import { printResult, action } from "./output.js";
import type { PostOutputData, PostStatusData, GenerateImagesConfig, ImagePlacement, ImageStrategy } from "./types.js";

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
 * Render fields (type/mimeType/data) are present only for PDF/PNG — DESIGN omits them.
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
