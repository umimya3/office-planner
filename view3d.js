/* 2D/3D ビュー切替 + Three.js 3Dエンジン + 時間帯照明 + 在室シミュレーション + テーマ同期 */
(function(){
'use strict';

// ─── HTML注入: ビュータブ (ヘッダーに) ──────────────────────
const header = document.getElementById('header');
const viewTabs = document.createElement('div');
viewTabs.id = 'view-mode-tabs';
viewTabs.innerHTML = `
  <button class="view-tab active" id="tab-2d">🗺 2D編集</button>
  <button class="view-tab" id="tab-3d">🏢 3D表示</button>
`;
const spacer = header.querySelector('.spacer');
if(spacer) header.insertBefore(viewTabs, spacer.nextSibling);
else header.prepend(viewTabs);

// ─── HTML注入: 3Dビューコンテナ ─────────────────────────────
const canvasArea = document.getElementById('canvas-area');
const view3d = document.createElement('div');
view3d.id = 'view-3d';
const appInfo = window._opAppInfo || {};
const verHtml = appInfo.version ? `<br><span style="opacity:.4;">${appInfo.version} · ${appInfo.updated||''}</span>` : '';
view3d.innerHTML = `
  <div id="loading-3d">3D空間を構築中...</div>
  <div id="three-canvas-host"></div>
  <div id="panel-3d">
    <div id="panel-3d-head">表示レイヤー</div>
    <label class="ly3d-row"><input type="checkbox" id="ly3-furn" checked><span class="ly3d-swatch" style="background:#4a90d9"></span>家具・備品</label>
    <label class="ly3d-row"><input type="checkbox" id="ly3-outlet"><span class="ly3d-swatch" style="background:#e0e060"></span>コンセント</label>
    <label class="ly3d-row"><input type="checkbox" id="ly3-comment"><span class="ly3d-swatch" style="background:#ffab91"></span>付箋・メモ</label>
    <label class="ly3d-row"><input type="checkbox" id="ly3-line"><span class="ly3d-swatch" style="background:#f08e33"></span>配線</label>
    <label class="ly3d-row"><input type="checkbox" id="ly3-person" checked><span class="ly3d-swatch" style="background:#e67e22"></span>シム人物</label>
    <label class="ly3d-row"><input type="checkbox" id="ly3-label"><span class="ly3d-swatch" style="background:#c9d2de"></span>常時ラベル</label>
    <div id="panel-3d-head" style="border-top:1px solid #2c3542;">時間帯・照明</div>
    <div id="tod-3d-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px 10px 8px;">
      <button class="btn3d tod3d" data-tod="morning" style="padding:5px 4px;font-size:11px;">🌅 朝</button>
      <button class="btn3d tod3d active" data-tod="noon" style="padding:5px 4px;font-size:11px;">☀ 昼</button>
      <button class="btn3d tod3d" data-tod="evening" style="padding:5px 4px;font-size:11px;">🌇 夕方</button>
      <button class="btn3d tod3d" data-tod="night" style="padding:5px 4px;font-size:11px;">🌙 夜</button>
    </div>
    <div class="note3d"><b>ⓘ この3D表示について</b><br>・高さは名前からの推定値です（半透明の物は、大きさから推定）<br>・人の動きは演出で、通れるかの検証ではありません<br>・2Dで非表示にしたレイヤーも表示します<br>・この画面では編集できません</div>
  </div>
  <div id="ctrl-3d">
    <button class="btn3d active" id="btn3d-orbit">🔄 3Dビュー</button>
    <button class="btn3d" id="btn3d-top">⬇ 上から</button>
    <button class="btn3d" id="btn3d-reset">🎯 視点リセット</button>
    <button class="btn3d" id="btn3d-sim">🚶 在室シミュレーション</button>
  </div>
  <div id="sim-3d">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <span id="sim3d-clock" title="09:00">09:00</span>
      <span style="color:#5b6472;font-size:10px;">9:00–18:00</span>
    </div>
    <input type="range" id="sim3d-slider" min="0" max="540" step="1" value="0">
    <div id="sim3d-controls">
      <button class="btn3d active" id="btn3d-play">⏸ 一時停止</button>
    </div>
    <div class="spd3d">
      <button class="btn3d" data-spd="0.5">0.5x</button>
      <button class="btn3d active" data-spd="1">1x</button>
      <button class="btn3d" data-spd="2">2x</button>
      <button class="btn3d" data-spd="4">4x</button>
      <button class="btn3d" data-spd="8">8x</button>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:11px;">
      人数 <b id="sim3d-pcount">0</b>/<span id="sim3d-scount">0</span>席
      <input type="range" id="sim3d-pslider" min="0" max="0" style="width:90px;accent-color:#4a86c8;">
    </div>
    <div class="note3d" style="margin:6px 0 4px;">※ 人の動きは演出です（通行できるかの検証ではありません）</div>
    <div id="sim3d-people-list"></div>
  </div>
  <div id="hint-3d">ドラッグ: 視点回転　右/Shift+ドラッグ: パン　ホイール: ズーム${verHtml}</div>
`;
canvasArea.appendChild(view3d);

// ─── Three.js 確認 ───────────────────────────────────────────
let threeReady = false;
let three3dInitialized = false;
let three3dFailed = false, three3dFailMsg = '';

function show3DError(msg){
  const el = document.getElementById('loading-3d');
  if(!el) return;
  el.textContent = '';
  el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.gap = '10px';
  el.style.textAlign = 'center'; el.style.padding = '24px';
  const t = document.createElement('div');
  t.textContent = '3Dを表示できませんでした';
  t.style.cssText = 'font-weight:700;font-size:15px;color:#e8ecf1;';
  const m = document.createElement('div');
  m.textContent = msg; m.style.cssText = 'max-width:520px;line-height:1.7;font-size:12px;';
  const n = document.createElement('div');
  n.textContent = '2D編集は、そのままお使いいただけます。（データは失われていません）';
  n.style.cssText = 'font-size:12px;color:#c9d2de;';
  const b = document.createElement('button');
  b.className = 'btn3d'; b.textContent = '🗺 2D編集に戻る';
  b.addEventListener('click', ()=>switchView('2d'));
  el.append(t, m, n, b);
}

function loadThreeJS(callback){
  if(typeof THREE !== 'undefined'){ callback(); return; }
  three3dFailed = true;
  three3dFailMsg = '3D表示用の部品が見つかりません。';
  show3DError(three3dFailMsg);
}

// ─── ビュー切替ロジック ──────────────────────────────────────
let currentView = '2d';
document.getElementById('tab-2d').addEventListener('click', ()=> switchView('2d'));
document.getElementById('tab-3d').addEventListener('click', ()=> switchView('3d'));

function switchView(mode){
  currentView = mode;
  document.body.classList.toggle('view3d-mode', mode==='3d');
  if(mode==='3d' && typeof window.opExitModes==='function') window.opExitModes();
  document.getElementById('tab-2d').classList.toggle('active', mode==='2d');
  document.getElementById('tab-3d').classList.toggle('active', mode==='3d');

  const canvasWrap = document.getElementById('canvas-wrap');
  const zoomCtrl = document.getElementById('zoom-controls');
  const rulerOl = document.getElementById('ruler-overlay');
  const badge = document.getElementById('active-layer-badge');

  if(mode==='3d'){
    if(canvasWrap) canvasWrap.style.display='none';
    if(zoomCtrl) zoomCtrl.style.display='none';
    if(rulerOl) rulerOl.style.display='none';
    if(badge) badge.style.display='none';
    view3d.classList.add('active');
    if(three3dFailed){ show3DError(three3dFailMsg); return; }
    if(!three3dInitialized){
      const ld=document.getElementById('loading-3d');
      ld.textContent='3D空間を構築中...'; ld.style.display='flex';
      loadThreeJS(()=>{
        try{
          initThreeEngine();
          three3dInitialized = true;
        }catch(ex){
          three3dFailed = true;
          three3dFailMsg = 'お使いのPC・ブラウザで3D描画（WebGL）を開始できませんでした。（'+(ex&&ex.message||ex)+'）';
          console.info('3D init failed:', ex);
          show3DError(three3dFailMsg); return;
        }
        try{
          document.getElementById('loading-3d').style.display='none';
          syncToThree();
          apply3DTheme();
        }catch(ex){
          console.info('3D build failed:', ex);
          show3DError('3Dの構築中にエラーが発生しました。（'+(ex&&ex.message||ex)+'）');
        }
      });
    } else {
      try{
        document.getElementById('loading-3d').style.display='none';
        syncToThree();
        apply3DTheme();
      }catch(ex){
        console.info('3D build failed:', ex);
        show3DError('3Dの構築中にエラーが発生しました。（'+(ex&&ex.message||ex)+'）');
      }
    }
  } else {
    if(canvasWrap) canvasWrap.style.display='';
    if(zoomCtrl) zoomCtrl.style.display='';
    if(rulerOl) rulerOl.style.display='';
    if(badge) badge.style.display='';
    view3d.classList.remove('active');
    if(three3dInitialized) stop3DLoop();
  }
}

// ─── 3Dエンジン変数・定数 ────────────────────────────────────
let t3Scene, t3Camera, t3Renderer, t3Clock;
let t3Ambient=null, t3Hemi=null, t3Sun=null, t3RoomLight=null;
let t3TimeOfDay='noon';
let t3PickAbles=[], t3LabelSprites=[], t3People=[], t3Seats=[], t3SpawnPoints=[];
let t3Target={}, t3CorridorZ=2.75;
let t3CamTarget, t3CamRadius=10, t3CamTheta, t3CamPhi=1.0, t3TopMode=false;
let t3AnimId=null;
let t3FloorMesh=null, t3GridMesh=null, t3WallGroup=null;
let t3AlwaysLabels=false, t3PeopleCount=0, t3SimMin=0, t3SimPlaying=true, t3SimSpeed=1;
let t3Groups={};

const SIM_BASE_RATE3 = 540/90;
const WALK_SPEED3 = 78;
const TACTICS3 = {
  desk:    {label:'デスクワーク型', deskMin:45, deskMax:90, excursions:[{name:'copier',w:0.7,min:3,max:8},{name:'locker',w:0.2,min:4,max:10},{name:'pantry',w:0.1,min:3,max:8}]},
  tech:    {label:'技術支援型',     deskMin:15, deskMax:35, excursions:[{name:'workbench',w:0.35,min:10,max:25},{name:'locker',w:0.25,min:5,max:12},{name:'copier',w:0.2,min:3,max:8},{name:'pantry',w:0.2,min:3,max:8}]},
  meeting: {label:'会議・調整型',   deskMin:20, deskMax:40, excursions:[{name:'meeting',w:0.7,min:15,max:30},{name:'copier',w:0.15,min:3,max:8},{name:'pantry',w:0.15,min:3,max:8}]},
  misc:    {label:'庶務型',         deskMin:15, deskMax:30, excursions:[{name:'pantry',w:0.3,min:5,max:15},{name:'locker',w:0.3,min:5,max:15},{name:'copier',w:0.2,min:3,max:8},{name:'board',w:0.2,min:3,max:8}]},
};
const ROLE_CYCLE3=['desk','desk','desk','desk','tech','tech','meeting','meeting','misc'];
const NAMES3=['鈴木','田中','佐藤','高橋','伊藤','渡辺','山本','中村','小林','加藤'];
const STATE_LABEL3={DESK:'デスク',COPIER:'コピー機',WORKBENCH:'作業台',MEETING:'会議中',PANTRY:'給湯室',LOCKER:'更衣室',BOARD:'掲示板',OUT:'外出中'};

function mulberry32_3(seed){ return function(){ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function weightedPick3(rng,list){ const tot=list.reduce((s,x)=>s+x.w,0); let r=rng()*tot; for(const i of list){if((r-=i.w)<=0)return i;} return list[list.length-1]; }
function buildPath3(a,b){ if(Math.abs(a.x-b.x)<.01&&Math.abs(a.z-b.z)<.01)return[a,b]; return[a,{x:a.x,z:t3CorridorZ},{x:b.x,z:t3CorridorZ},b]; }
function pathLen3(p){ let d=0; for(let i=1;i<p.length;i++)d+=Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z); return d; }

function ptOnPath3(path,frac){
  const tot=pathLen3(path);
  if(tot<1e-6) return{x:path[0].x,z:path[0].z,angle:null};
  let tgt=frac*tot,acc=0;
  for(let i=1;i<path.length;i++){
    const dx=path[i].x-path[i-1].x, dz=path[i].z-path[i-1].z;
    const sl=Math.hypot(dx,dz);
    if(acc+sl>=tgt||i===path.length-1){
      const t=sl<1e-6?0:(tgt-acc)/sl;
      return{x:path[i-1].x+dx*t,z:path[i-1].z+dz*t,angle:sl>1e-4?Math.atan2(dx,dz):null};
    }
    acc+=sl;
  }
  const n=path.length-1;
  return{x:path[n].x,z:path[n].z,angle:Math.atan2(path[n].x-path[n-1].x,path[n].z-path[n-1].z)};
}
function buildSchedule3(person,seatPos,rng){
  const meta=TACTICS3[person.role]; const segs=[]; let t=0,pos=seatPos;
  const ls=190+(person.idx%9)*13+rng()*12, ld=40+rng()*15;
  function pw(to){if(t>=540)return;const p=buildPath3(pos,to);const dur=Math.max(0.4,pathLen3(p)/WALK_SPEED3);const t1=Math.min(540,t+dur);segs.push({type:'walk',path:p,t0:t,t1});t=t1;pos=to;}
  function ps(state,at,dur){if(t>=540||dur<=0)return;const t1=Math.min(540,t+dur);segs.push({type:'stat',state,pos:at,t0:t,t1});t=t1;pos=at;}
  let first=true;
  while(t<540){
    let dd=first?(3+(person.idx%7)*2.5+rng()*3):(meta.deskMin+rng()*(meta.deskMax-meta.deskMin));
    first=false;
    if(t<ls&&t+dd>ls)dd=ls-t;
    if(dd>0.3){if(Math.abs(pos.x-seatPos.x)>.01||Math.abs(pos.z-seatPos.z)>.01)pw(seatPos);ps('DESK',seatPos,dd);}
    if(t>=540)break;
    if(Math.abs(t-ls)<.8&&ls<540){pw(t3Target.door);ps('OUT',t3Target.door,ld);pw(seatPos);continue;}
    if(t>=540)break;
    const ch=weightedPick3(rng,meta.excursions);const dur2=ch.min+rng()*(ch.max-ch.min);const tg=t3Target[ch.name]||seatPos;pw(tg);ps(ch.name.toUpperCase(),tg,dur2);
  }
  return segs;
}
function sampleSched3(segs,min){
  for(const s of segs){
    if(min>=s.t0&&min<=s.t1){
      if(s.type==='stat') return{pos:s.pos,state:s.state,moving:false,angle:null};
      const f=s.t1>s.t0?(min-s.t0)/(s.t1-s.t0):0;
      const pt=ptOnPath3(s.path,f);
      return{pos:{x:pt.x,z:pt.z},state:'WALK',moving:true,angle:pt.angle};
    }
  }
  const l=segs[segs.length-1];
  return l?{pos:l.pos||l.path[l.path.length-1],state:'DESK',moving:false,angle:null}:{pos:{x:0,z:0},state:'DESK',moving:false,angle:null};
}

// ─── 高さ・形状推定ルール ────────────────────────────────────
const ROOM_WALL_H3 = 2.4;
const KW3=[
  [/デスクマット/,{height:0.01,kind:'solid'}],
  [/モニター台|モニタースタンド/,{height:0.10,kind:'solid'}],
  [/デスク|机|作業机/,{height:0.72,kind:'solid'}],
  [/会議テーブル|ミーティング/,{height:0.72,kind:'solid'}],
  [/作業台|カウンター|給湯室|キッチン/,{height:0.85,kind:'solid'}],
  [/チェア|椅子|スツール/,{height:0.46,kind:'chair'}],
  [/ロッカー|書庫|本棚|シェルフ/,{height:1.8,kind:'solid'}],
  [/キャビネット|収納/,{height:1.0,kind:'solid'}],
  [/コピー機|複合機\(A3\)/,{height:1.1,kind:'solid'}],
  [/プリンタ|インクジェット|複合機/,{height:0.24,kind:'solid'}],
  [/冷蔵庫/,{height:1.2,kind:'solid'}],
  [/電子レンジ/,{height:0.30,kind:'solid'}],
  [/電気ポット|ポット|コーヒーメーカー/,{height:0.28,kind:'solid'}],
  [/扇風機/,{height:0.85,kind:'solid'}],
  [/空気清浄機/,{height:0.58,kind:'solid'}],
  [/シュレッダー/,{height:0.60,kind:'solid'}],
  [/ノートPC/,{height:0.24,kind:'solid'}],
  [/電話|FAX/,{height:0.12,kind:'solid'}],
  [/モニター/,{height:0.38,kind:'solid'}],
  [/洗面台|流し台|シンク/,{height:0.85,kind:'solid'}],
  [/パーティション|間仕切り/,{height:1.4,kind:'solid'}],
  [/サーバー|ラック/,{height:1.6,kind:'solid'}],
  [/ソファ/,{height:0.4,kind:'solid'}],
  [/ゴミ箱|リサイクルBOX/,{height:0.55,kind:'solid'}],
  [/消火器/,{height:0.52,kind:'solid'}],
  [/傘立て/,{height:0.55,kind:'solid'}],
  [/観葉植物/,{height:1.0,kind:'solid'}],
  [/テーブル|台/,{height:0.72,kind:'solid'}],
];
function objSpec3(o){
  const txt=(o.defName||'')+(o.name||'')+(o.label||'');
  if(o.isSpawn||/人物スポーン|スポナー/.test(txt)) return{height:0.02,elevation:0,kind:'spawn',guessed:false};
  if(o.isDoor) return{height:2.0,elevation:0,kind:'door',guessed:false};
  if(o.isWindow) return{height:1.2,elevation:0.9,kind:'window',guessed:false};
  if(o.isStair) return{height:0.03,elevation:0,kind:'stair',guessed:false};
  if(o.isComment) return{height:0.02,elevation:1.55,kind:'comment',guessed:false};
  if(o.layerId===3||/コンセント/i.test(o.defName||'')) return{height:0.12,elevation:0.28,kind:'outlet',guessed:false};
  if(/^壁/.test((o.defName||o.name||'').trim())) return{height:ROOM_WALL_H3,elevation:0,kind:'wall',guessed:false};
  if(/ホワイトボード|掲示板/.test(txt)&&!/更衣|スペース/.test(txt)){
    if((o.w||0)>1.4||(o.h||0)>1.4)return{height:0.02,elevation:0,kind:'zone',guessed:false};
    return{height:0.9,elevation:1.0,kind:'board',guessed:false};
  }
  if(/更衣|スペース|エリア/.test(txt)&&((o.w||0)>1.2||(o.h||0)>1.2))return{height:0.02,elevation:0,kind:'zone',guessed:false};
  for(const[re,sp]of KW3){if(re.test(txt))return{...sp,elevation:0,guessed:false};}
  const area=(o.w||0.4)*(o.h||0.4);
  return{height:area<0.12?0.4:area<0.5?0.72:0.85,elevation:0,kind:'solid',guessed:true};
}

// ─── GLTFモデル読み込み ──────────────────────────────────────
const t3ModelCache=new Map();
let t3ModelTimer=null, t3ModelWarned=false;
window._opModelCache=t3ModelCache;
window._opT3=()=>({groups:t3Groups,scene:t3Scene});

function opModelRule(o){
  const defs=window.OP_MODELS; if(!defs||!defs.rules) return null;
  const nm=(o.defName||o.name||'').trim();
  for(const r of defs.rules){ try{ if(r.re.test(nm)) return r; }catch(e){} }
  return null;
}
function opModelEntry(file){
  let e=t3ModelCache.get(file); if(e) return e;
  e={state:'loading'}; t3ModelCache.set(file,e);
  const done=()=>{ if(t3ModelTimer) clearTimeout(t3ModelTimer);
    t3ModelTimer=setTimeout(()=>{ t3ModelTimer=null; if(threeReady&&window._op3dRoom) buildRoom3D(window._op3dRoom,{keepCam:true}); },60); };
  if(typeof THREE==='undefined'||!THREE.GLTFLoader){ e.state='failed'; return e; }
  try{
    new THREE.GLTFLoader().load(((window.OP_MODELS&&window.OP_MODELS.base)||'models/')+file, gltf=>{
      const tpl=gltf.scene, b=new THREE.Box3().setFromObject(tpl), s=new THREE.Vector3(), c=new THREE.Vector3();
      b.getSize(s); b.getCenter(c);
      const seen=new Set();
      tpl.traverse(n=>{ if(!n.isMesh) return; (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{
        if(!m||seen.has(m)) return; seen.add(m);
        if(m.map){ m.map.encoding=THREE.LinearEncoding; m.map.needsUpdate=true; }
        if(m.color&&m.color.convertLinearToSRGB) m.color.convertLinearToSRGB();
      }); });
      Object.assign(e,{state:'ready',tpl,sx:Math.max(s.x,1e-3),sy:Math.max(s.y,1e-3),sz:Math.max(s.z,1e-3),cx:c.x,cz:c.z,minY:b.min.y});
      done();
    }, undefined, err=>{
      e.state='failed'; console.info('3D model fallback to box:', file);
      if(!t3ModelWarned){
        t3ModelWarned=true;
        if(location.protocol==='file:' && typeof showToast==='function'){
          try{ showToast('3Dモデルを読み込めませんでした（箱で表示します）。index.html を直接開いている場合は、モデルを表示できません',6000); }catch(x){}
        }
      }
      done();
    });
  }catch(ex){ e.state='failed'; }
  return e;
}
function opMakeModel(e,rule,o){
  const n=Math.max(1,(rule.repeatX|0)||1), w=o.w/n, d=Math.max(o.h,.05), root=new THREE.Group();
  for(let i=0;i<n;i++){
    const inner=e.tpl.clone(true); inner.position.set(-e.cx,-e.minY,-e.cz);
    const holder=new THREE.Group(); holder.add(inner);
    holder.scale.set(w/e.sx,1,d/e.sz);
    holder.position.x=-o.w/2+w*(i+.5); root.add(holder);
  }
  root.rotation.y=-THREE.MathUtils.degToRad(o.rot||0)+THREE.MathUtils.degToRad(rule.rot||0);
  root.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } });
  return root;
}
function disposeGrp(g){ while(g.children.length){const c=g.children[0];g.remove(c);if(c.geometry)c.geometry.dispose();if(c.material){if(c.material.map)c.material.map.dispose();c.material.dispose();}} }

