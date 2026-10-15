const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs
  .readFileSync(path.join(root, 'src/services/supabaseData.ts'), 'utf8')
  .replace("from '../lib/supabase'", "from './supabase'")
  .replaceAll("from './notificationTypes'","from '../src/services/notificationTypes'")
  .replaceAll(
    "from './deliveryChannels'",
    "from '../src/services/deliveryChannels'",
  )
  .replaceAll(
    "from './marketplaceOrder'",
    "from '../src/services/marketplaceOrder'",
  )
  .replace("from '../types/ai'", "from '../src/types/ai'")
  .replace("from './checkInDate'", "from './checkInDate'")
  .replace(
    "from './inventoryDetails'",
    "from '../src/services/inventoryDetails'",
  );
fs.writeFileSync(
  path.join(root, 'web/data.generated.ts'),
  '// Generated from src/services/supabaseData.ts. Do not edit.\n' + source,
);
console.log('PWA cloud operations synchronized with the native app.');
