import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  assess,
  summary,
  parseCsv,
  parseGs1,
  normalizeGtin,
  quantities,
  hash,
  csvCell,
} from "../lib/lotline/domain";
import { actionSchema, applyAction } from "../lib/lotline/actions";
const actor = "Test reviewer",
  now = "2026-09-15T06:00:00Z";
const fresh = () => seed(actor, now);
const act = (
  w: ReturnType<typeof seed>,
  a: unknown,
  id = crypto.randomUUID(),
) => applyAction(w, actionSchema.parse(a), actor, id, now);
const csvHeader =
  "id,product,manufacturer,catalog,gtin,lot,location,quantity,unit\n";
const baseStock = () => fresh().stock[0];
const baseRecall = () => fresh().recalls[0];
test("seed conserves 106 units: 64 affected, 12 uncertain, 30 outside scope", () => {
  assert.deepEqual(summary(fresh(), baseRecall()), {
    affected: 64,
    review: 12,
    outside: 30,
    quarantined: 0,
    disposed: 0,
    locations: 2,
    canClose: false,
  });
});
test("lot comparison preserves punctuation and letter case", () => {
  assert.equal(
    assess({ ...baseStock(), lot: "SY2608A" }, baseRecall()).status,
    "outside",
  );
  assert.equal(
    assess({ ...baseStock(), lot: "sy2608-a" }, baseRecall()).status,
    "review",
  );
});
for (const lot of ["", " ", "N/A", "unknown", "Not recorded", "-", "?"])
  test(`missing lot marker ${JSON.stringify(lot)} never clears matching stock`, () =>
    assert.equal(
      assess({ ...baseStock(), lot }, baseRecall()).status,
      "review",
    ));
test("unrelated known catalog is outside the selected source only", () =>
  assert.equal(
    assess({ ...baseStock(), catalog: "OTHER" }, baseRecall()).status,
    "outside",
  ));
test("no comparable identifier requires review", () =>
  assert.equal(
    assess({ ...baseStock(), catalog: "", gtin: "" }, baseRecall()).status,
    "review",
  ));
test("manufacturer mismatch cannot claim affected or outside scope", () =>
  assert.equal(
    assess({ ...baseStock(), manufacturer: "Other manufacturer" }, baseRecall())
      .status,
    "review",
  ));
test("missing manufacturer remains review", () =>
  assert.equal(
    assess({ ...baseStock(), manufacturer: "N/A" }, baseRecall()).status,
    "review",
  ));
test("GTIN and catalog conflict requires review", () =>
  assert.equal(
    assess(
      { ...baseStock(), gtin: "00382903029952" },
      { ...baseRecall(), gtins: ["30382903029952"] },
    ).status,
    "review",
  ));
test("all-lots flag affects known product with missing lot only when explicit", () =>
  assert.equal(
    assess(
      { ...baseStock(), lot: "" },
      { ...baseRecall(), allLots: true, lots: [] },
    ).status,
    "affected",
  ));
test("GTIN normalizes UPC and preserves individual/package distinction", () => {
  assert.equal(normalizeGtin("382903029952"), "00382903029952");
  assert.notEqual(
    normalizeGtin("00382903029952"),
    normalizeGtin("30382903029953"),
  );
});
test("GTIN rejects wrong checksum and scientific notation", () => {
  assert.throws(() => normalizeGtin("00382903029953"));
  assert.throws(() => normalizeGtin("3.82903E+11"));
});
test("GS1 parses readable identifiers without erasing lot zeroes", () =>
  assert.deepEqual(parseGs1("(01)00382903029952(17)270930(10)008298877"), {
    gtin: "00382903029952",
    lot: "008298877",
    expiry: "270930",
  }));
test("GS1 parses scanner FNC1 separator with variable-length lot", () =>
  assert.deepEqual(parseGs1("]d20100382903029952108298877\x1d17270930"), {
    gtin: "00382903029952",
    lot: "8298877",
    expiry: "270930",
  }));
