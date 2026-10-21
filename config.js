// 分享版設定（由 Signage_Web/config.js 衍生：移除建商品牌、關閉家具選配與閒置展示）
// 衍見築 3D 電子看板 — 內容設定
// 模型由 _tools/export_web_glb.py 從 Models_Latest 內最新版（Luxury v2）Blender 主檔轉出

export const PROJECT = {
  name: '衍見築',
  developer: '',
  tagline: '非官方 · 3D 參考模型',
  facts: [
    ['樓層規劃', '地上 17 層 / 地下 4 層'],
    ['總戶數', '45 戶'],
    ['建築高度', '約 70.7 m（公開資料參考值）'],
    ['基地區位', '臺北市 敦化北路 120 巷周邊'],
    ['展示戶型', '48 坪 二房 · 48 坪 三房 · 75 坪 二房 · 75 坪 三房'],
  ],
  disclaimer:
    '本頁為個人製作的非官方參考模型，與建商無關。3D 模型依公開圖源及銷售配置圖重建，尺寸、樓高與方位皆為估算；家具、材質與燈光為設計示意，' +
    '非施工圖或交屋標準，實際以建商合約及現場為準。坪數為銷售坪數。周邊街廓 © OpenStreetMap contributors (ODbL)。',
};

export const EXTERIOR = {
  id: 'exterior',
  title: '建築外觀',
  sub: '全棟 · 入口 · 周邊街廓',
  file: 'models/exterior.glb',
  meta: 'models/exterior.json',
  hideGroups: ['09_Lighting_Cameras'],
  contextGroups: ['04_OSM_Context'],
  orbitTarget: [-6.6, 26, 7],
  home: { pos: [84, 112, 104], target: [-6.6, 30, 7] },
  views: [
    { cam: 'CAM_01_Exterior_Day', label: '全棟外觀' },
    { cam: 'CAM_02_Front', label: '東向主立面' },
    { cam: 'CAM_03_Side', label: '側向立面' },
    { cam: 'CAM_04_Entrance', label: '大廳入口' },
    { cam: 'CAM_05_Street_Low', label: '街道仰望' },
    { cam: 'CAM_06_Aerial_Context', label: '街廓鳥瞰' },
  ],
  gallery: ['ext_01_day', 'ext_08_front', 'ext_04_entrance', 'ext_06_aerial', 'ext_07_night'],
};

const ROOM = {
  Living: '客廳', Dining: '餐廳', Kitchen: '廚房', Foyer: '玄關', Lounge: '第二起居室',
  FlexibleRoom: '彈性房', Master: '主臥室', Bedroom_Master: '主臥室', Bedroom_Primary: '主臥室',
  Bedroom_Guest: '客臥室', Bedroom_West: '次臥室 A', Bedroom_East: '次臥室 B',
  Bedroom_UpperLeft: '次臥室 A', Bedroom_MiddleLeft: '次臥室 B',
};