function makeSprite3(text,bg){
  const cv=document.createElement('canvas'); const c=cv.getContext('2d');
  const fz=40; c.font=`${fz}px sans-serif`;
  const w=Math.max(c.measureText(text).width+40,120); cv.width=w; cv.height=64;
  c.font=`${fz}px sans-serif`; c.fillStyle=bg||'rgba(20,25,32,0.85)';
  c.beginPath(); c.roundRect?c.roundRect(0,0,w,64,14):c.rect(0,0,w,64); c.fill();
  c.fillStyle='#fff'; c.textBaseline='middle'; c.textAlign='center'; c.fillText(text,w/2,34);
  const tex=new THREE.CanvasTexture(cv);
  const mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
  const spr=new THREE.Sprite(mat);
  spr.scale.set(w*0.011,64*0.011,1); spr.renderOrder=999;
  return spr;
}

function addWall3(grp,x1,z1,x2,z2,mat,wh){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);
  if(len<.02)return;
  const g=new THREE.BoxGeometry(len,wh,.08);
  const m=new THREE.Mesh(g,mat);
  m.position.set((x1+x2)/2,wh/2,(z1+z2)/2);
  m.rotation.y=-Math.atan2(dz,dx);
  m.castShadow=true; m.receiveShadow=true; grp.add(m);
}
function buildWalls3(grp,rW,rH,doors){
  const WH=ROOM_WALL_H3,mat=new THREE.MeshStandardMaterial({color:0xf4f1ea,roughness:0.95,transparent:true,opacity:0.9});
  const gaps={west:[],east:[],north:[],south:[]};
  doors.forEach(d=>{
    const cx=d.x+(d.w||.9)/2,cy=d.y+(d.h||.9)/2;
    const dW=cx,dE=rW-cx,dN=cy,dS=rH-cy;
    const mn=Math.min(dW,dE,dN,dS);
    if(mn===dW) gaps.west.push([Math.min(d.y,d.y+(d.h||.9)),Math.max(d.y,d.y+(d.h||.9))]);
    else if(mn===dE) gaps.east.push([Math.min(d.y,d.y+(d.h||.9)),Math.max(d.y,d.y+(d.h||.9))]);
    else if(mn===dN) gaps.north.push([Math.min(d.x,d.x+(d.w||.9)),Math.max(d.x,d.x+(d.w||.9))]);
    else gaps.south.push([Math.min(d.x,d.x+(d.w||.9)),Math.max(d.x,d.x+(d.w||.9))]);
  });
  function run(from,to,gl,mapPt){
    gl.sort((a,b)=>a[0]-b[0]); let cur=from;
    gl.forEach(([g0,g1])=>{if(g0>cur){const p1=mapPt(cur),p2=mapPt(g0);addWall3(grp,p1[0],p1[1],p2[0],p2[1],mat,WH);}cur=Math.max(cur,g1);});
    if(cur<to){const p1=mapPt(cur),p2=mapPt(to);addWall3(grp,p1[0],p1[1],p2[0],p2[1],mat,WH);}
  }
  run(0,rW,gaps.north,v=>[v,0]);
  run(0,rW,gaps.south,v=>[v,rH]);
  run(0,rH,gaps.west,v=>[0,v]);
  run(0,rH,gaps.east,v=>[rW,v]);
}

