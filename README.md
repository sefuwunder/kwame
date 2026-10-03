# Kwame

A conversational agent that **speaks Baobab** — ask about markets in plain language (or Baobab's own function codes) and it queries the Baobab terminal's API for you. Bun + zero dependencies. No models: a deterministic pattern-matching parser, in the Milton tradition.

## What it understands

- **Quotes** — “how's the naira”, “brent price”, “SEC VALE”, “USDZAR”
- **Trends** — “VALE trend this year”, “brent past month” (performance + ASCII sparkline)
- **Overview** — “markets”, “how are markets doing”, `TOP`
- **Movers** — “what's moving”, “biggest gainers”
- **News** — “news africa”, “headlines jamaica”
- **Watchlist** — “add VALE”, “remove brent”, “my watchlist”, `ADD`/`W`
- **Baobab functions verbatim** — `TOP W N FX CMD SEC ADD HELP`

Nicknames included: naira/rand/cedi/real, brent/wti/gold/copper/cocoa/coffee, bovespa/ipc/merval, vale/petrobras/sqmem …

## Run it

Baobab must be running first (default `http://localhost:3015`).

```sh
bun src/server.ts        # chat UI → http://localhost:3016
bun src/cli.ts           # terminal REPL: kwame>
```

Env: `BAOBAB_URL`, `KWAME_PORT`.

## API

- `POST /api/ask` `{text}` → `{reply}` — the agent
- `GET /api/status` → `{ok, baobab, time}` — includes Baobab reachability

## Test

```sh
bun test   # 12 checks: parser unit tests + /api/ask e2e against a stubbed Baobab
```
