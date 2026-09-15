/** Pure recall assessment and state transitions. No network, database or UI dependencies. */
export type Assessment = "affected" | "review" | "outside";
export type Stock = {
  id: string;
  product: string;
  manufacturer: string;
  catalog: string;
  gtin: string;
  lot: string;
  location: string;
  quantity: number;
  unit: string;
  verification?: string;
};
export type Recall = {
  id: string;
  title: string;
  reference: string;
  manufacturer: string;
  catalogs: string[];
  gtins: string[];
  lots: string[];
  allLots: boolean;
  sourceUrl: string;
  sourceText: string;
  instructions: string;
  allowedDisposition: "returned" | "destroyed";
  approvedBy: string;
  approvedAt: string;
  simulated: boolean;
  closedAt?: string;
  closureNote?: string;
};
export type Movement = {
  id: string;
  recallId: string;
  stockId: string;
  kind: "quarantine" | "returned" | "destroyed";
  quantity: number;
  evidence: string;
  actor: string;
  at: string;
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  previousHash: string;
  hash: string;
};
export type Workspace = {
  schemaVersion: 1;
  stock: Stock[];
  recalls: Recall[];
  movements: Movement[];
  audit: Audit[];
  processed: string[];
  requestHashes?: Record<string, string>;
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const exact = (s: string) => s.trim();
const missing = (s: string) =>
  !s.trim() ||
  /^(?:unknown|n\/a|na|none|null|not recorded|-|—|\?)$/i.test(s.trim());
const manufacturer = (s: string) => s.trim().toLocaleLowerCase("en-US");
export function normalizeGtin(value: string): string {
  const raw = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(raw))
    throw new DomainError(
      "GTIN must contain 8, 12, 13 or 14 digits. Keep leading zeroes.",
    );
  const padded = raw.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(padded[i]) * (i % 2 === 0 ? 3 : 1);
  if ((10 - (sum % 10)) % 10 !== Number(padded[13]))
    throw new DomainError(
      "GTIN check digit is invalid. Verify the package label.",
    );
  return padded;
}
export function assess(
  stock: Stock,
  recall: Recall,
): { status: Assessment; reason: string } {
  const catalogKnown = !missing(stock.catalog) && recall.catalogs.length > 0;
  const gtinKnown = !missing(stock.gtin) && recall.gtins.length > 0;
  const catMatch =
    catalogKnown && recall.catalogs.includes(exact(stock.catalog));
  const gtinMatch = gtinKnown && recall.gtins.includes(stock.gtin);
  if (
    (catMatch && gtinKnown && !gtinMatch) ||
    (gtinMatch && catalogKnown && !catMatch)
  )
    return {
      status: "review",
      reason:
        "Product identifiers conflict. Verify the packaging level and source scope.",
    };
  if (!catMatch && !gtinMatch) {
    if (
      catalogKnown &&
      recall.catalogs.some(
        (code) => code.toLowerCase() === stock.catalog.trim().toLowerCase(),
      )
    ) {
      return {
        status: "review",
        reason:
          "Catalog differs only in letter case. Verify the exact label before assessment.",
      };
    }
    if (catalogKnown || gtinKnown)
      return {
        status: "outside",
        reason:
          "Recorded product identifier is outside this approved scope. This is not a safety clearance.",
      };
    return {
      status: "review",
      reason: "No comparable product identifier. Verify catalog or GTIN.",
    };
  }
  if (missing(stock.manufacturer))
    return {
      status: "review",
      reason: "Manufacturer is missing. Verify the label.",
    };
  if (manufacturer(stock.manufacturer) !== manufacturer(recall.manufacturer))
    return {
      status: "review",
      reason:
        "Product identifier matches but manufacturer differs. Verify the source.",
    };
  if (recall.allLots)
    return {
      status: "affected",
      reason: "Exact product match. The reviewed scope includes all lots.",
    };
  if (missing(stock.lot))
    return {
      status: "review",
      reason:
        "Product matches, but the lot is missing. A blank lot cannot clear stock.",
    };
  if (recall.lots.includes(exact(stock.lot)))
    return {
      status: "affected",
      reason: "Product and lot exactly match the reviewed scope.",
    };
  if (
    recall.lots.some(
      (lot) => lot.toLowerCase() === stock.lot.trim().toLowerCase(),
    )
  ) {
    return {
      status: "review",
      reason:
        "Lot differs only in letter case. Verify its exact spelling against the source.",
    };
  }
  return {
    status: "outside",
    reason:
      "Recorded lot is outside this approved scope. Check each packaging level against the notice.",
  };
}
export function quantities(w: Workspace, recallId: string, stockId: string) {
  const movements = w.movements.filter(
    (m) => m.recallId === recallId && m.stockId === stockId,
  );
  const quarantined = movements
    .filter((m) => m.kind === "quarantine")
    .reduce((n, m) => n + m.quantity, 0);
  const disposed = movements
    .filter((m) => m.kind !== "quarantine")
    .reduce((n, m) => n + m.quantity, 0);
  return { quarantined, disposed, held: quarantined - disposed };
}
export function summary(w: Workspace, r: Recall) {
  let affected = 0,
    review = 0,
    outside = 0,
    quarantined = 0,
    disposed = 0;
  const locations = new Set<string>();
  for (const s of w.stock) {
    const a = assess(s, r);
    if (a.status === "affected") {
      affected += s.quantity;
      locations.add(s.location);
      const q = quantities(w, r.id, s.id);
      quarantined += q.quarantined;
      disposed += q.disposed;
    } else if (a.status === "review") {
      review += s.quantity;
      locations.add(s.location);
    } else outside += s.quantity;
  }
  return {
    affected,
    review,
    outside,
    quarantined,
    disposed,
    locations: locations.size,
    canClose: w.stock.length > 0 && review === 0 && disposed === affected,
  };
}
export function parseGs1(raw: string): {
  gtin: string;
  lot: string;
  expiry?: string;
} {
  let value = raw.trim().replace(/^\]d2/, "");
  let gtin = "",
    lot = "",
    expiry = "";
  if (value.includes("(")) {
    const matches = [...value.matchAll(/\((01|10|17|21)\)([^()]*)/g)];
    if (matches.map((m) => m[0]).join("") !== value)
      throw new DomainError(
        "Unsupported or malformed GS1 data. Use (01), (10), (17) and (21).",
      );
    const seen = new Set<string>();
    for (const m of matches) {
      if (seen.has(m[1])) throw new DomainError("Duplicate GS1 identifier.");
      seen.add(m[1]);
      if (m[1] === "01") gtin = m[2];
      if (m[1] === "10") lot = m[2];
      if (m[1] === "17") expiry = m[2];
    }
  } else {
    const seen = new Set<string>();
    while (value) {
      if (value.startsWith("\x1d")) {
        value = value.slice(1);
        continue;
      }
      const ai = value.slice(0, 2);
      value = value.slice(2);
      if (seen.has(ai)) throw new DomainError("Duplicate GS1 identifier.");
      seen.add(ai);
      if (ai === "01") {
        gtin = value.slice(0, 14);
        value = value.slice(14);
      } else if (ai === "17") {
        expiry = value.slice(0, 6);
        value = value.slice(6);
      } else if (ai === "10" || ai === "21") {
        const end = value.indexOf("\x1d");
        const part = end < 0 ? value : value.slice(0, end);
        value = end < 0 ? "" : value.slice(end + 1);
        if (ai === "10") lot = part;
      } else
        throw new DomainError(
          "Unsupported GS1 identifier. Variable-length fields need an ASCII group separator.",
        );
    }
  }
  if (!gtin || !lot || lot.length > 20)
    throw new DomainError(
      "A valid GS1 code needs (01) GTIN and (10) lot, with a lot of at most 20 characters.",
    );
  if (expiry && !/^\d{6}$/.test(expiry))
    throw new DomainError("GS1 expiry must be six digits (YYMMDD).");
  return {
    gtin: normalizeGtin(gtin),
    lot: exact(lot),
    ...(expiry ? { expiry } : {}),
  };
}
export function parseCsv(text: string): Stock[] {
  if (text.length > 200_000)
    throw new DomainError("CSV exceeds 200 KB. Split it into smaller imports.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closedQuote = false;
  const pushField = () => {
    row.push(field);
    field = "";
    closedQuote = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else field += c;
    } else if (c === '"') {
      if (field || closedQuote) throw new DomainError("Malformed CSV quote.");
      quoted = true;
    } else if (c === ",") pushField();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushField();
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else {
      if (closedQuote)
        throw new DomainError("Unexpected character after CSV quote.");
      field += c;
    }
  }
  if (quoted) throw new DomainError("CSV has an unclosed quote.");
  if (field || row.length) {
    pushField();
    if (row.some((v) => v.trim())) rows.push(row);
  }
  const header =
    rows.shift()?.map((v) =>
      v
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    ) ?? [];
  const required = [
    "id",
    "product",
    "manufacturer",
    "catalog",
    "gtin",
    "lot",
    "location",
    "quantity",
    "unit",
  ];
  if (
    header.length !== required.length ||
    required.some((v) => !header.includes(v)) ||
    new Set(header).size !== header.length
  )
    throw new DomainError("CSV headers must be: " + required.join(", "));
  if (!rows.length || rows.length > 500)
    throw new DomainError("Import between 1 and 500 inventory records.");
  const seen = new Set<string>();
  return rows.map((values, index) => {
    if (values.length !== header.length)
      throw new DomainError(
        `Row ${index + 2}: column count does not match the header.`,
      );
    const r = Object.fromEntries(header.map((k, i) => [k, values[i].trim()]));
    for (const key of required)
      if (r[key].length > 200)
        throw new DomainError(`Row ${index + 2}: ${key} is too long.`);
    if (!/^[A-Za-z0-9_-]{1,60}$/.test(r.id) || seen.has(r.id))
      throw new DomainError(
        `Row ${index + 2}: use a unique id with letters, numbers, hyphens or underscores.`,
      );
    seen.add(r.id);
    if (!r.product || !r.location || r.unit !== "each")
      throw new DomainError(
        `Row ${index + 2}: product and location are required; unit must be each. Convert box counts before importing.`,
      );
    if (
      !/^\d+$/.test(r.quantity) ||
      Number(r.quantity) < 1 ||
      Number(r.quantity) > 1_000_000
    )
      throw new DomainError(
        `Row ${index + 2}: quantity must be a positive whole number, at most 1,000,000.`,
      );
    if (missing(r.gtin)) r.gtin = "";
    else r.gtin = normalizeGtin(r.gtin);
    return { ...r, quantity: Number(r.quantity) } as Stock;
  });
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function audit(
  w: Workspace,
  actor: string,
  action: string,
  detail: string,
  now: string,
  id: string,
) {
  if (w.audit.length >= 2000)
    throw new DomainError(
      "Workspace event limit reached. Export the record before starting a new evaluation.",
    );
  const previousHash = w.audit.at(-1)?.hash ?? "GENESIS";
  const event = { id, at: now, actor, action, detail, previousHash };
  w.audit.push({ ...event, hash: await hash(JSON.stringify(event)) });
}
export function seed(actor: string, now: string): Workspace {
  return {
    schemaVersion: 1,
    stock: [
      {
        id: "STK-001",
        product: "Sterile syringe, 10 mL",
        manufacturer: "Northstar Medical (fictional)",
        catalog: "LL-SYR-10",
        gtin: "",
        lot: "SY2608-A",
        location: "Riverside",
        quantity: 40,
        unit: "each",
      },
      {
        id: "STK-002",
        product: "Sterile syringe, 10 mL",
        manufacturer: "Northstar Medical (fictional)",
        catalog: "LL-SYR-10",
        gtin: "",
        lot: "SY2608-A",
        location: "Hillview",
        quantity: 24,
        unit: "each",
      },
      {
        id: "STK-003",
        product: "Sterile syringe, 10 mL",
        manufacturer: "Northstar Medical (fictional)",
        catalog: "LL-SYR-10",
        gtin: "",
        lot: "",
        location: "Hillview",
        quantity: 12,
        unit: "each",
      },
      {
        id: "STK-004",
        product: "Sterile syringe, 10 mL",
        manufacturer: "Northstar Medical (fictional)",
        catalog: "LL-SYR-10",
        gtin: "",
        lot: "SY2608-B",
        location: "Riverside",
        quantity: 30,
        unit: "each",
      },
    ],
    recalls: [
      {
        id: "DEMO-014",
        title: "Sterile syringe seal integrity",
        reference: "DEMO-2026-014",
        manufacturer: "Northstar Medical (fictional)",
        catalogs: ["LL-SYR-10"],
        gtins: [],
        lots: ["SY2608-A"],
        allLots: false,
        sourceUrl: "",
        sourceText:
          "SIMULATED TRAINING NOTICE — not a real medical recall. Northstar Medical, catalog LL-SYR-10, individual units in lot SY2608-A. Potential sterile barrier defect. Inspect individual package labels. Stop distribution and segregate affected stock. Return affected unused units to the fictional supplier with a quantity receipt. Other packaging levels are not specified. No patient data is required.",
        allowedDisposition: "returned",
        instructions:
          "Inspect individual labels. Quarantine affected unused units. Return to the fictional supplier and retain a receipt. Do not dispose of real medical products on the basis of this training notice.",
        approvedBy: actor,
        approvedAt: now,
        simulated: true,
      },
    ],
    movements: [],
    audit: [],
    processed: [],
  };
}
