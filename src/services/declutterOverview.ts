export function declutterOverview(items: { count?: number }[]): string {
  const count = items.reduce((total, item) => total + (item.count ?? 0), 0);
  return count > 0
    ? `這次共辨識到 ${count} 個物件。先集中同類物品，逐件確認想保留的物品，再安排收納位置。`
    : '照片中沒有明確辨識到物品，可以先從可見空間與同類物品開始整理。';
}
