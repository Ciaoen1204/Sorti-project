import { writeFile } from 'node:fs/promises';

const source = 'https://api.nlsc.gov.tw/other/';
const get = async path => {
  const response = await fetch(source + path, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Region source returned ${response.status}`);
  return response.text();
};
const tag = (xml, name) =>
  xml.match(new RegExp(`<${name}>(.*?)</${name}>`))?.[1];
const counties = [
  ...(await get('ListCounty')).matchAll(
    /<countyItem>([\s\S]*?)<\/countyItem>/g,
  ),
];
const regions = await Promise.all(
  counties.map(async ([, xml]) => {
    const code = tag(xml, 'countycode');
    const towns = await get(`ListTown1/${code}`);
    return {
      name: tag(xml, 'countyname'),
      districts: [...towns.matchAll(/<townItem>([\s\S]*?)<\/townItem>/g)].map(
        ([, town]) => tag(town, 'townname'),
      ),
    };
  }),
);
const total = regions.reduce((sum, region) => sum + region.districts.length, 0);
if (
  regions.length !== 22 ||
  total !== 368 ||
  regions.some(
    region => new Set(region.districts).size !== region.districts.length,
  )
)
  throw new Error(`Unexpected region counts: ${regions.length}/${total}`);
await writeFile(
  'src/data/taiwanDistricts.json',
  JSON.stringify(
    {
      source: 'https://data.gov.tw/dataset/102011',
      checkedAt: new Date().toISOString().slice(0, 10),
      regions,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Saved ${regions.length} counties and ${total} districts.`);
