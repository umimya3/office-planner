/* サイドバー(検索・配線・レイヤー)・プロパティパネル・物のリスト・左右折りたたみ・ショートカット・UI補助 */
'use strict';

// バージョン情報
const APP_VERSION = 'v1.13.3';
const APP_UPDATED = '2026-11-25';
window._opAppInfo = {version:APP_VERSION, updated:APP_UPDATED};

if(typeof GENBA_DEFS !== 'undefined' && Array.isArray(GENBA_DEFS) && typeof FURN_DEFS !== 'undefined'){
  if(!FURN_DEFS.some(d=>d.cat && d.cat.startsWith('現場-'))) FURN_DEFS.push(...GENBA_DEFS);
}

// ─── UIヘルパー ──────────────────────────────────────────────
function showModal(id){ document.getElementById(id).classList.add('show'); }
function hideModal(id){ document.getElementById(id).classList.remove('show'); }
function showError(msg){ document.getElementById('modal-error-msg').textContent=msg; showModal('modal-error'); }
let toastT;
function showToast(msg,ms=2200){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  if(toastT) clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('show'),ms);
}
function clampF(v,min,max){ return isNaN(v)?min:Math.max(min,Math.min(max,v)); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── テーマ切替ボタン ────────────────────────────────────────
document.getElementById('btn-theme').onclick=()=>{
  const order=['auto','light','dark'];
  const next=order[(order.indexOf(window._opThemeMode())+1)%order.length];
  window._opApplyTheme(next,true);
  showToast({auto:'テーマ: 自動（端末の設定に合わせる）',light:'テーマ: ライト',dark:'テーマ: ダーク'}[next]);
};

// ─── レイヤーシステム ────────────────────────────────────────
const DEFAULT_LAYERS = [
  {id:1, name:'家具',         color:'#4a90d9', visible:true},
  {id:2, name:'構造',         color:'#8899bb', visible:true},
  {id:3, name:'電気配線',     color:'#ffcc00', visible:true},
  {id:4, name:'LAN',          color:'#4488ff', visible:true},
  {id:5, name:'その他',       color:'#9da3c8', visible:true},
  {id:6, name:'人物スポーン', color:'#ff9800', visible:true},
];
window._opDefaultLayers = DEFAULT_LAYERS;

let layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
let activeLayerId = 1;
let nextLayerId = 7;
let savedPersons = []; // 旧データ互換保持用

Object.defineProperty(window,'_activeLayerId2',{get:()=>activeLayerId,set:(v)=>{activeLayerId=v;},configurable:true});
Object.defineProperty(window,'activeLayerId',{get:()=>activeLayerId,set:(v)=>{activeLayerId=v;},configurable:true});

function getActiveLayer(){ return layers.find(l=>l.id===activeLayerId)||layers[0]; }
function isLayerVisible(lid){ const l=layers.find(x=>x.id===lid); return l?l.visible:true; }
window.isLayerVisible = isLayerVisible;

function migrateLayerIds(){
  for(const o of objects){ if(o.layerId==null) o.layerId=(o.isWindow||o.isDoor||o.isStair)?2:1; }
  for(const ln of lines){
    if(ln.layerId==null){
      ln.layerId = ln.typeId==='electric'?3 : ln.typeId==='lan'?4 : ln.typeId==='wall_line'?2 : 5;
    }
  }
}
function fixMissingLayerIds(){
  for(const ln of lines){
    if(ln.layerId==null) ln.layerId = ln.typeId==='electric'?3 : ln.typeId==='lan'?4 : ln.typeId==='wall_line'?2 : 5;
  }
  for(const o of objects){ if(o.layerId==null) o.layerId=1; }
}
window._opFixLayerIds = fixMissingLayerIds;

function updateActiveBadge(){
  const ly=getActiveLayer(), badge=document.getElementById('active-layer-badge');
  if(badge){ badge.textContent='レイヤー: '+ly.name; badge.style.borderColor=ly.color; badge.style.color=ly.color; }
}

window._opGetLayerExport = ()=>({
  layers: JSON.parse(JSON.stringify(layers)),
  activeLayerId,
  persons: JSON.parse(JSON.stringify(savedPersons)),
});
window._opRestoreLayers = function(state){
  const HEX=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const okLayers=[], hadLayers=Array.isArray(state.layers)&&state.layers.length>0;
  if(Array.isArray(state.layers)){
    const seen=new Set();
    for(const l of state.layers.slice(0,30)){
      if(!l||typeof l!=='object'||!Number.isInteger(l.id)||seen.has(l.id)) continue;
      seen.add(l.id);
      okLayers.push({id:l.id, name:(typeof l.name==='string'&&l.name.trim())?l.name.slice(0,40):('レイヤー'+l.id),
        color:HEX.test(l.color)?l.color:'#9da3c8', visible:l.visible!==false});
    }
  }
  if(okLayers.length>0){
    layers=okLayers; nextLayerId=Math.max(...okLayers.map(l=>l.id),6)+1;
    activeLayerId=okLayers.some(l=>l.id===state.activeLayerId)?state.activeLayerId:okLayers[0].id;
  } else {
    layers=JSON.parse(JSON.stringify(DEFAULT_LAYERS)); nextLayerId=7; activeLayerId=1;
    if(!hadLayers) showToast('旧データを読み込みました。レイヤーはデフォルトに設定されました。');
  }
  savedPersons = Array.isArray(state.persons) ? JSON.parse(JSON.stringify(state.persons)) : [];
  const ids=new Set(layers.map(l=>l.id));
  for(const o of objects) if(o.layerId!=null&&!ids.has(o.layerId)) o.layerId=ids.has(1)?1:layers[0].id;
  for(const l of lines)   if(l.layerId!=null&&!ids.has(l.layerId)) l.layerId=ids.has(5)?5:layers[0].id;
  migrateLayerIds(); updateActiveBadge();
  if(currentTab==='layers') buildLayerPanel();
};
window._opLayerSnapshot = ()=>({
  layers:JSON.parse(JSON.stringify(layers)), activeLayerId, nextLayerId,
  persons:JSON.parse(JSON.stringify(savedPersons)),
});
window._opLayerRestoreSnapshot = (s)=>{
  layers=s.layers; activeLayerId=s.activeLayerId; nextLayerId=s.nextLayerId;
  savedPersons=s.persons||[]; updateActiveBadge();
  if(currentTab==='layers') buildLayerPanel();
};

function buildLayerPanel(){
  const content=document.getElementById('sb-content');
  content.innerHTML='';
  const div=document.createElement('div');
  div.id='layer-panel';
  div.innerHTML='<div class="cat-label">レイヤー一覧 — クリックでアクティブ</div>';

  for(const ly of layers){
    const objCnt=objects.filter(o=>(o.layerId||1)===ly.id).length;
    const linCnt=lines.filter(l=>(l.layerId||5)===ly.id).length;
    const row=document.createElement('div');
    row.className='layer-row'+(activeLayerId===ly.id?' active-layer':'');
    row.style.opacity=ly.visible?'1':'0.45';

    const visBtn=document.createElement('div');
    visBtn.className='layer-vis'; visBtn.textContent=ly.visible?'👁':'🙈';
    visBtn.addEventListener('click',e=>{
      e.stopPropagation(); ly.visible=!ly.visible;
      visBtn.textContent=ly.visible?'👁':'🙈'; row.style.opacity=ly.visible?'1':'0.45';
      if(!ly.visible){
        for(const o of objects) if((o.layerId||1)===ly.id) selectedIds.delete(o.id);
        for(const l of lines)   if((l.layerId||5)===ly.id) selectedLineIds.delete(l.id);
      }
      draw(); scheduleSave();
    });

    const dot=document.createElement('div'); dot.className='layer-color'; dot.style.background=ly.color;
    const name=document.createElement('div'); name.className='layer-name'; name.textContent=ly.name;
    name.setAttribute('contenteditable','true'); name.style.outline='none';
    name.addEventListener('blur',()=>{ ly.name=name.textContent.trim().slice(0,40)||ly.name; updateActiveBadge(); scheduleSave(); });
    name.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); name.blur(); } });
    name.addEventListener('click',e=>e.stopPropagation());

    const cnt=document.createElement('div'); cnt.className='layer-count'; cnt.textContent=(objCnt+linCnt)+'個';
    row.appendChild(visBtn); row.appendChild(dot); row.appendChild(name); row.appendChild(cnt);

    if(layers.length>1){
      const delBtn=document.createElement('div');
      delBtn.style.cssText='font-size:11px;color:var(--danger);cursor:pointer;padding:0 3px;';
      delBtn.textContent='✕';
      delBtn.addEventListener('click',e=>{
        e.stopPropagation();
        if(objCnt+linCnt>0){ showToast('オブジェクトが残っています。先に移動してください。'); return; }
        layers=layers.filter(x=>x.id!==ly.id);
        if(activeLayerId===ly.id) activeLayerId=layers[0].id;
        buildLayerPanel(); updateActiveBadge(); scheduleSave();
      });
      row.appendChild(delBtn);
    }
    row.addEventListener('click',()=>{ activeLayerId=ly.id; scheduleSave(); buildLayerPanel(); updateActiveBadge(); });
    div.appendChild(row);
  }

  const addBtn=document.createElement('button');
  addBtn.className='layer-add-btn'; addBtn.textContent='＋ レイヤー追加';
  addBtn.addEventListener('click',()=>{
    if(layers.length>=30){ showToast('レイヤーは30個までです'); return; }
    const colors=['#e67e5a','#b07fd4','#4caf7d','#ff8844','#44ddff','#ff6699'];
    const newLy={id:nextLayerId++, name:'レイヤー'+(layers.length+1), color:colors[nextLayerId%colors.length], visible:true};
    layers.push(newLy); activeLayerId=newLy.id;
    buildLayerPanel(); updateActiveBadge(); scheduleSave();
  });
  div.appendChild(addBtn);

  if(selectedIds.size>0||selectedLineIds.size>0){
    const sec=document.createElement('div');
    sec.innerHTML='<div class="cat-label" style="margin-top:10px;">選択中を移動</div>';
    for(const ly of layers){
      const btn=document.createElement('button');
      btn.className='layer-add-btn'; btn.style.cssText='border-style:solid;margin-bottom:3px;text-align:left;padding:5px 8px;';
      btn.innerHTML=`<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${ly.color};margin-right:5px;"></span>${esc(ly.name)}へ移動`;
      btn.addEventListener('click',()=>{
        for(const id of selectedIds){ const o=objects.find(x=>x.id===id); if(o) o.layerId=ly.id; }
        for(const id of selectedLineIds){ const l=lines.find(x=>x.id===id); if(l) l.layerId=ly.id; }
        buildLayerPanel(); draw(); scheduleSave(); showToast(ly.name+'へ移動しました');
      });
      sec.appendChild(btn);
    }
    div.appendChild(sec);
  }
  content.appendChild(div);
}

