#!/usr/bin/env node
/**
 * Auth smoke test — guards the login, Google and account-recovery routes against
 * the regressions that have actually shipped here:
 *
 *   1. `/auth/callback` rendered the login form instead of the callback page,
 *      because it was nested under `/auth`, whose page has no <Outlet />. Google
 *      sign-in, email confirmation and password reset all silently did nothing.
 *   2. The Content-Security-Policy allowed only `*.supabase.co`, so a deployment
 *      configured against another origin had every auth request blocked. The
 *      browser reported it as "TypeError: NetworkError".
 *   3. Raw supabase-js messages ("both auth code and code verifier should be
 *      non-empty") were rendered straight into the page.
 *
 * No credentials are used and nothing is created, so this is safe to run
 * repeatedly against production.
 *
 * Usage:
 *   npm run test:auth                              # starts `npm run dev` itself
 *   BASE_URL=https://honestinvoice.com npm run test:auth
 *
 * Requires network access to the Supabase project configured in `.env`.
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const PORT = process.env.PORT ?? "5173";
const EXTERNAL_BASE = process.env.BASE_URL;
const BASE_URL = EXTERNAL_BASE ?? `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** supabase-js / GoTrue internals we must never show a user. */
const RAW_LIBRARY_TEXT =
  /code verifier|both auth code|non-empty|invalid request|invalid_grant|pgrst[0-9]|40[0-9]:/i;

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

async function launchBrowser() {
  const attempts = [
    ["bundled chromium", {}],
    ["system Chrome", { channel: "chrome" }],
  ];
  let lastError;
  for (const [label, options] of attempts) {
    try {
      const browser = await chromium.launch({ ...options, args: ["--no-sandbox"] });
      console.log(`browser: ${label}`);
      return browser;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not launch a browser. Run \`npx playwright install chromium\`.\n${lastError?.message}`,
  );
}

async function reachable(url) {
  try {
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

async function startDevServer() {
  if (EXTERNAL_BASE) return null;
  if (await reachable(`${BASE_URL}/auth`)) {
    console.log(`server: reusing the one already on ${BASE_URL}`);
    return null;
  }

  console.log(`server: starting \`npm run dev\` on ${BASE_URL}…`);
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    stdio: "ignore",
    detached: process.platform !== "win32",
  });

  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (await reachable(`${BASE_URL}/auth`)) return child;
  }

  stopDevServer(child);
  throw new Error(`\`npm run dev\` never became reachable on ${BASE_URL}`);
}

function stopDevServer(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") child.kill();
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

const results = [];
let browser;

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message.split("\n")[0].slice(0, 160) });
  }
}

