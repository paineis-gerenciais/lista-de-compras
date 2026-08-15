/**
 * Testes do domínio — portados da suíte da Fase 3, agora tipados.
 * O harness caseiro que extraía o <script> do HTML deixou de ser necessário:
 * são módulos, importam-se diretamente.
 */
import { describe, it, expect } from 'vitest';
import { parseQuickItem, parseMultiline, withCategory, speechToLines } from '../src/lib/domain/parse';
import { guessCategory, normalizeName } from '../src/lib/domain/categorize';
import {
  adicionarOuConsolidar, novoItem, ordenarNoGrupo, posicaoEntre,
  proximaPosicao, somarQuantidades, sugestoesDeRecompra, totalEstimado
} from '../src/lib/domain/items';
import { ordenarCategorias, aisleKey } from '../src/lib/domain/aisles';
import { proximaOcorrencia, renovar } from '../src/lib/domain/recurrence';
import { gerarCodigoConvite, conviteValido, iniciais, corDe, podeEditar, papelNa } from '../src/lib/domain/roles';
import { mergeItem, mergeItems, mergeRecord, isDead } from '../src/lib/domain/merge';
import { resumoDePreco, precosDaCompra, gastosPorCompra } from '../src/lib/domain/prices';
import type { Item, PriceEntry, Purchase, Household, ShoppingList, ItemStat } from '../src/lib/domain/types';

const owner = { kind: 'user', id: 'u1' } as const;

function item(p: Partial<Item> = {}): Item {
  return novoItem('L1', { name: 'X', ...p });
}

describe('B1 · parseQuickItem', () => {
  it('quantidade + unidade colada', () => {
    const r = parseQuickItem('2kg tomate');
    expect([r.qty, r.unit, r.name]).toEqual(['2', 'kg', 'Tomate']);
  });
  it('unidade separada', () => {
    expect(parseQuickItem('500 g queijo')).toMatchObject({ qty: '500', unit: 'g', name: 'Queijo' });
  });
  it('só quantidade', () => {
    expect(parseQuickItem('3 leite')).toMatchObject({ qty: '3', unit: '', name: 'Leite' });
  });
  it('decimal com vírgula', () => {
    expect(parseQuickItem('1,5L refrigerante')).toMatchObject({ qty: '1.5', unit: 'L' });
  });
  it('quantidade ao final', () => {
    expect(parseQuickItem('tomate 2kg')).toMatchObject({ qty: '2', unit: 'kg', name: 'Tomate' });
  });
  it('REGRESSÃO: "2x leite" não vira "X leite"', () => {
    const r = parseQuickItem('2x leite');
    expect(r.name).toBe('Leite');
    expect(r.qty).toBe('2');
    expect(r.unit).toBe('');
  });
  it('unidade por extenso', () => {
    expect(parseQuickItem('2 pacotes de arroz')).toMatchObject({ qty: '2', unit: 'pacote', name: 'Arroz' });
  });
  it('sem quantidade assume 1', () => {
    expect(parseQuickItem('detergente')).toMatchObject({ qty: '1', name: 'Detergente' });
  });
  it('categoria explícita com #', () => {
    expect(parseQuickItem('queijo #Frios')).toMatchObject({ name: 'Queijo', category: 'Frios' });
  });
  it('entrada vazia não quebra', () => {
    expect(parseQuickItem('   ')).toMatchObject({ name: '', qty: '1' });
  });
});

describe('B2 · parseMultiline', () => {
  it('várias linhas viram vários itens', () => {
    expect(parseMultiline('2kg tomate\n3 leite\npão de forma')).toHaveLength(3);
  });
  it('marcadores colados são removidos', () => {
    expect(parseMultiline('- arroz\n• feijão\n1. café').map((p) => p.name))
      .toEqual(['Arroz', 'Feijão', 'Café']);
  });
  it('linhas vazias são ignoradas', () => {
    expect(parseMultiline('arroz\n\n\n   \nfeijão')).toHaveLength(2);
  });
  it('fala vira linhas', () => {
    expect(parseMultiline(speechToLines('arroz, feijão e café'))).toHaveLength(3);
  });
});

