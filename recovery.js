/* デバッグログ & 診断・復旧: アプリ本体が起動できなくても使えるよう独立 */
(function(){
  'use strict';

  /* ── エラーログパネル ── */
  var MAX=30, logs=[], panel=null;
  function esc(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function ensurePanel(){
    if(panel) return panel;
    panel = document.createElement("div");
    panel.id = "dbg-panel";
    panel.style.cssText = "position:fixed;bottom:22px;right:0;width:min(640px,100vw);max-height:40vh;overflow-y:auto;background:#0d1117;border:2px solid #ff4444;border-right:none;border-radius:8px 0 0 8px;font:11px/1.5 monospace;color:#f0f0f0;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.8);display:none;";

    var hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1a0000;border-bottom:1px solid #ff4444;position:sticky;top:0;";

    var title = document.createElement("span");
    title.style.cssText = "color:#ff6666;font-weight:700;";
    title.textContent = "⚠ エラーログ";

    var cnt = document.createElement("span");
    cnt.id = "dbg-cnt";
    cnt.style.cssText = "color:#ff9999;font-size:10px;";

    var closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ 閉じる";
    closeBtn.style.cssText = "margin-left:auto;background:#333;border:1px solid #555;color:#ccc;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;";
    closeBtn.onclick = function(){ panel.style.display = "none"; };

    var copyBtn = document.createElement("button");
    copyBtn.textContent = "📋 コピー";
    copyBtn.style.cssText = "background:#333;border:1px solid #555;color:#ccc;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;";
    copyBtn.onclick = function(){
      var body = document.getElementById("dbg-body");
      if(navigator.clipboard && body){
        navigator.clipboard.writeText(body.innerText).then(function(){ alert("ログをコピーしました"); });
      }
    };

    var recBtn = document.createElement("button");
    recBtn.textContent = "🛟 復旧・診断";
    recBtn.style.cssText = "background:#333;border:1px solid #555;color:#ccc;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;";
    recBtn.onclick = function(){ if(typeof window._opRecoveryOpen==="function") window._opRecoveryOpen(); };

    hdr.appendChild(title); hdr.appendChild(cnt); hdr.appendChild(closeBtn); hdr.appendChild(copyBtn); hdr.appendChild(recBtn);

    var body = document.createElement("div");
    body.id = "dbg-body";
    body.style.cssText = "padding:6px 10px;";

    panel.appendChild(hdr); panel.appendChild(body);
    function attach(){ document.body.appendChild(panel); }
    if(document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
    return panel;
  }

  function addLog(type, msg, stack){
    var ts = new Date().toLocaleTimeString("ja-JP",{hour12:false});
    logs.push({ts:ts, type:type, msg:msg, stack:stack});
    if(logs.length > MAX) logs.shift();

    var p = ensurePanel();
    p.style.display = "block";
    var cnt = document.getElementById("dbg-cnt");
    if(cnt) cnt.textContent = logs.length + "件";

    var body = document.getElementById("dbg-body");
    if(!body) return;

    var colorMap = {error:"#ff6666", unhandled:"#ff9944", warn:"#ffcc44", console:"#ffaa44", manual:"#88ccff"};
    var color = colorMap[type] || "#f0f0f0";

    var row = document.createElement("div");
    row.style.cssText = "border-bottom:1px solid #1e2020;padding:4px 0;word-break:break-all;";

    var line1 = document.createElement("div");
    line1.innerHTML = "<span style=\"color:#666;\">[" + ts + "]</span> "
      + "<span style=\"color:" + color + ";font-weight:700;\">" + esc(type.toUpperCase()) + "</span> "
      + "<span style=\"color:#f0f0f0;\">" + esc(msg) + "</span>";
    row.appendChild(line1);

    if(stack){
      var line2 = document.createElement("pre");
      line2.style.cssText = "color:#aaa;font-size:10px;margin:2px 0 0 12px;white-space:pre-wrap;";
      line2.textContent = stack;
      row.appendChild(line2);
    }

    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  window.addEventListener("error", function(e){
    var stack = (e.error && e.error.stack) ? e.error.stack : "(stack unavailable)";
    var loc = (e.filename ? e.filename.split("/").pop() : "?") + ":" + e.lineno + ":" + e.colno;
    addLog("error", e.message + "  (" + loc + ")", stack);
  });
  window.addEventListener("unhandledrejection", function(e){
    var r = e.reason;
    var msg = (r instanceof Error) ? r.message : String(r);
    var stack = (r instanceof Error && r.stack) ? r.stack : "";
    addLog("unhandled", msg, stack);
  });

  var _ce = console.error.bind(console);
  console.error = function(){
    var msg = Array.prototype.slice.call(arguments).map(function(a){
      try{ return typeof a === "object" ? JSON.stringify(a) : String(a); } catch(e){ return String(a); }
    }).join(" ");
    addLog("console", msg, "");
    _ce.apply(console, arguments);
  };
  var _cw = console.warn.bind(console);
  console.warn = function(){
    var msg = Array.prototype.slice.call(arguments).map(function(a){
      try{ return typeof a === "object" ? JSON.stringify(a) : String(a); } catch(e){ return String(a); }
    }).join(" ");
    addLog("warn", msg, "");
    _cw.apply(console, arguments);
  };

  document.addEventListener("keydown", function(e){
    if((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D"){
      e.preventDefault();
      var p = ensurePanel();
      p.style.display = (p.style.display === "none") ? "block" : "none";
    }
  });

  window._dbgLog = function(msg, detail){ addLog("manual", msg, detail || ""); };
  window._dbgLogs = function(){ return logs.slice(); };

  /* ── 診断・復旧ツール ── */
  var KEYS={auto:'op_v4',slots:'op_slots_v1',names:'op_slot_names_v1',backup:'op_backup_v1',corrupt:'op_corrupt_v1'};
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function p2(n){ return (n<10?'0':'')+n; }
  function stamp(){ var d=new Date(); return d.getFullYear()+p2(d.getMonth()+1)+p2(d.getDate())+'-'+p2(d.getHours())+p2(d.getMinutes())+p2(d.getSeconds()); }
  function fmtTime(t){ try{ return new Date(t).toLocaleString('ja-JP'); }catch(e){ return String(t); } }
  function sizeLabel(s){ return s==null?'なし':(s.length>1024?(Math.round(s.length/102.4)/10)+' KB':s.length+' 文字'); }
  function el(tag,css,text){ var e=document.createElement(tag); if(css) e.style.cssText=css; if(text!=null) e.textContent=text; return e; }
  function download(name,text,type){
    var b=new Blob([text],{type:type||'application/json;charset=utf-8'}), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(u); },3000);
  }
  function reload(){ if(typeof window._opReload==='function') window._opReload(); else location.reload(); }

  window._opStashCorrupt=function(raw,reason){
    var rec={time:Date.now(),reason:String(reason||'不明'),raw:String(raw).slice(0,4000000)};
    var ok=lsSet(KEYS.corrupt,JSON.stringify(rec));
    window._opBootNotice={reason:rec.reason,time:rec.time,stashed:ok,raw:rec.raw,kind:'corrupt'};
    return ok;
  };
  window._opSafeBootRequested=function(){
    var f=false;
    try{ f=sessionStorage.getItem('op_safe_boot')==='1'; sessionStorage.removeItem('op_safe_boot'); }catch(e){}
    if(/[?&]safe=1(&|$)/.test(location.search||'')) f=true;
    return f;
  };

  function webgl(){
    try{
      var c=document.createElement('canvas'), gl=c.getContext('webgl')||c.getContext('experimental-webgl');
      if(!gl) return 'なし（3D表示は使えません）';
      var v=''; try{ v=gl.getParameter(gl.VERSION)||''; }catch(e){}
      return 'あり'+(v?'（'+v+'）':'');
    }catch(e){ return '判定できません（'+e.message+'）'; }
  }
  function summarizeAuto(raw){
    if(raw==null) return '保存データなし';
    try{
      var s=JSON.parse(raw);
      if(!s||typeof s!=='object'||!Array.isArray(s.objects)) return '形式が正しくありません';
      return '部屋 '+s.roomW+'×'+s.roomH+' m／物 '+s.objects.length+' 個／線 '+(Array.isArray(s.lines)?s.lines.length:0)+' 本';
    }catch(e){ return 'JSONとして読み取れません（'+e.message+'）'; }
  }
  function diag(){
    var L=[], info=window._opAppInfo||{};
    L.push('Office Planner 診断情報'); L.push('作成: '+fmtTime(Date.now()));
    L.push('バージョン: '+(info.version||'不明')+'（更新日 '+(info.updated||'不明')+'）'); L.push('');
    L.push('[環境]');
    L.push('ブラウザ: '+navigator.userAgent); L.push('言語: '+navigator.language);
    L.push('画面: '+window.innerWidth+'×'+window.innerHeight+'（倍率 '+(window.devicePixelRatio||1)+'）');
    L.push('開き方: '+location.protocol+(window.isSecureContext?'（セキュア）':''));
    L.push('WebGL: '+webgl()); L.push('');
    L.push('[ブラウザ内の保存データ]');
    var auto=lsGet(KEYS.auto); L.push('自動保存: '+sizeLabel(auto)+' — '+summarizeAuto(auto));
    var sl=lsGet(KEYS.slots), n=0; try{ n=Object.keys(JSON.parse(sl||'{}')).length; }catch(e){ n=-1; }
    L.push('スロット: '+sizeLabel(sl)+' — '+(n<0?'読み取れません':n+' 件'));
    var bk=lsGet(KEYS.backup); L.push('直前の状態の退避: '+(bk?sizeLabel(bk):'なし'));
    var cr=lsGet(KEYS.corrupt), crs='なし';
    if(cr){ try{ var c=JSON.parse(cr); crs=fmtTime(c.time)+'／'+c.reason; }catch(e){ crs='あり（読み取れません）'; } }
    L.push('退避した壊れたデータ: '+crs); L.push('');
    L.push('[現在の内容]');
    try{
      if(typeof window.getState==='function'){
        var s=window.getState();
        L.push('部屋 '+s.roomW+'×'+s.roomH+' m／余白 '+s.margin+' m／物 '+s.objects.length+' 個／線 '+s.lines.length+' 本／レイヤー '+((s.layers||[]).length)+' 個');
      } else L.push('（アプリが起動していません）');
    }catch(e){ L.push('取得できません（'+e.message+'）'); }
    var sb=document.getElementById('sb-save'); if(sb) L.push('自動保存の表示: '+sb.textContent);
    var bd=document.getElementById('cur-slot-badge'); if(bd) L.push('スロットの表示: '+bd.textContent);
    L.push('3D: '+(typeof window._op3DStatus==='function'?window._op3DStatus():'不明')); L.push('');
    L.push('[直近のエラー・警告]');
    var lgs=(typeof window._dbgLogs==='function')?window._dbgLogs():[];
    if(!lgs.length) L.push('なし');
    lgs.slice(-15).forEach(function(g){ L.push('['+g.ts+'] '+String(g.type).toUpperCase()+' '+g.msg); if(g.stack) L.push('    '+String(g.stack).split('\n').slice(0,3).join(' | ')); });
    return L.join('\n');
  }

  var ov=null;
  function closeRecovery(){ if(ov&&ov.parentNode) ov.parentNode.removeChild(ov); ov=null; }
  window._opRecoveryOpen=function(opts){
    opts=opts||{}; closeRecovery();
    ov=el('div','position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99000;display:flex;align-items:center;justify-content:center;');
    ov.id='recovery-overlay'; ov.className='open';
    var box=el('div','background:var(--surface,#161a26);color:var(--text,#e8eaf6);border:1px solid var(--border,#2a2f45);border-radius:12px;width:min(720px,96vw);max-height:92vh;overflow:auto;padding:18px 20px;font:13px/1.6 "Segoe UI","Yu Gothic",sans-serif;box-shadow:0 8px 40px rgba(0,0,0,.5);');
    var msg=el('div','font-size:12px;color:var(--accent,#7fe2a0);min-height:18px;margin-top:6px;');
    function H(t){ return el('div','font-size:12px;font-weight:700;color:var(--accent,#5b8cff);margin:16px 0 6px;',t); }
    function row(){ return el('div','display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0;'); }
    function btn(label,fn,danger){
      var b=el('button','padding:6px 12px;border-radius:6px;border:1px solid '+(danger?'#ff5370':'var(--border,#2a2f45)')+';background:var(--surface2,#1d2233);color:'+(danger?'#ff8a9c':'inherit')+';cursor:pointer;font-size:12px;',label);
      b.addEventListener('click',fn); return b;
    }
    box.appendChild(el('div','font-size:16px;font-weight:700;',opts.title||'🩺 診断・復旧'));
    if(opts.message) box.appendChild(el('div','background:rgba(255,83,112,.12);border-left:3px solid #ff5370;padding:8px 12px;margin:10px 0;border-radius:0 6px 6px 0;white-space:pre-wrap;',opts.message));
    box.appendChild(H('1. 診断情報（不具合の連絡時にお使いください）'));
    var ta=el('textarea','width:100%;height:190px;box-sizing:border-box;font:11px/1.5 monospace;background:var(--surface2,#0d1017);color:inherit;border:1px solid var(--border,#2a2f45);border-radius:6px;padding:8px;resize:vertical;');
    ta.readOnly=true; ta.value=diag(); box.appendChild(ta);
    var r1=row();
    r1.appendChild(btn('📋 コピー',function(){
      var done=function(){ msg.textContent='診断情報をコピーしました。'; };
      var fb=function(){ try{ ta.select(); document.execCommand('copy'); done(); }catch(e){ msg.textContent='自動でコピーできませんでした。上の枠を選んで Ctrl+C でコピーしてください。'; } };
      if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(ta.value).then(done,fb); } else fb();
    }));
    r1.appendChild(btn('💾 ファイルに保存',function(){ download('診断情報_'+stamp()+'.txt',ta.value,'text/plain;charset=utf-8'); msg.textContent='診断情報を保存しました。'; }));
    box.appendChild(r1);
    box.appendChild(H('2. 保存データをファイルに退避（ダウンロード）'));
    function saveRow(label,raw,fname,note){
      var r=row(); r.appendChild(el('span','min-width:230px;',label+'：'+(raw?sizeLabel(raw):'なし')+(note||'')));
      var b=btn('⬇ ダウンロード',function(){ download(fname+'_'+stamp()+'.'+(fname.indexOf('壊れた')===0?'txt':'json'),raw,'text/plain;charset=utf-8'); msg.textContent=label+'を保存しました。'; });
      if(!raw){ b.disabled=true; b.style.opacity='.4'; } r.appendChild(b); box.appendChild(r);
    }
    saveRow('自動保存データ',lsGet(KEYS.auto),'自動保存');
    var slRaw=lsGet(KEYS.slots), nmRaw=lsGet(KEYS.names), pack=null;
    if(slRaw){ try{ var sp=JSON.parse(slRaw), q={}; Object.keys(sp).forEach(function(k){ try{ q[k]=JSON.parse(sp[k]); }catch(e){ q[k]=sp[k]; } }); var nm={}; try{ nm=JSON.parse(nmRaw||'{}'); }catch(e){} pack=JSON.stringify({slots:q,names:nm},null,1); }catch(e){ pack=slRaw; } }
    saveRow('スロットすべて',pack,'スロット一式');
    var crRaw=lsGet(KEYS.corrupt), crData=null, crNote='';
    if(crRaw){ try{ crData=JSON.parse(crRaw); crNote='（'+fmtTime(crData.time)+'・'+crData.reason+'）'; }catch(e){} }
    saveRow('退避した壊れたデータ',crData?crData.raw:null,'壊れた自動保存',crNote);
    saveRow('直前の状態（読込・全クリアの前）',lsGet(KEYS.backup),'直前の状態');
    box.appendChild(H('3. 復旧操作'));
    box.appendChild(el('div','font-size:12px;color:var(--text2,#9da3c8);','保存データが原因で起動や操作がおかしいときは、まず「読み込まずに再起動」を試してください。前回のデータは自動で退避されます（スロットは消えません）。'));
    var r3=row();
    r3.appendChild(btn('🔄 保存データを読み込まずに再起動',function(){
      try{ sessionStorage.setItem('op_safe_boot','1'); reload(); }catch(e){ location.href=location.pathname+'?safe=1'; }
    }));
    r3.appendChild(btn('🗑 自動保存データを消去して再起動',function(){
      var raw=lsGet(KEYS.auto);
      if(!confirm('自動保存データを消去します。\n消去する前に、自動保存データをファイルとしてダウンロードします。\nよろしいですか？（スロットは消えません）')) return;
      if(raw) download('自動保存_消去前_'+stamp()+'.json',raw,'text/plain;charset=utf-8');
      lsDel(KEYS.auto); reload();
    },true));
    box.appendChild(r3); box.appendChild(msg);
    var r4=row(); r4.appendChild(btn('閉じる',closeRecovery)); box.appendChild(r4);
    ov.appendChild(box); ov.addEventListener('click',function(e){ if(e.target===ov) closeRecovery(); });
    document.body.appendChild(ov);
  };
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&ov) closeRecovery(); });
  window._opBootFailed=function(ex){
    try{ console.info('boot failed',ex); }catch(e){}
    window._opRecoveryOpen({title:'起動に失敗しました',message:'アプリの起動中にエラーが発生しました。\n'+((ex&&ex.message)||ex)+'\n\n保存データが原因かどうかは、下の「読み込まずに再起動」で切り分けられます。'});
  };
  window._opShowBootNotice=function(){
    var n=window._opBootNotice; if(!n) return;
    var b=el('div','position:fixed;left:50%;bottom:30px;transform:translateX(-50%);width:min(780px,96vw);z-index:9500;background:#2a1f0a;color:#ffe0a3;border:1px solid #c98a1b;border-radius:10px;padding:10px 14px;font:12px/1.6 "Segoe UI","Yu Gothic",sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.5);display:flex;flex-wrap:wrap;gap:8px;align-items:center;');
    b.id='boot-notice';
    var t=(n.kind==='safe')?'保存データを読み込まずに起動しました。前回の自動保存データは退避してあります。':'前回の自動保存データを読み込めませんでした（'+n.reason+'）。壊れたデータは退避してあるので、取り出せます。';
    if(!n.stashed) t+='（ブラウザの保存容量が足りず、退避できていません。今ダウンロードしてください）';
    b.appendChild(el('span','flex:1;min-width:260px;',t));
    function bb(label,fn){ var x=el('button','padding:4px 10px;border-radius:6px;border:1px solid #c98a1b;background:#3a2b10;color:#ffe0a3;cursor:pointer;font-size:12px;',label); x.addEventListener('click',fn); return x; }
    b.appendChild(bb('⬇ 退避データをダウンロード',function(){ download('壊れた自動保存_'+stamp()+'.txt',n.raw,'text/plain;charset=utf-8'); }));
    b.appendChild(bb('🩺 診断・復旧',function(){ window._opRecoveryOpen(); }));
    b.appendChild(bb('✕',function(){ if(b.parentNode) b.parentNode.removeChild(b); }));
    document.body.appendChild(b);
  };
})();