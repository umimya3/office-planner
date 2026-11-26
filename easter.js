/* イースターエッグ（元データ・保存領域は無汚染）
   1) ヘッダーロゴ 5連打 → ゴールデン・ディスコ (ON/OFF)
   2) 3Dシムの時計(09:00) 5連打 → 歩く人物がラバーダック化 (ON/OFF) */
(function(){
'use strict';

let discoMode = false;
let duckPeopleMode = false;

let raf2D = null, last2D = 0;
let raf3D = null;

// 3Dディスコ一時変更の退避用
let discoGroup = null;
let goldFurnMat = null, goldFloorMat = null, goldWallMat = null;
const savedMats = new Map();
const savedLights = [];
let savedBg = null;
let appliedDiscoFloor = null;

// 3D人物アヒル化用
let duckTemplate = null;

// ─── 1. トリガー: ロゴ5連打 → ゴールデン・ディスコ ────────────
const logo = document.querySelector('#header .logo');
const discoBadge = document.createElement('span');
discoBadge.id = 'easter-disco-badge';
discoBadge.textContent = '🪩';
discoBadge.title = 'クリックでゴールデン・ディスコを解除';
discoBadge.style.cssText = 'display:none;margin-left:6px;padding:2px 6px;border-radius:10px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--surface2);vertical-align:middle;user-select:none;';

if(logo){
  let cnt = 0, tm = null;
  logo.style.cursor = 'pointer';
  logo.parentNode.insertBefore(discoBadge, logo.nextSibling);
  logo.addEventListener('click', ()=>{
    if(discoMode){ toggleDisco(false); return; }
    cnt++; clearTimeout(tm); tm = setTimeout(()=>{ cnt = 0; }, 1200);
    if(cnt >= 5){ cnt = 0; toggleDisco(true); }
  });
  discoBadge.addEventListener('click', ()=> toggleDisco(false));
}

function toggleDisco(on){
  discoMode = !!on;
  window._opEasterDiscoActive = discoMode;
  cleanupDisco3D();
  discoBadge.style.display = discoMode ? 'inline-block' : 'none';
  if(discoMode){
    if(typeof showToast === 'function') showToast('🪩 ゴールデン・ディスコ発動！（3D表示がおすすめ）', 3000);
  } else {
    if(typeof showToast === 'function') showToast('🏢 通常照明に戻りました', 2000);
    if(typeof draw === 'function') draw();
  }
  syncLoops();
}

// ─── 2. トリガー: 3Dシム時計5連打 → 人物がラバーダック化 ─────
const simClock = document.getElementById('sim3d-clock');
const duckBadge = document.createElement('span');
duckBadge.id = 'easter-duck-badge';
duckBadge.textContent = '🐥';
duckBadge.title = 'クリックで人物アヒル化を解除';
duckBadge.style.cssText = 'display:none;margin-left:6px;padding:1px 6px;border-radius:10px;font-size:12px;cursor:pointer;border:1px solid #d48800;background:#ffe033;vertical-align:middle;user-select:none;';

if(simClock){
  let cnt = 0, tm = null;
  simClock.style.cursor = 'pointer';
  simClock.style.userSelect = 'none';
  simClock.parentNode.insertBefore(duckBadge, simClock.nextSibling);
  simClock.addEventListener('click', ()=>{
    if(duckPeopleMode){ toggleDuckPeople(false); return; }
    cnt++; clearTimeout(tm); tm = setTimeout(()=>{ cnt = 0; }, 1200);
    if(cnt >= 5){ cnt = 0; toggleDuckPeople(true); }
  });
  duckBadge.addEventListener('click', ()=> toggleDuckPeople(false));
}

function toggleDuckPeople(on){
  duckPeopleMode = !!on;
  if(!duckPeopleMode) cleanupDuckPeople3D();
  duckBadge.style.display = duckPeopleMode ? 'inline-block' : 'none';
  if(duckPeopleMode){
    if(typeof showToast === 'function') showToast('🐥 スタッフ全員がラバーダックになりました！', 3000);
  } else {
    if(typeof showToast === 'function') showToast('🚶 スタッフに戻りました', 2000);
  }
  syncLoops();
}

// ─── 2Dオーバーレイ演出（ディスコ時） ─────────────────────────
const _prevOverlay = window._opDrawOverlays;
window._opDrawOverlays = function(){
  if(typeof _prevOverlay === 'function') _prevOverlay();
  if(!discoMode || typeof ctx === 'undefined' || typeof objects === 'undefined') return;

  const t = performance.now() / 1000;
  const RW = mToPx(roomW), RH = mToPx(roomH);

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
};

// ─── 3Dアヒル・テンプレート ───────────────────────────────────
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
  add(new THREE.SphereGeometry(0.32, 16, 12), yellow, 0, 0.27, -0.04, 1.0, 0.85, 1.32);
  add(new THREE.ConeGeometry(0.10, 0.22, 10), yellow, 0, 0.40, -0.45, 1, 1, 1, -0.8, 0);
  add(new THREE.SphereGeometry(0.17, 12, 10), yellow, -0.30, 0.28, -0.04, 0.35, 0.65, 1.15, 0, 0.2);
  add(new THREE.SphereGeometry(0.17, 12, 10), yellow,  0.30, 0.28, -0.04, 0.35, 0.65, 1.15, 0, -0.2);
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

// ─── 3Dディスコ適用・解除 ─────────────────────────────────────
function applyDisco3D(refs){
  cleanupDisco3D();
  const { scene, floorMesh, groups } = refs;
  if(!scene || !groups || !groups.furniture) return;

  discoGroup = new THREE.Group();
  discoGroup.name = 'op-easter-disco';
  scene.add(discoGroup);
  appliedDiscoFloor = floorMesh;

  if(scene.background){ savedBg = scene.background.clone(); scene.background.setHex(0x06040f); }
  for(const ch of scene.children){
    if(ch.isLight){ savedLights.push({ light: ch, intensity: ch.intensity }); ch.intensity *= 0.22; }
  }

  if(!goldFurnMat)  goldFurnMat  = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.68, roughness: 0.25, emissive: 0x3b2800 });
  if(!goldFloorMat) goldFloorMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.62, roughness: 0.30, emissive: 0x221800 });
  if(!goldWallMat)  goldWallMat  = new THREE.MeshStandardMaterial({ color: 0xf5d76e, metalness: 0.50, roughness: 0.35, emissive: 0x2a1f00, transparent: true, opacity: 0.9 });

  if(floorMesh){ savedMats.set(floorMesh, floorMesh.material); floorMesh.material = goldFloorMat; }
  groups.furniture.traverse(n=>{
    if(!n.isMesh) return;
    const o = n.userData || {};
    if(o.isWindow) return;
    savedMats.set(n, n.material); n.material = goldFurnMat;
  });
  const grpSet = new Set(Object.values(groups));
  for(const ch of scene.children){
    if(ch.isGroup && !grpSet.has(ch) && ch !== discoGroup){
      ch.traverse(n=>{ if(n.isMesh){ savedMats.set(n, n.material); n.material = goldWallMat; } });
    }
  }

  const rW = floorMesh ? floorMesh.geometry.parameters.width  : 8;
  const rH = floorMesh ? floorMesh.geometry.parameters.height : 6;
  const cx = rW / 2, cz = rH / 2;

  const mbPivot = new THREE.Group();
  mbPivot.position.set(cx, 2.35, cz);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
  pole.position.y = 0.3;
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.08, emissive: 0x222238, flatShading: true }));
  mbPivot.add(pole, ball);
  discoGroup.add(mbPivot);

  const pLights = [0xff22aa, 0x22ddff, 0xffdd22].map((col, idx)=>{
    const pl = new THREE.PointLight(col, 1.8, Math.max(rW, rH) * 1.4);
    pl.position.set(cx, 2.1, cz);
    discoGroup.add(pl);
    return { pl, idx };
  });

  const spotDisks = [];
  const spotCols = [0xff22aa, 0x22ddff, 0xaa44ff, 0x44ff77, 0xffcc22, 0xff4455];
  for(let i = 0; i < 10; i++){
    const dm = new THREE.Mesh(
      new THREE.CircleGeometry(0.42 + (i % 3) * 0.14, 18),
      new THREE.MeshBasicMaterial({ color: spotCols[i % spotCols.length], transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    dm.rotation.x = -Math.PI / 2;
    dm.position.set(cx, 0.015 + i * 0.0005, cz);
    discoGroup.add(dm);
    spotDisks.push({ dm, i, rx: rW * (0.25 + (i % 3) * 0.12), rz: rH * (0.25 + ((i + 1) % 3) * 0.12) });
  }

  discoGroup.userData.disco = { mbPivot, pLights, spotDisks, cx, cz, rW, rH };
}

function cleanupDisco3D(){
  savedMats.forEach((mat, mesh)=>{ if(mesh) mesh.material = mat; });
  savedMats.clear();
  while(savedLights.length){ const it = savedLights.pop(); if(it.light) it.light.intensity = it.intensity; }

  const refs = typeof window.get3DRefs === 'function' ? window.get3DRefs() : null;
  if(refs && refs.scene && savedBg) refs.scene.background.copy(savedBg);
  savedBg = null;

  if(refs && refs.groups && refs.groups.person){
    for(const p of refs.groups.person.children){
      if(p.isGroup && p.userData && p.userData.rig) p.position.y = 0;
    }
  }
  if(discoGroup){
    if(discoGroup.parent) discoGroup.parent.remove(discoGroup);
    discoGroup.traverse(n=>{
      if(n.geometry) n.geometry.dispose();
      if(n.material && n.material !== goldFurnMat && n.material !== goldFloorMat && n.material !== goldWallMat) n.material.dispose();
    });
    discoGroup = null;
  }
  appliedDiscoFloor = null;
  if(typeof window._opReapply3DLighting === 'function') window._opReapply3DLighting();
}

// ─── 3D人物ラバーダック化 ────────────────────────────────────
function syncDuckPeople3D(refs){
  if(!refs || !refs.groups || !refs.groups.person) return;
  const tpl = getDuckTemplate();
  let idx = 0;
  for(const ch of refs.groups.person.children){
    if(!ch.isGroup || !ch.userData || !ch.userData.rig) continue;
    const rig = ch.userData.rig;
    rig.hips.visible = false;
    let duck = ch.children.find(c => c.userData && c.userData._isEasterDuck);
    if(!duck){
      duck = tpl.clone();
      duck.scale.set(0.72, 0.72, 0.72);
      duck.userData = { _isEasterDuck: true, phase: idx * 1.15 };
      ch.add(duck);
    }
    idx++;
  }
}

function cleanupDuckPeople3D(){
  const refs = typeof window.get3DRefs === 'function' ? window.get3DRefs() : null;
  if(!refs || !refs.groups || !refs.groups.person) return;
  for(const ch of refs.groups.person.children){
    if(!ch.isGroup || !ch.userData || !ch.userData.rig) continue;
    ch.userData.rig.hips.visible = true;
    const duck = ch.children.find(c => c.userData && c.userData._isEasterDuck);
    if(duck) ch.remove(duck);
  }
}

// ─── ループ管理 ──────────────────────────────────────────────
function syncLoops(){
  if(discoMode && !raf2D){
    const tick2D = (now)=>{
      if(!discoMode){ raf2D = null; return; }
      raf2D = requestAnimationFrame(tick2D);
      if(document.body.classList.contains('view3d-mode')) return;
      if((typeof dragging !== 'undefined' && dragging) || (typeof draggingLine !== 'undefined' && draggingLine)) return;
      if(now - last2D > 33){ last2D = now; if(typeof draw === 'function') draw(); }
    };
    raf2D = requestAnimationFrame(tick2D);
  } else if(!discoMode && raf2D){
    cancelAnimationFrame(raf2D); raf2D = null;
  }

  if((discoMode || duckPeopleMode) && !raf3D){
    const tick3D = ()=>{
      if(!discoMode && !duckPeopleMode){ raf3D = null; return; }
      raf3D = requestAnimationFrame(tick3D);
      if(!document.body.classList.contains('view3d-mode')) return;
      const refs = typeof window.get3DRefs === 'function' ? window.get3DRefs() : null;
      if(!refs || !refs.scene || !refs.floorMesh) return;

      const t = performance.now() / 1000;

      if(discoMode){
        if(!discoGroup || discoGroup.parent !== refs.scene || appliedDiscoFloor !== refs.floorMesh){
          applyDisco3D(refs);
        }
        if(discoGroup && discoGroup.userData.disco){
          const d = discoGroup.userData.disco;
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
        }
      }

      if(duckPeopleMode){
        syncDuckPeople3D(refs);
        if(refs.groups && refs.groups.person){
          for(const ch of refs.groups.person.children){
            if(!ch.isGroup || !ch.userData || !ch.userData.rig || !ch.visible) continue;
            const rig = ch.userData.rig;
            const duck = ch.children.find(c => c.userData && c.userData._isEasterDuck);
            if(!duck) continue;
            const ph = duck.userData.phase;
            const sitting = rig.hips.position.y < 0.65;
            const walking = Math.abs(rig.legL.rotation.x) > 0.05;
            const discoBounce = discoMode ? Math.abs(Math.sin(t * 7.5 + ph)) * 0.12 : 0;

            if(sitting){
              duck.position.y = 0.44 + discoBounce;
              duck.rotation.z = discoMode ? Math.sin(t * 6 + ph) * 0.12 : Math.sin(t * 2 + ph) * 0.03;
            } else if(walking){
              duck.position.y = Math.abs(Math.sin(t * 9 + ph)) * 0.06 + discoBounce;
              duck.rotation.z = Math.sin(t * 9 + ph) * 0.14;
            } else {
              duck.position.y = discoBounce;
              duck.rotation.z = discoMode ? Math.sin(t * 6 + ph) * 0.14 : Math.sin(t * 2.5 + ph) * 0.04;
            }
          }
        }
      } else if(discoMode && refs.groups && refs.groups.person){
        let pi = 0;
        for(const p of refs.groups.person.children){
          if(p.isGroup && p.userData && p.userData.rig && p.visible){
            p.position.y = Math.abs(Math.sin(t * 7.5 + pi++ * 0.7)) * 0.14;
          }
        }
      }
    };
    raf3D = requestAnimationFrame(tick3D);
  } else if(!discoMode && !duckPeopleMode && raf3D){
    cancelAnimationFrame(raf3D); raf3D = null;
  }
}

})();