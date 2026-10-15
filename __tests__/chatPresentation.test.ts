import {chatPresentation,chatHistory} from '../src/services/chatPresentation';
test('complete answers do not invent questions or buttons',()=>{
 expect(chatPresentation('文件可分成待處理、保存、回收三類。')).toEqual({body:'文件可分成待處理、保存、回收三類。',questions:[],clarification:false});
});
test('clarification choices are optional and distinct from completed answers',()=>{
 expect(chatPresentation('你主要想整理哪裡？\n【選項】\n1. 衣櫃\n2. 書桌')).toEqual({body:'你主要想整理哪裡？',questions:['衣櫃','書桌'],clarification:true});
});
test('old next-step actions no longer gate the complete answer',()=>{
 expect(chatPresentation('先把文件分為三類。\n【可選操作】\n看具體做法').questions).toEqual([]);
});
test('historical follow-up menus do not continue the old question loop',()=>{
 expect(chatPresentation('完整回答。\n【延伸問題】\n下一個問題？').questions).toEqual([]);
});

test('typed questions retain a bounded conversation without loading or system turns',()=>{
 const messages=Array.from({length:12},(_,i)=>({sender:i%2?'ai':'user',text:'message '+i}));
 const turns=chatHistory([...messages,{sender:'loading',text:'正在回覆'}]);
 expect(turns).toHaveLength(8);expect(turns[0].content).toBe('message 4');expect(turns[7].content).toBe('message 11');
 expect(chatHistory([{sender:'user',text:'x'.repeat(1500)}])[0].content).toHaveLength(1200);
});