describe('B4 · guessCategory', () => {
  it('produtos comuns caem na categoria certa', () => {
    expect(guessCategory('Tomate')).toBe('Hortifruti');
    expect(guessCategory('Detergente')).toBe('Limpeza');
    expect(guessCategory('Papel higiênico')).toBe('Higiene');
    expect(guessCategory('Cerveja')).toBe('Bebidas');
  });
  it('acentos e caixa não atrapalham', () => {
    expect(guessCategory('AÇÚCAR')).toBe('Mercearia');
  });
  it('expressão vence palavra isolada', () => {
    expect(guessCategory('Peito de frango')).toBe('Açougue');
  });
  it('REGRESSÃO: leite condensado é corredor seco, não refrigerado', () => {
    expect(guessCategory('Leite condensado')).toBe('Mercearia');
    expect(guessCategory('Leite')).toBe('Frios e Laticínios');
  });
  it('plural simples é reconhecido', () => {
    expect(guessCategory('Tomates')).toBe('Hortifruti');
  });
  it('desconhecido devolve vazio', () => {
    expect(guessCategory('Widget zorb')).toBe('');
  });
  it('escolha anterior do usuário vence o dicionário', () => {
    expect(guessCategory('Widget zorb', { 'widget zorb': { category: 'Outros' } })).toBe('Outros');
  });
  it('taxa de acerto acima de 80%', () => {
    const amostra = ['arroz','feijão','macarrão','leite','ovos','pão','café','açúcar','sal','óleo',
      'tomate','cebola','alho','batata','banana','maçã','alface','cenoura','frango','carne moída',
      'linguiça','bacon','queijo','presunto','iogurte','manteiga','detergente','sabão em pó',
      'amaciante','água sanitária','esponja','papel higiênico','sabonete','shampoo',
      'pasta de dente','desodorante','refrigerante','suco','cerveja','água mineral'];
    const acertos = amostra.filter((n) => guessCategory(n) !== '').length;
    expect(acertos / amostra.length).toBeGreaterThanOrEqual(0.8);
  });
  it('withCategory só preenche quando falta', () => {
    expect(withCategory({ name: 'Tomate', qty: '1', unit: '', category: '' }).category).toBe('Hortifruti');
    expect(withCategory({ name: 'Tomate', qty: '1', unit: '', category: 'Meu' }).category).toBe('Meu');
  });
});

describe('B5 · consolidação de duplicados', () => {
  it('soma em vez de duplicar', () => {
    const existentes = [item({ name: 'Leite', qty: '1' })];
    const r = adicionarOuConsolidar(existentes, 'L1', { name: 'leite', qty: '2', unit: '', category: '' });
    expect(r.consolidado).toBe(true);
    expect(r.item.qty).toBe('3');
  });
  it('unidades diferentes não consolidam', () => {
    const existentes = [item({ name: 'Batata', qty: '2', unit: 'kg' })];
    const r = adicionarOuConsolidar(existentes, 'L1', { name: 'Batata', qty: '1', unit: 'pacote', category: '' });
    expect(r.consolidado).toBe(false);
  });
  it('item comprado não consolida — é nova compra', () => {
    const existentes = [item({ name: 'Leite', bought: true })];
    const r = adicionarOuConsolidar(existentes, 'L1', { name: 'Leite', qty: '1', unit: '', category: '' });
    expect(r.consolidado).toBe(false);
  });
  it('somarQuantidades lida com vírgula', () => {
    expect(somarQuantidades('1,5', '2')).toBe('3.5');
  });
});

