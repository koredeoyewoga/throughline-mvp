import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint config in the repo (lint is run separately); `next build` on CI
  // would otherwise try to bootstrap ESLint non-interactively and fail.
  eslint: { ignoreDuringBuilds: true },
};

// Windows-only: this project lives under a home directory whose stored casing
// differs from how the shell addresses it, and which contains an unrelated
// package.json. Canonicalise the path and pin the workspace root so webpack
// does not see one module under two casings and Next resolves the local
// node_modules. None of this is needed on a Linux CI / host, where applying it
// has caused `next build` to misbehave.
if (process.platform === "win32") {
  const raw = dirname(fileURLToPath(import.meta.url));
  let projectRoot = raw;
  try {
    projectRoot = fs.realpathSync.native(raw);
  } catch {
    /* keep raw */
  }
  nextConfig.turbopack = { root: projectRoot };
  nextConfig.outputFileTracingRoot = projectRoot;
}

export default nextConfig;
