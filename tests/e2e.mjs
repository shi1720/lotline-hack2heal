import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.LOTLINE_TEST_URL ?? "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error(
    "E2E resets practice data and is restricted to loopback servers.",
  );
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const checks = [];
const check = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
await p.addInitScript(() => {
  const registry = new Map();
  Object.defineProperty(document, "modelContext", {
    value: {
      registerTool(tool, options) {
        registry.set(tool.name, tool);
        options.signal.addEventListener("abort", () =>
          registry.delete(tool.name),
        );
      },
    },
  });
  window.__lotlineTools = registry;
});
await p.goto(base + "/signin-with-chatgpt?return_to=/", {
  waitUntil: "networkidle",
});
const read = async () =>
  await (await ctx.request.get(base + "/api/workspace")).json();
const post = async (
  action,
  revision,
  requestId = crypto.randomUUID(),
  origin = base,
) =>
  ctx.request.post(base + "/api/workspace", {
    headers: { Origin: origin },
    data: { action, revision, requestId },
  });
let state = await read();
let reset = await post({ type: "reset", confirmed: true }, state.revision);
assert.equal(reset.status(), 200);
await p.reload({ waitUntil: "networkidle" });
assert.equal(
  await p
    .getByRole("button", { name: "Complete response", exact: true })
    .isDisabled(),
  true,
);
check("closure blocked on unresolved and undisposed stock");
await p.getByRole("button", { name: "View source notice" }).click();
await p.getByText("SIMULATED NOTICE", { exact: true }).waitFor();
await p.getByRole("button", { name: "Close", exact: true }).click();
check("source snapshot view and modal dismissal");
const toolResult = await p.evaluate(() =>
  window.__lotlineTools.get("read_lotline_response").execute({}),
);
assert.equal(toolResult.summary.review, 12);
assert.equal(
  await p.evaluate(async () => {
    try {
      await window.__lotlineTools
        .get("read_lotline_response")
        .execute({ bogus: true });
      return false;
    } catch {
      return true;
    }
  }),
  true,
);
await p.evaluate(() =>
  window.__lotlineTools
    .get("start_lotline_label_verification")
    .execute({ stockId: "STK-003" }),
);
await p.getByRole("heading", { name: "Verify the package label" }).waitFor();
await p.getByRole("button", { name: "Close", exact: true }).click();
check("WebMCP tools register and validate using an emulated browser registry");
await p.getByRole("button", { name: "Verify label", exact: true }).click();
await p.getByLabel("Lot number", { exact: true }).fill("SY2608-A");
await p
  .getByLabel("Verification evidence", { exact: true })
  .fill(
    "Checked all 12 individual labels. Shelf verification record VR-014, witnessed by demo reviewer.",
  );
await p.getByRole("button", { name: "Save verified label" }).click();
await p
  .getByRole("heading", { name: "Verify the package label" })
  .waitFor({ state: "hidden" });
state = await read();
assert.equal(state.workspace.stock[2].lot, "SY2608-A");
check(
  "label verification persists and turns 12 unknown units into affected stock",
);
await p.reload({ waitUntil: "networkidle" });
assert.equal(
  await p.getByRole("button", { name: "Verify label", exact: true }).count(),
  0,
);
check("server persistence survives reload");
await p.screenshot({
  path: "test-results/lotline-verified.png",
  fullPage: true,
});
for (let i = 0; i < 3; i++) {
  const row = p
    .getByRole("row")
    .filter({
      has: p.getByRole("cell", {
        name: i === 0 ? "40 each" : i === 1 ? "24 each" : "12 each",
        exact: true,
      }),
    });
  await row.getByRole("button", { name: "Record action", exact: true }).click();
  await p
    .getByLabel("Evidence / receipt reference", { exact: true })
    .fill(`Moved to quarantine bin Q-0${i + 1}. Witnessed by demo reviewer.`);
  await p.getByRole("button", { name: "Save action", exact: true }).click();
  await p
    .getByRole("heading", { name: "Record a physical action" })
    .waitFor({ state: "hidden" });
  await row.getByRole("button", { name: "Record return", exact: true }).click();
  await p
    .getByLabel("Evidence / receipt reference", { exact: true })
    .fill(
      `Fictional supplier receipt RMA-014-${i + 1}. All listed units received and counted.`,
    );
  await p.getByRole("button", { name: "Save action", exact: true }).click();
  await p
    .getByRole("heading", { name: "Record a physical action" })
    .waitFor({ state: "hidden" });
}
check(
  "quarantine and permitted return recorded through UI for 40, 24 and 12 units",
);
assert.equal(
  await p
    .getByRole("button", { name: "Complete response", exact: true })
    .isEnabled(),
  true,
);
await p.getByRole("button", { name: "Complete response", exact: true }).click();
await p
  .getByLabel("Final review record", { exact: true })
  .fill(
    "All Riverside and Hillview locations checked. Individual labels and receipts reviewed. No forwarded or remaining affected stock in this fictional exercise.",
  );
await p.getByRole("checkbox").check();
await p.getByRole("button", { name: "Complete and lock response" }).click();
await p
  .getByRole("heading", { name: "Complete this local response" })
  .waitFor({ state: "hidden" });
