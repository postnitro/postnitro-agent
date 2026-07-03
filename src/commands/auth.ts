import { Command } from "commander";
import { saveApiKey, clearApiKey, resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage the saved PostNitro API key");

  auth
    .command("set-key <apiKey>")
    .description("Save an API key to ~/.postnitro-cli/config.json so you don't need to pass --api-key every time")
    .action(
      action(async (apiKey: string) => {
        await saveApiKey(apiKey);
        printResult({ success: true, message: "API key saved." });
      })
    );

  auth
    .command("status")
    .description("Show whether an API key is configured (masked) and where it's coming from")
    .action(
      action(async (_opts, cmd: Command) => {
        const flagValue = cmd.optsWithGlobals().apiKey;
        const source = flagValue ? "--api-key flag" : process.env.POSTNITRO_API_KEY ? "POSTNITRO_API_KEY env var" : "saved config file";
        const apiKey = await resolveApiKey(flagValue);
        const masked = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";
        printResult({ configured: true, source, apiKey: masked });
      })
    );

  auth
    .command("clear")
    .description("Remove the saved API key from ~/.postnitro-cli/config.json")
    .action(
      action(async () => {
        await clearApiKey();
        printResult({ success: true, message: "Saved API key removed." });
      })
    );
}
