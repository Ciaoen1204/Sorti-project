import districtData from './taiwanDistricts.json';
import { localDisposalResources } from './localDisposalResources';
export const guideCheckedAt = '2026-10-10';
export const guideDistricts = (region: string) =>
  districtData.regions.find(entry => entry.name === region)?.districts ?? [];
export function guideMapUrl(
  region: string,
  district: string,
  category: GuideCategory,
  kind: GuideKind,
) {
  const item = itemCategories.find(([value]) => value === category)?.[1] ?? '';
  const query = `${region === '全台' ? '台灣' : region}${district} ${
    category === 'all' ? '' : item
  } ${
    kind === 'donation'
      ? '物資捐贈'
      : kind === 'recycle'
      ? '資源回收 清潔隊'
      : '捐贈 回收'
  }`;
  return addressMapUrl(query);
}
export const addressMapUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
export function guideLocation(resource: DisposalResource) {
  return resource.district
    ? `${resource.region} · ${resource.district}據點`
    : resource.region === '全台'
    ? '全台窗口查詢'
    : `${resource.region} · 縣市窗口`;
}
export const itemCategories = [
  ['all', '全部物品'],
  ['clothes', '衣物'],
  ['furniture', '家具'],
  ['books', '書籍與紙類'],
  ['electronics', '家電與 3C'],
  ['household', '生活用品'],
] as const;
export type GuideCategory = (typeof itemCategories)[number][0];
export type GuideCondition = 'usable' | 'broken' | 'unsure';
export type GuideKind = 'all' | 'donation' | 'recycle';
export const guideConditions = [
  ['unsure', '不確定怎麼處理'],
  ['usable', '還能使用'],
  ['broken', '已損壞／無法使用'],
] as const;
export const guideRegions = [
  '全台',
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
];
export type DisposalResource = {
  id: string;
  title: string;
  provider: string;
  region: string;
  kind: Exclude<GuideKind, 'all'>;
  categories: GuideCategory[];
  description: string;
  preparation: string;
  url: string;
  phone?: string;
  phoneLabel?: string;
  district?: string;
  address?: string;
  serviceType?: '諮詢／轉介';
  checkedAt?: string;
  sourceUrl?: string;
};
export const disposalResources: DisposalResource[] = [
  ...localDisposalResources,
  {
    id: 'taipei-books',
    title: '臺北市立圖書館圖書捐贈',
    provider: '臺北市立圖書館',
    region: '臺北市',
    kind: 'donation',
    categories: ['books'],
    description:
      '依圖書館的受贈規定捐贈合適圖書，先確認書況與是否符合館藏需求。',
    preparation:
      '教科書、考試用書、期刊報紙、過時版本，以及畫線或嚴重破損的書籍可能不予接收；以館方審核為準。',
    url: 'https://tpml.gov.taipei/News_Content.aspx?n=2F48EF4A3CE5E062&s=02262B67D4160831',
  },
  {
    id: 'eden-clothes',
    title: '伊甸二手衣物捐贈',
    provider: '伊甸社會福利基金會',
    region: '全台',
    kind: 'donation',
    categories: ['clothes'],
    description:
      '二手衣物可先向服務專線詢問捐贈方式；郵寄與接收資訊以基金會公告為準。',
    preparation:
      '先確認衣物品項與狀況是否符合接收條件，再安排寄送。二手鞋、寢具與玩具不在該頁接收範圍。',
    url: 'https://www.eden.org.tw/volunteer/donate/Donate.php?level1_id=w',
    phone: '0225777636',
  },
  {
    id: 'eden-needs',
    title: '查看公益單位目前物資需求',
    provider: '伊甸社會福利基金會',
    region: '全台',
    kind: 'donation',
    categories: ['all'],
    description: '依公告查看需要的物資、規格與需求地，先確認你的物品是否適合。',
    preparation:
      '部分需求限新品。這是需求查詢窗口，不代表所有二手家具、書籍或家電都能捐贈。',
    url: 'https://www.eden.org.tw/volunteer/donate/Donate.php?level1_id=w',
  },
  {
    id: 'mohw-banks',
    title: '各縣市實物銀行聯絡窗口',
    provider: '衛生福利部社會救助及社工司',
    region: '全台',
    kind: 'donation',
    categories: ['household'],
    description: '查找所在地的實物銀行與物資捐贈窗口，了解目前募集需求。',
    preparation:
      '先詢問物資種類、新舊限制及接收方式；募集民生物資不代表接收所有二手物品。',
    url: 'https://dep.mohw.gov.tw/dosaasw/fp-569-61374-103.html',
  },
  {
    id: 'moenv',
    title: '全台回收據點與分類查詢',
    provider: '環境部資源循環署',
    region: '全台',
    kind: 'recycle',
    categories: ['all'],
    description: '從官方資源回收網查詢分類知識、回收據點與諮詢窗口。',
    preparation:
      '在官方網站選擇物品種類與所在地。大型家具先聯絡當地清潔隊；電子產品交付前先清除個人資料。',
    url: 'https://recycle.moenv.gov.tw/',
    phone: '0800085717',
  },
  {
    id: 'taipei-bulky',
    title: '臺北市大型物品預約清運',
    provider: '臺北市政府環境保護局',
    region: '臺北市',
    kind: 'recycle',
    categories: ['furniture', 'electronics'],
    description: '透過官方聯絡頁查詢各區清潔隊，安排大型廢棄物收運。',
    preparation:
      '先與清潔隊約定時間、地點及可收運品項，依約排出，勿提前放在路邊。',
    url: 'https://www.dep.gov.taipei/cp.aspx?n=F1AE8510EEF140EF&s=742C034D0FE5D980',
  },
  {
    id: 'ntpc-bulky',
    title: '新北市大型家具線上預約',
    provider: '新北市政府環境保護局',
    region: '新北市',
    kind: 'recycle',
    categories: ['furniture'],
    description: '閱讀注意事項後，前往官方巨大垃圾線上預約清運系統。',
    preparation: '送出預約後仍須收到審核結果通知；依核准的時間、地點交付物品。',
    url: 'https://recycle.ntpc.gov.tw/Article/Index/category55',
  },
  {
    id: 'kaohsiung-sort',
    title: '高雄市回收分類與大型家具處理',
    provider: '高雄市政府環境保護局',
    region: '高雄市',
    kind: 'recycle',
    categories: ['all'],
    description: '查看在地回收分類與交付方式，大型家具請洽清潔隊安排處理。',
    preparation:
      '依材質分開整理。裝潢廢料與家戶大型家具的處理方式不同，先向清潔隊確認。',
    url: 'https://recycle.ksepb.kcg.gov.tw/StaticPage/table',
  },
];
export function inferGuideCategory(value = ''): GuideCategory {
  if (/家具|桌椅|沙發|衣櫃|床/.test(value)) return 'furniture';
  if (/衣物|衣服|外套|褲|裙/.test(value)) return 'clothes';
  if (/家電|電器|手機|電腦|3c|冰箱|電視/i.test(value)) return 'electronics';
  if (/書|紙/.test(value)) return 'books';
  if (/收納|用品|衣架|盒|籃/.test(value)) return 'household';
  return 'all';
}
export function filterDisposalResources(
  category: GuideCategory,
  region: string,
  kind: GuideKind,
  district = '',
  includeOtherDistricts = false,
) {
  return disposalResources
    .filter(
      resource =>
        (category === 'all' ||
          resource.categories.includes('all') ||
          resource.categories.includes(category)) &&
        (region === '全台' ||
          resource.region === '全台' ||
          resource.region === region) &&
        (kind === 'all' || resource.kind === kind),
    )
    .filter(
      resource =>
        !district ||
        !resource.district ||
        resource.district === district ||
        includeOtherDistricts,
    )
    .sort((a, b) => {
      const rank = (resource: DisposalResource) =>
        resource.district === district && district
          ? 0
          : resource.district
          ? 2
          : resource.region === '全台'
          ? 3
          : 1;
      return rank(a) - rank(b);
    });
}
export function disposalAdvice(
  category: GuideCategory,
  condition: GuideCondition,
): string {
  if (condition === 'usable')
    return '還能使用的物品，可以先考慮出售或詢問捐贈。先確認接收需求與物品狀況，再安排交付。';
  if (condition === 'broken')
    return category === 'furniture'
      ? '損壞的家具先詢問所在地清潔隊的清運方式，確認可收運品項、搬運責任、時間與地點後再排出。'
      : '無法使用的物品先查回收分類與當地交付方式，不要直接當成可捐贈物品。家電、電池等需依品項分開確認。';
  return '先確認物品能否正常使用，以及是否乾淨、完整。可用的物品考慮出售或捐贈；無法使用的物品再查回收或清運方式。';
}
