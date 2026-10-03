/* Kwame chat client. */
const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("in");

function addMsg(text, cls) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
async function ask(text) {
  addMsg(text, "you");
  const t = addMsg("…", "kwame typing");
  try {
    const r = await fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const d = await r.json();
    t.textContent = d.reply;
  } catch (e) {
    t.textContent = "Couldn't reach Kwame.";
  }
  t.classList.remove("typing");
  log.scrollTop = log.scrollHeight;
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;
  input.value = "";
  ask(v);
});
fetch("/api/status").then((r) => r.json()).then((d) => {
  const s = document.getElementById("status");
  s.textContent = d.baobab ? "● BAOBAB LIVE" : "○ BAOBAB DOWN";
  s.className = d.baobab ? "ok" : "down";
}).catch(() => {});
addMsg("I speak Baobab — ask me about markets. Try “how's the naira” or “what's moving”.", "kwame");