describe('F · posições esparsas', () => {
  it('primeira posição não é zero', () => {
    expect(proximaPosicao([])).toBeGreaterThan(0);
  });
  it('posicaoEntre fica no meio', () => {
    const a = item({ position: 1000 });
    const b = item({ position: 2000 });
    expect(posicaoEntre(a, b)).toBe(1500);
  });
  it('inserir no topo gera posição menor', () => {
    expect(posicaoEntre(null, item({ position: 1000 }))).toBeLessThan(1000);
  });
  it('mover não exige renumerar os vizinhos', () => {
    const itens = [item({ position: 1000 }), item({ position: 2000 }), item({ position: 3000 })];
    const nova = posicaoEntre(itens[0]!, itens[1]!);
    expect(nova).toBeGreaterThan(itens[0]!.position);
    expect(nova).toBeLessThan(itens[1]!.position);
  });
  it('comprados vão para o fim do grupo', () => {
    const itens = [
      item({ name: 'A', position: 1000, bought: true }),
      item({ name: 'B', position: 2000 })
    ];
    expect(ordenarNoGrupo(itens).map((i) => i.name)).toEqual(['B', 'A']);
  });
});

describe('A4 · merge por registro', () => {
  it('vence o mais recente', () => {
    const a = item({ id: 'i1', qty: '1', updatedAt: 1000 });
    const b = { ...a, qty: '9', updatedAt: 2000 };
    expect(mergeRecord(a, b)?.qty).toBe('9');
  });
  it('exclusão sem edição posterior mata o registro', () => {
    expect(isDead(item({ updatedAt: 1000, deletedAt: 1000 }))).toBe(true);
  });
  it('edição posterior à exclusão prevalece', () => {
    expect(isDead(item({ updatedAt: 2000, deletedAt: 1000 }))).toBe(false);
  });
  it('itens adicionados em cada aparelho sobrevivem', () => {
    const base = item({ id: 'i1' });
    const locais = [base, item({ id: 'i2' })];
    const remotos = [base, item({ id: 'i3' })];
    expect(mergeItems(locais, remotos).map((i) => i.id).sort()).toEqual(['i1', 'i2', 'i3']);
  });
  it('marcar como comprado vence: no mercado, quem pegou pegou', () => {
    const a = item({ id: 'i1', bought: true, boughtBy: 'ana', updatedAt: 2000 });
    const b = item({ id: 'i1', bought: false, updatedAt: 1000 });
    const m = mergeItem(a, b);
    expect(m?.bought).toBe(true);
    expect(m?.boughtBy).toBe('ana');
  });
  it('desmarcar posterior é respeitado — é correção deliberada', () => {
    const marcado = item({ id: 'i1', bought: true, boughtBy: 'ana', updatedAt: 1000 });
    const desmarcado = item({ id: 'i1', bought: false, updatedAt: 5000 });
    expect(mergeItem(marcado, desmarcado)?.bought).toBe(false);
  });
  it('item apagado não ressuscita', () => {
    const vivo = item({ id: 'i1', updatedAt: 1000 });
    const morto = item({ id: 'i1', updatedAt: 1000, deletedAt: 2000 });
    expect(mergeItems([morto], [vivo])).toHaveLength(0);
  });
  it('merge é idempotente', () => {
    const a = [item({ id: 'i1' })];
    const b = [item({ id: 'i2' })];
    const um = mergeItems(a, b);
    expect(mergeItems(um, b)).toEqual(um);
  });
});

describe('C3 · ordem dos corredores', () => {
  const lista = (v?: string): Pick<ShoppingList, 'location'> =>
    ({ location: v ? { type: 'address', value: v } : null });

  it('"Sem categoria" fica sempre em primeiro', () => {
    expect(ordenarCategorias(['Padaria', '', 'Hortifruti'], {}, lista())[0]).toBe('');
  });
  it('ordem salva é respeitada', () => {
    const ordens = { __default__: { key: '__default__', order: ['Padaria', 'Hortifruti'], updatedAt: 1 } };
    expect(ordenarCategorias(['Hortifruti', 'Padaria'], ordens, lista()))
      .toEqual(['Padaria', 'Hortifruti']);
  });
  it('fora da ordem vai para o fim, alfabético', () => {
    const ordens = { __default__: { key: '__default__', order: ['Padaria'], updatedAt: 1 } };
    expect(ordenarCategorias(['Zoo', 'Mercearia', 'Padaria'], ordens, lista()))
      .toEqual(['Padaria', 'Mercearia', 'Zoo']);
  });
  it('a ordem é por mercado', () => {
    const k1 = aisleKey(lista('Extra Savassi'));
    const k2 = aisleKey(lista('Carrefour Contorno'));
    expect(k1).not.toBe(k2);
    const ordens = { [k1]: { key: k1, order: ['Padaria', 'Hortifruti'], updatedAt: 1 } };
    expect(ordenarCategorias(['Hortifruti', 'Padaria'], ordens, lista('Extra Savassi')))
      .toEqual(['Padaria', 'Hortifruti']);
    expect(ordenarCategorias(['Hortifruti', 'Padaria'], ordens, lista('Carrefour Contorno')))
      .toEqual(['Hortifruti', 'Padaria']);
  });
});

