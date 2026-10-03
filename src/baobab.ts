// baobab.ts — HTTP client for Baobab's API. Kwame never touches market
// data any other way: Baobab is the system of record.
const base = () => (process.env.BAOBAB_URL || "http://localhost:3015").replace(/\/+$/, "");

async function bget(path: string): Promise<any> {
  const r = await fetch(base() + path, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `baobab ${r.status}`);
  }
  return r.json();
}

export const bStatus = () => bget("/api/status");
export const bOverview = () => bget("/api/overview");
export const bSearch = (q: string) => bget("/api/search?q=" + encodeURIComponent(q));
export const bQuotes = (syms: string[]) =>
  bget("/api/quotes?syms=" + encodeURIComponent(syms.join(",")));
export const bHistory = (sym: string, range = "1Y") =>
  bget(`/api/history?sym=${encodeURIComponent(sym)}&range=${range}`);
export const bNews = (region = "all") => bget("/api/news?region=" + region);
export const bWatch = () => bget("/api/watchlist");

export async function bWatchAdd(sym: string): Promise<any> {
  const r = await fetch(base() + "/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sym }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error || `baobab ${r.status}`);
  }
  return r.json();
}

export async function bWatchDel(sym: string): Promise<any> {
  const r = await fetch(base() + "/api/watchlist/" + encodeURIComponent(sym), {
    method: "DELETE",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`baobab ${r.status}`);
  return r.json();
}

export async function baobabUp(): Promise<boolean> {
  try { await bStatus(); return true; } catch { return false; }
}
