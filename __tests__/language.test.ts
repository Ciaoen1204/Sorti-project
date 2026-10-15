import {getLanguage,initializeLanguage,setLanguage,translateText,tr} from '../src/i18n/language';
afterEach(async()=>{await setLanguage('zh-TW');});
test('language preference persists and switching back restores Chinese',async()=>{
 const storage={getItem:jest.fn(async()=>null),setItem:jest.fn(async()=>{})};
 await initializeLanguage(storage);await setLanguage('en');
 expect(translateText('首頁')).toBe('Home');expect(storage.setItem).toHaveBeenCalledWith('sorti_language','en');
 await setLanguage('zh-TW');expect(translateText('首頁')).toBe('首頁');
});
test('saved English is loaded and unknown user data remain untouched',async()=>{
 await initializeLanguage({getItem:async()=> 'en',setItem:async()=>{}});
 expect(getLanguage()).toBe('en');expect(translateText('我的藍色包包123')).toBe('我的藍色包包123');
 const record={name:'我的包包',category:'書籍'};expect(tr(record)).toBe(record);
 expect(tr(['首頁',3])).toEqual(['Home',3]);
});
