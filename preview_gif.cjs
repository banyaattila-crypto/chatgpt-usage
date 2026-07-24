// Generate an animated preview (GIF) of the chart with flowing bubble points.
// We re-implement the bubble math (same as drawBubbles) and compute cx at each frame time,
// then render static SVG frames and pipe to ffmpeg -> GIF.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const code = m[1];

function makeEl(id){
  return { id, _children:[], _html:"", style:{}, classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},toggle(c,v){v?this._s.add(c):this._s.delete(c);}},
    hidden:false, textContent:"", attributes:{}, set innerHTML(v){this._html=v;}, get innerHTML(){return this._html;},
    appendChild(c){this._children.push(c);}, addEventListener(){}, setAttribute(k,v){this.attributes[k]=v;}, getAttribute(k){return this.attributes[k];},
    closest(){return makeEl("closest");}, focus(){} };
}
const els={}; function getEl(id){if(!els[id])els[id]=makeEl(id);return els[id];}
const document={getElementById:(id)=>getEl(id),createElement:()=>makeEl("dyn"),createElementNS:()=>makeEl("dynNS"),addEventListener:()=>{},hidden:false,documentElement:makeEl("html")};
const lsStore={}; const localStorage={getItem:(k)=>(k in lsStore?lsStore[k]:null),setItem:(k,v)=>{lsStore[k]=String(v);}};
const sandbox={document,localStorage,console,Date,Math,JSON,Object,Array,setTimeout,parseFloat,isNaN,alert:()=>{},performance:{now:()=>Date.now()},requestAnimationFrame:()=>1,Notification:undefined,navigator:{},window:{}};
sandbox.window=sandbox;
vm.runInNewContext(code, sandbox, {timeout:5000});

const chartHTML = getEl("chart").innerHTML;

// --- bubble math (mirror of drawBubbles) ---
const W=420,H=220,padL=28,padR=12,padT=16,padB=26;
const x0=padL,x1=W-padR,y0=H-padB,y1=padT;
const waves = [
  { n: 5, yFrac: 0.78, r: 2.2, dur: 9,  op: 0.55, color: "#ffc857" },
  { n: 4, yFrac: 0.52, r: 1.8, dur: 12, op: 0.45, color: "#34d399" },
  { n: 6, yFrac: 0.30, r: 1.5, dur: 7.5, op: 0.40, color: "#7dd3fc" },
];
function bubblePositions(tSec){
  const pts=[];
  waves.forEach(w=>{
    const y = y1 + (y0 - y1) * w.yFrac;
    for(let i=0;i<w.n;i++){
      const begin = -(w.dur * i / w.n);
      let local = (tSec - begin) % w.dur; if(local<0) local += w.dur;
      const frac = local / w.dur;             // 0..1 across
      const cx = x0 + (x1 - x0) * frac;
      // opacity envelope 0;.12;0.85;1 -> fade in/out at edges
      let op = w.op;
      if(frac < 0.12) op = w.op * (frac/0.12);
      else if(frac > 0.85) op = w.op * ((1-frac)/0.15);
      pts.push({cx, y, r:w.r, op, color:w.color});
    }
  });
  return pts;
}

const FRAMES=40, DUR_PER_FRAME=0.15; // 6s loop
const frameFiles=[];
for(let f=0; f<FRAMES; f++){
  const t = f * DUR_PER_FRAME;
  const bubbles = bubblePositions(t).map(p=>`<circle cx="${p.cx.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r}" fill="${p.color}" opacity="${p.op.toFixed(2)}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="840" height="440">
<rect x="0" y="0" width="420" height="220" fill="#070b16"/>
${chartHTML}
${bubbles}
</svg>`;
  const fp = path.join(__dirname, `frame_${String(f).padStart(2,"0")}.svg`);
  fs.writeFileSync(fp, svg);
  frameFiles.push(fp);
}
// concat frames into a GIF via ffmpeg (read each SVG as PNG first using rsvg-convert)
const pngFiles = [];
frameFiles.forEach((fp,i)=>{
  const pp = path.join(__dirname, `frame_${String(i).padStart(2,"0")}.png`);
  execSync(`rsvg-convert -w 840 -h 440 "${fp}" -o "${pp}"`);
  pngFiles.push(pp);
});
const listFile = path.join(__dirname, "frames_list.txt");
fs.writeFileSync(listFile, pngFiles.map(p=>`file '${p}'`).join("\n"));
const gifPath = path.join(__dirname, "preview_bubbles.gif");
execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -vf "fps=20,scale=420:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}"`, {stdio:"ignore"});
console.log("GIF_OK:", gifPath, fs.statSync(gifPath).size, "bytes");
// cleanup
frameFiles.concat(pngFiles, [listFile]).forEach(f=>fs.unlinkSync(f));
