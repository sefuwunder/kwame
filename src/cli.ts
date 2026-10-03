// cli.ts — Kwame on the command line. `bun src/cli.ts`
import { respond } from "./respond";
import { baobabUp } from "./baobab";
import { createInterface } from "node:readline";

const up = await baobabUp();
console.log(up
  ? "Kwame — I speak Baobab. Ask me about markets (HELP for ideas)."
  : "Kwame — warning: Baobab isn't answering. Start it first, or set BAOBAB_URL.");

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "kwame> " });
rl.prompt();
rl.on("line", async (line) => {
  const t = line.trim();
  if (/^(quit|exit|bye)$/i.test(t)) { rl.close(); return; }
  if (t) console.log(await respond(t) + "\n");
  rl.prompt();
});
rl.on("close", () => process.exit(0));