function makePersonMesh3(tagCol, idx){
  const g=new THREE.Group();
  const suitColors=[0xcbb894,0xc2ae89,0xd3c2a0,0xb9a582,0xc7b592];
  const hairColors=[0x1d1d22,0x2b231e,0x342a22,0x222328];
  const suitCol=suitColors[(idx||0)%suitColors.length];
  const pantCol=new THREE.Color(suitCol).multiplyScalar(0.90);
  const pktCol=new THREE.Color(suitCol).multiplyScalar(0.84);
  const hairCol=hairColors[(idx||0)%hairColors.length];

  const suitMat=new THREE.MeshStandardMaterial({color:suitCol,roughness:0.82});
  const pantMat=new THREE.MeshStandardMaterial({color:pantCol,roughness:0.86});
  const pktMat=new THREE.MeshStandardMaterial({color:pktCol,roughness:0.82});
  const skinMat=new THREE.MeshStandardMaterial({color:0xefc9a5,roughness:0.75});
  const hairMat=new THREE.MeshStandardMaterial({color:hairCol,roughness:0.9});
  const darkMat=new THREE.MeshStandardMaterial({color:0x24262b,roughness:0.85});
  const shirtMat=new THREE.MeshStandardMaterial({color:0xedeff2,roughness:0.8});
  const tagMat=new THREE.MeshStandardMaterial({color:tagCol,roughness:0.5});

  const add=(parent,geo,mat,x,y,z)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true;
    parent.add(m); return m;
  };

  const hips=new THREE.Group(); hips.position.y=0.85; g.add(hips);
  add(hips,new THREE.BoxGeometry(0.30,0.055,0.175),darkMat,0,0.025,0);

  const torso=new THREE.Group(); hips.add(torso);
  add(torso,new THREE.BoxGeometry(0.32,0.44,0.19),suitMat,0,0.24,0);
  add(torso,new THREE.BoxGeometry(0.015,0.40,0.01),pktMat,0,0.23,0.097);
  add(torso,new THREE.BoxGeometry(0.065,0.07,0.014),pktMat,-0.085,0.32,0.098);
  add(torso,new THREE.BoxGeometry(0.055,0.032,0.014),tagMat,0.085,0.33,0.098);
  add(torso,new THREE.BoxGeometry(0.11,0.05,0.12),shirtMat,0,0.455,0.02);

  const head=new THREE.Group(); head.position.set(0,0.47,0); torso.add(head);
  add(head,new THREE.CylinderGeometry(0.052,0.06,0.08,8),skinMat,0,0.035,0);
  const face=add(head,new THREE.SphereGeometry(0.115,12,10),skinMat,0,0.155,0);
  face.scale.set(0.92,1.06,0.95);
  const hairTop=add(head,new THREE.SphereGeometry(0.122,12,10,0,Math.PI*2,0,Math.PI*0.62),hairMat,0,0.165,-0.012);
  hairTop.scale.set(0.95,1.05,0.98); hairTop.rotation.x=-0.35;
  add(head,new THREE.BoxGeometry(0.17,0.055,0.06),hairMat,0,0.225,0.075);

  const mkArm=(sx)=>{
    const arm=new THREE.Group(); arm.position.set(sx*0.205,0.42,0);
    add(arm,new THREE.BoxGeometry(0.085,0.39,0.085),suitMat,0,-0.18,0);
    add(arm,new THREE.BoxGeometry(0.068,0.075,0.068),skinMat,0,-0.405,0);
    torso.add(arm); return arm;
  };
  const armL=mkArm(-1), armR=mkArm(1);

  const mkLeg=(sx)=>{
    const leg=new THREE.Group(); leg.position.set(sx*0.082,0,0);
    add(leg,new THREE.BoxGeometry(0.118,0.42,0.128),pantMat,0,-0.21,0);
    const knee=new THREE.Group(); knee.position.set(0,-0.42,0);
    add(knee,new THREE.BoxGeometry(0.102,0.37,0.112),pantMat,0,-0.185,0);
    add(knee,new THREE.BoxGeometry(0.108,0.065,0.185),darkMat,0,-0.397,0.032);
    leg.add(knee); hips.add(leg); return{leg,knee};
  };
  const L=mkLeg(-1), R=mkLeg(1);

  g.userData.rig={hips,armL,armR,legL:L.leg,kneeL:L.knee,legR:R.leg,kneeR:R.knee};
  return g;
}
function hue3(i){ const hues=[.58,.58,.58,.58,.35,.4,.08,.09,.78]; const h=(hues[i%9]+Math.floor(i/9)*.13)%1; const c=new THREE.Color(); c.setHSL(h,.55,.5); return c.getHex(); }
function formatClock3(min){ const tot=9*60+Math.floor(min),hh=Math.floor(tot/60),mm=tot%60; return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }

function updateCam3(){
  const p=t3TopMode?.06:t3CamPhi;
  const x=t3CamTarget.x+t3CamRadius*Math.sin(p)*Math.sin(t3CamTheta);
  const y=t3CamTarget.y+t3CamRadius*Math.cos(p);
  const z=t3CamTarget.z+t3CamRadius*Math.sin(p)*Math.cos(t3CamTheta);
  t3Camera.position.set(x,y,z);
  t3Camera.up.set(0,1,0); t3Camera.lookAt(t3CamTarget);
}

function updatePeople3(){
  t3People.forEach((p,i)=>{
    if(i>=t3PeopleCount){ p.mesh.visible=false; p.label.visible=false; return; }
    const s=sampleSched3(p.schedule,t3SimMin);
    const vis=s.state!=='OUT';
    p.mesh.visible=vis; p.label.visible=vis&&t3AlwaysLabels;
    if(vis){
      const rig=p.mesh.userData.rig;
      p.mesh.position.set(s.pos.x,0,s.pos.z);
      if(s.moving){
        if(s.angle!=null){ p.lastAngle=s.angle; p.mesh.rotation.y=s.angle; }
        const ph=t3SimMin*2.5+i*1.7;
        const sw=Math.sin(ph)*0.62;
        rig.hips.position.set(0,0.85+Math.abs(Math.cos(ph))*0.025,0);
        rig.legL.rotation.x=sw;  rig.kneeL.rotation.x=Math.max(0,-sw*0.45);
        rig.legR.rotation.x=-sw; rig.kneeR.rotation.x=Math.max(0,sw*0.45);
        rig.armL.rotation.x=-sw*0.75; rig.armR.rotation.x=sw*0.75;
        p.label.position.set(s.pos.x,1.92,s.pos.z);
      } else if(s.state==='DESK' && !p.seatPos.stand){
        p.mesh.rotation.y=-THREE.MathUtils.degToRad(p.seatPos.rot||0);
        rig.hips.position.set(0,0.52,-0.04);
        rig.legL.rotation.x=-1.48; rig.kneeL.rotation.x=1.42;
        rig.legR.rotation.x=-1.48; rig.kneeR.rotation.x=1.42;
        rig.armL.rotation.x=-0.55; rig.armR.rotation.x=-0.55;
        p.label.position.set(s.pos.x,1.60,s.pos.z);
      } else {
        p.mesh.rotation.y=(s.state==='DESK')?-THREE.MathUtils.degToRad(p.seatPos.rot||0):(p.lastAngle!=null?p.lastAngle:0);
        rig.hips.position.set(0,0.85,0);
        rig.legL.rotation.x=0; rig.kneeL.rotation.x=0;
        rig.legR.rotation.x=0; rig.kneeR.rotation.x=0;
        rig.armL.rotation.x=-0.12; rig.armR.rotation.x=-0.12;
        p.label.position.set(s.pos.x,1.92,s.pos.z);
      }
    }
    const el=document.getElementById('p3-state-'+i);
    if(el) el.textContent=s.moving?'移動中…':(STATE_LABEL3[s.state]||s.state);
  });
}

