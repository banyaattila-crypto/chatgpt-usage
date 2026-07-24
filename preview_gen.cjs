// Generate a real PNG preview of the chart with the new accelerating (quadratic) plan curve.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const code = m[1];

function makeEl(id){
  return {
    id, _children:[], _html:"", style:{},
    classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},toggle(c,v){v?this._s.add(c):this._s.delete(c);}},
    hidden:false, textContent:"",
    set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
    appendChild(c){this._children.push(c);}, addEventListener(){}, setAttribute(){},
    closest(){return makeEl("closest");}, focus(){},
  };
}
const els={}; function getEl(id){if(!els[id])els[id]=makeEl(id);return els[id];}
const document={getElementById:(id)=>getEl(id),createElement:()=>makeEl("dyn"),addEventListener:()=>{},hidden:false,documentElement:makeEl("html")};
const lsStore={}; const localStorage={getItem:(k)=>(k in lsStore?lsStore[k]:null),setItem:(k,v)=>{lsStore[k]=String(v);}};
// Simulate "today" so the MA marker sits at an interesting spot (e.g. 70% through cycle)
const baseNow = new Date();
const sandbox={document,localStorage,console,Date,Math,JSON,Object,Array,setTimeout,parseFloat,isNaN,alert:()=>{},
  performance:{now:()=>Date.now()},requestAnimationFrame:()=>1,Notification:undefined,navigator:{},window:{}};
sandbox.window=sandbox;
vm.runInNewContext(code, sandbox, {timeout:5000});

// Wrap the chart SVG into a standalone svg file (copy defs/structure from the page)
const chartHTML = getEl("chart").innerHTML;
const svgOuter = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="840" height="440">
<rect x="0" y="0" width="420" height="220" fill="#070b16"/>
${chartHTML}
</svg>`;
const svgPath = path.join(__dirname, "preview_new.svg");
fs.writeFileSync(svgPath, svgOuter);
try {
  execSync(`rsvg-convert -w 840 -h 440 "${svgPath}" -o "${path.join(__dirname,"preview_new.png")}"`);
  console.log("PNG_OK: preview_new.png");
} catch(e){
  console.error("rsvg hiba:", e.message);
}
