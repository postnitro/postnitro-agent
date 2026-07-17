import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

export function registerPresetCommands(program: Command): void {
  const preset = program.command("preset").description("Browse available AI generation presets");

  preset
    .command("list")
    .description("List available AI configuration presets")
    .option("--page <n>", "Page number", "1")
    .option("--limit <n>", "Results per page (max 50)", "10")
    .action(
      action(async (opts, cmd: Command) => {
        const globals = cmd.optsWithGlobals();
        const client = new PostNitroClient(await resolveApiKey(globals.apiKey));
        const response = await client.listAiPresets(Number(opts.page), Number(opts.limit));
        const presets = response.data.presets;
        printResult({
          count: presets.length,
          presets: presets.map((p) => ({
            id: p.id,
            platform: p.socialPlatform,
            tone: p.tone,
            audience: p.audience,
            language: p.language,
            slides: p.slides,
            model: p.model,
          })),
          page: Number(opts.page),
          limit: Number(opts.limit),
        });
      })
    );
}