export const UNITS = [
  {
    id: 'unit_48_2b', title: '48 坪 · 二房', sub: '主臥 + 彈性房 · 雙衛浴',
    layout: '2 房（含彈性房）· 2 衛 · 2 陽台',
    highlights: [
      '彈性房配置沙發床與閱讀椅，可作書房或客房',
      '暖象牙礦物牆面、煙燻胡桃木與細黑金屬收邊',
      '連續曲面沙發、雙層窗簾與整合式簾盒',
      '石材與木作整合電視牆、蛋白玻璃吊燈',
    ],
    rooms: [
      { group: 'Living', view: '03_Living' }, { group: 'Dining', view: '08_Dining_Kitchen' },
      { group: 'Kitchen', view: '11_Kitchen' }, { group: 'Master', view: '05_Master' },
      { group: 'FlexibleRoom', view: '04_Flexible_Room' },
    ],
    views: [
      { cam: '03_Living', label: '客廳' }, { cam: '10_Mediawall', label: '電視主牆' },
      { cam: '08_Dining_Kitchen', label: '餐廚' }, { cam: '11_Kitchen', label: '廚房' },
      { cam: '05_Master', label: '主臥室' }, { cam: '06_Master_Bath', label: '主浴' },
      { cam: '04_Flexible_Room', label: '彈性房' }, { cam: '07_Common_Bath', label: '客浴' },
    ],
    gallery: ['u482_03_Living', 'u482_09_Living_Detail', 'u482_05_Master', 'u482_04_Flexible_Room', 'u482_06_Master_Bath', 'u482_02_Axonometric'],
  },
  {
    id: 'unit_48_3b', title: '48 坪 · 三房', sub: '三房 · 雙衛浴 · 獨立玄關',
    layout: '3 房 · 2 衛 · 生活／服務陽台',
    highlights: [
      '煙燻胡桃木與暖白礦物石材主牆，完整分縫',
      '連續弧面沙發、滾邊軟枕與織物地毯',
      '三間臥室皆有訂製床頭與分層床品',
      '主浴、客浴石材立面與胡桃木收納',
    ],
    rooms: [
      { group: 'Living', view: 'Living' }, { group: 'Kitchen', view: 'Kitchen' },
      { group: 'Bedroom_Primary', view: 'PrimaryBedroom' },
      { group: 'Bedroom_UpperLeft', view: 'UpperBedroom' }, { group: 'Bedroom_MiddleLeft', view: 'MiddleBedroom' },
    ],
    views: [
      { cam: 'Living', label: '客餐廳' }, { cam: 'LivingDetail', label: '軟裝近景' },
      { cam: 'Kitchen', label: '廚房' }, { cam: 'PrimaryBedroom', label: '主臥室' },
      { cam: 'Ensuite', label: '主浴' }, { cam: 'UpperBedroom', label: '次臥室 A' },
      { cam: 'MiddleBedroom', label: '次臥室 B' }, { cam: 'CommonBathroom', label: '客浴' },
    ],
    gallery: ['u483_Living', 'u483_LivingDetail', 'u483_PrimaryBedroom', 'u483_UpperBedroom', 'u483_MiddleBedroom', 'u483_BathDetail', 'u483_Axon'],
  },
  {
    id: 'unit_75_2b', title: '75 坪 · 二房', sub: '雙主臥尺度 · 第二起居區',
    layout: '2 房 + 起居室 · 2 衛 · 3 陽台',
    highlights: [
      '整體媒體牆、陰影凹槽與浮置石材檯面',
      '第二起居區，延伸家庭交誼與閱讀空間',
      '霧面暖白石材、煙燻胡桃木與蘑菇色織物',
      '主臥、客臥皆配置精修床頭與雙層窗簾',
    ],
    rooms: [
      { group: 'Living', view: '03_Living' }, { group: 'Dining', view: '09_Dining' },
      { group: 'Lounge', view: '04_Lounge' }, { group: 'Bedroom_Master', view: '05_Master' },
      { group: 'Bedroom_Guest', view: '06_Guest' },
    ],
    views: [
      { cam: '13_Hero_Living', label: '客廳主景' }, { cam: '03_Living', label: '客廳' },
      { cam: '09_Dining', label: '餐廳' }, { cam: '04_Lounge', label: '起居室' },
      { cam: '05_Master', label: '主臥室' }, { cam: '07_MasterBath', label: '主浴' },
      { cam: '06_Guest', label: '客臥室' }, { cam: '08_CommonBath', label: '客浴' },
    ],
    gallery: ['u752_13_Hero_Living', 'u752_03_Living', 'u752_04_Lounge', 'u752_05_Master', 'u752_12_Detail_Bedroom', 'u752_11_Detail_Joinery', 'u752_07_MasterBath', 'u752_02_Axonometric'],
  },
  {
    id: 'unit_75_3b', title: '75 坪 · 三房', sub: '三房 · 兩浴 · 六人圓餐桌',
    layout: '3 房 · 2 衛 · 3 陽台',
    highlights: [
      '三片石材電視牆、胡桃木立面收邊',
      '深藍圓順包覆沙發與縫製抱枕、羊毛地毯',
      '六人圓餐桌與乳白玻璃吊燈',
      '主臥獨立床頭構成，陶瓷燈身與百褶燈罩',
    ],
    rooms: [
      { group: 'Living', view: '03_Living' }, { group: 'Dining', view: '04_Dining' },
      { group: 'Kitchen', view: '08_Kitchen' }, { group: 'Bedroom_Master', view: '05_Primary' },
      { group: 'Bedroom_West', view: '06_GuestBedroom' }, { group: 'Bedroom_East', view: '09_EastBedroom' },
    ],
    views: [
      { cam: '03_Living', label: '客廳' }, { cam: '11_MediaDetail', label: '電視主牆' },
      { cam: '04_Dining', label: '餐廳' }, { cam: '08_Kitchen', label: '廚房' },
      { cam: '05_Primary', label: '主臥室' }, { cam: '07_PrimaryBath', label: '主浴' },
      { cam: '06_GuestBedroom', label: '次臥室 A' }, { cam: '09_EastBedroom', label: '次臥室 B' },
      { cam: '13_GuestBath', label: '客浴' },
    ],
    gallery: ['u753_03_Living', 'u753_10_LivingDetail', 'u753_05_Primary', 'u753_06_GuestBedroom', 'u753_08_Kitchen', 'u753_14_PrimaryBathJoinery', 'u753_02_Axon'],
  },
];