test("GS1 rejects duplicate identifiers, malformed and unsupported fields", () => {
  assert.throws(() => parseGs1("(01)00382903029952(10)A(10)B"));
  assert.throws(() => parseGs1("(01)00382903029952(99)x(10)A"));
  assert.throws(() => parseGs1("0100382903029952"));
});
test("CSV accepts BOM, CRLF, quoted commas, quoted newlines and empty lots", () => {
  const rows = parseCsv(
    "\uFEFF" +
      csvHeader +
      'X1,"Syringe, sterile","Northstar\nMedical",LL-SYR-10,,,Clinic,2,each\r\n',
  );
  assert.equal(rows[0].product, "Syringe, sterile");
  assert.equal(rows[0].lot, "");
  assert.equal(rows[0].quantity, 2);
});
for (const qty of ["-1", "1.5", "1e3", "0", "1000001"])
  test(`CSV rejects unsafe quantity ${qty}`, () =>
    assert.throws(() =>
      parseCsv(csvHeader + `X1,Syringe,M,C,,L,Clinic,${qty},each`),
    ));
test("CSV rejects duplicate ids, wrong columns, quotes and unit conversion", () => {
  assert.throws(() =>
    parseCsv(
      csvHeader + "X1,S,M,C,,L,Clinic,2,each\nX1,S,M,C,,L,Clinic,2,each",
    ),
  );
  assert.throws(() => parseCsv(csvHeader + "X1,S,M,C,,L,Clinic,2,box"));
  assert.throws(() => parseCsv(csvHeader + 'X1,"S,M,C,,L,Clinic,2,each'));
  assert.throws(() => parseCsv("id,quantity\nX1,4"));
});
test("CSV imports atomically and rejects existing IDs", async () => {
  const w = fresh();
  await assert.rejects(() =>
    act(w, {
      type: "import",
      csv: csvHeader + "STK-001,S,M,C,,L,Clinic,2,each",
    }),
  );
  assert.equal(w.stock.length, 4);
});
test("cannot close open uncertainty or undisposed affected stock", async () => {
  await assert.rejects(
    () =>
      act(fresh(), {
        type: "close",
        recallId: "DEMO-014",
        note: "Reviewed all locations",
        attested: true,
      }),
    /Cannot complete/,
  );
});
test("cannot dispose stock before recording quarantine", async () => {
  await assert.rejects(
    () =>
      act(fresh(), {
        type: "movement",
        recallId: "DEMO-014",
        stockId: "STK-001",
        kind: "returned",
        quantity: 1,
        evidence: "Receipt RMA-123",
      }),
    /quarantine/,
  );
});
test("cannot quarantine uncertain stock", async () => {
  await assert.rejects(
    () =>
      act(fresh(), {
        type: "movement",
        recallId: "DEMO-014",
        stockId: "STK-003",
        kind: "quarantine",
        quantity: 12,
        evidence: "Bin Q-001 reviewed",
      }),
    /exact affected/,
  );
});
test("cannot record more units than physically available", async () => {
  await assert.rejects(
    () =>
      act(fresh(), {
        type: "movement",
        recallId: "DEMO-014",
        stockId: "STK-001",
        kind: "quarantine",
        quantity: 41,
        evidence: "Bin Q-001 reviewed",
      }),
    /exceeds/,
  );
});
test("return-only notice rejects destruction", async () => {
  const w = await act(fresh(), {
    type: "movement",
    recallId: "DEMO-014",
    stockId: "STK-001",
    kind: "quarantine",
    quantity: 40,
    evidence: "Bin Q-001 reviewed",
  });
  await assert.rejects(
    () =>
      act(w, {
        type: "movement",
        recallId: "DEMO-014",
        stockId: "STK-001",
        kind: "destroyed",
        quantity: 40,
        evidence: "Destroyed stock record",
      }),
    /not permitted/,
  );
});
test("label cannot change after recording physical action", async () => {
  const w = await act(fresh(), {
    type: "movement",
    recallId: "DEMO-014",
    stockId: "STK-001",
    kind: "quarantine",
    quantity: 10,
    evidence: "Bin Q-001 reviewed",
  });
  await assert.rejects(
    () =>
      act(w, {
        type: "verify",
        stockId: "STK-001",
        lot: "SY2608-B",
        catalog: "LL-SYR-10",
        manufacturer: "Northstar Medical (fictional)",
        gtin: "",
        evidence: "Label record revised",
      }),
    /cannot change/,
  );
});
test("request replay stays idempotent beyond 200 subsequent actions", async () => {
  let w = fresh();
  w.stock[0].quantity = 1000;
  const id = crypto.randomUUID(),
    action = {
      type: "movement",
      recallId: "DEMO-014",
      stockId: "STK-001",
      kind: "quarantine",
      quantity: 1,
      evidence: "Quarantine batch attestation",
    };
  w = await act(w, action, id);
  for (let i = 0; i < 201; i++) w = await act(w, action);
  const before = w.movements.length;
  w = await act(w, action, id);
  assert.equal(w.movements.length, before);
  assert.equal(new Set(w.movements.map((m) => m.id)).size, before);
});
test("complete flow resolves 12 units and accounts for all 76 before locking", async () => {
  let w = fresh();
  w = await act(w, {
    type: "verify",
    stockId: "STK-003",
    lot: "SY2608-A",
    catalog: "LL-SYR-10",
    manufacturer: "Northstar Medical (fictional)",
    gtin: "",
    evidence: "Checked all 12 individual-unit labels.",
  });
  assert.equal(summary(w, w.recalls[0]).affected, 76);
  for (const s of w.stock.slice(0, 3)) {
    for (const kind of ["quarantine", "returned"])
      w = await act(w, {
        type: "movement",
        recallId: "DEMO-014",
        stockId: s.id,
        kind,
        quantity: s.quantity,
        evidence:
          kind === "quarantine"
            ? "Bin Q-014 witnessed by test reviewer."
            : "Supplier receipt RMA-014, units counted.",
      });
  }
  assert.equal(summary(w, w.recalls[0]).canClose, true);
  w = await act(w, {
    type: "close",
    recallId: "DEMO-014",
    note: "All locations and receipts checked. No remaining stock.",
    attested: true,
  });
  assert.equal(w.recalls[0].closedAt, now);
  assert.equal(quantities(w, "DEMO-014", "STK-001").held, 0);
  await assert.rejects(
    () =>
      act(w, {
        type: "close",
        recallId: "DEMO-014",
        note: "Repeat completion attempt",
        attested: true,
      }),
    /already completed/,
  );
  let previous = "GENESIS";
  for (const e of w.audit) {
    const { hash: digest, ...event } = e;
    assert.equal(e.previousHash, previous);
    assert.equal(await hash(JSON.stringify(event)), digest);
    previous = digest;
  }
});
const sourceAction = {
  type: "recall",
  title: "Source recall",
  reference: "SOURCE-001",
  manufacturer: "M",
  catalogs: ["A"],
  gtins: [],
  lots: ["L1"],
  allLots: false,
  sourceUrl: "https://www.fda.gov/example",
  sourceText: "Original source text with the current product and lot scope.",
  instructions: "Return unused affected stock to the authorized supplier.",
  allowedDisposition: "returned",
  simpleScope: true,
  attested: true,
};
test("multi-product cross-products are rejected rather than flattened", () =>
  assert.equal(
    actionSchema.safeParse({
      ...sourceAction,
      catalogs: ["A", "B"],
      lots: ["LA", "LB"],
    }).success,
    false,
  ));
