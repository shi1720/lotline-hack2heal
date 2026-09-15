import { z } from "zod";
import {
  DomainError,
  assess,
  audit,
  hash,
  normalizeGtin,
  parseCsv,
  quantities,
  seed,
  summary,
  type Workspace,
} from "./domain";
const short = z.string().trim().min(1).max(200);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,60}$/);
const proof = z.string().trim().min(8).max(1500);
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("import"), csv: z.string().max(200000) }),
  z.object({
    type: z.literal("verify"),
    stockId: id,
    lot: z.string().trim().min(1).max(200),
    catalog: short,
    manufacturer: short,
    gtin: z.string().trim().max(14),
    evidence: proof,
  }),
  z.object({
    type: z.literal("movement"),
    recallId: id,
    stockId: id,
    kind: z.enum(["quarantine", "returned", "destroyed"]),
    quantity: z.number().int().min(1).max(1000000),
    evidence: proof,
  }),
  z.object({
    type: z.literal("close"),
    recallId: id,
    note: proof,
    attested: z.literal(true),
  }),
  z.object({
    type: z.literal("recall"),
    title: short,
    reference: short,
    manufacturer: short,
    catalogs: z
      .array(short)
      .max(
        1,
        "Use one product catalog per response. Split multi-product notices into separate responses.",
      ),
    gtins: z
      .array(short)
      .max(
        1,
        "Use one individual-unit GTIN per response. Review other packaging levels separately.",
      ),
    lots: z.array(short).max(100),
    allLots: z.boolean(),
    sourceUrl: z
      .string()
      .url()
      .max(1000)
      .refine((s) => s.startsWith("https://"), "Use an HTTPS source URL."),
    sourceText: z.string().trim().min(30).max(15000),
    instructions: z.string().trim().min(20).max(3000),
    allowedDisposition: z.enum(["returned", "destroyed"]),
    simpleScope: z.literal(true),
    attested: z.literal(true),
  }),
  z.object({ type: z.literal("reset"), confirmed: z.literal(true) }),
]);
export type Action = z.infer<typeof actionSchema>;
export async function applyAction(
  original: Workspace,
  action: Action,
  actor: string,
  requestId: string,
  now = new Date().toISOString(),
): Promise<Workspace> {
  const requestHash = await hash(JSON.stringify(action));
  if (
    original.processed.includes(requestId) ||
    original.audit.some((e) => e.id === requestId) ||
    original.movements.some((m) => m.id === requestId)
  ) {
    if (
      original.requestHashes?.[requestId] &&
      original.requestHashes[requestId] !== requestHash
    )
      throw new DomainError(
        "This request identifier was already used for a different action.",
        409,
      );
    return original;
  }
  let w = structuredClone(original);
  // Preserve pre-snapshot completed records before the live inventory can change.
  for (const recall of w.recalls) {
    if (recall.closedAt && !recall.closedStock) recall.closedStock = structuredClone(w.stock);
  }
  let detail = "";
  if (action.type === "reset") {
    w = seed(actor, now);
    detail = "Evaluation data reset to the fictional training scenario.";
  } else if (action.type === "import") {
    const rows = parseCsv(action.csv);
    if (w.stock.length + rows.length > 500)
      throw new DomainError("Workspace supports at most 500 stock records.");
    const oldIds = new Set(w.stock.map((s) => s.id));
    if (rows.some((r) => oldIds.has(r.id)))
      throw new DomainError(
        "An imported stock id already exists. Nothing was imported.",
      );
    w.stock.push(...rows);
    detail = `Imported ${rows.length} records (${rows.reduce((s, r) => s + r.quantity, 0)} individual units).`;
  } else if (action.type === "verify") {
    const s = w.stock.find((s) => s.id === action.stockId);
    if (!s) throw new DomainError("Stock record not found.", 404);
    if (
      w.movements.some((m) => m.stockId === s.id)
    )
      throw new DomainError(
        "Labels cannot change after physical actions. Preserve the evidence and review a correction with the responsible operator.",
      );
    const before = {
      catalog: s.catalog,
      manufacturer: s.manufacturer,
      gtin: s.gtin,
      lot: s.lot,
    };
    Object.assign(s, {
      lot: action.lot,
      catalog: action.catalog,
      manufacturer: action.manufacturer,
      gtin: action.gtin ? normalizeGtin(action.gtin) : "",
      verification: action.evidence,
    });
    detail = `Verified ${s.id}: ${JSON.stringify(before)} => ${JSON.stringify({ catalog: s.catalog, manufacturer: s.manufacturer, gtin: s.gtin, lot: s.lot })}. Evidence: ${action.evidence}`;
  } else if (action.type === "recall") {
    if (w.recalls.length >= 20)
      throw new DomainError("Workspace recall limit reached.");
    if (!action.catalogs.length && !action.gtins.length)
      throw new DomainError("At least one catalog or GTIN is required.");
    if (!action.allLots && !action.lots.length)
      throw new DomainError(
        "Specify affected lots or explicitly choose all lots.",
      );
    if (action.allLots && action.lots.length)
      throw new DomainError("Choose all lots or a list of lots, not both.");
    if (w.recalls.some((r) => r.reference === action.reference))
      throw new DomainError("A recall with this reference already exists.");
    if (
      action.lots.some(
        (l) =>
          !/^[-A-Za-z0-9._/]+$/.test(l) ||
          /^\d+-\d+$/.test(l) ||
          /^(?:all|any|unknown|n\/a)$/i.test(l),
      )
    )
      throw new DomainError(
        "Unsupported lot scope. Enter exact lot identifiers, with no ranges, wildcard or descriptive text. Open separate responses for different products.",
      );
    const r = {
      ...action,
      id: crypto.randomUUID(),
      gtins: action.gtins.map(normalizeGtin),
      approvedBy: actor,
      approvedAt: now,
      simulated: false,
    };
    w.recalls.push(r);
    detail = `Opened ${r.reference}. Reviewer approved catalog/GTIN, package level, exact lot scope and removal instructions. Source: ${r.sourceUrl}`;
  } else {
    const r = w.recalls.find((r) => r.id === action.recallId);
    if (!r) throw new DomainError("Recall not found.", 404);
    if (r.closedAt)
      throw new DomainError(
        "This response is already completed. Its record is locked.",
      );
    if (action.type === "close") {
      const totals = summary(w, r);
      if (!totals.canClose)
        throw new DomainError(
          `Cannot complete: ${totals.review} units need verification and ${totals.affected - totals.disposed} affected units need disposition.`,
        );
      r.closedStock = structuredClone(w.stock);
      r.closedAt = now;
      r.closureNote = action.note;
      detail = `Completed local response ${r.reference}. ${totals.affected} affected units accounted for. Reviewer attested stock coverage and location checks. ${action.note}`;
    } else {
      if (action.kind !== "quarantine" && action.kind !== r.allowedDisposition)
        throw new DomainError(
          "This disposition is not permitted by the reviewed source scope. Follow its approved instructions.",
        );
      const s = w.stock.find((s) => s.id === action.stockId);
      if (!s) throw new DomainError("Stock record not found.", 404);
      if (assess(s, r).status !== "affected")
        throw new DomainError(
          "Only an exact affected match can receive a physical action. Verify uncertain identifiers first.",
        );
      const q = quantities(w, r.id, s.id);
      if (
        action.kind === "quarantine" &&
        action.quantity > s.quantity - q.quarantined
      )
        throw new DomainError("Quarantine quantity exceeds unrecorded stock.");
      if (action.kind !== "quarantine" && action.quantity > q.held)
        throw new DomainError(
          "Disposition quantity exceeds stock currently in quarantine. Record quarantine first.",
        );
      if (w.movements.some((m) => m.stockId === s.id && m.recallId !== r.id))
        throw new DomainError(
          "This stock already has physical actions under another recall. Review overlapping scope before continuing.",
        );
      w.movements.push({
        id: requestId,
        recallId: r.id,
        stockId: s.id,
        kind: action.kind,
        quantity: action.quantity,
        evidence: action.evidence,
        actor,
        at: now,
      });
      detail = `${r.reference} / ${s.id}: ${action.kind}, ${action.quantity} each. Evidence: ${action.evidence}`;
    }
  }
  await audit(w, actor, action.type, detail, now, requestId);
  w.processed.push(requestId);
  w.requestHashes ??= {};
  w.requestHashes[requestId] = requestHash;
  return w;
}
