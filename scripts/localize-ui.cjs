const fs=require('fs'),path=require('path'),parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const changes=[];
function files(dir){return fs.readdirSync(dir).flatMap(name=>{const f=path.join(dir,name);return fs.statSync(f).isDirectory()?(['tests','assets','backend','i18n'].includes(name)?[]:files(f)):[f]});}
for(const file of files('src').filter(f=>/\.tsx$/.test(f)&&!f.endsWith('LocalizedUI.tsx'))){
 let source=fs.readFileSync(file,'utf8');if(source.includes('LocalizedText as Text'))continue;
 const ast=parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']});const edits=[];const aliases=[];
 traverse(ast,{ImportDeclaration(p){if(p.node.source.value!=='react-native')return;const picked=p.node.specifiers.filter(s=>s.type==='ImportSpecifier'&&['Text','TextInput','TouchableOpacity','Alert'].includes(s.imported.name)&&s.importKind!=='type');if(!picked.length)return;
 const retained=p.node.specifiers.filter(s=>!picked.includes(s));
 const replacement=retained.length?'import { '+retained.map(s=>(s.importKind==='type'?'type ':'')+(s.imported?.name||s.local.name)+(s.imported?.name&&s.imported.name!==s.local.name?' as '+s.local.name:'')).join(', ')+' } from \'react-native\';':'';
 edits.push({start:p.node.start,end:p.node.end,text:replacement});for(const s of picked)aliases.push('Localized'+s.imported.name+' as '+s.local.name);
 },JSXOpeningElement(p){if(p.node.name.name!=='Text')return;const parent=p.parentPath.node;const child=parent.children.find(c=>c.type==='JSXExpressionContainer');if(child&&/\b(?:item|product|listing|message|record|block)\.(?:name|title|text|content)|\b(?:nickname|username)\b/.test(source.slice(child.start,child.end))&&!p.node.attributes.some(a=>a.name?.name==='localize'))edits.push({start:p.node.end-1,end:p.node.end-1,text:' localize={false}'});}});
 if(!aliases.length)continue;edits.sort((a,b)=>b.start-a.start).forEach(e=>{source=source.slice(0,e.start)+e.text+source.slice(e.end)});
 let relative=path.relative(path.dirname(file),'src/components/LocalizedUI').replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;
 source='import { '+aliases.join(', ')+' } from '+JSON.stringify(relative)+';\n'+source;fs.writeFileSync(file,source);changes.push(file);
}
for(const file of files('web').filter(f=>/\.tsx$/.test(f)&&!f.includes('.generated.'))){
 let source=fs.readFileSync(file,'utf8');if(source.includes('i18n/language'))continue;
 const ast=parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']});const edits=[];
 traverse(ast,{JSXText(p){const text=p.node.value.replace(/\s+/g,' ').trim();if(/[\u3400-\u9fff]/.test(text))edits.push({start:p.node.start,end:p.node.end,text:'{tr('+JSON.stringify(text)+')}'});},JSXAttribute(p){if(!['aria-label','title','alt','placeholder','label'].includes(p.node.name.name))return;const v=p.node.value;if(v?.type==='StringLiteral'&&/[\u3400-\u9fff]/.test(v.value))edits.push({start:v.start,end:v.end,text:'{tr('+JSON.stringify(v.value)+')}'});},JSXExpressionContainer(p){if(p.parentPath.node.type!=='JSXElement'&&p.parentPath.node.type!=='JSXFragment')return;const e=p.node.expression;if(!['StringLiteral','TemplateLiteral','Identifier','MemberExpression','CallExpression','ConditionalExpression','LogicalExpression','BinaryExpression'].includes(e.type))return;
 const original=source.slice(e.start,e.end);if(/\b(?:item|product|listing|message|record|block)\.(?:name|title|text|content)|\b(?:nickname|username)\b/.test(original))return;
 edits.push({start:e.end,end:e.end,text:')'},{start:e.start,end:e.start,text:'tr('});}});
 if(!edits.length)continue;edits.sort((a,b)=>b.start-a.start).forEach(e=>{source=source.slice(0,e.start)+e.text+source.slice(e.end)});
 const relative=path.relative(path.dirname(file),'src/i18n/language').replaceAll('\\','/');source='import {tr} from '+JSON.stringify(relative.startsWith('.')?relative:'./'+relative)+';\n'+source;fs.writeFileSync(file,source);changes.push(file);
}
console.log('Localized UI files:',changes.length);