// ─── オブジェクト配置・編集アクション ────────────────────────
function placeObject(def){
  const obj = {
    id:nextId++, name:def.name, defName:def.name, label:def.name,
    cat:(typeof def.cat==='string'?def.cat:''),
    x:parseFloat((roomW/2-(def.w||0.5)/2).toFixed(3)),
    y:parseFloat((roomH/2-(def.h||0.5)/2).toFixed(3)),
    w:def.w, h:def.h, color:def.color, icon:def.icon||'▪', rot:0,
    round:!!def.round, isDoor:!!def.isDoor, isWindow:!!def.isWindow,
    doorArc:!!def.doorArc, isStair:!!def.isStair, isComment:!!def.isComment, isSpawn:!!def.isSpawn,
    layerId:(def.isSpawn||/人物スポーン/.test(def.name||'')) ? (window._opSpawnLayerId||6) : ((def.isDoor||def.isWindow||def.isStair) ? 2 : activeLayerId)
  };
  objects.push(obj);
  selectedIds.clear(); selectedIds.add(obj.id); selectedLineIds.clear();
  draw(); updatePropPanel(); updateCounts(); scheduleSave();
  if(currentTab==='layers') buildLayerPanel();
  showToast(def.name+' を配置しました');
}
window.addFurniture = placeObject;

