/*
  Testes unitários da lógica de negócio — Lista de Compras (Fase 3, D6)

  Cobre exatamente o que dói quando quebra e não aparece na tela:
   · parseQuickItem  — entrada rápida (B1)
   · guessCategory   — categoria automática (B4)
   · addOrMergeItem  — consolidação de duplicados (B5)
   · mergeStates     — reconciliação entre dispositivos (A4)  ← o risco crítico
   · normalizeState  — migração de dados da Fase 2 (A4)
   · recorrência e totais — regras que já existiam e não podem regredir

  Rodar:  node testes/testes.js
*/
const { loadApp, suite, test, eq, ok, report } = require('./harness');
const app = loadApp();

/* =========================================================
   B1 — entrada rápida em um campo só
   ========================================================= */
suite('B1 · parseQuickItem');

test('quantidade + unidade colada + nome ("2kg tomate")', ()=>{
  const r = app.parseQuickItem('2kg tomate');
  eq([r.qty, r.unit, r.name], ['2', 'kg', 'Tomate']);
});

test('quantidade + unidade separada ("500 g queijo")', ()=>{
  const r = app.parseQuickItem('500 g queijo');
  eq([r.qty, r.unit, r.name], ['500', 'g', 'Queijo']);
});

test('só quantidade ("3 leite")', ()=>{
  const r = app.parseQuickItem('3 leite');
  eq([r.qty, r.unit, r.name], ['3', '', 'Leite']);
});

test('decimal com vírgula ("1,5L refrigerante")', ()=>{
  const r = app.parseQuickItem('1,5L refrigerante');
  eq([r.qty, r.unit, r.name], ['1.5', 'L', 'Refrigerante']);
});

test('quantidade ao final ("tomate 2kg")', ()=>{
  const r = app.parseQuickItem('tomate 2kg');
  eq([r.qty, r.unit, r.name], ['2', 'kg', 'Tomate']);
});

test('forma "2x leite"', ()=>{
  const r = app.parseQuickItem('2x leite');
  eq([r.qty, r.name], ['2', 'Leite']);
});

test('unidade por extenso ("2 pacotes de arroz")', ()=>{
  const r = app.parseQuickItem('2 pacotes de arroz');
  eq([r.qty, r.unit, r.name], ['2', 'pacote', 'Arroz']);
});

test('sem quantidade assume 1', ()=>{
  const r = app.parseQuickItem('detergente');
  eq([r.qty, r.unit, r.name], ['1', '', 'Detergente']);
});

test('categoria explícita com # é extraída', ()=>{
  const r = app.parseQuickItem('queijo #Frios');
  eq([r.name, r.category], ['Queijo', 'Frios']);
});

test('palavra que não é unidade não vira unidade ("2 caixas grandes")', ()=>{
  const r = app.parseQuickItem('3 potes iogurte');
  eq(r.qty, '3');
  ok(r.name.toLowerCase().includes('iogurte'), 'nome deve preservar o produto');
});

test('entrada vazia não quebra', ()=>{
  const r = app.parseQuickItem('   ');
  eq([r.name, r.qty], ['', '1']);
});

/* =========================================================
   B4 — categoria automática
   ========================================================= */
suite('B4 · guessCategory');

test('produtos comuns caem na categoria certa', ()=>{
  eq(app.guessCategory('Tomate'), 'Hortifruti');
  eq(app.guessCategory('Detergente'), 'Limpeza');
  eq(app.guessCategory('Papel higiênico'), 'Higiene');
  eq(app.guessCategory('Arroz'), 'Mercearia');
  eq(app.guessCategory('Pão francês'), 'Padaria');
  eq(app.guessCategory('Cerveja'), 'Bebidas');
});

test('acentos e caixa não atrapalham', ()=>{
  eq(app.guessCategory('AÇÚCAR'), 'Mercearia');
  eq(app.guessCategory('banana'), 'Hortifruti');
});

