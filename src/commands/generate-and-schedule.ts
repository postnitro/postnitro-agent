import { Command } from "commander";
import { PostNitroApiError, extractDesignId } from "../lib/client.js";
import { printResult, failWith, action } from "../lib/output.js";
import {
  clientFor,
  resolveDefaultsFor,
  addImageGenerationOptions,
  resolveGenerateImages,
  extractImageGenerationStep,
  addVideoOptions,
  resolveVideoSettings,
  resolveVideoOutput,
  assertVideoSettings,
} from "../lib/generation.js";
import { scheduleWarnings, deriveDocumentTitle } from "../lib/schedule-warnings.js";
import { addScheduleJsonOptions, resolveScheduleBody } from "../lib/schedule-input.js";
import type { PostType, ResponseType, ScheduledPostRequest } from "../lib/types.js";

/**
 * Convenience command: generates a post with AI, waits for it to finish, then
 * creates a scheduled post attaching the resulting design — mirrors the MCP server's
 * postnitro_generate_and_schedule tool.
 */
export function registerGenerateAndScheduleCommand(program: Command): void {
  const command = program
    .command("generate-and-schedule")
    .description("Generate a post with AI, wait for it, then schedule it. May take 30-180s.")
    .requiredOption("--context <text>", "Context/prompt for AI generation")
    .option("--post-type <type>", "Post kind: CAROUSEL | IMAGE | VIDEO", "CAROUSEL")
    .option("--type <type>", "AI generation type: text | article | x", "text")
    .option("--instructions <text>", "Additional instructions for the AI")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--preset-id <id>", "AI preset ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG | DESIGN (DESIGN skips rendering), or MP4 for --post-type VIDEO")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .requiredOption("--status <status>", "'DRAFT' or 'SCHEDULED'")
    .requiredOption("--scheduled-at <iso>", "ISO-8601 datetime, must be in the future")
    .option("--design-id <id>", "Attach a pre-existing design instead of the freshly generated one")
    .option("--file <path>", "Path to a JSON file with postContent, selectedAccounts, and per-platform settings");

  addVideoOptions(addScheduleJsonOptions(addImageGenerationOptions(command))).action(
      action(async (opts, cmd: Command) => {
        const { apiKey, client } = await clientFor(cmd);

        const postType = String(opts.postType).toUpperCase() as PostType;
        if (postType !== "CAROUSEL" && postType !== "IMAGE" && postType !== "VIDEO") {
          throw new Error(`Invalid --post-type "${opts.postType}". Must be CAROUSEL, IMAGE, or VIDEO.`);
        }

        const isVideo = postType === "VIDEO";
        const videoSettings = resolveVideoSettings(opts);
        if (!isVideo && videoSettings) {
          throw new Error(`--video-duration/--audio-id only apply to --post-type VIDEO, not ${postType}.`);
        }

        const defaults = await resolveDefaultsFor(client, apiKey, isVideo ? { ...opts, responseType: undefined } : opts, true);
        if (!defaults.presetId) {
          throw new Error("Missing --preset-id. Provide it or save a default via `postnitro defaults set`.");
        }

        // A video only renders to MP4 or DESIGN; every other post type keeps the
        // format the shared resolver already settled on.
        let responseType: ResponseType = defaults.responseType;
        let responseTypeNote: string | undefined;
        if (isVideo) {
          const resolved = await resolveVideoOutput(apiKey, opts.responseType);
          responseType = resolved.responseType;
          responseTypeNote = resolved.note;
          assertVideoSettings(resolved.responseType, videoSettings);
        } else if (String(opts.responseType ?? "").toUpperCase() === "MP4") {
          throw new Error(`--response-type MP4 is only valid with --post-type VIDEO, not ${postType}.`);
        }

        const initResponse = await client.initiateGenerate({
          postType,
          templateId: defaults.templateId,
          brandId: defaults.brandId,
          presetId: defaults.presetId,
          responseType,
          requestorId: opts.requestorId,
          aiGeneration: { type: opts.type, context: opts.context, instructions: opts.instructions },
          generateImages: resolveGenerateImages(opts),
          videoSettings,
        });
        const embedPostId = initResponse.data.embedPostId;
        const finalStatus = await client.pollUntilComplete(embedPostId);
        const imageGeneration = extractImageGenerationStep(finalStatus.data);

        const outputResponse = await client.getPostOutput(embedPostId);
        const generatedDesignId = extractDesignId(outputResponse.data);
        const designId = opts.designId ?? generatedDesignId;
        if (!designId) {
          throw new Error(
            `Post generated (embedPostId "${embedPostId}") but its design ID could not be determined from the output. ` +
              `Run \`postnitro ${postType.toLowerCase()} output ${embedPostId}\` and schedule with \`postnitro schedule create\` directly.`
          );
        }

        const scheduleBase = await resolveScheduleBody(opts);

        const warnings: string[] = [];
        if (responseTypeNote) warnings.push(responseTypeNote);
        // AI image generation is best-effort — a COMPLETED post may still have skipped images.
        if (imageGeneration && imageGeneration.status === "FAILED") {
          warnings.push(`AI image generation was skipped: ${imageGeneration.message}`);
        }
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
            message: "Post generated and scheduled.",
            embedPostId,
            designId,
            scheduledPostId: scheduleResponse.data.id,
            post: scheduleResponse.data,
            ...(imageGeneration ? { imageGeneration } : {}),
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
              `Post was generated successfully (embedPostId "${embedPostId}", designId "${designId}"), but scheduling failed: ${reason}. ` +
                `Do NOT regenerate — fix the scheduling inputs and retry with \`postnitro schedule create --design-id ${designId}\`.`
            )
          );
        }
      })
    );
}
