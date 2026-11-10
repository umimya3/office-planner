// ═══════════════════════════════════════════════════════════════
//  PATCH v7: ヘルプ・ドキュメントモーダル
// ═══════════════════════════════════════════════════════════════
(function(){
'use strict';

// ── CSS ─────────────────────────────────────────────────────
const css = document.createElement('style');
css.textContent = `
#help-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; pointer-events: none;
  transition: opacity .2s;
}
#help-overlay.open { opacity: 1; pointer-events: auto; }

#help-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: min(860px, 96vw);
  height: min(680px, 92vh);
  display: flex; flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,.45);
  overflow: hidden;
}

#help-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#help-title {
  font-size: 15px; font-weight: 700; color: var(--text); flex: 1;
}
#help-version { font-size: 10px; color: var(--text3); }
#help-close {
  background: none; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text3); cursor: pointer; padding: 4px 10px; font-size: 12px;
  transition: .13s;
}
#help-close:hover { border-color: var(--accent); color: var(--accent); }

#help-tabs {
  display: flex; gap: 0;
  padding: 8px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0; flex-wrap: wrap;
}
.help-tab {
  padding: 6px 14px; font-size: 11px; font-weight: 600;
  cursor: pointer; color: var(--text3);
  border-bottom: 2px solid transparent;
  transition: .13s; white-space: nowrap;
}
.help-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.help-tab:hover:not(.active) { color: var(--text); }

#help-body {
  flex: 1; overflow-y: auto; padding: 18px 22px 24px;
  font-size: 12px; color: var(--text); line-height: 1.75;
}
.help-page { display: none; }
.help-page.active { display: block; }

/* Doc styles */
.h-h1 { font-size: 16px; font-weight: 700; color: var(--text); margin: 0 0 14px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
.h-h2 { font-size: 13px; font-weight: 700; color: var(--accent); margin: 18px 0 7px; }
.h-h3 { font-size: 11px; font-weight: 700; color: var(--text); margin: 12px 0 5px; }
.h-p  { margin: 0 0 8px; color: var(--text2); }
.h-note {
  background: rgba(91,140,255,.10); border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0; padding: 7px 12px; margin: 8px 0; font-size: 11px;
}
.h-warn {
  background: rgba(255,180,0,.10); border-left: 3px solid var(--warn);
  border-radius: 0 6px 6px 0; padding: 7px 12px; margin: 8px 0; font-size: 11px; color: var(--text2);
}
.h-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0; }
.h-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 8px 0; }
.h-card {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 12px;
}
.h-card-title { font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 5px; }
.h-card-body  { font-size: 10px; color: var(--text3); line-height: 1.7; }
.h-badge {
  display: inline-block; background: var(--surface3);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 1px 6px; font-size: 10px; font-family: monospace;
  color: var(--text2); margin: 1px;
}
.h-accent { color: var(--accent); font-weight: 600; }
table.h-tbl { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
table.h-tbl th { background: var(--surface2); padding: 6px 10px; text-align: left; font-weight: 600; color: var(--text); border-bottom: 1px solid var(--border); }
table.h-tbl td { padding: 5px 10px; border-bottom: 1px solid var(--border); color: var(--text2); vertical-align: top; }
table.h-tbl tr:last-child td { border-bottom: none; }
table.h-tbl td:first-child { font-family: monospace; color: var(--accent); white-space: nowrap; }
.h-step { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0; }
.h-step-num { background: var(--accent); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.h-step-body { flex: 1; font-size: 11px; color: var(--text2); }
.h-icon-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 11px; color: var(--text2); }
.h-icon-row .icon { font-size: 16px; width: 26px; text-align: center; }
hr.h-sep { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
`;
document.head.appendChild(css);

// ── HTML ────────────────────────────────────────────────────
const overlay = document.createElement('div');
overlay.id = 'help-overlay';
overlay.innerHTML = `
<div id="help-modal">
  <div id="help-header">
    <span style="font-size:18px;">📖</span>
    <div id="help-title">Office Planner — 操作ガイド</div>
    <span id="help-version">v1.12.0</span>
    <button id="help-recovery" class="hbtn" title="診断情報のコピー・保存データの退避・復旧操作">🩺 診断・復旧</button>
    <button id="help-close">✕ 閉じる</button>
  </div>
  <div id="help-tabs">
    <div class="help-tab active" data-page="start">🚀 はじめに</div>
    <div class="help-tab" data-page="basic">🖱 基本操作</div>
    <div class="help-tab" data-page="objects">📦 オブジェクト</div>
    <div class="help-tab" data-page="lines">⚡ 配線・線</div>
    <div class="help-tab" data-page="layers">🗂 レイヤー</div>
    <div class="help-tab" data-page="view3d">🏢 3D表示</div>
    <div class="help-tab" data-page="sim">🚶 在室シミュ</div>
    <div class="help-tab" data-page="save">💾 保存・読込</div>
    <div class="help-tab" data-page="shortcut">⌨ ショートカット</div>
  </div>
  <div id="help-body">

    <!-- ══ はじめに ══ -->
    <div class="help-page active" id="page-start">
      <div class="h-h1">📐 Office Planner とは</div>
      <p class="h-p">部屋・倉庫・オフィスのレイアウトを平面図（2D）で編集し、立体（3D）で確認するツールです。ブラウザだけで動作し、データはお使いのブラウザ内に保存されます。</p>
      <div class="h-grid">
        <div class="h-card"><div class="h-card-title">🗺 2D編集モード</div><div class="h-card-body">家具・備品・配線を平面図上に配置してレイアウトを設計します。</div></div>
        <div class="h-card"><div class="h-card-title">🏢 3D表示モード</div><div class="h-card-body">2Dのデータを立体にして確認します。9:00〜18:00の在室シミュレーションも見られます（3Dでは編集できません）。</div></div>
      </div>
      <div class="h-h2">🏁 最初にやること</div>
      <div class="h-step"><div class="h-step-num">1</div><div class="h-step-body"><b>部屋サイズを決める</b> — 右パネルの「部屋サイズ」に幅・奥行をメートルで入力します（0.5〜100m）。</div></div>
      <div class="h-step"><div class="h-step-num">2</div><div class="h-step-body"><b>置く</b> — 左のタブ（家具・構造・備品・OA用品）で項目をクリックすると、部屋の中央に置かれます。ドラッグで移動します。</div></div>
      <div class="h-step"><div class="h-step-num">3</div><div class="h-step-body"><b>整える</b> — 右パネルで名前・位置・サイズ・回転・色を変更できます。Rキーで90°回転、矢印キーで10cm移動します。</div></div>
      <div class="h-step"><div class="h-step-num">4</div><div class="h-step-body"><b>保存する</b> — 「📁 スロット」に名前を付けて保存するか、「📤 保存」でJSONファイルに書き出します。</div></div>
      <div class="h-note">📍 <b>部屋の外にも置けます。</b>部屋の周囲に余白があり（初期3m、右パネルで0〜50m）、そこへドラッグして置けます。外へ出すと余白は自動で広がります。</div>
      <div class="h-note">💾 編集内容は約0.5秒後にブラウザへ自動保存され、次回起動時に復元されます（画面下の表示が「自動保存済」になります）。ただしブラウザのデータ消去や別のPC・別のブラウザでは引き継がれないため、大切なデータはJSONファイルでも保管してください。</div>
      <div class="h-h2">📐 グリッドと単位</div>
      <p class="h-p">グリッドの太線は<b>1m</b>、細線は<b>10cm</b>です。スナップは<b>10cm単位</b>で、右パネルの「スナップ」でON/OFFできます。</p>
      <div class="h-h2">⚠ 現在できないこと</div>
      <div class="h-warn">ドラッグでの範囲選択・ドラッグでのサイズ変更（右パネルの数値入力で変更します）には対応していません。</div>
    </div>

    <!-- ══ 基本操作 ══ -->
    <div class="help-page" id="page-basic">
      <div class="h-h1">🖱 基本操作</div>
      <div class="h-h2">表示の拡大・縮小</div>
      <p class="h-p"><b>拡大・縮小</b>：マウスホイール（カーソルの位置を中心に拡大縮小します）、または右下の「＋」「－」。</p>
      <p class="h-p"><b>画面の移動（パン）</b>：マウスの<b>中ボタンをドラッグ</b>、<b>Space を押しながらドラッグ</b>、または画面端のスクロールバー。</p>
      <p class="h-p"><b>フィット</b>：右下の「⊡」で部屋がちょうど収まる大きさに、「⛶」で部屋と置いたものすべてが収まる大きさにします。</p>
      <div class="h-h2">オブジェクトの操作</div>
      <table class="h-tbl">
        <tr><th>操作</th><th>方法</th></tr>
        <tr><td>選択</td><td>クリック（選択したものは最前面に移ります）</td></tr>
        <tr><td>複数選択</td><td>Ctrl（Macは⌘）＋クリックで追加／解除</td></tr>
        <tr><td>全選択</td><td>Ctrl＋A（表示中のレイヤーだけが対象）</td></tr>
        <tr><td>選択解除</td><td>空白をクリック、または Esc</td></tr>
        <tr><td>移動</td><td>ドラッグ、または矢印キー（10cm）</td></tr>
        <tr><td>回転</td><td>Rキーで90°。右パネルの回転欄に角度を入力、または「↻ 90°」「↺ −90°」ボタン</td></tr>
        <tr><td>コピー／貼り付け</td><td>Ctrl＋C ／ Ctrl＋V</td></tr>
        <tr><td>複製</td><td>Ctrl＋D、または右クリックメニュー</td></tr>
        <tr><td>削除</td><td>Delete（Backspace）</td></tr>
        <tr><td>元に戻す</td><td>Ctrl（Macは⌘）＋Z、またはヘッダーの「↶」</td></tr>
        <tr><td>やり直し</td><td>Ctrl＋Y（または Ctrl＋Shift＋Z）、またはヘッダーの「↷」</td></tr>
        <tr><td>前後の入れ替え</td><td>右パネル／右クリックメニューの「最前面」「最背面」</td></tr>
      </table>
      <div class="h-note">↶ 元に戻す／↷ やり直し は、<b>最大100回</b>までです。物・線の追加・移動・削除・変更、部屋サイズ・余白、レイヤーの追加・削除・名前、ファイルやスロットの読込、全クリアが対象です。レイヤーの表示/非表示・選択・拡大縮小は対象外で、戻しても変わりません。ドラッグやキーの連打は、1回分にまとまります。ブラウザを閉じると履歴は消えます。3D表示中は使えません。欄に文字を入力している間は、その欄の中だけで元に戻ります。</div>
      <div class="h-note">右クリックメニューには、コピー・貼り付け・複製・±90°回転・最前面／最背面・削除があります。</div>
      <div class="h-h2">右パネル</div>
      <div class="h-grid">
        <div class="h-card"><div class="h-card-title">表示設定・部屋</div><div class="h-card-body">グリッド（10cm／1m）、ラベル（名前／物品ID／細目・メモのどれを出すか）、スナップ、白黒印刷モードのON/OFF<br>部屋サイズ（幅・奥行）、面積、家具数、線数<br>部屋の外の余白、部屋の外にある物の個数（「選択」「中へ戻す」）</div></div>
        <div class="h-card"><div class="h-card-title">選択中のプロパティ</div><div class="h-card-body">ラベル・物品ID・細目／メモ・X・Y・幅・奥行（0.05m以上）・回転（度）・色。数値欄が空や不正な値のときは、直前の正常な値が保たれます。</div></div>
      </div>
      <div class="h-h2">ヘッダーのボタン</div>
      <div class="h-icon-row"><span class="icon">↶</span><b>↶ ／ ↷</b> — 元に戻す／やり直し（Ctrl＋Z ／ Ctrl＋Y）。</div>
      <div class="h-icon-row"><span class="icon">📥</span><b>読込</b> — JSONファイルを選ぶか、内容を貼り付けて読み込みます。</div>
      <div class="h-icon-row"><span class="icon">📤</span><b>保存</b> — 現在のレイアウトをJSONファイルとしてダウンロードします。</div>
      <div class="h-icon-row"><span class="icon">🖼</span><b>画像保存</b> — 2Dの図面を、高解像度のPNG画像として保存します（範囲・解像度・配色を選べます。詳しくは「保存・読込」の項）。</div>
      <div class="h-icon-row"><span class="icon">📊</span><b>物品リスト</b> — 置いてある物を一覧にしたExcelファイル（.xlsx）を作ります。ここから、ExcelでIDやメモを書き込んで図面に取り込むこともできます。</div>
      <div class="h-icon-row"><span class="icon">📁</span><b>スロット</b> — 最大10件のレイアウトに名前を付けて保存・切替します。</div>
      <div class="h-icon-row"><span class="icon">📏</span><b>ルーラー</b> — 2点間の距離を測ります。</div>
      <div class="h-icon-row"><span class="icon">🌓</span><b>テーマ</b> — 押すたびに「🌓 自動」→「☀ ライト」→「🌙 ダーク」と切り替わります。<b>自動</b>は端末（OS・ブラウザ）のライト／ダーク設定に合わせ、端末側で切り替えると、開いたまま追従します。選んだ設定は記憶され、3D表示にも反映されます。</div>
      <div class="h-icon-row"><span class="icon">🗑</span><b>全クリア</b> — 家具と配線をすべて消します（確認画面が出ます）。</div>
      <div class="h-icon-row"><span class="icon">📖</span><b>ヘルプ</b> — この画面です（F1キーでも開きます）。右上の「🩺 診断・復旧」から、不具合時の対処ができます。</div>
      <div class="h-icon-row"><span class="icon">◧</span><b>◧ ／ ◨</b> — 左のパネル／右のパネルを隠す・出す（画面が狭いときに便利です。設定は記憶されます）。</div>
      <div class="h-h2">📏 ルーラー</div>
      <p class="h-p">「ルーラー」をONにして、<b>1点目をクリック → 2点目をクリック</b>すると、直線距離と横・縦の差が表示されます。点はスナップ設定に従います。</p>
      <div class="h-note">Esc で計測点をリセットし、もう一度 Esc を押すとルーラーを終了します（「ルーラー」ボタンでも終了できます）。ルーラーを使っている間は、削除・回転・移動などの編集キーは働きません。線描画モードとは同時に使えません。</div>
    </div>

    <!-- ══ オブジェクト ══ -->
    <div class="help-page" id="page-objects">
      <div class="h-h1">📦 オブジェクトの種類と配置</div>
      <div class="h-h2">左サイドバーのタブ</div>
      <table class="h-tbl">
        <tr><th>タブ</th><th>点数</th><th>カテゴリ</th></tr>
        <tr><td>家具</td><td>45</td><td>デスク・チェア・会議用・収納・OA・その他</td></tr>
        <tr><td>構造</td><td>24</td><td>壁・仕切り／窓・ドア／設備</td></tr>
        <tr><td>備品</td><td>53</td><td>運搬（台車・パレット等）・脚立・電気（ドラムリール等）・環境（扇風機・ストーブ等）・資材（段ボール・コンテナ・一斗缶等）・工具・安全・特殊</td></tr>
        <tr><td>OA用品</td><td>98</td><td>PC・モニター・入力デバイス・印刷スキャン・ネット機器・音響映像・電源管理・事務用品・通信機器・セキュリティ・計測機器・整理保管</td></tr>
        <tr><td>配線</td><td>—</td><td>電気・LAN等の線を引きます（「配線・線」の項を参照）</td></tr>
        <tr><td>レイヤー</td><td>—</td><td>表示の切替と整理（「レイヤー」の項を参照）</td></tr>
      </table>
      <div class="h-h2">🔍 検索</div>
      <p class="h-p">家具・構造・備品・OA用品のタブ上部にある検索窓に、品目名またはカテゴリ名の一部を入力すると絞り込めます。<span class="h-badge">Ctrl＋F</span> で検索窓に移動できます。</p>
      <div class="h-h2">🏷 物品ID・細目・メモ</div>
      <p class="h-p">実際の物に貼ってある管理シールの番号（例: KA010111）や、注意書きなどを、物ごとに記録できます。物を1つ選ぶと、右パネルに入力欄が出ます。</p>
      <table class="h-tbl">
        <tr><th>項目</th><th>内容</th></tr>
        <tr><td>物品ID</td><td>40文字まで。全角／半角・大文字／小文字・前後の空白の違いは区別せず、同じIDとして扱います。同じIDの物が他にもあると、入力欄の下に警告が出ます（物のリストにも「重複」と出ます）</td></tr>
        <tr><td>細目・メモ</td><td>120文字まで。「壊れやすい」「業務用デスク」など、自由に書けます</td></tr>
        <tr><td>図面に表示</td><td>右パネル「表示設定」の「└ 物品ID」「└ 細目・メモ」をONにすると、物のラベルに出ます（「└ 名前」とは別々に切り替えられます）。IDの付け忘れを探すときは、「└ 名前」をOFFにして「└ 物品ID」だけをONにすると、未設定の物に「（ID未設定）」と出ます</td></tr>
      </table>
      <div class="h-note">物品IDと細目・メモは、物をコピーして貼り付けたときには引き継がれません（IDは物ごとに固有の番号のため）。保存データ（JSONファイル・スロット・自動保存）には入ります。この機能を入れる前に保存した古いデータも、そのまま読み込めます（その場合、ID・メモは空になります）。</div>
      <div class="h-h2">🔎 物を探す（図面上で強調）</div>
      <p class="h-p">右パネルの「📋 物のリスト」を開き、検索欄に、名前・物品ID・細目／メモの一部を入力します。</p>
      <table class="h-tbl">
        <tr><th>場面</th><th>動き</th></tr>
        <tr><td>図面の表示</td><td>ヒットした物にピンク色の枠が付き、ほかの物は白っぽく薄くなります</td></tr>
        <tr><td>1件だけに絞れたとき</td><td>その物が画面の中央に来ます（物品IDを打てば、その場所へ移動します）</td></tr>
        <tr><td>リストの行をクリック</td><td>その物を選び、その場所を表示します</td></tr>
        <tr><td>解除</td><td>検索欄を空にするか、「物のリスト」を閉じます</td></tr>
      </table>
      <div class="h-note">検索の対象は物（家具・備品など）で、配線の線は含まれません。非表示レイヤーの物は出ません。強調は2D表示の画面だけで、画像保存には写りません。印刷するときは、検索欄を空にしてから行ってください。</div>
      <div class="h-h2">配置したあとの操作</div>
      <table class="h-tbl">
        <tr><th>やりたいこと</th><th>操作</th></tr>
        <tr><td>表示名を変える</td><td>右パネルの「ラベル」欄</td></tr>
        <tr><td>正確な位置・大きさにする</td><td>右パネルの X・Y・幅・奥行に数値を入力（メートル）</td></tr>
        <tr><td>同じものを並べる</td><td>Ctrl＋C → Ctrl＋V を繰り返す、または Ctrl＋D</td></tr>
        <tr><td>まとめて動かす</td><td>Ctrl＋クリックで複数選択してドラッグ</td></tr>
        <tr><td>レイヤーを変える</td><td>レイヤータブの「選択中を移動」</td></tr>
      </table>
      <div class="h-h2">部屋の外に置く</div>
      <p class="h-p">部屋の枠の外側（少し暗い部分）にも、そのままドラッグして置けます。保管スペースや搬入物の仮置きなどにお使いください。</p>
      <table class="h-tbl">
        <tr><th>やりたいこと</th><th>操作</th></tr>
        <tr><td>置ける範囲を広げる</td><td>右パネル「部屋の外・表示範囲」の余白（0〜50m）。端まで動かして離すと、自動でも広がります</td></tr>
        <tr><td>外にある物を探す</td><td>右パネルの「部屋の外にある物」の個数と、「選択」（選んでその場所を表示）</td></tr>
        <tr><td>外にある物を部屋に戻す</td><td>「中へ戻す」（直前の状態は、スロット画面の「↩ 直前の状態に戻す」で戻せます）</td></tr>
        <tr><td>全部を一度に見る</td><td>右下の「⛶」（全体にフィット）</td></tr>
        <tr><td>一覧から探して移動</td><td>右パネルの「📋 物のリスト」（名前・物品ID・細目／メモで検索できます。クリックでその物を選び、その場所を表示します。非表示レイヤーの物は出ません）</td></tr>
      </table>
      <div class="h-note">部屋の外に置いた物も3D表示には出ます（壁と床は、部屋の部分だけです）。余白は保存され、読み込んだときも再現されます。外に置いた物があるときは、余白をそれより狭くできません。</div>
      <div class="h-h2">ドア・窓・階段</div>
      <p class="h-p">「構造」タブの窓・ドアは、2Dでは専用の記号で描かれ、3Dではドアが壁の切れ目、窓が壁面のガラスとして表示されます。ドア・窓・階段は自動的に「構造」レイヤーに入ります。</p>
    </div>

    <!-- ══ 配線 ══ -->
    <div class="help-page" id="page-lines">
      <div class="h-h1">⚡ 配線・線の引き方</div>
      <div class="h-step"><div class="h-step-num">1</div><div class="h-step-body">左の「配線」タブを開き、<b>線の種類</b>を選びます。</div></div>
      <div class="h-step"><div class="h-step-num">2</div><div class="h-step-body"><b>「✏️ 線描画モード」ボタンをONにします</b>（下の状態表示が「配線描画モード」になります）。種類を選んだだけでは線は引けません。</div></div>
      <div class="h-step"><div class="h-step-num">3</div><div class="h-step-body">キャンバスで<b>クリック（始点）→ クリック（終点）</b>で線が確定します。</div></div>
      <div class="h-step"><div class="h-step-num">4</div><div class="h-step-body">Esc で描きかけの線をキャンセルできます。もう一度 Esc を押すか「線描画モード」ボタンを押すと、選択モードに戻ります。ルーラーとは同時に使えません。</div></div>
      <div class="h-h2">線の種類</div>
      <table class="h-tbl">
        <tr><th>種類</th><th>表示</th></tr>
        <tr><td>電気配線</td><td>黄・実線</td></tr>
        <tr><td>LAN</td><td>青・実線</td></tr>
        <tr><td>電話線</td><td>オレンジ・破線</td></tr>
        <tr><td>給排水</td><td>水色・実線</td></tr>
        <tr><td>ガス</td><td>赤・破線</td></tr>
        <tr><td>壁線</td><td>青灰・実線</td></tr>
        <tr><td>寸法線</td><td>灰・破線</td></tr>
        <tr><td>カスタム</td><td>白（色を指定できます）</td></tr>
      </table>
      <div class="h-h2">スタイル設定</div>
      <p class="h-p">「色」はカスタムの線にだけ効きます。「太さ」「線種」は<b>次に引く線</b>に適用されます。引いた線の色・太さは後から変更できないため、変えたいときは削除して引き直してください。</p>
      <div class="h-h2">選択・移動・削除</div>
      <p class="h-p">線をクリックで選択します（Ctrl＋クリックで複数選択）。<b>両端をドラッグすると端点を移動</b>、<b>線の途中をドラッグすると線ごと平行移動</b>します。削除は Delete キー、または「🗑 選択した線を削除」です。</p>
      <div class="h-h2">端点コネクタ（コンセント・LANポート等）</div>
      <p class="h-p">線の両端にコンセントやLANポートの記号を表示できます。線を選択して、配線タブ下部の「端点コネクタ表示」で操作します。</p>
      <div class="h-step"><div class="h-step-num">1</div><div class="h-step-body">「✅ 選択中の線に端点ON」を押します（「⚡ 全電気配線に端点ON」で電気配線とLANをまとめて設定）。</div></div>
      <div class="h-step"><div class="h-step-num">2</div><div class="h-step-body">「端点の種類」で 自動（配線の種類に合わせる）／コンセント／LANポート／電話／給水口／ガス口 を選びます。</div></div>
      <div class="h-step"><div class="h-step-num">3</div><div class="h-step-body">消すときは「❌ 選択中の線の端点OFF」または種類「なし」を押します。</div></div>
      <div class="h-h2">レイヤーとの関係</div>
      <p class="h-p">引いた線は種類に応じたレイヤーに自動で入ります（電気配線→電気配線、LAN→LAN、壁線→構造、その他→その他）。</p>
    </div>

    <!-- ══ レイヤー ══ -->
    <div class="help-page" id="page-layers">
      <div class="h-h1">🗂 レイヤー</div>
      <p class="h-p">家具・電気配線・LAN配線などを層に分けて管理し、必要なものだけを表示して検討できます。</p>
      <div class="h-h2">初期のレイヤー</div>
      <table class="h-tbl">
        <tr><th>名前</th><th>主に入るもの</th></tr>
        <tr><td>家具</td><td>デスク・チェア・備品・OA用品など</td></tr>
        <tr><td>構造</td><td>ドア・窓・階段、壁線</td></tr>
        <tr><td>電気配線</td><td>電気配線の線</td></tr>
        <tr><td>LAN</td><td>LANの線</td></tr>
        <tr><td>その他</td><td>電話線・給排水・ガス・寸法線・カスタム</td></tr>
      </table>
      <div class="h-h2">操作</div>
      <div class="h-icon-row"><span class="icon">👁</span>目のアイコンで<b>表示／非表示</b>を切り替えます。</div>
      <div class="h-icon-row"><span class="icon">✏</span>レイヤー名をクリックすると<b>名前を編集</b>できます。</div>
      <div class="h-icon-row"><span class="icon">＋</span>「＋ レイヤー追加」で追加できます（最大30個）。</div>
      <div class="h-icon-row"><span class="icon">✕</span>中身が空のレイヤーだけ削除できます。</div>
      <div class="h-icon-row"><span class="icon">📌</span>行をクリックすると<b>アクティブレイヤー</b>になります（画面左上のバッジに表示）。</div>
      <div class="h-h2">オブジェクトをレイヤーに入れる</div>
      <p class="h-p">新しく置いたものはアクティブレイヤーに入ります（ドア・窓・階段は「構造」、線は種類別）。あとから変えるには、対象を選択してレイヤータブを開き、「選択中を移動」から移動先を選びます。</p>
      <div class="h-h2">非表示にしたレイヤー</div>
      <p class="h-p">非表示にすると、描画されないだけでなく、クリックでの選択・Ctrl＋A の対象からも外れます。非表示にした時点で、そのレイヤー内の選択も解除されます。</p>
      <div class="h-warn">⚠ 2Dで非表示にしたレイヤーも、<b>3D表示には表示されます</b>（3Dの表示切替は3D画面の左上パネルで行います）。</div>
    </div>

    <!-- ══ 3D表示 ══ -->
    <div class="help-page" id="page-view3d">
      <div class="h-h1">🏢 3D表示</div>
      <p class="h-p">ヘッダーの「🏢 3D表示」で、2Dのレイアウトを立体にして確認します。3Dタブを開くたびに、その時点の2Dデータが変換されます。3D画面は<b>表示専用</b>で、左右のパネルは暗くなって操作できません（キーでの編集も無効です）。2Dに戻ると編集を再開できます。</p>
      <div class="h-note">3D表示に必要な部品はこのファイルに含まれているため、インターネットに接続していないPCでも使えます。お使いのPCが3D描画（WebGL）に対応していない場合は、案内が表示され、2D編集をそのまま続けられます。</div>
      <div class="h-h2">視点の操作</div>
      <table class="h-tbl">
        <tr><th>操作</th><th>マウス</th><th>タッチ</th></tr>
        <tr><td>回す</td><td>左ドラッグ</td><td>1本指ドラッグ</td></tr>
        <tr><td>平行移動</td><td>右ドラッグ、または Shift＋ドラッグ</td><td>（非対応）</td></tr>
        <tr><td>拡大・縮小</td><td>ホイール</td><td>2本指ピンチ</td></tr>
      </table>
      <div class="h-h2">右上のボタン</div>
      <div class="h-icon-row"><span class="icon">🔄</span><b>3Dビュー</b> — 斜めからの視点</div>
      <div class="h-icon-row"><span class="icon">⬇</span><b>上から</b> — 真上からの視点</div>
      <div class="h-icon-row"><span class="icon">🎯</span><b>視点リセット</b> — 初期の視点に戻す</div>
      <div class="h-icon-row"><span class="icon">🚶</span><b>在室シミュレーション</b> — 次の項を参照</div>
      <div class="h-h2">左上の表示パネル</div>
      <table class="h-tbl">
        <tr><th>項目</th><th>内容</th></tr>
        <tr><td>家具・備品</td><td>家具・備品・OA用品などの立体</td></tr>
        <tr><td>コンセント</td><td>「電気配線」レイヤーに入れたオブジェクト</td></tr>
        <tr><td>付箋・メモ</td><td>付箋用の項目です（現在は置くことができません）</td></tr>
        <tr><td>配線</td><td>床面に引いた線（電気=黄、LAN=青、その他=橙）</td></tr>
        <tr><td>シム人物</td><td>在室シミュレーションの人物</td></tr>
        <tr><td>常時ラベル</td><td>名前を常に表示</td></tr>
      </table>
      <div class="h-h2">どう立体になるか</div>
      <p class="h-p"><b>高さはオブジェクトの名前から推定</b>します（例：デスク72cm、ロッカー180cm、チェア46cm）。名前から判別できないものは大きさから推定して、少し透けて表示されます。名前を右パネルで変えると、3Dにも反映されます。</p>
      <div class="h-warn">⚠ <b>3D表示は「確認用」です。</b>
        <br>・高さは名前からの推定値で、実測値ではありません（半透明の物は、大きさから推定しています）。
        <br>・人の動きは演出です。家具や壁を避けて通れるかの検証ではありません。通路の幅は、2Dでルーラーを使って実寸で確認してください。
        <br>・2Dで非表示にしたレイヤーも、3Dには表示されます。</div>
    </div>

    <!-- ══ 在室シミュレーション ══ -->
    <div class="help-page" id="page-sim">
      <div class="h-h1">🚶 在室シミュレーション（3D）</div>
      <p class="h-p">3D表示の右上「🚶 在室シミュレーション」を押すと、<b>9:00〜18:00</b>の1日を人が動くようすを再生します。</p>
      <div class="h-grid">
        <div class="h-card"><div class="h-card-title">人の数と席</div><div class="h-card-body">席の数だけ人を出せます。「チェア」「椅子」「スツール」の名前のものが席になります（名前から判別できない丸型のものも席として扱われます）。初期表示は最大9人で、スライダーで増減できます。</div></div>
        <div class="h-card"><div class="h-card-title">行動のタイプ</div><div class="h-card-body">デスクワーク・技術支援・会議調整・庶務の4タイプが順に割り当てられ、コピー機・作業台・会議テーブル・冷蔵庫や洗面台・ロッカー・掲示板へ移動します（対応する名前のものがあるとき）。</div></div>
      </div>
      <div class="h-h2">操作</div>
      <p class="h-p">時刻スライダーで好きな時刻に移動、「一時停止／再生」、速度は0.5倍〜8倍です。人物の下の一覧に、各人の今の状態が表示されます。</p>
      <div class="h-warn">⚠ 人の移動は<b>演出</b>です。中央の通路を経由する決まった動きで、家具や壁を避けて歩けるかを確かめるものではありません。通路の幅などは、ルーラーで実寸を測って確認してください。</div>
    </div>

    <!-- ══ 保存・読込 ══ -->
    <div class="help-page" id="page-save">
      <div class="h-h1">💾 保存と読み込み</div>
      <div class="h-h2">自動保存</div>
      <p class="h-p">編集のたびに約0.5秒後、現在の内容がブラウザに自動保存され、次回起動時に復元されます。これは<b>スロットとは別の仕組み</b>で、スロットの内容は自動では更新されません。画面右下に「ブラウザに自動保存済 時刻」と表示されます。保存できなかったときは「⚠ 自動保存に失敗」と表示されるので、「📤 保存」でJSONファイルに書き出してください。</p>
      <div class="h-h2">📁 スロット（最大10件）</div>
      <table class="h-tbl">
        <tr><th>項目</th><th>機能</th></tr>
        <tr><td>名前欄</td><td>スロットの名前（例：「職員室」「倉庫A」）</td></tr>
        <tr><td>保存</td><td>今の内容をそのスロットに保存（別の内容が入っているスロットでは確認が出ます。保存できなかったときは、その旨が表示されます）</td></tr>
        <tr><td>読込</td><td>そのスロットの内容を読み込む（部屋サイズも切り替わります）</td></tr>
        <tr><td>削除</td><td>そのスロットを消す</td></tr>
        <tr><td>⬇JSON</td><td>そのスロットをJSONファイルでダウンロード</td></tr>
      </table>
      <div class="h-note">Ctrl＋S で、最後に保存・読込したスロットへ上書き保存します（まだ選んでいないときはスロット画面が開きます）。</div>
      <div class="h-h2">スロットの状態表示</div>
      <p class="h-p">ヘッダーのスロット名の横に、今の内容とスロットの関係が表示されます。</p>
      <table class="h-tbl">
        <tr><th>表示</th><th>意味</th></tr>
        <tr><td>[名前] ✓ 保存済み</td><td>そのスロットと今の内容が一致しています</td></tr>
        <tr><td>[名前] ● 未反映</td><td>スロットに保存したあとの変更があります（ブラウザへの自動保存は済んでいます。スロットに反映するには Ctrl＋S）</td></tr>
        <tr><td>スロット未選択</td><td>どのスロットにも関連付いていません</td></tr>
      </table>
      <div class="h-note">JSONファイルを読み込んだとき・全クリアしたときは、スロットとの関連付けが自動で解除されます（Ctrl＋S で、意図しないスロットを上書きしないためです）。</div>
      <div class="h-h2">↩ 直前の状態に戻す</div>
      <p class="h-p">ファイルの読込・スロットの読込・全クリアを行うと、その<b>直前の内容を1回分だけ</b>保管します。📁スロット画面の下にある「↩ 直前の状態に戻す」で戻せます（もう一度押すと、戻す前の状態に戻ります）。保管はブラウザを閉じても残りますが、ブラウザの保存容量が足りないときは、画面を開いている間だけです。</p>
      <div class="h-h2">📤 保存 ／ 📥 読込（JSONファイル）</div>
      <p class="h-p">「📤 保存」で現在のレイアウトをJSONファイルに書き出します。ほかの人に渡す・バックアップするときは、このファイルを使います。「📥 読込」でそのファイルを選ぶと再現できます。</p>
      <div class="h-note">読み込むときはデータを検査します。一部が壊れていれば、その部分だけ除いて読み込み、除いた数を画面に表示します。読み込めないデータのときは、理由を表示して<b>現在の作業内容はそのまま</b>残します。上限は、ファイル5MB・家具3,000個・線3,000本です。</div>
      <div class="h-warn">⚠ スロットと自動保存はブラウザの中に保存されます。ブラウザのデータを消した場合や、別のPC・別のブラウザ・シークレットモードでは見えません。</div>
      <div class="h-h2">📊 物品リスト（Excel）</div>
      <p class="h-p">ヘッダーの「📊 物品リスト」で、置いてある物を一覧にしたExcelファイル（.xlsx）を作れます。搬入・棚卸し・購入の確認などにお使いください。インターネット接続は不要です。</p>
      <table class="h-tbl">
        <tr><th>列</th><th>内容</th></tr>
        <tr><td>チェック</td><td>セルを選んで ☐ → ☑ に切り替えられます（☑ にした行は緑色になります）</td></tr>
        <tr><td>区分</td><td>家具／備品／OA用品 と、その中の分類（例：家具 / デスク）</td></tr>
        <tr><td>物品</td><td>物の名前。右パネルで名前を変えた物は、別の行になります</td></tr>
        <tr><td>物品ID</td><td>図面で入力した管理シールの番号（例: KA010111）</td></tr>
        <tr><td>細目・メモ</td><td>図面で入力した細目・メモ（「壊れやすい」など）</td></tr>
        <tr><td>数量</td><td>同じ名前・同じサイズ・同じ物品ID・同じ細目の個数。一番下に合計が出ます（絞り込み中は、表示している行だけの合計になります）</td></tr>
        <tr><td>サイズ(m) 幅×奥行</td><td>置いた物の大きさ（メートル）。回転しても変わりません</td></tr>
        <tr><td>コメント</td><td>Excelの中で自由に記入できます（棚卸しの記録など）。部屋の外にある物には、あらかじめ「部屋の外」と入ります。図面には取り込まれません</td></tr>
        <tr><td>図面No.</td><td>図面の中で、その物を見分けるための番号です。ExcelからID・メモを取り込むときの目印なので、<b>変えたり消したりしないでください</b></td></tr>
      </table>
      <p class="h-p">出力前の画面で、次を選べます：同じ物を1行にまとめるか（まとめない場合は1点1行）／非表示のレイヤーの物を除くか／構造タブの物を含めるか／部屋の外の物にコメントを入れるか。画面には、出力される内容のプレビューが出ます。</p>
      <div class="h-note">壁・窓・ドアなどの構造物（構造タブの物）と配線は、標準では含まれません。ファイル名は「物品リスト_スロット名_日付.xlsx」で、ブラウザの保存先（ダウンロード）に保存されます。</div>
      <div class="h-h2">⬆ ExcelからID・メモを取り込む</div>
      <p class="h-p">物品IDや細目・メモを、Excelでまとめて書き込み、図面の物に取り込めます。管理シールの番号を、表で一気に入力したいときに便利です。</p>
      <div class="h-step"><div class="h-step-num">1</div><div class="h-step-body">「📊 物品リスト」を開き、<b>「同じ物を1行にまとめる」のチェックを外して</b>出力します（1点ずつ別の行になります）。</div></div>
      <div class="h-step"><div class="h-step-num">2</div><div class="h-step-body">Excelで、「物品ID」列と「細目・メモ」列を書き込んで保存します（<b>「図面No.」列は変えないでください</b>）。</div></div>
      <div class="h-step"><div class="h-step-num">3</div><div class="h-step-body">もう一度「📊 物品リスト」を開き、左下の「⬆ ExcelからID・メモを取り込む」でそのファイルを選びます。</div></div>
      <div class="h-step"><div class="h-step-num">4</div><div class="h-step-body">確認画面で、<b>変更前→変更後の一覧</b>を見て、「図面に取り込む」を押します。取り込んだあとも、<span class="h-badge">Ctrl＋Z</span> で元に戻せます。</div></div>
      <table class="h-tbl">
        <tr><th>場面</th><th>動き</th></tr>
        <tr><td>空欄のセル</td><td>標準では変更しません（図面側の値が残ります）。確認画面のチェックをONにすると、空欄で図面側も消します</td></tr>
        <tr><td>物品IDの表記</td><td>全角は半角に、小文字は大文字にそろえて取り込みます（例: ＫＡ010111 → KA010111）。40文字まで</td></tr>
        <tr><td>同じIDが重複するとき</td><td>確認画面に警告が出ます（取り込みはできます）。あとで図面側で直せます</td></tr>
        <tr><td>数量が2以上の行</td><td>1つの行に複数の物があるので、物品IDは付けられません（細目・メモは、その行のすべての物に付きます）</td></tr>
        <tr><td>図面に無い「図面No.」の行</td><td>飛ばします（別の図面のファイルかもしれません）</td></tr>
        <tr><td>物品名が図面と違う行</td><td>別の物かもしれないので、標準では飛ばします。確認画面のチェックで、取り込むこともできます</td></tr>
        <tr><td>CSVファイル</td><td>ExcelでCSVにして保存したファイル（文字コードは自動判別）も取り込めます。1行目付近に「物品ID」「細目・メモ」「図面No.」の見出しが必要です</td></tr>
      </table>
      <div class="h-note">取り込めるのは、このアプリの「📊 物品リスト」で出力した形式のファイルです。ファイルをスマホなどの古いブラウザで開く場合、圧縮された.xlsxを読めないことがあります。そのときは、Excelで「CSV UTF-8」形式にして保存し直してください。</div>
      <div class="h-h2">🖼 画像保存（高解像度PNG）</div>
      <p class="h-p">ヘッダーの「🖼 画像保存」で、2Dの図面をPNG画像として保存できます。画面のスクリーンショットではなく、図面を指定の細かさで描き直すため、拡大しても粗くなりません。選択の枠・ルーラー・シミュレーションの人物は写りません。ラベルやグリッドの表示は、いまの画面の設定に従います。</p>
      <table class="h-tbl">
        <tr><th>項目</th><th>選べる内容</th></tr>
        <tr><td>範囲</td><td>部屋＋置いたもの全体（部屋の外に置いた物も含み、まわりに少し余白がつきます）／部屋のみ／表示範囲すべて（部屋の外の余白まで）</td></tr>
        <tr><td>解像度</td><td>標準（長辺 約2400px）／高（約4800px）／最高（約9000px）</td></tr>
        <tr><td>配色</td><td>ライト（白背景・カラー）／白黒印刷用／いまの表示のまま。画面がダークテーマでも、ライトや白黒で保存できます</td></tr>
      </table>
      <div class="h-note">出力サイズは、保存の前に画面に表示されます。スマホなどでは、端末の上限に合わせて自動で小さくなります。画面の拡大率が小さくても、ラベルが読める大きさ（1mあたり60px以上）で描かれます。ファイル名は「office-plan-日付-時刻.png」で、選んだ設定は次回も使われます。保存できるのは2Dの図面だけで、3D表示は対象外です。</div>
      <div class="h-h2">⬜ 白黒印刷モード</div>
      <p class="h-p">右パネル「表示設定」の「白黒印刷モード」をONにすると、2Dの図面が白黒印刷向けの表示になります（画面のテーマがダークでも同じです）。この設定は記憶されます。</p>
      <table class="h-tbl">
        <tr><th>対象</th><th>表示</th></tr>
        <tr><td>物</td><td>元の色の明るさに応じた薄い灰色で塗り、枠と文字は黒にします</td></tr>
        <tr><td>配線・線</td><td>すべて黒にします。種類は、線の形（実線・破線・点線など）で見分けます。端の記号は、電気「電」・LAN「L」・電話「T」・給排水「水」・ガス「ガ」です</td></tr>
        <tr><td>背景・グリッド</td><td>白地に薄い灰色の線にします</td></tr>
      </table>
      <div class="h-h2">🖨 印刷</div>
      <p class="h-p">印刷用のボタンはありません。ブラウザの印刷（Ctrl＋P）を使ってください。印刷時にメニュー類を隠す設定を入れていますが、仕上がりは環境によって異なるため、印刷プレビューで確認してください。用紙には部屋の外の余白も含まれます（余白を0mにすると、部屋だけになります）。</p>
      <div class="h-note">白黒で印刷するときは、先に「白黒印刷モード」をONにしてください。印刷の直前だけ、選択の枠やルーラーなどを消して出力します。紙ではなく画像で渡したいときは、「🖼 画像保存」が便利です。</div>
      <div class="h-h2">🛟 うまく動かないとき</div>
      <p class="h-p">ヘルプ右上の「🩺 診断・復旧」（エラーログ画面の「🛟 復旧・診断」でも同じです）から、次のことができます。アプリが起動できないときは、この画面が自動で開きます。</p>
      <table class="h-tbl">
        <tr><th>やりたいこと</th><th>操作</th></tr>
        <tr><td>不具合を連絡する</td><td>「診断情報」をコピーするか、ファイルに保存して送ります。ブラウザの種類・保存データの状態・直近のエラーなどが入っています。物の名前や配置の中身は含まれません（個数やサイズなどの数だけです）。スロット名は入ることがあります</td></tr>
        <tr><td>保存データを手元に残す</td><td>「保存データをファイルに退避」で、自動保存・スロットすべて・直前の状態をダウンロードできます</td></tr>
        <tr><td>保存データが原因か調べる</td><td>「保存データを読み込まずに再起動」。空の状態で起動し、前回の自動保存データは退避されます（スロットは消えません）。ファイルを開くときの末尾に ?safe=1 を付けても同じです</td></tr>
        <tr><td>自動保存データを消す</td><td>「自動保存データを消去して再起動」。消す前に、自動でダウンロードされます</td></tr>
      </table>
      <div class="h-note">前回の自動保存データが壊れていて読み込めなかったときは、起動時に自動で退避し、画面の下に案内が出ます。「退避データをダウンロード」で取り出せます。3D表示が使えないPCでは案内が出ますが、2D編集はそのまま使えます。</div>
    </div>

    <!-- ══ ショートカット ══ -->
    <div class="help-page" id="page-shortcut">
      <div class="h-h1">⌨ キーボードショートカット</div>
      <div class="h-h2">編集</div>
      <table class="h-tbl">
        <tr><th>キー</th><th>機能</th></tr>
        <tr><td>Ctrl＋C ／ Ctrl＋V</td><td>コピー ／ 貼り付け</td></tr>
        <tr><td>Ctrl＋D</td><td>複製</td></tr>
        <tr><td>Ctrl＋Z</td><td>元に戻す（最大100回）</td></tr>
        <tr><td>Ctrl＋Y ／ Ctrl＋Shift＋Z</td><td>やり直し</td></tr>
        <tr><td>Ctrl＋A</td><td>全選択（表示中のレイヤーのみ）</td></tr>
        <tr><td>Delete ／ Backspace</td><td>選択中のものを削除</td></tr>
        <tr><td>R</td><td>90°回転（ルーラーON中は無効）</td></tr>
        <tr><td>矢印キー</td><td>10cm移動</td></tr>
        <tr><td>Esc</td><td>段階的に戻ります：描きかけの線をキャンセル → 線描画／ルーラーを終了 → 選択解除。確認画面が開いているときは、その画面を閉じます</td></tr>
      </table>
      <div class="h-note">次の間は、編集系のキー（削除・回転・移動・コピーなど）は働きません：欄や名前に文字を入力している間／確認画面・ヘルプ・スロット画面が開いている間／ルーラーを使っている間／3D表示中。</div>
      <div class="h-h2">保存・表示・その他</div>
      <table class="h-tbl">
        <tr><th>キー</th><th>機能</th></tr>
        <tr><td>Ctrl＋S</td><td>現在のスロットへ上書き保存</td></tr>
        <tr><td>Ctrl＋F</td><td>サイドバーの検索窓へ移動</td></tr>
        <tr><td>F1</td><td>このヘルプを開く</td></tr>
        <tr><td>Esc</td><td>ヘルプを閉じる</td></tr>
        <tr><td>Ctrl＋Shift＋D</td><td>エラーログ画面の表示／非表示。画面内の「🛟 復旧・診断」から診断情報をコピーできます</td></tr>
      </table>
      <div class="h-h2">マウス</div>
      <table class="h-tbl">
        <tr><th>操作</th><th>機能</th></tr>
        <tr><td>ホイール（2D）</td><td>カーソル位置を中心に拡大・縮小</td></tr>
        <tr><td>中ボタンドラッグ（2D）</td><td>画面の移動（パン）</td></tr>
        <tr><td>Space＋ドラッグ（2D）</td><td>画面の移動（パン）</td></tr>
        <tr><td>右クリック（2D）</td><td>オブジェクトのメニュー</td></tr>
        <tr><td>ドラッグ（3D）</td><td>視点を回す（右ドラッグ／Shift＋ドラッグで平行移動）</td></tr>
      </table>
    </div>

  </div>
</div>
`;
document.body.appendChild(overlay);
try{ if(typeof APP_VERSION!=='undefined') document.getElementById('help-version').textContent=APP_VERSION; }catch(e){}

// ── タブ切替 ────────────────────────────────────────────────
overlay.querySelectorAll('.help-tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    overlay.querySelectorAll('.help-tab').forEach(t=>t.classList.remove('active'));
    overlay.querySelectorAll('.help-page').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    const page = overlay.querySelector('#page-'+tab.dataset.page);
    if(page) page.classList.add('active');
  });
});

// ── 開閉 ────────────────────────────────────────────────────
function openHelp(){ overlay.classList.add('open'); }
function closeHelp(){ overlay.classList.remove('open'); }

document.getElementById('help-close').addEventListener('click', closeHelp);
document.getElementById('help-recovery').addEventListener('click', ()=>{ closeHelp(); if(typeof window._opRecoveryOpen==='function') window._opRecoveryOpen(); });
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeHelp(); });
document.addEventListener('keydown', e=>{
  if(e.key==='F1'){ e.preventDefault(); openHelp(); }
  if(e.key==='Escape' && overlay.classList.contains('open')) closeHelp();
});

// ── ヘッダーにボタン追加 ────────────────────────────────────
const helpBtn = document.createElement('button');
helpBtn.className = 'hbtn';
helpBtn.id = 'btn-help';
helpBtn.textContent = '📖 ヘルプ';
helpBtn.title = 'ヘルプを開く (F1)';
helpBtn.addEventListener('click', openHelp);
// テーマボタンの前に挿入
// ヘルプ: 一番右
const hdr2 = document.getElementById('header');
if(hdr2) hdr2.appendChild(helpBtn);

})();
