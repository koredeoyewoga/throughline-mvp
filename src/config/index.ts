/**
 * Config load / save. Node.js runtime only (uses the fs API).
 * The active config is `.data/config.json` merged over DEFAULT_CONFIG and
 * validated. A "reset demo" of the coordination state does NOT touch this file —
 * operational config is reset separately from the Settings screen.
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, validateConfig, type PlaceConfig } from "./schema";
import { dataDir } from "@/lib/dataDir";

const FILE = path.join(dataDir(), "config.json");

let cache: { config: PlaceConfig; errors: string[] } | null = null;

export function getConfig(): PlaceConfig {
  return getConfigWithErrors().config;
}

export function getConfigWithErrors(): { config: PlaceConfig; errors: string[] } {
  if (cache) return cache;
  if (fs.existsSync(FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      cache = validateConfig(raw);
      return cache;
    } catch {
      cache = { config: DEFAULT_CONFIG, errors: ["config.json could not be read — using defaults"] };
      return cache;
    }
  }
  cache = { config: DEFAULT_CONFIG, errors: [] };
  return cache;
}

/** Validate, persist and return the new config plus any corrections that were made. */
export function saveConfig(raw: unknown): { config: PlaceConfig; errors: string[] } {
  const result = validateConfig(raw);
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(result.config, null, 2), "utf8");
  } catch {
    // Serverless read-only fs — the in-memory cache below still applies the
    // change for this instance.
  }
  cache = result;
  return result;
}

export function resetConfig(): PlaceConfig {
  try {
    if (fs.existsSync(FILE)) fs.rmSync(FILE);
  } catch {
    /* ignore */
  }
  cache = { config: DEFAULT_CONFIG, errors: [] };
  return DEFAULT_CONFIG;
}

export { DEFAULT_CONFIG, type PlaceConfig };
