import {tr} from "../src/i18n/language";
import React,{useEffect,useRef,useState} from 'react';
export default function DraggableAssistant({children,open}:{children:React.ReactNode;open:()=>void}){
 const bounds=()=>({x:Math.max(8,window.innerWidth-94),y:Math.max(8,(window.visualViewport?.height||window.innerHeight)-208)});
 const [position,setPosition]=useState(()=>bounds());
 const drag=useRef<{id:number;x:number;y:number;left:number;top:number;moved:boolean}|null>(null);
 const suppress=useRef(false);
 useEffect(()=>{const resize=()=>setPosition(p=>({x:p.x<window.innerWidth/2?8:bounds().x,y:Math.min(p.y,bounds().y)}));window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);};},[]);
 return <button className="home-assistant-float" style={{left:position.x,top:position.y,right:'auto',bottom:'auto',touchAction:'none',userSelect:'none'}} aria-label={tr("開啟收納助理")} title={tr("拖曳移動，點一下開啟收納助理")}
 onPointerDown={e=>{if(e.button!==0)return;suppress.current=false;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:position.x,top:position.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)>6||Math.abs(dy)>6)d.moved=true;if(d.moved)setPosition({x:Math.max(8,Math.min(bounds().x,d.left+dx)),y:Math.max(8,Math.min(bounds().y,d.top+dy))});}}
 onPointerUp={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;suppress.current=d.moved;drag.current=null;setPosition(p=>({...p,x:p.x<window.innerWidth/2-43?8:bounds().x}));}}
 onPointerCancel={()=>{suppress.current=true;drag.current=null;setPosition(p=>({...p,x:p.x<window.innerWidth/2-43?8:bounds().x}));}}
 onClick={e=>{if(e.detail===0||!suppress.current)open();suppress.current=false;}}>{tr(children)}</button>;
}
