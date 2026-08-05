/*
  Harness de testes — Lista de Compras (Fase 3, bloco D6)

  O app continua sendo um arquivo único (essa é a premissa da Fase 3: não
  mexer na arquitetura). Para conseguir testar a lógica de negócio mesmo
  assim, este harness extrai o <script> do index.html, remove a chamada
  init() e avalia o restante com stubs mínimos de DOM/armazenamento.

  Resultado: as funções puras (parser, categorização, merge, recorrência)
  ficam acessíveis ao Node sem precisar de navegador nem de build.
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApp(){
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const marker = '<script>\n/* =================== STORAGE';
  const start = html.indexOf(marker);
  if(start === -1) throw new Error('Bloco de script principal não encontrado no index.html');
  const from = start + '<script>\n'.length;
  const to = html.lastIndexOf('</script>');
  let code = html.slice(from, to);

  // não queremos que o app se inicialize durante o teste
  code = code.replace(/\ninit\(\);\s*$/, '\n');

  const store = {};
  const noopEl = new Proxy({}, {
    get(t, p){
      if(p === 'classList') return { add(){}, remove(){}, toggle(){}, contains(){ return false; } };
      if(p === 'style') return {};
      if(p === 'dataset') return {};
      if(p === 'querySelector' || p === 'querySelectorAll') return () => (p === 'querySelectorAll' ? [] : noopEl);
      if(typeof p === 'string' && ['appendChild','remove','focus','setAttribute','removeAttribute','addEventListener','scrollIntoView','click','insertBefore'].includes(p)) return () => {};
      return undefined;
    },
    set(){ return true; }
  });

  const documentStub = {
    body: noopEl,
    getElementById: () => noopEl,
    querySelector: () => noopEl,
    querySelectorAll: () => [],
    createElement: () => noopEl,
    addEventListener: () => {},
    createTextNode: () => noopEl
  };

  const windowStub = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    location: { href: 'http://localhost/' }
  };

  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Intl,
    document: documentStub,
    navigator: { onLine: true, userAgent: 'node', serviceWorker: undefined },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => Object.keys(store).forEach(k => delete store[k])
    },
    Blob: function(){}, URL: { createObjectURL(){ return ''; }, revokeObjectURL(){} },
    FileReader: function(){}
  };
  sandbox.window = Object.assign(windowStub, sandbox);
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'index.html:<script>' });

  // `state` é declarado com `let`, então vive no escopo léxico global e NÃO
  // aparece como propriedade do objeto global. Um segundo script no mesmo
  // realm enxerga esse escopo, então é por aqui que os testes leem e trocam
  // o estado do app.
  vm.runInContext(
    'function __setState(s){ state = s; } function __getState(){ return state; }',
    sandbox, { filename: 'harness:bridge' }
  );

  sandbox.__store = store;
  return sandbox;
}

/* ---------- micro-runner de testes ---------- */
const results = { pass: 0, fail: 0, failures: [] };
let currentSuite = '';

function suite(name){ currentSuite = name; console.log('\n' + name); }

function test(name, fn){
  try{
    fn();
    results.pass++;
    console.log('  \u2713 ' + name);
  }catch(err){
    results.fail++;
    results.failures.push({ suite: currentSuite, name, message: err.message });
    console.log('  \u2717 ' + name + '\n      ' + err.message);
  }
}

function eq(actual, expected, label){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if(a !== b) throw new Error((label ? label + ': ' : '') + 'esperado ' + b + ', obtido ' + a);
}
function ok(cond, label){
  if(!cond) throw new Error(label || 'condição falsa');
}

function report(){
  console.log('\n' + '─'.repeat(52));
  console.log(`${results.pass} passaram · ${results.fail} falharam`);
  if(results.fail){
    console.log('\nFalhas:');
    results.failures.forEach(f => console.log(`  [${f.suite}] ${f.name}\n    ${f.message}`));
  }
  console.log('─'.repeat(52));
  process.exit(results.fail ? 1 : 0);
}

module.exports = { loadApp, suite, test, eq, ok, report };
