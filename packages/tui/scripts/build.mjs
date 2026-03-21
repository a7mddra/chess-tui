import { build, context } from "esbuild";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const distDir = resolve(packageRoot, "dist");
const watchMode = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: [resolve(packageRoot, "src/main.tsx")],
  bundle: true,
  outdir: distDir,
  format: "esm",
  platform: "node",
  target: ["node18"],
  sourcemap: watchMode,
  logLevel: "info",
  // Externalize all dependencies so they are installed via package.json
  // instead of being bundled into the output file.
  external: ["ink", "react", "chess.js", "stockfish", "ws", "@opentui/core"],
  // Resolve `@/` to `src/` to match tsconfig paths
  alias: {
    "@": resolve(packageRoot, "src"),
  },
};

function prepareDistDir() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
}

async function run() {
  prepareDistDir();

  if (watchMode) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("[tui] watching for changes...");
    return;
  }

  await build(buildOptions);
  console.log("[tui] build complete");
}

run().catch((error) => {
  console.error("[tui] build failed:", error);
  process.exitCode = 1;
});
