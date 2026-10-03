// respond.ts — intents → Baobab API → plain-text replies.
import { parse, ALIASES, type Intent } from "./parse";
import { bOverview, bQuotes, bHistory, bNews, bSearch, bWatch, bWatchAdd, bWatchDel, baobabUp } from "./baobab";

function fmtP(p: number | null): string {
  if (p == null || isNaN(p)) return "—";
  const a = Math.abs(p);
  if (a !== 0 && a < 1) return p.toFixed(4);
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtV(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}
function arrow(q: any): string { return q.chg >= 0 ? "▲" : "▼"; }
function chgStr(q: any): string {
  const s = q.chg >= 0 ? "+" : "";
  return `${s}${fmtP(q.chg)} (${s}${q.chgPct.toFixed(2)}%)`;
}
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
function spark(bars: any[]): string {
  const cs = bars.map((b) => b.c).filter((c) => c != null);
  if (cs.length < 2) return "";
  const n = 24, step = Math.max(1, Math.floor(cs.length / n));
  const samp: number[] = [];
  for (let i = 0; i < cs.length && samp.length < n; i += step) samp.push(cs[i]);
  samp.push(cs[cs.length - 1]);
  const min = Math.min(...samp), max = Math.max(...samp), rng = max - min || 1;
  return samp.map((c) => BLOCKS[Math.min(7, Math.floor(((c - min) / rng) * 8))]).join("");
}

/** Resolve a user's words to a Baobab symbol, via aliases then /api/search. */
async function resolve(query: string): Promise<{ sym: string; name: string } | null> {
  const cleaned = query.trim().toLowerCase().replace(/^the /, "");
  const hit = ALIASES[cleaned];
  if (hit) return { sym: hit, name: hit };
  const u = query.trim().toUpperCase();
  if (/^[\^A-Z][A-Z.=^]{1,11}$/.test(u)) {
    const cands = [u, u + "=X", "^" + u];
    for (const c of cands) {
      try {
        const d = await bQuotes([c]);
        if (d.quotes.length) return { sym: d.quotes[0].sym, name: d.quotes[0].name };
      } catch {}
    }
  }
  try {
    const d = await bSearch(query);
    if (d.results?.length) return { sym: d.results[0].sym, name: d.results[0].name };
  } catch {}
  return null;
}

async function quoteReply(query: string): Promise<string> {
  if (query === "__FXBOARD__" || query === "__CMDBOARD__") {
    const o = await bOverview();
    const list = query === "__FXBOARD__" ? o.fx : o.cmd;
    const title = query === "__FXBOARD__" ? "Foreign exchange — per USD" : "Commodities";
    return [title, ...list.map((q: any) =>
      `${q.sym.replace("=X", "").padEnd(9)} ${fmtP(q.price).padStart(12)}  ${arrow(q)} ${q.chgPct >= 0 ? "+" : ""}${q.chgPct.toFixed(2)}%  ${q.note || ""}`
    )].join("\n");
  }
  const r = await resolve(query);
  if (!r) return `I don't know "${query}". Try HELP for what I understand.`;
  const d = await bQuotes([r.sym]);
  const q = d.quotes[0];
  if (!q) return `No quote for ${r.sym} right now.`;
  return [
    `${q.name} — ${q.sym}${q.stale ? "  (stale)" : ""}`,
    `${fmtP(q.price)}  ${arrow(q)} ${chgStr(q)}`,
    `Day ${fmtP(q.dayLow)}–${fmtP(q.dayHigh)} · 52w ${fmtP(q.wk52Low)}–${fmtP(q.wk52High)} · Vol ${fmtV(q.volume)}`,
  ].join("\n");
}

async function trendReply(query: string, range: string): Promise<string> {
  const r = await resolve(query);
  if (!r) return `I don't know "${query}". Try HELP for what I understand.`;
  const d = await bHistory(r.sym, range);
  const bars = d.bars || [];
  if (!bars.length) return `No history for ${r.sym} right now.`;
  const first = bars[0].c, last = bars[bars.length - 1].c;
  const pct = ((last - first) / first) * 100;
  const hi = Math.max(...bars.map((b: any) => b.h ?? b.c));
  const lo = Math.min(...bars.map((b: any) => b.l ?? b.c));
  return [
    `${r.sym} — ${range}: ${fmtP(first)} → ${fmtP(last)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`,
    `High ${fmtP(hi)} · Low ${fmtP(lo)}`,
    spark(bars),
  ].join("\n");
}

const REGION_LABEL: Record<string, string> = { africa: "Africa", caribbean: "Caribbean", latam: "Latin America", global: "Global" };

// Stable futures-contract specs for the commodities desk.
const COMMODITY_META: Record<string, { unit: string; exchange: string }> = {
  "BZ=F": { unit: "USD per barrel", exchange: "ICE" },
  "CL=F": { unit: "USD per barrel", exchange: "NYMEX" },
  "GC=F": { unit: "USD per troy ounce", exchange: "COMEX" },
  "SI=F": { unit: "USD per troy ounce", exchange: "COMEX" },
  "HG=F": { unit: "USD per pound", exchange: "COMEX" },
  "PL=F": { unit: "USD per troy ounce", exchange: "NYMEX" },
  "KC=F": { unit: "US cents per pound", exchange: "ICE" },
  "CC=F": { unit: "USD per metric ton", exchange: "ICE" },
  "SB=F": { unit: "US cents per pound", exchange: "ICE" },
};

async function overviewReply(): Promise<string> {
  const o = await bOverview();
  const lines = ["Market overview"];
  const groups: Array<[string, any[]]> = [["indices", o.indices], ["fx", o.fx], ["cmd", o.cmd]];
  for (const [g, list] of groups) {
    const byRegion: Record<string, any[]> = {};
    for (const q of list) (byRegion[q.region] = byRegion[q.region] || []).push(q);
    for (const [region, qs] of Object.entries(byRegion)) {
      lines.push(`— ${REGION_LABEL[region] || region} ${g} —`);
      for (const q of qs)
        lines.push(`${q.sym.replace("=X", "").padEnd(10)} ${fmtP(q.price).padStart(12)}  ${arrow(q)} ${q.chgPct >= 0 ? "+" : ""}${q.chgPct.toFixed(2)}%`);
    }
  }
  if (o.indices.some((q: any) => q.stale)) lines.push("(some quotes stale — a feed may be down)");
  return lines.join("\n");
}

async function moversReply(): Promise<string> {
  const o = await bOverview();
  const all = [...o.indices, ...o.stocks, ...o.cmd, ...o.fx].filter((q) => q && isFinite(q.chgPct));
  const gainers = [...all].sort((a, b) => b.chgPct - a.chgPct).slice(0, 5);
  const losers = [...all].sort((a, b) => a.chgPct - b.chgPct).slice(0, 5);
  const line = (q: any) => `${q.sym.replace("=X", "").padEnd(10)} ${arrow(q)} ${q.chgPct >= 0 ? "+" : ""}${q.chgPct.toFixed(2)}%  (${fmtP(q.price)})`;
  return ["Biggest movers —",
    ...gainers.map((q) => "▲ " + line(q)),
    "—",
    ...losers.map((q) => "▼ " + line(q)),
  ].join("\n");
}

async function newsReply(region: string): Promise<string> {
  const d = await bNews(region);
  const items = (d.news || []).slice(0, 8);
  if (!items.length) return "No headlines right now.";
  const label = region === "all" ? "" : ` — ${REGION_LABEL[region] || region}`;
  return [`Headlines${label}`, ...items.map((n: any, i: number) =>
    `${i + 1}. ${n.title}\n   ${n.source}${n.link ? " — " + n.link : ""}`
  )].join("\n");
}

async function commoditiesReply(): Promise<string> {
  const o = await bOverview();
  const list = (o.cmd || []) as any[];
  if (!list.length) return "No commodity data right now.";
  const lines = ["Commodities — the region's lifelines"];
  for (const q of list) {
    const meta = COMMODITY_META[q.sym];
    lines.push(`${q.name} (${q.sym.replace("=F", "")})`);
    lines.push(`  ${fmtP(q.price)}${meta ? " " + meta.unit : ""}  ${arrow(q)} ${chgStr(q)}`);
    if (q.note) lines.push(`  ↳ ${q.note}`);
  }
  return lines.join("\n");
}

async function commodityReply(query: string): Promise<string> {
  const r = await resolve(query);
  if (!r) return `I don't know "${query}". Try "commodities" for the full board.`;
  const d = await bQuotes([r.sym]);
  const q = d.quotes[0];
  if (!q) return `No quote for ${r.sym} right now.`;
  const meta = COMMODITY_META[q.sym];
  const lines = [
    `${q.name} — ${q.sym}${meta ? ` (${meta.exchange})` : ""}${q.stale ? "  (stale)" : ""}`,
    `${fmtP(q.price)}${meta ? " " + meta.unit : ""}  ${arrow(q)} ${chgStr(q)}`,
    `Day ${fmtP(q.dayLow)}–${fmtP(q.dayHigh)} · 52w ${fmtP(q.wk52Low)}–${fmtP(q.wk52High)}`,
  ];
  if (q.note) lines.push(`Why it matters: ${q.note}`);
  try {
    const h = await bHistory(q.sym, "1M");
    const bars = h.bars || [];
    if (bars.length > 1) {
      const pct = ((bars[bars.length - 1].c - bars[0].c) / bars[0].c) * 100;
      lines.push(`1M: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${spark(bars)}`);
    }
  } catch { /* quote without trend is still useful */ }
  return lines.join("\n");
}

async function watchlistReply(): Promise<string> {  const d = await bWatch();
  const list = d.watchlist || [];
  if (!list.length) return "Your watchlist is empty. Say “add VALE” to start one.";
  return ["Watchlist",
    ...list.map((q: any) => `${q.sym.padEnd(12)} ${fmtP(q.price).padStart(12)}  ${arrow(q)} ${q.chgPct >= 0 ? "+" : ""}${q.chgPct.toFixed(2)}%`)
  ].join("\n");
}

function helpText(): string {
  return [
    "I speak Baobab. Try:",
    "• “how's the naira” / “brent price” / “SEC VALE” — a quote",
    "• “VALE trend this year” / “brent past month” — performance + sparkline",
    "• “markets” / TOP — regional overview",
    "• “what's moving” — biggest gainers & losers",
    "• “news africa” / “headlines jamaica” — regional news",
    "• “commodities” / “lookup cocoa” — the commodities desk",
    "• “add VALE” / “remove VALE” / “watchlist” — your watchlist",
    "I also take Baobab functions verbatim: TOP, W, N, FX, CMD, SEC, ADD.",
  ].join("\n");
}

export async function respond(raw: string): Promise<string> {
  const text = raw.trim();
  if (!text) return "Say HELP and I'll show you what I understand.";
  if (!(await baobabUp()))
    return "Baobab isn't answering right now — is it running? (BAOBAB_URL)";
  const intent: Intent = parse(text);
  try {
    switch (intent.t) {
      case "overview": return await overviewReply();
      case "movers": return await moversReply();
      case "news": return await newsReply(intent.region);
      case "watchlist": return await watchlistReply();
      case "quote": return await quoteReply(intent.query);
      case "trend": return await trendReply(intent.query, intent.range);
      case "commodities": return await commoditiesReply();
      case "commodity": return await commodityReply(intent.query);
      case "help": return helpText();
      case "watchAdd": {
        const r = await resolve(intent.sym);
        if (!r) return `I don't know "${intent.sym}".`;
        await bWatchAdd(r.sym);
        return `${r.sym} added to your watchlist.`;
      }
      case "watchDel": {
        const r = await resolve(intent.sym);
        const sym = r ? r.sym : intent.sym.toUpperCase();
        const d = await bWatchDel(sym);
        return d.removed ? `${sym} removed from your watchlist.` : `${sym} wasn't on your watchlist.`;
      }
      default:
        return `I didn't catch that. Try “how's the naira”, “what's moving”, or HELP.`;
    }
  } catch (e: any) {
    return `Baobab stumbled: ${e.message || "request failed"}. Try again in a bit.`;
  }
}
