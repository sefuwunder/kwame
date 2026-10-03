// parse.ts — deterministic natural-language → intent. No models, no
// network: pure pattern matching over the user's text. Kwame also speaks
// Baobab's own function language (TOP, SEC VALE, ADD X …) natively.
export type Intent =
  | { t: "overview" }
  | { t: "movers" }
  | { t: "news"; region: string }
  | { t: "watchlist" }
  | { t: "watchAdd"; sym: string }
  | { t: "watchDel"; sym: string }
  | { t: "quote"; query: string }
  | { t: "trend"; query: string; range: string }
  | { t: "commodities" }
  | { t: "commodity"; query: string }
  | { t: "startups" }
  | { t: "help" }
  | { t: "unknown" };

// nicknames → Baobab symbols
export const ALIASES: Record<string, string> = {
  bovespa: "^BVSP", ibovespa: "^BVSP", ipc: "^MXX", merval: "^MERV",
  "south africa": "EZA", jse: "EZA", nigeria: "USDNGN=X", egypt: "EGY",
  naira: "USDNGN=X", ngn: "USDNGN=X", rand: "USDZAR=X", zar: "USDZAR=X",
  cedi: "USDGHS=X", "kenya shilling": "USDKES=X", "egyptian pound": "USDEGP=X",
  real: "USDBRL=X", brl: "USDBRL=X", "mexican peso": "USDMXN=X", mxn: "USDMXN=X",
  "argentine peso": "USDARS=X", ars: "USDARS=X", "chilean peso": "USDCLP=X",
  "colombian peso": "USDCOP=X", sol: "USDPEN=X", "jamaican dollar": "USDJMD=X",
  "trinidad dollar": "USDTTD=X",
  brent: "BZ=F", wti: "CL=F", oil: "BZ=F", crude: "BZ=F",
  gold: "GC=F", silver: "SI=F", copper: "HG=F", platinum: "PL=F",
  coffee: "KC=F", cocoa: "CC=F", sugar: "SB=F",
  nubank: "NU", "nu holdings": "NU", stone: "STNE", stoneco: "STNE",
  pagseguro: "PAGS", pagbank: "PAGS", xp: "XP", "xp inc": "XP",
  jumia: "JMIA", dlocal: "DLO", globant: "GLOB",
  vale: "VALE", petrobras: "PBR", itau: "ITUB", "america movil": "AMX",
  femsa: "FMX", mercadolibre: "MELI", ypf: "YPF", galicia: "GGAL",
  sqm: "SQM", credicorp: "BAP", ecopetrol: "EC", bancolombia: "CIB",
  "s&p": "^SPX", "sp500": "^SPX", dow: "^DJI", nasdaq: "^NDQ", ftse: "^FTSE",
};

const COUNTRY_REGION: Record<string, string> = {
  nigeria: "africa", ghana: "africa", kenya: "africa", "south africa": "africa", egypt: "africa",
  jamaica: "caribbean", trinidad: "caribbean", barbados: "caribbean",
  brazil: "latam", mexico: "latam", argentina: "latam", chile: "latam",
  colombia: "latam", peru: "latam",
};

const norm = (s: string) => s.toLowerCase().replace(/[?!.,;]+$/g, "").trim().replace(/\s+/g, " ");

function resolveSym(raw: string): string {
  const u = raw.trim().toUpperCase();
  const hit = ALIASES[u.toLowerCase().replace(/^the /, "")];
  if (hit) return hit;
  if (/^[A-Z]{2,6}$/.test(u)) return u;               // VALE
  if (/^[A-Z]{6}$/.test(u)) return u + "=X";           // USDZAR
  if (u.startsWith("^") || u.endsWith("=X") || u.endsWith("=F")) return u;
  return u;
}

function newsRegion(text: string): string {
  if (/\bafrica\b/.test(text)) return "africa";
  if (/\bcaribbean\b/.test(text)) return "caribbean";
  if (/\blatam\b|\blatin america\b/.test(text)) return "latam";
  for (const [c, r] of Object.entries(COUNTRY_REGION))
    if (text.includes(c)) return r;
  return "all";
}

function trendRange(text: string): string {
  if (/\b(1d|today|intraday)\b/.test(text)) return "1D";
  if (/\b(1w|week|past week)\b/.test(text)) return "1W";
  if (/\b(1m|month|past month)\b/.test(text)) return "1M";
  if (/\b(3m|quarter)\b/.test(text)) return "3M";
  if (/\b(5y|5 years|five years)\b/.test(text)) return "5Y";
  return "1Y";
}

