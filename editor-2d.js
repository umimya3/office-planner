/* 2Dキャンバス状態・描画（備品特殊描画・端点アイコン統合）・マウス/ズーム/パン・ルーラー・部屋外管理 */
'use strict';

let roomW = 8.24, roomH = 5.70;
const BASE_SCALE = 60;
const LS_KEY = 'op_v4';
const SNAP = 0.1;
const MAX_MARGIN = 50;
const MIN_SCALE = 4, MAX_SCALE = 220, MAX_CANVAS_PX = 12000, MAX_CANVAS_AREA = 30e6;

const LINE_TYPES = [
  {id:'electric', label:'電気配線', color:'#ffcc00', dash:[],    width:2},
  {id:'lan',      label:'LAN',      color:'#4488ff', dash:[],    width:2},
  {id:'phone',    label:'電話線',   color:'#ff8844', dash:[6,4], width:2},
  {id:'water',    label:'給排水',   color:'#44ddff', dash:[],    width:2},
  {id:'gas',      label:'ガス',     color:'#ff6666', dash:[8,4], width:2},
  {id:'wall_line',label:'壁線',     color:'#8899bb', dash:[],    width:3},
  {id:'dim',      label:'寸法線',   color:'#aaaaaa', dash:[4,4], width:1},
  {id:'custom',   label:'カスタム', color:'#ffffff', dash:[],    width:2},
];

let objects = [];
let lines   = [];
let selectedIds = new Set();
let selectedLineIds = new Set();
let nextId = 1;
let scale  = BASE_SCALE;
let workMargin = 3;

let showGridFine   = true;
let showGridCoarse = true;
let showLabels     = true;
let showLblName    = true;
let showLblId      = false;
let showLblNote    = false;
let viewMono       = false;
let opPrinting     = false;
let useSnap        = true;

const VIEW_KEY = 'op_view_v1';
(function(){
  try{
    const s = JSON.parse(localStorage.getItem(VIEW_KEY)||'null');
    if(s && typeof s === 'object'){
      if(typeof s.name === 'boolean') showLblName = s.name;
      if(typeof s.id   === 'boolean') showLblId   = s.id;
      if(typeof s.note === 'boolean') showLblNote = s.note;
      if(typeof s.mono === 'boolean') viewMono    = s.mono;
    }
  }catch(e){}
})();
function saveViewPrefs(){
  try{ localStorage.setItem(VIEW_KEY, JSON.stringify({name:showLblName,id:showLblId,note:showLblNote,mono:viewMono})); }catch(e){}
}

let clipboard = [];
let dragging = false, dragOffsets = [], dragMoved = false;

let lineMode = false;
let currentLineType = LINE_TYPES[0];
let lineWidth = 2, lineColor = '#ffcc00', lineDash = [];
let drawingLine = null, hoverPt = null;
let draggingLine = false, dragLineId = null, dragLineEnd = null, dragLineOff = {x:0,y:0};

// ルーラー状態
let rulerMode = false, rulerP1 = null, rulerP2 = null, rulerHover = null;
window._opInRuler = () => rulerMode;
window._opRulerOff = () => { if(rulerMode) toggleRuler(); };

const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');

function orgPx(){ return workMargin * scale; }
function mToPx(m){ return m * scale; }
function pxToM(px){ return px / scale; }
function snapM(m){ return useSnap ? Math.round(m / SNAP) * SNAP : m; }

function opIdKey(s){
  try{ return String(s==null?'':s).normalize('NFKC').trim().toUpperCase(); }
  catch(e){ return String(s||'').trim().toUpperCase(); }
}
function opDupIdMap(){
  const m = new Map();
  for(const o of objects){ const k = opIdKey(o.itemId); if(k) m.set(k,(m.get(k)||0)+1); }
  return m;
}
function monoGray(hex){
  let c = String(hex||'#888').replace('#','');
  if(c.length===3) c = c.split('').map(x=>x+x).join('');
  const r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
  const L = isFinite(r+g+b) ? (0.299*r+0.587*g+0.114*b)/255 : 0.5;
  const v = Math.round(255*(0.62+0.33*L));
  return 'rgb('+v+','+v+','+v+')';
}
const MONO_DASH = {electric:[], lan:[7,3], phone:[2,3], water:[9,3,2,3], gas:[13,4], wall_line:[], dim:[1,3]};

function resizeCanvas(){
  canvas.width  = Math.round((roomW + 2*workMargin) * scale);
  canvas.height = Math.round((roomH + 2*workMargin) * scale);
  draw();
}

