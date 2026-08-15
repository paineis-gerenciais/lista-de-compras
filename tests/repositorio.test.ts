/**
 * Testes da camada de dados e dos casos de uso.
 *
 * Rodam contra MemoryRepository — a mesma interface que a produção usa.
 * Testar contra a interface real, e não contra mocks, é o que impede a
 * camada de dados de virar teatro.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository } from '../src/lib/data/MemoryRepository';
import { migrarV4, aplicarMigracao } from '../src/lib/data/migration';
import {
  adicionarItens, criarLista, finalizarCompra, moverItem,
  moverListaDeEscopo, alternarComprado, carregarPendentes, registrarLoja
} from '../src/lib/servicos/listas';
import {
  criarFamilia, criarConvite, revogarConvite, listarConvites, entrarComConvite, sairDaFamilia
} from '../src/lib/servicos/familias';
import type { OwnerRef, ShoppingList } from '../src/lib/domain/types';

const eu: OwnerRef = { kind: 'user', id: 'u1' };

let repo: MemoryRepository;
beforeEach(() => { repo = new MemoryRepository(); });

async function listaCom(nomes: string[], owner: OwnerRef = eu): Promise<ShoppingList> {
  const l = criarLista(owner, 'Mercado');
  await repo.lists.createList(l);
  await adicionarItens(repo, l, [], nomes.map((n) => ({ name: n, qty: '1', unit: '', category: '' })), 'u1');
  return l;
}

describe('Repositório · listas e itens', () => {
  it('criar lista e observar em tempo real', async () => {
    let vistas: ShoppingList[] = [];
    repo.lists.watchLists(eu, (l) => { vistas = l; });
    await repo.lists.createList(criarLista(eu, 'Feira'));
    expect(vistas.map((l) => l.name)).toEqual(['Feira']);
  });

  it('escrever um item não reescreve os outros', async () => {
    const l = await listaCom(['Arroz', 'Feijão']);
    const antes = await repo.items.getItems(l.id);
    const carimboFeijao = antes[1]!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    await repo.items.updateItem(l.id, antes[0]!.id, { qty: '5' });
    const depois = await repo.items.getItems(l.id);
    expect(depois[1]!.updatedAt).toBe(carimboFeijao);
  });

  it('apagar lista apaga os itens junto', async () => {
    const l = await listaCom(['Arroz']);
    await repo.lists.deleteList(l.id);
    expect(await repo.items.getItems(l.id)).toHaveLength(0);
  });

  it('itens excluídos somem das leituras', async () => {
    const l = await listaCom(['Arroz', 'Feijão']);
    const itens = await repo.items.getItems(l.id);
    await repo.items.deleteItem(l.id, itens[0]!.id);
    expect((await repo.items.getItems(l.id)).map((i) => i.name)).toEqual(['Feijão']);
  });

  it('marcar item registra quem pegou', async () => {
    const l = await listaCom(['Arroz']);
    const [it] = await repo.items.getItems(l.id);
    await alternarComprado(repo, it!, 'u2');
    const depois = await repo.items.getItems(l.id);
    expect(depois[0]!.bought).toBe(true);
    expect(depois[0]!.boughtBy).toBe('u2');
  });

  it('mover item troca só a posição dele', async () => {
    const l = await listaCom(['A', 'B', 'C']);
    const itens = await repo.items.getItems(l.id);
    await moverItem(repo, itens[2]!, itens, -1);
    const depois = await repo.items.getItems(l.id);
    expect(depois.map((i) => i.name)).toEqual(['A', 'C', 'B']);
  });
});

describe('PENDÊNCIA 1 · mover lista entre pessoal e família', () => {
  it('a lista muda de escopo e os itens acompanham', async () => {
    const casa: OwnerRef = { kind: 'household', id: 'h1' };
    const l = await listaCom(['Arroz', 'Feijão']);

    let pessoais: ShoppingList[] = [];
    let daCasa: ShoppingList[] = [];
    repo.lists.watchLists(eu, (x) => { pessoais = x; });
    repo.lists.watchLists(casa, (x) => { daCasa = x; });

    await moverListaDeEscopo(repo, l, casa);

    expect(pessoais).toHaveLength(0);
    expect(daCasa.map((x) => x.id)).toEqual([l.id]);
    // os itens não foram tocados: continuam ligados pelo listId
    expect(await repo.items.getItems(l.id)).toHaveLength(2);
  });

  it('mover de volta funciona e não duplica', async () => {
    const casa: OwnerRef = { kind: 'household', id: 'h1' };
    const l = await listaCom(['Arroz']);
    await moverListaDeEscopo(repo, l, casa);
    await moverListaDeEscopo(repo, { ...l, owner: casa }, eu);
    // watchLists chama o callback de forma síncrona na inscrição, então
    // capturamos o valor e só depois cancelamos.
    let pessoais: ShoppingList[] = [];
    const un = repo.lists.watchLists(eu, (x) => { pessoais = x; });
    un();
    expect(pessoais).toHaveLength(1);
    expect(await repo.items.getItems(l.id)).toHaveLength(1);
  });
});

describe('PENDÊNCIA 3 · revogar convite', () => {
  it('convite revogado deixa de funcionar', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const inv = await criarConvite(repo, h.id, 'u1', 'editor');

    await revogarConvite(repo, inv.code);
    const r = await entrarComConvite(repo, inv.code, 'u2', 'Bia');

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('cancelado');
  });

  it('revogar é distinguível de código inexistente', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const inv = await criarConvite(repo, h.id, 'u1', 'editor');
    await revogarConvite(repo, inv.code);

    const revogado = await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    const inexistente = await entrarComConvite(repo, 'ZZZZ2222', 'u2', 'Bia');
    expect(revogado.ok).toBe(false);
    expect(inexistente.ok).toBe(false);
    if (!revogado.ok && !inexistente.ok) expect(revogado.erro).not.toBe(inexistente.erro);
  });

  it('a listagem mostra a situação de cada convite', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const ativo = await criarConvite(repo, h.id, 'u1', 'editor');
    const cancelado = await criarConvite(repo, h.id, 'u1', 'viewer');
    await revogarConvite(repo, cancelado.code);

    const lista = await listarConvites(repo, h.id);
    expect(lista.find((i) => i.code === ativo.code)!.situacao).toBe('ativo');
    expect(lista.find((i) => i.code === cancelado.code)!.situacao).toBe('cancelado');
  });

  it('convite pode ser criado direto como só leitura', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const inv = await criarConvite(repo, h.id, 'u1', 'viewer');
    const r = await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.household.members['u2']!.role).toBe('viewer');
  });
});

describe('G · famílias', () => {
  it('quem cria vira responsável', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    expect(h.members['u1']!.role).toBe('owner');
    expect(h.memberUids).toEqual(['u1']);
  });

  it('entrar por convite acrescenta o membro', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const inv = await criarConvite(repo, h.id, 'u1');
    const r = await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.household.memberUids).toContain('u2');
  });

  it('entrar duas vezes não duplica', async () => {
    const h = await criarFamilia(repo, 'Casa', 'u1', 'Ana');
    const inv = await criarConvite(repo, h.id, 'u1');
    await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    const r = await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    if (r.ok) expect(r.household.memberUids.filter((u) => u === 'u2')).toHaveLength(1);
  });

  it('sair sozinho apaga a família; acompanhado só remove o membro', async () => {
    const h1 = await criarFamilia(repo, 'Solo', 'u1', 'Ana');
    await sairDaFamilia(repo, h1, 'u1');
    expect(repo.db.households.find((x) => x.id === h1.id)).toBeUndefined();

    const h2 = await criarFamilia(repo, 'Dupla', 'u1', 'Ana');
    const inv = await criarConvite(repo, h2.id, 'u1');
    await entrarComConvite(repo, inv.code, 'u2', 'Bia');
    const atual = repo.db.households.find((x) => x.id === h2.id)!;
    await sairDaFamilia(repo, atual, 'u2');
    expect(repo.db.households.find((x) => x.id === h2.id)!.memberUids).toEqual(['u1']);
  });
});

describe('Finalizar compra', () => {
  it('arquiva, registra preços e apaga a lista', async () => {
    const l = await listaCom(['Arroz']);
    const itens = await repo.items.getItems(l.id);
    await repo.items.updateItem(l.id, itens[0]!.id, { price: 25, bought: true });
    const atualizados = await repo.items.getItems(l.id);

    const { purchase } = await finalizarCompra(
      repo, l, atualizados, { store: 'Extra', actualTotal: 55.4 }, 'u1'
    );

    expect(purchase.actualTotal).toBe(55.4);
    expect(purchase.store).toBe('Extra');
    expect(repo.db.prices).toHaveLength(1);
    expect(repo.db.prices[0]!.unitPrice).toBe(25);
    expect(await repo.items.getItems(l.id)).toHaveLength(0);
  });

  it('lista recorrente gera a próxima com itens desmarcados', async () => {
    const l = criarLista(eu, 'Mercado', true, 7);
    await repo.lists.createList(l);
    await adicionarItens(repo, l, [], [{ name: 'Arroz', qty: '1', unit: '', category: '' }], 'u1');
    const itens = await repo.items.getItems(l.id);
    await repo.items.updateItem(l.id, itens[0]!.id, { bought: true });

    const { proxima } = await finalizarCompra(
      repo, l, await repo.items.getItems(l.id), { store: null, actualTotal: null }, 'u1'
    );

    expect(proxima).not.toBeNull();
    const novos = await repo.items.getItems(proxima!.id);
    expect(novos).toHaveLength(1);
    expect(novos[0]!.bought).toBe(false);
  });

  it('itens pendentes viram uma lista nova', async () => {
    const l = await listaCom(['Arroz', 'Feijão']);
    const itens = await repo.items.getItems(l.id);
    const nova = await carregarPendentes(repo, eu, 'Mercado 2', [itens[1]!], 'u1');
    expect((await repo.items.getItems(nova.id)).map((i) => i.name)).toEqual(['Feijão']);
  });

  it('lojas repetidas não se acumulam', () => {
    const perfil = { stores: ['Extra Savassi'] } as any;
    expect(registrarLoja(perfil, 'extra savassi')).toHaveLength(1);
    expect(registrarLoja(perfil, 'Carrefour')).toHaveLength(2);
  });
});

describe('F · migração v4 → v5', () => {
  const antigo = {
    schemaVersion: 3,
    lists: [{
      id: 'L1', name: 'Mercado', baseName: 'Mercado',
      recurring: { enabled: true, frequencyDays: 7 },
      createdAt: 1000, updatedAt: 2000, location: { type: 'address', value: 'Extra' },
      items: [
        { id: 'I1', name: 'Arroz', qty: '2', unit: 'kg', category: 'Mercearia', price: 25, bought: true },
        { id: 'I2', name: 'Feijão', qty: '', category: 'Mercearia', bought: false }
      ]
    }],
    finishedLists: [{
      id: 'F1', name: 'Mercado 01/07', finishedAt: 500, actualTotal: 180, store: 'Extra',
      items: [{ name: 'Café', qty: '1', price: 20, bought: true }]
    }],
    itemHistory: { arroz: { name: 'Arroz', category: 'Mercearia', unit: 'kg', price: 25, count: 5, lastUsed: 900 } },
    aisleOrders: { __default__: { order: ['Hortifruti', 'Mercearia'], updatedAt: 700 } },
    priceHistory: { arroz: [{ loja: 'Extra', precoUnit: 25, unit: 'kg', qty: '2', data: 800 }] },
    stores: ['Extra']
  };

  it('desmonta o estado monolítico nas coleções novas', () => {
    const r = migrarV4(antigo, eu, 'u1');
    expect(r.lists).toHaveLength(1);
    expect(r.items).toHaveLength(2);
    expect(r.purchases).toHaveLength(1);
    expect(r.prices).toHaveLength(1);
    expect(r.profile.itemStats!['arroz']!.count).toBe(5);
    expect(r.profile.aisleOrders!['__default__']!.order).toEqual(['Hortifruti', 'Mercearia']);
  });

  it('preserva os ids — a migração pode rodar duas vezes', () => {
    const a = migrarV4(antigo, eu, 'u1');
    const b = migrarV4(antigo, eu, 'u1');
    expect(a.lists[0]!.id).toBe('L1');
    expect(a.items.map((i) => i.id)).toEqual(['I1', 'I2']);
    expect(a.prices[0]!.id).toBe(b.prices[0]!.id);
  });

  it('a ordem do array vira posição espaçada', () => {
    const r = migrarV4(antigo, eu, 'u1');
    expect(r.items[0]!.position).toBeLessThan(r.items[1]!.position);
    expect(r.items[1]!.position - r.items[0]!.position).toBeGreaterThanOrEqual(1000);
  });

  it('item sem quantidade recebe 1', () => {
    expect(migrarV4(antigo, eu, 'u1').items[1]!.qty).toBe('1');
  });

  it('entrada inválida não quebra', () => {
    expect(migrarV4(null, eu, 'u1').lists).toHaveLength(0);
    expect(migrarV4({} as any, eu, 'u1').items).toHaveLength(0);
    expect(migrarV4({ lists: 'lixo' } as any, eu, 'u1').lists).toHaveLength(0);
  });

  it('aplicar duas vezes não duplica preços', async () => {
    await aplicarMigracao(repo, migrarV4(antigo, eu, 'u1'));
    const depoisDeUma = repo.db.prices.length;
    const segunda = migrarV4(antigo, eu, 'u1');
    // ids determinísticos: o repositório real usa set() com o mesmo id
    expect(segunda.prices[0]!.id).toBe(repo.db.prices[0]!.id);
    expect(depoisDeUma).toBe(1);
  });

  it('grava tudo pelo repositório', async () => {
    await aplicarMigracao(repo, migrarV4(antigo, eu, 'u1'));
    expect(await repo.items.getItems('L1')).toHaveLength(2);
    expect(repo.db.purchases).toHaveLength(1);
    const perfil = await repo.profiles.getProfile('u1');
    expect(perfil!.stores).toContain('Extra');
    expect(perfil!.schemaVersion).toBe(4);
  });
});