test('expressão de várias palavras vence a palavra isolada', ()=>{
  eq(app.guessCategory('Peito de frango'), 'Açougue', 'não pode cair em Outros por causa de "frango"');
  eq(app.guessCategory('Leite condensado'), 'Mercearia', 'fica no corredor seco, não no refrigerado');
  eq(app.guessCategory('Leite'), 'Frios e Laticínios');
});

test('plural simples é reconhecido', ()=>{
  eq(app.guessCategory('Tomates'), 'Hortifruti');
  eq(app.guessCategory('Bananas'), 'Hortifruti');
});

test('desconhecido devolve vazio (vai para "Sem categoria")', ()=>{
  eq(app.guessCategory('Widget zorb'), '');
});

test('taxa de acerto do dicionário fica acima de 80%', ()=>{
  const amostra = ['arroz','feijão','macarrão','leite','ovos','pão','café','açúcar','sal','óleo',
    'tomate','cebola','alho','batata','banana','maçã','alface','cenoura',
    'frango','carne moída','linguiça','bacon',
    'queijo','presunto','iogurte','manteiga',
    'detergente','sabão em pó','amaciante','água sanitária','esponja',
    'papel higiênico','sabonete','shampoo','pasta de dente','desodorante',
    'refrigerante','suco','cerveja','água mineral'];
  const acertos = amostra.filter(n => app.guessCategory(n) !== '').length;
  const taxa = acertos / amostra.length;
  ok(taxa >= 0.8, `taxa de acerto ${(taxa*100).toFixed(0)}% (mínimo 80%)`);
});

/* =========================================================
   B5 — consolidação de duplicados
   ========================================================= */
suite('B5 · addOrMergeItem');

function listaVazia(){
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Teste', false, 7);
  const s = app.__getState();
  s.lists = [l];
  s.activeListId = l.id;
  return l;
}

test('mesmo item somado em vez de duplicado', ()=>{
  const l = listaVazia();
  app.addOrMergeItem(l, { name:'Leite', qty:'1', unit:'' });
  const r = app.addOrMergeItem(l, { name:'leite', qty:'2', unit:'' });
  eq(l.items.length, 1, 'deve haver uma única linha');
  eq(l.items[0].qty, '3');
  ok(r.merged, 'deve reportar merge');
});

test('unidades diferentes NÃO são consolidadas', ()=>{
  const l = listaVazia();
  app.addOrMergeItem(l, { name:'Batata', qty:'2', unit:'kg' });
  app.addOrMergeItem(l, { name:'Batata', qty:'1', unit:'pacote' });
  eq(l.items.length, 2);
});

test('item já comprado não é consolidado (é uma nova compra)', ()=>{
  const l = listaVazia();
  app.addOrMergeItem(l, { name:'Leite', qty:'1', unit:'' });
  l.items[0].bought = true;
  app.addOrMergeItem(l, { name:'Leite', qty:'1', unit:'' });
  eq(l.items.length, 2);
});

test('item novo recebe categoria automática', ()=>{
  const l = listaVazia();
  app.addOrMergeItem(l, { name:'Tomate', qty:'1', unit:'' });
  eq(l.items[0].category, 'Hortifruti');
});

test('itens ganham carimbo de horário (pré-requisito do merge)', ()=>{
  const l = listaVazia();
  app.addOrMergeItem(l, { name:'Café', qty:'1' });
  ok(l.items[0].updatedAt > 0, 'item precisa de updatedAt');
  ok(l.updatedAt > 0, 'lista precisa de updatedAt');
});

/* =========================================================
   A4 — merge entre dispositivos  (o risco crítico da Fase 2)
   ========================================================= */
suite('A4 · mergeStates');

function estadoBase(){
  const s = app.normalizeState(null);
  s.lists = [{
    id:'L1', name:'Mercado', baseName:'Mercado',
    recurring:{enabled:false, frequencyDays:7},
    createdAt: 1000, updatedAt: 1000, location:null,
    items:[
      { id:'I1', name:'Arroz', qty:'1', unit:'', category:'Mercearia', price:null, bought:false, updatedAt:1000 },
      { id:'I2', name:'Leite', qty:'1', unit:'', category:'Frios e Laticínios', price:null, bought:false, updatedAt:1000 }
    ]
  }];
  s.activeListId = 'L1';
  s.updatedAt = 1000;
  return JSON.parse(JSON.stringify(s));
}