function rebuildPeople3(){
  disposeGrp(t3Groups.person);
  t3People=[];
  document.getElementById('sim3d-people-list').innerHTML='';
  const activeSeats = t3SpawnPoints.map(sp=>{
    let bestChair=null, bestD=0.65;
    for(const c of t3Seats){
      const d=Math.hypot(c.x-sp.x, c.z-sp.z);
      if(d<bestD){ bestD=d; bestChair=c; }
    }
    return bestChair ? {x:bestChair.x, z:bestChair.z, rot:bestChair.rot, stand:false} : {x:sp.x, z:sp.z, rot:sp.rot, stand:true};
  });
  const cnt=activeSeats.length;
  document.getElementById('sim3d-scount').textContent=cnt;
  const psl=document.getElementById('sim3d-pslider');
  psl.max=cnt; t3PeopleCount=cnt; psl.value=t3PeopleCount;
  document.getElementById('sim3d-pcount').textContent=t3PeopleCount;

  activeSeats.forEach((seat,i)=>{
    const role=ROLE_CYCLE3[i%ROLE_CYCLE3.length];
    const name=NAMES3[i%NAMES3.length];
    const color=hue3(i);
    const p={name,role,idx:i,seatPos:seat,color,lastAngle:-THREE.MathUtils.degToRad(seat.rot||0)};
    const rng=mulberry32_3(1000+i*97);
    p.schedule=buildSchedule3(p,seat,rng);
    p.mesh=makePersonMesh3(color,i);
    p.label=makeSprite3(name,'rgba(20,25,32,0.85)');
    p.label.visible=t3AlwaysLabels;
    t3Groups.person.add(p.mesh,p.label);
    t3People.push(p);

    const row=document.createElement('div');
    row.className='p3d-row';
    const hexCol='#'+color.toString(16).padStart(6,'0');
    row.innerHTML=`<span class="p3d-dot" style="background:${hexCol}"></span><span class="p3d-name">${name}</span><span class="p3d-state" id="p3-state-${i}">-</span>`;
    document.getElementById('sim3d-people-list').appendChild(row);
  });
  updatePeople3();
}

function convert2Dto3D(state){
  return {
    roomW: Number(state.roomW)||8,
    roomH: Number(state.roomH)||6,
    objects: (state.objects||[]).map(o=>({
      id: o.id,
      defName: o.defName||o.name||'',
      label: (typeof o.label==='string'&&o.label)||o.name||o.defName||'',
      x: Number(o.x)||0, y: Number(o.y)||0,
      w: Number(o.w)||0.4, h: Number(o.h)||0.4,
      rot: Number(o.rot)||0, color: o.color||'#8896aa',
      round: !!o.round, layerId: o.layerId||1,
      isDoor: !!o.isDoor, isWindow: !!o.isWindow,
      isStair: !!o.isStair, isComment: !!o.isComment, isSpawn: !!o.isSpawn,
    })),
    lines: (state.lines||[]).map(l=>({
      id:l.id, x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2,
      color:l.color||'#f08e33', typeId:l.typeId
    }))
  };
}

// ─── 時間帯照明 & テーマ同期 ─────────────────────────────────
const THEME_DARK  = { bg: 0x12161c, floor: 0xe7e2d6, wall: 0xf4f1ea, grid1: 0xbfbaa8, grid2: 0xd6d1c1 };
const THEME_LIGHT = { bg: 0xf0f2f5, floor: 0xdddad2, wall: 0xfaf9f6, grid1: 0xc8c4b8, grid2: 0xe0ddd6 };

function applyTimeLighting(){
  if(!threeReady || !t3Scene) return;
  document.querySelectorAll('.tod3d').forEach(b=>b.classList.toggle('active', b.dataset.tod===t3TimeOfDay));
  if(window._opEasterDiscoActive) return;

  const isLight = document.body.classList.contains('light-mode');
  const th = isLight ? THEME_LIGHT : THEME_DARK;
  const rW = t3FloorMesh ? t3FloorMesh.geometry.parameters.width  : 8;
  const rH = t3FloorMesh ? t3FloorMesh.geometry.parameters.height : 6;
  const span = Math.max(rW, rH, 10);

  if(t3Sun){
    t3Sun.shadow.camera.left=-span; t3Sun.shadow.camera.right=span;
    t3Sun.shadow.camera.top=span; t3Sun.shadow.camera.bottom=-span;
    t3Sun.shadow.camera.far=span*3;
    t3Sun.shadow.camera.updateProjectionMatrix();
    t3Sun.target.position.set(rW/2, 0, rH/2);
  }
  if(t3RoomLight){
    t3RoomLight.position.set(rW/2, 2.28, rH/2);
    t3RoomLight.distance = Math.max(rW, rH) * 1.9;
  }

  const tod = t3TimeOfDay;
  if(tod==='morning'){
    t3Scene.background = new THREE.Color(isLight ? 0xdceeff : 0x1b2434);
    if(t3Ambient){ t3Ambient.color.setHex(0xfff8f0); t3Ambient.intensity=0.50; }
    if(t3Hemi){ t3Hemi.color.setHex(0xcde4ff); t3Hemi.groundColor.setHex(0x3b3328); t3Hemi.intensity=0.48; }
    if(t3Sun){ t3Sun.color.setHex(0xffe7cc); t3Sun.intensity=0.85; t3Sun.position.set(rW*1.25, 3.2, rH*0.25); }
    if(t3RoomLight){ t3RoomLight.intensity=0; }
  } else if(tod==='evening'){
    t3Scene.background = new THREE.Color(isLight ? 0xf0cbb0 : 0x281822);
    if(t3Ambient){ t3Ambient.color.setHex(0xffccb0); t3Ambient.intensity=0.40; }
    if(t3Hemi){ t3Hemi.color.setHex(0xffa870); t3Hemi.groundColor.setHex(0x382018); t3Hemi.intensity=0.42; }
    if(t3Sun){ t3Sun.color.setHex(0xff8844); t3Sun.intensity=1.05; t3Sun.position.set(-rW*0.65, 2.1, rH*0.95); }
    if(t3RoomLight){ t3RoomLight.color.setHex(0xfff2d6); t3RoomLight.intensity=0.25; }
  } else if(tod==='night'){
    t3Scene.background = new THREE.Color(0x090c14);
    if(t3Ambient){ t3Ambient.color.setHex(0xfff2dc); t3Ambient.intensity=0.36; }
    if(t3Hemi){ t3Hemi.color.setHex(0x9ab8ff); t3Hemi.groundColor.setHex(0x1e1a14); t3Hemi.intensity=0.26; }
    if(t3Sun){ t3Sun.color.setHex(0x7aa2ff); t3Sun.intensity=0.15; t3Sun.position.set(rW*0.5, 6, rH*0.2); }
    if(t3RoomLight){ t3RoomLight.color.setHex(0xfff2d6); t3RoomLight.intensity=1.10; }
  } else { // noon
    t3Scene.background = new THREE.Color(th.bg);
    if(t3Ambient){ t3Ambient.color.setHex(0xffffff); t3Ambient.intensity=0.55; }
    if(t3Hemi){ t3Hemi.color.setHex(0xdfe9ff); t3Hemi.groundColor.setHex(0x30291f); t3Hemi.intensity=0.45; }
    if(t3Sun){ t3Sun.color.setHex(0xfff2df); t3Sun.intensity=0.90; t3Sun.position.set(rW*0.4, 6, rH*0.2); }
    if(t3RoomLight){ t3RoomLight.intensity=0; }
  }
}

