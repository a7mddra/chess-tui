import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const distDir = resolve(packageRoot, "dist");
const watchMode = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: [
    resolve(packageRoot, "src/background.ts"),
    resolve(packageRoot, "src/content.ts"),
    resolve(packageRoot, "src/page-bridge.ts"),
  ],
  bundle: true,
  outdir: distDir,
  format: "iife",
  platform: "browser",
  target: ["chrome120"],
  sourcemap: watchMode,
  logLevel: "info",
};

function prepareDistDir() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  cpSync(
    resolve(packageRoot, "manifest.json"),
    resolve(distDir, "manifest.json"),
  );
}

async function run() {
  prepareDistDir();

  if (watchMode) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("[ext] watching for changes...");
    return;
  }

  await build(buildOptions);
  console.log("[ext] build complete");
}

run().catch((error) => {
  console.error("[ext] build failed:", error);
  process.exitCode = 1;
});