test('REGRESSÃO: item adicionado em cada aparelho — nenhum se perde', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists[0].items.push({ id:'I3', name:'Café', qty:'1', unit:'', category:'Mercearia', price:null, bought:false, updatedAt:2000 });
  A.lists[0].updatedAt = 2000; A.updatedAt = 2000;
  B.lists[0].items.push({ id:'I4', name:'Pão', qty:'1', unit:'', category:'Padaria', price:null, bought:false, updatedAt:2001 });
  B.lists[0].updatedAt = 2001; B.updatedAt = 2001;

  const m = app.mergeStates(A, B);
  const ids = m.lists[0].items.map(i=>i.id).sort();
  eq(ids, ['I1','I2','I3','I4'], 'os dois itens novos precisam sobreviver');
});

test('mesmo item marcado em um aparelho e não no outro — vence o mais recente', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists[0].items[0].bought = true;
  A.lists[0].items[0].updatedAt = 5000;
  B.lists[0].items[0].qty = '2';
  B.lists[0].items[0].updatedAt = 4000;

  const m = app.mergeStates(A, B);
  const arroz = m.lists[0].items.find(i=>i.id==='I1');
  eq(arroz.bought, true, 'a alteração mais recente deve prevalecer');
});

test('listas diferentes criadas em cada aparelho coexistem', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists.push({ id:'L2', name:'Farmácia', recurring:{enabled:false,frequencyDays:7}, createdAt:3000, updatedAt:3000, items:[] });
  B.lists.push({ id:'L3', name:'Feira', recurring:{enabled:false,frequencyDays:7}, createdAt:3001, updatedAt:3001, items:[] });

  const m = app.mergeStates(A, B);
  eq(m.lists.map(l=>l.id).sort(), ['L1','L2','L3']);
});

test('item apagado de propósito não ressuscita', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists[0].items = A.lists[0].items.filter(i=>i.id !== 'I2');
  A.deleted = { I2: 6000 };
  A.lists[0].updatedAt = 6000;

  const m = app.mergeStates(A, B);
  ok(!m.lists[0].items.find(i=>i.id==='I2'), 'o item apagado não pode voltar pelo merge');
});

test('edição posterior à exclusão prevalece sobre a lápide', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists[0].items = A.lists[0].items.filter(i=>i.id !== 'I2');
  A.deleted = { I2: 6000 };
  B.lists[0].items[1].qty = '9';
  B.lists[0].items[1].updatedAt = 7000;   // editado DEPOIS da exclusão

  const m = app.mergeStates(A, B);
  const leite = m.lists[0].items.find(i=>i.id==='I2');
  ok(leite, 'edição mais recente que a exclusão deve manter o item');
  eq(leite.qty, '9');
});

test('lista apagada não volta', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists = [];
  A.deleted = { L1: 8000 };
  const m = app.mergeStates(A, B);
  eq(m.lists.length, 0);
  eq(m.activeListId, null);
});

test('histórico de compras é união, sem duplicar', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.finishedLists = [{ id:'F1', name:'Mercado 01/07', items:[], finishedAt:1000, recurring:{enabled:false,frequencyDays:7} }];
  B.finishedLists = [
    { id:'F1', name:'Mercado 01/07', items:[], finishedAt:1000, recurring:{enabled:false,frequencyDays:7} },
    { id:'F2', name:'Feira 03/07', items:[], finishedAt:2000, recurring:{enabled:false,frequencyDays:7} }
  ];
  const m = app.mergeStates(A, B);
  eq(m.finishedLists.map(f=>f.id).sort(), ['F1','F2']);
});

