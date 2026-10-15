import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {Text,TextInput} from 'react-native';
import {LocalizedText,LocalizedTextInput} from '../src/components/LocalizedUI';
import {initializeLanguage,setLanguage} from '../src/i18n/language';
test('mounted native labels and placeholders switch without changing user content',async()=>{
 await initializeLanguage({getItem:async()=>null,setItem:async()=>{}});
 let renderer:Renderer.ReactTestRenderer;
 await act(async()=>{renderer=Renderer.create(<><LocalizedText>首頁</LocalizedText><LocalizedText localize={false}>書籍</LocalizedText><LocalizedTextInput placeholder="物品名稱" value="我的書"/></>)});
 await act(async()=>{await setLanguage('en')});
 expect(renderer!.root.findAllByType(Text).some(node=>node.props.children==='Home')).toBe(true);
 expect(renderer!.root.findAllByType(Text).some(node=>node.props.children==='書籍')).toBe(true);
 const input=renderer!.root.findByType(TextInput);expect(input.props.placeholder).not.toBe('物品名稱');expect(input.props.value).toBe('我的書');
 await act(async()=>{await setLanguage('zh-TW');renderer!.unmount()});
});
