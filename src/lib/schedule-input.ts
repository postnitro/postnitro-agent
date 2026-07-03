import { Command } from "commander";
import { readJsonFile } from "./json-file.js";
import type { ScheduledPostRequest } from "./types.js";

/** Parses a JSON-valued CLI option, throwing a clean (JSON-formatted) error on bad input or wrong shape. */
export function parseJsonOption(raw: string | undefined, flag: string, expect: "object" | "array"): unknown {
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${flag} must be valid JSON: ${(e as Error).message}`);
  }
  const isArray = Array.isArray(parsed);
  if (expect === "array" && !isArray) {
    throw new Error(`${flag} must be a JSON array (e.g. '["acct_1","acct_2"]').`);
  }
  if (expect === "object" && (isArray || parsed === null || typeof parsed !== "object")) {
    throw new Error(`${flag} must be a JSON object.`);
  }
  return parsed;
}

const SCHEDULE_JSON_FIELDS: Array<[keyof ScheduledPostRequest, string, "object" | "array"]> = [
  ["postContent", "--post-content", "object"],
  ["selectedAccounts", "--selected-accounts", "array"],
  ["instagramPostSettings", "--instagram-post-settings", "object"],
  ["tiktokPostSettings", "--tiktok-post-settings", "object"],
  ["linkedinPostSettings", "--linkedin-post-settings", "object"],
  ["threadsPostSettings", "--threads-post-settings", "object"],
  ["postSettings", "--post-settings", "object"],
];

/** Adds the JSON-valued scheduled-post body options (postContent, selectedAccounts, per-platform settings). */
export function addScheduleJsonOptions(cmd: Command): Command {
  return cmd
    .option(
      "--post-content <json>",
      "Captions as a JSON object keyed by platform, e.g. '{\"common\":\"Launch day! 🚀\"}' (keys: common, linkedin, instagram, tiktok, facebook, threads)"
    )
    .option("--selected-accounts <json>", "Social account IDs as a JSON array, e.g. '[\"acct_789\"]'")
    .option(
      "--instagram-post-settings <json>",
      "Instagram settings as a JSON object, e.g. '{\"postType\":\"carousel\",\"postAsStory\":false}'"
    )
    .option("--tiktok-post-settings <json>", "TikTok settings as a JSON object (see PostNitro platform-settings docs)")
    .option(
      "--linkedin-post-settings <json>",
      "LinkedIn settings as a JSON object, e.g. '{\"postType\":\"document\",\"postTitle\":\"My title\"}'"
    )
    .option("--threads-post-settings <json>", "Threads settings as a JSON object, e.g. '{\"postType\":\"carousel\"}'")
    .option("--post-settings <json>", "Reel settings as a JSON object (required for reel post types), e.g. '{\"videoDuration\":30}'");
}

/**
 * Merges a --file JSON base with the inline JSON field flags (inline flags win). Does NOT set
 * status/scheduledAt/designId — callers layer those on top.
 */
export async function resolveScheduleBody(opts: Record<string, any>): Promise<Partial<ScheduledPostRequest>> {
  const base = opts.file ? await readJsonFile<Partial<ScheduledPostRequest>>(opts.file) : {};
  const merged: Record<string, unknown> = { ...base };
  for (const [field, flag, expect] of SCHEDULE_JSON_FIELDS) {
    const value = parseJsonOption(opts[field], flag, expect);
    if (value !== undefined) merged[field] = value;
  }
  return merged as Partial<ScheduledPostRequest>;
}
