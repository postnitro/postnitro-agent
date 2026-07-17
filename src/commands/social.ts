import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";

function getClient(cmd: Command): Promise<PostNitroClient> {
  const opts = cmd.optsWithGlobals();
  return resolveApiKey(opts.apiKey).then((apiKey) => new PostNitroClient(apiKey));
}

export function registerSocialCommands(program: Command): void {
  const social = program.command("social").description("Manage connected social accounts");

  social
    .command("list")
    .description("List connected social accounts, grouped by platform")
    .action(
      action(async (_opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.listSocialAccounts();
        const grouped = response.data.socialAccounts;
        const flat = Object.entries(grouped).flatMap(([platform, accounts]) =>
          accounts.map((a) => ({
            id: a.id,
            platform,
            handle: a.accountHandle,
            name: a.accountName,
            accountType: a.accountType,
            status: a.accessTokenStatus,
          }))
        );
        printResult({ count: flat.length, accounts: flat });
      })
    );

  social
    .command("get <id>")
    .description("Fetch a single connected social account by ID, including usage stats")
    .action(
      action(async (id: string, _opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.getSocialAccount(id);
        printResult(response.data);
      })
    );

  social
    .command("disconnect <id>")
    .description("Disconnect (delete) a connected social account. Cannot be undone.")
    .option("--yes", "Confirm the destructive action (required — otherwise the command refuses to run)", false)
    .action(
      action(async (id: string, opts, cmd: Command) => {
        if (!opts.yes) {
          throw new Error("Refusing to disconnect a social account without --yes. Pass --yes to confirm.");
        }
        const client = await getClient(cmd);
        const response = await client.disconnectSocialAccount(id);
        printResult({ success: true, message: response.message ?? "Social account disconnected." });
      })
    );
}
