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
import { resolveImageSlide, IMAGE_SLIDE_FIELDS } from "../lib/slide-input.js";

export function registerImageCommands(program: Command): void {
  const image = program.command("image").description("Generate, import, and inspect single-image posts");

  image
    .command("import-template")
    .description("Print the exact slide object and rules required by `image import`")
    .action(
      action(async () => {
        printResult({
          rules: {
            "1_single_object": "IMAGE takes a SINGLE slide object — not an array (arrays are CAROUSEL-only)",
            "2_heading_required": "`heading` is required; every other field is optional",
            "3_allowed_fields_only": `Only these fields are allowed: ${IMAGE_SLIDE_FIELDS.join(", ")} (any other field is rejected)`,
            "4_infographic_optional": "Set layoutType to 'infographic' (with layoutConfig) to render a data infographic instead of a plain image",
            "5_infographic_ids_required": "Every layoutConfig column and content item needs a caller-provided `id` — the API does not generate them",
          },
          slide_fields: {
            heading: "(required) Main heading text",
            sub_heading: "(optional) Subtitle text",
            description: "(optional) Description / body text",
            cta_button: "(optional) Call-to-action button text",
            image: "(optional) Image URL",
            background_image: "(optional) Background image URL",
            layoutType: "(optional) 'default' or 'infographic'",
            layoutConfig: "(optional, used when layoutType is 'infographic') See infographic_config below",
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
          example_slide: {
            heading: "Welcome!",
            sub_heading: "My Awesome Subtitle",
            description: "This is how you start with a bang.",
            cta_button: "Learn more",
            background_image: "https://images.pexels.com/photos/33210609/pexels-photo-33210609.jpeg",
          },
        });
      })
    );

  const generate = image
    .command("generate")
    .description("Generate a single-image post using PostNitro's AI engine")
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
          postType: "IMAGE",
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
            nextStep: `Use \`postnitro image status ${embedPostId}\` to monitor progress.`,
          });
          return;
        }

        await waitAndPrint(client, embedPostId, { usedDefaults: defaults });
      })
    );

  const importCmd = image
    .command("import")
    .description("Create a single-image post from your own content (see `image import-template` for the required format)")
    .option("--file <path>", "Path to a JSON file containing a single slide object (or a `{ slides: {...} }` wrapper)")
    .option("--slide <json>", "The slide as inline JSON — a single object. Overrides --file.")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG | DESIGN (DESIGN skips rendering)")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false);
  addImageGenerationOptions(importCmd).action(
      action(async (opts, cmd: Command) => {
        const { apiKey, client } = await clientFor(cmd);
        const slide = await resolveImageSlide(opts.slide, opts.file, { inline: "--slide", file: "--file" });

        const defaults = await resolveDefaultsFor(client, apiKey, opts, false);

        const initResponse = await client.initiateImport({
          postType: "IMAGE",
          templateId: defaults.templateId,
          brandId: defaults.brandId,
          responseType: defaults.responseType,
          requestorId: opts.requestorId,
          slides: slide,
          generateImages: resolveGenerateImages(opts),
        });
        const embedPostId = initResponse.data.embedPostId;

        if (!opts.wait) {
          printResult({
            success: true,
            embedPostId,
            status: initResponse.data.status,
            usedDefaults: defaults,
            nextStep: `Use \`postnitro image status ${embedPostId}\` to monitor progress.`,
          });
          return;
        }

        await waitAndPrint(client, embedPostId, { usedDefaults: defaults });
      })
    );

  registerPostInspectionCommands(image, "image");
}
