import React from 'react';
import {Image,View} from 'react-native';
import {useSortiTheme} from '../design/sortiTheme';
const logo=require('../assets/images/sorti-logo.png');
const offsets=[[-1.5,0],[1.5,0],[0,-1.5],[0,1.5],[-1,-1],[-1,1],[1,-1],[1,1]];
export default function BearMark({size=44,label,top=0}:{size?:number;label?:string;top?:number}){
 const {isDarkMode}=useSortiTheme();
 return <View style={{width:size,height:size,marginTop:top}} accessible={!!label} accessibilityLabel={label}>
 {isDarkMode&&offsets.map(([x,y],i)=><Image key={i} source={logo} resizeMode="contain" accessible={false} style={{position:'absolute',width:size,height:size,left:x,top:y,tintColor:'#FFFFFF'}}/>)}
 <Image source={logo} resizeMode="contain" accessible={false} style={{width:size,height:size}}/>
 </View>;
}