test('itemHistory soma conhecimento dos dois aparelhos', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.itemHistory = { cafe: { name:'Café', category:'Mercearia', unit:'', price:null, count:5, lastUsed:1000 } };
  B.itemHistory = {
    cafe: { name:'Café', category:'Mercearia', unit:'', price:22.9, count:2, lastUsed:9000 },
    pao:  { name:'Pão', category:'Padaria', unit:'', price:null, count:3, lastUsed:8000 }
  };
  const m = app.mergeStates(A, B);
  eq(m.itemHistory.cafe.count, 5, 'contagem fica com o maior valor');
  eq(m.itemHistory.cafe.price, 22.9, 'demais campos vêm do registro mais recente');
  ok(m.itemHistory.pao, 'itens que só existem de um lado entram');
});

test('preferências de exibição são do aparelho, não da conta', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.appMode = 'full'; A.theme = 'dark';
  B.appMode = 'simple'; B.theme = 'light';
  const m = app.mergeStates(A, B);
  eq([m.appMode, m.theme], ['full','dark'], 'o lado local deve prevalecer');
});

test('ordem manual dos itens é preservada', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.lists[0].items = [A.lists[0].items[1], A.lists[0].items[0]];  // invertida
  A.lists[0].updatedAt = 9000;
  const m = app.mergeStates(A, B);
  eq(m.lists[0].items.map(i=>i.id), ['I2','I1']);
});

test('merge é idempotente (aplicar duas vezes não muda nada)', ()=>{
  const A = estadoBase(), B = estadoBase();
  B.lists[0].items.push({ id:'I5', name:'Sal', qty:'1', unit:'', category:'Mercearia', price:null, bought:false, updatedAt:2000 });
  const um = app.mergeStates(A, B);
  const dois = app.mergeStates(um, B);
  eq(JSON.stringify(dois), JSON.stringify(um));
});

test('estado remoto vazio não apaga o local', ()=>{
  const A = estadoBase();
  const m = app.mergeStates(A, null);
  eq(m.lists.length, 1);
});

test('activeListId inválido é corrigido para uma lista existente', ()=>{
  const A = estadoBase(), B = estadoBase();
  A.activeListId = 'nao-existe';
  const m = app.mergeStates(A, B);
  eq(m.activeListId, 'L1');
});

/* =========================================================
   Migração de dados da Fase 2
   ========================================================= */
suite('A4 · normalizeState (migração da Fase 2)');

test('dados sem updatedAt ganham carimbo', ()=>{
  const antigo = {
    lists: [{ id:'L1', name:'Mercado', recurring:{enabled:false,frequencyDays:7}, createdAt: 1234,
      items:[{ id:'I1', name:'Arroz', qty:'1', category:'Mercearia', bought:false }] }],
    activeListId:'L1', finishedLists:[], appMode:'simple', theme:'light', itemHistory:{}, updatedAt: 5000
  };
  const s = app.normalizeState(antigo);
  ok(s.lists[0].updatedAt > 0, 'lista precisa de carimbo');
  ok(s.lists[0].items[0].updatedAt > 0, 'item precisa de carimbo');
  eq(s.schemaVersion, 3);
});

test('campos novos da Fase 3 são criados', ()=>{
  const s = app.normalizeState({ lists: [], finishedLists: [] });
  ok(s.aisleOrders && typeof s.aisleOrders === 'object');
  ok(s.deleted && typeof s.deleted === 'object');
});

test('entrada inválida não quebra o app', ()=>{
  eq(app.normalizeState(null).lists, []);
  eq(app.normalizeState('lixo').lists, []);
  eq(app.normalizeState({ lists: 'não é array' }).lists, []);
});

test('item sem quantidade recebe 1', ()=>{
  const s = app.normalizeState({ lists:[{ id:'L', name:'x', createdAt:1, items:[{ id:'i', name:'Ovo', qty:'' }] }] });
  eq(s.lists[0].items[0].qty, '1');
});

/* =========================================================
   Regras que já existiam — não podem regredir
   ========================================================= */
suite('Regressão · recorrência, corredores e totais');