test("unsupported ranges and wildcards are rejected at source approval", async () => {
  for (const lot of ["100-200", "L1 to L9", "*", "ALL"])
    await assert.rejects(
      () => act(fresh(), { ...sourceAction, lots: [lot] }),
      /Unsupported lot scope/,
    );
});
test("all-lots and list of lots cannot both be approved", async () => {
  await assert.rejects(
    () => act(fresh(), { ...sourceAction, allLots: true }),
    /not both/,
  );
});
test("recall source approval rejects unvalidated GTIN and no product identifiers", async () => {
  await assert.rejects(
    () => act(fresh(), { ...sourceAction, gtins: ["00382903029953"] }),
    /check digit/,
  );
  await assert.rejects(
    () => act(fresh(), { ...sourceAction, catalogs: [] }),
    /At least one/,
  );
});
test("evidence, attestation, exact quantity and HTTPS source are required", () => {
  assert.equal(
    actionSchema.safeParse({ ...sourceAction, attested: false }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      ...sourceAction,
      sourceUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "movement",
      recallId: "D",
      stockId: "X",
      kind: "quarantine",
      quantity: 1.1,
      evidence: "ok",
    }).success,
    false,
  );
});
test("CSV formula injection is neutralized on export", () => {
  assert.equal(
    csvCell('=HYPERLINK("https://evil.test")'),
    '"\'=HYPERLINK(""https://evil.test"")"',
  );
  assert.equal(csvCell(" +cmd"), '"\' +cmd"');
});

