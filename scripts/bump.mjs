import fs from "node:fs";
import { execSync } from "node:child_process";

const [, , target, version] = process.argv;

if (!target || !version) {
  console.error(
    "\x1b[31mUsage: node scripts/bump.mjs <ext|tui> <version>\x1b[0m",
  );
  process.exit(1);
}

if (target !== "ext" && target !== "tui") {
  console.error('\x1b[31mError: Target must be "ext" or "tui"\x1b[0m');
  process.exit(1);
}

try {
  const status = execSync("git status --porcelain").toString().trim();
  if (status) {
    console.error(
      "\x1b[31mError: Git tree is dirty! Please commit or stash changes before bumping.\x1b[0m",
    );
    console.error(status);
    process.exit(1);
  }
} catch (e) {
  console.error("\x1b[31mFailed to check git status.\x1b[0m");
  process.exit(1);
}

console.log(`\x1b[36mBumping ${target.toUpperCase()} to v${version}...\x1b[0m`);

// 1. Update VERSION file
fs.writeFileSync("VERSION", version + "\n");

// Update JSON helper
function updateJson(filePath, newVersion) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.version = newVersion;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`Updated ${filePath}`);
}

try {
  if (target === "ext") {
    updateJson("packages/ext/package.json", version);
    updateJson("packages/ext/manifest.json", version);

    const readmePath = "README.md";
    let readme = fs.readFileSync(readmePath, "utf8");
    readme = readme.replace(
      /releases\/download\/v[^\/]+\/chess-tui-extension\.zip/g,
      `releases/download/v${version}/chess-tui-extension.zip`,
    );
    fs.writeFileSync(readmePath, readme);
    console.log(`Updated README.md release link`);

    execSync("npm run format", { stdio: "inherit" });
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "chore(release): ext v${version}"`, {
      stdio: "inherit",
    });
    execSync(`git tag v${version}`, { stdio: "inherit" });
    execSync("git push origin main", { stdio: "inherit" });
    execSync(`git push origin v${version}`, { stdio: "inherit" });

    console.log(
      `\x1b[32mSuccessfully bumped Extension to v${version} and pushed to GitHub!\x1b[0m`,
    );
  }

  if (target === "tui") {
    updateJson("package.json", version);
    updateJson("packages/tui/package.json", version);

    execSync("npm run format", { stdio: "inherit" });
    execSync("git add .", { stdio: "inherit" });
    execSync(`git commit -m "chore(release): tui v${version}"`, {
      stdio: "inherit",
    });
    execSync(`git tag v${version}`, { stdio: "inherit" });
    execSync("git push origin main", { stdio: "inherit" });
    execSync(`git push origin v${version}`, { stdio: "inherit" });

    console.log(`\x1b[36mPublishing to NPM registry...\x1b[0m`);
    try {
      execSync("npm publish --workspace chess-tui", { stdio: "inherit" });
    } catch (err) {
      console.error(
        "\x1b[33mWarning: NPM Publish failed. Are you logged in via \`npm login\`?\x1b[0m",
      );
    }

    console.log(
      `\x1b[32mSuccessfully bumped TUI to v${version}, pushed to GitHub, and fired NPM publish.\x1b[0m`,
    );
  }
} catch (error) {
  console.error(`\x1b[31mAn error occurred during the bump process.\x1b[0m`);
  console.error(error.message);
  process.exit(1);
}
