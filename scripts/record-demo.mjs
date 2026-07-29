/**
 * Records a demo GIF for the README using mocked Supabase RPCs.
 * No live Supabase project or Playwright ffmpeg binary required.
 *
 * Usage: npm run record:demo
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = pkg;
import pngjs from "pngjs";

const { PNG } = pngjs;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_GIF = path.join(ROOT, "docs", "screenshots", "demo.gif");
const OUT_PNG = path.join(ROOT, "docs", "screenshots", "analysis.png");
const BASE_URL = "http://127.0.0.1:4173";
const PREVIEW_PORT = 4173;

const DEMO_TABLES = [{ name: "posts", rls_enabled: true, policy_count: 3 }];
const DEMO_USERS = [{ id: "00000000-0000-0000-0000-000000000001", email: "alice@example.com" }];
const DEMO_POLICIES = [
  {
    policyname: "Users can insert their own posts",
    cmd: "INSERT",
    qual: null,
    with_check: "(auth.uid() = user_id)",
  },
  {
    policyname: "Users can view their own posts",
    cmd: "SELECT",
    qual: "(auth.uid() = user_id)",
    with_check: null,
  },
  {
    policyname: "Anyone can update",
    cmd: "UPDATE",
    qual: "true",
    with_check: null,
  },
];

function waitForPort(port, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
        } else {
          setTimeout(tick, 400);
        }
      });
    };
    tick();
  });
}

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))));
  });
}

async function capturePng(page) {
  return page.screenshot({ type: "png", fullPage: false });
}

function pngBufferToRgba(buffer) {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

function writeGif(frames, width, height) {
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: 850, repeat: 0 });
  }
  gif.finish();
  fs.mkdirSync(path.dirname(OUT_GIF), { recursive: true });
  fs.writeFileSync(OUT_GIF, Buffer.from(gif.bytes()));
}

async function main() {
  await runBuild();

  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT)], {
    cwd: ROOT,
    stdio: "pipe",
    shell: true,
  });

  try {
    await waitForPort(PREVIEW_PORT);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.route("**/rest/v1/rpc/**", async (route) => {
      const rpc = route.request().url().split("/rpc/")[1]?.split("?")[0] ?? "";
      const payloads = {
        get_all_tables: DEMO_TABLES,
        get_auth_users: DEMO_USERS,
        get_table_policies: DEMO_POLICIES,
        get_table_row_count: 0,
      };
      if (rpc in payloads) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: payloads[rpc],
        });
        return;
      }
      await route.continue();
    });

    const frames = [];

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    frames.push(await capturePng(page));

    await page.getByPlaceholder("https://xxxx.supabase.co").fill("https://demo-project.supabase.co");
    await page.getByPlaceholder("eyJhbGc...").fill(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-anon-key-for-readme-recording-only",
    );
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /connect/i }).click();

    await page.getByLabel("Select table").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(700);
    frames.push(await capturePng(page));

    await page.getByLabel("Select table").selectOption("posts");
    await page.waitForTimeout(500);
    await page.getByLabel("Select user").selectOption(DEMO_USERS[0].id);
    await page.waitForTimeout(500);
    frames.push(await capturePng(page));

    await page.getByRole("button", { name: /^analyze$/i }).click();
    await page.getByRole("heading", { name: "Anyone can update" }).waitFor({ timeout: 10_000 });
    await page.getByText(/missing WITH CHECK/i).first().waitFor();
    await page.waitForTimeout(900);
    const finalShot = await capturePng(page);
    frames.push(finalShot);
    fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
    fs.writeFileSync(OUT_PNG, finalShot);

    await browser.close();

    const rgbaFrames = frames.map(pngBufferToRgba);
    writeGif(rgbaFrames, rgbaFrames[0].width, rgbaFrames[0].height);
    console.log(`Wrote ${OUT_GIF} (${frames.length} frames)`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
