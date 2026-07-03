import { readFile } from "node:fs/promises";

export async function readJsonFile<T>(path: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (error) {
    throw new Error(`Could not read file "${path}": ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`File "${path}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