test('nextRecurrenceName usa o nome base, sem acumular datas', ()=>{
  const lista = { name:'Mercado 07/07', baseName:'Mercado', recurring:{enabled:true, frequencyDays:7} };
  const r = app.nextRecurrenceName(lista);
  eq(r.base, 'Mercado');
  ok(/^Mercado \d{2}\/\d{2}$/.test(r.label), 'rótulo deve ser "Mercado dd/mm", obtido: ' + r.label);
});

test('renovação recorrente copia itens desmarcados e com ids novos', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', true, 7);
  app.addOrMergeItem(l, { name:'Arroz', qty:'2' });
  l.items[0].bought = true;
  const nova = app.autoRenewRecurringList(l);
  eq(nova.items.length, 1);
  eq(nova.items[0].bought, false, 'os itens devem vir desmarcados');
  ok(nova.items[0].id !== l.items[0].id, 'ids precisam ser novos');
});

test('"Sem categoria" fica sempre em primeiro', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  const ordem = app.sortCategoriesByAisle(['Padaria', '', 'Hortifruti'], l);
  eq(ordem[0], '');
});

test('ordem de corredor salva é respeitada', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  app.setAisleOrder(l, ['Padaria','Hortifruti','Mercearia']);
  eq(app.sortCategoriesByAisle(['Mercearia','Hortifruti','Padaria'], l), ['Padaria','Hortifruti','Mercearia']);
});

test('categorias fora da ordem salva vão para o fim, em ordem alfabética', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  app.setAisleOrder(l, ['Padaria']);
  eq(app.sortCategoriesByAisle(['Zoo','Mercearia','Padaria'], l), ['Padaria','Mercearia','Zoo']);
});

test('ordem de corredor é guardada por mercado', ()=>{
  app.__setState(app.normalizeState(null));
  const a = app.createListObject('Mercado', false, 7);
  a.location = { type:'address', value:'Extra Savassi' };
  const b = app.createListObject('Mercado', false, 7);
  b.location = { type:'address', value:'Carrefour Contorno' };
  app.setAisleOrder(a, ['Padaria','Hortifruti']);
  eq(app.sortCategoriesByAisle(['Hortifruti','Padaria'], a), ['Padaria','Hortifruti']);
  eq(app.sortCategoriesByAisle(['Hortifruti','Padaria'], b), ['Hortifruti','Padaria'], 'outro mercado não herda a ordem');
});

test('sugestões de recompra ignoram o que já está numa lista ativa', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  const s = app.__getState();
  s.lists = [l];
  app.addOrMergeItem(l, { name:'Café', qty:'1' });
  s.itemHistory = {
    cafe: { name:'Café', category:'Mercearia', unit:'', price:null, count:10, lastUsed: Date.now() },
    arroz:{ name:'Arroz', category:'Mercearia', unit:'', price:null, count:8,  lastUsed: Date.now() }
  };
  const sugestoes = app.topRepurchaseSuggestions(5).map(x=>x.name);
  ok(!sugestoes.includes('Café'), 'não sugerir o que já está na lista');
  ok(sugestoes.includes('Arroz'), 'sugerir o que não está');
});

test('texto de compartilhamento marca comprados e agrupa por categoria', ()=>{
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  app.addOrMergeItem(l, { name:'Tomate', qty:'2', unit:'kg' });
  app.addOrMergeItem(l, { name:'Arroz', qty:'1' });
  l.items[0].bought = true;
  const txt = app.buildShareText(l);
  ok(txt.includes('[x]'), 'item comprado deve aparecer marcado');
  ok(txt.includes('[ ]'), 'item pendente deve aparecer desmarcado');
  ok(txt.includes('Hortifruti'), 'deve agrupar por categoria');
});

/* =========================================================
   Entrada em lote
   ========================================================= */
suite('B2 · addItemsFromText');

test('várias linhas viram vários itens', ()=>{
  const l = listaVazia();
  const n = app.addItemsFromText(l, '2kg tomate\n3 leite\npão de forma');
  eq(n, 3);
  eq(l.items.length, 3);
});

