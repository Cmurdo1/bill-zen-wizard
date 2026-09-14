#!/usr/bin/env node
/**
 * Fails if any real environment file is tracked, staged, or would otherwise be
 * pushed. `.env.example` is allowed — it is a template and must hold no values.
 *
 * Run standalone (`npm run env:check`) or from a pre-commit hook / CI step.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const TEMPLATE_FILES = new Set([".env.example"]);
const ENV_FILE = /^\.env($|\.)|[\\/]\.env($|\.)/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);
}

function isIgnored(path) {
  try {
    git(["check-ignore", "-q", path]);
    return true;
  } catch {
    return false;
  }
}

// `git ls-files` lists everything in the index, which includes staged additions.
const tracked = git(["ls-files", "-z"]).filter(
  (path) => ENV_FILE.test(path) && !TEMPLATE_FILES.has(path),
);

const onDisk = [".env", ".env.local"].filter((path) => existsSync(path) && !isIgnored(path));

const problems = [
  ...tracked.map((path) => `tracked in git:        ${path}`),
  ...onDisk.map((path) => `present but NOT ignored: ${path}`),
];

if (problems.length > 0) {
  console.error("✖ Environment files are at risk of being pushed to GitHub:\n");
  for (const problem of problems) console.error(`   ${problem}`);
  console.error(
    "\nFix: untrack them without deleting your local copy —\n" +
      "   git rm --cached <file>\n" +
      "Then confirm `.gitignore` still covers `.env` and `.env.*`.\n" +
      "If they were already pushed, rotate every secret in that file.",
  );
  process.exit(1);
}

console.log("✔ No environment files are tracked, staged, or unignored.");
