// Use the native app's original quiz as the source of truth for the PWA.
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const ast = parser.parse(
  fs.readFileSync(path.join(root, 'src/screens/QuizScreen.tsx'), 'utf8'),
  { sourceType: 'module', plugins: ['typescript', 'jsx'] },
);
function value(node) {
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral')
    return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(value);
  if (node.type === 'ObjectExpression')
    return Object.fromEntries(
      node.properties.map(p => [p.key.name || p.key.value, value(p.value)]),
    );
  if (node.type === 'CallExpression' && node.callee.name === 'require')
    return path.basename(node.arguments[0].value);
  throw Error('Unsupported quiz value: ' + node.type);
}
const result = {};
const personasAst = parser.parse(
  fs.readFileSync(path.join(root, 'src/data/storagePersonas.ts'), 'utf8'),
  { sourceType: 'module', plugins: ['typescript'] },
);
for (const original of [...ast.program.body, ...personasAst.program.body]) {
  const node =
    original.type === 'ExportNamedDeclaration'
      ? original.declaration
      : original;
  if (node?.type === 'VariableDeclaration') {
    for (const declaration of node.declarations)
      if (['questions', 'academyResults'].includes(declaration.id.name))
        result[declaration.id.name] = value(declaration.init);
  }
}
if (
  result.questions?.length !== 7 ||
  Object.keys(result.academyResults || {}).length !== 4
)
  throw Error('Incomplete original quiz');
fs.mkdirSync(path.join(root, 'web'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'web/quiz.generated.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  'PWA quiz synchronized: 7 scenes, 28 choices and 4 original personas.',
);
