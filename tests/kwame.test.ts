// kwame.test.ts — parser unit tests + /api/ask e2e against a stub Baobab.
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parse";
import { respond } from "../src/respond";

describe("parse", () => {
  test("aliases", () => {
    expect(parse("how's the naira")).toEqual({ t: "quote", query: "naira" });
    expect(parse("brent price")).toEqual({ t: "quote", query: "brent" });
  });
  test("baobab functions", () => {
    expect(parse("TOP")).toEqual({ t: "overview" });
    expect(parse("SEC VALE")).toEqual({ t: "quote", query: "VALE" });
    expect(parse("ADD brent")).toEqual({ t: "watchAdd", sym: "BZ=F" });
    expect(parse("W")).toEqual({ t: "watchlist" });
    expect(parse("N")).toEqual({ t: "news", region: "all" });
  });
  test("natural language", () => {
    expect(parse("what's moving")).toEqual({ t: "movers" });
    expect(parse("news jamaica")).toEqual({ t: "news", region: "caribbean" });
    expect(parse("news africa")).toEqual({ t: "news", region: "africa" });
    expect(parse("vale trend past month")).toEqual({ t: "trend", query: "vale", range: "1M" });
    expect(parse("how has brent done this year")).toEqual({ t: "trend", query: "brent", range: "1Y" });
    expect(parse("add VALE")).toEqual({ t: "watchAdd", sym: "VALE" });
    expect(parse("remove vale")).toEqual({ t: "watchDel", sym: "VALE" });
    expect(parse("my watchlist")).toEqual({ t: "watchlist" });
    expect(parse("help")).toEqual({ t: "help" });
    expect(parse("VALE")).toEqual({ t: "quote", query: "VALE" });
    expect(parse("asdkfjhasd qwerty zzz")).toEqual({ t: "unknown" });
  });
  test("commodities desk", () => {
    expect(parse("commodities")).toEqual({ t: "commodities" });
    expect(parse("commodity prices")).toEqual({ t: "commodities" });
    expect(parse("all commodities")).toEqual({ t: "commodities" });
    expect(parse("lookup cocoa")).toEqual({ t: "commodity", query: "cocoa" });
    expect(parse("commodity brent")).toEqual({ t: "commodity", query: "brent" });
  });
  test("startups", () => {
    expect(parse("startups")).toEqual({ t: "startups" });
    expect(parse("startup stocks")).toEqual({ t: "startups" });
    expect(parse("how is nubank doing")).toEqual({ t: "quote", query: "nubank" });
  });
});

// ---------- e2e against a stubbed Baobab ----------
function q(sym: string, price: number, chgPct: number) {
  const chg = (price * chgPct) / 100;
  return {
    sym, name: sym + " Corp", region: "africa", kind: "fx", note: "Test", ccy: "USD",
    price, prevClose: price - chg, chg, chgPct, dayHigh: price * 1.01, dayLow: price * 0.99,
    wk52High: price * 1.2, wk52Low: price * 0.8, volume: 1000, asof: Date.now(), stale: false,
  };
}
const QUOTES = [q("USDNGN=X", 1327.66, -0.05), q("VALE", 13.76, 1.1), q("BZ=F", 68.4, 2.5), q("NU", 12.34, 2.5)];

let stub: any, server: any, port = 0;
const ask = (text: string) =>
  fetch(`http://127.0.0.1:${port}/api/ask`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
  }).then((r) => r.json());

