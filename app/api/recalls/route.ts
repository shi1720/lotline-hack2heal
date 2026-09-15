import { getChatGPTUser } from "@/app/chatgpt-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to look up FDA records." },
      { status: 401 },
    );
  const q =
    new URL(request.url).searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (!/^Z-\d{4}-\d{4}$/.test(q))
    return Response.json(
      { error: "Enter an FDA device recall number, such as Z-2614-2026." },
      { status: 400 },
    );
  const url = new URL("https://api.fda.gov/device/recall.json");
  url.searchParams.set("search", `product_res_number:"${q}"`);
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 404)
      return Response.json(
        {
          error:
            "No record found for this recall number. Check the FDA notice or enter the source manually.",
        },
        { status: 404 },
      );
    if (!response.ok)
      return Response.json(
        {
          error:
            "FDA lookup is unavailable or rate limited. Try later, or use a source notice you have already verified.",
        },
        { status: 502 },
      );
    const data = (await response.json()) as {
      meta?: { last_updated?: string };
      results?: Record<string, unknown>[];
    };
    const r = data.results?.[0];
    if (!r)
      return Response.json(
        { error: "FDA returned no usable record." },
        { status: 502 },
      );
    const str = (key: string, max = 15000) =>
      String(r[key] ?? "").slice(0, max);
    const ref = str("product_res_number", 50);
    const fdaId = str("cfres_id", 20);
    return Response.json(
      {
        reference: ref,
        product: str("product_description", 3000),
        firm: str("recalling_firm", 200),
        codeInfo: str("code_info", 7000),
        reason: str("reason_for_recall", 3000),
        action: str("action", 10000),
        posted: str("event_date_posted", 30),
        sourceUrl: /^\d+$/.test(fdaId)
          ? `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=${fdaId}`
          : url.toString(),
        fetchedAt: new Date().toISOString(),
        datasetUpdated: data.meta?.last_updated ?? "Not provided",
        warning:
          "Reference lookup only. Verify the current manufacturer notice, each packaging level, amendments and deadlines. FDA data is not a clinical decision service.",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "FDA lookup timed out or failed. Your current workspace is unchanged. You can enter a verified source manually.",
      },
      { status: 502 },
    );
  }
}