function deleteSelected(){
  objects=objects.filter(o=>!selectedIds.has(o.id));
  lines=lines.filter(l=>!selectedLineIds.has(l.id));
  selectedIds=new Set(); selectedLineIds=new Set();
  draw(); updatePropPanel(); updateCounts(); scheduleSave();
}
function rotateSelected(deg){
  for(const id of selectedIds){ const obj=objects.find(o=>o.id===id); if(obj) obj.rot=((obj.rot||0)+deg)%360; }
  draw(); updatePropPanel(); scheduleSave();
}
function bringToFront(){
  const sel=[...selectedIds];
  objects=objects.filter(o=>!sel.includes(o.id)).concat(objects.filter(o=>sel.includes(o.id)));
  draw(); scheduleSave();
}
function sendToBack(){
  const sel=[...selectedIds];
  objects=objects.filter(o=>sel.includes(o.id)).concat(objects.filter(o=>!sel.includes(o.id)));
  draw(); scheduleSave();
}
function copySelected(){
  if(selectedIds.size===0) return;
  clipboard=objects.filter(o=>selectedIds.has(o.id)).map(o=>JSON.parse(JSON.stringify(o)));
  showToast(`${clipboard.length}個コピーしました`);
}
function pasteClipboard(offset=false){
  if(clipboard.length===0) return;
  const newIds=new Set(); let cleared=0;
  for(const orig of clipboard){
    const obj={...JSON.parse(JSON.stringify(orig)), id:nextId++};
    if(obj.itemId||obj.note) cleared++;
    delete obj.itemId; delete obj.note;
    obj.x=parseFloat(Math.min(roomW-obj.w, obj.x+(offset?0.2:0.3)).toFixed(3));
    obj.y=parseFloat(Math.min(roomH-obj.h, obj.y+(offset?0.2:0.3)).toFixed(3));
    objects.push(obj); newIds.add(obj.id);
  }
  selectedIds=newIds; selectedLineIds=new Set();
  clipboard=objects.filter(o=>newIds.has(o.id)).map(o=>JSON.parse(JSON.stringify(o)));
  draw(); updatePropPanel(); updateCounts(); scheduleSave();
  showToast(`${newIds.size}個貼り付けました`+(cleared?'（物品IDと細目は、コピーしません）':''));
}

// ─── サイドバー・検索・配線パネル ────────────────────────────
let currentTab = 'furniture';

function buildSearchBar(onSearch){
  const wrap = document.createElement('div');
  wrap.id = 'sb-search-wrap';
  wrap.innerHTML = '<span class="search-icon">🔍</span><input id="sb-search" type="text" placeholder="名前・カテゴリで検索..."><span id="sb-search-clear">✕</span><div id="sb-search-count"></div>';
  const input = wrap.querySelector('#sb-search'), clear = wrap.querySelector('#sb-search-clear'), count = wrap.querySelector('#sb-search-count');
  input.addEventListener('input', ()=>{ const q=input.value.trim(); clear.style.display=q?'block':'none'; onSearch(q,count); });
  clear.addEventListener('click', ()=>{ input.value=''; clear.style.display='none'; onSearch('',count); });
  return wrap;
}

