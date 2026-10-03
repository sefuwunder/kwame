// server.ts — Kwame: a conversational agent for Baobab's API.
// Chat UI + POST /api/ask. Speaks to Baobab over HTTP only (BAOBAB_URL).
import { respond } from "./respond";
import { baobabUp } from "./baobab";

const PORT = Number(process.env.KWAME_PORT || 3016);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const pub = `${import.meta.dir}/../public`;

  if (req.method === "GET" && (path === "/" || path === "/index.html"))
    return new Response(Bun.file(`${pub}/index.html`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (req.method === "GET" && path === "/app.js")
    return new Response(Bun.file(`${pub}/app.js`), { headers: { "Content-Type": "text/javascript" } });
  if (req.method === "GET" && path === "/styles.css")
    return new Response(Bun.file(`${pub}/styles.css`), { headers: { "Content-Type": "text/css" } });

  if (req.method === "GET" && path === "/api/status")
    return json({ ok: true, baobab: await baobabUp(), time: Date.now() });

  if (req.method === "POST" && path === "/api/ask") {
    let text = "";
    try { text = String((await req.json()).text || ""); } catch {}
    const reply = await respond(text);
    return json({ reply });
  }

  return json({ error: "Not found." }, 404);
}

if (import.meta.main) {
  Bun.serve({ port: PORT, fetch: handle });
  console.log(`Kwame listening on http://localhost:${PORT}`);
}

export { handle };