function apply3DTheme(){
  const isLight = document.body.classList.contains('light-mode');
  const th = isLight ? THEME_LIGHT : THEME_DARK;
  if(typeof THREE !== 'undefined'){
    if(t3FloorMesh) t3FloorMesh.material.color.setHex(th.floor);
    if(t3Scene && t3GridMesh){
      t3Scene.remove(t3GridMesh);
      const rW = t3FloorMesh ? t3FloorMesh.geometry.parameters.width  : 8;
      const rH = t3FloorMesh ? t3FloorMesh.geometry.parameters.height : 6;
      t3GridMesh = new THREE.GridHelper(Math.max(rW,rH), Math.round(Math.max(rW,rH)), th.grid1, th.grid2);
      t3GridMesh.position.set(rW/2, 0.005, rH/2);
      t3Scene.add(t3GridMesh);
    }
  }
  const panel3d = document.getElementById('panel-3d');
  const sim3d   = document.getElementById('sim-3d');
  const hint3d  = document.getElementById('hint-3d');
  if(isLight){
    if(panel3d) panel3d.style.background = 'rgba(240,242,245,0.92)';
    if(sim3d)   sim3d.style.background   = 'rgba(240,242,245,0.92)';
    document.querySelectorAll('.btn3d').forEach(b=>{
      b.style.background = b.classList.contains('active') ? '#3a6ea8' : 'rgba(240,242,245,0.92)';
      b.style.color = b.classList.contains('active') ? '#fff' : '#334';
      b.style.borderColor = '#ccd';
    });
    document.querySelectorAll('.ly3d-row').forEach(r=>r.style.color='#334');
    if(hint3d){ hint3d.style.background='rgba(240,242,245,0.85)'; hint3d.style.color='#6677aa'; }
  } else {
    if(panel3d) panel3d.style.background = '';
    if(sim3d)   sim3d.style.background   = '';
    document.querySelectorAll('.btn3d').forEach(b=>{ b.style.background=''; b.style.color=''; b.style.borderColor=''; });
    document.querySelectorAll('.ly3d-row').forEach(r=>r.style.color='');
    if(hint3d){ hint3d.style.background=''; hint3d.style.color=''; }
  }
  applyTimeLighting();
}