// ─── 描画メイン ──────────────────────────────────────────────
function draw(){
  const EX = window._opExp || null;
  const W = EX ? EX.W : canvas.width, H = EX ? EX.H : canvas.height;
  if(EX) ctx.setTransform(EX.pr,0,0,EX.pr,-EX.ox*EX.pr,-EX.oy*EX.pr);
  else ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0, 0, W, H);
  if(typeof window._opFixLayerIds === 'function') window._opFixLayerIds();

  const isLight = document.body.classList.contains('light-mode') || viewMono;
  const org = orgPx();
  const RW = mToPx(roomW), RH = mToPx(roomH);
  const mono = viewMono;

  ctx.fillStyle = mono ? '#ffffff' : (isLight ? '#dfe5ee' : '#05070b');
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(org, org);
  ctx.fillStyle = (mono||isLight) ? '#ffffff' : '#0b0d14';
  ctx.fillRect(0, 0, RW, RH);

  const X0 = -org, Y0 = -org, X1 = W - org, Y1 = H - org;
  const gridLines = (step)=>{
    ctx.beginPath();
    for(let x=Math.ceil(X0/step)*step; x<=X1; x+=step){ ctx.moveTo(x,Y0); ctx.lineTo(x,Y1); }
    for(let y=Math.ceil(Y0/step)*step; y<=Y1; y+=step){ ctx.moveTo(X0,y); ctx.lineTo(X1,y); }
    ctx.stroke();
  };
  if(showGridFine && mToPx(0.1) >= 3){
    ctx.strokeStyle = mono ? '#eeeeee' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.03)');
    ctx.lineWidth = .5; gridLines(mToPx(0.1));
  }
  if(showGridCoarse){
    const s = mToPx(1);
    ctx.strokeStyle = mono ? '#cccccc' : (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.09)');
    ctx.lineWidth = .8; gridLines(s);
    if(s >= 14){
      const fs = Math.max(8, scale * 0.11);
      ctx.fillStyle = mono ? 'rgba(0,0,0,0.5)' : (isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.15)');
      ctx.font = `${fs}px monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for(let i=0; i * s < RW; i++) ctx.fillText(i+'m', i*s+2, 2);
      ctx.textAlign = 'right';
      for(let i=1; i * s < RH; i++) ctx.fillText(i+'m', RW-2, i*s+2);
    }
  }

  ctx.strokeStyle = mono ? '#000000' : (isLight ? '#3182ce' : '#5b8cff');
  ctx.lineWidth = mono ? 2.5 : 2;
  ctx.strokeRect(0, 0, RW, RH);
  ctx.fillStyle = mono ? 'rgba(0,0,0,.7)' : (isLight ? 'rgba(49,130,206,.6)' : 'rgba(91,140,255,.6)');
  const fs2 = Math.max(9, scale * 0.13);
  ctx.font = `bold ${fs2}px 'Segoe UI',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(`${roomW}m × ${roomH}m`, RW/2, RH-3);

  const vis = (lid, def)=> (typeof isLayerVisible === 'function') ? isLayerVisible(lid || def) : true;
  for(const ln of lines){ if(vis(ln.layerId,5)) drawLine(ln, selectedLineIds.has(ln.id)); }

  if(!opPrinting && lineMode && drawingLine && hoverPt){
    const lt = currentLineType;
    ctx.strokeStyle = lt.color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineDash.length ? lineDash : lt.dash);
    ctx.globalAlpha = .6;
    ctx.beginPath();
    ctx.moveTo(mToPx(drawingLine.x1), mToPx(drawingLine.y1));
    ctx.lineTo(mToPx(hoverPt.x), mToPx(hoverPt.y));
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  for(const obj of objects){ if(vis(obj.layerId,1)) drawObject(obj); }
  for(const obj of objects){ if(vis(obj.layerId,1) && selectedIds.has(obj.id)) drawSelHandle(obj); }

  const HITS = window._opHits;
  if(!opPrinting && HITS && HITS.size){
    ctx.save(); ctx.globalAlpha = .62; ctx.fillStyle = (mono||isLight) ? '#ffffff' : '#0b0d14';
    ctx.fillRect(X0, Y0, X1-X0, Y1-Y0); ctx.restore();
    for(const obj of objects){ if(HITS.has(obj.id) && vis(obj.layerId,1)) drawObject(obj); }
    for(const obj of objects){
      if(!HITS.has(obj.id) || !vis(obj.layerId,1)) continue;
      const pw=mToPx(obj.w), ph=mToPx(obj.h);
      ctx.save(); ctx.translate(mToPx(obj.x)+pw/2, mToPx(obj.y)+ph/2); ctx.rotate((obj.rot||0)*Math.PI/180);
      ctx.setLineDash([]); ctx.strokeStyle = '#ff2d6f'; ctx.lineWidth = 3; ctx.strokeRect(-pw/2-6, -ph/2-6, pw+12, ph+12);
      ctx.globalAlpha = .45; ctx.lineWidth = 1.5; ctx.strokeRect(-pw/2-12, -ph/2-12, pw+24, ph+24);
      ctx.restore();
    }
  }
  if(!opPrinting){
    drawRulerOnCanvas();
    if(typeof window._opDrawOverlays === 'function') window._opDrawOverlays();
  }
  ctx.restore();
}
window.patchedDraw = draw;

// ─── 配線と端点アイコン描画 ──────────────────────────────────
const ENDPOINT_SHAPES = {
  electric: (c,x,y,r,col)=>{
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle='rgba(30,30,30,0.85)'; c.fill();
    c.strokeStyle=col; c.lineWidth=1.2; c.stroke();
    c.fillStyle=col; c.fillRect(x-r*0.25, y-r*0.6, r*0.22, r*0.55); c.fillRect(x-r*0.25, y+r*0.1, r*0.22, r*0.22);
    c.beginPath(); c.arc(x+r*0.4, y, r*0.17, 0,Math.PI*2); c.fill();
  },
  lan: (c,x,y,r,col)=>{
    c.fillStyle='rgba(20,20,50,0.85)'; c.strokeStyle=col; c.lineWidth=1.2;
    c.beginPath(); c.roundRect?c.roundRect(x-r,y-r*0.75,r*2,r*1.5,2):c.rect(x-r,y-r*0.75,r*2,r*1.5);
    c.fill(); c.stroke(); c.fillStyle=col;
    for(let i=0;i<4;i++) c.fillRect(x-r*0.7+i*r*0.45, y-r*0.6, r*0.18, r*0.55);
  },
  phone: (c,x,y,r,col)=>{
    c.fillStyle='rgba(40,20,10,0.85)'; c.strokeStyle=col; c.lineWidth=1.2;
    c.beginPath(); c.roundRect?c.roundRect(x-r*0.8,y-r*0.65,r*1.6,r*1.3,2):c.rect(x-r*0.8,y-r*0.65,r*1.6,r*1.3);
    c.fill(); c.stroke(); c.fillStyle=col;
    for(let i=0;i<3;i++) c.fillRect(x-r*0.5+i*r*0.45, y-r*0.5, r*0.16, r*0.4);
  },
  water: (c,x,y,r,col)=>{
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle='rgba(0,30,50,0.85)'; c.fill();
    c.strokeStyle=col; c.lineWidth=1.2; c.stroke(); c.lineWidth=1.5;
    c.beginPath(); c.moveTo(x-r*0.55,y); c.lineTo(x+r*0.55,y); c.stroke();
    c.beginPath(); c.moveTo(x,y-r*0.55); c.lineTo(x,y+r*0.55); c.stroke();
  },
  gas: (c,x,y,r,col)=>{
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle='rgba(40,10,0,0.85)'; c.fill();
    c.strokeStyle=col; c.lineWidth=1.2; c.stroke(); c.fillStyle=col;
    c.beginPath(); c.moveTo(x,y+r*0.55); c.quadraticCurveTo(x-r*0.5,y,x,y-r*0.55);
    c.quadraticCurveTo(x+r*0.5,y,x,y+r*0.55); c.fill();
  },
  custom: (c,x,y,r,col)=>{ c.beginPath(); c.arc(x,y,r*0.6,0,Math.PI*2); c.fillStyle=col; c.fill(); },
};
ENDPOINT_SHAPES.outlet = ENDPOINT_SHAPES.electric;

const MONO_CODE = {electric:'電',outlet:'電',lan:'L',phone:'T',water:'水',gas:'ガ'};
function monoEndpoint(type){
  return (c,x,y,r)=>{
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fillStyle='#fff'; c.fill(); c.strokeStyle='#000'; c.lineWidth=1.6; c.stroke();
    c.fillStyle='#000'; c.font='bold '+Math.round(r*1.1)+"px 'Segoe UI','Yu Gothic',sans-serif"; c.textAlign='center'; c.textBaseline='middle';
    c.fillText(MONO_CODE[type]||'●',x,y+0.5);
  };
}

function drawLine(ln, selected){
  const x1=mToPx(ln.x1), y1=mToPx(ln.y1), x2=mToPx(ln.x2), y2=mToPx(ln.y2);
  const mono=viewMono, sel=selected && !opPrinting;
  ctx.save();
  ctx.strokeStyle = mono ? '#000' : (ln.color || '#fff');
  ctx.lineWidth   = mono ? Math.max(ln.typeId==='wall_line'?3:1.6, ln.width||2) : (ln.width || 2);
  ctx.setLineDash(mono ? (MONO_DASH[ln.typeId]!==undefined ? MONO_DASH[ln.typeId] : (ln.dash||[])) : (ln.dash || []));
  if(sel){ ctx.shadowColor=ln.color||'#fff'; ctx.shadowBlur=8; }
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.setLineDash([]); ctx.shadowBlur=0;

  if(sel){
    for(const [ex,ey] of [[x1,y1],[x2,y2]]){
      ctx.fillStyle='#fff'; ctx.strokeStyle=ln.color||'#5b8cff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(ex,ey,5,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }
  }
  if(showLabels && ln.label){
    ctx.font='10px Segoe UI';
    ctx.fillStyle = mono ? '#000' : (document.body.classList.contains('light-mode') ? 'rgba(0,0,0,.7)' : 'rgba(255,255,255,.7)');
    ctx.textAlign='center'; ctx.textBaseline='bottom';
    ctx.fillText(ln.label, (x1+x2)/2, (y1+y2)/2-3);
  }

  const epType = ln.epOverride || ln.typeId;
  const drawEP = ENDPOINT_SHAPES[epType];
  if(drawEP && (ln.showEndpoints || selected || ln.ep1 || ln.ep2)){
    const r = Math.max(7, mToPx(0.1));
    const col = mono ? '#000' : (ln.color||'#fff');
    const fn = mono ? monoEndpoint(epType) : drawEP;
    if(ln.ep1!==false) fn(ctx, x1, y1, r, col);
    if(ln.ep2!==false) fn(ctx, x2, y2, r, col);
  }
  ctx.restore();
}

function opLabelLines(obj){
  const out=[];
  if(showLblName){ const n=obj.label||obj.defName||''; if(n) out.push({t:n,k:'name'}); }
  if(showLblId && obj.itemId) out.push({t:obj.itemId,k:'id'});
  if(showLblNote && obj.note) out.push({t:obj.note,k:'note'});
  if(!out.length && showLblId && !showLblName && !showLblNote) out.push({t:'（ID未設定）',k:'none'});
  return out;
}

// ─── オブジェクト描画（特殊備品シンボル統合） ────────────────
function drawObject(obj){
  const px=mToPx(obj.x), py=mToPx(obj.y), pw=mToPx(obj.w), ph=mToPx(obj.h);
  const cx=px+pw/2, cy=py+ph/2, rad=(obj.rot||0)*Math.PI/180;
  const sel = selectedIds.has(obj.id) && !opPrinting;
  const isLight = document.body.classList.contains('light-mode') || viewMono;
  const mono = viewMono;

  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(rad);
  if(sel){ ctx.shadowColor=isLight?'rgba(49,130,206,0.5)':'#5b8cff'; ctx.shadowBlur=14; }

  const color = obj.color||'#888';
  const monoF = mono ? monoGray(color) : null;
  const fillC = (a)=> mono ? (a<=0.4 ? 'rgb(244,244,244)' : monoF) : hexA(color,a);
  const edgeC = (a)=> mono ? '#111' : hexA(color,a);

  if(obj.isSpawn||/人物スポーン/.test(obj.defName||'')){
    ctx.setLineDash([4,3]); ctx.strokeStyle='#ff9800'; ctx.lineWidth=2;
    ctx.fillStyle='rgba(255,152,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0,0,pw/2,ph/2,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=isLight?'#b45309':'#ffb74d';
    ctx.font=`bold ${Math.max(10,Math.min(pw,ph)*0.48)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('👤',0,1);
    ctx.restore(); return;
  }
  if(obj.doorArc){
    ctx.strokeStyle=edgeC(.9); ctx.lineWidth=2; ctx.fillStyle=fillC(.25);
    ctx.beginPath(); ctx.arc(-pw/2,-ph/2,pw,0,Math.PI/2); ctx.lineTo(-pw/2,-ph/2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle=mono?'#333':hexA(color,.7);
    roundRect(ctx,-pw/2,-ph/2,pw,ph*0.06,2); ctx.fill();
    ctx.restore(); return;
  }
  if(obj.isWindow){
    ctx.fillStyle=fillC(.35); ctx.strokeStyle=edgeC(.9); ctx.lineWidth=1.5;
    ctx.fillRect(-pw/2,-ph/2,pw,ph); ctx.strokeRect(-pw/2,-ph/2,pw,ph);
    ctx.strokeStyle=edgeC(.6); ctx.lineWidth=.8;
    for(let i=1;i<4;i++){ const x=-pw/2+pw*i/4; ctx.beginPath(); ctx.moveTo(x,-ph/2); ctx.lineTo(x,ph/2); ctx.stroke(); }
    ctx.restore(); return;
  }
  if(obj.isStair){
    ctx.fillStyle=fillC(.5); ctx.strokeStyle=edgeC(.9); ctx.lineWidth=1;
    ctx.fillRect(-pw/2,-ph/2,pw,ph); ctx.strokeRect(-pw/2,-ph/2,pw,ph);
    ctx.strokeStyle=edgeC(.7);
    for(let i=0;i<=8;i++){ const y=-ph/2+ph*i/8; ctx.beginPath(); ctx.moveTo(-pw/2,y); ctx.lineTo(pw/2,y); ctx.stroke(); }
    ctx.restore(); return;
  }

  const edge = sel ? (isLight?'#3182ce':'#fff') : edgeC(.5);
  const ew = sel ? 2.5 : (mono ? 1.6 : 1.5);
  if(obj.round){
    ctx.beginPath(); ctx.ellipse(0,0,pw/2,ph/2,0,0,Math.PI*2);
    ctx.fillStyle=fillC(.82); ctx.fill(); ctx.strokeStyle=edge; ctx.lineWidth=ew; ctx.stroke();
  } else {
    roundRect(ctx,-pw/2,-ph/2,pw,ph,Math.min(5,pw*0.1,ph*0.1));
    ctx.fillStyle=fillC(.82); ctx.fill(); ctx.strokeStyle=edge; ctx.lineWidth=ew; ctx.stroke();
  }
  ctx.shadowBlur=0;

  // 特殊備品シンボル重ね描き
  const nm = obj.name || obj.defName || '';
  if(nm.includes('ドラムリール')||nm.includes('延長コード')) drawDrumReel(pw,ph);
  else if(nm.includes('台車')||nm.includes('かご台車'))     drawDaisha(pw,ph,isLight);
  else if(nm.includes('脚立'))                              drawKyatatsu(pw,ph,isLight);
  else if(nm.includes('カラーコーン'))                      drawCone(pw,ph);
  else if(nm.includes('パレット'))                          drawPallet(pw,ph,isLight);

  if(showLabels && pw>12 && ph>12){
    const ls=opLabelLines(obj), n=ls.length;
    if(n){
      const fsize = n===1 ? Math.max(8,Math.min(pw*0.22, ph*0.35, 15)) : Math.max(7,Math.min(pw*0.2, ph*0.8/n/1.15, 13));
      const maxW=pw-6;
      const main = mono ? '#000' : (isLight ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,.9)');
      const dim  = mono ? '#222' : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,.65)');
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ls.forEach((ln,i)=>{
        ctx.font=`${ln.k==='id'?700:600} ${fsize}px 'Segoe UI','Yu Gothic',sans-serif`;
        ctx.fillStyle = (ln.k==='name'||ln.k==='id') ? main : dim;
        let t=ln.t;
        if(ctx.measureText(t).width>maxW){ while(t.length>1 && ctx.measureText(t+'…').width>maxW) t=t.slice(0,-1); t+='…'; }
        ctx.fillText(t,0,(i-(n-1)/2)*fsize*1.2);
      });
      if(n===1 && ls[0].k==='name' && pw>50 && ph>26){
        ctx.font=`${Math.max(7,fsize*0.7)}px 'Segoe UI',sans-serif`;
        ctx.fillStyle = mono ? '#444' : (isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.38)');
        ctx.fillText(`${obj.w}×${obj.h}m`,0,fsize*0.78);
      }
    }
  }
  ctx.restore();
}

function drawDrumReel(pw,ph){
  const r=Math.min(pw,ph)/2*0.85;
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=r*0.28;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(200,100,0,0.6)'; ctx.beginPath(); ctx.arc(0,0,r*0.35,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=r*0.08;
  for(let i=0;i<4;i++){ const a=i*Math.PI/2; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.35,Math.sin(a)*r*0.35); ctx.lineTo(Math.cos(a)*r*0.72,Math.sin(a)*r*0.72); ctx.stroke(); }
  ctx.fillStyle='rgba(255,255,0,0.8)'; ctx.beginPath(); ctx.arc(r*0.6,0,r*0.1,0,Math.PI*2); ctx.fill();
}
function drawDaisha(pw,ph,isLight){
  ctx.strokeStyle=isLight?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.4)'; ctx.lineWidth=1.5;
  ctx.strokeRect(-pw/2+pw*0.08, -ph/2+ph*0.1, pw*0.84, ph*0.8);
  const wr=Math.min(pw,ph)*0.09;
  for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    ctx.fillStyle='rgba(40,40,40,0.7)'; ctx.beginPath(); ctx.arc(sx*(pw/2-wr*1.1), sy*(ph/2-wr*1.1), wr, 0, Math.PI*2); ctx.fill();
  }
}
function drawKyatatsu(pw,ph,isLight){
  ctx.strokeStyle=isLight?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.5)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-pw/2+pw*0.1, ph/2-ph*0.05); ctx.lineTo(0, -ph/2+ph*0.1); ctx.lineTo(pw/2-pw*0.1, ph/2-ph*0.05); ctx.stroke();
  for(let i=1;i<=3;i++){ const t=i/4, ry=-ph/2+ph*0.1+ph*0.9*t; ctx.beginPath(); ctx.moveTo((-pw/2+pw*0.1)*(1-t),ry); ctx.lineTo((pw/2-pw*0.1)*(1-t),ry); ctx.stroke(); }
}
function drawCone(pw,ph){
  const r=Math.min(pw,ph)/2;
  ctx.fillStyle='rgba(255,102,0,0.7)'; ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-ph/2+ph*0.05); ctx.lineTo(-pw/2+pw*0.1, ph/2-ph*0.1); ctx.lineTo(pw/2-pw*0.1, ph/2-ph*0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=r*0.3;
  ctx.beginPath(); ctx.moveTo(-r*0.35,ph*0.05); ctx.lineTo(r*0.35,ph*0.05); ctx.stroke();
}
function drawPallet(pw,ph,isLight){
  ctx.strokeStyle=isLight?'rgba(100,60,20,0.5)':'rgba(200,160,80,0.4)'; ctx.lineWidth=1;
  for(let i=1;i<3;i++){ const x=-pw/2+pw*i/3; ctx.beginPath(); ctx.moveTo(x,-ph/2); ctx.lineTo(x,ph/2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-pw/2,0); ctx.lineTo(pw/2,0); ctx.stroke();
}

function drawSelHandle(obj){
  if(opPrinting) return;
  const px=mToPx(obj.x), py=mToPx(obj.y), pw=mToPx(obj.w), ph=mToPx(obj.h);
  const isLight = document.body.classList.contains('light-mode');
  ctx.save();
  ctx.translate(px+pw/2,py+ph/2); ctx.rotate((obj.rot||0)*Math.PI/180);
  ctx.setLineDash([4,3]); ctx.strokeStyle=isLight?'#3182ce':'#5b8cff'; ctx.lineWidth=1.5;
  ctx.strokeRect(-pw/2-4,-ph/2-4,pw+8,ph+8);
  ctx.setLineDash([]);
  ctx.fillStyle='#fff'; ctx.strokeStyle=isLight?'#3182ce':'#5b8cff'; ctx.lineWidth=1.5;
  for(const [hx,hy] of [[-pw/2-4,-ph/2-4],[pw/2+4,-ph/2-4],[pw/2+4,ph/2+4],[-pw/2-4,ph/2+4]]){
    ctx.beginPath(); ctx.arc(hx,hy,4,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function roundRect(c,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.arcTo(x+w,y,x+w,y+r,r);
  c.lineTo(x+w,y+h-r); c.arcTo(x+w,y+h,x+w-r,y+h,r);
  c.lineTo(x+r,y+h); c.arcTo(x,y+h,x,y+h-r,r); c.lineTo(x,y+r); c.arcTo(x,y,x+r,y,r);
  c.closePath();
}
function hexA(hex,a){
  hex=hex.replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── ヒットテスト ────────────────────────────────────────────
function canvasPt(e){
  const r=canvas.getBoundingClientRect(), o=orgPx();
  return {x:e.clientX-r.left-o, y:e.clientY-r.top-o};
}
function hitObj(mx,my){
  for(let i=objects.length-1; i>=0; i--){
    const o=objects[i];
    if(typeof isLayerVisible==='function' && !isLayerVisible(o.layerId||1)) continue;
    if(ptInObj(mx,my,o)) return o;
  }
  return null;
}
function ptInObj(mx,my,obj){
  const pw=mToPx(obj.w), ph=mToPx(obj.h), cx=mToPx(obj.x)+pw/2, cy=mToPx(obj.y)+ph/2;
  const rad=-(obj.rot||0)*Math.PI/180, dx=mx-cx, dy=my-cy;
  const lx=dx*Math.cos(rad)-dy*Math.sin(rad), ly=dx*Math.sin(rad)+dy*Math.cos(rad);
  return Math.abs(lx)<=pw/2+5 && Math.abs(ly)<=ph/2+5;
}
function hitLine(mx,my){
  const THRESH=8;
  for(let i=lines.length-1; i>=0; i--){
    const ln=lines[i];
    if(typeof isLayerVisible==='function' && !isLayerVisible(ln.layerId||5)) continue;
    const x1=mToPx(ln.x1),y1=mToPx(ln.y1),x2=mToPx(ln.x2),y2=mToPx(ln.y2);
    if(dist(mx,my,x1,y1)<THRESH) return {ln,end:'p1'};
    if(dist(mx,my,x2,y2)<THRESH) return {ln,end:'p2'};
    if(ptSegDist(mx,my,x1,y1,x2,y2)<THRESH) return {ln,end:'mid'};
  }
  return null;
}
function dist(ax,ay,bx,by){ return Math.sqrt((ax-bx)**2+(ay-by)**2); }
function ptSegDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
  if(len2===0) return dist(px,py,ax,ay);
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
  return dist(px,py,ax+t*dx,ay+t*dy);
}

// ─── ルーラー ────────────────────────────────────────────────
function toggleRuler(){
  rulerMode=!rulerMode;
  if(rulerMode && lineMode) opSetLineMode(false);
  rulerP1=null; rulerP2=null; rulerHover=null;
  const btn=document.getElementById('btn-ruler');
  if(btn){
    btn.style.borderColor=rulerMode?'var(--warn)':'';
    btn.style.color=rulerMode?'var(--warn)':'';
    btn.textContent=rulerMode?'📏 ルーラー [ON]':'📏 ルーラー';
  }
  document.getElementById('sb-mode').textContent=rulerMode?'ルーラーモード':(lineMode?'配線描画モード':'選択モード');
  canvas.style.cursor=rulerMode?'crosshair':'default';
  draw();
}
function drawRulerOnCanvas(){
  if(!rulerMode) return;
  const isLight=document.body.classList.contains('light-mode');
  const color=isLight?'#dd6b20':'#ffb74d';
  if(rulerP1){
    ctx.save(); ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(mToPx(rulerP1.x),mToPx(rulerP1.y),5,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  const endPt=rulerP2||rulerHover;
  if(rulerP1&&endPt){
    const x1=mToPx(rulerP1.x),y1=mToPx(rulerP1.y),x2=mToPx(endPt.x),y2=mToPx(endPt.y);
    const dxM=endPt.x-rulerP1.x, dyM=endPt.y-rulerP1.y, distM=Math.sqrt(dxM*dxM+dyM*dyM);
    ctx.save();
    ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle=color;
    ctx.beginPath(); ctx.arc(x2,y2,5,0,Math.PI*2); ctx.fill();
    const perp=Math.atan2(y2-y1,x2-x1)+Math.PI/2;
    for(const [tx,ty] of [[x1,y1],[x2,y2]]){
      ctx.beginPath(); ctx.moveTo(tx+Math.cos(perp)*8,ty+Math.sin(perp)*8); ctx.lineTo(tx-Math.cos(perp)*8,ty-Math.sin(perp)*8);
      ctx.lineWidth=2; ctx.stroke();
    }
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    const lbl=`${distM.toFixed(2)}m  (↔${Math.abs(dxM).toFixed(2)} ↕${Math.abs(dyM).toFixed(2)})`;
    ctx.font='bold 12px Segoe UI,sans-serif';
    const tw=ctx.measureText(lbl).width;
    ctx.fillStyle=isLight?'rgba(255,255,255,0.92)':'rgba(15,17,23,0.88)';
    ctx.beginPath(); ctx.roundRect?ctx.roundRect(mx-tw/2-5,my-21,tw+10,18,4):ctx.rect(mx-tw/2-5,my-21,tw+10,18); ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(lbl,mx,my-12); ctx.restore();
  }
  if(!rulerP1&&rulerHover){
    const hx=mToPx(rulerHover.x), hy=mToPx(rulerHover.y);
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=1; ctx.globalAlpha=.5;
    ctx.beginPath(); ctx.moveTo(hx-12,hy); ctx.lineTo(hx+12,hy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx,hy-12); ctx.lineTo(hx,hy+12); ctx.stroke(); ctx.restore();
  }
}
document.getElementById('btn-ruler').onclick = toggleRuler;

// ─── マウス・パン・ズーム ────────────────────────────────────
let panState = null, spaceHeld = false;
function restoreCursor(){
  canvas.style.cursor = spaceHeld ? 'grab' : (rulerMode||lineMode) ? 'crosshair' : 'default';
}
canvas.addEventListener('mousedown', e=>{
  if(e.button===1 || (e.button===0 && spaceHeld)){
    const sc=scroller();
    panState={x:e.clientX, y:e.clientY, l:sc.scrollLeft, t:sc.scrollTop};
    canvas.style.cursor='grabbing'; e.preventDefault(); return;
  }
  if(e.button===2) return;
  const pt=canvasPt(e), mx=pt.x, my=pt.y, ctrl=e.ctrlKey||e.metaKey;

  if(rulerMode){
    const sx=snapM(pxToM(mx)), sy=snapM(pxToM(my));
    if(!rulerP1){ rulerP1={x:sx,y:sy}; rulerP2=null; }
    else if(Math.abs(rulerP1.x-sx)<0.01&&Math.abs(rulerP1.y-sy)<0.01){ rulerP1=null; rulerP2=null; }
    else { rulerP2={x:sx,y:sy}; }
    draw(); return;
  }
  if(lineMode){
    const snap={x:snapM(pxToM(mx)), y:snapM(pxToM(my))};
    if(!drawingLine){ drawingLine={x1:snap.x, y1:snap.y}; }
    else {
      const x2=snap.x, y2=snap.y;
      if(dist(mToPx(drawingLine.x1),mToPx(drawingLine.y1),mToPx(x2),mToPx(y2))>4){
        const tid=currentLineType.id;
        const lid=tid==='electric'?3:tid==='lan'?4:tid==='wall_line'?2:5;
        lines.push({
          id:nextId++, x1:drawingLine.x1, y1:drawingLine.y1, x2, y2,
          color:tid==='custom'?lineColor:currentLineType.color,
          width:lineWidth, dash:lineDash.length?lineDash:currentLineType.dash,
          label:currentLineType.label, typeId:tid, layerId:lid,
        });
        updateLineDash(); scheduleSave(); updateCounts();
      }
      drawingLine=null;
    }
    draw(); return;
  }

  const lh=hitLine(mx,my);
  if(lh && !hitObj(mx,my)){
    if(!ctrl){ selectedIds=new Set(); selectedLineIds=new Set(); }
    if(ctrl && selectedLineIds.has(lh.ln.id)) selectedLineIds.delete(lh.ln.id);
    else selectedLineIds.add(lh.ln.id);
    draggingLine=true; dragLineId=lh.ln.id; dragLineEnd=lh.end;
    const ln=lines.find(l=>l.id===lh.ln.id);
    dragLineOff={x:pxToM(mx)-ln.x1, y:pxToM(my)-ln.y1};
    draw(); updatePropPanel(); return;
  }

  const hit=hitObj(mx,my);
  if(hit){
    if(ctrl){
      if(selectedIds.has(hit.id)) selectedIds.delete(hit.id); else selectedIds.add(hit.id);
    } else if(!selectedIds.has(hit.id)){
      selectedIds=new Set([hit.id]);
    }
    selectedLineIds=new Set();
    objects.splice(objects.indexOf(hit),1); objects.push(hit);
    dragging=true; dragMoved=false;
    dragOffsets=[...selectedIds].map(id=>{ const o=objects.find(x=>x.id===id); return {id, ox:pxToM(mx)-o.x, oy:pxToM(my)-o.y}; });
  } else {
    selectedIds=new Set(); selectedLineIds=new Set(); drawingLine=null; dragging=false;
  }
  draw(); updatePropPanel();
});

canvas.addEventListener('mousemove', e=>{
  if(panState) return;
  const pt=canvasPt(e), mx=pt.x, my=pt.y, mxM=pxToM(mx), myM=pxToM(my);
  document.getElementById('sb-pos').textContent=`X:${mxM.toFixed(2)}m Y:${myM.toFixed(2)}m`;
  hoverPt={x:snapM(mxM), y:snapM(myM)};
  if(rulerMode) rulerHover={...hoverPt};

  if(rulerMode||lineMode) canvas.style.cursor='crosshair';
  else if(spaceHeld) canvas.style.cursor='grab';
  else if(hitObj(mx,my)||hitLine(mx,my)) canvas.style.cursor=dragging?'grabbing':'grab';
  else canvas.style.cursor='default';

  if(dragging && dragOffsets.length){
    dragMoved=true;
    for(const {id,ox,oy} of dragOffsets){
      const obj=objects.find(o=>o.id===id); if(!obj) continue;
      obj.x=parseFloat(snapM(mxM-ox).toFixed(3));
      obj.y=parseFloat(snapM(myM-oy).toFixed(3));
    }
    updatePropPanel();
  }
  if(draggingLine && dragLineId!==null){
    const ln=lines.find(l=>l.id===dragLineId);
    if(ln){
      const sx=snapM(mxM), sy=snapM(myM);
      if(dragLineEnd==='p1'){ ln.x1=sx; ln.y1=sy; }
      else if(dragLineEnd==='p2'){ ln.x2=sx; ln.y2=sy; }
      else {
        const dx=mxM-dragLineOff.x-ln.x1, dy=myM-dragLineOff.y-ln.y1;
        ln.x1=snapM(ln.x1+dx); ln.y1=snapM(ln.y1+dy);
        ln.x2=snapM(ln.x2+dx); ln.y2=snapM(ln.y2+dy);
        dragLineOff={x:mxM-ln.x1, y:myM-ln.y1};
      }
    }
  }
  draw();
});

function onUp(){
  if((dragging&&dragMoved)||draggingLine) scheduleSave();
  dragging=false; draggingLine=false; dragLineId=null; dragOffsets=[];
}
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('mouseleave', onUp);

window.addEventListener('mousemove', e=>{
  if(!panState) return;
  const sc=scroller();
  sc.scrollLeft = panState.l - (e.clientX - panState.x);
  sc.scrollTop  = panState.t - (e.clientY - panState.y);
});
window.addEventListener('mouseup', ()=>{ if(panState){ panState=null; restoreCursor(); } });
document.addEventListener('keydown', e=>{
  if(e.code!=='Space') return;
  if(!(e.target===document.body||e.target===canvas||e.target===document.documentElement||e.target===document)) return;
  if(opModalOpen()||opView3D()) return;
  e.preventDefault();
  if(!spaceHeld){ spaceHeld=true; restoreCursor(); }
});
document.addEventListener('keyup', e=>{ if(e.code==='Space' && spaceHeld){ spaceHeld=false; if(!panState) restoreCursor(); } });
window.addEventListener('blur', ()=>{ spaceHeld=false; });

// ─── ズーム & 部屋サイズ & 部屋の外管理 ─────────────────────
function maxScaleFor(){
  const ww = roomW + 2*workMargin, hh = roomH + 2*workMargin;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, MAX_CANVAS_PX/Math.max(ww,hh), Math.sqrt(MAX_CANVAS_AREA/(ww*hh))));
}
function setZoom(z){
  if(!Number.isFinite(z)) z = scale;
  scale = Math.max(MIN_SCALE, Math.min(maxScaleFor(), z));
  document.getElementById('zoom-label').textContent = Math.round(scale/BASE_SCALE*100)+'%';
  resizeCanvas();
}
function scroller(){ return document.getElementById('canvas-scroll') || document.getElementById('canvas-area'); }
function centerOn(wx, wy){
  const sc = scroller(); if(!sc) return;
  sc.scrollLeft = (wx + workMargin) * scale - sc.clientWidth/2;
  sc.scrollTop  = (wy + workMargin) * scale - sc.clientHeight/2;
}
function fitRect(x0, y0, x1, y1){
  const sc = scroller();
  const vw = Math.max(40, sc.clientWidth - 24), vh = Math.max(40, sc.clientHeight - 24);
  setZoom(Math.min(vw/Math.max(0.5, x1-x0), vh/Math.max(0.5, y1-y0)));
  centerOn((x0+x1)/2, (y0+y1)/2);
}
function fitRoom(){ fitRect(0, 0, roomW, roomH); }
function objBounds(o){
  const r=(o.rot||0)*Math.PI/180, c=Math.abs(Math.cos(r)), s=Math.abs(Math.sin(r));
  const hw=o.w/2, hh=o.h/2, cx=o.x+hw, cy=o.y+hh, ex=c*hw+s*hh, ey=s*hw+c*hh;
  return {x0:cx-ex, y0:cy-ey, x1:cx+ex, y1:cy+ey};
}
function unionBounds(list){
  const b={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
  for(const q of list){ b.x0=Math.min(b.x0,q.x0); b.y0=Math.min(b.y0,q.y0); b.x1=Math.max(b.x1,q.x1); b.y1=Math.max(b.y1,q.y1); }
  return b;
}
function clampToWork(b){
  const cx=v=>Math.max(-workMargin, Math.min(roomW+workMargin, v)), cy=v=>Math.max(-workMargin, Math.min(roomH+workMargin, v));
  return {x0:cx(b.x0), y0:cy(b.y0), x1:cx(b.x1), y1:cy(b.y1)};
}
function fitAll(){
  const list=[{x0:0,y0:0,x1:roomW,y1:roomH}];
  for(const o of objects) list.push(objBounds(o));
  for(const l of lines) list.push({x0:Math.min(l.x1,l.x2),y0:Math.min(l.y1,l.y2),x1:Math.max(l.x1,l.x2),y1:Math.max(l.y1,l.y2)});
  const b=clampToWork(unionBounds(list));
  fitRect(b.x0-0.5, b.y0-0.5, b.x1+0.5, b.y1+0.5);
}
document.getElementById('zoom-in').onclick  = ()=>setZoom(scale*1.25);
document.getElementById('zoom-out').onclick = ()=>setZoom(scale/1.25);
document.getElementById('zoom-fit').onclick = fitRoom;
document.getElementById('zoom-all').onclick = fitAll;

canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const sc=scroller(), r=canvas.getBoundingClientRect();
  const wx=(e.clientX-r.left)/scale, wy=(e.clientY-r.top)/scale;
  setZoom(scale * (e.deltaY<0?1.1:0.9));
  const r2=canvas.getBoundingClientRect();
  const dx=(r2.left+wx*scale)-e.clientX, dy=(r2.top+wy*scale)-e.clientY;
  if(Number.isFinite(dx)&&Number.isFinite(dy)){ sc.scrollLeft+=dx; sc.scrollTop+=dy; }
},{passive:false});

function neededMargin(){
  let need=0;
  const up=(lo,hi)=>{ if(lo<0) need=Math.max(need,-lo); if(hi>roomW) need=Math.max(need,hi-roomW); };
  const upY=(lo,hi)=>{ if(lo<0) need=Math.max(need,-lo); if(hi>roomH) need=Math.max(need,hi-roomH); };
  for(const o of objects){ const b=objBounds(o); up(b.x0,b.x1); upY(b.y0,b.y1); }
  for(const l of lines){ up(Math.min(l.x1,l.x2),Math.max(l.x1,l.x2)); upY(Math.min(l.y1,l.y2),Math.max(l.y1,l.y2)); }
  return need>0 ? Math.min(MAX_MARGIN, Math.ceil(need+0.5)) : 0;
}
function syncMarginInput(){ const mi=document.getElementById('work-margin-input'); if(mi) mi.value=workMargin; }
function setWorkMargin(m){
  m = Math.max(0, Math.min(MAX_MARGIN, Math.round(m)));
  m = Math.max(m, neededMargin());
  if(m===workMargin){ syncMarginInput(); return false; }
  const sc=scroller(), oldM=workMargin;
  const cx=(sc.scrollLeft+sc.clientWidth/2)/scale-oldM, cy=(sc.scrollTop+sc.clientHeight/2)/scale-oldM;
  workMargin=m; syncMarginInput(); setZoom(scale);
  if(Number.isFinite(cx)&&Number.isFinite(cy)) centerOn(cx,cy);
  return true;
}
function opEnsureMargin(){ const need=neededMargin(); if(need>workMargin){ setWorkMargin(need); return true; } return false; }
function outsideObjects(){ return objects.filter(o=>{ const cx=o.x+o.w/2, cy=o.y+o.h/2; return cx<0||cy<0||cx>roomW||cy>roomH; }); }
function updateOutsideInfo(){
  if(typeof window._opObjListRefresh==='function') window._opObjListRefresh();
  const el=document.getElementById('outside-count'); if(!el) return;
  const n=outsideObjects().length;
  el.textContent=n+'個'; el.style.color = n ? 'var(--accent)' : '';
  for(const id of ['btn-outside-select','btn-outside-return']){
    const b=document.getElementById(id); if(b){ b.disabled=!n; b.style.opacity=n?'1':'.4'; }
  }
}

function syncRoomInputs(){
  const wi=document.getElementById('room-w-input'), hi=document.getElementById('room-h-input');
  if(wi) wi.value=roomW; if(hi) hi.value=roomH;
  syncMarginInput(); updateRoomArea();
}
function updateRoomArea(){
  const el=document.getElementById('room-area');
  if(el) el.textContent=(roomW*roomH).toFixed(2)+' m²';
}
function onRoomSizeChange(){
  const wi=document.getElementById('room-w-input'), hi=document.getElementById('room-h-input');
  const nw=parseFloat(wi.value), nh=parseFloat(hi.value);
  const okW=Number.isFinite(nw)&&nw>=0.5&&nw<=100, okH=Number.isFinite(nh)&&nh>=0.5&&nh<=100;
  if(okW) roomW=parseFloat(nw.toFixed(2));
  if(okH) roomH=parseFloat(nh.toFixed(2));
  if(!okW||!okH) showToast('部屋サイズは 0.5〜100m の範囲で入力してください');
  syncRoomInputs(); resizeCanvas(); opEnsureMargin(); fitRoom(); scheduleSave();
}
document.getElementById('room-w-input').addEventListener('change', onRoomSizeChange);
document.getElementById('room-h-input').addEventListener('change', onRoomSizeChange);
document.getElementById('work-margin-input').addEventListener('change', e=>{
  const v=parseFloat(e.target.value);
  if(!Number.isFinite(v)){ syncMarginInput(); return; }
  const need=neededMargin(); setWorkMargin(v);
  if(v<need) showToast('部屋の外に置いたものがあるため、余白は '+workMargin+'m 以上になります');
  syncMarginInput(); scheduleSave();
});
document.getElementById('btn-outside-select').onclick=()=>{
  const out=outsideObjects(); if(!out.length) return;
  selectedIds=new Set(out.map(o=>o.id)); selectedLineIds=new Set();
  draw(); updatePropPanel();
  const b=clampToWork(unionBounds(out.map(objBounds)));
  fitRect(b.x0-0.5, b.y0-0.5, b.x1+0.5, b.y1+0.5);
};
document.getElementById('btn-outside-return').onclick=()=>{
  const out=outsideObjects(); if(!out.length) return;
  opWithBackup('部屋の外を戻す前',()=>{
    for(const o of out){
      o.x=parseFloat(Math.max(0, Math.min(roomW-o.w, o.x)).toFixed(3));
      o.y=parseFloat(Math.max(0, Math.min(roomH-o.h, o.y)).toFixed(3));
    }
    draw(); updatePropPanel(); updateCounts(); scheduleSave();
    return true;
  });
  showToast(out.length+'個を部屋の中へ戻しました（📁スロット画面の「直前の状態に戻す」で元に戻せます）',4000);
};

// ─── 表示設定トグル ──────────────────────────────────────────
function mkToggle(id,getter,setter){
  const el=document.getElementById(id);
  el.classList.toggle('on',getter());
  el.addEventListener('click',()=>{ setter(!getter()); el.classList.toggle('on',getter()); draw(); });
}
mkToggle('tgl-grid-fine',  ()=>showGridFine,  v=>{showGridFine=v;});
mkToggle('tgl-grid-coarse',()=>showGridCoarse,v=>{showGridCoarse=v;});
mkToggle('tgl-labels',     ()=>showLabels,    v=>{showLabels=v;});
mkToggle('tgl-lbl-name',   ()=>showLblName,   v=>{showLblName=v;saveViewPrefs();});
mkToggle('tgl-lbl-id',     ()=>showLblId,     v=>{showLblId=v;saveViewPrefs();});
mkToggle('tgl-lbl-note',   ()=>showLblNote,   v=>{showLblNote=v;saveViewPrefs();});
mkToggle('tgl-mono',       ()=>viewMono,      v=>{viewMono=v;saveViewPrefs(); if(v) showToast('白黒印刷モード：このまま印刷（Ctrl+P）すると、選択の枠などを消して白黒向けに出力します',4500);});
mkToggle('tgl-snap',       ()=>useSnap,       v=>{useSnap=v;});

window.addEventListener('beforeprint',()=>{ if(viewMono){ opPrinting=true; draw(); } });
window.addEventListener('afterprint',()=>{ if(opPrinting){ opPrinting=false; draw(); } });