function renderFilteredItems(container, defs, q, onClick, countEl){
  container.innerHTML = '';
  const lower = q.toLowerCase();
  const filtered = q ? defs.filter(d => d.name.toLowerCase().includes(lower) || d.cat.toLowerCase().includes(lower)) : defs;
  if(countEl) countEl.textContent = q ? `${filtered.length} / ${defs.length} 件` : '';
  if(!filtered.length){
    const empty=document.createElement('div');
    empty.style.cssText='padding:24px;text-align:center;color:var(--text3);font-size:11px;';
    empty.textContent='「'+q+'」は見つかりませんでした';
    container.appendChild(empty); return;
  }
  const cats = [...new Set(filtered.map(d=>d.cat))];
  for(const cat of cats){
    const lbl=document.createElement('div'); lbl.className='cat-label'; lbl.textContent=cat; container.appendChild(lbl);
    for(const def of filtered.filter(d=>d.cat===cat)){
      const item=document.createElement('div'); item.className='furniture-item';
      item.dataset.name=def.name; item.dataset.cat=def.cat;
      const ic=document.createElement('div'); ic.className='fi-icon';
      ic.style.cssText=`background:${def.color};border-radius:${def.round?'50%':'3px'};opacity:.85;`;
      const info=document.createElement('div'); info.className='fi-info';
      info.innerHTML=`<div class="fi-name">${def.icon||'▪'} ${def.name}</div><div class="fi-size">${def.w}×${def.h}m</div>`;
      item.appendChild(ic); item.appendChild(info);
      item.addEventListener('click',()=>onClick(def));
      if(q){
        const nameEl=item.querySelector('.fi-name');
        const full=nameEl.textContent, idx=full.toLowerCase().indexOf(lower);
        if(idx>=0){
          nameEl.innerHTML = esc(full.slice(0,idx)) + '<span class="search-highlight">'+esc(full.slice(idx,idx+lower.length))+'</span>' + esc(full.slice(idx+lower.length));
        }
      }
      container.appendChild(item);
    }
  }
}