describe('Recorrência', () => {
  const lista: ShoppingList = {
    id: 'L1', owner, name: 'Mercado 07/07', baseName: 'Mercado',
    recurring: { enabled: true, frequencyDays: 7 }, location: null,
    categoryOrder: [], createdAt: 1, updatedAt: 1
  };
  it('usa o nome base, sem acumular datas', () => {
    const p = proximaOcorrencia(lista, new Date('2026-07-07T12:00:00'));
    expect(p.base).toBe('Mercado');
    expect(p.label).toMatch(/^Mercado \d{2}\/\d{2}$/);
  });
  it('renovar copia itens desmarcados com ids novos', () => {
    const itens = [item({ id: 'i1', name: 'Arroz', bought: true })];
    const r = renovar(lista, itens);
    expect(r.itens[0]!.bought).toBe(false);
    expect(r.itens[0]!.id).not.toBe('i1');
    expect(r.itens[0]!.listId).toBe(r.lista.id);
  });
});

describe('G · papéis e convites', () => {
  const casa: Household = {
    id: 'h1', name: 'Casa', ownerUid: 'u1', memberUids: ['u1', 'u2', 'u3'],
    members: {
      u1: { role: 'owner', name: 'Ana', joinedAt: 1 },
      u2: { role: 'editor', name: 'Bia', joinedAt: 2 },
      u3: { role: 'viewer', name: 'Caio', joinedAt: 3 }
    },
    createdAt: 1, updatedAt: 1
  };
  const casaRef = { kind: 'household', id: 'h1' } as const;

  it('papéis são reconhecidos', () => {
    expect(papelNa(casa, 'u1')).toBe('owner');
    expect(papelNa(casa, 'u3')).toBe('viewer');
    expect(papelNa(casa, 'desconhecido')).toBe('viewer');
  });
  it('viewer não edita', () => {
    expect(podeEditar(casaRef, casa, 'u2')).toBe(true);
    expect(podeEditar(casaRef, casa, 'u3')).toBe(false);
  });
  it('lista pessoal só o dono edita', () => {
    expect(podeEditar(owner, null, 'u1')).toBe(true);
    expect(podeEditar(owner, null, 'outro')).toBe(false);
  });
  it('código de convite não usa letras ambíguas', () => {
    for (let i = 0; i < 50; i++) {
      const c = gerarCodigoConvite();
      expect(c).toHaveLength(8);
      expect(c).not.toMatch(/[0O1I]/);
    }
  });
  it('convite revogado é inválido, mesmo dentro do prazo', () => {
    expect(conviteValido({ expiresAt: Date.now() + 1e6, revokedAt: Date.now() })).toBe(false);
    expect(conviteValido({ expiresAt: Date.now() + 1e6, revokedAt: null })).toBe(true);
    expect(conviteValido({ expiresAt: Date.now() - 1 })).toBe(false);
  });
  it('iniciais e cores são estáveis', () => {
    expect(iniciais('Ana Paula Silva')).toBe('AS');
    expect(iniciais('Daniel')).toBe('DA');
    expect(corDe('uid-123')).toBe(corDe('uid-123'));
  });
});

