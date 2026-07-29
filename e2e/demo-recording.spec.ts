import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  DEMO_ANON_KEY,
  DEMO_POLICIES,
  DEMO_PROJECT_URL,
  DEMO_TABLES,
  DEMO_USERS,
} from "./demo-fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../docs/screenshots");

test("record product demo for README", async ({ page }) => {
  test.setTimeout(120_000);

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const rpc = route.request().url().split("/rpc/")[1]?.split("?")[0] ?? "";

    if (rpc === "get_all_tables") {
      await route.fulfill({ status: 200, contentType: "application/json", json: DEMO_TABLES });
      return;
    }
    if (rpc === "get_auth_users") {
      await route.fulfill({ status: 200, contentType: "application/json", json: DEMO_USERS });
      return;
    }
    if (rpc === "get_table_policies") {
      await route.fulfill({ status: 200, contentType: "application/json", json: DEMO_POLICIES });
      return;
    }
    if (rpc === "get_table_row_count") {
      await route.fulfill({ status: 200, contentType: "application/json", json: 0 });
      return;
    }

    await route.continue();
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  await page.getByPlaceholder("https://xxxx.supabase.co").fill(DEMO_PROJECT_URL);
  await page.getByPlaceholder("eyJhbGc...").fill(DEMO_ANON_KEY);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /connect/i }).click();

  await expect(page.getByLabel("Select table")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(800);

  await page.getByLabel("Select table").selectOption("posts");
  await page.waitForTimeout(600);

  await page.getByLabel("Select user").selectOption(DEMO_USERS[0].id);
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /^analyze$/i }).click();
  await expect(page.getByText("Anyone can update")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/missing WITH CHECK/i)).toBeVisible();
  await page.waitForTimeout(2500);

  await page.screenshot({ path: path.join(OUT_DIR, "analysis.png"), fullPage: false });
});
