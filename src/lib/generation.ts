import { Command } from "commander";
import { PostNitroClient, extractDesignId } from "./client.js";
import { resolveApiKey, resolveGenerationDefaults } from "./config-store.js";
import { printResult, action } from "./output.js";
import type { PostOutputData } from "./types.js";

/** Builds an authenticated client from the command's global options, returning the resolved key too. */
export async function clientFor(cmd: Command): Promise<{ apiKey: string; client: PostNitroClient }> {
  const globals = cmd.optsWithGlobals();
  const apiKey = await resolveApiKey(globals.apiKey);
  return { apiKey, client: new PostNitroClient(apiKey, globals.baseUrl) };
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