export function parse(raw: string): Intent {
  const text = norm(raw);
  if (!text) return { t: "unknown" };

  // --- Baobab's own function language, verbatim ---
  const fn = text.toUpperCase();
  if (fn === "TOP") return { t: "overview" };
  if (fn === "W" || fn === "WATCH") return { t: "watchlist" };
  if (fn === "N" || fn === "NEWS") return { t: "news", region: "all" };
  if (fn === "FX") return { t: "quote", query: "__FXBOARD__" };
  if (fn === "CMD" || fn === "COMMOD") return { t: "quote", query: "__CMDBOARD__" };
  if (fn === "HELP" || fn === "?") return { t: "help" };
  let m = fn.match(/^(SEC|CHART)\s+(.+)$/);
  if (m) return /\b(TREND|CHART|HISTORY)\b/.test(fn) && m[1] === "CHART"
    ? { t: "trend", query: m[2], range: "1Y" }
    : { t: "quote", query: m[2] };
  m = fn.match(/^ADD\s+(.+)$/);
  if (m) return { t: "watchAdd", sym: resolveSym(m[1]) };
  m = fn.match(/^(DEL|RM|REMOVE)\s+(.+)$/);
  if (m) return { t: "watchDel", sym: resolveSym(m[2]) };

  // --- natural language ---
  if (/^(help|what can you do|how do i use (this|you)|commands)$/.test(text)) return { t: "help" };
  if (/^(market )?overview|how are (the )?markets|markets (today|now)|market (status|summary)/.test(text)) return { t: "overview" };
  if (/movers|what'?s moving|biggest (gainers|losers)|gainers|losers|most active/.test(text)) return { t: "movers" };
  if (/^(my )?watchlist|what am i (watching|tracking)/.test(text)) return { t: "watchlist" };

  m = text.match(/^(?:add|watch|track|follow)\s+(.+)$/);
  if (m) return { t: "watchAdd", sym: resolveSym(m[1]) };
  m = text.match(/^(?:remove|unwatch|untrack|drop|stop watching)\s+(.+)$/);
  if (m) return { t: "watchDel", sym: resolveSym(m[1]) };

  if (/\bnews\b|\bheadlines\b/.test(text)) return { t: "news", region: newsRegion(text) };

  if (/^(commodities|commodity prices|all commodities|commodity board)$/.test(text)) return { t: "commodities" };
  m = text.match(/^(?:lookup|commodity)\s+(.+)$/);
  if (m) return { t: "commodity", query: m[1] };
  if (/^(startups|startup stocks|startup board|new economy)$/.test(text)) return { t: "startups" };

  const stripQ = (s: string) => s.replace(/^(the|price of|quote for)\s+/, "").trim();
  m = text.match(/(?:trend|chart|history)\s+(?:of|for)\s+(.+)/);
  if (m) return { t: "trend", query: stripQ(m[1]), range: trendRange(text) };
  m = text.match(/^(.+?)\s+(?:trend|chart|history)\b(.*)$/);
  if (m && stripQ(m[1])) return { t: "trend", query: stripQ(m[1]), range: trendRange(m[2] || text) };
  m = text.match(/how has\s+(.+?)\s+(done|performed|been doing)(?:\s+(.*))?$/);
  if (m) return { t: "trend", query: m[1], range: trendRange(text + " " + (m[3] || "")) };
  m = text.match(/(.+?)\s+(?:over|in) the (?:past |last )?(day|week|month|year|5 years)/);
  if (m) return { t: "trend", query: m[1].replace(/^(price of|quote for)\s+/, ""), range: trendRange(m[2]) };

  m = text.match(/^(?:price of|quote(?: for)?|how'?s|how is|what'?s)\s+(.+?)(?:\s+(?:doing|trading|at|now))?$/);
  if (m) return { t: "quote", query: m[1].replace(/^the /, "") };
  m = text.match(/^(.+?)\s+(?:price|quote)$/);
  if (m) return { t: "quote", query: m[1].replace(/^the /, "") };

  // bare symbol-ish input: "VALE", "USDZAR", "^BVSP"
  if (/^[\^a-zA-Z][a-zA-Z.=^]{1,9}$/.test(text.replace(/\s/g, "")) && text.length <= 12)
    return { t: "quote", query: text.toUpperCase() };

  // alias as the whole message: "naira", "brent"
  if (ALIASES[text]) return { t: "quote", query: text };

  return { t: "unknown" };
}
