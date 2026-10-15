// Deploy with --no-verify-jwt; this endpoint uses its own scheduler secret.
import {createClient} from 'npm:@supabase/supabase-js@2.109.0';
import {importPKCS8,SignJWT} from 'npm:jose@6.1.0';
const env=(name:string)=>{const v=Deno.env.get(name);if(!v)throw new Error(`Missing ${name}`);return v;};
Deno.serve(async request=>{
 if(request.method!=='POST'||request.headers.get('authorization')!==`Bearer ${Deno.env.get('MARKET_PUSH_SECRET')}`||!Deno.env.get('MARKET_PUSH_SECRET'))return new Response('Unauthorized',{status:401});
 try{
  const account=JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'));
  const key=await importPKCS8(account.private_key,'RS256');
  const jwt=await new SignJWT({scope:'https://www.googleapis.com/auth/firebase.messaging'}).setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email).setSubject(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
  if(!auth.ok)throw new Error('Firebase authorization failed');
  const {access_token}=await auth.json();
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'));
  const {data:jobs,error}=await db.rpc('claim_market_notification_push');if(error)throw error;
  let sent=0,retrying=0;
  for(const job of jobs||[]){
   let failed=false;
   try{
    const {data:consent,error:ce}=await db.from('legal_acceptances').select('id').eq('user_id',job.user_id).eq('terms_version','v1.1').eq('privacy_version','v1.1').eq('adult_declared',true).maybeSingle();if(ce)throw ce;
    if(!consent){const r=await db.from('market_notifications').update({push_state:'muted',locked_until:null}).eq('id',job.id);if(r.error)throw r.error;continue;}
    const {data:prefs,error:pe}=await db.from('notification_preferences').select('chat,orders').eq('user_id',job.user_id).maybeSingle();if(pe)throw pe;
    if(prefs?.[job.kind as 'chat'|'orders']===false){const r=await db.from('market_notifications').update({push_state:'muted',locked_until:null}).eq('id',job.id);if(r.error)throw r.error;continue;}
    const {data:devices,error:de}=await db.from('push_devices').select('token,platform').eq('user_id',job.user_id);if(de)throw de;
    const {data:delivered,error:le}=await db.from('notification_deliveries').select('token').eq('notification_id',job.id);if(le)throw le;
    for(const device of devices||[]){
     if(delivered?.some(d=>d.token===device.token))continue;
     // Re-check ownership immediately before sending; logout deletes this row.
     const {data:owned,error:oe}=await db.from('push_devices').select('user_id').eq('token',device.token).eq('user_id',job.user_id).maybeSingle();if(oe)throw oe;if(!owned)continue;
     const data=Object.fromEntries(Object.entries({notificationId:job.id,...job.target}).map(([k,v])=>[k,String(v)]));
     const response=await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{method:'POST',headers:{authorization:`Bearer ${access_token}`,'content-type':'application/json'},body:JSON.stringify({message:{token:device.token,notification:{title:job.title,body:job.body},data,android:{priority:'HIGH',notification:{tag:job.id}},webpush:{headers:{TTL:'86400'},notification:{tag:job.id}}}})});
     if(response.ok){const r=await db.from('notification_deliveries').upsert({notification_id:job.id,token:device.token});if(r.error)throw r.error;sent++;}
     else{
      const detail=await response.json().catch(()=>({}));
      if(detail.error?.details?.some((d:{errorCode?:string})=>d.errorCode==='UNREGISTERED')){const r=await db.from('push_devices').delete().eq('token',device.token);if(r.error)throw r.error;}
      else failed=true;
     }
    }
   }catch{failed=true;}
   const state=failed?(job.attempts>=8?'failed':'pending'):'sent';
   const result=await db.from('market_notifications').update({push_state:state,locked_until:null,next_attempt_at:new Date(Date.now()+Math.min(3600,30*2**job.attempts)*1000).toISOString()}).eq('id',job.id);
   if(result.error)throw result.error;
   if(failed)retrying++;
  }
  return Response.json({claimed:jobs?.length||0,sent,retrying});
 }catch{return Response.json({error:'Push dispatch failed; inspect service configuration and retry.'},{status:500});}
});
