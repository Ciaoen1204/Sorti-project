import React,{useEffect,useState} from 'react';
import {Modal,View,Text,TouchableOpacity,PermissionsAndroid,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../context/ThemeContext';
const key='sorti-permission-intro-v1';
export default function FirstPermissions(){
 const {theme}=useTheme();const [step,setStep]=useState<null|'notification'|'camera'>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{AsyncStorage.getItem(key).then(v=>{if(!v&&Platform.OS==='android')setStep('notification');}).catch(()=>{});},[]);
 async function next(){if(step==='notification'){setStep('camera');setMessage('');}else{await AsyncStorage.setItem(key,'done');setStep(null);}}
 async function allow(){if(busy)return;setBusy(true);try{const permission=step==='camera'?PermissionsAndroid.PERMISSIONS.CAMERA:PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;if(step==='notification'&&Number(Platform.Version)<33){await next();return;}if(!await PermissionsAndroid.check(permission)){await PermissionsAndroid.request(permission);}await next();}catch{setMessage('無法開啟系統權限設定，可以稍後再設定。');}finally{setBusy(false);}}
 return <Modal transparent visible={!!step} animationType="fade" onRequestClose={()=>{void next();}}><View style={{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:24}}><View style={{backgroundColor:theme.cardBg,borderRadius:24,padding:24,gap:18}}><Text style={{fontSize:24,fontWeight:'700',color:theme.textMain}}>{step==='camera'?'允許使用相機':'允許通知'}</Text><Text style={{color:theme.textSub,lineHeight:25}}>{step==='camera'?'用於拍照辨識物品與整理紀錄。現在只設定權限，不會拍照或上傳照片。':'可用於交易及聊天通知。允許系統權限後，登入並完成政策確認，再到設定啟用推播；不代表目前已開始接收通知。'}</Text><Text style={{color:theme.textSub}}>{message}</Text><TouchableOpacity disabled={busy} onPress={allow} style={{backgroundColor:theme.primary,padding:16,borderRadius:18}}><Text style={{color:theme.onPrimary,textAlign:'center'}}>繼續設定</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={()=>{void next();}}><Text style={{color:theme.textSub,textAlign:'center',padding:10}}>稍後再說</Text></TouchableOpacity></View></View></Modal>;
}
