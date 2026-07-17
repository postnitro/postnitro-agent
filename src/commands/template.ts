import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

export function registerTemplateCommands(program: Command): void {
  const template = program.command("template").description("Browse available carousel templates");

  template
    .command("list")
    .description("List available carousel templates")
    .option("--page <n>", "Page number", "1")
    .option("--limit <n>", "Results per page (max 50)", "10")
    .action(
      action(async (opts, cmd: Command) => {
        const globals = cmd.optsWithGlobals();
        const client = new PostNitroClient(await resolveApiKey(globals.apiKey));
        const response = await client.listTemplates(Number(opts.page), Number(opts.limit));
        const templates = response.data.templates;
        printResult({
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            aspectRatio: t.size?.id ?? null,
            width: t.size?.dimensions?.width ?? null,
            height: t.size?.dimensions?.height ?? null,
          })),
          page: Number(opts.page),
          limit: Number(opts.limit),
        });
      })
    );
}
