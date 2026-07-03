import { Command } from "commander";
import { resolveApiKey, getDefaults, setDefaults } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

export function registerDefaultsCommands(program: Command): void {
  const defaults = program
    .command("defaults")
    .description("Save default templateId/brandId/presetId/responseType so generate/import commands don't need them every time");

  defaults
    .command("get")
    .description("Show the saved defaults for the active API key")
    .action(
      action(async (_opts, cmd: Command) => {
        const apiKey = await resolveApiKey(cmd.optsWithGlobals().apiKey);
        const saved = await getDefaults(apiKey);
        printResult(saved ? { hasDefaults: true, defaults: saved } : { hasDefaults: false });
      })
    );

  defaults
    .command("set")
    .description("Save default templateId/brandId/presetId/responseType for the active API key")
    .option("--template-id <id>", "Default template ID")
    .option("--brand-id <id>", "Default brand ID")
    .option("--preset-id <id>", "Default AI preset ID")
    .option("--response-type <type>", "Default output format: PDF | PNG")
    .action(
      action(async (opts, cmd: Command) => {
        if (
          opts.templateId === undefined &&
          opts.brandId === undefined &&
          opts.presetId === undefined &&
          opts.responseType === undefined
        ) {
          throw new Error(
            "Nothing to save. Provide at least one of --template-id, --brand-id, --preset-id, or --response-type. " +
              "(If you ran this via `npm run dev`, remember the `--` separator: `npm run dev -- defaults set --brand-id <id>`.)"
          );
        }
        const apiKey = await resolveApiKey(cmd.optsWithGlobals().apiKey);
        const saved = await setDefaults(apiKey, {
          templateId: opts.templateId,
          brandId: opts.brandId,
          presetId: opts.presetId,
          responseType: opts.responseType,
        });
        printResult({ success: true, message: "Defaults saved.", defaults: saved });
      })
    );
}
