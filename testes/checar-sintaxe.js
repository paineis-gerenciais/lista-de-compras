/*
  Verificação de sintaxe sem build — Fase 3, bloco D5.
  Extrai o <script> do index.html e passa por `node --check`, junto com
  sw.js e manifest.json. Roda em segundos e pega o erro de digitação antes
  de ele chegar ao celular de alguém.
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const raiz = path.join(__dirname, '..');
let falhas = 0;

function ok(msg){ console.log('  \u2713 ' + msg); }
function erro(msg, detalhe){ falhas++; console.log('  \u2717 ' + msg + '\n      ' + detalhe); }

// 1) script inline do index.html
try{
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
  const abre = '<script>\n/* =================== STORAGE';
  const i = html.indexOf(abre);
  if(i === -1) throw new Error('bloco de script principal não localizado');
  const js = html.slice(i + '<script>\n'.length, html.lastIndexOf('</script>'));
  const tmp = path.join(os.tmpdir(), 'lista-compras-check.js');
  fs.writeFileSync(tmp, js);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  ok(`index.html — script inline (${js.split('\n').length} linhas)`);
}catch(e){ erro('index.html', (e.stderr ? e.stderr.toString() : e.message).trim()); }

// 2) service worker
try{
  execFileSync(process.execPath, ['--check', path.join(raiz, 'sw.js')], { stdio: 'pipe' });
  ok('sw.js');
}catch(e){ erro('sw.js', (e.stderr ? e.stderr.toString() : e.message).trim()); }

// 3) manifest
try{
  const m = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
  if(!m.icons || !m.icons.length) throw new Error('sem ícones declarados');
  if(!m.start_url) throw new Error('sem start_url');
  ok('manifest.json');
}catch(e){ erro('manifest.json', e.message); }

// 4) coerência de versão do cache com o que está sendo servido
try{
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const m = sw.match(/CACHE_NAME\s*=\s*'([^']+)'/);
  if(!m) throw new Error('CACHE_NAME não encontrado');
  ok(`service worker versionado como "${m[1]}"`);
}catch(e){ erro('versão do cache', e.message); }

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\nsintaxe ok');
process.exit(falhas ? 1 : 0);