/** Opens a page and records anything CSP blocked. */
async function visit(path, { settle = 2500 } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const blocked = [];
  const responses = [];

  page.on("console", (m) => {
    if (/Content Security Policy|Refused to connect/i.test(m.text())) blocked.push(m.text());
  });
  page.on("requestfailed", (r) => {
    blocked.push(`${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => responses.push({ url: r.url(), status: r.status() }));

  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(settle);

  const text = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  )
    .replace(/\s+/g, " ")
    .trim();

  return { context, page, text, blocked, responses };
}

// ---------------------------------------------------------------------------
// checks
// ---------------------------------------------------------------------------

async function main() {
  browser = await launchBrowser();

  await check("login page renders the email + Google form", async () => {
    const { context, text } = await visit("/auth");
    try {
      assert.match(text, /Welcome back/, "missing the login heading");
      assert.match(text, /Continue with Google/, "missing the Google button");
    } finally {
      await context.close();
    }
  });

  await check("no request is blocked by the CSP on /auth", async () => {
    const { context, blocked } = await visit("/auth");
    try {
      assert.equal(blocked.length, 0, `blocked requests: ${blocked.slice(0, 2).join(" | ")}`);
    } finally {
      await context.close();
    }
  });

  // The original production outage: connect-src allowed only *.supabase.co while
  // the deployment pointed somewhere else.
  await check("CSP allows a request to the configured Supabase origin", async () => {
    const { context, page, blocked } = await visit("/auth");
    try {
      const config = await page.evaluate(() => window.__PUBLIC_ENV__?.VITE_SUPABASE_URL);
      assert.ok(config, "window.__PUBLIC_ENV__.VITE_SUPABASE_URL is not set");
      const outcome = await page.evaluate(async (base) => {
        try {
          const res = await fetch(`${base}/auth/v1/health`);
          return `HTTP ${res.status}`;
        } catch (e) {
          return `BLOCKED: ${e.message}`;
        }
      }, config);
      assert.doesNotMatch(outcome, /BLOCKED/, `fetch to ${config} failed (${outcome})`);
      assert.equal(blocked.length, 0, `CSP violations: ${blocked.slice(0, 2).join(" | ")}`);

      // Assert the header too, so a failure names the directive at fault.
      const document = await page.request.get(`${BASE_URL}/auth`);
      const origin = new URL(config).origin;
      const connectSrc =
        (document.headers()["content-security-policy"] ?? "")
          .split(";")
          .find((directive) => directive.trim().startsWith("connect-src")) ?? "";
      assert.ok(
        connectSrc.includes(origin),
        `connect-src does not allow ${origin}: ${connectSrc.trim().slice(0, 110)}`,
      );
      return `${origin} allowed (${outcome})`;
    } finally {
      await context.close();
    }
  });

  // The routing bug: /auth/callback must render the callback page, not the form.
  await check("/auth/callback renders the callback page, not the login form", async () => {
    const { context, text } = await visit("/auth/callback", { settle: 6000 });
    try {
      assert.doesNotMatch(
        text,
        /Welcome back/,
        "rendered the login form — the callback route is nesting under /auth again",
      );
      assert.match(text, /Completing sign in|Sign in failed/, "no callback state rendered");
    } finally {
      await context.close();
    }
  });

  await check("/auth/reset-password renders the reset screen", async () => {
    const { context, text } = await visit("/auth/reset-password");
    try {
      assert.match(text, /Set a new password/, "missing the reset heading");
      assert.doesNotMatch(text, /Welcome back/, "rendered the login form instead");
    } finally {
      await context.close();
    }
  });

  await check("Google button starts the OAuth handshake with the project", async () => {
    const { context, page, responses, blocked } = await visit("/auth");
    try {
      const config = await page.evaluate(() => window.__PUBLIC_ENV__?.VITE_SUPABASE_URL);
      const button = page.getByRole("button", { name: /google/i }).first();
      await button.click({ timeout: 15000 });

      // The handshake is a top-level navigation: Supabase 302s to Google.
      let authorize;
      for (let i = 0; i < 20 && !authorize; i++) {
        await page.waitForTimeout(1000);
        authorize = responses.find((r) => r.url.includes("/auth/v1/authorize"));
      }

      assert.ok(
        authorize,
        `clicking "Continue with Google" never called ${config}/auth/v1/authorize (blocked: ${blocked.length})`,
      );
      assert.equal(
        authorize.status,
        302,
        `Supabase returned ${authorize.status} for /auth/v1/authorize — is the Google provider still enabled?`,
      );
      assert.match(
        page.url(),
        /accounts\.google\.com/,
        `did not reach Google, landed on ${page.url().slice(0, 80)}`,
      );
      return "302 → accounts.google.com";
    } finally {
      await context.close();
    }
  });

  await check("a cancelled Google sign-in is explained in plain language", async () => {
    const { context, text } = await visit(
      "/auth/callback?error=access_denied&error_description=The+user+denied+the+request",
      { settle: 6000 },
    );
    try {
      assert.match(text, /Google sign-in was cancelled/i, `showed: ${text.slice(0, 120)}`);
      assert.doesNotMatch(text, RAW_LIBRARY_TEXT, "leaked a raw library message");
    } finally {
      await context.close();
    }
  });

  // Guards the "raw error" fix: a bad/reused code must not print supabase-js's
  // "both auth code and code verifier should be non-empty".
  await check("a bad callback code never shows a raw library error", async () => {
    const { context, text } = await visit("/auth/callback?code=not-a-real-code", { settle: 6000 });
    try {
      assert.match(text, /Sign in failed|Completing sign in/, `showed: ${text.slice(0, 120)}`);
      assert.doesNotMatch(
        text,
        RAW_LIBRARY_TEXT,
        `raw library text reached the user: ${text.slice(0, 140)}`,
      );
      // Absence of raw text is not enough — a sentence we wrote must replace it.
      assert.match(
        text,
        /no longer valid|expired|Something went wrong|too many|reach the sign-in service/i,
        `no friendly replacement message: ${text.slice(0, 140)}`,
      );
    } finally {
      await context.close();
    }
  });
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

let server = null;
try {
  server = await startDevServer();
  await main();
} catch (error) {
  console.error(`\nfatal: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  stopDevServer(server);
}

for (const { name, ok, detail } of results) {
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? `\n    ${detail}` : ""}`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed against ${BASE_URL}`);
if (failed > 0) process.exitCode = 1;