function buildSidebar(tab){
  currentTab = tab;
  document.querySelectorAll('.sb-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  const content = document.getElementById('sb-content');
  content.innerHTML = '';

  if(tab==='layers'){ buildLayerPanel(); return; }
  if(tab==='lines'){ content.appendChild(buildLinePanel()); return; }

  let defs;
  if(tab==='furniture')      defs = FURN_DEFS.filter(d=>!d.cat.startsWith('現場-'));
  else if(tab==='structure') defs = STRUCT_DEFS;
  else if(tab==='genba')     defs = FURN_DEFS.filter(d=>d.cat.startsWith('現場-'));
  else if(tab==='office')    defs = OFFICE_DEFS;
  else return;

  const itemList = document.createElement('div'); itemList.id = 'sb-item-list';
  content.appendChild(buildSearchBar((q,c)=>renderFilteredItems(itemList,defs,q,placeObject,c)));
  content.appendChild(itemList);
  renderFilteredItems(itemList, defs, '', placeObject, null);
}

function buildLinePanel(){
  const div=document.createElement('div'); div.id='line-panel';
  const modeBtn=document.createElement('button');
  modeBtn.className='line-tool-btn'+(lineMode?' active':''); modeBtn.id='line-mode-btn';
  modeBtn.innerHTML='✏️ 線描画モード '+(lineMode?'<b style="color:var(--accent)">[ON]</b>':'<b>[OFF]</b>');
  modeBtn.onclick=()=>{
    const next=!lineMode;
    if(next && typeof window._opRulerOff==='function') window._opRulerOff();
    opSetLineMode(next);
  };
  div.appendChild(modeBtn);

  const secTypes=document.createElement('div'); secTypes.className='lp-section';
  secTypes.innerHTML='<div class="lp-title">線の種類</div>';
  for(const lt of LINE_TYPES){
    const btn=document.createElement('button');
    btn.className='line-tool-btn'+(currentLineType.id===lt.id?' active':'');
    const sw=document.createElement('div'); sw.className='line-swatch';
    sw.style.cssText=`background:${lt.color};${lt.dash.length?'opacity:.7':''}`;
    btn.appendChild(sw); btn.appendChild(document.createTextNode(lt.label));
    btn.addEventListener('click',()=>{
      currentLineType=lt; lineColor=lt.color; lineDash=lt.dash; lineWidth=lt.width;
      secTypes.querySelectorAll('.line-tool-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); updateLinePanelInputs();
    });
    secTypes.appendChild(btn);
  }
  div.appendChild(secTypes);

  const secSet=document.createElement('div'); secSet.className='lp-section';
  secSet.innerHTML=`<div class="lp-title">スタイル設定</div>
    <div class="lp-row"><label>色</label><input type="color" class="lp-color" id="lp-color" value="${lineColor}"></div>
    <div class="lp-row"><label>太さ</label><input type="range" class="lp-range" id="lp-width" min="1" max="8" step="0.5" value="${lineWidth}"><span id="lp-width-val">${lineWidth}px</span></div>
    <div class="lp-row"><label>線種</label><select class="lp-sel" id="lp-dash">
      <option value="">実線</option><option value="6,4">破線</option><option value="2,4">点線</option><option value="8,4,2,4">一点鎖線</option>
    </select></div>`;
  div.appendChild(secSet);

  const delBtn=document.createElement('button');
  delBtn.className='line-tool-btn'; delBtn.style.cssText='color:var(--danger);border-color:var(--danger);margin-top:8px;';
  delBtn.textContent='🗑 選択した線を削除';
  delBtn.onclick=()=>{ lines=lines.filter(l=>!selectedLineIds.has(l.id)); selectedLineIds=new Set(); draw(); updateCounts(); scheduleSave(); };
  div.appendChild(delBtn);

  // 端点コネクタ設定
  const epSec=document.createElement('div');
  epSec.style.cssText='padding:8px 0 4px;border-top:1px solid var(--border);margin-top:8px;';
  epSec.innerHTML='<div class="cat-label">端点コネクタ表示</div><div style="font-size:10px;color:var(--text3);margin-bottom:6px;line-height:1.6;">配線を選択して端点アイコンON/OFFできます。\n下のボタンで全配線に一括適用。</div>';
  const mkEpBtn=(txt,fn,css)=>{ const b=document.createElement('button'); b.className='line-tool-btn'; if(css)b.style.cssText=css; b.textContent=txt; b.onclick=fn; return b; };
  epSec.appendChild(mkEpBtn('✅ 選択中の線に端点ON',()=>{
    let c=0; for(const id of selectedLineIds){ const l=lines.find(x=>x.id===id); if(l){l.showEndpoints=true;c++;} }
    showToast(c+'本の配線に端点アイコンを追加'); draw(); scheduleSave();
  }));
  epSec.appendChild(mkEpBtn('❌ 選択中の線の端点OFF',()=>{
    for(const id of selectedLineIds){ const l=lines.find(x=>x.id===id); if(l) l.showEndpoints=false; }
    draw(); scheduleSave();
  },'margin-top:3px;'));
  epSec.appendChild(mkEpBtn('⚡ 全電気配線に端点ON',()=>{
    let c=0; for(const l of lines){ if(l.typeId==='electric'||l.typeId==='lan'){l.showEndpoints=true;c++;} }
    showToast(c+'本に端点アイコンを設定'); draw(); scheduleSave();
  },'margin-top:6px;border-color:var(--accent);'));

  const epTypesWrap=document.createElement('div'); epTypesWrap.style.marginTop='8px';
  epTypesWrap.innerHTML='<div class="cat-label">端点の種類(選択中の線)</div>';
  for(const ep of [{id:'auto',label:'自動(配線種別)'},{id:'outlet',label:'コンセント'},{id:'lan',label:'LANポート'},{id:'phone',label:'電話'},{id:'water',label:'給水口'},{id:'gas',label:'ガス口'},{id:'none',label:'なし'}]){
    epTypesWrap.appendChild(mkEpBtn(ep.label,()=>{
      for(const id of selectedLineIds){
        const l=lines.find(x=>x.id===id); if(!l) continue;
        if(ep.id==='none') l.showEndpoints=false;
        else if(ep.id==='auto'){ l.epOverride=null; l.showEndpoints=true; }
        else { l.epOverride=ep.id; l.showEndpoints=true; }
      }
      draw(); scheduleSave();
    },'margin-bottom:2px;font-size:10px;padding:3px 6px;'));
  }
  epSec.appendChild(epTypesWrap);
  div.appendChild(epSec);

  setTimeout(()=>{
    const colEl=document.getElementById('lp-color'), widEl=document.getElementById('lp-width'), widVal=document.getElementById('lp-width-val'), dashEl=document.getElementById('lp-dash');
    if(colEl) colEl.addEventListener('input',()=>{ lineColor=colEl.value; if(currentLineType.id==='custom') currentLineType={...currentLineType,color:lineColor}; });
    if(widEl) widEl.addEventListener('input',()=>{ lineWidth=parseFloat(widEl.value); widVal.textContent=lineWidth+'px'; });
    if(dashEl) dashEl.addEventListener('change',()=>{ lineDash=dashEl.value?dashEl.value.split(',').map(Number):[]; });
  },0);
  return div;
}

function updateLinePanelInputs(){
  const c=document.getElementById('lp-color'), w=document.getElementById('lp-width'), wv=document.getElementById('lp-width-val'), d=document.getElementById('lp-dash');
  if(c) c.value=lineColor;
  if(w){ w.value=lineWidth; if(wv) wv.textContent=lineWidth+'px'; }
  if(d) d.value=lineDash.join(',')||'';
}
function updateLineDash(){ const d=document.getElementById('lp-dash'); if(d) lineDash=d.value?d.value.split(',').map(Number):[]; }
document.querySelectorAll('.sb-tab').forEach(tab=>tab.addEventListener('click',()=>buildSidebar(tab.dataset.tab)));

// ─── 右プロパティパネル ──────────────────────────────────────
function updatePropPanel(){
  const panel=document.getElementById('prop-panel');
  const selA=[...selectedIds], selLA=[...selectedLineIds], total=selA.length+selLA.length;

  if(selA.length===1) document.getElementById('sb-sel').textContent=objects.find(o=>o.id===selA[0]).label||'';
  else if(total>0) document.getElementById('sb-sel').textContent=`${total}個選択中`;
  else document.getElementById('sb-sel').textContent='未選択';

  if(total===0){
    panel.innerHTML=`<div id="no-sel"><div style="font-size:22px;margin-bottom:6px;">🖱️</div>クリックで選択<br>Ctrl+クリックで複数選択<br><br><span style="font-size:10px;color:var(--text3)">Delete: 削除<br>R: 90°回転<br>Ctrl+C/V: コピペ<br>←↑→↓: 10cm移動<br>Ctrl+A: 全選択</span></div>`;
    return;
  }

  if(selA.length===1 && selLA.length===0){
    const obj=objects.find(o=>o.id===selA[0]); if(!obj) return;
    panel.innerHTML=`
      <div class="panel-section">
        <div class="panel-title">プロパティ</div>
        <div class="prop-label">ラベル</div>
        <input class="prop-input" id="pp-label" maxlength="80" value="${esc(obj.label||'')}">
        <div class="prop-label">物品ID（引っ越し業者の番号など）</div>
        <input class="prop-input" id="pp-itemid" maxlength="40" placeholder="例: KA010111" value="${esc(obj.itemId||'')}">
        <div id="pp-iddup" style="display:none;font-size:10px;color:#ff8a80;margin:-2px 0 6px;"></div>
        <div class="prop-label">細目・メモ</div>
        <input class="prop-input" id="pp-note" maxlength="120" placeholder="例: 業務用デスク田嶋" value="${esc(obj.note||'')}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">
          <div><div class="prop-label">X(m)</div><input class="prop-input" id="pp-x" type="number" step="0.1" value="${obj.x}"></div>
          <div><div class="prop-label">Y(m)</div><input class="prop-input" id="pp-y" type="number" step="0.1" value="${obj.y}"></div>
          <div><div class="prop-label">幅(m)</div><input class="prop-input" id="pp-w" type="number" step="0.05" min="0.05" value="${obj.w}"></div>
          <div><div class="prop-label">奥行(m)</div><input class="prop-input" id="pp-h" type="number" step="0.05" min="0.05" value="${obj.h}"></div>
        </div>
        <div class="prop-label">回転(°)</div>
        <input class="prop-input" id="pp-rot" type="number" step="1" value="${obj.rot||0}">
        <div class="prop-label">カラー</div>
        <input class="prop-input" id="pp-color" type="color" value="${obj.color||'#4a90d9'}" style="height:30px;padding:2px 4px;">
      </div>
      <div class="panel-section">
        <div class="panel-title">操作</div>
        <button class="action-btn copy" id="pp-copy">📋 コピー</button>
        <button class="action-btn rot" id="pp-rot90">↻ 90° 回転</button>
        <button class="action-btn rot" id="pp-rot-90">↺ −90°</button>
        <button class="action-btn" id="pp-front">⬆ 最前面</button>
        <button class="action-btn" id="pp-back">⬇ 最背面</button>
        <button class="action-btn del" id="pp-del">🗑 削除</button>
      </div>`;
    const bind=(id,key)=>{ const el=document.getElementById(id); if(el) el.addEventListener('input',()=>{ obj[key]=el.value; draw(); scheduleSave(); }); };
    bind('pp-label','label'); bind('pp-itemid','itemId'); bind('pp-note','note'); bind('pp-color','color');
    const dupEl=document.getElementById('pp-iddup');
    const updDup=()=>{ const k=opIdKey(obj.itemId), n=k?(opDupIdMap().get(k)||0):0;
      if(n>1){ dupEl.style.display='block'; dupEl.textContent='⚠ 同じ物品IDの物が、他に '+(n-1)+' 個あります'; } else dupEl.style.display='none'; };
    document.getElementById('pp-itemid').addEventListener('input',updDup);
    [['pp-itemid','itemId'],['pp-note','note']].forEach(([id,key])=>{
      const el=document.getElementById(id);
      el.addEventListener('change',()=>{ obj[key]=el.value.trim(); el.value=obj[key]; updDup(); draw(); scheduleSave(); });
    });
    updDup();
    const bindNum=(id,key,min,max)=>{
      const el=document.getElementById(id); if(!el) return;
      el.addEventListener('input',()=>{ const v=parseFloat(el.value); if(Number.isFinite(v)&&v>=min&&v<=max){ obj[key]=v; draw(); scheduleSave(); } });
      el.addEventListener('change',()=>{ const v=parseFloat(el.value), c=Number.isFinite(v)?Math.min(max,Math.max(min,v)):obj[key]; obj[key]=c; el.value=c; draw(); scheduleSave(); });
    };
    bindNum('pp-x','x',-MAX_MARGIN,roomW+MAX_MARGIN);
    bindNum('pp-y','y',-MAX_MARGIN,roomH+MAX_MARGIN);
    bindNum('pp-w','w',0.05,100); bindNum('pp-h','h',0.05,100); bindNum('pp-rot','rot',-3600,3600);
    document.getElementById('pp-copy').onclick=copySelected;
    document.getElementById('pp-rot90').onclick=()=>rotateSelected(90);
    document.getElementById('pp-rot-90').onclick=()=>rotateSelected(-90);
    document.getElementById('pp-front').onclick=bringToFront;
    document.getElementById('pp-back').onclick=sendToBack;
    document.getElementById('pp-del').onclick=deleteSelected;
  } else {
    panel.innerHTML=`
      <div class="panel-section">
        <div class="panel-title">複数選択 (${total}個)</div>
        <button class="action-btn copy">📋 コピー (${selA.length}個)</button>
        <button class="action-btn rot" id="pp-rot90">↻ 90°回転</button>
        <button class="action-btn rot" id="pp-rot-90">↺ −90°</button>
        <button class="action-btn del" id="pp-del">🗑 削除</button>
      </div>`;
    panel.querySelector('.action-btn.copy').onclick=copySelected;
    document.getElementById('pp-rot90').onclick=()=>rotateSelected(90);
    document.getElementById('pp-rot-90').onclick=()=>rotateSelected(-90);
    document.getElementById('pp-del').onclick=deleteSelected;
  }
}

function updateCounts(){
  document.getElementById('obj-count').textContent=objects.length;
  document.getElementById('line-count').textContent=lines.length;
  updateOutsideInfo();
}

// ─── コンテキストメニュー ────────────────────────────────────
const ctxMenu=document.getElementById('ctx-menu');
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  const pt=canvasPt(e), hit=hitObj(pt.x,pt.y);
  if(hit&&!selectedIds.has(hit.id)){ selectedIds=new Set([hit.id]); draw(); updatePropPanel(); }
  if(hit||selectedIds.size>0){
    ctxMenu.style.left=e.clientX+'px'; ctxMenu.style.top=e.clientY+'px';
    ctxMenu.classList.add('show');
  }
});
document.addEventListener('click', ()=>ctxMenu.classList.remove('show'));
document.getElementById('ctx-copy').onclick      =()=>{ copySelected(); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-paste').onclick     =()=>{ pasteClipboard(); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-duplicate').onclick =()=>{ copySelected(); pasteClipboard(true); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-rot90').onclick     =()=>{ rotateSelected(90); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-rot-90').onclick    =()=>{ rotateSelected(-90); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-front').onclick     =()=>{ bringToFront(); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-back').onclick      =()=>{ sendToBack(); ctxMenu.classList.remove('show'); };
document.getElementById('ctx-del').onclick       =()=>{ deleteSelected(); ctxMenu.classList.remove('show'); };

