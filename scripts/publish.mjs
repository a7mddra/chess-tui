import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";

const [, , target] = process.argv;

const configPath = path.resolve(process.cwd(), "pkg-tools.config.json");
let config = {};
if (fs.existsSync(configPath)) {
  try {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

    config = target && rawConfig[target] ? rawConfig[target] : rawConfig;
  } catch (error) {
    console.error(`\x1b[31mError parsing config file at ${configPath}\x1b[0m`);
    process.exit(1);
  }
}

const NPM_PACKAGE_NAME = process.env.PUBLISH_NPM_NAME || config.npmName;
const GITHUB_SCOPE = process.env.PUBLISH_GITHUB_SCOPE || config.githubScope;
const PACKAGE_DIR = process.env.PUBLISH_PACKAGE_DIR || config.packageDir || ".";
const BUILD_COMMAND = process.env.PUBLISH_BUILD_COMMAND || config.buildCommand;
const GITHUB_REGISTRY = "https://npm.pkg.github.com";

if (!NPM_PACKAGE_NAME || !GITHUB_SCOPE) {
  console.error(
    "\x1b[31mError: npmName and githubScope must be configured in pkg-tools.config.json or via env vars.\x1b[0m",
  );
  process.exit(1);
}

const GITHUB_PACKAGE_NAME = `${GITHUB_SCOPE}/${NPM_PACKAGE_NAME}`;
const PACKAGE_JSON_PATH = path.join(PACKAGE_DIR, "package.json");

if (!fs.existsSync(PACKAGE_JSON_PATH)) {
  console.error(
    `\x1b[31mError: package.json not found in ${PACKAGE_DIR}\x1b[0m`,
  );
  process.exit(1);
}

function ensureCleanGitTree() {
  try {
    const status = execSync("git status --porcelain").toString().trim();
    if (status) {
      console.error(
        "\x1b[31mError: Git tree is dirty! Please commit or stash changes before publishing.\x1b[0m",
      );
      console.error(status);
      process.exit(1);
    }
  } catch {
    console.error("\x1b[31mFailed to check git status.\x1b[0m");
    process.exit(1);
  }
}

function run(command) {
  execSync(command, { stdio: "inherit" });
}

function packageVersionExistsOnRegistry(packageName, version, registry) {
  try {
    execSync(
      `npm view ${packageName}@${version} version --registry=${registry}`,
      {
        stdio: "pipe",
      },
    )
      .toString()
      .trim();
    return true;
  } catch {
    return false;
  }
}

function parseErrorOutput(error) {
  const stdout = error?.stdout?.toString?.() || "";
  const stderr = error?.stderr?.toString?.() || "";
  const message = error?.message || "";
  return `${message}\n${stdout}\n${stderr}`;
}

function isRepublishForbidden(error) {
  const merged = parseErrorOutput(error);
  return (
    /\bE403\b/i.test(merged) ||
    /cannot be republished until 24 hours have passed/i.test(merged)
  );
}

function publish(publishCommand, label) {
  const result = spawnSync("sh", ["-c", publishCommand], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status === 0) return;

  const diagResult = spawnSync("sh", ["-c", publishCommand], {
    stdio: "pipe",
    env: process.env,
  });

  const diagError = {
    stdout: diagResult.stdout,
    stderr: diagResult.stderr,
    message: `Command failed with exit code ${result.status}`,
  };

  if (isRepublishForbidden(diagError)) {
    console.warn(
      `\x1b[33mSkipping ${label}: registry rejected republish.\x1b[0m`,
    );
    return;
  }

  const error = new Error(`Command failed: ${publishCommand}`);
  error.stdout = diagResult.stdout;
  error.stderr = diagResult.stderr;
  throw error;
}

function buildGithubPackageCopy() {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "librelec-gh-publish-"),
  );
  const tmpPackageDir = path.join(tmpRoot, "tui");

  fs.cpSync(PACKAGE_DIR, tmpPackageDir, { recursive: true });

  const packageJsonPath = path.join(tmpPackageDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  packageJson.name = GITHUB_PACKAGE_NAME;
  packageJson.publishConfig = { registry: GITHUB_REGISTRY };
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );

  return { tmpRoot, tmpPackageDir };
}

try {
  ensureCleanGitTree();

  const tuiPackage = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const packageVersion = tuiPackage.version;
  if (tuiPackage.name !== NPM_PACKAGE_NAME) {
    console.warn(
      `\x1b[33mWarning: ${PACKAGE_JSON_PATH} name is "${tuiPackage.name}" but NPM name is "${NPM_PACKAGE_NAME}".\x1b[0m`,
    );
  }

  if (BUILD_COMMAND) {
    console.log(`\x1b[36mRunning build command: ${BUILD_COMMAND}...\x1b[0m`);
    run(BUILD_COMMAND);
  }

  console.log(
    `\x1b[36mPublishing ${NPM_PACKAGE_NAME} to npm registry...\x1b[0m`,
  );
  run("npm login");
  const npmRegistry = "https://registry.npmjs.org";
  if (
    packageVersionExistsOnRegistry(
      NPM_PACKAGE_NAME,
      packageVersion,
      npmRegistry,
    )
  ) {
    console.warn(
      `\x1b[33mSkipping npm publish: ${NPM_PACKAGE_NAME}@${packageVersion} already exists on npm.\x1b[0m`,
    );
  } else {
    publish(`npm publish --workspace ${NPM_PACKAGE_NAME}`, "npm publish");
  }

  console.log(
    `\x1b[36mPreparing scoped package ${GITHUB_PACKAGE_NAME} for GitHub Packages...\x1b[0m`,
  );
  const { tmpRoot, tmpPackageDir } = buildGithubPackageCopy();

  try {
    run(`npm login --scope=${GITHUB_SCOPE} --registry=${GITHUB_REGISTRY}`);
    if (
      packageVersionExistsOnRegistry(
        GITHUB_PACKAGE_NAME,
        packageVersion,
        GITHUB_REGISTRY,
      )
    ) {
      console.warn(
        `\x1b[33mSkipping GitHub publish: ${GITHUB_PACKAGE_NAME}@${packageVersion} already exists on GitHub Packages.\x1b[0m`,
      );
    } else {
      publish(
        `npm publish ${tmpPackageDir} --registry=${GITHUB_REGISTRY} --ignore-scripts`,
        "GitHub Packages publish",
      );
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log(
    `\x1b[32mSuccessfully published ${NPM_PACKAGE_NAME} to npm and ${GITHUB_PACKAGE_NAME} to GitHub Packages.\x1b[0m`,
  );
} catch (error) {
  console.error("\x1b[31mAn error occurred during publish.\x1b[0m");
  console.error(error.message);
  process.exit(1);
}
