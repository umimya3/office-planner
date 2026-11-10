// ═══════════════════════════════════════════════════════════════
//  物品リストの Excel(.xlsx) 出力  — 外部ライブラリ不要・オフラインで動作
// ═══════════════════════════════════════════════════════════════
(function(){
'use strict';
const SHEET_NAME = '物品リスト';
const TABS = ['家具','備品','OA用品','構造','その他'];

/* ── 小さな部品: UTF-8 / CRC32 / ZIP(無圧縮) ── */
function utf8(str){
  const out=[];
  for(let i=0;i<str.length;i++){
    let c=str.charCodeAt(i);
    if(c>=0xD800&&c<=0xDBFF&&i+1<str.length){ const d=str.charCodeAt(i+1); if(d>=0xDC00&&d<=0xDFFF){ c=0x10000+((c-0xD800)<<10)+(d-0xDC00); i++; } }
    if(c<0x80) out.push(c);
    else if(c<0x800) out.push(0xC0|(c>>6),0x80|(c&63));
    else if(c<0x10000) out.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
    else out.push(0xF0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
  }
  return new Uint8Array(out);
}
const CRC=(function(){ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipStore(files){
  const now=new Date();
  const dt=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
  const tm=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
  const parts=[], central=[]; let offset=0;
  for(const f of files){
    const name=utf8(f.name), data=f.data, crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,tm,true); lh.setUint16(12,dt,true); lh.setUint32(14,crc,true);
    lh.setUint32(18,data.length,true); lh.setUint32(22,data.length,true); lh.setUint16(26,name.length,true); lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer),name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
    ch.setUint16(12,tm,true); ch.setUint16(14,dt,true); ch.setUint32(16,crc,true);
    ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true); ch.setUint16(28,name.length,true);
    ch.setUint16(30,0,true); ch.setUint16(32,0,true); ch.setUint16(34,0,true); ch.setUint16(36,0,true); ch.setUint32(38,0,true); ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),name);
    offset+=30+name.length+data.length;
  }
  const cdSize=central.reduce((a,b)=>a+b.length,0);
  const eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true); eo.setUint16(4,0,true); eo.setUint16(6,0,true); eo.setUint16(8,files.length,true); eo.setUint16(10,files.length,true);
  eo.setUint32(12,cdSize,true); eo.setUint32(16,offset,true); eo.setUint16(20,0,true);
  const all=parts.concat(central,[new Uint8Array(eo.buffer)]);
  const out=new Uint8Array(all.reduce((a,b)=>a+b.length,0)); let pos=0;
  for(const a of all){ out.set(a,pos); pos+=a.length; }
  return out;
}
function esc(s){
  return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

/* ── 物品の集計 ── */
function catalogs(){
  const furn=(typeof FURN_DEFS!=='undefined')?FURN_DEFS:[];
  const stru=(typeof STRUCT_DEFS!=='undefined')?STRUCT_DEFS:[];
  const off=window._opOfficeDefs||[];
  const list=[];   // {name, cat, tab, order}
  let order=0;
  for(const d of furn){ if(!d.cat.startsWith('現場-')) list.push({name:d.name,cat:d.cat,tab:'家具',order:order++}); }
  for(const d of furn){ if(d.cat.startsWith('現場-')) list.push({name:d.name,cat:d.cat.replace('現場-',''),rawCat:d.cat,tab:'備品',order:order++}); }
  for(const d of off){ list.push({name:d.name,cat:d.cat,tab:'OA用品',order:order++}); }
  for(const d of stru){ list.push({name:d.name,cat:d.cat,tab:'構造',order:order++}); }
  const byName=new Map(), byCat=new Map(), catOrder=new Map();
  for(const e of list){
    if(!byName.has(e.name)) byName.set(e.name,e);
    const key=e.rawCat||e.cat; if(!byCat.has(key)){ byCat.set(key,e); catOrder.set(key,e.order); }
  }
  return {byName,byCat,catOrder};
}
function classify(o,C){
  if(o.isDoor||o.isWindow||o.isStair) return {tab:'構造',cat:'',order:-1,catOrder:1e9};
  let e=null;
  if(o.cat && C.byCat.has(o.cat)) e=C.byCat.get(o.cat);
  const nm=C.byName.get(o.defName||'')||C.byName.get(o.name||'');
  if(!e && nm) e=nm;
  if(!e) return {tab:'その他',cat:'',order:1e9,catOrder:1e9};
  const named=C.byName.get(o.defName||'')||C.byName.get(o.name||'');
  return {tab:e.tab,cat:e.cat,order:named?named.order:1e9,catOrder:C.catOrder.get(e.rawCat||e.cat)};
}
function fmtNum(v){ return String(Number((+v).toFixed(3))); }
function buildItemRows(opt){
  opt=Object.assign({group:true,visibleOnly:false,includeStruct:false,outsideNote:true},opt||{});
  const C=catalogs(); const stats={total:0,struct:0,hidden:0,items:0};
  const map=new Map(), list=[];
  for(const o of objects){
    stats.total++;
    if(o.isComment) continue;
    const k=classify(o,C);
    if(k.tab==='構造' && !opt.includeStruct){ stats.struct++; continue; }
    if(opt.visibleOnly && typeof isLayerVisible==='function' && !isLayerVisible(o.layerId||1)){ stats.hidden++; continue; }
    const name=((typeof o.label==='string'&&o.label.trim())||o.defName||o.name||'（名称なし）').trim();
    const cx=o.x+o.w/2, cy=o.y+o.h/2, outside=(cx<0||cy<0||cx>roomW||cy>roomH);
    const w=fmtNum(o.w), d=fmtNum(o.h);
    const key=opt.group ? [k.tab,k.cat,name,w,d].join('\u0001') : null;
    let r=key?map.get(key):null;
    if(!r){ r={tab:k.tab,cat:k.cat,name:name,w:w,d:d,qty:0,out:0,order:k.order,catOrder:k.catOrder,wn:o.w,dn:o.h,seq:list.length};
            list.push(r); if(key) map.set(key,r); }
    r.qty++; if(outside) r.out++; stats.items++;
  }
  const to=t=>{ const i=TABS.indexOf(t); return i<0?99:i; };
  list.sort((a,b)=> to(a.tab)-to(b.tab) || a.catOrder-b.catOrder || a.order-b.order || a.name.localeCompare(b.name,'ja',{numeric:true}) || a.wn-b.wn || a.dn-b.dn || a.seq-b.seq);
  const rows=list.map(r=>({
    check:'☐',
    kubun: r.tab + (r.cat ? ' / '+r.cat : ''),
    name: r.name, qty: r.qty,
    size: r.w+' × '+r.d,
    comment: (opt.outsideNote && r.out>0) ? (r.out===r.qty ? '部屋の外' : ('うち'+r.out+'点は部屋の外')) : ''
  }));
  return {rows:rows,stats:stats,opt:opt};
}

/* ── xlsx の組み立て ── */
function buildXlsx(opt, info){
  const res=buildItemRows(opt); const rows=res.rows; const o=res.opt;
  const now=new Date(), pad=n=>String(n).padStart(2,'0');
  const stamp=now.getFullYear()+'/'+pad(now.getMonth()+1)+'/'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes());
  const slot=(info&&info.slotName)||'';
  const totalQty=rows.reduce((a,r)=>a+r.qty,0);
  const ss=[], ssMap=new Map(); let ssCount=0;
  const sidx=s=>{ ssCount++; if(!ssMap.has(s)){ ssMap.set(s,ss.length); ss.push(s);} return ssMap.get(s); };
  const cs=(ref,s,st)=>'<c r="'+ref+'" s="'+st+'" t="s"><v>'+sidx(s)+'</v></c>';
  const cn=(ref,n,st)=>'<c r="'+ref+'" s="'+st+'"><v>'+n+'</v></c>';
  const ce=(ref,st)=>'<c r="'+ref+'" s="'+st+'"/>';
  const COLS=['A','B','C','D','E','F'];
  const HEAD_ROW=4, FIRST=5, LAST=FIRST+rows.length-1, TOTAL=LAST+1;
  const legend='※ チェック欄は、セルを選んで ☐ → ☑ に切り替えられます（☑ の行は緑色になります）。コメント欄は自由に記入できます。'
    +(o.group?'　※ 数量は「同じ名前・同じサイズ」の物の合計です。':'　※ 1点を1行で出しています。')
    +(o.includeStruct?'':'　※ 壁・窓・ドアなどの構造物（構造タブの物）は含みません。');
  const meta='部屋サイズ '+fmtNum(roomW)+' m × '+fmtNum(roomH)+' m　／　合計 '+totalQty+' 点（'+rows.length+' 行）　／　作成 '+stamp;
  let sd='';
  sd+='<row r="1" ht="30" customHeight="1">'+cs('A1',SHEET_NAME+(slot?' — '+slot:''),1)+COLS.slice(1).map(c=>ce(c+'1',1)).join('')+'</row>';
  sd+='<row r="2" ht="18" customHeight="1">'+cs('A2',meta,2)+COLS.slice(1).map(c=>ce(c+'2',2)).join('')+'</row>';
  sd+='<row r="3" ht="34" customHeight="1">'+cs('A3',legend,3)+COLS.slice(1).map(c=>ce(c+'3',3)).join('')+'</row>';
  const heads=['チェック','区分','物品','数量','サイズ(m) 幅×奥行','コメント'];
  sd+='<row r="'+HEAD_ROW+'" ht="26" customHeight="1">'+heads.map((t,i)=>cs(COLS[i]+HEAD_ROW,t,4)).join('')+'</row>';
  rows.forEach((r,i)=>{
    const n=FIRST+i, b=(i%2===1)?4:0;       // 偶数行は薄い色(帯)
    sd+='<row r="'+n+'">'
      +cs('A'+n,r.check,5+b)+cs('B'+n,r.kubun,6+b)+cs('C'+n,r.name,6+b)+cn('D'+n,r.qty,7+b)+cs('E'+n,r.size,6+b)
      +(r.comment?cs('F'+n,r.comment,8+b):ce('F'+n,8+b))
      +'</row>';
  });
  sd+='<row r="'+TOTAL+'" ht="22" customHeight="1">'+ce('A'+TOTAL,15)+ce('B'+TOTAL,15)+cs('C'+TOTAL,'合計（点）',13)
     +'<c r="D'+TOTAL+'" s="14"><f>SUBTOTAL(109,D'+FIRST+':D'+LAST+')</f><v>'+totalQty+'</v></c>'+ce('E'+TOTAL,15)+ce('F'+TOTAL,15)+'</row>';
  const NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet '+NS+'>'
    +'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    +'<dimension ref="A1:F'+TOTAL+'"/>'
    +'<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><pane ySplit="'+HEAD_ROW+'" topLeftCell="A'+FIRST+'" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A'+FIRST+'" sqref="A'+FIRST+'"/></sheetView></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="18"/>'
    +'<cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="32" customWidth="1"/><col min="4" max="4" width="8" customWidth="1"/><col min="5" max="5" width="20" customWidth="1"/><col min="6" max="6" width="40" customWidth="1"/></cols>'
    +'<sheetData>'+sd+'</sheetData>'
    +'<autoFilter ref="A'+HEAD_ROW+':F'+LAST+'"/>'
    +'<mergeCells count="3"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/><mergeCell ref="A3:F3"/></mergeCells>'
    +'<conditionalFormatting sqref="A'+FIRST+':F'+LAST+'"><cfRule type="expression" dxfId="0" priority="1"><formula>$A'+FIRST+'="☑"</formula></cfRule></conditionalFormatting>'
    +'<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="チェック欄" error="☐ か ☑ を選んでください。" promptTitle="チェック欄" prompt="リストから ☐ / ☑ を選びます。" sqref="A'+FIRST+':A'+LAST+'"><formula1>"☐,☑"</formula1></dataValidation></dataValidations>'
    +'<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
    +'<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    +'<headerFooter><oddFooter>&amp;C&amp;P / &amp;N ページ</oddFooter></headerFooter>'
    +'</worksheet>';
  const FONT='Yu Gothic';
  const fnt=(sz,b,col)=>'<font>'+(b?'<b/>':'')+'<sz val="'+sz+'"/><color rgb="'+col+'"/><name val="'+FONT+'"/><family val="2"/><charset val="128"/></font>';
  const fill=c=>'<fill><patternFill patternType="solid"><fgColor rgb="'+c+'"/><bgColor indexed="64"/></patternFill></fill>';
  const side=(t,c)=>'<'+t+' style="thin"><color rgb="'+c+'"/></'+t+'>';
  const bord=c=>'<border>'+side('left',c)+side('right',c)+side('top',c)+side('bottom',c)+'<diagonal/></border>';
  const xf=(num,font,fl,bd,al)=>'<xf numFmtId="'+num+'" fontId="'+font+'" fillId="'+fl+'" borderId="'+bd+'" xfId="0"'
    +(num?' applyNumberFormat="1"':'')+' applyFont="1"'+(fl?' applyFill="1"':'')+(bd?' applyBorder="1"':'')+' applyAlignment="1"><alignment '+al+'/></xf>';
  const L='horizontal="left" vertical="center"', C='horizontal="center" vertical="center"', W='horizontal="left" vertical="center" wrapText="1"';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<fonts count="7">'+fnt(10,0,'FF262626')+fnt(10,1,'FFFFFFFF')+fnt(16,1,'FF1F3864')+fnt(9,0,'FF595959')+fnt(14,0,'FF262626')+fnt(10,1,'FF1F3864')+fnt(10,0,'FF262626')+'</fonts>'
    +'<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill('FF2F5597')+fill('FFF2F6FC')+fill('FFDDEBF7')+fill('FFFFF8E1')+'</fills>'
    +'<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>'+bord('FFBFBFBF')+bord('FF2F5597')+'</borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="16">'
    +xf(0,0,0,0,L)            // 0 既定
    +xf(0,2,0,0,L)            // 1 タイトル
    +xf(0,3,0,0,L)            // 2 メタ情報
    +xf(0,3,5,0,W)            // 3 凡例（薄い黄）
    +xf(0,1,2,2,C+' wrapText="1"')   // 4 見出し（濃い青・白文字）
    +xf(0,4,0,1,C)            // 5 チェック
    +xf(0,0,0,1,L)            // 6 文字
    +xf(1,0,0,1,C)            // 7 数量
    +xf(0,0,0,1,W)            // 8 コメント
    +xf(0,4,3,1,C)            // 9  チェック(帯)
    +xf(0,0,3,1,L)            // 10 文字(帯)
    +xf(1,0,3,1,C)            // 11 数量(帯)
    +xf(0,0,3,1,W)            // 12 コメント(帯)
    +xf(0,5,4,1,'horizontal="right" vertical="center"')   // 13 合計ラベル
    +xf(1,5,4,1,C)            // 14 合計の値
    +xf(0,5,4,1,L)            // 15 合計の空欄
    +'</cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    +'<dxfs count="1"><dxf><font><color rgb="FF595959"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor rgb="FFE2EFDA"/></patternFill></fill></dxf></dxfs>'
    +'</styleSheet>';
  const sst='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'+ssCount+'" uniqueCount="'+ss.length+'">'
    +ss.map(s=>'<si><t xml:space="preserve">'+esc(s)+'</t></si>').join('')+'</sst>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook '+NS+'><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>'
    +'<sheets><sheet name="'+SHEET_NAME+'" sheetId="1" r:id="rId1"/></sheets>'
    +'<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\''+SHEET_NAME+'\'!$A$'+HEAD_ROW+':$F$'+LAST+'</definedName>'
    +'<definedName name="_xlnm.Print_Titles" localSheetId="0">\''+SHEET_NAME+'\'!$'+HEAD_ROW+':$'+HEAD_ROW+'</definedName></definedNames>'
    +'<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships', PR='http://schemas.openxmlformats.org/package/2006/relationships';
  const files=[
   {name:'[Content_Types].xml',data:utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>')},
   {name:'_rels/.rels',data:utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="'+R+'/extended-properties" Target="docProps/app.xml"/></Relationships>')},
   {name:'docProps/core.xml',data:utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+esc(SHEET_NAME)+'</dc:title><dc:creator>Office Planner</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">'+now.toISOString().replace(/\.\d+Z$/,'Z')+'</dcterms:created></cp:coreProperties>')},
   {name:'docProps/app.xml',data:utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Office Planner</Application></Properties>')},
   {name:'xl/workbook.xml',data:utf8(wb)},
   {name:'xl/_rels/workbook.xml.rels',data:utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+R+'/styles" Target="styles.xml"/><Relationship Id="rId3" Type="'+R+'/sharedStrings" Target="sharedStrings.xml"/></Relationships>')},
   {name:'xl/styles.xml',data:utf8(styles)},
   {name:'xl/sharedStrings.xml',data:utf8(sst)},
   {name:'xl/worksheets/sheet1.xml',data:utf8(sheet)}
  ];
  return {bytes:zipStore(files),rows:rows,stats:res.stats,totalQty:totalQty};
}

/* ── 画面（確認画面と出力ボタン） ── */
const state={group:true,visibleOnly:false,includeStruct:false,outsideNote:true};
const modal=document.createElement('div');
modal.className='modal-overlay'; modal.id='modal-itemlist';
modal.innerHTML=''
 +'<div class="modal" style="width:600px;max-width:94vw;">'
 +'<h3>📊 物品リストをExcelで出力</h3>'
 +'<p>置いてある物を一覧にして、Excelファイル（.xlsx）に書き出します。列は「チェック／区分／物品／数量／サイズ(m) 幅×奥行／コメント」です。</p>'
 +'<div id="il-opts" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;font-size:12px;color:var(--text2);"></div>'
 +'<div id="il-summary" style="font-size:12px;margin-bottom:6px;color:var(--text);font-weight:600;"></div>'
 +'<div id="il-preview" style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:6px;margin-bottom:12px;"></div>'
 +'<div class="modal-btns"><button class="modal-btn" id="il-cancel">キャンセル</button><button class="modal-btn" id="il-ok" style="background:var(--accent);color:#fff;border-color:var(--accent);">📥 Excelファイルを保存</button></div>'
 +'</div>';
document.body.appendChild(modal);
const OPTS=[['group','同じ物（名前とサイズが同じ）を1行にまとめて、数量を出す'],['visibleOnly','非表示のレイヤーにある物は含めない'],['includeStruct','構造タブの物（壁・窓・ドア・設備など）も含める'],['outsideNote','部屋の外にある物は、コメント欄に「部屋の外」と書く']];
const optBox=modal.querySelector('#il-opts');
for(const [k,label] of OPTS){
  const l=document.createElement('label'); l.style.cssText='display:flex;gap:7px;align-items:center;cursor:pointer;';
  const cb=document.createElement('input'); cb.type='checkbox'; cb.id='il-'+k; cb.checked=state[k];
  cb.addEventListener('change',()=>{ state[k]=cb.checked; refresh(); });
  l.appendChild(cb); l.appendChild(document.createTextNode(label)); optBox.appendChild(l);
}
function refresh(){
  const res=buildItemRows(state), rows=res.rows, st=res.stats;
  const qty=rows.reduce((a,r)=>a+r.qty,0);
  const sum=modal.querySelector('#il-summary'), pv=modal.querySelector('#il-preview'), ok=modal.querySelector('#il-ok');
  const ex=[]; if(st.struct) ex.push('構造物 '+st.struct+' 点'); if(st.hidden) ex.push('非表示レイヤー '+st.hidden+' 点');
  pv.textContent='';
  if(!rows.length){
    sum.textContent='出力できる物がありません'+(ex.length?'（除外: '+ex.join('・')+'）':'')+'。';
    ok.disabled=true; ok.style.opacity='.45'; return;
  }
  ok.disabled=false; ok.style.opacity='1';
  sum.textContent=rows.length+' 行・合計 '+qty+' 点を出力します'+(ex.length?'（除外: '+ex.join('・')+'）':'');
  const t=document.createElement('table'); t.style.cssText='width:100%;border-collapse:collapse;font-size:11px;';
  const mk=(tag,vals,css)=>{ const tr=document.createElement('tr'); vals.forEach(v=>{ const c=document.createElement(tag); c.textContent=v; c.style.cssText='padding:4px 8px;border-bottom:1px solid var(--border);text-align:left;'+(css||''); tr.appendChild(c); }); return tr; };
  t.appendChild(mk('th',['区分','物品','数量','サイズ(m)'],'background:var(--surface2);position:sticky;top:0;'));
  rows.slice(0,40).forEach(r=>t.appendChild(mk('td',[r.kubun,r.name,String(r.qty),r.size])));
  pv.appendChild(t);
  if(rows.length>40){ const m=document.createElement('div'); m.style.cssText='padding:5px 8px;font-size:11px;color:var(--text3);'; m.textContent='… ほか '+(rows.length-40)+' 行（ファイルには全行が入ります）'; pv.appendChild(m); }
}
function fileName(){
  const n=new Date(), p=x=>String(x).padStart(2,'0');
  const slot=(typeof window._opCurrentSlotName==='function'?window._opCurrentSlotName():'').replace(/[\\\/:*?"<>|\u0000-\u001F]/g,'_');
  return '物品リスト'+(slot?'_'+slot:'')+'_'+n.getFullYear()+p(n.getMonth()+1)+p(n.getDate())+'.xlsx';
}
function download(bytes,name){
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
modal.querySelector('#il-cancel').onclick=()=>hideModal('modal-itemlist');
modal.querySelector('#il-ok').onclick=()=>{
  try{
    const slot=(typeof window._opCurrentSlotName==='function')?window._opCurrentSlotName():'';
    const r=buildXlsx(state,{slotName:slot});
    if(!r.rows.length){ showToast('出力できる物がありません'); return; }
    const name=fileName(); download(r.bytes,name);
    hideModal('modal-itemlist');
    showToast('📊 '+name+' を保存しました（'+r.rows.length+' 行・'+r.totalQty+' 点）',4000);
  }catch(ex){ console.error('itemlist export failed',ex); showToast('物品リストの出力に失敗しました：'+(ex&&ex.message||ex),5000); }
};
const btn=document.createElement('button');
btn.className='hbtn'; btn.id='btn-itemlist'; btn.textContent='📊 物品リスト'; btn.title='置いてある物をExcelの一覧で出力';
btn.addEventListener('click',()=>{ refresh(); showModal('modal-itemlist'); });
const before=document.getElementById('btn-slots');
if(before&&before.parentNode) before.parentNode.insertBefore(btn,before); else document.getElementById('header').appendChild(btn);
window._opItemRows=buildItemRows;
window._opBuildXlsx=buildXlsx;
})();