test("FDA historical box GTIN with invalid checksum requires label review", () =>
  assert.throws(() => normalizeGtin("30382903029952"), /check digit/));

test("reused request id with a different action is rejected", async () => {
  const id = crypto.randomUUID();
  const action = {
    type: "movement",
    recallId: "DEMO-014",
    stockId: "STK-001",
    kind: "quarantine",
    quantity: 1,
    evidence: "Quarantine receipt reviewed",
  };
  const w = await act(fresh(), action, id);
  await assert.rejects(
    () => act(w, { ...action, quantity: 2 }, id),
    /different action/,
  );
});

test("case-only catalog differences are held for review", () =>
  assert.equal(
    assess({ ...baseStock(), catalog: "ll-syr-10" }, baseRecall()).status,
    "review",
  ));

import { readBody } from "../lib/lotline/request";
test("bounded body reader counts UTF-8 bytes, not characters", async () => {
  const req = new Request("http://localhost/api", {
    method: "POST",
    body: "ééé",
  });
  await assert.rejects(() => readBody(req, 5), /too large/);
});
test("bounded body reader cancels chunked oversized input", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(16));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("http://localhost/api", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(() => readBody(req, 20), /too large/);
  assert.equal(cancelled, true);
});
test("bounded body reader rejects malformed UTF-8", async () => {
  const req = new Request("http://localhost/api", {
    method: "POST",
    body: new Uint8Array([255]),
  });
  await assert.rejects(() => readBody(req), /UTF-8/);
});


test("new imports and unused-label corrections preserve completed stock snapshots", async () => {
  let w = seed("Reviewer", now);
  // A separate unaffected scope can complete without fictitious physical handling.
  w.recalls[0].lots = ["OTHER-LOT"];
  w.stock[2].lot = "KNOWN-OTHER";
  w = await act(w, {type:"close",recallId:"DEMO-014",note:"All known labels outside this reviewed scope.",attested:true});
  const before = summary(w,w.recalls[0]);
  w = await act(w,{type:"import",csv:"id,product,manufacturer,catalog,gtin,lot,location,quantity,unit\nNEXT-1,Next stock,Northstar Medical (fictional),LL-SYR-10,,OTHER-LOT,New site,5,each"});
  assert.equal(w.stock.length,5);
  assert.deepEqual(summary(w,w.recalls[0]),before);
  w = await act(w,{type:"verify",stockId:"STK-004",manufacturer:"Northstar Medical (fictional)",catalog:"LL-SYR-10",gtin:"",lot:"OTHER-LOT",evidence:"New verified label reference after the prior snapshot."});
  assert.deepEqual(summary(w,w.recalls[0]),before);
  assert.equal(w.recalls[0].closedStock?.find(s=>s.id==="STK-004")?.lot,"SY2608-B");
});
