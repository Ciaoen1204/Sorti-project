import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from "./LocalizedUI";
import React, {useState} from 'react';
import { View, StyleSheet } from 'react-native';
import AdviceText from './AdviceText';
import {advicePresentation} from '../services/adviceSections';
import {chatPresentation} from '../services/chatPresentation';
import {useTheme} from '../context/ThemeContext';
export default function ChatAdvice({text,interactive,onChoose,onCustomInput}:{text:string;interactive:boolean;onChoose:(question:string)=>void;onCustomInput:()=>void}) {
 const {theme}=useTheme();const [expanded,setExpanded]=useState(false);
 const {body,questions,clarification}=chatPresentation(text);
 const sections=advicePresentation(body);const hasSteps=sections.some(s=>s.blocks.some(b=>b.kind==='step'));
 const long=!hasSteps&&body.length>280;
 return <View style={styles.content}>
  {hasSteps?sections.map((section,i)=><View key={i} style={styles.content}>
   {!!section.title&&<Text style={{color:theme.textMain,fontWeight:'700'}}>{section.title}</Text>}
   {section.blocks.map((block,j)=>block.kind==='step'?<View key={j} style={[styles.card,{backgroundColor:theme.cardBg,borderColor:theme.border}]}>
    <View style={styles.heading}><View style={[styles.number,{backgroundColor:theme.primarySoft}]}><Text style={{color:theme.primary,fontWeight:'800'}} accessibilityLabel={`步驟 ${block.number}`}>{block.number}</Text></View><Text style={[styles.title,{color:theme.textMain}]} localize={false}>{block.title}</Text></View>
    {!!block.description&&<Text style={[styles.description,{color:theme.textSub}]}>{block.description}</Text>}
   </View>:<Text key={j} style={[styles.description,{color:theme.textMain}]} localize={false}>{block.text}</Text>)}
  </View>):long&&!expanded?<Text style={[styles.description,{color:theme.textMain}]}>{body.slice(0,160)}…</Text>:<AdviceText text={body}/>}
  {long&&<TouchableOpacity accessibilityRole="button" onPress={()=>setExpanded(!expanded)}><Text style={{color:theme.primary,paddingVertical:10}}>{expanded?'收合內容':'展開完整建議'}</Text></TouchableOpacity>}
  {interactive&&hasSteps&&<View style={[styles.invitation,{backgroundColor:theme.primarySoft}]}><Text style={[styles.description,{color:theme.textSub}]}>哪一步有問題，或不適合你的情況？都可以問我。</Text><TouchableOpacity accessibilityRole="button" onPress={onCustomInput}><Text style={{color:theme.primary,fontWeight:'700',paddingVertical:8}}>提出問題</Text></TouchableOpacity></View>}
  {interactive&&clarification&&questions.length>0&&<View style={styles.content}><Text style={{color:theme.textSub,fontSize:12}}>選擇符合你的情況，或自行輸入</Text>{questions.map(q=><TouchableOpacity key={q} accessibilityRole="button" onPress={()=>onChoose(q)} style={[styles.card,{borderColor:theme.primary}]}><Text style={{color:theme.primary,fontSize:14}}>{q} →</Text></TouchableOpacity>)}<TouchableOpacity accessibilityRole="button" onPress={onCustomInput}><Text style={{color:theme.primary,paddingVertical:8}}>其他／自行輸入</Text></TouchableOpacity></View>}
 </View>;
}
const styles=StyleSheet.create({content:{gap:10},card:{padding:14,borderWidth:1,borderRadius:16,gap:8},heading:{flexDirection:'row',alignItems:'center',gap:10},number:{width:28,height:28,borderRadius:10,alignItems:'center',justifyContent:'center'},title:{flex:1,fontSize:16,fontWeight:'700',lineHeight:23},description:{fontSize:15,lineHeight:24},invitation:{padding:12,borderRadius:14,marginTop:4}});