// ─── キー入力制御 & ショートカット ───────────────────────────
function opModalOpen(){
  return !!document.querySelector('.modal-overlay.show, #help-overlay.open, #slot-panel-wrap.open, #recovery-overlay.open');
}
function opTypingTarget(t){
  if(!t || !t.tagName) return false;
  if(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT') return true;
  if(t.isContentEditable===true) return true;
  return typeof t.closest==='function' && !!t.closest('[contenteditable="true"],[contenteditable=""]');
}
function opView3D(){ return document.body.classList.contains('view3d-mode'); }
function opEditKeysAllowed(e){
  if(opTypingTarget(e.target) || opModalOpen() || opView3D()) return false;
  if(typeof window._opInRuler==='function' && window._opInRuler()) return false;
  return true;
}
function opSetLineMode(on){
  lineMode=!!on; drawingLine=null;
  const mb=document.getElementById('line-mode-btn');
  if(mb){
    mb.className='line-tool-btn'+(lineMode?' active':'');
    mb.innerHTML='✏️ 線描画モード '+(lineMode?'<b style="color:var(--accent)">[ON]</b>':'<b>[OFF]</b>');
  }
  document.getElementById('sb-mode').textContent=lineMode?'配線描画モード':(rulerMode?'ルーラーモード':'選択モード');
  canvas.style.cursor=lineMode?'crosshair':'default';
  draw();
}
function opExitModes(){
  if(typeof window._opRulerOff==='function') window._opRulerOff();
  if(lineMode) opSetLineMode(false);
}
window.opExitModes = opExitModes;

document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && opModalOpen()){
    document.querySelectorAll('.modal-overlay.show').forEach(m=>m.classList.remove('show'));
    const sp=document.getElementById('slot-panel-wrap'), sc=document.getElementById('slot-close-btn');
    if(sp && sp.classList.contains('open') && sc) sc.click();
    return;
  }
  if(!opTypingTarget(e.target) && !opModalOpen() && e.key==='Escape' && rulerMode){
    if(rulerP1||rulerP2){ rulerP1=null; rulerP2=null; draw(); } else toggleRuler();
    return;
  }
  if((e.ctrlKey||e.metaKey) && e.key==='f' && !opModalOpen() && !opView3D()){
    const search = document.getElementById('sb-search');
    if(search){ e.preventDefault(); search.focus(); search.select(); }
    return;
  }
  if(!opEditKeysAllowed(e)) return;

  if((e.ctrlKey||e.metaKey) && e.key==='c'){ copySelected(); e.preventDefault(); }
  if((e.ctrlKey||e.metaKey) && e.key==='v'){ pasteClipboard(); e.preventDefault(); }
  if((e.ctrlKey||e.metaKey) && e.key==='d'){ copySelected(); pasteClipboard(true); e.preventDefault(); }
  if((e.ctrlKey||e.metaKey) && e.key==='a'){
    selectedIds=new Set(objects.filter(o=>isLayerVisible(o.layerId||1)).map(o=>o.id));
    selectedLineIds=new Set(lines.filter(l=>isLayerVisible(l.layerId||5)).map(l=>l.id));
    draw(); updatePropPanel(); e.preventDefault();
  }
  if(e.key==='Delete'||e.key==='Backspace') deleteSelected();
  if((e.key==='r'||e.key==='R') && !e.ctrlKey && !e.metaKey) rotateSelected(90);
  if(e.key==='Escape'){
    if(lineMode){ if(drawingLine){ drawingLine=null; draw(); } else opSetLineMode(false); return; }
    selectedIds=new Set(); selectedLineIds=new Set(); draw(); updatePropPanel();
  }
  const arrows={ArrowLeft:[-SNAP,0],ArrowRight:[SNAP,0],ArrowUp:[0,-SNAP],ArrowDown:[0,SNAP]};
  if(arrows[e.key]){
    e.preventDefault();
    const [dx,dy]=arrows[e.key];
    for(const id of selectedIds){ const o=objects.find(x=>x.id===id); if(o){ o.x=parseFloat((o.x+dx).toFixed(3)); o.y=parseFloat((o.y+dy).toFixed(3)); } }
    for(const id of selectedLineIds){ const l=lines.find(x=>x.id===id); if(l){ l.x1+=dx; l.y1+=dy; l.x2+=dx; l.y2+=dy; } }
    draw(); updatePropPanel(); scheduleSave();
  }
});

