import { writeFile } from 'node:fs/promises';
const url = 'https://publicwelfare.tycg.gov.tw/PageMB?fid=26';
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Source returned ${response.status}`);
const html = await response.text();
const points = [
  ...html.matchAll(
    /<strong class="title">([^<]+)<\/strong>\s*<p class="location">([^<]+)<\/p>\s*<p class="phone">([^<]+)<\/p>/g,
  ),
].map(([, title, address, phoneLabel], index) => {
  const district = address.match(/^桃園市(.+?區)/)?.[1];
  if (!district) throw new Error(`Unknown district: ${address}`);
  return {
    id: `taoyuan-bank-${index}`,
    title: title.trim(),
    region: '桃園市',
    district,
    address: address.trim(),
    phoneLabel: phoneLabel.replace(/^電話[:：]/, '').trim(),
    phone: phoneLabel.match(/03-\d+/)?.[0].replace('-', ''),
    url,
  };
});
if (points.length < 25 || points.some(point => !point.phone))
  throw new Error('Incomplete point directory');
await writeFile(
  'src/data/taoyuanDonationPoints.json',
  JSON.stringify(points, null, 2) + '\n',
);
console.log(`Saved ${points.length} official Taoyuan service points.`);