describe('H · preços', () => {
  const dia = 86400000;
  const agora = Date.now();
  const entries: PriceEntry[] = [
    { id:'1', owner, key:'arroz', displayName:'Arroz', store:'Extra',     unitPrice:28.90, unit:'kg', qty:'1', date: agora - 5*dia,   source:'manual', purchaseId:null },
    { id:'2', owner, key:'arroz', displayName:'Arroz', store:'Carrefour', unitPrice:24.50, unit:'kg', qty:'1', date: agora - 40*dia,  source:'manual', purchaseId:null },
    { id:'3', owner, key:'arroz', displayName:'Arroz', store:'Extra',     unitPrice:26.00, unit:'kg', qty:'1', date: agora - 70*dia,  source:'manual', purchaseId:null },
    { id:'4', owner, key:'arroz', displayName:'Arroz', store:'Carrefour', unitPrice:22.00, unit:'kg', qty:'1', date: agora - 100*dia, source:'manual', purchaseId:null }
  ];

  it('traz último, menor e maior', () => {
    const r = resumoDePreco(entries, 'Arroz')!;
    expect([r.ultimo.unitPrice, r.menor, r.maior, r.registros]).toEqual([28.90, 22.00, 28.90, 4]);
  });
  it('variação compara o mais antigo com o mais recente', () => {
    expect(resumoDePreco(entries, 'Arroz')!.variacao).toBeCloseTo(31.4, 1);
  });
  it('mercado mais barato vem primeiro', () => {
    const r = resumoDePreco(entries, 'Arroz')!;
    expect(r.lojas[0]!.loja).toBe('Carrefour');
    expect(r.lojas[0]!.media).toBe(23.25);
  });
  it('acento e caixa não separam registros', () => {
    expect(resumoDePreco(entries, 'ARROZ')).not.toBeNull();
    expect(normalizeName('Pão')).toBe('pao');
  });
  it('item sem histórico devolve nulo', () => {
    expect(resumoDePreco(entries, 'Quiabo')).toBeNull();
  });
  it('só entram itens comprados com preço válido', () => {
    const itens = [
      item({ name: 'Arroz', price: 25, bought: true }),
      item({ name: 'Feijão', price: 9, bought: false }),
      item({ name: 'Café', price: null, bought: true }),
      item({ name: 'Sal', price: 0, bought: true })
    ];
    const p = precosDaCompra(itens, owner, 'Extra', agora, 'c1');
    expect(p).toHaveLength(1);
    expect(p[0]!.key).toBe('arroz');
  });
  it('total estimado multiplica preço por quantidade', () => {
    expect(totalEstimado([
      { price: 10, qty: '2' }, { price: 20, qty: '1' }, { price: null, qty: '1' }
    ])).toBe(40);
  });
  it('gastos usam só compras com valor informado', () => {
    const compras: Purchase[] = [
      { id:'a', owner, listName:'C1', items:[], store:null, actualTotal:150, estimatedTotal:0, finishedAt:1000, finishedBy:null, recurring:false },
      { id:'b', owner, listName:'C2', items:[], store:null, actualTotal:null, estimatedTotal:0, finishedAt:2000, finishedBy:null, recurring:false },
      { id:'c', owner, listName:'C3', items:[], store:null, actualTotal:210.5, estimatedTotal:0, finishedAt:3000, finishedBy:null, recurring:false }
    ];
    expect(gastosPorCompra(compras).map((g) => g.total)).toEqual([150, 210.5]);
  });
});

describe('B6 · sugestões de recompra', () => {
  it('ignora o que já está numa lista ativa', () => {
    const stats: Record<string, ItemStat> = {
      cafe: { name:'Café', category:'', unit:'', lastPrice:null, count:10, lastUsed: Date.now() },
      arroz:{ name:'Arroz', category:'', unit:'', lastPrice:null, count:8, lastUsed: Date.now() }
    };
    const s = sugestoesDeRecompra(stats, ['Café']).map((x) => x.name);
    expect(s).not.toContain('Café');
    expect(s).toContain('Arroz');
  });
  it('frequência pesa mais que recência', () => {
    const agora = Date.now();
    const stats: Record<string, ItemStat> = {
      raro:  { name:'Raro', category:'', unit:'', lastPrice:null, count:1, lastUsed: agora },
      comum: { name:'Comum', category:'', unit:'', lastPrice:null, count:20, lastUsed: agora - 10*86400000 }
    };
    expect(sugestoesDeRecompra(stats, [])[0]!.name).toBe('Comum');
  });
});
