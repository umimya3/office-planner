/* イースターエッグ: ラバーダック & ゴールデン・ディスコ（元データ・保存領域は無汚染） */
(function(){
'use strict';

let mode = 'off'; // 'off' | 'duck' | 'disco'
let clickCount = 0, clickTimer = null;
let raf2D = null, last2D = 0;
let raf3D = null;

// 3D一時変更の退避用（OFF時に完全復元する）
let easterGroup = null;
let duckTemplate = null;
let goldFurnMat = null, goldFloorMat = null, goldWallMat = null;
const hiddenMeshes = [];
const savedMats = new Map();
const savedLights = [];
let savedBg = null;
let appliedRef = null;

// ─── トリガー（ロゴ5連打 ＋ 発動中バッジ） ───────────────────
const logo = document.querySelector('#header .logo');
const badge = document.createElement('span');
badge.id = 'easter-badge';
badge.style.cssText = 'display:none;margin-left:6px;padding:2px 6px;border-radius:10px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--surface2);vertical-align:middle;user-select:none;';
badge.title = 'クリックで裏モード切替 / 解除';
if(logo){
  logo.style.cursor = 'pointer';
  logo.parentNode.insertBefore(badge, logo.nextSibling);
  logo.addEventListener('click', ()=>{
    if(mode !== 'off'){ cycleMode(); return; }
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(()=>{ clickCount = 0; }, 1200);
    if(clickCount >= 5){
      clickCount = 0;
      cycleMode();
    }
  });
  badge.addEventListener('click', cycleMode);
}

function cycleMode(){
  const next = mode === 'off' ? 'duck' : (mode === 'duck' ? 'disco' : 'off');
  setMode(next);
}

function setMode(next){
  cleanup3D();
  stopLoops();
  mode = next;

  if(mode === 'duck'){
    badge.style.display = 'inline-block';
    badge.textContent = '🐥';
    if(typeof showToast === 'function') showToast('🐥 裏モード：ラバーダック・オフィス！（3D表示がおすすめ）', 3200);
    startLoops();
  } else if(mode === 'disco'){
    badge.style.display = 'inline-block';
    badge.textContent = '🪩';
    if(typeof showToast === 'function') showToast('🪩 裏モード：ゴールデン・ディスコ！（3D表示がおすすめ）', 3200);
    startLoops();
  } else {
    badge.style.display = 'none';
    if(typeof showToast === 'function') showToast('🏢 通常オフィスに戻りました', 2000);
    if(typeof draw === 'function') draw();
  }
}

// ─── 2Dオーバーレイ演出 ───────────────────────────────────────
const _prevOverlay = window._opDrawOverlays;
window._opDrawOverlays = function(){
  if(typeof _prevOverlay === 'function') _prevOverlay();
  if(mode === 'off' || typeof ctx === 'undefined' || typeof objects === 'undefined') return;

  const t = performance.now() / 1000;
  const RW = mToPx(roomW), RH = mToPx(roomH);

  if(mode === 'disco'){
    ctx.save();
    ctx.fillStyle = 'rgba(10, 6, 28, 0.35)';
    ctx.fillRect(0, 0, RW, RH);
    const cols = ['#ff33aa','#33ddff','#ffd700','#66ff66','#aa55ff'];
    for(let i = 0; i < 5; i++){
      const ang = t * (0.9 + i * 0.23) + i * 1.25;
      const sx = RW * 0.5 + Math.cos(ang) * RW * 0.34;
      const sy = RH * 0.5 + Math.sin(ang * 1.3) * RH * 0.34;
      const rad = Math.max(24, Math.min(RW, RH) * 0.16);
      const grd = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad);
      grd.addColorStop(0, cols[i] + '88');
      grd.addColorStop(1, cols[i] + '00');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
    }
    // 家具を金色に縁取り
    for(const o of objects){
      if(typeof isLayerVisible === 'function' && !isLayerVisible(o.layerId || 1)) continue;
      if(o.isWindow || o.isStair || /^壁/.test(o.defName||'')) continue;
      const pw = mToPx(o.w), ph = mToPx(o.h);
      ctx.save();
      ctx.translate(mToPx(o.x) + pw/2, mToPx(o.y) + ph/2);
      ctx.rotate((o.rot || 0) * Math.PI / 180);
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.2;
      ctx.strokeRect(-pw/2, -ph/2, pw, ph);
      ctx.restore();
    }
    ctx.restore();
  } else if(mode === 'duck'){
    ctx.save();
    for(const o of objects){
      if(typeof isLayerVisible === 'function' && !isLayerVisible(o.layerId || 1)) continue;
      if(o.isWindow || o.isStair || /^壁/.test(o.defName||'')) continue;
      const pw = mToPx(o.w), ph = mToPx(o.h);
      const cx = mToPx(o.x) + pw/2, cy = mToPx(o.y) + ph/2;
      const bob = Math.sin(t * 4 + o.id) * 2.5;
      const r = Math.max(7, Math.min(pw, ph) * 0.36);
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.fillStyle = '#ffe033'; ctx.strokeStyle = '#d48800'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `${Math.max(10, Math.round(r * 1.25))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐥', 0, 1);
      ctx.restore();
    }
    ctx.restore();
  }
};

// ─── 3Dアヒル・テンプレート生成 ───────────────────────────────
function getDuckTemplate(){
  if(duckTemplate) return duckTemplate;
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd924, roughness: 0.3, metalness: 0.05 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6e00, roughness: 0.4 });
  const black  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 });
  const white  = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const add = (geo, mat, px, py, pz, sx=1, sy=1, sz=1, rx=0, rz=0)=>{
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  };
  // 胴体 & 尻尾 & 翼
  add(new THREE.SphereGeometry(0.32, 16, 12), yellow, 0, 0.27, -0.04, 1.0, 0.85, 1.32);
  add(new THREE.ConeGeometry(0.10, 0.22, 10), yellow, 0, 0.40, -0.45, 1, 1, 1, -0.8, 0);
  add(new THREE.SphereGeometry(0.17, 12, 10), yellow, -0.30, 0.28, -0.04, 0.35, 0.65, 1.15, 0, 0.2);
  add(new THREE.SphereGeometry(0.17, 12, 10), yellow,  0.30, 0.28, -0.04, 0.35, 0.65, 1.15, 0, -0.2);
  // 頭 & くちばし & 目
  add(new THREE.SphereGeometry(0.21, 16, 12), yellow, 0, 0.60, 0.22);
  add(new THREE.SphereGeometry(0.10, 12, 8), orange, 0, 0.56, 0.44, 1.15, 0.42, 1.45);
  add(new THREE.SphereGeometry(0.08, 12, 8), orange, 0, 0.52, 0.41, 0.95, 0.32, 1.25);
  for(const sx of [-1, 1]){
    add(new THREE.SphereGeometry(0.032, 10, 8), black, sx * 0.11, 0.65, 0.37);
    add(new THREE.SphereGeometry(0.011, 8, 6), white, sx * 0.115, 0.665, 0.398);
  }
  duckTemplate = g;
  return g;
}

// ─── 3D裏モード適用・アニメーション ───────────────────────────
function apply3DEaster(refs){
  cleanup3D();
  const { scene, floorMesh, groups } = refs;
  if(!scene || !groups || !groups.furniture) return;

  easterGroup = new THREE.Group();
  easterGroup.name = 'op-easter-3d';
  scene.add(easterGroup);
  appliedRef = floorMesh;

  if(mode === 'duck'){
    const tpl = getDuckTemplate();
    const box = new THREE.Box3(), sz = new THREE.Vector3(), ct = new THREE.Vector3();
    for(const child of groups.furniture.children){
      const o = child.userData || {};
      const nm = (o.defName || o.name || '').trim();
      if(o.isWindow || o.isStair || /^壁/.test(nm)) continue;
      box.setFromObject(child);
      if(box.isEmpty()) continue;
      box.getSize(sz); box.getCenter(ct);
      if(sz.y < 0.04) continue; // 床ゾーン・マット類は残す

      child.visible = false;
      hiddenMeshes.push(child);

      const duck = tpl.clone();
      const s = Math.min(Math.max(Math.min(sz.x, sz.z) * 1.15, 0.26), 1.45);
      duck.scale.set(s, s, s);
      duck.position.set(ct.x, box.min.y, ct.z);
      duck.rotation.y = child.rotation.y;
      duck.userData = { baseY: box.min.y, baseRotY: child.rotation.y, phase: (o.id || 1) * 1.37 };
      easterGroup.add(duck);
    }
  } else if(mode === 'disco'){
    // 背景＆照明をナイトクラブ風に
    if(scene.background){ savedBg = scene.background.clone(); scene.background.setHex(0x06040f); }
    for(const ch of scene.children){
      if(ch.isLight){ savedLights.push({ light: ch, intensity: ch.intensity }); ch.intensity *= 0.25; }
    }

    // ゴールドマテリアル（共通利用）
    if(!goldFurnMat)  goldFurnMat  = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.68, roughness: 0.25, emissive: 0x3b2800 });
    if(!goldFloorMat) goldFloorMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.62, roughness: 0.30, emissive: 0x221800 });
    if(!goldWallMat)  goldWallMat  = new THREE.MeshStandardMaterial({ color: 0xf5d76e, metalness: 0.50, roughness: 0.35, emissive: 0x2a1f00, transparent: true, opacity: 0.9 });

    if(floorMesh){ savedMats.set(floorMesh, floorMesh.material); floorMesh.material = goldFloorMat; }
    groups.furniture.traverse(n=>{
      if(!n.isMesh) return;
      const o = n.userData || {};
      if(o.isWindow) return;
      savedMats.set(n, n.material);
      n.material = goldFurnMat;
    });
    // 壁グループも金色に（t3WallGroup相当）
    const grpSet = new Set(Object.values(groups));
    for(const ch of scene.children){
      if(ch.isGroup && !grpSet.has(ch) && ch !== easterGroup){
        ch.traverse(n=>{ if(n.isMesh){ savedMats.set(n, n.material); n.material = goldWallMat; } });
      }
    }

    const rW = floorMesh ? floorMesh.geometry.parameters.width  : 8;
    const rH = floorMesh ? floorMesh.geometry.parameters.height : 6;
    const cx = rW / 2, cz = rH / 2;

    // ミラーボール
    const mbPivot = new THREE.Group();
    mbPivot.position.set(cx, 2.35, cz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
    pole.position.y = 0.3;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.08, emissive: 0x222238, flatShading: true }));
    mbPivot.add(pole, ball);
    easterGroup.add(mbPivot);

    // カラフルな回転ポイントライト（負荷を抑えつつ華やかに）
    const lightCols = [0xff22aa, 0x22ddff, 0xffdd22];
    const pLights = lightCols.map((col, i)=>{
      const pl = new THREE.PointLight(col, 1.8, Math.max(rW, rH) * 1.4);
      pl.position.set(cx, 2.1, cz);
      easterGroup.add(pl);
      return { pl, idx: i };
    });

    // 床を踊る光のスポット円盤
    const spotDisks = [];
    const spotCols = [0xff22aa, 0x22ddff, 0xaa44ff, 0x44ff77, 0xffcc22, 0xff4455];
    for(let i = 0; i < 10; i++){
      const dm = new THREE.Mesh(
        new THREE.CircleGeometry(0.42 + (i % 3) * 0.14, 18),
        new THREE.MeshBasicMaterial({ color: spotCols[i % spotCols.length], transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      dm.rotation.x = -Math.PI / 2;
      dm.position.set(cx, 0.015 + i * 0.0005, cz);
      easterGroup.add(dm);
      spotDisks.push({ dm, i, rx: rW * (0.25 + (i % 3) * 0.12), rz: rH * (0.25 + ((i + 1) % 3) * 0.12) });
    }

    easterGroup.userData.disco = { mbPivot, pLights, spotDisks, cx, cz, rW, rH };
  }
}

function cleanup3D(){
  while(hiddenMeshes.length){ const m = hiddenMeshes.pop(); if(m) m.visible = true; }
  savedMats.forEach((mat, mesh)=>{ if(mesh) mesh.material = mat; });
  savedMats.clear();
  while(savedLights.length){ const it = savedLights.pop(); if(it.light) it.light.intensity = it.intensity; }

  const refs = typeof window.get3DRefs === 'function' ? window.get3DRefs() : null;
  if(refs && refs.scene && savedBg){ refs.scene.background.copy(savedBg); }
  savedBg = null;

  if(refs && refs.groups && refs.groups.person){
    for(const p of refs.groups.person.children){
      if(p.isGroup) p.position.y = 0;
    }
  }
  if(easterGroup){
    if(easterGroup.parent) easterGroup.parent.remove(easterGroup);
    easterGroup.traverse(n=>{
      if(n.geometry) n.geometry.dispose();
      if(n.material && n.material !== goldFurnMat && n.material !== goldFloorMat && n.material !== goldWallMat){
        if(!duckTemplate || !duckTemplate.children.some(d=>d.material === n.material)) n.material.dispose();
      }
    });
    easterGroup = null;
  }
  appliedRef = null;
}

// ─── アニメーションループ ─────────────────────────────────────
function startLoops(){
  const tick2D = (now)=>{
    if(mode === 'off'){ raf2D = null; return; }
    raf2D = requestAnimationFrame(tick2D);
    if(document.body.classList.contains('view3d-mode')) return;
    if((typeof dragging !== 'undefined' && dragging) || (typeof draggingLine !== 'undefined' && draggingLine)) return;
    if(now - last2D > 33){ last2D = now; if(typeof draw === 'function') draw(); }
  };
  raf2D = requestAnimationFrame(tick2D);

  const tick3D = ()=>{
    if(mode === 'off'){ raf3D = null; return; }
    raf3D = requestAnimationFrame(tick3D);
    if(!document.body.classList.contains('view3d-mode')) return;
    const refs = typeof window.get3DRefs === 'function' ? window.get3DRefs() : null;
    if(!refs || !refs.scene || !refs.floorMesh) return;

    // 2D→3D切替でシーンが再構築されていたら自動で再適用
    if(!easterGroup || easterGroup.parent !== refs.scene || appliedRef !== refs.floorMesh){
      apply3DEaster(refs);
    }
    const t = performance.now() / 1000;
    if(mode === 'duck' && easterGroup){
      for(const duck of easterGroup.children){
        const u = duck.userData;
        duck.position.y = u.baseY + Math.abs(Math.sin(t * 3.5 + u.phase)) * 0.09;
        duck.rotation.y = u.baseRotY + Math.sin(t * 2.2 + u.phase) * 0.18;
        duck.rotation.z = Math.sin(t * 4.4 + u.phase) * 0.06;
      }
    } else if(mode === 'disco' && easterGroup && easterGroup.userData.disco){
      const d = easterGroup.userData.disco;
      d.mbPivot.rotation.y = t * 1.4;
      for(const { pl, idx } of d.pLights){
        const a = t * 1.9 + idx * (Math.PI * 2 / 3);
        pl.position.set(d.cx + Math.cos(a) * d.rW * 0.35, 2.05, d.cz + Math.sin(a) * d.rH * 0.35);
      }
      for(const s of d.spotDisks){
        const a = t * (0.9 + (s.i % 4) * 0.35) + s.i * 0.9;
        s.dm.position.x = d.cx + Math.cos(a) * s.rx;
        s.dm.position.z = d.cz + Math.sin(a * 1.25) * s.rz;
      }
      // 人物たちも縦ノリで踊る
      if(refs.groups && refs.groups.person){
        let pi = 0;
        for(const p of refs.groups.person.children){
          if(p.isGroup && p.visible){ p.position.y = Math.abs(Math.sin(t * 7.5 + pi++ * 0.7)) * 0.14; }
        }
      }
    }
  };
  raf3D = requestAnimationFrame(tick3D);
}

function stopLoops(){
  if(raf2D){ cancelAnimationFrame(raf2D); raf2D = null; }
  if(raf3D){ cancelAnimationFrame(raf3D); raf3D = null; }
}

})();