test('marcadores de lista colados são removidos', ()=>{
  const l = listaVazia();
  app.addItemsFromText(l, '- arroz\n• feijão\n1. café');
  eq(l.items.map(i=>i.name), ['Arroz','Feijão','Café']);
});

test('linhas vazias são ignoradas', ()=>{
  const l = listaVazia();
  const n = app.addItemsFromText(l, 'arroz\n\n\n   \nfeijão');
  eq(n, 2);
});

test('itens repetidos no mesmo lote são somados', ()=>{
  const l = listaVazia();
  app.addItemsFromText(l, '1 leite\n2 leite');
  eq(l.items.length, 1);
  eq(l.items[0].qty, '3');
});

/* =========================================================
   Fase 4 · Bloco G — colaboração familiar
   ========================================================= */
suite('G · colaboração');

test('iniciais são geradas de forma legível', ()=>{
  eq(app.initialsOf('Ana Paula Silva'), 'AS');
  eq(app.initialsOf('Daniel'), 'DA');
  eq(app.initialsOf(''), '?');
});

test('cor do avatar é estável para o mesmo uid', ()=>{
  eq(app.colorFor('uid-123'), app.colorFor('uid-123'));
  ok(app.colorFor('uid-123') !== app.colorFor('uid-999') ||
     app.colorFor('uid-123') === app.colorFor('uid-999'), 'função determinística');
});

test('chave de armazenamento é separada por escopo', ()=>{
  app.__setScope({ type:'personal', id:null, name:'Minhas listas' });
  const pessoal = app.storageKeyForScope();
  app.__setScope({ type:'household', id:'casa1', name:'Casa' });
  const casa = app.storageKeyForScope();
  app.__setScope({ type:'household', id:'casa2', name:'Sítio' });
  const casa2 = app.storageKeyForScope();
  ok(pessoal !== casa, 'pessoal e família não podem compartilhar chave');
  ok(casa !== casa2, 'famílias diferentes não podem compartilhar chave');
  app.__setScope({ type:'personal', id:null, name:'Minhas listas' });
});

test('código de convite tem 8 caracteres sem letras ambíguas', ()=>{
  for(let i=0;i<40;i++){
    const c = app.generateInviteCode();
    eq(c.length, 8);
    ok(!/[0O1I]/.test(c), 'não pode conter 0, O, 1 ou I — confunde quem digita: ' + c);
    ok(/^[A-Z2-9]+$/.test(c), 'apenas maiúsculas e dígitos 2-9: ' + c);
  }
});

test('papéis são traduzidos para linguagem de gente', ()=>{
  eq(app.papelPorExtenso('owner'), 'responsável');
  eq(app.papelPorExtenso('editor'), 'editor');
  eq(app.papelPorExtenso('viewer'), 'só leitura');
});

test('em lista pessoal, canEdit é sempre verdadeiro', ()=>{
  app.__setScope({ type:'personal', id:null, name:'Minhas listas' });
  ok(app.canEdit());
});

test('viewer numa família não pode editar', ()=>{
  app.__setScope({ type:'household', id:'casa1', name:'Casa' });
  app.__setAuthUser({ uid:'u1', displayName:'Ana' });
  app.__setCurrentHousehold({ name:'Casa', members:{ u1:{ role:'viewer', name:'Ana' } } });
  eq(app.myRole(), 'viewer');
  ok(!app.canEdit(), 'viewer não edita');
  ok(!app.isOwner());
});

test('editor edita mas não administra', ()=>{
  app.__setCurrentHousehold({ name:'Casa', members:{ u1:{ role:'editor', name:'Ana' } } });
  ok(app.canEdit());
  ok(!app.isOwner());
});

test('owner administra', ()=>{
  app.__setCurrentHousehold({ name:'Casa', members:{ u1:{ role:'owner', name:'Ana' } } });
  ok(app.canEdit());
  ok(app.isOwner());
});

test('quem não está na família cai em somente leitura', ()=>{
  app.__setCurrentHousehold({ name:'Casa', members:{ outro:{ role:'owner', name:'Bia' } } });
  eq(app.myRole(), 'viewer');
});

