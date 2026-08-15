/**
 * Casos de uso. É aqui que a interface conversa com o repositório.
 *
 * A regra é: componente .svelte não chama repositório direto. Isso mantém a
 * lógica de aplicação testável sem montar componente, e evita que a mesma
 * regra apareça escrita de dois jeitos em duas telas.
 */

import type {
  Item, OwnerRef, Purchase, ShoppingList, UserProfile, ItemStat
} from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import type { Repository } from '../data/repository';
import type { ParsedItem } from '../domain/parse';
import {
  adicionarOuConsolidar, novoItem, ordenarNoGrupo, proximaPosicao,
  posicaoEntre, totalEstimado, uid
} from '../domain/items';
import { normalizeName } from '../domain/categorize';
import { precosDaCompra } from '../domain/prices';
import { renovar } from '../domain/recurrence';

export function criarLista(
  owner: OwnerRef, nome: string, recorrente = false, frequencia = 7
): ShoppingList {
  const ts = Date.now();
  return {
    id: uid(), owner, name: nome, baseName: nome,
    recurring: { enabled: recorrente, frequencyDays: frequencia },
    location: null, categoryOrder: [],
    createdAt: ts, updatedAt: ts, deletedAt: null
  };
}

/** Consolida duplicados antes de gravar — B5. */
export async function adicionarItens(
  repo: Repository, lista: ShoppingList, existentes: Item[],
  entradas: Array<ParsedItem & { price?: number | null }>, autor: string | null
): Promise<{ novos: number; consolidados: number }> {
  let novos = 0, consolidados = 0;
  const acumulados = [...existentes];
  const aInserir: Item[] = [];

  for (const p of entradas) {
    if (!p.name) continue;
    const r = adicionarOuConsolidar(acumulados, lista.id, p, autor);
    if (r.consolidado) {
      await repo.items.updateItem(lista.id, r.item.id, { qty: r.item.qty, price: r.item.price });
      const i = acumulados.findIndex((x) => x.id === r.item.id);
      if (i >= 0) acumulados[i] = r.item;
      consolidados++;
    } else {
      aInserir.push(r.item);
      acumulados.push(r.item);
      novos++;
    }
  }
  if (aInserir.length) await repo.items.addItems(aInserir);
  return { novos, consolidados };
}

export async function alternarComprado(
  repo: Repository, item: Item, quem: string | null
): Promise<void> {
  const marcando = !item.bought;
  await repo.items.updateItem(item.listId, item.id, {
    bought: marcando,
    boughtBy: marcando ? quem : null
  });
}

/** Move um item dentro do próprio grupo, sem renumerar os vizinhos. */
export async function moverItem(
  repo: Repository, item: Item, irmaos: Item[], direcao: -1 | 1
): Promise<void> {
  const ordenados = ordenarNoGrupo(irmaos);
  const de = ordenados.findIndex((i) => i.id === item.id);
  const para = de + direcao;
  if (de < 0 || para < 0 || para >= ordenados.length) return;

  const anterior = direcao === -1 ? (ordenados[para - 1] ?? null) : ordenados[para]!;
  const seguinte = direcao === -1 ? ordenados[para]! : (ordenados[para + 1] ?? null);
  await repo.items.updateItem(item.listId, item.id, { position: posicaoEntre(anterior, seguinte) });
}

export interface DadosDeFinalizacao {
  store: string | null;
  actualTotal: number | null;
}

/**
 * Finalizar compra: arquiva como Purchase, registra os preços e — se for
 * recorrente — cria a próxima. Tudo numa função, porque tudo isso é *um*
 * gesto do usuário e falhar no meio deixaria o estado inconsistente.
 */
export async function finalizarCompra(
  repo: Repository, lista: ShoppingList, itens: Item[],
  dados: DadosDeFinalizacao, quem: string | null
): Promise<{ purchase: Purchase; proxima: ShoppingList | null }> {
  const agora = Date.now();
  const purchase: Purchase = {
    id: uid(),
    owner: lista.owner,
    listName: lista.name,
    items: itens.map((i) => ({
      name: i.name, qty: i.qty, unit: i.unit, category: i.category,
      price: i.price, bought: i.bought, boughtBy: i.boughtBy
    })),
    store: dados.store ?? lista.location?.value ?? null,
    actualTotal: dados.actualTotal,
    estimatedTotal: totalEstimado(itens),
    finishedAt: agora,
    finishedBy: quem,
    recurring: lista.recurring.enabled
  };
  await repo.purchases.addPurchase(purchase);

  const precos = precosDaCompra(itens, lista.owner, purchase.store, agora, purchase.id);
  if (precos.length) await repo.prices.addEntries(precos);

  let proxima: ShoppingList | null = null;
  if (lista.recurring.enabled) {
    const r = renovar(lista, itens);
    await repo.lists.createList(r.lista);
    if (r.itens.length) await repo.items.addItems(r.itens);
    proxima = r.lista;
  }

  await repo.lists.deleteList(lista.id);
  return { purchase, proxima };
}

/** Cria uma lista nova com os itens que sobraram. */
export async function carregarPendentes(
  repo: Repository, owner: OwnerRef, nome: string, pendentes: Item[], autor: string | null
): Promise<ShoppingList> {
  const nova = criarLista(owner, nome);
  await repo.lists.createList(nova);
  const itens: Item[] = [];
  for (const it of pendentes) {
    itens.push(novoItem(nova.id, {
      name: it.name, qty: it.qty, unit: it.unit, category: it.category,
      price: it.price, position: proximaPosicao(itens)
    }, autor));
  }
  if (itens.length) await repo.items.addItems(itens);
  return nova;
}

/**
 * PENDÊNCIA 1 — mover uma lista entre pessoal e família.
 *
 * Na v4 isso era impossível sem exportar e importar: o dono da lista era o
 * documento inteiro. Aqui a lista tem um campo `owner` e os itens são
 * identificados pelo `listId`, então trocar o dono move tudo junto sem
 * reescrever um único item.
 */
export async function moverListaDeEscopo(
  repo: Repository, lista: ShoppingList, novoOwner: OwnerRef
): Promise<void> {
  await repo.lists.moveList(lista.id, novoOwner);
}

/** Estatísticas de uso, que alimentam as sugestões de recompra. */
export function atualizarEstatisticas(
  perfil: UserProfile | null, uidUsuario: string, itens: Item[]
): UserProfile {
  const agora = Date.now();
  const stats: Record<string, ItemStat> = { ...(perfil?.itemStats ?? {}) };
  for (const it of itens) {
    const k = normalizeName(it.name);
    if (!k) continue;
    const anterior = stats[k];
    stats[k] = {
      name: it.name,
      category: it.category || anterior?.category || '',
      unit: it.unit || anterior?.unit || '',
      lastPrice: it.price ?? anterior?.lastPrice ?? null,
      count: (anterior?.count ?? 0) + 1,
      lastUsed: agora
    };
  }
  return {
    uid: uidUsuario,
    displayName: perfil?.displayName ?? '',
    email: perfil?.email ?? null,
    aisleOrders: perfil?.aisleOrders ?? {},
    stores: perfil?.stores ?? [],
    itemStats: stats,
    schemaVersion: SCHEMA_VERSION,
    createdAt: perfil?.createdAt ?? agora,
    updatedAt: agora
  };
}

export function registrarLoja(perfil: UserProfile | null, nome: string): string[] {
  const n = nome.trim();
  const atuais = perfil?.stores ?? [];
  if (!n) return atuais;
  if (atuais.some((s) => normalizeName(s) === normalizeName(n))) return atuais;
  return [n, ...atuais].slice(0, 40);
}