// ─── 3Dシーン構築 ────────────────────────────────────────────
function buildRoom3D(roomData,opts){
  if(!threeReady) return;
  window._op3dRoom=roomData;

  t3PickAbles=[]; t3LabelSprites=[]; t3Seats=[]; t3SpawnPoints=[];
  Object.values(t3Groups).forEach(g=>disposeGrp(g));
  if(t3WallGroup){ disposeGrp(t3WallGroup); t3Scene.remove(t3WallGroup); }

  const rW=roomData.roomW, rH=roomData.roomH;
  t3CorridorZ=rH/2;

  const isLight = document.body.classList.contains('light-mode');
  const th = isLight ? THEME_LIGHT : THEME_DARK;

  if(t3FloorMesh){ t3FloorMesh.geometry.dispose(); t3FloorMesh.material.dispose(); t3Scene.remove(t3FloorMesh); }
  if(t3GridMesh){ t3Scene.remove(t3GridMesh); }
  const floorGeo=new THREE.PlaneGeometry(rW,rH);
  const floorMat=new THREE.MeshStandardMaterial({color:th.floor,roughness:0.9});
  t3FloorMesh=new THREE.Mesh(floorGeo,floorMat);
  t3FloorMesh.rotation.x=-Math.PI/2; t3FloorMesh.position.set(rW/2,0,rH/2);
  t3FloorMesh.receiveShadow=true; t3Scene.add(t3FloorMesh);
  t3GridMesh=new THREE.GridHelper(Math.max(rW,rH),Math.round(Math.max(rW,rH)),th.grid1,th.grid2);
  t3GridMesh.position.set(rW/2,.005,rH/2); t3Scene.add(t3GridMesh);

  t3WallGroup=new THREE.Group();
  const doors=roomData.objects.filter(o=>o.isDoor);
  buildWalls3(t3WallGroup,rW,rH,doors);
  t3Scene.add(t3WallGroup);

  const RE_MID_STAGE=/デスクマット|モニター台|モニタースタンド|プロジェクター台/;
  const RE_SURFACE=/デスク|机|テーブル|作業台|カウンター|キャビネット|本棚|書庫|シェルフ|ロッカー|冷蔵庫|袖机|ワゴン|パレット|給湯室|キッチン|流し台|シンク|台$/;
  const RE_TABLETOP=/ノートPC|タブレット|スマホ|スマートフォン|デスクトップPC|Mac mini|Raspberry|ドッキング|USBハブ|モニター|プロジェクター|キーボード|マウス|テンキー|トラックパッド|ペンタブ|ゲームパッド|プリンタ|インクジェット|複合機|コピー機|スキャナ|SC$|ラベル|ルーター|アクセスポイント|スイッチ|NAS|UPS|ONU|モデム|カメラ|スピーカー|SPK|ヘッドセット|マイク|スイッチャー|キャプチャ|電話|FAX|PBX|インターホン|無線機|電源タップ|ケーブル|ACアダプタ|充電|書類トレー|ファイルBOX|カレンダー|レタートレー|ペン立て|ステープラー|電卓|シール貼り|ノギス|マルチメーター|オシロスコープ|温湿度計|ICテスター|CD\/DVD|メディアBOX|鍵BOX|金庫\(小\)|ゴミ箱\(卓上\)|マガジンラック|電子レンジ|コーヒーメーカー|電気ポット|ポット|観葉植物 小|時計|段ボール|資材コンテナ|工具箱/;

  function ptInFootprint3(px,pz,b){
    const bx=b.x+b.w/2, bz=b.y+b.h/2, r=-THREE.MathUtils.degToRad(b.rot||0);
    const dx=px-bx, dz=pz-bz;
    const lx=dx*Math.cos(r)-dz*Math.sin(r), lz=dx*Math.sin(r)+dz*Math.cos(r);
    return Math.abs(lx)<=b.w/2+0.02 && Math.abs(lz)<=b.h/2+0.02;
  }

  const items3=roomData.objects.map(o=>{
    const spec=objSpec3(o);
    const mrule=(spec.kind==='solid'||spec.kind==='chair'||spec.kind==='door')?opModelRule(o):null;
    const ment=mrule?opModelEntry(mrule.file):null;
    const actualH=(ment&&ment.state==='ready')?ment.sy:spec.height;
    const nm=(o.defName||o.name||'').trim();
    let stage=9;
    if(spec.elevation===0&&spec.kind==='solid'){
      if(RE_MID_STAGE.test(nm)) stage=1;
      else if(RE_TABLETOP.test(nm)) stage=2;
      else if(RE_SURFACE.test(nm)) stage=0;
    }
    return{o,spec,mrule,ment,actualH,stage,elev:spec.elevation};
  });

  const surfaces0=items3.filter(it=>it.stage===0);
  items3.filter(it=>it.stage===1).forEach(it=>{
    const cx=it.o.x+it.o.w/2, cz=it.o.y+it.o.h/2;
    let top=0;
    for(const b of surfaces0){ if(b!==it&&ptInFootprint3(cx,cz,b.o)) top=Math.max(top,b.elev+b.actualH); }
    if(top>0) it.elev=top;
  });
  const surfacesAll=items3.filter(it=>it.stage===0||it.stage===1);
  items3.filter(it=>it.stage===2).forEach(it=>{
    const cx=it.o.x+it.o.w/2, cz=it.o.y+it.o.h/2;
    let top=0;
    for(const b of surfacesAll){ if(b!==it&&ptInFootprint3(cx,cz,b.o)) top=Math.max(top,b.elev+b.actualH); }
    if(top>0) it.elev=top;
  });

  items3.forEach(({o,spec,ment,mrule,elev})=>{
    const cx=o.x+o.w/2, cz=o.y+o.h/2;
    if(spec.kind==='spawn'){ t3SpawnPoints.push({x:cx,z:cz,rot:(o.rot||0)}); return; }
    let mesh=null;

    if(ment&&ment.state==='ready'){
      const mo=opMakeModel(ment,mrule,o);
      mo.position.set(cx,elev,cz); mo.userData=o;
      (o.layerId===3?t3Groups.outlet:t3Groups.furniture).add(mo);
      if(spec.kind==='chair') t3Seats.push({x:cx,z:cz,rot:(o.rot||0)});
      const spr0=makeSprite3(o.label||o.defName,'rgba(20,25,32,0.85)');
      spr0.position.set(cx,elev+ment.sy+.28,cz); spr0.visible=t3AlwaysLabels;
      t3Scene.add(spr0); t3LabelSprites.push(spr0);
      return;
    }

    if(spec.kind==='chair'){
      mesh=new THREE.Mesh(new THREE.CylinderGeometry(o.w/2,o.w/2*.9,spec.height,18),new THREE.MeshStandardMaterial({color:o.color,roughness:.6}));
      t3Seats.push({x:cx,z:cz,rot:(o.rot||0)});
    } else if(spec.kind==='comment'){
      const spr=makeSprite3(o.label||o.defName,(o.color||'#888')+'dd');
      spr.position.set(cx,elev,cz);
      spr.visible=t3Groups.comment.visible;
      t3Groups.comment.add(spr);
      return;
    } else if(spec.kind==='outlet'){
      mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w,spec.height,o.h),new THREE.MeshStandardMaterial({color:o.color,emissive:0x3a3a10,roughness:.4}));
    } else if(spec.kind==='zone'){
      mesh=new THREE.Mesh(new THREE.PlaneGeometry(o.w,o.h),new THREE.MeshBasicMaterial({color:o.color,transparent:true,opacity:.28,side:THREE.DoubleSide}));
      mesh.rotation.x=-Math.PI/2; mesh.rotation.z=-THREE.MathUtils.degToRad(o.rot);
      mesh.position.set(cx,.01,cz);
    } else if(spec.kind==='window'){
      mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w,spec.height,Math.max(o.h,.05)),new THREE.MeshPhysicalMaterial({color:0xbfe6f7,transparent:true,opacity:.45,roughness:.05,metalness:.1}));
    } else if(spec.kind==='wall'){
      mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w,spec.height,o.h),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95}));
    } else if(spec.kind==='stair'){
      mesh=new THREE.Mesh(new THREE.PlaneGeometry(o.w,o.h),new THREE.MeshStandardMaterial({color:0x999999,roughness:.9,side:THREE.DoubleSide}));
      mesh.rotation.x=-Math.PI/2; mesh.rotation.z=-THREE.MathUtils.degToRad(o.rot);
      mesh.position.set(cx,.02,cz);
    } else {
      const mo={color:o.color,roughness:.65};
      if(spec.guessed){mo.transparent=true;mo.opacity=.82;}
      mesh=new THREE.Mesh(new THREE.BoxGeometry(o.w,spec.height,o.h),new THREE.MeshStandardMaterial(mo));
    }

    if(spec.kind!=='zone'&&spec.kind!=='stair'){
      mesh.position.set(cx,elev+spec.height/2,cz);
      mesh.rotation.y=-THREE.MathUtils.degToRad(o.rot);
    }
    mesh.castShadow=spec.kind!=='zone'&&spec.kind!=='stair'&&spec.kind!=='window';
    mesh.receiveShadow=true; mesh.userData=o;

    const grp=(o.layerId===3)?t3Groups.outlet:t3Groups.furniture;
    grp.add(mesh); t3PickAbles.push(mesh);

    if(spec.kind!=='outlet' && spec.kind!=='wall'){
      const spr=makeSprite3(o.label||o.defName,'rgba(20,25,32,0.85)');
      spr.position.set(cx,elev+spec.height+.28,cz);
      spr.visible=t3AlwaysLabels;
      t3Scene.add(spr); t3LabelSprites.push(spr);
    }
  });

  disposeGrp(t3Groups.line);
  (roomData.lines||[]).forEach(l=>{
    let col=0xf08e33;
    if(l.typeId==='electric') col=0xffcc00;
    else if(l.typeId==='lan') col=0x4488ff;
    const m=new THREE.LineBasicMaterial({color:col});
    const pts=[new THREE.Vector3(l.x1,.03,l.y1),new THREE.Vector3(l.x2,.03,l.y2)];
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    t3Groups.line.add(new THREE.Line(geo,m));
  });

  function findTgt(re,fallback){ const h=roomData.objects.find(o=>re.test((o.defName||'')+(o.label||''))); return h?{x:h.x+h.w/2,z:h.y+h.h/2}:fallback; }
  const cen={x:rW/2,z:rH/2};
  t3Target={
    copier:findTgt(/コピー機|複合機|プリンタ/,cen), workbench:findTgt(/作業台/,cen),
    meeting:findTgt(/会議テーブル|ミーティング/,cen), pantry:findTgt(/冷蔵庫|洗面台/,cen),
    locker:findTgt(/ロッカー|更衣/,cen), board:findTgt(/掲示板|ホワイトボード/,cen),
    door:doors.length?{x:doors[0].x+(doors[0].w||.9)/2>rW/2?rW-.35:.35,z:Math.min(Math.max(doors[0].y+(doors[0].h||.9)/2,.3),rH-.3)}:{x:.35,z:rH/2}
  };

  if(!(opts&&opts.keepCam)){
    t3CamTarget.set(rW/2,.6,rH/2);
    t3CamRadius=Math.max(rW,rH)*1.15;
    t3CamTheta=Math.PI*.28; t3CamPhi=1.0; t3TopMode=false;
    updateCam3();
  }

  rebuildPeople3();
  applyTimeLighting();
}

