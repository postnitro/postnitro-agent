import { Command } from "commander";
import { printResult, action } from "../lib/output.js";
import {
  clientFor,
  resolveDefaultsFor,
  registerPostInspectionCommands,
  addImageGenerationOptions,
  resolveGenerateImages,
  waitAndPrint,
} from "../lib/generation.js";
import { resolveCarouselSlides } from "../lib/slide-input.js";

export function registerCarouselCommands(program: Command): void {
  const carousel = program.command("carousel").description("Generate, import, and inspect carousel posts");

  carousel
    .command("import-template")
    .description("Print the exact slide structure and rules required by `carousel import`")
    .action(
      action(async () => {
        printResult({
          rules: {
            "1_starting_slide": "Exactly 1 slide with type 'starting_slide' — MUST be the first slide",
            "2_body_slides": "At least 1 slide with type 'body_slide' — place between starting and ending",
            "3_ending_slide": "Exactly 1 slide with type 'ending_slide' — MUST be the last slide",
            "4_infographic_columns": "Max 3 columns when using infographic layoutType",
            "5_cyclical_infographic": "When columnDisplay is 'cycle', put ALL data in the FIRST column only",
            "6_infographic_replaces_image": "Setting layoutType to 'infographic' replaces the image field",
            "7_infographic_ids_required": "Every layoutConfig column and content item needs a caller-provided `id` — the API does not generate them",
          },
          slide_fields: {
            type: "(required) 'starting_slide' | 'body_slide' | 'ending_slide'",
            heading: "(required) Main heading text",
            sub_heading: "(optional) Subtitle text",
            description: "(optional) Description / body text",
            image: "(optional) Image URL — ignored if layoutType is 'infographic'",
            background_image: "(optional) Background image URL",
            cta_button: "(optional) Call-to-action button text",
            layoutType: "(optional) 'default' or 'infographic'",
            layoutConfig: "(optional, required if layoutType is 'infographic') See infographic_config below",
          },
          infographic_config: {
            hasHeader: "true | false (default true)",
            columnCount: "1 | 2 | 3 (default 1)",
            displayCounterAs: "'counter' (default) or 'none'",
            columnDisplay: "'grid' (comparative, default) or 'cycle' (sequential — put all data in the FIRST column)",
            columnData: [
              {
                id: "col-1 (required, caller-provided)",
                header: "Column Header",
                content: [
                  {
                    id: "item-1 (required, caller-provided)",
                    icon: "null (optional)",
                    title: "Item title",
                    description: "HTML string, e.g. <p dir=\"ltr\">Description</p>",
                    titleEnabled: "true | false",
                    descriptionEnabled: "true | false",
                  },
                ],
              },
            ],
          },
          example_slides: [
            { type: "starting_slide", heading: "10 Digital Marketing Tips", sub_heading: "For Small Businesses", description: "Boost your online presence.", cta_button: "Swipe to learn more →" },
            { type: "body_slide", heading: "Tip 1: Know Your Audience", description: "Research your target demographic.", image: "https://example.com/audience.jpg" },
            { type: "ending_slide", heading: "Ready to Grow?", sub_heading: "Start today", description: "Follow us for more.", cta_button: "Visit Our Website" },
          ],
        });
      })
    );

  const generate = carousel
    .command("generate")
    .description("Generate a carousel post using PostNitro's AI engine")
    .requiredOption("--context <text>", "Context/prompt for AI generation (or article/post URL, depending on --type)")
    .option("--type <type>", "AI generation type: text | article | x", "text")
    .option("--instructions <text>", "Additional instructions for the AI")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--preset-id <id>", "AI preset ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG | DESIGN (DESIGN skips rendering)")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false);
  addImageGenerationOptions(generate).action(
      action(async (opts, cmd: Command) => {
        const { apiKey, client } = await clientFor(cmd);
        const defaults = await resolveDefaultsFor(client, apiKey, opts, true);
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
          generateImages: resolveGenerateImages(opts),
        });
        const embedPostId = initResponse.data.embedPostId;

        if (!opts.wait) {
          printResult({
            success: true,
            embedPostId,
            status: initResponse.data.status,
            usedDefaults: defaults,
            nextStep: `Use \`postnitro carousel status ${embedPostId}\` to monitor progress.`,
          });
          return;
        }

        await waitAndPrint(client, embedPostId, { usedDefaults: defaults });
      })
    );

  const importCmd = carousel
    .command("import")
    .description("Create a carousel from your own slide content (see `carousel import-template` for the required format)")
    .option("--file <path>", "Path to a JSON file containing a `slides` array (or a bare array)")
    .option("--slides <json>", "Slides as inline JSON — a bare array or {\"slides\":[...]}. Overrides --file.")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG | DESIGN (DESIGN skips rendering)")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false);
  addImageGenerationOptions(importCmd).action(
      action(async (opts, cmd: Command) => {
        const { apiKey, client } = await clientFor(cmd);
        const slides = await resolveCarouselSlides(opts.slides, opts.file, { inline: "--slides", file: "--file" });

        const defaults = await resolveDefaultsFor(client, apiKey, opts, false);

        const initResponse = await client.initiateImport({
          postType: "CAROUSEL",
          templateId: defaults.templateId,
          brandId: defaults.brandId,
          responseType: defaults.responseType,
          requestorId: opts.requestorId,
          slides,
          generateImages: resolveGenerateImages(opts),
        });
        const embedPostId = initResponse.data.embedPostId;

        if (!opts.wait) {
          printResult({
            success: true,
            embedPostId,
            status: initResponse.data.status,
            usedDefaults: defaults,
            nextStep: `Use \`postnitro carousel status ${embedPostId}\` to monitor progress.`,
          });
          return;
        }

        await waitAndPrint(client, embedPostId, { usedDefaults: defaults });
      })
    );

  registerPostInspectionCommands(carousel, "carousel");
}
