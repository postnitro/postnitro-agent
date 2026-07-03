import { Command } from "commander";
import { PostNitroClient, PostNitroApiError, extractDesignId } from "../lib/client.js";
import { resolveApiKey, resolveGenerationDefaults } from "../lib/config-store.js";
import { printResult, failWith, action } from "../lib/output.js";
import { scheduleWarnings, deriveDocumentTitle } from "../lib/schedule-warnings.js";
import { addScheduleJsonOptions, resolveScheduleBody } from "../lib/schedule-input.js";
import type { ScheduledPostRequest } from "../lib/types.js";

/**
 * Convenience command: generates a carousel with AI, waits for it to finish, then
 * creates a scheduled post attaching the resulting design — mirrors the MCP server's
 * postnitro_generate_and_schedule tool.
 */
export function registerGenerateAndScheduleCommand(program: Command): void {
  const command = program
    .command("generate-and-schedule")
    .description("Generate a carousel with AI, wait for it, then schedule it. May take 30-180s.")
    .requiredOption("--context <text>", "Context/prompt for AI generation")
    .option("--type <type>", "AI generation type: text | article | x", "text")
    .option("--instructions <text>", "Additional instructions for the AI")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--preset-id <id>", "AI preset ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .requiredOption("--status <status>", "'DRAFT' or 'SCHEDULED'")
    .requiredOption("--scheduled-at <iso>", "ISO-8601 datetime, must be in the future")
    .option("--design-id <id>", "Attach a pre-existing design instead of the freshly generated one")
    .option("--file <path>", "Path to a JSON file with postContent, selectedAccounts, and per-platform settings");

  addScheduleJsonOptions(command).action(
      action(async (opts, cmd: Command) => {
        const globals = cmd.optsWithGlobals();
        const apiKey = await resolveApiKey(globals.apiKey);
        const client = new PostNitroClient(apiKey, globals.baseUrl);

        const defaults = await resolveGenerationDefaults(
          apiKey,
          opts,
          {
            templates: async () => (await client.listTemplates(1, 2)).data.templates.map((t) => ({ id: t.id, label: t.name })),
            brands: async () => (await client.listBrands(1, 2)).data.brands.map((b) => ({ id: b.id, label: b.name })),
            presets: async () =>
              (await client.listAiPresets(1, 2)).data.presets.map((p) => ({ id: p.id, label: `${p.socialPlatform}/${p.tone}` })),
          },
          { requirePreset: true }
        );
        if (!defaults.presetId) {
          throw new Error("Missing --preset-id. Provide it or save a default via `postnitro defaults set`.");
        }

        const initResponse = await client.initiateGenerate({
          postType: "CAROUSEL",
          templateId: defaults.templateId,
          brandId: defaults.brandId,
          presetId: defaults.presetId,
          responseType: defaults.responseType,
          requestorId: opts.requestorId,
          aiGeneration: { type: opts.type, context: opts.context, instructions: opts.instructions },
        });
        const embedPostId = initResponse.data.embedPostId;
        await client.pollUntilComplete(embedPostId);

        const outputResponse = await client.getPostOutput(embedPostId);
        const generatedDesignId = extractDesignId(outputResponse.data);
        const designId = opts.designId ?? generatedDesignId;
        if (!designId) {
          throw new Error(
            `Carousel generated (embedPostId "${embedPostId}") but its design ID could not be determined from the output. ` +
              `Run \`postnitro carousel output ${embedPostId}\` and schedule with \`postnitro schedule create\` directly.`
          );
        }

        const scheduleBase = await resolveScheduleBody(opts);

        const warnings: string[] = [];
        const isPdf =
          outputResponse.data.result.type?.toLowerCase() === "pdf" || outputResponse.data.embedPost.responseType === "PDF";
        let linkedinPostSettings = scheduleBase.linkedinPostSettings;
        if (linkedinPostSettings) {
          if (linkedinPostSettings.postType === "document") {
            const title = (linkedinPostSettings.postTitle ?? "").trim();
            if (title.length < 5) {
              linkedinPostSettings = { ...linkedinPostSettings, postTitle: deriveDocumentTitle(outputResponse.data.result.name) };
            }
          } else if (isPdf && linkedinPostSettings.postType === "carousel") {
            warnings.push(
              "LinkedIn postType is 'carousel' but the output is a PDF. LinkedIn PDFs are normally posted as postType 'document' (with a postTitle). Keeping 'carousel' as requested — switch to 'document' if publishing misbehaves."
            );
          }
        }

        const scheduleRequest: ScheduledPostRequest = {
          ...scheduleBase,
          status: opts.status,
          scheduledAt: opts.scheduledAt,
          designId,
          linkedinPostSettings,
        };
        warnings.push(...scheduleWarnings(scheduleRequest));

        try {
          const scheduleResponse = await client.createScheduledPost(scheduleRequest);
          printResult({
            success: true,
            message: "Carousel generated and scheduled.",
            embedPostId,
            designId,
            scheduledPostId: scheduleResponse.data.id,
            post: scheduleResponse.data,
            ...(warnings.length ? { warnings } : {}),
          });
        } catch (scheduleError) {
          // Generation already succeeded (and consumed credits) — surface the designId
          // so the caller can retry scheduling directly without regenerating.
          const reason =
            scheduleError instanceof PostNitroApiError
              ? `PostNitro API Error (${scheduleError.statusCode}): ${scheduleError.message}`
              : scheduleError instanceof Error
                ? scheduleError.message
                : String(scheduleError);
          failWith(
            new Error(
              `Carousel was generated successfully (embedPostId "${embedPostId}", designId "${designId}"), but scheduling failed: ${reason}. ` +
                `Do NOT regenerate — fix the scheduling inputs and retry with \`postnitro schedule create --design-id ${designId}\`.`
            )
          );
        }
      })
    );
}
