import React,{useState} from 'react';
export default function FirstPermissions(){
 const [step,setStep]=useState<'notification'|'camera'|null>(()=>{try{return localStorage.getItem('sorti-permission-intro-v1')?null:'notification';}catch{return null;}}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function next(){setMessage('');if(step==='notification')setStep('camera');else{localStorage.setItem('sorti-permission-intro-v1','done');setStep(null);}}
 async function allow(){setBusy(true);setMessage('');try{if(step==='notification'){
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);const installed=matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
 if(!('Notification' in window)||!isSecureContext||(ios&&!installed)){setMessage(ios?'iPhone 請先加入主畫面，再於設定啟用通知。':'此瀏覽器無法請求通知，請使用支援的瀏覽器。');return;}
 if(Notification.permission==='default')await Notification.requestPermission();
 }else{if(!navigator.mediaDevices?.getUserMedia){setMessage('此瀏覽器無法請求相機，拍照時可改用系統相機或選取照片。');return;}const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});stream.getTracks().forEach(track=>track.stop());}next();}catch{setMessage('權限未允許，可以稍後從瀏覽器設定調整。');}finally{setBusy(false);}}
 if(!step)return null;return <div className="first-permission-backdrop"><section className="first-permission-card" role="dialog" aria-modal="true" aria-label="首次權限設定"><h2>{step==='notification'?'允許通知':'允許使用相機'}</h2><p>{step==='notification'?'可用於交易及聊天通知。設定系統權限後，登入並完成政策確認，再到設定啟用推播。':'用於拍照辨識及整理紀錄。此步驟只測試相機權限，會立即關閉相機，不拍照或上傳。'}</p><p role="status">{message}</p><button className="button" disabled={busy} onClick={allow}>繼續設定</button><button className="button secondary" disabled={busy} onClick={next}>稍後再說</button></section></div>;
}
