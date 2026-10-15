export type StoragePersona = {
  name: string;
  icon: string;
  vLabel: string;
  dLabel: string;
  feature: string;
  desc: string;
};

export const academyResults: Record<string, StoragePersona> = {
  豐富_簡易: {
    name: '視覺幻術師',
    icon: 'sparkles-outline',
    vLabel: '視覺表現：展現流派',
    dLabel: '空間維護：順手隨行',
    feature: '東西必須看得到、好拿取，討厭繁瑣的分類，重視空間的美感與擺設。',
    desc: '追求自由與視覺享受。對你來說，看不到的東西就等於不存在。不喜歡把東西關在黑漆漆的抽屜裡，而是喜歡把心愛的物品像藝術品一樣陳列在日光下，亂得有美感才是最舒服的狀態。',
  },
  簡潔_簡易: {
    name: '遮醜結界師',
    icon: 'shield-half-outline',
    vLabel: '視覺表現：極簡隱形',
    dLabel: '空間維護：順手隨行',
    feature:
      '表面看起來非常乾淨整潔，但櫃子一打開其實是「順手塞進去」的隱藏流派，追求快速收好。',
    desc: '表面維持著完美的平靜。你的魔法專長是「把雜物隱形」，最受不了表面有視覺干擾。只要能把東西快速藏進漂亮的籃子或不透明的櫃子裡，內部維持什麼秩序並不重要，實行「快速遮醜」的速成魔法。',
  },
  豐富_詳盡: {
    name: '時光展覽家',
    icon: 'hourglass-outline',
    vLabel: '視覺表現：展現流派',
    dLabel: '空間維護：精密檔案',
    feature:
      '喜歡把所有收藏和物品清清楚楚地展示出來，同時擁有極度微觀、精細的標籤與分類邏輯。',
    desc: '你的空間是一座壯觀的魔法博物館。你既想要一眼看到所有的寶物，又擁有極強的分類靈魂。收納盒裡還有小分隔、標籤機是你的日常，對你而言，將每件回憶物件井然有序地展現出來，是極具儀式感的事。',
  },
  簡潔_詳盡: {
    name: '首席秩序官',
    icon: 'ribbon-outline',
    vLabel: '視覺表現：極簡隱形',
    dLabel: '空間維護：精密檔案',
    feature:
      '追求極致的清爽與秩序。表面空無一物，而櫃子內部擁有像是圖書館、檔案室般教科書等級的嚴密分類。',
    desc: '魔法學院中最嚴謹的幾何大師。你的防禦結界是「絕對的清爽與條理」，表面上看不到任何雜物，而隱藏的抽屜與櫃子打開，每一件物品都有專屬的座標與規格。你擁有將繁複秩序藏在簡潔背後的頂級魔法。',
  },
};

export function storagePersona(value: string): StoragePersona | undefined {
  const name = value
    .replace('🔮', '')
    .replace(/^人格[：:]/, '')
    .trim();
  return Object.values(academyResults).find(persona => persona.name === name);
}

export function preferenceSummary(
  profile: {
    persona_name?: string;
    visual_preference?: string;
    detail_preference?: string;
  } | null,
  fallback = '',
): string {
  const name = profile?.persona_name || fallback || '尚未設定';
  const visual =
    profile?.visual_preference === 'rich'
      ? '偏好看得見的收納'
      : profile?.visual_preference === 'minimal'
      ? '偏好清爽的外觀'
      : '';
  const detail =
    profile?.detail_preference === 'simple'
      ? '簡單分類'
      : profile?.detail_preference === 'detailed'
      ? '細緻分類'
      : '';
  const axes = [visual, detail].filter(Boolean).join(' · ');
  return axes ? `${name}｜${axes}` : name;
}