for (const u of UNITS) {
  u.file = `models/${u.id}.glb`;
  u.meta = `models/${u.id}.json`;
  u.plan = `gallery/plan_${u.id}.jpg`;
  for (const r of u.rooms) r.label = ROOM[r.group] || r.group;
}

// 家具選配比較：UE5 UMU1331 家具庫候選 vs 現有 Luxury v2 設計（於 75 坪三房原位替換）
// 模型由 _tools/ue_furniture_export.py（UE 匯出）+ _tools/assemble_ue_furniture.py（Blender 組裝）產生
export const FURNISH = {
  enabled: false, // 分享版不含 UE5 家具庫資產
  unit: 'unit_75_3b',
  catalog: 'models/ue_furniture/ue_catalog.json',
  categories: [
    { id: 'sofa', label: '客廳沙發', view: '03_Living' },
    { id: 'chair', label: '餐椅', view: '04_Dining' },
    { id: 'pendant', label: '餐桌吊燈', view: '04_Dining' },
    { id: 'tablelamp', label: '邊几桌燈', view: '03_Living' },
  ],
  names: {
    current__sofa: '深藍絨面三人座（現有）', current__chair: '象牙布面弧背餐椅（現有）',
    current__pendant: '六臂燭台吊燈（現有）', current__tablelamp: '陶瓷百褶燈罩桌燈（現有）',
    'sofa__changshafa_10311657': '大地棕布面三人座', 'sofa__shafa11231824': '灰布面格柵側板沙發',
    'sofa__shafa_11171010': '白殼弧形靠背沙發', 'sofa__shafa_12121855': '深灰絨面雙人座',
    'sofa__shafa_12212204': '焦糖皮革木腳沙發',
    'chair__yizi10281854': '胡桃木灰絨餐椅', 'chair__yizi12150935-1': '曲面殼椅・木腳',
    'chair__yizi20170110': '高背扶手餐椅', 'chair__yizi_12081511': '灰皮包覆圈椅',
    'chair__yizi_201701111034': '高背軟包餐椅',
    'lamp__deng_11081252': '黑色圓錐吊燈', 'lamp__diaodeng_11081311': '金色水晶吊燈',
    'lamp__diaodeng_12151029': '布罩鼓型吊燈', 'lamp__diaodeng_201701041340': '水晶籃型吊燈',
    'lamp__taideng12201801-1': '木紋球座桌燈', 'lamp__taideng_11231028': '灰色鼓罩桌燈',
    'lamp__taideng_201702090325': '黑色蘑菇桌燈',
  },
};

// 閒置多久進入自動展示（毫秒）
// 模型以 .glb.json（base64）提供時設為 true（分享版主機不提供 .glb）
export const PACKED_MODELS = true;

export const IDLE_MS = 1e12; // 分享版不自動進入展示模式
