import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

function getClient(cmd: Command): Promise<PostNitroClient> {
  const opts = cmd.optsWithGlobals();
  return resolveApiKey(opts.apiKey).then((apiKey) => new PostNitroClient(apiKey));
}

/**
 * Audio is uploaded in the PostNitro app; the API lists and deletes it. These
 * commands exist to resolve the `audioId` that `video generate/import` takes as
 * --audio-id and that a scheduled reel takes as postSettings.audioId.
 */
export function registerAudioCommands(program: Command): void {
  const audio = program.command("audio").description("List and delete workspace audio tracks used by video posts and reels");

  audio
    .command("list")
    .description("List the workspace's audio tracks with the IDs to pass as --audio-id")
    .option("--page <number>", "Page number", "1")
    .option("--limit <number>", "Results per page (max 100)", "10")
    .action(
      action(async (opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.listAudios(Number(opts.page), Number(opts.limit));
        const audios = response.data.audios ?? [];
        printResult({
          count: audios.length,
          audios,
          ...(audios.length === 0
            ? { note: "No audio in this workspace yet. Upload tracks in the PostNitro app — the API cannot upload them — or create the video without --audio-id." }
            : {}),
        });
      })
    );

  audio
    .command("delete <id>")
    .description("Delete an audio track and its stored file. Cannot be undone.")
    .option("--yes", "Confirm the destructive action (required — otherwise the command refuses to run)", false)
    .action(
      action(async (id: string, opts, cmd: Command) => {
        if (!opts.yes) {
          throw new Error("Refusing to delete an audio track without --yes. Pass --yes to confirm.");
        }
        const client = await getClient(cmd);
        const response = await client.deleteAudio(id);
        printResult({ success: true, message: response.message ?? "Audio deleted." });
      })
    );
}
