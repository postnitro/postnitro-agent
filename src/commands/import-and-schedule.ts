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
import { resolveCarouselSlides, resolveImageSlide } from "../lib/slide-input.js";
import type { ImportRequest, PostType, ResponseType, ScheduledPostRequest } from "../lib/types.js";

/**
 * Convenience command: imports your own content, waits for it to finish, then
 * creates a scheduled post attaching the resulting design — the import-side
 * counterpart to `generate-and-schedule`.
 */
export function registerImportAndScheduleCommand(program: Command): void {
  const command = program
    .command("import-and-schedule")
    .description("Import your own content, wait for it, then schedule it. May take 30-180s.")
    .option("--post-type <type>", "Post kind: CAROUSEL | IMAGE | VIDEO", "CAROUSEL")
    .option("--slides <json>", "CAROUSEL/VIDEO slides as inline JSON — a bare array or {\"slides\":[...]}")
    .option("--slide <json>", "IMAGE slide as inline JSON — a single object")
    .option("--slides-file <path>", "Path to a JSON file with the slides (array for CAROUSEL/VIDEO, single object for IMAGE)")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG | DESIGN (DESIGN skips rendering), or MP4 for --post-type VIDEO")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .requiredOption("--status <status>", "'DRAFT' or 'SCHEDULED'")
    .requiredOption("--scheduled-at <iso>", "ISO-8601 datetime, must be in the future")
    .option("--design-id <id>", "Attach a pre-existing design instead of the freshly imported one")
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

        const defaults = await resolveDefaultsFor(client, apiKey, isVideo ? { ...opts, responseType: undefined } : opts, false);
        const generateImages = resolveGenerateImages(opts);

        // A video only renders to MP4 or DESIGN; other post types keep the format
        // the shared resolver already settled on.
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

        let importRequest: ImportRequest;
        if (postType === "IMAGE") {
          const slide = await resolveImageSlide(opts.slide, opts.slidesFile, { inline: "--slide", file: "--slides-file" });
          importRequest = {
            postType: "IMAGE",
            templateId: defaults.templateId,
            brandId: defaults.brandId,
            responseType,
            requestorId: opts.requestorId,
            slides: slide,
            generateImages,
          };
        } else {
          const slides = await resolveCarouselSlides(opts.slides, opts.slidesFile, { inline: "--slides", file: "--slides-file" });
          importRequest = isVideo
            ? {
                postType: "VIDEO",
                templateId: defaults.templateId,
                brandId: defaults.brandId,
                responseType,
                requestorId: opts.requestorId,
                slides,
                generateImages,
                videoSettings,
              }
            : {
                postType: "CAROUSEL",
                templateId: defaults.templateId,
                brandId: defaults.brandId,
                responseType,
                requestorId: opts.requestorId,
                slides,
                generateImages,
              };
        }

        const initResponse = await client.initiateImport(importRequest);
        const embedPostId = initResponse.data.embedPostId;
        const finalStatus = await client.pollUntilComplete(embedPostId);
        const imageGeneration = extractImageGenerationStep(finalStatus.data);

        const outputResponse = await client.getPostOutput(embedPostId);
        const importedDesignId = extractDesignId(outputResponse.data);
        const designId = opts.designId ?? importedDesignId;
        if (!designId) {
          throw new Error(
            `Post imported (embedPostId "${embedPostId}") but its design ID could not be determined from the output. ` +
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
            message: "Post imported and scheduled.",
            embedPostId,
            designId,
            scheduledPostId: scheduleResponse.data.id,
            post: scheduleResponse.data,
            ...(imageGeneration ? { imageGeneration } : {}),
            ...(warnings.length ? { warnings } : {}),
          });
        } catch (scheduleError) {
          // Import already succeeded (and consumed credits) — surface the designId
          // so the caller can retry scheduling directly without re-importing.
          const reason =
            scheduleError instanceof PostNitroApiError
              ? `PostNitro API Error (${scheduleError.statusCode}): ${scheduleError.message}`
              : scheduleError instanceof Error
                ? scheduleError.message
                : String(scheduleError);
          failWith(
            new Error(
              `Post was imported successfully (embedPostId "${embedPostId}", designId "${designId}"), but scheduling failed: ${reason}. ` +
                `Do NOT re-import — fix the scheduling inputs and retry with \`postnitro schedule create --design-id ${designId}\`.`
            )
          );
        }
      })
    );
}
