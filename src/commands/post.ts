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
 * embedPostId — the one generate, import or an edit returned, since they all
 * point at the same design: read it back in the shape import takes, change it,
 * and send every slide back. The edit is in place, so the design keeps its ID
 * and anything scheduled with it shows the edit.
 */
export function registerPostCommands(program: Command): void {
  const post = program
    .command("post")
    .description("Read and edit a post made through the API, by its embedPostId");

  post
    .command("get <embedPostId>")
    .description("Read a post made through the API: its design in the shape import takes (slides, or one slide object for an image), with its brand. Free")
    .action(
      action(async (embedPostId: string, _opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const response = await client.getPost(embedPostId);
        printResult(response.data.design);
      })
    );

  const edit = post
    .command("edit <embedPostId>")
    .description(
      "Replace ALL the slides of a post made through the API, in place: its design keeps its ID, name, look, size and brand " +
        "(a video its style and audio, unless given), so scheduled posts show the edit. Read it with `post get` first and send back every slide to keep. 1 credit per slide"
    )
    .option("--file <path>", "JSON file with the new slides: an array (carousel, video), one object (image), or `post get`'s output, whose slides it takes")
    .option("--slides <json>", "The new slides as inline JSON, in the same shapes. Overrides --file")
    .option("--response-type <type>", "Output format: DESIGN (default, skips rendering) | PDF | PNG, or for a video MP4 | DESIGN. Saved defaults don't apply")
    .option("--requestor-id <id>", "Optional custom tracking ID")
    .option("--wait", "Poll until the edit completes and print the final output", false);
  addVideoOptions(addImageGenerationOptions(edit)).action(
    action(async (editedPostId: string, opts, cmd: Command) => {
      const { client } = await clientFor(cmd);
      const slides = await resolveEditSlides(opts.slides, opts.file, { inline: "--slides", file: "--file" });

      const initResponse = await client.initiateEdit({
        embedPostId: editedPostId,
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
          nextStep: `Use \`postnitro post status ${embedPostId}\` to monitor progress, then \`postnitro post output ${embedPostId}\`.`,
        });
        return;
      }

      await waitAndPrint(client, embedPostId);
    })
  );

  registerPostInspectionCommands(post, "post", "post's edit");
}
