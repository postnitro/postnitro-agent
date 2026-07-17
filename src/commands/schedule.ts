import { Command } from "commander";
import { PostNitroClient } from "../lib/client.js";
import { resolveApiKey } from "../lib/config-store.js";
import { printResult, action } from "../lib/output.js";
import { scheduleWarnings } from "../lib/schedule-warnings.js";
import { addScheduleJsonOptions, resolveScheduleBody } from "../lib/schedule-input.js";
import type { ScheduledPostRequest } from "../lib/types.js";

function getClient(cmd: Command): Promise<PostNitroClient> {
  const opts = cmd.optsWithGlobals();
  return resolveApiKey(opts.apiKey).then((apiKey) => new PostNitroClient(apiKey));
}

/**
 * Builds a ScheduledPostRequest from --file JSON and/or individual flags. For every field, an
 * explicit flag overrides the same field from --file. JSON-valued fields (postContent,
 * selectedAccounts, per-platform settings, postSettings) are passed as JSON strings on their flags.
 */
async function resolveScheduleRequest(opts: Record<string, any>): Promise<ScheduledPostRequest> {
  const body = await resolveScheduleBody(opts);
  const status = opts.status ?? body.status;
  const scheduledAt = opts.scheduledAt ?? body.scheduledAt;
  if (!status || !scheduledAt) {
    throw new Error("Missing --status and/or --scheduled-at (or set them in the --file JSON body).");
  }
  return {
    ...body,
    status,
    scheduledAt,
    designId: opts.designId !== undefined ? opts.designId : body.designId,
  } as ScheduledPostRequest;
}

function addScheduleInputOptions(cmd: Command): Command {
  return addScheduleJsonOptions(
    cmd
      .option("--file <path>", "Path to a JSON file with the full scheduled-post body (any field below can live here instead)")
      .option("--status <status>", "'DRAFT' or 'SCHEDULED'")
      .option("--scheduled-at <iso>", "ISO-8601 datetime, must be 5 minutes in the future")
      .option("--design-id <id>", "Design ID to attach (from `output`'s designId field — NOT the embedPostId)")
  );
}

export function registerScheduleCommands(program: Command): void {
  const schedule = program.command("schedule").description("Manage scheduled posts and drafts");

  schedule
    .command("list")
    .description("List scheduled posts and drafts within a date range")
    .requiredOption("--from <date>", "Start of range (ISO-8601 recommended)")
    .requiredOption("--to <date>", "End of range (ISO-8601 recommended)")
    .action(
      action(async (opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.listScheduledPosts(opts.from, opts.to);
        const posts = response.data;
        printResult({
          count: posts.length,
          posts: posts.map((p) => ({
            id: p.id,
            status: p.status,
            scheduledFor: p.scheduledFor,
            designId: p.designId,
            designName: p.designDetails?.name ?? null,
            accounts: p.socialAccounts.map((a) => ({ socialAccountId: a.socialAccountId, status: a.status, liveLink: a.liveLink })),
            captions: p.postContents.map((c) => ({ platform: c.platform, text: c.text })),
            publishedAt: p.publishedAt,
            errorMessage: p.errorMessage,
          })),
        });
      })
    );

  schedule
    .command("get <id>")
    .description("Fetch a single scheduled post by ID")
    .action(
      action(async (id: string, _opts, cmd: Command) => {
        const client = await getClient(cmd);
        const response = await client.getScheduledPost(id);
        printResult({ post: response.data });
      })
    );

  addScheduleInputOptions(
    schedule
      .command("create")
      .description(
        "Create a scheduled post or draft. A post must have either --design-id or non-empty postContent (via --file). " +
          "Per-platform settings are conditionally required — see the PostNitro docs for the full ruleset."
      )
  ).action(
    action(async (opts, cmd: Command) => {
      const client = await getClient(cmd);
      const request = await resolveScheduleRequest(opts);
      const response = await client.createScheduledPost(request);
      const warnings = scheduleWarnings(request);
      printResult({
        success: true,
        message: response.message ?? "Scheduled post created.",
        scheduledPostId: response.data.id,
        post: response.data,
        ...(warnings.length ? { warnings } : {}),
      });
    })
  );

  addScheduleInputOptions(
    schedule
      .command("update <id>")
      .description(
        "Update an existing scheduled post or draft. This REPLACES captions/selected accounts — send the full intended state, not just changed fields."
      )
  ).action(
    action(async (id: string, opts, cmd: Command) => {
      const client = await getClient(cmd);
      const request = await resolveScheduleRequest(opts);
      const response = await client.updateScheduledPost(id, request);
      const warnings = scheduleWarnings(request);
      printResult({
        success: true,
        message: response.message ?? "Scheduled post updated.",
        scheduledPostId: response.data.id,
        post: response.data,
        ...(warnings.length ? { warnings } : {}),
      });
    })
  );

  schedule
    .command("delete <id>")
    .description("Delete a scheduled post (or draft). Cannot be undone.")
    .option("--yes", "Confirm the destructive action (required — otherwise the command refuses to run)", false)
    .action(
      action(async (id: string, opts, cmd: Command) => {
        if (!opts.yes) {
          throw new Error("Refusing to delete a scheduled post without --yes. Pass --yes to confirm.");
        }
        const client = await getClient(cmd);
        const response = await client.deleteScheduledPost(id);
        printResult({ success: true, message: response.message ?? "Scheduled post deleted." });
      })
    );
}
