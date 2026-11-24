/* ═══════════════════════════════════════════════════════════════
   3Dモデル（GLB）の対応表
   ・上のルールから順に照合し、最初に一致したモデルを使う
   ═══════════════════════════════════════════════════════════════ */
window.OP_MODELS = {
  base: 'models/',
  rules: [
    // ── 基本セット ──
    { re: /^デスク W(120|140|160)$/,              file: 'desk_steel.glb' },
    { re: /^(オフィスチェア|ハイバックチェア)$/,   file: 'chair_office.glb' },
    { re: /^キャビネット$/,                       file: 'cabinet_steel.glb' },
    { re: /^シューズBOX$/,                       file: 'locker_small.glb' },
    { re: /^ロッカー 3連$/,                       file: 'locker_3row_steel.glb' },
    { re: /^ロッカー 6連$/,                       file: 'locker_3row_steel.glb', repeatX: 2 },
    { re: /^(コピー機|複合機|レーザープリンタ|インクジェット)/, file: 'copier_desktop.glb' },
    { re: /^(電話機|固定電話機|IP電話機)$/,       file: 'phone_office_white.glb' },

    // ── 机上小物（別置き用） ──
    { re: /^ノートPC/,                            file: 'laptop_black.glb' },
    { re: /^デスクマット$/,                       file: 'deskmat_green.glb' },

    // ── 追加候補（オフィス・倉庫） ──
    { re: /^会議テーブル/,                        file: 'table_meeting_folding.glb' },
    { re: /^作業台/,                              file: 'workbench_steel.glb' },
    { re: /^台車\(平台\)$/,                       file: 'cart_flat.glb' },
    { re: /^脚立/,                                file: 'ladder_alu.glb' },
    { re: /^冷蔵庫$/,                             file: 'fridge_retro.glb' },
    { re: /^ホワイトボード$/,                     file: 'whiteboard_wall.glb' },
  ]
};