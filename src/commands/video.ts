import { Command } from "commander";
import { printResult, action } from "../lib/output.js";
import {
  clientFor,
  resolveDefaultsFor,
  registerPostInspectionCommands,
  addImageGenerationOptions,
  resolveGenerateImages,
  addVideoOptions,
  resolveVideoSettings,
  resolveVideoOutput,
  assertVideoSettings,
  waitAndPrint,
  VIDEO_MIN_DURATION_SECONDS,
  VIDEO_MAX_DURATION_SECONDS,
} from "../lib/generation.js";
import { resolveCarouselSlides } from "../lib/slide-input.js";

/**
 * VIDEO posts: slides are scenes, so they use the carousel slide array verbatim.
 * The only extra input is `videoSettings` (length + optional audio track), and the
 * output format is limited to MP4 (rendered video) or DESIGN (no render).
 */
export function registerVideoCommands(program: Command): void {
  const video = program.command("video").description("Generate, import, and inspect video posts");

  video
    .command("import-template")
    .description("Print the slide array and video settings required by `video import`")
    .action(
      action(async () => {
        printResult({
          rules: {
            "1_same_slides_as_carousel": "VIDEO takes the CAROUSEL slide array — exactly 1 starting_slide first, ≥1 body_slide, exactly 1 ending_slide last",
            "2_one_slide_per_scene": "Each slide becomes a scene in the video, in order",
            "3_video_settings": `--video-duration is the whole video's length in seconds (${VIDEO_MIN_DURATION_SECONDS} to under ${VIDEO_MAX_DURATION_SECONDS}) — it is NOT per scene`,
            "4_response_types": "Only MP4 (renders the video) and DESIGN (no render, editable in the video maker) are valid for a video",
            "5_audio_is_an_id": "--audio-id takes a media ID from `postnitro audio list`, never a URL. Omit it for a silent video",
            "6_dimensions_from_template": "The video's dimensions come from the template, as with any other post type",
            "7_infographics_supported": "Infographic layouts work on video scenes exactly as they do on carousel slides",
          },
          video_settings: {
            "--video-duration": `(required for MP4) Seconds, ${VIDEO_MIN_DURATION_SECONDS} to under ${VIDEO_MAX_DURATION_SECONDS}`,
            "--audio-id": "(optional) Media ID of an audio track from `postnitro audio list`",
          },
          note: "Run `postnitro carousel import-template` for the full slide-field and infographic reference — the shape is identical.",
          example_slides: [
            { type: "starting_slide", heading: "3 habits of fast teams", sub_heading: "Remote work", description: "The ones that actually stick.", cta_button: "Watch on" },
            { type: "body_slide", heading: "Write things down", description: "Decisions live in docs, not in calls." },
            { type: "ending_slide", heading: "Try one this week", description: "Pick the habit your team misses most.", cta_button: "Follow for more" },
          ],
        });
      })
    );

  const generate = video
    .command("generate")
    .description("Generate a video post using PostNitro's AI engine (each AI-written slide becomes a scene)")
    .requiredOption("--context <text>", "Context/prompt for AI generation (or article/post URL, depending on --type)")
    .option("--type <type>", "AI generation type: text | article | x", "text")
    .option("--instructions <text>", "Additional instructions for the AI")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--preset-id <id>", "AI preset ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: MP4 | DESIGN (default DESIGN — skips rendering)")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false);
  addVideoOptions(addImageGenerationOptions(generate)).action(
    action(async (opts, cmd: Command) => {
      const { apiKey, client } = await clientFor(cmd);
      // The response type is resolved separately (a video can't be PDF/PNG), so it
      // is withheld from the shared defaults resolver.
      const defaults = await resolveDefaultsFor(client, apiKey, { ...opts, responseType: undefined }, true);
      if (!defaults.presetId) {
        throw new Error("Missing --preset-id. Provide it or save a default via `postnitro defaults set`.");
      }

      const videoSettings = resolveVideoSettings(opts);
      const { responseType, note } = await resolveVideoOutput(apiKey, opts.responseType);
      assertVideoSettings(responseType, videoSettings);

      const usedDefaults = { ...defaults, responseType };
      const initResponse = await client.initiateGenerate({
        postType: "VIDEO",
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

      if (!opts.wait) {
        printResult({
          success: true,
          embedPostId,
          status: initResponse.data.status,
          usedDefaults,
          ...(note ? { warnings: [note] } : {}),
          nextStep: `Use \`postnitro video status ${embedPostId}\` to monitor progress.`,
        });
        return;
      }

      await waitAndPrint(client, embedPostId, {
        usedDefaults,
        ...(note ? { warnings: [note] } : {}),
      });
    })
  );

  const importCmd = video
    .command("import")
    .description("Create a video post from your own scenes (see `video import-template` for the required format)")
    .option("--file <path>", "Path to a JSON file containing a `slides` array (or a bare array) — one slide per scene")
    .option("--slides <json>", "Slides as inline JSON — a bare array or {\"slides\":[...]}. Overrides --file.")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: MP4 | DESIGN (default DESIGN — skips rendering)")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false);
  addVideoOptions(addImageGenerationOptions(importCmd)).action(
    action(async (opts, cmd: Command) => {
      const { apiKey, client } = await clientFor(cmd);
      const slides = await resolveCarouselSlides(opts.slides, opts.file, { inline: "--slides", file: "--file" });

      const defaults = await resolveDefaultsFor(client, apiKey, { ...opts, responseType: undefined }, false);

      const videoSettings = resolveVideoSettings(opts);
      const { responseType, note } = await resolveVideoOutput(apiKey, opts.responseType);
      assertVideoSettings(responseType, videoSettings);

      const usedDefaults = { ...defaults, responseType };
      const initResponse = await client.initiateImport({
        postType: "VIDEO",
        templateId: defaults.templateId,
        brandId: defaults.brandId,
        responseType,
        requestorId: opts.requestorId,
        slides,
        generateImages: resolveGenerateImages(opts),
        videoSettings,
      });
      const embedPostId = initResponse.data.embedPostId;

      if (!opts.wait) {
        printResult({
          success: true,
          embedPostId,
          status: initResponse.data.status,
          usedDefaults,
          ...(note ? { warnings: [note] } : {}),
          nextStep: `Use \`postnitro video status ${embedPostId}\` to monitor progress.`,
        });
        return;
      }

      await waitAndPrint(client, embedPostId, {
        usedDefaults,
        ...(note ? { warnings: [note] } : {}),
      });
    })
  );

  registerPostInspectionCommands(video, "video");
}
