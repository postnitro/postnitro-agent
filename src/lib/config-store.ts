import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = process.env.POSTNITRO_CONFIG_DIR || join(homedir(), ".postnitro-cli");

export interface UserDefaults {
  templateId?: string;
  brandId?: string;
  presetId?: string;
  responseType?: "PDF" | "PNG";
  updatedAt: string;
}

function hashKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

/** Resolves the API key: --api-key flag > POSTNITRO_API_KEY env var > saved config file. */
export async function resolveApiKey(flagValue?: string): Promise<string> {
  if (flagValue) return flagValue;
  if (process.env.POSTNITRO_API_KEY) return process.env.POSTNITRO_API_KEY;

  try {
    const raw = await readFile(join(CONFIG_DIR, "config.json"), "utf-8");
    const parsed = JSON.parse(raw) as { apiKey?: string };
    if (parsed.apiKey) return parsed.apiKey;
  } catch {
    // no saved config
  }

  throw new Error(
    "No API key found. Pass --api-key, set the POSTNITRO_API_KEY environment variable, or run `postnitro auth set-key <key>`."
  );
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(join(CONFIG_DIR, "config.json"), JSON.stringify({ apiKey }, null, 2));
}

export async function clearApiKey(): Promise<void> {
  try {
    await unlink(join(CONFIG_DIR, "config.json"));
  } catch {
    // nothing to clear
  }
}

function defaultsPath(apiKey: string): string {
  return join(CONFIG_DIR, "defaults", `${hashKey(apiKey)}.json`);
}

export async function getDefaults(apiKey: string): Promise<UserDefaults | null> {
  try {
    const raw = await readFile(defaultsPath(apiKey), "utf-8");
    return JSON.parse(raw) as UserDefaults;
  } catch {
    return null;
  }
}

export async function setDefaults(apiKey: string, defaults: Omit<UserDefaults, "updatedAt">): Promise<UserDefaults> {
  const existing = await getDefaults(apiKey);
  const merged: UserDefaults = {
    ...existing,
    ...Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== undefined)),
    updatedAt: new Date().toISOString(),
  };
  await mkdir(join(CONFIG_DIR, "defaults"), { recursive: true });
  await writeFile(defaultsPath(apiKey), JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Resolves templateId/brandId/(presetId) from explicit CLI flags, falling back to
 * saved defaults, then to auto-selecting when the workspace has exactly one candidate.
 */
export async function resolveGenerationDefaults(
  apiKey: string,
  params: { templateId?: string; brandId?: string; presetId?: string; responseType?: "PDF" | "PNG" },
  fetchCandidates: {
    templates: () => Promise<Array<{ id: string; label: string }>>;
    brands: () => Promise<Array<{ id: string; label: string }>>;
    presets: () => Promise<Array<{ id: string; label: string }>>;
  },
  options: { requirePreset?: boolean } = {}
): Promise<{ templateId: string; brandId: string; presetId?: string; responseType: "PDF" | "PNG" }> {
  const saved = await getDefaults(apiKey);

  let templateId = params.templateId || saved?.templateId;
  let brandId = params.brandId || saved?.brandId;
  let presetId = params.presetId || saved?.presetId;
  const responseType = params.responseType || saved?.responseType || "PDF";

  if (!templateId) templateId = await autoSelectSingle(fetchCandidates.templates, "templateId", "postnitro template list");
  if (!brandId) brandId = await autoSelectSingle(fetchCandidates.brands, "brandId", "postnitro brand list");
  if (!presetId && options.requirePreset) {
    presetId = await autoSelectSingle(fetchCandidates.presets, "presetId", "postnitro preset list");
  }

  return { templateId, brandId, presetId, responseType };
}

async function autoSelectSingle(
  fetchCandidates: () => Promise<Array<{ id: string; label: string }>>,
  fieldName: string,
  listCommand: string
): Promise<string> {
  let candidates: Array<{ id: string; label: string }>;
  try {
    candidates = await fetchCandidates();
  } catch {
    candidates = [];
  }

  if (candidates.length === 1) return candidates[0].id;

  if (candidates.length > 1) {
    const options = candidates.map((c) => `${c.id} (${c.label})`).join(", ");
    throw new Error(
      `Missing --${fieldName.replace(/Id$/, "-id")}. Your workspace has multiple candidates — pass one explicitly or save a default via \`postnitro defaults set\`. Available: ${options}`
    );
  }

  throw new Error(
    `Missing --${fieldName.replace(/Id$/, "-id")}. Provide it or save a default via \`postnitro defaults set\`. Use \`${listCommand}\` to find available IDs.`
  );
}
