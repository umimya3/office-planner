/* 保存・読込・検証・共有URL・10スロット管理・PNG画像保存・Undo/Redo履歴・起動初期化 */
'use strict';

// ─── 状態シリアライズ & 検証 ─────────────────────────────────
function getState(){
  const ly = (typeof window._opGetLayerExport==='function') ? window._opGetLayerExport() : {};
  return {
    ver:4, roomW, roomH, margin:workMargin,
    objects:JSON.parse(JSON.stringify(objects)),
    lines:JSON.parse(JSON.stringify(lines)),
    nextId,
    layers: ly.layers, activeLayerId: ly.activeLayerId, persons: ly.persons
  };
}

const LIM={ROOM_MIN:0.5,ROOM_MAX:100,COORD:1000,SIZE_MIN:0.01,SIZE_MAX:200,MAX_OBJ:3000,MAX_LINE:3000};
function _isNum(v){ return typeof v==='number' && Number.isFinite(v); }
function _str(v,max,def){ return typeof v==='string' ? v.slice(0,max) : def; }
function _col(v,def){ return (typeof v==='string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) ? v : def; }

function validateState(raw){
  if(!raw || typeof raw!=='object' || Array.isArray(raw))
    return {ok:false,error:'データの形式が正しくありません'};
  if(!Array.isArray(raw.objects))
    return {ok:false,error:'家具データ(objects)がありません。このアプリのJSONではない可能性があります'};
  if(raw.objects.length>LIM.MAX_OBJ)
    return {ok:false,error:'オブジェクトが多すぎます（'+raw.objects.length+'個 / 上限'+LIM.MAX_OBJ+'個）'};
  const rawLines=Array.isArray(raw.lines)?raw.lines:[];
  if(rawLines.length>LIM.MAX_LINE)
    return {ok:false,error:'配線が多すぎます（'+rawLines.length+'本 / 上限'+LIM.MAX_LINE+'本）'};

  const out={roomW:null,roomH:null,margin:null};
  for(const k of ['roomW','roomH']){
    if(raw[k]===undefined||raw[k]===null) continue;
    if(!_isNum(raw[k])||raw[k]<LIM.ROOM_MIN||raw[k]>LIM.ROOM_MAX)
      return {ok:false,error:'部屋の'+(k==='roomW'?'幅':'奥行')+'が不正です（'+String(raw[k]).slice(0,20)+'）。'+LIM.ROOM_MIN+'〜'+LIM.ROOM_MAX+'mの範囲が必要です'};
    out[k]=raw[k];
  }

  let dropO=0, dropL=0;
  const objs=[];
  for(const o of raw.objects){
    if(!o||typeof o!=='object'||Array.isArray(o)){dropO++;continue;}
    if(!_isNum(o.x)||!_isNum(o.y)||Math.abs(o.x)>LIM.COORD||Math.abs(o.y)>LIM.COORD){dropO++;continue;}
    if(!_isNum(o.w)||!_isNum(o.h)||o.w<LIM.SIZE_MIN||o.h<LIM.SIZE_MIN||o.w>LIM.SIZE_MAX||o.h>LIM.SIZE_MAX){dropO++;continue;}
    const dn=_str(o.defName,80,'')||_str(o.name,80,'')||_str(o.label,80,'')||'不明';
    const c={id:o.id,defName:dn,label:(typeof o.label==='string'?o.label.slice(0,80):dn),
      x:o.x,y:o.y,w:o.w,h:o.h,
      rot:(_isNum(o.rot)&&Math.abs(o.rot)<=3600)?o.rot:0,
      color:_col(o.color,'#4a90d9'),
      round:!!o.round,isWindow:!!o.isWindow,isDoor:!!o.isDoor,doorArc:!!o.doorArc,isStair:!!o.isStair};
    if(o.isComment) c.isComment=true;
    if(o.isSpawn) c.isSpawn=true;
    if(typeof o.name==='string') c.name=o.name.slice(0,80);
    if(typeof o.icon==='string') c.icon=o.icon.slice(0,8);
    if(typeof o.itemId==='string' && o.itemId.trim()) c.itemId=o.itemId.trim().slice(0,40);
    if(typeof o.note==='string' && o.note.trim()) c.note=o.note.trim().slice(0,120);
    if(typeof o.cat==='string' && o.cat) c.cat=o.cat.slice(0,30);
    if(_isNum(o.layerId)) c.layerId=Math.trunc(o.layerId);
    objs.push(c);
  }
  if(raw.objects.length>0 && objs.length===0)
    return {ok:false,error:'有効なオブジェクトが1つもありません（'+raw.objects.length+'個すべてが不正）'};

  const lns=[];
  for(const l of rawLines){
    if(!l||typeof l!=='object'||Array.isArray(l)){dropL++;continue;}
    if(!['x1','y1','x2','y2'].every(k=>_isNum(l[k])&&Math.abs(l[k])<=LIM.COORD)){dropL++;continue;}
    const c={id:l.id,x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,
      color:_col(l.color,'#ffcc00'),
      width:_isNum(l.width)?Math.min(20,Math.max(0.5,l.width)):2,
      dash:(Array.isArray(l.dash)&&l.dash.length<=8&&l.dash.every(n=>_isNum(n)&&n>=0&&n<=100))?l.dash.slice():[],
      label:_str(l.label,40,''),typeId:_str(l.typeId,20,'custom')};
    for(const k of ['showEndpoints','ep1','ep2']) if(typeof l[k]==='boolean') c[k]=l[k];
    if(typeof l.epOverride==='string') c.epOverride=l.epOverride.slice(0,20);
    if(_isNum(l.layerId)) c.layerId=Math.trunc(l.layerId);
    lns.push(c);
  }

  const used=new Set(); let fixedId=0;
  for(const it of [...objs,...lns]){
    if(Number.isInteger(it.id)&&it.id>=0&&!used.has(it.id)) used.add(it.id); else it.id=null;
  }
  let maxId=0; used.forEach(v=>{ if(v>maxId) maxId=v; });
  for(const it of [...objs,...lns]) if(it.id===null){ it.id=++maxId; fixedId++; }
  out.objects=objs; out.lines=lns;
  out.nextId=Math.max(maxId+1,(Number.isInteger(raw.nextId)&&raw.nextId<1e9)?raw.nextId:0);
  out.layers=raw.layers; out.activeLayerId=raw.activeLayerId; out.persons=raw.persons;
  if(_isNum(raw.margin) && raw.margin>=0 && raw.margin<=MAX_MARGIN) out.margin=raw.margin;

  const notes=[];
  if(dropO) notes.push('不正なオブジェクト'+dropO+'個を除外');
  if(dropL) notes.push('不正な配線'+dropL+'本を除外');
  if(fixedId) notes.push('ID重複・欠落'+fixedId+'件を修復');
  return {ok:true,state:out,notes};
}

function applyState(raw){
  applyState.lastError=''; applyState.lastNotes=[];
  let v;
  try{ v=validateState(raw); }catch(ex){ v={ok:false,error:'検証中にエラー: '+(ex&&ex.message||ex)}; }
  if(!v.ok){ applyState.lastError=v.error; showToast('読み込めません: '+v.error); return false; }
  const s=v.state;
  if(typeof window._opHistoryFlush==='function') window._opHistoryFlush();
  const bk={roomW,roomH,workMargin,objects,lines,nextId,
    layer:(typeof window._opLayerSnapshot==='function')?window._opLayerSnapshot():null};
  try{
    if(s.roomW!==null) roomW=s.roomW;
    if(s.roomH!==null) roomH=s.roomH;
    objects=s.objects; lines=s.lines; nextId=s.nextId;
    workMargin=Math.max(0,Math.min(MAX_MARGIN,(s.margin===null||s.margin===undefined)?3:s.margin));
    workMargin=Math.max(workMargin,neededMargin());
    selectedIds=new Set(); selectedLineIds=new Set();
    if(typeof window._opRestoreLayers==='function') window._opRestoreLayers(s);
    syncRoomInputs(); fitRoom(); draw(); updatePropPanel(); updateCounts();
    if(typeof window._opSync3DIfOpen==='function') window._opSync3DIfOpen();
    if(typeof window._opHistoryCommit==='function') window._opHistoryCommit('データの読込');
    if(v.notes.length){
      applyState.lastNotes=v.notes;
      const msg='読み込み完了（'+v.notes.join('、')+'）';
      console.info('applyState:',msg); setTimeout(()=>showToast(msg),1800);
    }
    return true;
  }catch(ex){
    roomW=bk.roomW; roomH=bk.roomH; workMargin=bk.workMargin; objects=bk.objects; lines=bk.lines; nextId=bk.nextId;
    selectedIds=new Set(); selectedLineIds=new Set();
    if(bk.layer&&typeof window._opLayerRestoreSnapshot==='function') window._opLayerRestoreSnapshot(bk.layer);
    try{ syncRoomInputs(); resizeCanvas(); draw(); updatePropPanel(); updateCounts(); }catch(_){}
    applyState.lastError='読み込み中にエラーが発生したため、元の状態に戻しました（'+(ex&&ex.message||ex)+'）';
    console.error('applyState rolled back:',ex); showToast(applyState.lastError);
    return false;
  }
}

function stateToJSON(){ return JSON.stringify(getState(), null, 2); }
function jsonToState(s){ try{ return JSON.parse(s); }catch(e){ return null; } }
function b64ToState(b){ try{ return jsonToState(decodeURIComponent(atob(b))); }catch(e){ return null; } }

// ─── 読込前バックアップ ──────────────────────────────────────
const BACKUP_KEY='op_backup_v1';
function opStoreBackup(label,json){
  const b={label,time:Date.now(),json}; window._opLoadBackup=b;
  try{ localStorage.setItem(BACKUP_KEY,JSON.stringify(b)); }catch(ex){}
}
function opGetBackup(){
  if(window._opLoadBackup) return window._opLoadBackup;
  try{
    const raw=localStorage.getItem(BACKUP_KEY);
    if(raw){ const b=JSON.parse(raw); if(b&&typeof b.json==='string'&&typeof b.label==='string'&&Number.isFinite(b.time)){ window._opLoadBackup=b; return b; } }
  }catch(ex){}
  return null;
}
function opWithBackup(label,fn){
  let pre=null;
  try{ const s=getState(); if((s.objects&&s.objects.length)||(s.lines&&s.lines.length)) pre=JSON.stringify(s); }catch(ex){}
  const ok=fn();
  if(ok && pre) opStoreBackup(label,pre);
  return ok;
}
function opReleaseSlot(){ if(typeof window._opClearCurrentSlot==='function') window._opClearCurrentSlot(); }
function opRestoreBackup(){
  const b=opGetBackup(); if(!b) return false;
  let st; try{ st=JSON.parse(b.json); }catch(ex){ showToast('退避データが壊れているため戻せません'); return false; }
  const ok=opWithBackup('復元前',()=>applyState(st));
  if(ok){ opReleaseSlot(); saveLS(); showToast('「'+b.label+'」の状態に戻しました'); }
  return ok;
}

// ─── 共有URL & テンプレート読込 ─────────────────────────────
async function encodeShareHash(stateObj){
  const json = JSON.stringify(stateObj);
  if(typeof CompressionStream !== 'undefined'){
    try{
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for(let i=0; i<bytes.length; i+=0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
      return 'gz:' + btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }catch(e){ console.warn('gzip encode fallback:', e); }
  }
  return btoa(encodeURIComponent(json));
}
async function decodeShareHash(str){
  let h = String(str||'').trim();
  if(h.includes('#')) h = h.split('#').pop();
  if(!h) return null;
  if(h.startsWith('gz:')){
    if(typeof DecompressionStream === 'undefined') throw new Error('このブラウザは圧縮URLの展開に対応していません');
    let b64 = h.slice(3).replace(/-/g,'+').replace(/_/g,'/');
    while(b64.length % 4) b64 += '=';
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for(let i=0; i<bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return jsonToState(await new Response(stream).text());
  }
  return b64ToState(h);
}
function getLayoutQuery(){
  try{
    const q = new URLSearchParams(location.search).get('layout');
    if(!q) return null;
    const clean = q.trim().replace(/^layouts\//,'');
    if(!clean || clean.includes('..') || clean.includes('/') || clean.includes('\\')) return null;
    return clean.endsWith('.json') ? clean : (clean + '.json');
  }catch(e){ return null; }
}
async function loadExternalStartup(){
  const h = location.hash.replace('#','').trim();
  if(h){
    try{
      const st = await decodeShareHash(h);
      if(st && applyState(st)){ showToast('🔗 共有リンクから読み込みました', 3500); return true; }
    }catch(ex){ console.warn('loadHash fail', ex); showToast('共有リンクの読み込みに失敗しました', 4000); }
  }
  const lf = getLayoutQuery();
  if(lf){
    try{
      const res = await fetch('./layouts/' + encodeURIComponent(lf) + '?t=' + Date.now());
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const st = await res.json();
      if(st && applyState(st)){ opReleaseSlot(); showToast('📚 テンプレート「' + lf + '」を読み込みました', 3500); return true; }
    }catch(ex){ console.warn('layout param fail', ex); showToast('テンプレート「' + lf + '」を読み込めませんでした', 4000); }
  }
  return false;
}
async function refreshTemplateList(){
  const sec=document.getElementById('tpl-section'), sel=document.getElementById('tpl-select'), desc=document.getElementById('tpl-desc'), btn=document.getElementById('tpl-load-btn');
  if(!sec || !sel) return;
  sec.style.display='block'; sel.innerHTML='<option value="">読み込み中...</option>';
  if(btn) btn.disabled=true;
  try{
    const res = await fetch('./layouts/index.json?t=' + Date.now());
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const list = JSON.parse((await res.text()).replace(/^\uFEFF/, ''));
    if(!Array.isArray(list) || !list.length) throw new Error('項目が空です');
    sel.innerHTML='';
    list.forEach(it=>{
      if(!it || !it.file) return;
      const opt=document.createElement('option'); opt.value=it.file; opt.textContent=it.name||it.file; opt.dataset.desc=it.desc||'';
      sel.appendChild(opt);
    });
    if(!sel.options.length) throw new Error('有効な項目がありません');
    const updDesc=()=>{ const o=sel.options[sel.selectedIndex]; if(desc) desc.textContent=(o&&o.dataset.desc)?o.dataset.desc:''; };
    sel.onchange=updDesc; updDesc();
    if(btn) btn.disabled=false;
  }catch(e){
    sel.innerHTML='<option value="">（テンプレートを読めませんでした）</option>';
    if(desc) desc.textContent='理由: '+e.message+'（GitHub Pages上の ./layouts/index.json を確認）';
    if(btn) btn.disabled=true;
  }
}

// ─── ローカル自動保存 ────────────────────────────────────────
let autosaveFailed=false, saveTimer=null, badgeTimer=null;
function saveLS(){
  const el=document.getElementById('sb-save');
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(getState()));
    if(autosaveFailed){ autosaveFailed=false; showToast('自動保存が回復しました'); }
    el.style.color=''; el.textContent='ブラウザに自動保存済 '+new Date().toLocaleTimeString('ja-JP');
    return true;
  }catch(ex){
    console.info('LS save fail',ex); el.style.color='var(--warn)';
    el.textContent='⚠ 自動保存に失敗しました（容量不足など）。「保存」でJSONに書き出してください';
    if(!autosaveFailed){ autosaveFailed=true; showToast('自動保存に失敗しました。「📤 保存」でJSONファイルに書き出してください。',5000); }
    return false;
  }
}
(function(){ const el=document.getElementById('sb-save'); if(el) el.title='ブラウザへの自動保存の状態です（スロットへの保存とは別です）'; })();
function loadLS(){
  let raw=null; try{ raw=localStorage.getItem(LS_KEY); }catch(ex){ return false; }
  if(!raw) return false;
  try{
    if(typeof window._opSafeBootRequested==='function' && window._opSafeBootRequested()){
      if(typeof window._opStashCorrupt==='function'){ window._opStashCorrupt(raw,'保存データを読み込まずに起動しました'); if(window._opBootNotice) window._opBootNotice.kind='safe'; }
      return false;
    }
    const state=jsonToState(raw);
    let ok=false, reason='';
    if(!state) reason='JSONとして読み取れませんでした';
    else { ok=applyState(state); if(!ok) reason=applyState.lastError||'形式が正しくありません'; }
    if(!ok && typeof window._opStashCorrupt==='function') window._opStashCorrupt(raw,reason);
    return ok;
  }catch(ex){ console.info('LS load fail',ex); return false; }
}
function scheduleSave(){
  opEnsureMargin(); updateOutsideInfo();
  document.getElementById('sb-save').textContent='保存中…';
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer=setTimeout(saveLS,500);
  clearTimeout(badgeTimer); badgeTimer=setTimeout(updateCurrentSlotBadge,700);
  if(typeof window._opHistoryNote==='function') window._opHistoryNote();
}

// ─── 10スロット保存管理 ──────────────────────────────────────
const SLOTS_KEY='op_slots_v1', SLOT_NAMES_KEY='op_slot_names_v1', MAX_SLOTS=10;
const slotWrap=document.createElement('div');
slotWrap.id='slot-panel-wrap';
slotWrap.innerHTML=`<div id="slot-panel"><h2>📁 部屋データスロット（最大${MAX_SLOTS}件）</h2><div id="slot-list"></div><button id="slot-close-btn">✕ 閉じる</button></div>`;
document.body.appendChild(slotWrap);
slotWrap.addEventListener('click',e=>{ if(e.target===slotWrap) closeSlotPanel(); });
document.getElementById('slot-close-btn').addEventListener('click',closeSlotPanel);

const slotBtn=document.createElement('button'); slotBtn.className='hbtn'; slotBtn.id='btn-slots'; slotBtn.textContent='📁 スロット';
const rulerBtn2=document.getElementById('btn-ruler');
if(rulerBtn2) rulerBtn2.parentNode.insertBefore(slotBtn,rulerBtn2); else document.getElementById('header').appendChild(slotBtn);
slotBtn.addEventListener('click',openSlotPanel);

const curBadge=document.createElement('div'); curBadge.id='cur-slot-badge';
curBadge.style.cssText='font-size:10px;color:var(--text3);white-space:nowrap;padding:0 4px;';
slotBtn.insertAdjacentElement('afterend',curBadge);

let currentSlot=null, slotBaseline=null;
function loadSlots(){ try{ return JSON.parse(localStorage.getItem(SLOTS_KEY)||'{}'); }catch{ return {}; } }
function saveSlots(slots){
  try{ localStorage.setItem(SLOTS_KEY,JSON.stringify(slots)); return true; }
  catch(e){ showToast('保存に失敗しました（ブラウザの保存容量が足りない可能性があります）。「📤 保存」でJSONファイルに書き出してください。',5000); return false; }
}
function loadSlotNames(){
  try{ const r=JSON.parse(localStorage.getItem(SLOT_NAMES_KEY)||'{}'), o={}; for(let i=0;i<MAX_SLOTS;i++) o[i]=r[i]||''; return o; }catch{ return {}; }
}
function saveSlotNames(names){ try{ localStorage.setItem(SLOT_NAMES_KEY,JSON.stringify(names)); }catch{} }
function markSlotClean(){ try{ slotBaseline=JSON.stringify(getState()); }catch(e){ slotBaseline=null; } }
function slotIsDirty(){ if(currentSlot===null||slotBaseline===null) return false; try{ return JSON.stringify(getState())!==slotBaseline; }catch(e){ return false; } }
function updateCurrentSlotBadge(){
  if(currentSlot===null){
    curBadge.textContent='スロット未選択'; curBadge.style.color='var(--text3)';
    curBadge.title='どのスロットにも関連付いていません（Ctrl+S でスロット画面が開きます）'; return;
  }
  const name=loadSlotNames()[currentSlot]||`スロット${currentSlot+1}`;
  if(slotIsDirty()){
    curBadge.textContent=`[${name}] ● 未反映`; curBadge.style.color='var(--warn)';
    curBadge.title='このスロットに保存した後の変更があります（Ctrl+S でスロットに反映）';
  } else {
    curBadge.textContent=`[${name}] ✓ 保存済み`; curBadge.style.color='var(--accent)';
    curBadge.title='このスロットと現在の内容は一致しています';
  }
}
window._opCurrentSlotName=()=>currentSlot===null?'':(loadSlotNames()[currentSlot]||'').trim();
window._opClearCurrentSlot=()=>{ currentSlot=null; slotBaseline=null; updateCurrentSlotBadge(); };
function openSlotPanel(){ renderSlotList(); slotWrap.classList.add('open'); }
function closeSlotPanel(){ slotWrap.classList.remove('open'); }

function renderSlotList(){
  const slots=loadSlots(), names=loadSlotNames(), list=document.getElementById('slot-list');
  list.innerHTML='';
  for(let i=0;i<MAX_SLOTS;i++){
    const hasData=!!slots[i], isCur=currentSlot===i;
    const row=document.createElement('div'); row.className='slot-row';
    const num=document.createElement('div'); num.className='slot-num'; num.textContent=(i+1)+'番';
    const inp=document.createElement('input'); inp.className='slot-name-inp'; inp.type='text';
    inp.placeholder=hasData?`スロット${i+1}`:`スロット${i+1}（空）`; inp.value=names[i]||''; inp.maxLength=24;
    inp.addEventListener('change',()=>{ const ns=loadSlotNames(); ns[i]=inp.value.trim(); saveSlotNames(ns); });

    const loadBtn=document.createElement('button');
    loadBtn.className='slot-btn'+(isCur?' active-slot':''); loadBtn.textContent=isCur?'✓現在':'読込';
    loadBtn.disabled=!hasData; loadBtn.style.opacity=hasData?'1':'0.35';
    loadBtn.addEventListener('click',()=>{
      if(!hasData) return;
      try{
        if(opWithBackup('スロット読込前',()=>applyState(JSON.parse(slots[i])))){
          currentSlot=i; markSlotClean(); saveLS();
          showToast(`📂 ${inp.value.trim()||`スロット${i+1}`} を読み込みました`);
          updateCurrentSlotBadge(); renderSlotList(); closeSlotPanel();
        }
      }catch(e){ showToast('読込エラー: '+e.message); }
    });

    const saveBtn=document.createElement('button'); saveBtn.className='slot-btn'; saveBtn.textContent='保存';
    saveBtn.addEventListener('click',()=>{
      const label0=inp.value.trim()||`スロット${i+1}`;
      if(hasData && currentSlot!==i && !confirm(`「${label0}」には保存済みの内容があります。現在の内容で上書きしますか？`)) return;
      try{
        const sl=loadSlots(); sl[i]=JSON.stringify(getState());
        if(!saveSlots(sl)) return;
        const ns=loadSlotNames(); if(!ns[i]) ns[i]=inp.value.trim(); saveSlotNames(ns);
        currentSlot=i; markSlotClean();
        showToast(`💾 ${label0} に保存しました`); updateCurrentSlotBadge(); renderSlotList();
      }catch(e){ showToast('保存エラー: '+e.message); }
    });

    const delBtn=document.createElement('button'); delBtn.className='slot-btn danger'; delBtn.textContent='削除';
    delBtn.disabled=!hasData; delBtn.style.opacity=hasData?'1':'0.25';
    delBtn.addEventListener('click',()=>{
      if(!hasData) return;
      const dname=inp.value.trim()||`スロット${i+1}`;
      if(!confirm(`「${dname}」を削除しますか？`)) return;
      const sl=loadSlots(); delete sl[i]; if(!saveSlots(sl)) return;
      if(currentSlot===i){ currentSlot=null; slotBaseline=null; }
      showToast(`🗑 ${dname} を削除しました`); updateCurrentSlotBadge(); renderSlotList();
    });

    const expBtn=document.createElement('button'); expBtn.className='slot-btn'; expBtn.textContent='⬇JSON';
    expBtn.disabled=!hasData; expBtn.style.opacity=hasData?'1':'0.25';
    expBtn.addEventListener('click',()=>{
      if(!hasData) return;
      const dname=inp.value.trim()||`slot${i+1}`;
      const blob=new Blob([slots[i]],{type:'application/json;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download=`layout_${dname.replace(/[^\w\-]/g,'_')}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    row.appendChild(num); row.appendChild(inp); row.appendChild(loadBtn); row.appendChild(saveBtn); row.appendChild(delBtn); row.appendChild(expBtn);
    list.appendChild(row);
  }
  const bk=opGetBackup();
  if(bk){
    const brow=document.createElement('div'); brow.style.cssText='padding:8px 0 2px;border-top:1px solid var(--border);margin-top:6px;';
    const bb=document.createElement('button'); bb.className='slot-btn'; bb.style.width='100%';
    bb.textContent='↩ 直前の状態に戻す（'+bk.label+'・'+new Date(bk.time).toLocaleTimeString('ja-JP')+'）';
    bb.addEventListener('click',()=>{ if(opRestoreBackup()) closeSlotPanel(); });
    brow.appendChild(bb); list.appendChild(brow);
  }
}

document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='s'&&!e.shiftKey){
    e.preventDefault(); if(opModalOpen()) return;
    if(currentSlot!==null){
      try{
        const sl=loadSlots(); sl[currentSlot]=JSON.stringify(getState());
        if(!saveSlots(sl)) return;
        markSlotClean(); updateCurrentSlotBadge();
        showToast(`💾 ${loadSlotNames()[currentSlot]||`スロット${currentSlot+1}`} に保存 (Ctrl+S)`);
      }catch(e2){ showToast('保存失敗: '+e2.message); }
    } else { openSlotPanel(); showToast('スロットを選択して保存してください'); }
  }
});

// ─── 高解像度PNG画像保存 ────────────────────────────────────
const IE_KEY='op_imgexp_v1', IE_TARGET={std:2400,high:4800,max:9000};
const IE_IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const IE_MAX_PIXELS=IE_IOS?16e6:50e6, IE_MAX_SIDE=16000;

function ieRegion(area,S){
  const vis=lid=>(typeof isLayerVisible==='function')?isLayerVisible(lid):true;
  let b;
  if(area==='room') b={x0:-0.3,y0:-0.3,x1:roomW+0.3,y1:roomH+0.3};
  else if(area==='work') b={x0:-workMargin,y0:-workMargin,x1:roomW+workMargin,y1:roomH+workMargin};
  else {
    const list=[{x0:0,y0:0,x1:roomW,y1:roomH}];
    for(const o of objects) if(vis(o.layerId||1)) list.push(objBounds(o));
    for(const l of lines) if(vis(l.layerId||5)) list.push({x0:Math.min(l.x1,l.x2),y0:Math.min(l.y1,l.y2),x1:Math.max(l.x1,l.x2),y1:Math.max(l.y1,l.y2)});
    b=clampToWork(unionBounds(list));
    b={x0:Math.max(-workMargin,b.x0-0.4),y0:Math.max(-workMargin,b.y0-0.4),x1:Math.min(roomW+workMargin,b.x1+0.4),y1:Math.min(roomH+workMargin,b.y1+0.4)};
  }
  const org=workMargin*S, fullW=Math.round((roomW+2*workMargin)*S), fullH=Math.round((roomH+2*workMargin)*S);
  const ox=Math.max(0,Math.floor(org+b.x0*S)), oy=Math.max(0,Math.floor(org+b.y0*S));
  const cw=Math.max(8,Math.min(fullW,Math.ceil(org+b.x1*S))-ox), ch=Math.max(8,Math.min(fullH,Math.ceil(org+b.y1*S))-oy);
  return {ox,oy,cw,ch,fullW,fullH};
}
function iePlan(area,q){
  const S=Math.max(scale,BASE_SCALE), r=ieRegion(area,S);
  let pr=Math.max(1,IE_TARGET[q]/Math.max(r.cw,r.ch));
  pr=Math.min(pr,IE_MAX_SIDE/Math.max(r.cw,r.ch),Math.sqrt(IE_MAX_PIXELS/(r.cw*r.ch)));
  return {S,r,pr,outW:Math.round(r.cw*pr),outH:Math.round(r.ch*pr)};
}
function ieUpdateInfo(){
  const p=iePlan(document.getElementById('ie-area').value,document.getElementById('ie-q').value);
  const want=IE_TARGET[document.getElementById('ie-q').value];
  document.getElementById('ie-info').textContent='出力サイズ: '+p.outW+' × '+p.outH+' px'+(Math.max(p.outW,p.outH)<want*0.98?'（端末の上限のため、これ以上は大きくできません）':'');
}
function ieSave(){
  const o={area:document.getElementById('ie-area').value,q:document.getElementById('ie-q').value,theme:document.getElementById('ie-theme').value};
  try{ localStorage.setItem(IE_KEY,JSON.stringify(o)); }catch(e){}
  return o;
}
function opExportImage(o){
  const p=iePlan(o.area,o.q), r=p.r, bodyLight=document.body.classList.contains('light-mode');
  const keep={scale,mono:viewMono,printing:opPrinting,sel:[...selectedIds],lsel:[...selectedLineIds]};
  const sc=scroller(), sl=sc.scrollLeft, st=sc.scrollTop;
  try{
    scale=p.S; opPrinting=true; selectedIds.clear(); selectedLineIds.clear();
    if(o.theme==='light'){ viewMono=false; document.body.classList.add('light-mode'); }
    else if(o.theme==='mono'){ viewMono=true; document.body.classList.add('light-mode'); }
    canvas.width=Math.round(r.cw*p.pr); canvas.height=Math.round(r.ch*p.pr);
    window._opExp={pr:p.pr,ox:r.ox,oy:r.oy,W:r.fullW,H:r.fullH};
    draw();
    const d=new Date(), z=n=>(n<10?'0':'')+n;
    const name='office-plan-'+d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes())+'.png';
    canvas.toBlob(blob=>{
      if(!blob){ showError('画像を作れませんでした。解像度を下げて、もう一度お試しください。'); return; }
      const u=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=u; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(u),3000);
      showToast('🖼 保存しました（'+p.outW+'×'+p.outH+' px）');
    },'image/png');
  }catch(e){ showError('画像の保存に失敗しました: '+e.message); }
  finally{
    window._opExp=null; scale=keep.scale; viewMono=keep.mono; opPrinting=keep.printing;
    document.body.classList.toggle('light-mode',bodyLight);
    keep.sel.forEach(v=>selectedIds.add(v)); keep.lsel.forEach(v=>selectedLineIds.add(v));
    resizeCanvas(); sc.scrollLeft=sl; sc.scrollTop=st;
  }
}

document.getElementById('btn-imgexp').onclick=()=>{
  try{ const s=JSON.parse(localStorage.getItem(IE_KEY)||'null');
    if(s){ if(s.area) document.getElementById('ie-area').value=s.area; if(s.q) document.getElementById('ie-q').value=s.q; if(s.theme) document.getElementById('ie-theme').value=s.theme; } }catch(e){}
  ieUpdateInfo(); showModal('modal-imgexp');
};
['ie-area','ie-q','ie-theme'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{ ieUpdateInfo(); ieSave(); }));
document.getElementById('ie-cancel').onclick=()=>hideModal('modal-imgexp');
document.getElementById('ie-ok').onclick=()=>{ const o=ieSave(); hideModal('modal-imgexp'); setTimeout(()=>opExportImage(o),30); };

// ─── 共有・JSON保存/読込・クリアボタン ─────────────────────
document.getElementById('btn-share').onclick=async ()=>{
  const ta=document.getElementById('share-url'), infoEl=document.getElementById('share-len-info');
  ta.value='共有URLを生成中...'; showModal('modal-share');
  try{
    const hash=await encodeShareHash(getState());
    const url=location.href.split('#')[0].split('?')[0]+'#'+hash;
    ta.value=url;
    if(infoEl) infoEl.textContent='URLの長さ: '+url.length.toLocaleString()+' 文字（gzip圧縮済み）';
  }catch(ex){ ta.value=''; showError('共有URLの作成に失敗しました: '+ex.message); }
};
document.getElementById('ms-close').onclick=()=>hideModal('modal-share');
document.getElementById('ms-copy').onclick=()=>{
  const ta=document.getElementById('share-url'); ta.select();
  try{ navigator.clipboard.writeText(ta.value).then(()=>showToast('URLをコピーしました！')); }
  catch{ try{ document.execCommand('copy'); showToast('URLをコピーしました！'); }catch(ex){ showToast('手動でコピーしてください'); } }
};
document.getElementById('btn-export').onclick=()=>{
  try{
    const blob=new Blob([stateToJSON()],{type:'application/json;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url; a.download='office_layout_'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('JSONファイルを保存しました');
  }catch(ex){ showError('保存に失敗しました: '+ex.message); }
};
const miFileInput=document.getElementById('mi-file-input');
document.getElementById('btn-import').onclick=()=>{
  document.getElementById('import-data').value='';
  if(typeof refreshTemplateList==='function') refreshTemplateList();
  showModal('modal-import');
};
const tplLoadBtn=document.getElementById('tpl-load-btn');
if(tplLoadBtn) tplLoadBtn.onclick=async ()=>{
  const sel=document.getElementById('tpl-select');
  const file=sel?sel.value:'';
  if(!file){ showToast('テンプレートを選択してください'); return; }
  const clean=file.trim().replace(/^layouts\//,'');
  if(!clean||clean.includes('..')||clean.includes('/')||clean.includes('\\')){
    showError('不正なファイル名です'); return;
  }
  try{
    const res=await fetch('./layouts/'+encodeURIComponent(clean)+'?t='+Date.now());
    if(!res.ok) throw new Error('HTTP '+res.status);
    const state=await res.json();
    if(state && opWithBackup('テンプレート読込前',()=>applyState(state))){
      opReleaseSlot(); saveLS(); hideModal('modal-import');
      const label=(sel.options[sel.selectedIndex]&&sel.options[sel.selectedIndex].textContent)||clean;
      showToast('📚 テンプレート「'+label+'」を読み込みました',3500);
    } else {
      showError('テンプレートを読み込めませんでした。\n理由: '+(applyState.lastError||'形式が正しくありません'));
    }
  }catch(ex){
    showError('テンプレートの読み込みに失敗しました: '+ex.message);
  }
};document.getElementById('mi-file-btn').onclick=()=>miFileInput.click();
miFileInput.onchange=(e)=>{
  const file=e.target.files[0]; if(!file) return;
  if(file.size>5*1024*1024){ showError('ファイルが大きすぎます（'+(file.size/1048576).toFixed(1)+'MB / 上限5MB）。\n現在の作業内容はそのまま残っています。'); miFileInput.value=''; return; }
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const state=jsonToState(ev.target.result);
    if(state && opWithBackup('ファイル読込前',()=>applyState(state))){
      opReleaseSlot(); saveLS(); hideModal('modal-import');
      showToast('ファイルから読み込みました（スロットとの関連付けは解除しました）',3500);
    } else {
      showError(state?('ファイルを読み込めませんでした。\n理由: '+(applyState.lastError||'不明')+'\n（現在の作業内容はそのまま残っています）'):'ファイルの解析に失敗しました。JSONとして読み取れません。\n（現在の作業内容はそのまま残っています）');
    }
    miFileInput.value='';
  };
  reader.readAsText(file);
};
document.getElementById('mi-cancel').onclick=()=>hideModal('modal-import');
document.getElementById('mi-ok').onclick=async ()=>{
  const raw=document.getElementById('import-data').value.trim();
  if(!raw){ showToast('データを入力してください'); return; }
  let state=jsonToState(raw);
  if(!state){ try{ state=await decodeShareHash(raw); }catch(ex){} }
  if(state && opWithBackup('貼り付け読込前',()=>applyState(state))){
    opReleaseSlot(); saveLS(); hideModal('modal-import');
    showToast('読み込みました（スロットとの関連付けは解除しました）',3500);
  } else {
    showError(state?('データを読み込めませんでした。\n理由: '+(applyState.lastError||'不明')+'\n（現在の作業内容はそのまま残っています）'):'データの解析に失敗しました。\n共有URL または JSONファイルの内容を貼り付けてください。');
  }
};
document.getElementById('btn-clear').onclick=()=>showModal('modal-clear');
document.getElementById('mc-cancel').onclick=()=>hideModal('modal-clear');
document.getElementById('mc-ok').onclick=()=>{
  opWithBackup('全クリア前',()=>{
    objects=[]; lines=[]; nextId=1; selectedIds=new Set(); selectedLineIds=new Set();
    draw(); updatePropPanel(); updateCounts(); return true;
  });
  opReleaseSlot();
  if(typeof window._opHistoryCommit==='function') window._opHistoryCommit('全クリア');
  if(typeof window._opSync3DIfOpen==='function') window._opSync3DIfOpen();
  saveLS(); hideModal('modal-clear');
  showToast('クリアしました（📁スロット画面の「直前の状態に戻す」で元に戻せます）',4000);
};
document.getElementById('me-ok').onclick=()=>hideModal('modal-error');
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{ if(e.target===ov) ov.classList.remove('show'); }));

// ─── 元に戻す／やり直し（履歴） ──────────────────────────────
(function(){
  const MAX_STEPS=100, MAX_CHARS=30e6, DEBOUNCE=350;
  let undo=[], redo=[], ulab=[], rlab=[], cur=null, timer=null, restoring=false, chars=0;
  const ready=()=>cur!==null;
  function ser(){
    const s=getState();
    return JSON.stringify({roomW:s.roomW,roomH:s.roomH,margin:s.margin,nextId:s.nextId,objects:s.objects,lines:s.lines,
      layers:(s.layers||[]).map(l=>({id:l.id,name:l.name,color:l.color}))});
  }
  function trim(){ while(undo.length>MAX_STEPS||(chars>MAX_CHARS&&undo.length>1)){ chars-=undo.shift().length; ulab.shift(); } }
  function push(label){
    let now; try{ now=ser(); }catch(e){ return false; }
    if(now===cur) return false;
    undo.push(cur); ulab.push(label||null); chars+=cur.length; cur=now; redo=[]; rlab=[]; trim(); refresh(); return true;
  }
  function commit(){ timer=null; if(!ready()||restoring) return false; return push(null); }
  function note(){ if(!ready()||restoring) return; if(timer) clearTimeout(timer); timer=setTimeout(commit,DEBOUNCE); }
  function flush(){ if(timer){ clearTimeout(timer); timer=null; } return ready()&&!restoring ? push(null) : false; }

  function describe(a,b){
    try{
      const A=JSON.parse(a), B=JSON.parse(b);
      if(A.roomW!==B.roomW||A.roomH!==B.roomH) return '部屋サイズの変更';
      const dO=B.objects.length-A.objects.length, dL=B.lines.length-A.lines.length;
      if(dO>0) return '物の追加（'+dO+'個）'; if(dO<0) return '物の削除（'+(-dO)+'個）';
      if(dL>0) return '線の追加'; if(dL<0) return '線の削除';
      if(JSON.stringify(A.objects)!==JSON.stringify(B.objects)){
        const norm=arr=>JSON.stringify(arr.slice().sort((p,q)=>p.id-q.id));
        return norm(A.objects)===norm(B.objects) ? '前面・背面の入れ替え' : '物の変更（移動・サイズ・名前など）';
      }
      if(JSON.stringify(A.lines)!==JSON.stringify(B.lines)) return '線の変更';
      if(A.margin!==B.margin) return '余白の変更';
      if(JSON.stringify(A.layers)!==JSON.stringify(B.layers)) return 'レイヤーの変更';
    }catch(e){}
    return '変更';
  }
  function restore(str){
    const s=JSON.parse(str); restoring=true;
    try{
      const now=getState(), vis=new Map((now.layers||[]).map(l=>[l.id,l.visible]));
      roomW=s.roomW; roomH=s.roomH; objects=s.objects; lines=s.lines; nextId=s.nextId;
      workMargin=Math.max(0,Math.min(MAX_MARGIN,(typeof s.margin==='number')?s.margin:3));
      workMargin=Math.max(workMargin,neededMargin());
      const lys=(s.layers||[]).map(l=>({id:l.id,name:l.name,color:l.color,visible:vis.has(l.id)?vis.get(l.id):true}));
      const act=lys.some(l=>l.id===now.activeLayerId)?now.activeLayerId:(lys[0]?lys[0].id:1);
      if(typeof window._opRestoreLayers==='function') window._opRestoreLayers({layers:lys,activeLayerId:act,persons:now.persons});
      selectedIds=new Set([...selectedIds].filter(id=>objects.some(o=>o.id===id)));
      selectedLineIds=new Set([...selectedLineIds].filter(id=>lines.some(l=>l.id===id)));
      drawingLine=null; syncRoomInputs(); setZoom(scale); updatePropPanel(); updateCounts(); scheduleSave();
    }finally{ restoring=false; }
  }
  const busy=()=>(typeof dragging!=='undefined'&&dragging)||(typeof draggingLine!=='undefined'&&draggingLine);
  function doUndo(){
    if(!ready()||busy()) return false;
    flush(); if(!undo.length){ showToast('これ以上、元に戻せません'); return false; }
    const prev=undo.pop(); chars-=prev.length; const lab=ulab.pop()||describe(prev,cur);
    redo.push(cur); rlab.push(lab); restore(prev); cur=ser(); refresh();
    showToast('元に戻しました：'+lab,2500); return true;
  }
  function doRedo(){
    if(!ready()||busy()) return false;
    flush(); if(!redo.length){ showToast('やり直せる操作がありません'); return false; }
    const next=redo.pop(); const lab=rlab.pop()||describe(cur,next);
    undo.push(cur); ulab.push(lab); chars+=cur.length; restore(next); cur=ser(); trim(); refresh();
    showToast('やり直しました：'+lab,2500); return true;
  }

  const hdr=document.getElementById('header');
  const mk=(id,label,title,fn)=>{ const b=document.createElement('button'); b.className='hbtn'; b.id=id; b.textContent=label; b.title=title; b.addEventListener('click',fn); return b; };
  const ub=mk('btn-undo','↶','元に戻す（Ctrl+Z）',doUndo), rb=mk('btn-redo','↷','やり直し（Ctrl+Y）',doRedo);
  const imp=document.getElementById('btn-import');
  if(imp){ hdr.insertBefore(ub,imp); hdr.insertBefore(rb,imp); } else { hdr.appendChild(ub); hdr.appendChild(rb); }
  function refresh(){
    const can=(b,n,t)=>{ b.disabled=!n; b.style.opacity=n?'':'.4'; b.title=t+(n?'（残り '+n+' 回）':'（できる操作はありません）'); };
    can(ub,undo.length,'元に戻す（Ctrl+Z）'); can(rb,redo.length,'やり直し（Ctrl+Y）');
  }
  document.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)) return;
    const k=String(e.key).toLowerCase();
    const isUndo=(k==='z'&&!e.shiftKey), isRedo=(k==='y')||(k==='z'&&e.shiftKey);
    if((!isUndo&&!isRedo) || !opEditKeysAllowed(e)) return;
    e.preventDefault(); if(isUndo) doUndo(); else doRedo();
  });
  window._opHistoryNote=note;
  window._opHistoryFlush=flush;
  window._opHistoryCommit=(label)=>{ if(!ready()||restoring) return; if(timer){ clearTimeout(timer); timer=null; } push(label); };
  window._opHistoryInit=()=>{ cur=ser(); refresh(); };
  window._opHistoryInfo=()=>({undo:undo.length,redo:redo.length,chars});
  refresh();
})();

// ─── 起動シーケンス ──────────────────────────────────────────
try{
  updateCurrentSlotBadge();
  migrateLayerIds();
  updateActiveBadge();
  buildSidebar('furniture');

  const _hasExt = !!location.hash.replace('#','').trim() || !!getLayoutQuery();
  if(!_hasExt){
    loadLS();
  } else {
    loadExternalStartup().then(ok=>{
      if(!ok) loadLS();
      syncRoomInputs(); updateCounts();
      if(typeof window._opHistoryInit==='function') window._opHistoryInit();
    });
  }
  if(typeof window._opShowBootNotice==='function') window._opShowBootNotice();
  syncRoomInputs();
  updateCounts();
  setTimeout(()=>{
    fitRoom();
    if(typeof window._opHistoryInit==='function') window._opHistoryInit();
  }, 60);
  document.getElementById('sb-save').textContent='ローカル保存有効';
}catch(ex){
  console.error(ex);
  if(typeof window._opBootFailed==='function') window._opBootFailed(ex);
  else alert('起動中にエラーが発生しました: '+((ex&&ex.message)||ex));
}