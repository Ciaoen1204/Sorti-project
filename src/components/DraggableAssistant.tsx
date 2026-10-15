import React, {useRef, useState, useEffect} from 'react';
import {PanResponder, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
export default function DraggableAssistant({children}:{children:React.ReactNode}) {
  const {width,height}=useWindowDimensions();
  const insets=useSafeAreaInsets();
  const bounds={maxX:Math.max(8,width-94),maxY:Math.max(8,height-insets.top-insets.bottom-192)};
  const [position,setPosition]=useState({x:bounds.maxX,y:bounds.maxY});
  const current=useRef(position); const start=useRef(position); const limits=useRef(bounds); limits.current=bounds;
  const update=(p:{x:number;y:number})=>{current.current=p;setPosition(p);};
  useEffect(()=>{update({x:current.current.x<width/2?8:bounds.maxX,y:Math.min(current.current.y,bounds.maxY)});},[width,height,insets.top,insets.bottom]);
  const responder=useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture:(_,g)=>Math.abs(g.dx)>6||Math.abs(g.dy)>6,
    onPanResponderGrant:()=>{start.current=current.current;},
    onPanResponderMove:(_,g)=>update({x:Math.max(8,Math.min(limits.current.maxX,start.current.x+g.dx)),y:Math.max(8,Math.min(limits.current.maxY,start.current.y+g.dy))}),
    onPanResponderRelease:()=>update({x:current.current.x<limits.current.maxX/2?8:limits.current.maxX,y:current.current.y}),
    onPanResponderTerminate:()=>update({x:current.current.x<limits.current.maxX/2?8:limits.current.maxX,y:current.current.y}),
  })).current;
  return <View {...responder.panHandlers} style={{position:'absolute',left:position.x,top:position.y,width:86,zIndex:20}}>{children}</View>;
}