beforeAll(async () => {
  stub = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      const ok = (d: any) => Response.json(d);
      if (u.pathname === "/api/status") return ok({ ok: true });
      if (u.pathname === "/api/search") {
        const needle = (u.searchParams.get("q") || "").toLowerCase();
        const hit = QUOTES.find((x) => x.sym.toLowerCase().includes(needle));
        return ok({ results: hit ? [{ sym: hit.sym, name: hit.name }] : [] });
      }
      if (u.pathname === "/api/quotes") {
        const syms = (u.searchParams.get("syms") || "").split(",");
        return ok({ quotes: QUOTES.filter((x) => syms.includes(x.sym)) });
      }
      if (u.pathname === "/api/history") {
        const bars = Array.from({ length: 30 }, (_, i) => ({ t: 1_750_000_000_000 + i * 86400000, o: 10 + i, h: 11 + i, l: 9 + i, c: 10 + i, v: 5 }));
        return ok({ bars });
      }
      if (u.pathname === "/api/news")
        return ok({ news: [{ title: "Test headline", link: "https://x.test", source: "X", published: Date.now(), region: "africa" }] });
      if (u.pathname === "/api/overview")
        return ok({ asof: Date.now(), indices: [QUOTES[1]], fx: [QUOTES[0]], cmd: [QUOTES[2]], stocks: [QUOTES[1]], startups: [QUOTES[1]], global: [] });
      if (u.pathname === "/api/watchlist" && req.method === "GET") return ok({ watchlist: [QUOTES[1]] });
      if (u.pathname === "/api/watchlist" && req.method === "POST") return ok({ ok: true });
      const del = u.pathname.match(/^\/api\/watchlist\/(.+)$/);
      if (del && req.method === "DELETE") return ok({ removed: true });
      return new Response("nf", { status: 404 });
    },
  });
  const probe = Bun.serve({ port: 0, fetch: () => new Response("x") });
  port = probe.port; probe.stop(true);
  server = Bun.spawn(["bun", join(import.meta.dir, "..", "src", "server.ts")], {
    env: { ...process.env, KWAME_PORT: String(port), BAOBAB_URL: `http://127.0.0.1:${stub.port}` },
    stdout: "ignore", stderr: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/api/status`); if (r.ok) break; } catch {}
    await Bun.sleep(250);
  }
  // in-process respond() calls use the stub too
  process.env.BAOBAB_URL = `http://127.0.0.1:${stub.port}`;
});
afterAll(() => { try { server.kill(); } catch {} stub.stop(true); delete process.env.BAOBAB_URL; });

describe("ask", () => {
  test("quote via alias", async () => {
    const d = await ask("how's the naira");
    expect(d.reply).toContain("USDNGN=X");
    expect(d.reply).toContain("1,327.66");
  });
  test("movers", async () => {
    const d = await ask("what's moving");
    expect(d.reply).toContain("Biggest movers");
    expect(d.reply).toContain("BZ=F");
  });
  test("trend with sparkline", async () => {
    const d = await ask("vale trend");
    expect(d.reply).toContain("VALE — 1Y");
    expect(d.reply).toMatch(/[▁▂▃▄▅▆▇█]/);
  });
  test("news", async () => {
    const d = await ask("news africa");
    expect(d.reply).toContain("Test headline");
  });
  test("watchlist", async () => {
    const d = await ask("watchlist");
    expect(d.reply).toContain("VALE");
  });
  test("watch add resolves alias", async () => {
    const d = await ask("add brent");
    expect(d.reply).toContain("BZ=F added");
  });
  test("help", async () => {
    const d = await ask("help");
    expect(d.reply).toContain("I speak Baobab");
  });
  test("unknown", async () => {
    const d = await ask("asdkfjhasd qwerty zzz");
    expect(d.reply).toContain("didn't catch");
  });
  test("commodities board", async () => {
    const d = await ask("commodities");
    expect(d.reply).toContain("Commodities");
    expect(d.reply).toContain("BZ=F");
  });
  test("commodity lookup", async () => {
    const d = await ask("lookup brent");
    expect(d.reply).toContain("BZ=F");
    expect(d.reply).toContain("(ICE)");
    expect(d.reply).toContain("USD per barrel");
    expect(d.reply).toContain("Why it matters");
    expect(d.reply).toMatch(/[▁▂▃▄▅▆▇█]/);
  });
  test("startups board", async () => {
    const d = await ask("startups");
    expect(d.reply).toContain("Startups");
  });
  test("startup alias", async () => {
    const d = await ask("nubank");
    expect(d.reply).toContain("NU");
    expect(d.reply).toContain("12.34");
  });
  test("baobab down", async () => {
    process.env.BAOBAB_URL = "http://127.0.0.1:1";
    const reply = await respond("naira");
    expect(reply).toContain("isn't answering");
    process.env.BAOBAB_URL = `http://127.0.0.1:${stub.port}`;
  });
});
