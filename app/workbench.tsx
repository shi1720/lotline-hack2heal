"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ShieldCheck,
  ArrowUpRight,
  Plus,
  PackageSearch,
  ScanLine,
  CircleAlert,
  FileCheck2,
  Upload,
  Download,
  Check,
  RotateCcw,
  Search,
  Loader2,
  LockKeyhole,
  ClipboardList,
  ArrowRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Toaster, toast } from "sonner";
import {
  assess,
  quantities,
  summary,
  responseStock,
  parseCsv,
  parseGs1,
  seed,
  type Workspace,
  type Recall,
  type Stock,
} from "@/lib/lotline/domain";
import { useWebMcp } from "./use-webmcp";
import type { Action } from "@/lib/lotline/actions";

type State = { workspace: Workspace; revision: number; actor: string };
type FdaRecord = {
  reference: string;
  product: string;
  firm: string;
  codeInfo: string;
  reason: string;
  action: string;
  posted: string;
  sourceUrl: string;
  fetchedAt: string;
  datasetUpdated: string;
  warning: string;
};
const statusLabel = {
  affected: "Affected",
  review: "Needs review",
  outside: "Outside scope",
};
const statusColor = { affected: "red", review: "amber", outside: "gray" };
const split = (s: string) =>
  s
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  function labelControls(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node;
      const element = node as ReactElement<{
        children?: ReactNode;
        id?: string;
        "aria-labelledby"?: string;
        "aria-describedby"?: string;
      }>;
      if (
        element.type === "input" ||
        element.type === "textarea" ||
        element.type === SelectTrigger
      ) {
        return cloneElement(element, {
          id,
          "aria-labelledby": labelId,
          "aria-describedby": hint ? hintId : undefined,
        });
      }
      if (element.props.children)
        return cloneElement(element, {
          children: labelControls(element.props.children),
        });
      return node;
    });
  }
  return (
    <div className="field">
      <label id={labelId} htmlFor={id}>
        {label}
      </label>
      {labelControls(children)}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
function CheckField({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="check-field">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{children}</span>
    </label>
  );
}
export default function Workbench({scope="demo",signInPath="/signin-with-chatgpt?return_to=/",accountControl}:{scope?:"demo"|"inventory";signInPath?:string;accountControl?:ReactNode}) {
  const apiWorkspace = `/api/workspace?scope=${scope}`;
  const [data, setData] = useState<State | null>(null),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState("DEMO-014"),
    [tab, setTab] = useState("stock"),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const [modal, setModal] = useState<
      "import" | "recall" | "source" | "verify" | "movement" | "close" | null
    >(null),
    [stock, setStock] = useState<Stock | null>(null),
    [reset, setReset] = useState(false);
  const [csv, setCsv] = useState(""),
    [importPreview, setImportPreview] = useState<Stock[] | null>(null),
    [barcode, setBarcode] = useState("");
  const [lot, setLot] = useState(""),
    [catalog, setCatalog] = useState(""),
    [manufacturer, setManufacturer] = useState(""),
    [gtin, setGtin] = useState(""),
    [evidence, setEvidence] = useState("");
  const [kind, setKind] = useState<"quarantine" | "returned" | "destroyed">(
      "quarantine",
    ),
    [quantity, setQuantity] = useState(""),
    [attested, setAttested] = useState(false);
  const [fdaQuery, setFdaQuery] = useState("Z-2614-2026"),
    [fda, setFda] = useState<FdaRecord | null>(null),
    [looking, setLooking] = useState(false);
  const [title, setTitle] = useState(""),
    [reference, setReference] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [sourceText, setSourceText] = useState(""),
    [instructions, setInstructions] = useState(""),
    [lots, setLots] = useState(""),
    [catalogs, setCatalogs] = useState(""),
    [gtins, setGtins] = useState(""),
    [allLots, setAllLots] = useState(false),
    [allowedDisposition, setAllowedDisposition] = useState<
      "returned" | "destroyed"
    >("returned");
  const load = useCallback(async () => {
    try {
      const response = await fetch(apiWorkspace);
      const d = (await response.json()) as State & { error?: string };
      if (!response.ok) throw new Error(d.error);
      setData(d);
      setLoadError("");
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load workspace.",
      );
    }
  }, [apiWorkspace]);
  useEffect(() => {
    void load();
  }, [load]);
  const change = async (action: Action) => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(apiWorkspace, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: data.revision,
          requestId: crypto.randomUUID(),
          action,
        }),
      });
      const result = (await response.json()) as State & { error?: string };
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(result.error);
      }
      setData(result);
      setModal(null);
      setReset(false);
      toast.success(
        action.type === "close"
          ? "Local response completed. Evidence record locked."
          : "Saved to your workspace.",
      );
      if (action.type === "recall")
        setSelected(result.workspace.recalls.at(-1)!.id);
      if (action.type === "reset") {
        setSelected("DEMO-014");
        setTab("stock");
        setFilter("all");
        setQuery("");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your input is preserved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const open = (m: typeof modal, s?: Stock) => {
    setError("");
    setEvidence("");
    setAttested(false);
    setModal(m);
    if (s) {
      setStock(s);
      setLot(s.lot);
      setCatalog(s.catalog);
      setManufacturer(s.manufacturer);
      setGtin(s.gtin);
      setBarcode("");
      if (data) {
        const q = quantities(data.workspace, selected, s.id);
        setKind(
          q.quarantined < s.quantity
            ? "quarantine"
            : (r?.allowedDisposition ?? "returned"),
        );
        setQuantity(
          String(
            q.quarantined < s.quantity ? s.quantity - q.quarantined : q.held,
          ),
        );
      }
    }
    if (m === "import") {
      setCsv("");
      setImportPreview(null);
    }
    if (m === "recall") {
      setTitle("");
      setReference("");
      setSourceUrl("");
      setSourceText("");
      setInstructions("");
      setManufacturer("");
      setLots("");
      setCatalogs("");
      setGtins("");
      setAllLots(false);
      setAllowedDisposition("returned");
      setFda(null);
    }
  };
  const lookup = async () => {
    setLooking(true);
    setError("");
    try {
      const response = await fetch(
        "/api/recalls?q=" + encodeURIComponent(fdaQuery),
      );
      const result = (await response.json()) as FdaRecord & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setFda(result);
      setReference(result.reference);
      setTitle(result.product.split("\n")[0].slice(0, 180));
      setSourceUrl(result.sourceUrl);
      setSourceText(
        [
          result.product,
          result.codeInfo,
          result.reason,
          result.action,
          `Retrieved ${result.fetchedAt}; dataset updated ${result.datasetUpdated}`,
        ]
          .join("\n\n")
          .slice(0, 15000),
      );
      setInstructions(result.action.slice(0, 3000));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLooking(false);
    }
  };
  const w = data?.workspace,
    activeRecall = w?.recalls.find((r) => r.id === selected) ?? w?.recalls[0],
    r = activeRecall ?? {...seed("","").recalls[0],id:"__empty",title:"",catalogs:[],gtins:[],lots:[],allLots:false},
    totals = w ? summary(w, r) : null;
  useWebMcp(
    () => {
      if (!w || !activeRecall || !totals) throw new Error("Workspace is not ready.");
      return {
        reference: r.reference,
        summary: totals,
        unresolved: responseStock(w, r)
          .filter((s) => assess(s, r).status === "review")
          .map((s) => ({
            id: s.id,
            location: s.location,
            quantity: s.quantity,
            reason: assess(s, r).reason,
          })),
      };
    },
    async (id) => {
      const s = w?.stock.find((s) => s.id === id);
      if (!s || !r) throw new Error("Stock record not found.");
      if (r.closedAt) throw new Error("This response is locked.");
      open("verify", s);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return { opened: true, stockId: s.id, saved: false };
    },
  );
  if (!w || !totals)
    return (
      <div className="loading-screen">
        <div className="brand-symbol">
          <ScanLine />
        </div>
        <h1>Lotline</h1>
        {loadError ? (
          <>
            <p role="alert">{loadError}</p>
            <Button onClick={load}>Retry loading</Button>
            <a href={signInPath} target="_top">
              Sign in
            </a>
          </>
        ) : (
          <>
            <Loader2 className="spin" />
            <p>Opening your recall workspace…</p>
          </>
        )}
      </div>
    );
  const filtered = responseStock(w, r).filter((s) => {
    const a = assess(s, r);
    return (
      (filter === "all" || a.status === filter) &&
      (!query ||
        `${s.product} ${s.catalog} ${s.lot} ${s.location}`
          .toLowerCase()
          .includes(query.toLowerCase()))
    );
  });
  const progress = totals.affected
    ? Math.round((totals.disposed / totals.affected) * 100)
    : 0;
  const stockQ = stock ? quantities(w, r.id, stock.id) : null;
  return (
    <main className="app-shell">
      <Toaster richColors position="bottom-right" />
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-symbol">
            <ScanLine size={23} />
          </span>
          lotline
          <span className="brand-divider" />
          <span className="brand-subtitle">Recall response</span>
        </a>
        <div className="workspace-pill">
          {scope === "demo" ? "Sample clinic group" : "Your inventory"}<span>Private workspace</span>
        </div>
        {accountControl}
      </header>
      <div className="workspace">
        <nav className="workspace-nav" aria-label="Workspace"><a href="/?scope=inventory" aria-current={scope === "inventory" ? "page" : undefined}>Your inventory</a><a href="/?scope=demo" aria-current={scope === "demo" ? "page" : undefined}>Sample demo</a></nav>
        <div className="eyebrow">OPERATIONS / RECALL DESK</div>
        <div className="page-heading">
          <div>
            <h1>Every unit needs an answer.</h1>
            <p>Follow affected stock from the shelf to documented closure.</p>
          </div>
          <div className="heading-actions">
            <Button
              variant="outline"
              onClick={() => open("import")}
              disabled={busy}
            >
              <Upload size={16} />
              Import stock
            </Button>
            <Button className="primary-action" onClick={() => open("recall")}>
              <Plus size={17} />
              Open recall
            </Button>
          </div>
        </div>
        <div className="demo-strip">
          <ShieldCheck size={17} />
          <strong>{scope === "demo" ? "Sample demo" : "Inventory workspace"}</strong>
          <span>{scope === "demo" ? "Fictional stock for practice. Your inventory is kept separately." : "Import unused stock records and review a current source notice. No patient information."} Physical actions require human verification.</span>
          {scope === "demo" && <button
            className="demo-reset"
            onClick={() => {
              setError("");
              setReset(true);
            }}
            aria-label="Reset practice workspace"
          >
            <RotateCcw size={14} />
            Reset demo
          </button>}
        </div>
        {loadError && (
          <p role="alert" className="error-box">
            {loadError}
          </p>
        )}
        {!activeRecall ? <section className="onboarding-card">
          <div className="eyebrow">GET STARTED</div><h2>Your inventory workspace is ready.</h2>
          <p>Import your stock export, then open a recall using an FDA reference or a source notice you have reviewed.</p>
          <ol><li><strong>1. Add inventory</strong><span>Use the CSV template. Keep product identifiers, lot numbers and individual-unit quantities.</span></li><li><strong>2. Review a notice</strong><span>Confirm its product, affected lots and handling instructions before matching.</span></li><li><strong>3. Account for stock</strong><span>Resolve unknowns, record actions and export the response record.</span></li></ol>
          <div className="heading-actions"><Button variant="outline" onClick={()=>open("import")}>Import stock CSV</Button><Button onClick={()=>open("recall")}>Open first recall</Button></div>
          <p className="onboarding-count">{w.stock.length} stock records imported</p>
          {w.stock.length > 0 && <div className="inventory-preview">{w.stock.map(s=><article key={s.id}><strong>{s.product}</strong><span>{s.location} · {s.catalog} · Lot {s.lot || "not recorded"}</span><b>{s.quantity} {s.unit}</b></article>)}</div>}
        </section> : <>
        <div className="recall-switch">
          <Select value={r.id} onValueChange={setSelected}>
            <SelectTrigger aria-label="Active recall">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {w.recalls.map((rec) => (
                <SelectItem key={rec.id} value={rec.id}>
                  {rec.reference} · {rec.title}
                  {rec.closedAt ? " · Complete" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={"status " + (r.closedAt ? "green" : "gray")}>
            {r.closedAt ? "Response complete" : "Response open"}
          </span>
        </div>
        <div className="metric-grid">
          {[
            [
              String(totals.affected),
              "Affected units",
              "Exact product and lot match",
              "danger",
            ],
            [
              String(totals.review),
              "Units to verify",
              "Unresolved inventory identifiers",
              "warning",
            ],
            [
              `${totals.disposed} / ${totals.affected}`,
              "Accounted for",
              "Returned or destroyed with evidence",
              "",
            ],
            [
              String(totals.locations),
              "Clinic locations",
              "Affected or uncertain stock",
              "",
            ],
          ].map(([n, t, d, c]) => (
            <section className={"metric " + c} key={t}>
              <span>{t}</span>
              <strong>{n}</strong>
              <small>{d}</small>
            </section>
          ))}
        </div>
        <div className="main-grid">
          <div className="left-column">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="workspace-tabs" variant="line">
                <TabsTrigger value="stock">
                  <PackageSearch />
                  Stock reconciliation
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <ClipboardList />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="evidence">
                  <FileCheck2 />
                  Evidence packet
                </TabsTrigger>
              </TabsList>
              <TabsContent value="stock">
                <section className="panel">
                  <div className="panel-heading">
                    <div className="section-label">
                      <h2>Inventory in scope</h2>
                    </div>
                    <span className="neutral-badge">
                      {responseStock(w, r).length} records
                    </span>
                  </div>
                  <div className="stock-toolbar">
                    <div className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Search inventory"
                        placeholder="Product, lot or location"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger aria-label="Filter assessment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All assessments</SelectItem>
                        <SelectItem value="affected">Affected</SelectItem>
                        <SelectItem value="review">Needs review</SelectItem>
                        <SelectItem value="outside">Outside scope</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / location</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Assessment</TableHead>
                        <TableHead>Next action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((s) => {
                        const a = assess(s, r),
                          q = quantities(w, r.id, s.id);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>
                              <b>{s.product}</b>
                              <small>
                                {s.catalog || "Catalog missing"} · {s.location}
                              </small>
                            </TableCell>
                            <TableCell className="mono">
                              {s.lot || (
                                <span className="missing-value">
                                  Not recorded
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.quantity}
                              <small>{s.unit}</small>
                            </TableCell>
                            <TableCell>
                              <span
                                className={"status " + statusColor[a.status]}
                              >
                                {statusLabel[a.status]}
                              </span>
                              {a.status === "affected" && (
                                <small>
                                  {q.disposed === s.quantity
                                    ? "Fully accounted for"
                                    : `${q.held} in quarantine`}
                                </small>
                              )}
                            </TableCell>
                            <TableCell>
                              {a.status === "affected" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    !!r.closedAt ||
                                    q.disposed === s.quantity ||
                                    busy
                                  }
                                  onClick={() => open("movement", s)}
                                >
                                  {q.disposed === s.quantity ? (
                                    <>
                                      <Check size={14} />
                                      Done
                                    </>
                                  ) : q.quarantined < s.quantity ? (
                                    "Record action"
                                  ) : (
                                    "Record return"
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={
                                    a.status === "review" ? "default" : "ghost"
                                  }
                                  disabled={!!r.closedAt || busy}
                                  onClick={() => open("verify", s)}
                                >
                                  {a.status === "review"
                                    ? "Verify label"
                                    : "Inspect"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {!filtered.length && (
                    <div className="empty-state">
                      <PackageSearch />
                      <h3>No records match this view</h3>
                      <p>Change the filter or search, or import a stock CSV.</p>
                    </div>
                  )}
                  <div className="table-note">
                    <CircleAlert size={17} />
                    <span>
                      Missing information stays open. “Outside scope” applies
                      only to the reviewed notice and this stock snapshot.
                    </span>
                  </div>
                </section>
                <div className="workflow-note">
                  <span className="step-number">01</span>
                  <div>
                    <b>Check the label, then record the action.</b>
                    <p>
                      Lotline tracks unused, on-hand units. A person must verify
                      the manufacturer’s notice and the physical stock.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Workspace activity</h2>
                    <span className="neutral-badge">
                      {w.audit.length} events
                    </span>
                  </div>
                  <div className="audit-list">
                    {[...w.audit].reverse().map((event) => (
                      <article className="audit-event" key={event.id}>
                        <span className="audit-marker">
                          <Check size={14} />
                        </span>
                        <div>
                          <div className="audit-title">
                            <strong>
                              {event.action === "movement"
                                ? "Physical action recorded"
                                : event.action === "verify"
                                  ? "Label verified"
                                  : event.action === "close"
                                    ? "Local response completed"
                                    : event.action === "import"
                                      ? "Inventory imported"
                                      : "Workspace updated"}
                            </strong>
                            <time>{new Date(event.at).toLocaleString()}</time>
                          </div>
                          <p>{event.detail}</p>
                          <small>
                            {event.actor} · Hash {event.hash.slice(0, 12)}…
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </TabsContent>
              <TabsContent value="evidence">
                <section className="panel report-panel">
                  <div className="panel-heading">
                    <h2>Response evidence packet</h2>
                    <span
                      className={"status " + (r.closedAt ? "green" : "amber")}
                    >
                      {r.closedAt ? "Completed record" : "Work in progress"}
                    </span>
                  </div>
                  <div className="report-body">
                    <div className="report-brand">
                      lotline <span>LOCAL RESPONSE RECORD</span>
                    </div>
                    <h2>{r.title}</h2>
                    <p>
                      {r.reference} ·{" "}
                      {r.simulated
                        ? "Fictional training notice"
                        : "Manually reviewed source scope"}
                    </p>
                    <div className="report-grid">
                      <div>
                        <span>Affected</span>
                        <b>{totals.affected} units</b>
                      </div>
                      <div>
                        <span>Unresolved</span>
                        <b>{totals.review} units</b>
                      </div>
                      <div>
                        <span>Disposition recorded</span>
                        <b>{totals.disposed} units</b>
                      </div>
                      <div>
                        <span>Completed</span>
                        <b>
                          {r.closedAt
                            ? new Date(r.closedAt).toLocaleString()
                            : "Not yet completed"}
                        </b>
                      </div>
                    </div>
                    <h3>Reviewed scope</h3>
                    <p>
                      Manufacturer: {r.manufacturer}
                      <br />
                      Catalogs: {r.catalogs.join(", ") || "Not specified"}
                      <br />
                      GTINs: {r.gtins.join(", ") || "Not specified"}
                      <br />
                      Lots:{" "}
                      {r.allLots
                        ? "All lots (explicitly reviewed)"
                        : r.lots.join(", ")}
                    </p>
                    <h3>Physical actions</h3>
                    {w.movements.filter((m) => m.recallId === r.id).length ? (
                      w.movements
                        .filter((m) => m.recallId === r.id)
                        .map((m) => (
                          <div className="report-movement" key={m.id}>
                            <b>
                              {m.stockId} · {m.kind} · {m.quantity} each
                            </b>
                            <p>{m.evidence}</p>
                            <small>
                              {m.actor} · {new Date(m.at).toLocaleString()}
                            </small>
                          </div>
                        ))
                    ) : (
                      <p>No physical actions recorded yet.</p>
                    )}
                    <h3>Closure attestation</h3>
                    <p>
                      {r.closureNote ||
                        "The reviewer has not attested complete inventory coverage, site checks and disposition."}
                    </p>
                    <div className="notice-box">
                      <LockKeyhole size={17} />
                      <p>
                        The JSON export includes source text, inventory
                        assessments, actions and a SHA-256 audit chain. Preserve
                        its digest separately. Operator entries are
                        attestations, not independently verified physical
                        evidence or a digital signature.
                      </p>
                    </div>
                    <div className="export-actions">
                      <Button asChild>
                        <a href={`/api/export?scope=${scope}&recall=${r.id}`}>
                          <Download size={16} />
                          Download evidence JSON
                        </a>
                      </Button>
                      <Button variant="outline" asChild>
                        <a href={`/api/export?scope=${scope}&recall=${r.id}&format=csv`}>
                          Export stock CSV
                        </a>
                      </Button>
                      <Button variant="outline" onClick={() => window.print()}>
                        Print / save PDF
                      </Button>
                    </div>
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          </div>
          <aside className="incident-card">
            <span className="eyebrow">ACTIVE RECALL</span>
            <span className="status red">
              {r.simulated
                ? "High priority · simulated"
                : "Reviewed source scope"}
            </span>
            <h2>{r.title}</h2>
            <p>
              {r.simulated
                ? "A fictional sterile barrier issue affects one lot. Follow the reviewed notice."
                : r.instructions.slice(0, 180) +
                  (r.instructions.length > 180 ? "…" : "")}
            </p>
            <div className="incident-meta">
              <span>Reference</span>
              <strong>{r.reference}</strong>
              <span>Scope reviewer</span>
              <strong>
                {r.simulated ? "Training scenario" : r.approvedBy}
              </strong>
            </div>
            <div className="closure-lock">
              <FileCheck2 size={21} />
              <div>
                <b>
                  {r.closedAt
                    ? "Response complete"
                    : totals.canClose
                      ? "Ready for final review"
                      : "Closure is locked"}
                </b>
                <span>
                  {totals.affected - totals.disposed} units need disposition.
                  <br />
                  {totals.review} units need verification.
                </span>
              </div>
            </div>
            <div className="progress-label">
              <span>Disposition recorded</span>
              <b>{progress}%</b>
            </div>
            <Progress
              value={progress}
              aria-label="Affected units with recorded disposition"
            />
            <button className="text-action" onClick={() => open("source")}>
              View source notice <ArrowUpRight size={16} />
            </button>
            <Button
              className="close-action"
              disabled={!totals.canClose || !!r.closedAt || busy}
              onClick={() => open("close")}
            >
              {r.closedAt ? (
                <>
                  <Check size={15} />
                  Response completed
                </>
              ) : (
                <>
                  Complete response
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
            <small className="local-only">
              Local response completion does not terminate a regulatory recall.
            </small>
          </aside>
        </div>
        </>}
        <footer className="page-footer">
          Lotline <span>Evidence before closure.</span>
          <span>Created by Shivam Gupta</span>
        </footer>
      </div>
      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent
          className={"work-dialog " + (modal === "recall" ? "wide-dialog" : "")}
        >
          <DialogHeader>
            <DialogTitle>
              {modal === "import"
                ? "Import clinic stock"
                : modal === "verify"
                  ? "Verify the package label"
                  : modal === "movement"
                    ? "Record a physical action"
                    : modal === "source"
                      ? "Reviewed source notice"
                      : modal === "close"
                        ? "Complete this local response"
                        : "Open a recall response"}
            </DialogTitle>
            <DialogDescription>
              {modal === "import"
                ? "CSV imports are validated together. One invalid row rejects the entire import."
                : modal === "verify"
                  ? "Check the physical label and document the evidence. Identifiers are matched exactly."
                  : modal === "movement"
                    ? "Record only actions a person has already performed. Quantities are individual units."
                    : modal === "source"
                      ? "Review source instructions and packaging scope before taking action."
                      : modal === "close"
                        ? "Confirm coverage and disposition. Completion locks this local response."
                        : "Use a current source notice. A reviewer must approve the product, packaging level, lot scope and removal instructions."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div role="alert" className="error-box">
              {error}
            </div>
          )}
          {modal === "import" && (
            <div className="form-stack">
              <div className="notice-box">
                <FileText size={18} />
                <p>
                  Required columns: id, product, manufacturer, catalog, gtin,
                  lot, location, quantity, unit. Use <b>each</b> and preserve
                  leading zeroes. Blank identifiers will need review.
                </p>
              </div>
              <a
                className="inline-link"
                download
                href="/samples/inventory-template.csv"
              >
                Download example CSV
              </a>
              <Field label="Choose CSV file">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 200000) {
                        setError("CSV exceeds 200 KB.");
                        return;
                      }
                      setCsv(await file.text());
                      setImportPreview(null);
                      setError("");
                    }
                  }}
                />
              </Field>
              <Field label="Or paste CSV">
                <textarea
                  rows={7}
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setImportPreview(null);
                  }}
                  spellCheck={false}
                />
              </Field>
              {importPreview && (
                <div className="success-box">
                  {importPreview.length} records validated ·{" "}
                  {importPreview.reduce((n, s) => n + s.quantity, 0)} individual
                  units. Existing records remain.
                </div>
              )}
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={!csv || busy}
                  onClick={() => {
                    try {
                      setImportPreview(parseCsv(csv));
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                      setImportPreview(null);
                    }
                  }}
                >
                  Validate CSV
                </Button>
                <Button
                  disabled={!importPreview || busy}
                  onClick={() => change({ type: "import", csv })}
                >
                  {busy ? <Loader2 className="spin" /> : <Upload size={16} />}
                  Import {importPreview?.length ?? ""} records
                </Button>
              </div>
            </div>
          )}
          {modal === "verify" && stock && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void change({
                  type: "verify",
                  stockId: stock.id,
                  lot,
                  catalog,
                  manufacturer,
                  gtin,
                  evidence,
                });
              }}
            >
              <div className="record-context">
                <b>{stock.product}</b>
                <span>
                  {stock.id} · {stock.location} · {stock.quantity} each
                </span>
                <p>{assess(stock, r).reason}</p>
              </div>
              <Field
                label="GS1 barcode text (optional)"
                hint="Paste scanner output or (01)GTIN(10)LOT. The parser validates the GTIN check digit."
              >
                <div className="inline-input">
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="(01)00382903029952(10)8298877"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      try {
                        const p = parseGs1(barcode);
                        setGtin(p.gtin);
                        setLot(p.lot);
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <ScanLine size={16} />
                    Read
                  </Button>
                </div>
              </Field>
              <div className="two-fields">
                <Field label="Catalog / product code">
                  <input
                    required
                    value={catalog}
                    maxLength={200}
                    onChange={(e) => setCatalog(e.target.value)}
                  />
                </Field>
                <Field label="Lot number">
                  <input
                    required
                    value={lot}
                    maxLength={200}
                    onChange={(e) => setLot(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Manufacturer on label">
                <input
                  required
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </Field>
              <Field label="GTIN (optional)">
                <input
                  value={gtin}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(e) => setGtin(e.target.value)}
                />
              </Field>
              <Field
                label="Verification evidence"
                hint="Describe the label checked and reference your supporting record. Do not include patient information."
              >
                <textarea
                  required
                  minLength={8}
                  maxLength={1500}
                  rows={3}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Checked all 12 individual labels against shelf record…"
                />
              </Field>
              <Button
                disabled={
                  busy ||
                  w.movements.some((m) => m.stockId === stock.id) ||
                  !!r.closedAt
                }
                type="submit"
              >
                {busy ? <Loader2 className="spin" /> : <Check size={16} />}Save
                verified label
              </Button>
            </form>
          )}
          {modal === "movement" && stock && stockQ && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void change({
                  type: "movement",
                  recallId: r.id,
                  stockId: stock.id,
                  kind,
                  quantity: Number(quantity),
                  evidence,
                });
              }}
            >
              <div className="record-context">
                <b>{stock.product}</b>
                <span>
                  {stock.location} · Lot {stock.lot} · {stock.quantity} each
                </span>
                <div className="mini-ledger">
                  <span>
                    {stock.quantity - stockQ.quarantined} to quarantine
                  </span>
                  <span>{stockQ.held} held</span>
                  <span>{stockQ.disposed} disposed</span>
                </div>
              </div>
              <Field label="Action performed">
                <Select
                  value={kind}
                  onValueChange={(v) => {
                    setKind(v as typeof kind);
                    setQuantity(
                      String(
                        v === "quarantine"
                          ? stock.quantity - stockQ.quarantined
                          : stockQ.held,
                      ),
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarantine">
                      Quarantine / segregate
                    </SelectItem>
                    {r.allowedDisposition === "returned" ? (
                      <SelectItem value="returned">
                        Returned to supplier
                      </SelectItem>
                    ) : (
                      <SelectItem value="destroyed">
                        Destroyed under approved instructions
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Individual units">
                <input
                  required
                  type="number"
                  min={1}
                  max={
                    kind === "quarantine"
                      ? stock.quantity - stockQ.quarantined
                      : stockQ.held
                  }
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field
                label="Evidence / receipt reference"
                hint="Record the storage location or supplier receipt reference, who verified it, and the date."
              >
                <textarea
                  required
                  minLength={8}
                  maxLength={1500}
                  rows={4}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder={
                    kind === "quarantine"
                      ? "Moved to marked quarantine bin Q-01. Verified by…"
                      : "Supplier receipt RMA-014 confirms receipt of…"
                  }
                />
              </Field>
              <div className="notice-box">
                <CircleAlert size={17} />
                <p>
                  {kind === "destroyed"
                    ? "Only use destruction when the current manufacturer instructions explicitly authorize it. Lotline does not decide how to dispose of a product."
                    : "Saving records your attestation. It does not physically move stock or contact the supplier."}
                </p>
              </div>
              <Button type="submit" disabled={busy || Number(quantity) < 1}>
                {busy ? <Loader2 className="spin" /> : <Check size={16} />}Save
                action
              </Button>
            </form>
          )}
          {modal === "source" && (
            <div className="form-stack">
              <div className="source-heading">
                <span className={"status " + (r.simulated ? "amber" : "gray")}>
                  {r.simulated
                    ? "SIMULATED NOTICE"
                    : "REVIEWED SOURCE SNAPSHOT"}
                </span>
                <strong>{r.reference}</strong>
              </div>
              <div className="source-text">{r.sourceText}</div>
              <h3>Approved matching scope</h3>
              <p className="scope-list">
                Manufacturer: {r.manufacturer}
                <br />
                Catalogs: {r.catalogs.join(", ") || "Not specified"}
                <br />
                GTINs: {r.gtins.join(", ") || "Not specified"}
                <br />
                Lots: {r.allLots ? "All lots" : r.lots.join(", ")}
              </p>
              <div className="notice-box">
                <CircleAlert size={17} />
                <p>
                  Review inner and outer package labels. A mismatch does not
                  prove a product is safe. Lotline supports unused stock
                  removal workflows, not device corrections or patient
                  follow-up.
                </p>
              </div>
              {r.sourceUrl ? (
                <a
                  className="inline-link"
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original source <ArrowUpRight size={14} />
                </a>
              ) : (
                <a
                  className="inline-link"
                  href="/samples/training-notice.txt"
                  target="_blank"
                >
                  Open training notice
                </a>
              )}
            </div>
          )}
          {modal === "close" && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void change({
                  type: "close",
                  recallId: r.id,
                  note: evidence,
                  attested: true,
                });
              }}
            >
              <div className="success-box">
                {totals.disposed} affected units have disposition records. No
                unresolved units remain.
              </div>
              <Field label="Final review record">
                <textarea
                  required
                  minLength={8}
                  maxLength={1500}
                  rows={4}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Reviewed all locations, shelf records and supplier receipts…"
                />
              </Field>
              <CheckField checked={attested} onChange={setAttested}>
                I verified the stock snapshot covers all relevant locations,
                checked notice amendments and forwarding obligations, and
                reviewed every disposition record.
              </CheckField>
              <Button disabled={!attested || busy} type="submit">
                Complete and lock response
              </Button>
            </form>
          )}
          {modal === "recall" && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void change({
                  type: "recall",
                  title,
                  reference,
                  manufacturer,
                  catalogs: split(catalogs),
                  gtins: split(gtins),
                  lots: allLots ? [] : split(lots),
                  allLots,
                  sourceUrl,
                  sourceText,
                  instructions,
                  allowedDisposition,
                  simpleScope: true,
                  attested: true,
                });
              }}
            >
              <div className="lookup-box">
                <Field
                  label="Look up an FDA device recall (optional)"
                  hint="Historical example Z-2614-2026. Its original return deadline has passed."
                >
                  <div className="inline-input">
                    <input
                      value={fdaQuery}
                      onChange={(e) => setFdaQuery(e.target.value)}
                      placeholder="Z-2614-2026"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={looking}
                      onClick={lookup}
                    >
                      {looking ? (
                        <Loader2 className="spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      Look up
                    </Button>
                  </div>
                </Field>
                {fda && (
                  <div className="fda-result">
                    <b>
                      {fda.reference} · {fda.firm}
                    </b>
                    <p>{fda.codeInfo}</p>
                    <small>
                      Fetched {new Date(fda.fetchedAt).toLocaleString()} ·
                      Dataset {fda.datasetUpdated}
                    </small>
                    <p>{fda.warning}</p>
                  </div>
                )}
              </div>
              <div className="two-fields">
                <Field label="Response title">
                  <input
                    required
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="Recall reference">
                  <input
                    required
                    value={reference}
                    maxLength={200}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Original source URL">
                <input
                  required
                  type="url"
                  placeholder="https://…"
                  value={sourceUrl}
                  maxLength={1000}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </Field>
              <Field label="Source text to retain">
                <textarea
                  required
                  minLength={30}
                  maxLength={15000}
                  rows={4}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </Field>
              <Field
                label="Manufacturer used in your inventory"
                hint="Verify the label manufacturer. A recalling distributor may have a different name."
              >
                <input
                  required
                  value={manufacturer}
                  maxLength={200}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </Field>
              <div className="two-fields">
                <Field
                  label="Affected catalog"
                  hint="One exact code. Use a separate response for each product."
                >
                  <textarea
                    value={catalogs}
                    rows={2}
                    onChange={(e) => setCatalogs(e.target.value)}
                  />
                </Field>
                <Field
                  label="Individual-unit GTIN"
                  hint="Optional. One GTIN for the same product. Preserve leading zeroes."
                >
                  <textarea
                    value={gtins}
                    rows={2}
                    onChange={(e) => setGtins(e.target.value)}
                  />
                </Field>
              </div>
              <CheckField checked={allLots} onChange={setAllLots}>
                The original notice explicitly includes all lots of these
                products.
              </CheckField>
              {!allLots && (
                <Field
                  label="Affected lots"
                  hint="Exact codes only. Lot ranges must be reviewed and explicitly enumerated."
                >
                  <textarea
                    required
                    value={lots}
                    rows={2}
                    onChange={(e) => setLots(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Reviewed removal instructions">
                <textarea
                  required
                  minLength={20}
                  maxLength={3000}
                  value={instructions}
                  rows={3}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </Field>
              <Field label="Disposition authorized by the notice">
                <Select
                  value={allowedDisposition}
                  onValueChange={(v) =>
                    setAllowedDisposition(v as typeof allowedDisposition)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="returned">Return to supplier</SelectItem>
                    <SelectItem value="destroyed">
                      Destruction explicitly authorized
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <CheckField checked={attested} onChange={setAttested}>
                This is one product with an exact shared lot scope, not a range
                or a mixture of product/lot pairs. I checked the current source,
                product and packaging identifiers, affected lot scope and
                removal instructions. This response concerns unused stock, with
                no patient information.
              </CheckField>
              <Button disabled={!attested || busy} type="submit">
                {busy ? (
                  <Loader2 className="spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Approve scope and open response
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the practice workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your evaluation imports, responses and activity, then
              restores the fictional training scenario. Export any records you
              want to keep first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my work</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void change({ type: "reset", confirmed: true });
              }}
            >
              Reset demo data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
