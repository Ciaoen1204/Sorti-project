// Read-only API checks. limit=0 never downloads user records or exposes keys.
process.loadEnvFile('.env');
const tables = {
  profiles: 'id,username,display_name,updated_at',
  user_personas: 'user_id,persona_name,visual_preference,detail_preference,visual_score,detail_score,completed_at,updated_at',
  check_ins: 'id,user_id,check_in_date,photo_path',
  ai_analyses: 'id,user_id,photo_path,total_detections,summary,advice_text,status,created_at',
  items: 'id,user_id,analysis_id,name,category,quantity,source,image_path',
  listings: 'id,seller_id,title,description,category,price,location,image_path,status,created_at',
  cart_items: 'id,user_id,listing_id',
  orders: 'id,buyer_id,seller_id,recipient_name,recipient_phone,shipping_address,payment_method,subtotal,shipping_fee,total_amount,status',
  order_items: 'id,order_id,listing_id,title_snapshot,price_snapshot',
  conversations: 'id,listing_id,buyer_id,seller_id,last_message_at',
  messages: 'id,conversation_id,sender_id,content,message_type,created_at',
  ai_chat_messages: 'id,user_id,role,content,detected_items,created_at',
};
await Promise.all(Object.entries(tables).map(async ([table, columns]) => {
  try {
    const url = new URL(`/rest/v1/${table}`, process.env.SUPABASE_URL);
    url.searchParams.set('select', columns);
    url.searchParams.set('limit', '0');
    const response = await fetch(url, {
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (response.ok) console.log(`${table}: API schema accessible (not an RLS test)`);
    else console.log(`${table}: ${response.status} ${body.code || ''} ${body.message || 'Unavailable'}`);
  } catch (error) {
    console.log(`${table}: ${error.name} (connection unavailable)`);
  }
}));
