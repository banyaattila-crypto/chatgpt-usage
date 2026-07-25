const fs = require("fs");
const { JSDOM } = require("jsdom");

let html = fs.readFileSync("index.html", "utf8");
// CSS/LINK eltavolitasa a tesztnel (jsdom nem birja a backdrop-filter stb.)
html = html.replace(/<link[^>]*>/g, "").replace(/<style>[\s\S]*?<\/style>/g, "");

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://chatgptusage.vercel.app/",
  beforeParse(window) {
    window.fetch = (url, opts) => {
      if (String(url).includes("/load")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data: { realPct: 10, anchor: 2, history: { "2026-7-20": 5 }, notify: false } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    };
    window.addEventListener("error", (e) => {
      errors.push("WINDOW ERROR: " + (e.error ? e.error.stack : e.message));
    });
    window.addEventListener("unhandledrejection", (e) => {
      errors.push("UNHANDLED REJECTION: " + (e.reason ? (e.reason.stack || e.reason.message) : "ismeretlen"));
    });
  },
});

const win = dom.window;
setTimeout(() => {
  const card = win.document.querySelector(".card");
  const chart = win.document.getElementById("chart");
  const bubbles = chart ? chart.querySelectorAll("circle").length : 0;
  const errPanel = win.document.getElementById("errPanel");
  const errText = errPanel ? errPanel.textContent : "(nincs errPanel)";
  console.log("=== EREDMENY (jsdom, CSS nelkul) ===");
  console.log("card elem:    ", card ? "VAN" : "NINCS");
  console.log("chart svg:     ", chart ? "VAN" : "NINCS");
  console.log("buborek szam: ", bubbles);
  console.log("errPanel text: ", JSON.stringify(errText));
  console.log("hibak szama:  ", errors.length);
  errors.forEach((e, i) => console.log(`  [${i + 1}] ${e}`));
  if (errors.length === 0 && card) console.log("\n✅ MUKODIK (jsdom szerint)");
  else if (errors.length > 0) console.log("\n❌ HIBA VAN (lent)");
  else console.log("\n⚠️ Nincs hiba, de az oldal ures");
  process.exit(0);
}, 1500);

