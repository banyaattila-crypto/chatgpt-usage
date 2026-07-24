// Headless smoke test for index.html render()+drawChart()
// Extracts the <script> IIFE, mocks a minimal DOM + localStorage, runs render(),
// and verifies the chart SVG actually gets populated (no JS errors, real content).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("NO SCRIPT BLOCK FOUND"); process.exit(1); }
const code = m[1];

// ---- minimal DOM mock ----
function makeEl(id) {
  return {
    id,
    _children: [],
    _html: "",
    style: {},
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,v){ v?this._s.add(c):this._s.delete(c);} },
    hidden: false,
    textContent: "",
    attributes: {},
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    appendChild(c){ this._children.push(c); },
    addEventListener(){},
    setAttribute(k,v){ this.attributes[k]=v; },
    getAttribute(k){ return this.attributes[k]; },
    closest(){ return makeEl("closest"); },
    focus(){},
  };
}

const els = {};
function getEl(id){ if(!els[id]) els[id]=makeEl(id); return els[id]; }

const document = {
  getElementById: (id) => getEl(id),
  createElement: () => makeEl("dyn"),
  createElementNS: () => makeEl("dynNS"),
  querySelector: () => null,
  addEventListener: () => {},
  hidden: false,
  documentElement: makeEl("html"),
};

const localStorageStore = {};
const localStorage = {
  getItem: (k) => (k in localStorageStore ? localStorageStore[k] : null),
  setItem: (k, v) => { localStorageStore[k] = String(v); },
};

const sandbox = {
  document, localStorage, console,
  Date, Math, JSON, Object, Array, setTimeout, parseFloat, isNaN, alert: () => {},
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => { try { cb(performance.now()); } catch(e){} return 1; },
  Notification: undefined,
  navigator: {},
  window: {},
  fetch: () => Promise.resolve({ ok: true }),
};
sandbox.window = sandbox;

let threw = null;
try {
  vm.runInNewContext(code, sandbox, { timeout: 5000 });
} catch (e) {
  threw = e;
}

if (threw) {
  console.error("RENDER THREW:", threw && threw.stack ? threw.stack : threw);
  process.exit(2);
}

const chart = getEl("chart");
const daygrid = getEl("daygrid");
const bigPct = getEl("bigPct");

// bubbles group check (ensureBubbles creates #bubbles inside chart svg)
const bubblesGroup = chart._children.find(ch => ch.attributes && ch.attributes.id === "bubbles");
const bubbleCircles = bubblesGroup ? bubblesGroup._children : [];
// after one rAF tick, circles should have a cx attribute set
const movedCircles = bubbleCircles.filter(c => c.attributes && typeof c.attributes.cx !== "undefined" && typeof c.attributes.cy !== "undefined");

console.log("=== RESULTS ===");
console.log("no JS error:         ", threw === null);
console.log("bigPct populated:    ", bigPct.innerHTML.length > 0, "->", bigPct.innerHTML.slice(0,40));
console.log("daygrid children:    ", daygrid._children.length);
console.log("chart SVG length:    ", chart.innerHTML.length);
console.log("chart has <path>:    ", chart.innerHTML.includes("<path"));
console.log("chart has <circle>:  ", chart.innerHTML.includes("<circle"));
console.log("chart has planned L: ", chart.innerHTML.includes("L24.0") || chart.innerHTML.includes("M28"));
console.log("bubbles group exists:", bubblesGroup !== undefined);
console.log("bubble circles:      ", bubbleCircles.length, "(should be 30)");
console.log("circles with cx set: ", movedCircles.length, "(after 1 tick)");

if (chart.innerHTML.length > 0 && chart.innerHTML.includes("<path") && daygrid._children.length === 7
    && bubblesGroup && bubbleCircles.length >= 28 && movedCircles.length >= 28) {
  console.log("\nPASS: grafikon, napi racs es uszo pontok (gyorsulo) is renderelodtek.");
  process.exit(0);
} else {
  console.error("\nFAIL: valami nem renderelodott.");
  process.exit(3);
}