function initThreeEngine(){
  threeReady=true;
  const host=document.getElementById('three-canvas-host');

  t3Scene=new THREE.Scene(); t3Scene.background=new THREE.Color(0x12161c);
  t3CamTarget=new THREE.Vector3(4,.6,3);
  t3Camera=new THREE.PerspectiveCamera(45,host.clientWidth/host.clientHeight,.05,200);
  t3Renderer=new THREE.WebGLRenderer({antialias:true});
  t3Renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  t3Renderer.setSize(host.clientWidth,host.clientHeight);
  t3Renderer.shadowMap.enabled=true; t3Renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.appendChild(t3Renderer.domElement);

  t3Ambient=new THREE.AmbientLight(0xffffff,.55); t3Scene.add(t3Ambient);
  t3Hemi=new THREE.HemisphereLight(0xdfe9ff,0x30291f,.45); t3Scene.add(t3Hemi);
  t3Sun=new THREE.DirectionalLight(0xfff2df,.9);
  t3Sun.name='sun3'; t3Sun.castShadow=true;
  t3Sun.shadow.mapSize.set(2048,2048);
  t3Scene.add(t3Sun); t3Scene.add(t3Sun.target);
  t3RoomLight=new THREE.PointLight(0xfff2d6,0,20);
  t3RoomLight.name='roomLight3';
  t3Scene.add(t3RoomLight);

  t3Groups={
    furniture:new THREE.Group(), outlet:new THREE.Group(),
    comment:new THREE.Group(), line:new THREE.Group(),
    person:new THREE.Group()
  };
  Object.values(t3Groups).forEach(g=>t3Scene.add(g));
  t3Groups.outlet.visible=false;
  t3Groups.comment.visible=false;
  t3Groups.line.visible=false;

  t3Clock=new THREE.Clock();

  document.getElementById('ly3-furn').onchange=e=>t3Groups.furniture.visible=e.target.checked;
  document.getElementById('ly3-outlet').onchange=e=>t3Groups.outlet.visible=e.target.checked;
  document.getElementById('ly3-comment').onchange=e=>t3Groups.comment.visible=e.target.checked;
  document.getElementById('ly3-line').onchange=e=>t3Groups.line.visible=e.target.checked;
  document.getElementById('ly3-person').onchange=e=>t3Groups.person.visible=e.target.checked;
  document.getElementById('ly3-label').onchange=e=>{
    t3AlwaysLabels=e.target.checked;
    t3LabelSprites.forEach(s=>s.visible=t3AlwaysLabels);
    t3People.forEach(p=>p.label.visible=t3AlwaysLabels&&p.mesh.visible);
  };

  document.querySelectorAll('.tod3d').forEach(b=>{
    b.addEventListener('click',()=>{
      t3TimeOfDay=b.dataset.tod;
      apply3DTheme();
    });
  });

  const PHI_MIN=.12,PHI_MAX=1.5;
  let drag=false,dragBtn=0,lastX=0,lastY=0,touchDist=null;
  t3Renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  t3Renderer.domElement.addEventListener('pointerdown',e=>{
    drag=true; dragBtn=e.button; lastX=e.clientX; lastY=e.clientY;
    t3Renderer.domElement.setPointerCapture(e.pointerId);
  });
  t3Renderer.domElement.addEventListener('pointerup',()=>{ drag=false; });
  t3Renderer.domElement.addEventListener('pointermove',e=>{
    if(!drag)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
    if(dragBtn===2||e.shiftKey){
      const sp=t3CamRadius*.0016;
      const fw=new THREE.Vector3(Math.sin(t3CamTheta),0,Math.cos(t3CamTheta));
      const rt=new THREE.Vector3(Math.cos(t3CamTheta),0,-Math.sin(t3CamTheta));
      t3CamTarget.addScaledVector(rt,-dx*sp); t3CamTarget.addScaledVector(fw,dy*sp);
    } else if(!t3TopMode){
      t3CamTheta-=dx*.006; t3CamPhi=Math.min(PHI_MAX,Math.max(PHI_MIN,t3CamPhi-dy*.006));
    }
    updateCam3();
  });
  t3Renderer.domElement.addEventListener('wheel',e=>{
    e.preventDefault(); t3CamRadius*=(1+Math.sign(e.deltaY)*.08);
    t3CamRadius=Math.min(40,Math.max(1.5,t3CamRadius)); updateCam3();
  },{passive:false});
  t3Renderer.domElement.addEventListener('touchstart',e=>{
    if(e.touches.length===1){drag=true;dragBtn=0;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;}
    else if(e.touches.length===2) touchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  t3Renderer.domElement.addEventListener('touchmove',e=>{
    if(e.touches.length===1&&drag){
      const dx=e.touches[0].clientX-lastX,dy=e.touches[0].clientY-lastY;
      lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;
      if(!t3TopMode){t3CamTheta-=dx*.006;t3CamPhi=Math.min(PHI_MAX,Math.max(PHI_MIN,t3CamPhi-dy*.006));}
      updateCam3();
    } else if(e.touches.length===2&&touchDist!=null){
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      t3CamRadius*=(1+(touchDist-d)*.003); t3CamRadius=Math.min(40,Math.max(1.5,t3CamRadius));
      touchDist=d; updateCam3();
    }
  },{passive:true});
  t3Renderer.domElement.addEventListener('touchend',()=>{drag=false;touchDist=null;});

  document.getElementById('btn3d-orbit').onclick=()=>{
    t3TopMode=false; document.getElementById('btn3d-orbit').classList.add('active');
    document.getElementById('btn3d-top').classList.remove('active'); updateCam3();
  };
  document.getElementById('btn3d-top').onclick=()=>{
    t3TopMode=true; document.getElementById('btn3d-top').classList.add('active');
    document.getElementById('btn3d-orbit').classList.remove('active'); updateCam3();
  };
  document.getElementById('btn3d-reset').onclick=()=>{
    if(t3FloorMesh){ t3CamTarget.set(t3FloorMesh.position.x,.6,t3FloorMesh.position.z); t3CamRadius=Math.max(t3FloorMesh.geometry.parameters.width,t3FloorMesh.geometry.parameters.height)*1.15; }
    t3CamTheta=Math.PI*.28; t3CamPhi=1.0; t3TopMode=false;
    document.getElementById('btn3d-orbit').classList.add('active');
    document.getElementById('btn3d-top').classList.remove('active'); updateCam3();
  };
  document.getElementById('btn3d-sim').onclick=()=>{
    const simEl=document.getElementById('sim-3d');
    simEl.classList.toggle('active');
    document.getElementById('btn3d-sim').classList.toggle('active',simEl.classList.contains('active'));
  };

  document.getElementById('btn3d-play').onclick=()=>{
    t3SimPlaying=!t3SimPlaying;
    document.getElementById('btn3d-play').textContent=t3SimPlaying?'⏸ 一時停止':'▶ 再生';
    document.getElementById('btn3d-play').classList.toggle('active',t3SimPlaying);
  };
  document.querySelectorAll('.spd3d .btn3d').forEach(b=>{
    b.onclick=()=>{ t3SimSpeed=parseFloat(b.dataset.spd); document.querySelectorAll('.spd3d .btn3d').forEach(x=>x.classList.remove('active')); b.classList.add('active'); };
  });
  document.getElementById('sim3d-slider').oninput=()=>{
    t3SimMin=parseFloat(document.getElementById('sim3d-slider').value);
    updatePeople3(); document.getElementById('sim3d-clock').textContent=formatClock3(t3SimMin);
  };
  document.getElementById('sim3d-pslider').oninput=e=>{
    t3PeopleCount=parseInt(e.target.value,10);
    document.getElementById('sim3d-pcount').textContent=t3PeopleCount;
    updatePeople3();
  };

  const resizeObs=new ResizeObserver(()=>{
    if(currentView!=='3d')return;
    t3Camera.aspect=host.clientWidth/host.clientHeight;
    t3Camera.updateProjectionMatrix();
    t3Renderer.setSize(host.clientWidth,host.clientHeight);
  });
  resizeObs.observe(host);
}

let t3Throttle=0;
function loop3D(){
  t3AnimId=requestAnimationFrame(loop3D);
  if(!threeReady||!t3Scene||!t3Renderer) return;
  const dt=Math.min(t3Clock.getDelta(),.1);
  if(t3SimPlaying){
    t3SimMin+=dt*SIM_BASE_RATE3*t3SimSpeed;
    if(t3SimMin>=540) t3SimMin-=540;
    updatePeople3();
    t3Throttle+=dt;
    if(t3Throttle>.12){
      t3Throttle=0;
      const sl=document.getElementById('sim3d-slider');
      if(sl) sl.value=t3SimMin;
      const ck=document.getElementById('sim3d-clock');
      if(ck) ck.textContent=formatClock3(t3SimMin);
    }
  }
  t3People.forEach(p=>{ if(p.mesh.visible) p.label.quaternion.copy(t3Camera.quaternion); });
  t3Renderer.render(t3Scene,t3Camera);
}
function stop3DLoop(){ if(t3AnimId){cancelAnimationFrame(t3AnimId);t3AnimId=null;} }

function syncToThree(){
  let state;
  try { state = getState(); } catch(e){ console.error('getState failed',e); return; }
  const roomData = convert2Dto3D(state);
  buildRoom3D(roomData);
  if(t3AnimId) cancelAnimationFrame(t3AnimId);
  loop3D();
}

window._opApply3DTheme = apply3DTheme;
window._opReapply3DLighting = applyTimeLighting;
window._op3DStatus = function(){ return three3dFailed ? ('使えません — '+three3dFailMsg) : (three3dInitialized ? '初期化済み' : 'まだ使っていません'); };
window._opSync3DIfOpen = function(){
  if(currentView!=='3d' || !three3dInitialized) return;
  try{ syncToThree(); }
  catch(ex){ console.info('3D re-sync failed', ex); show3DError('3Dの更新中にエラーが発生しました。（'+(ex&&ex.message||ex)+'）'); }
};
window.syncToThree = syncToThree;
window.buildRoom3D = buildRoom3D;
window.get3DRefs = function(){
  return { scene:t3Scene, floorMesh:t3FloorMesh, gridMesh:t3GridMesh,
           camera:t3Camera, renderer:t3Renderer, groups:t3Groups };
};

})();