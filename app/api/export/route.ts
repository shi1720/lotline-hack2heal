import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readWorkspace } from "@/lib/lotline/storage";
import {
  assess,
  quantities,
  summary,
  hash,
  csvCell,
} from "@/lib/lotline/domain";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return Response.json({ error: "Sign in to export." }, { status: 401 });
    const { workspace: w, revision } = await readWorkspace(
      user.userId,
      user.displayName,
    );
    const params = new URL(request.url).searchParams;
    const r = w.recalls.find((r) => r.id === params.get("recall"));
    if (!r)
      return Response.json({ error: "Recall not found." }, { status: 404 });
    const rows = w.stock.map((s) => ({
      ...s,
      ...assess(s, r),
      ...quantities(w, r.id, s.id),
    }));
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (params.get("format") === "csv") {
      const keys = [
        "id",
        "product",
        "manufacturer",
        "catalog",
        "gtin",
        "lot",
        "location",
        "quantity",
        "unit",
        "status",
        "reason",
        "quarantined",
        "disposed",
        "held",
      ];
      const csv = [
        keys.map(csvCell).join(","),
        ...rows.map((s) =>
          keys.map((k) => csvCell(s[k as keyof typeof s])).join(","),
        ),
      ].join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="lotline-reconciliation.csv"',
        },
      });
    }
    const packet = {
      product: "Lotline",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      revision,
      mode: "evaluation",
      notice:
        "Local response record only. Does not terminate an FDA recall, certify safety, or prove physical actions independently. Evidence text is operator-attested.",
      recall: r,
      summary: summary(w, r),
      inventory: rows,
      movements: w.movements.filter((m) => m.recallId === r.id),
      audit: w.audit,
    };
    const digest = await hash(JSON.stringify(packet));
    return Response.json(
      {
        packet,
        sha256: digest,
        verification:
          "Hash covers compact JSON.stringify(packet) encoded as UTF-8. Audit chain covers each event without its hash field. Preserve the exported digest separately; this is not a digital signature.",
      },
      {
        headers: {
          ...headers,
          "Content-Disposition": 'attachment; filename="lotline-evidence.json"',
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Export unavailable. Please retry when storage is available." },
      { status: 503 },
    );
  }
}