check("76/76 disposition allows attested completion and locks response");
await p.getByRole("tab", { name: "Evidence packet", exact: true }).click();
await p.getByRole("heading", { name: "Response evidence packet" }).waitFor();
const ex = await ctx.request.get(base + "/api/export?recall=DEMO-014");
assert.equal(ex.status(), 200);
const packet = await ex.json();
assert.equal(packet.packet.summary.disposed, 76);
assert.equal(packet.packet.summary.review, 0);
const digest = await crypto.subtle.digest(
  "SHA-256",
  new TextEncoder().encode(JSON.stringify(packet.packet)),
);
assert.equal(Buffer.from(digest).toString("hex"), packet.sha256);
await writeFile(
  "test-results/sample-evidence.json",
  JSON.stringify(packet, null, 2),
);
await p.screenshot({
  path: "test-results/lotline-evidence.png",
  fullPage: true,
});
await p.pdf({
  path: "test-results/sample-response-record.pdf",
  format: "A4",
  printBackground: true,
});
check("JSON export checksum, disposition totals and printable evidence report");
const csv = await ctx.request.get(
  base + "/api/export?recall=DEMO-014&format=csv",
);
assert.equal(csv.status(), 200);
assert.match(await csv.text(), /STK-001/);
check("CSV reconciliation export");
state = await read();
await post({ type: "reset", confirmed: true }, state.revision);
state = await read();
const movement = {
  type: "movement",
  recallId: "DEMO-014",
  stockId: "STK-001",
  kind: "quarantine",
  quantity: 30,
  evidence: "Concurrent quantity test receipt",
};
const rr = await Promise.all([
  post(movement, state.revision),
  post(movement, state.revision),
]);
assert.deepEqual(rr.map((x) => x.status()).sort(), [200, 409]);
state = await read();
assert.equal(state.workspace.movements.length, 1);
assert.equal(state.workspace.movements[0].quantity, 30);
check("concurrent writers: one commit, one 409, no double accounting");
const cross = await post(
  { type: "reset", confirmed: true },
  state.revision,
  crypto.randomUUID(),
  "https://other.example",
);
assert.equal(cross.status(), 403);
const anon = await browser.newContext();
assert.equal((await anon.request.get(base + "/api/workspace")).status(), 401);
await anon.close();
check("unauthenticated and cross-origin requests rejected");
const badJson = await ctx.request.post(base + "/api/workspace", {
  headers: { Origin: base, "Content-Type": "application/json" },
  data: "{invalid",
});
assert.equal(badJson.status(), 400);
const oversized = await ctx.request.post(base + "/api/workspace", {
  headers: { Origin: base, "Content-Type": "application/json" },
  data: "x".repeat(250001),
});
assert.equal(oversized.status(), 413);
check("malformed and oversized requests rejected");
await post({ type: "reset", confirmed: true }, state.revision);
await p.reload({ waitUntil: "networkidle" });
await p.getByRole("button", { name: "Import stock", exact: true }).click();
await p
  .getByLabel("Or paste CSV", { exact: true })
  .fill(
    "id,product,manufacturer,catalog,gtin,lot,location,quantity,unit\nNEW-1,Sample,Northstar Medical (fictional),LL-SYR-10,,SY2608-A,Lakeside,-1,each",
  );
await p.getByRole("button", { name: "Validate CSV", exact: true }).click();
await p.getByRole("alert").filter({ hasText: "quantity must be" }).waitFor();
await p
  .getByLabel("Or paste CSV", { exact: true })
  .fill(
    "id,product,manufacturer,catalog,gtin,lot,location,quantity,unit\nNEW-1,Sample,Northstar Medical (fictional),LL-SYR-10,,SY2608-A,Lakeside,3,each",
  );
await p.getByRole("button", { name: "Validate CSV", exact: true }).click();
await p.getByRole("button", { name: "Import 1 records", exact: true }).click();
await p
  .getByRole("heading", { name: "Import clinic stock" })
  .waitFor({ state: "hidden" });
assert.equal((await read()).workspace.stock.length, 5);
check("CSV validation error recovery and real import persist");
await p.getByRole("button", { name: "Open recall", exact: true }).click();
await p.getByRole("button", { name: "Look up", exact: true }).click();
await p
  .getByText("Z-2614-2026 · Mentor Texas LP", { exact: true })
  .waitFor({ timeout: 15000 });
assert.equal(
  await p.getByLabel("Recall reference", { exact: true }).inputValue(),
  "Z-2614-2026",
);
await p.screenshot({
  path: "test-results/lotline-fda-review.png",
  fullPage: true,
});
await p.getByRole("button", { name: "Close", exact: true }).click();
check("live FDA record lookup populates review form without approving scope");
state = await read();
await post({ type: "reset", confirmed: true }, state.revision);
await p.reload({ waitUntil: "networkidle" });
await p.setViewportSize({ width: 390, height: 844 });
await p.screenshot({ path: "test-results/lotline-mobile.png", fullPage: true });
const overflow = await p.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
assert.equal(overflow, false);
await p.getByRole("button", { name: "Verify label", exact: true }).click();
await p.getByLabel("Lot number", { exact: true }).waitFor();
await p.screenshot({
  path: "test-results/lotline-mobile-verify.png",
  fullPage: true,
});
await p.getByRole("button", { name: "Close", exact: true }).click();
check("390px mobile layout has no page overflow and label dialog works");
assert.deepEqual(errors, []);
check("no browser runtime errors");
await writeFile(
  "test-results/test-results.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      environment: "Local Vinext with D1 and loopback auth simulator",
      coreTests: 48,
      browserChecks: checks,
      errors,
      limitations: [
        "Hosted identity isolation not tested with two real accounts",
        "WebMCP exercised against emulated registry, not native browser support",
        "No clinical validation or measured customer impact",
      ],
    },
    null,
    2,
  ),
);
await browser.close();