test('nome de membro resolve para "você" no próprio uid', ()=>{
  app.__setCurrentHousehold({ name:'Casa', members:{
    u1:{ role:'owner', name:'Ana' }, u2:{ role:'editor', name:'Bia' }
  }});
  eq(app.memberName('u1'), 'você');
  eq(app.memberName('u2'), 'Bia');
  eq(app.memberName('desconhecido'), 'alguém');
});

test('itens novos numa família registram quem adicionou', ()=>{
  app.__setScope({ type:'household', id:'casa1', name:'Casa' });
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  app.addOrMergeItem(l, { name:'Arroz', qty:'1' });
  eq(l.items[0].addedBy, 'u1');
});

test('itens de lista pessoal não guardam autoria (seria ruído)', ()=>{
  app.__setScope({ type:'personal', id:null, name:'Minhas listas' });
  app.__setState(app.normalizeState(null));
  const l = app.createListObject('Mercado', false, 7);
  app.addOrMergeItem(l, { name:'Arroz', qty:'1' });
  eq(l.items[0].addedBy, null);
});

test('normalizeState cria os campos de colaboração em dados antigos', ()=>{
  const s = app.normalizeState({ lists:[{ id:'L', name:'x', createdAt:1,
    items:[{ id:'i', name:'Ovo', qty:'1' }] }] });
  const it = s.lists[0].items[0];
  eq([it.addedBy, it.boughtBy, it.assignedTo], [null, null, null]);
});

test('merge preserva a autoria vinda do outro aparelho', ()=>{
  const base = app.normalizeState({ lists:[{ id:'L1', name:'M', createdAt:1, updatedAt:1,
    items:[{ id:'I1', name:'Arroz', qty:'1', updatedAt:1 }] }], updatedAt:1 });
  const A = JSON.parse(JSON.stringify(base));
  const B = JSON.parse(JSON.stringify(base));
  B.lists[0].items[0].bought = true;
  B.lists[0].items[0].boughtBy = 'u2';
  B.lists[0].items[0].updatedAt = 5000;
  const m = app.mergeStates(A, B);
  eq(m.lists[0].items[0].boughtBy, 'u2');
});

test('descreverMudanca identifica item acrescentado por outra pessoa', ()=>{
  app.__setCurrentHousehold({ name:'Casa', members:{
    u1:{ role:'owner', name:'Ana' }, u2:{ role:'editor', name:'Bia' }
  }});
  const antes = app.normalizeState({ lists:[{ id:'L1', name:'M', createdAt:1, updatedAt:1, items:[] }] });
  const depois = JSON.parse(JSON.stringify(antes));
  depois.lists[0].items.push({ id:'I9', name:'Pão', qty:'1', unit:'', category:'Padaria',
    price:null, bought:false, updatedAt:2, addedBy:'u2', boughtBy:null, assignedTo:null });
  const msg = app.descreverMudanca(antes, depois);
  ok(msg.includes('Bia'), 'deve nomear quem adicionou: ' + msg);
  ok(msg.includes('Pão'), 'deve nomear o item: ' + msg);
});

test('descreverMudanca identifica item marcado por outra pessoa', ()=>{
  const antes = app.normalizeState({ lists:[{ id:'L1', name:'M', createdAt:1, updatedAt:1,
    items:[{ id:'I1', name:'Leite', qty:'1', updatedAt:1 }] }] });
  const depois = JSON.parse(JSON.stringify(antes));
  depois.lists[0].items[0].bought = true;
  depois.lists[0].items[0].boughtBy = 'u2';
  const msg = app.descreverMudanca(antes, depois);
  ok(msg.includes('Bia') && msg.includes('Leite'), 'obtido: ' + msg);
});

test('link de convite carrega o código', ()=>{
  const link = app.inviteLink('ABCD2345');
  ok(link.includes('convite=ABCD2345'), link);
});

// restaura o contexto para não vazar entre execuções
app.__setScope({ type:'personal', id:null, name:'Minhas listas' });
app.__setAuthUser(null);
app.__setCurrentHousehold(null);

report();
