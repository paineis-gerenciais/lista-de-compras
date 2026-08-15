/**
 * Regras de itens: consolidação de duplicados (B5), ordenação e posições.
 */

import type { Item, ItemStat } from './types';
import { POSITION_STEP } from './types';
import { normalizeName } from './categorize';
import type { ParsedItem } from './parse';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function novoItem(listId: string, p: Partial<Item>, autor: string | null = null): Item {
  const agora = Date.now();
  return {
    id: uid(),
    listId,
    name: '',
    qty: '1',
    unit: '',
    category: '',
    price: null,
    bought: false,
    position: agora,
    addedBy: autor,
    boughtBy: null,
    assignedTo: null,
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    ...p
  };
}

/**
 * Só consolida item não comprado e de mesma unidade. "2kg batata" e
 * "2 pacotes de batata palha" não são a mesma coisa, e item já comprado
 * significa uma nova compra, não um engano.
 */
export function acharConsolidavel(itens: Item[], name: string, unit: string): Item | undefined {
  const chave = normalizeName(name);
  return itens.find((i) => !i.bought && normalizeName(i.name) === chave && (i.unit || '') === (unit || ''));
}

export function somarQuantidades(a: string, b: string): string {
  const x = parseFloat(String(a).replace(',', '.'));
  const y = parseFloat(String(b).replace(',', '.'));
  if (isNaN(x) || isNaN(y)) return a;
  return String(Math.round((x + y) * 1000) / 1000);
}

export interface ResultadoAdicao {
  item: Item;
  consolidado: boolean;
}

export function adicionarOuConsolidar(
  itens: Item[],
  listId: string,
  p: ParsedItem & { price?: number | null },
  autor: string | null = null
): ResultadoAdicao {
  const existente = acharConsolidavel(itens, p.name, p.unit);
  if (existente) {
    const atualizado: Item = {
      ...existente,
      qty: somarQuantidades(existente.qty, p.qty || '1'),
      price: existente.price ?? p.price ?? null,
      updatedAt: Date.now()
    };
    return { item: atualizado, consolidado: true };
  }
  return {
    item: novoItem(listId, {
      name: p.name,
      qty: p.qty || '1',
      unit: p.unit || '',
      category: p.category || '',
      price: p.price ?? null,
      position: proximaPosicao(itens)
    }, autor),
    consolidado: false
  };
}

export function proximaPosicao(itens: Item[]): number {
  if (!itens.length) return POSITION_STEP;
  return Math.max(...itens.map((i) => i.position)) + POSITION_STEP;
}

/**
 * Posição para inserir entre dois itens. Números esparsos evitam renumerar
 * toda a lista a cada arrasto — só o item movido é reescrito.
 */
export function posicaoEntre(anterior: Item | null, seguinte: Item | null): number {
  if (!anterior && !seguinte) return POSITION_STEP;
  if (!anterior) return seguinte!.position - POSITION_STEP;
  if (!seguinte) return anterior.position + POSITION_STEP;
  return (anterior.position + seguinte.position) / 2;
}

/** Comprados vão para o fim do grupo; o resto segue a posição manual. */
export function ordenarNoGrupo(itens: Item[]): Item[] {
  return [...itens].sort((a, b) => {
    if (a.bought !== b.bought) return a.bought ? 1 : -1;
    return a.position - b.position;
  });
}

export function agruparPorCategoria(itens: Item[]): Record<string, Item[]> {
  const out: Record<string, Item[]> = {};
  for (const i of itens) {
    (out[i.category] ??= []).push(i);
  }
  for (const k of Object.keys(out)) out[k] = ordenarNoGrupo(out[k]!);
  return out;
}

export function totalEstimado(itens: Array<{ price: number | null; qty: string }>): number {
  return itens.reduce((soma, it) => {
    const p = it.price;
    if (p == null || isNaN(p)) return soma;
    const q = parseFloat(it.qty);
    return soma + p * (isNaN(q) ? 1 : q);
  }, 0);
}

export function totalGasto(itens: Array<{ price: number | null; qty: string; bought: boolean }>): number {
  return totalEstimado(itens.filter((i) => i.bought));
}

/**
 * Sugestões de recompra (B6). Frequência pesa mais que recência, mas item
 * usado uma vez há seis meses não deve ocupar espaço na tela.
 */
export function sugestoesDeRecompra(
  stats: Record<string, ItemStat>,
  jaNasListas: string[],
  limite = 8
): ItemStat[] {
  const agora = Date.now();
  const ativos = new Set(jaNasListas.map(normalizeName));
  return Object.values(stats)
    .filter((h) => h?.name && !ativos.has(normalizeName(h.name)))
    .map((h) => {
      const dias = Math.max(1, (agora - (h.lastUsed || agora)) / 86400000);
      return { h, score: (h.count || 1) * (1 / Math.log2(dias + 2)) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map((x) => x.h);
}
