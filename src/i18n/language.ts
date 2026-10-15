import {useSyncExternalStore} from 'react';
import english from './en.json';
export type Language='zh-TW'|'en';
type Storage={getItem:(key:string)=>Promise<string|null>|string|null;setItem:(key:string,value:string)=>Promise<unknown>|unknown};
let language:Language='zh-TW';let storage:Storage|undefined;let revision=0;
const listeners=new Set<()=>void>();const key='sorti_language';
function notify(){listeners.forEach(listener=>listener());}
export async function initializeLanguage(adapter:Storage){
 storage=adapter;const version=revision;
 try{const saved=await adapter.getItem(key);if(version===revision){language=saved==='en'?'en':'zh-TW';notify();}}catch{/* Keep the current language when storage is unavailable. */}
}
export async function setLanguage(next:Language){
 if(next!=='en'&&next!=='zh-TW')return;
 await storage?.setItem(key,next);revision++;language=next;notify();
}
export function getLanguage(){return language;}
export function useLanguage(){
 const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},getLanguage,getLanguage);
 return {language:current,setLanguage};
}
const catalog=english as Record<string,string>;
export function translateText(text:string):string{
 if(language!=='en')return text;
 if(catalog[text])return catalog[text];
 const trimmed=text.replace(/\s+/g,' ').trim();
 if(catalog[trimmed])return (text.match(/^\s*/)?.[0]||'')+catalog[trimmed]+(text.match(/\s*$/)?.[0]||'');
 return text;
}
/** Translate presentation values only; identifiers and stored values stay unchanged. */
export function tr<T>(value:T):T{
 if(typeof value==='string')return translateText(value) as T;
 if(Array.isArray(value))return value.map(item=>tr(item)) as T;
 return value;
}