// ─── 物のリスト & 左右パネル折りたたみ ─────────────────────
(function(){
  const sec=document.getElementById('obj-list-sec'), sum=document.getElementById('obj-list-sum');
  const listEl=document.getElementById('obj-list'), filterEl=document.getElementById('obj-list-filter');
  const nameOf=o=>((typeof o.label==='string'&&o.label.trim())||o.defName||o.name||'（名称なし）');
  let timer=null, hitKey='';
  function setHits(ids){ const k=ids?ids.join(','):''; if(k===hitKey) return; hitKey=k; window._opHits=ids?new Set(ids):null; draw(); }
  function render(){
    timer=null;
    const vis=objects.filter(o=>isLayerVisible(o.layerId||1));
    sum.textContent='📋 物のリスト（'+vis.length+'）';
    if(!sec.open){ setHits(null); window._opHitsArr=[]; return; }
    const nq=opIdKey(filterEl.value), dm=opDupIdMap();
    const arr=vis.filter(o=>!nq||opIdKey(nameOf(o)+' '+(o.itemId||'')+' '+(o.note||'')).indexOf(nq)>=0);
    setHits(nq&&arr.length ? arr.map(o=>o.id) : null); window._opHitsArr=nq?arr:[];
    listEl.textContent='';
    if(!arr.length){ const e=document.createElement('div'); e.style.cssText='padding:8px;font-size:11px;color:var(--text3);'; e.textContent=vis.length?'該当する物がありません':'物がありません'; listEl.appendChild(e); return; }
    const fmt=v=>String(Number((+v).toFixed(1)));
    arr.slice(0,200).forEach(o=>{
      const r=document.createElement('div'); r.className='obj-row'+(selectedIds.has(o.id)?' sel':''); r.dataset.id=o.id;
      const nm=document.createElement('span'); nm.className='nm'; nm.textContent=nameOf(o); r.appendChild(nm);
      if(o.itemId){ const ids=document.createElement('span'); ids.className='ps'; ids.style.color='var(--accent)'; ids.textContent=o.itemId; r.appendChild(ids);
        if((dm.get(opIdKey(o.itemId))||0)>1){ const du=document.createElement('span'); du.className='ou'; du.style.cssText='border-color:#ff8a80;color:#ff8a80;'; du.textContent='重複'; r.appendChild(du); } }
      const cx=o.x+o.w/2, cy=o.y+o.h/2;
      if(cx<0||cy<0||cx>roomW||cy>roomH){ const ou=document.createElement('span'); ou.className='ou'; ou.textContent='外'; r.appendChild(ou); }
      const ps=document.createElement('span'); ps.className='ps'; ps.textContent=fmt(o.x)+', '+fmt(o.y); r.appendChild(ps);
      r.addEventListener('click',()=>{
        selectedIds=new Set([o.id]); selectedLineIds=new Set();
        draw(); updatePropPanel(); centerOn(o.x+o.w/2,o.y+o.h/2);
        listEl.querySelectorAll('.obj-row').forEach(x=>x.classList.toggle('sel',x===r));
      });
      listEl.appendChild(r);
    });
    if(arr.length>200){ const m=document.createElement('div'); m.style.cssText='padding:6px;font-size:10px;color:var(--text3);'; m.textContent='… ほか '+(arr.length-200)+' 件（名前で絞り込めます）'; listEl.appendChild(m); }
  }
  window._opObjListRefresh=function(){ if(timer) clearTimeout(timer); timer=setTimeout(render,150); };
  sec.addEventListener('toggle',render);
  filterEl.addEventListener('input',render);
  filterEl.addEventListener('input',()=>{ const a=window._opHitsArr; if(a && a.length===1) centerOn(a[0].x+a[0].w/2, a[0].y+a[0].h/2); });
  render();

  const UI_KEY='op_ui_v1', ui={left:false,right:false};
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(UI_KEY)||'null'); }catch(e){}
  if(saved&&typeof saved==='object'){ ui.left=!!saved.left; ui.right=!!saved.right; }
  else if(window.innerWidth<760){ ui.left=true; ui.right=true; }
  else if(window.innerWidth<1000){ ui.right=true; }
  const hdr=document.getElementById('header');
  const mkBtn=(id,label,title)=>{ const b=document.createElement('button'); b.className='hbtn panel-tgl'; b.id=id; b.textContent=label; b.title=title; return b; };
  const lb=mkBtn('btn-toggle-left','◧','左のパネル（部品の一覧）を隠す／出す');
  const rb=mkBtn('btn-toggle-right','◨','右のパネル（設定・プロパティ）を隠す／出す');
  const sp=hdr.querySelector('.spacer'); if(sp) hdr.insertBefore(lb,sp); else hdr.insertBefore(lb,hdr.firstChild.nextSibling);
  hdr.appendChild(rb);
  function applyUI(save){
    document.body.classList.toggle('hide-left',ui.left); document.body.classList.toggle('hide-right',ui.right);
    lb.classList.toggle('active',ui.left); rb.classList.toggle('active',ui.right);
    if(save){ try{ localStorage.setItem(UI_KEY,JSON.stringify(ui)); }catch(e){} }
  }
  lb.addEventListener('click',()=>{ ui.left=!ui.left; applyUI(true); });
  rb.addEventListener('click',()=>{ ui.right=!ui.right; applyUI(true); });
  applyUI(false);
})();

// バージョンバー
const verBar = document.createElement('div');
verBar.id = 'ver-bar';
verBar.innerHTML = `<span class="ver-hi">Office Planner</span><span class="ver-hi">${APP_VERSION}</span><span>更新: ${APP_UPDATED}</span><span style="margin-left:auto;"></span>`;
document.body.appendChild(verBar);