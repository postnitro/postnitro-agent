import { Command } from "commander";
import { PostNitroClient, extractDesignId } from "../lib/client.js";
import { resolveApiKey, resolveGenerationDefaults } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";
import { readJsonFile } from "../lib/json-file.js";
import type { Slide } from "../lib/types.js";

function getClient(cmd: Command): Promise<PostNitroClient> {
  const opts = cmd.optsWithGlobals();
  return resolveApiKey(opts.apiKey).then((apiKey) => new PostNitroClient(apiKey, opts.baseUrl));
}

async function resolveDefaultsFor(
  client: PostNitroClient,
  apiKey: string,
  params: { templateId?: string; brandId?: string; presetId?: string; responseType?: "PDF" | "PNG" },
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

/** Resolves the slides array from inline --slides JSON (wins) or a --file path; accepts a bare array or `{ slides: [...] }`. */
async function resolveSlides(opts: Record<string, any>): Promise<Slide[]> {
  let parsed: unknown;
  if (opts.slides !== undefined) {
    try {
      parsed = JSON.parse(opts.slides);
    } catch (e) {
      throw new Error(`--slides must be valid JSON: ${(e as Error).message}`);
    }
  } else if (opts.file) {
    parsed = await readJsonFile<unknown>(opts.file);
  } else {
    throw new Error("Provide slides via --slides '<json>' or --file <path>.");
  }
  const slides = Array.isArray(parsed) ? parsed : (parsed as { slides?: unknown })?.slides;
  if (!Array.isArray(slides) || slides.length < 3) {
    throw new Error("Slides must be an array with at least 3 entries (starting_slide, body_slide(s), ending_slide).");
  }
  return slides as Slide[];
}

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
            columnCount: "1 | 2 | 3",
            columnDisplay: "'cycle' (sequential) or 'grid' (comparative)",
            displayCounterAs: "'none' or 'counter'",
            hasHeader: "true | false",
            columnData: [{ header: "Column Header", content: [{ title: "Item title", description: "Item description" }] }],
          },
          example_slides: [
            { type: "starting_slide", heading: "10 Digital Marketing Tips", sub_heading: "For Small Businesses", description: "Boost your online presence.", cta_button: "Swipe to learn more →" },
            { type: "body_slide", heading: "Tip 1: Know Your Audience", description: "Research your target demographic.", image: "https://example.com/audience.jpg" },
            { type: "ending_slide", heading: "Ready to Grow?", sub_heading: "Start today", description: "Follow us for more.", cta_button: "Visit Our Website" },
          ],
        });
      })
    );

  carousel
    .command("generate")
    .description("Generate a carousel post using PostNitro's AI engine")
    .requiredOption("--context <text>", "Context/prompt for AI generation (or article/post URL, depending on --type)")
    .option("--type <type>", "AI generation type: text | article | x", "text")
    .option("--instructions <text>", "Additional instructions for the AI")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--preset-id <id>", "AI preset ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false)
    .action(
      action(async (opts, cmd: Command) => {
        const apiKey = await resolveApiKey(cmd.optsWithGlobals().apiKey);
        const client = new PostNitroClient(apiKey, cmd.optsWithGlobals().baseUrl);
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

        await client.pollUntilComplete(embedPostId);
        const output = await client.getPostOutput(embedPostId);
        printResult({
          success: true,
          embedPostId,
          status: output.data.embedPost.status,
          responseType: output.data.embedPost.responseType,
          creditsUsed: output.data.embedPost.credits,
          designId: extractDesignId(output.data),
          name: output.data.result.name,
          aspectRatio: output.data.result.size,
          mimeType: output.data.result.mimeType,
          outputType: output.data.result.type,
          data: output.data.result.data,
          usedDefaults: defaults,
        });
      })
    );

  carousel
    .command("import")
    .description("Create a carousel from your own slide content (see `carousel import-template` for the required format)")
    .option("--file <path>", "Path to a JSON file containing a `slides` array (or a bare array)")
    .option("--slides <json>", "Slides as inline JSON — a bare array or {\"slides\":[...]}. Overrides --file.")
    .option("--template-id <id>", "Template ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--brand-id <id>", "Brand ID (falls back to saved default, or auto-selects if only one exists)")
    .option("--response-type <type>", "Output format: PDF | PNG")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until generation completes and print the final output", false)
    .action(
      action(async (opts, cmd: Command) => {
        const apiKey = await resolveApiKey(cmd.optsWithGlobals().apiKey);
        const client = new PostNitroClient(apiKey, cmd.optsWithGlobals().baseUrl);
        const slides = await resolveSlides(opts);

        const defaults = await resolveDefaultsFor(client, apiKey, opts, false);

        const initResponse = await client.initiateImport({
          postType: "CAROUSEL",
          templateId: defaults.templateId,
          brandId: defaults.brandId,
          responseType: defaults.responseType,
          requestorId: opts.requestorId,
          slides,
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

        await client.pollUntilComplete(embedPostId);
        const output = await client.getPostOutput(embedPostId);
        printResult({
          success: true,
          embedPostId,
          status: output.data.embedPost.status,
          responseType: output.data.embedPost.responseType,
          creditsUsed: output.data.embedPost.credits,
          designId: extractDesignId(output.data),
          name: output.data.result.name,
          aspectRatio: output.data.result.size,
          mimeType: output.data.result.mimeType,
          outputType: output.data.result.type,
          data: output.data.result.data,
          usedDefaults: defaults,
        });
      })
    );

  carousel
    .command("status <embedPostId>")
    .description("Check generation status and processing logs for a carousel post")
    .action(
      action(async (embedPostId: string, _opts, cmd: Command) => {
        const client = await getClient(cmd);
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

  carousel
    .command("output <embedPostId>")
    .description("Retrieve the generated output for a completed carousel")
    .action(
      action(async (embedPostId: string, _opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.getPostOutput(embedPostId);
        const { result, embedPost } = response.data;
        printResult({
          embedPostId: embedPost.id,
          status: embedPost.status,
          responseType: embedPost.responseType,
          creditsUsed: embedPost.credits,
          designId: extractDesignId(response.data),
          name: result.name,
          aspectRatio: result.size,
          mimeType: result.mimeType,
          outputType: result.type,
          data: result.data,
        });
      })
    );
}
