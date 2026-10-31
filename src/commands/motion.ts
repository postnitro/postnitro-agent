import { Command } from "commander";
import { printResult, action } from "../lib/output.js";
import { clientFor } from "../lib/generation.js";

/**
 * A video's motion: the styles and sequences `video generate/import` take as
 * --motion-style and --sequence. They're saved in the PostNitro app's video
 * editor (Your styles, Your sequences) or through the API; the CLI lists them.
 */
export function registerMotionCommands(program: Command): void {
  const motion = program.command("motion").description("List the motion styles and sequences video posts take");

  motion
    .command("styles")
    .description("List the built-in motion styles and the workspace's saved ones, with the IDs to pass as --motion-style")
    .action(
      action(async (_opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const styles = (await client.listMotionStyles()).data.styles ?? [];
        printResult({
          count: styles.length,
          styles,
          note: "Pass a built-in style by its id (its name, e.g. bold) and a saved one by its id.",
        });
      })
    );

  motion
    .command("sequences")
    .description("List the workspace's saved motion sequences, with the IDs to pass as --sequence")
    .action(
      action(async (_opts, cmd: Command) => {
        const { client } = await clientFor(cmd);
        const sequences = (await client.listMotionSequences()).data.sequences ?? [];
        printResult({
          count: sequences.length,
          sequences,
          ...(sequences.length === 0
            ? { note: "No saved sequences yet. Save one in the video editor (Your sequences) or through the API, or make the video without --sequence." }
            : {}),
        });
      })
    );
}
