import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Canonicalise to the true on-disk casing so webpack does not see the same
// module under two differently-cased paths (this project lives under a
// directory whose stored name casing differs from how the shell addresses it).
const raw = dirname(fileURLToPath(import.meta.url));
let projectRoot = raw;
try {
  projectRoot = fs.realpathSync.native(raw);
} catch {
  /* keep raw */
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The project sits under a user home directory that contains an unrelated
  // package.json / lockfile. Pin the workspace root to this project so Next
  // resolves the local node_modules (and bundled tooling), not the home dir.
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
