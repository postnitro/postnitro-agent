import { Command } from "commander";
import { printResult, action } from "../lib/output.js";
import {
  clientFor,
  registerPostInspectionCommands,
  addImageGenerationOptions,
  resolveGenerateImages,
  addVideoOptions,
  resolveVideoSettings,
  waitAndPrint,
} from "../lib/generation.js";
import { resolveEditSlides } from "../lib/slide-input.js";
import type { ResponseType } from "../lib/types.js";

const RESPONSE_TYPES: ResponseType[] = ["DESIGN", "PDF", "PNG", "MP4"];

/**
 * An edit's output format. Saved defaults don't apply: the design's post type, not
 * the CLI, decides which formats fit, and the API checks it. Omitted, it's DESIGN.
 */
function editResponseType(requested: string | undefined): ResponseType | undefined {
  if (requested === undefined) return undefined;
  const value = String(requested).toUpperCase() as ResponseType;
  if (!RESPONSE_TYPES.includes(value)) {
    throw new Error(`Invalid --response-type "${requested}". Use DESIGN, PDF or PNG, or for a video MP4 or DESIGN.`);
  }
  return value;
}

/**
 * Reading and editing a post made through the API (generate or import), by its
 * design ID: read it back in the shape import takes, change it, and send every
 * slide back. The edit is in place, so the design keeps its ID and anything
 * scheduled with it shows the edit. Designs made in the editor can't be read or
 * edited here.
 */
export function registerDesignCommands(program: Command): void {
  const design = program
    .command("design")
    .description("Read and edit a post made through the API, by its design ID (not its embedPostId)");

  design
    .command("get <designId>")
    .description("Read a design made through the API in the shape import takes (slides, or one slide object for an image), with its brand. Free")
    .action(
      action(async (designId: string, _opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const response = await client.getDesign(designId);
        printResult(response.data.design);
      })
    );

  const edit = design
    .command("edit <designId>")
    .description(
      "Replace ALL the slides of a design made through the API, in place: it keeps its design ID, name, look, size and brand " +
        "(a video its style and audio, unless given), so scheduled posts show the edit. Read it with `design get` first and send back every slide to keep. 1 credit per slide"
    )
    .option("--file <path>", "JSON file with the new slides: an array (carousel, video), one object (image), or `design get`'s output, whose slides it takes")
    .option("--slides <json>", "The new slides as inline JSON, in the same shapes. Overrides --file")
    .option("--response-type <type>", "Output format: DESIGN (default, skips rendering) | PDF | PNG, or for a video MP4 | DESIGN. Saved defaults don't apply")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until the edit completes and print the final output", false);
  addVideoOptions(addImageGenerationOptions(edit)).action(
    action(async (designId: string, opts, cmd: Command) => {
      const { client } = await clientFor(cmd);
      const slides = await resolveEditSlides(opts.slides, opts.file, { inline: "--slides", file: "--file" });

      const initResponse = await client.initiateEdit({
        designId,
        slides,
        responseType: editResponseType(opts.responseType),
        requestorId: opts.requestorId,
        generateImages: resolveGenerateImages(opts),
        videoSettings: resolveVideoSettings(opts),
      });
      const embedPostId = initResponse.data.embedPostId;

      if (!opts.wait) {
        printResult({
          success: true,
          embedPostId,
          designId: initResponse.data.designId,
          status: initResponse.data.status,
          nextStep: `Use \`postnitro design status ${embedPostId}\` to monitor progress, then \`postnitro design output ${embedPostId}\`.`,
        });
        return;
      }

      await waitAndPrint(client, embedPostId);
    })
  );

  registerPostInspectionCommands(design, "design", "design edit");
}
