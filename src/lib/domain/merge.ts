/**
 * Reconciliação entre aparelhos — bloco A4 da Fase 3, repensado para o
 * modelo granular do bloco F.
 *
 * A mudança conceitual: na v4 o merge reconstruía o estado inteiro porque
 * o estado inteiro era um documento. Agora cada registro é um documento, e
 * o Firestore já resolve a maior parte dos conflitos por si — a escrita de
 * um item não toca nos outros.
 *
 * O que ainda precisa de merge explícito:
 *   1. o mesmo registro editado nos dois lados (last-writer-wins por campo
 *      não serve para tudo — ver mergeItem)
 *   2. exclusões, que aqui viram `deletedAt` no próprio documento em vez de
 *      uma lista separada de lápides. Simplifica: o registro carrega a
 *      própria morte, e o merge não precisa de estado global.
 */

import type { Item, ShoppingList } from './types';

export interface Timestamped {
  id: string;
  updatedAt: number;
  deletedAt?: number | null;
}

/** Um registro está morto se foi apagado e não houve edição posterior. */
export function isDead(r: Timestamped | undefined | null): boolean {
  if (!r) return true;
  const del = r.deletedAt ?? null;
  if (del == null) return false;
  return del >= r.updatedAt;
}

/**
 * Vence o mais recente. Se um lado apagou e o outro editou depois, a edição
 * ganha — o gesto mais recente é o que a pessoa quis.
 */
export function mergeRecord<T extends Timestamped>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  const vencedor = a.updatedAt >= b.updatedAt ? a : b;
  const perdedor = vencedor === a ? b : a;
  const del = Math.max(vencedor.deletedAt ?? 0, perdedor.deletedAt ?? 0);
  return { ...vencedor, deletedAt: del > vencedor.updatedAt ? del : (vencedor.deletedAt ?? null) };
}

/**
 * Itens têm um caso que o last-writer-wins puro erra: duas pessoas no mesmo
 * mercado marcando itens diferentes é comum, mas marcar o *mesmo* item quase
 * nunca é conflito real — se qualquer lado marcou como comprado, o item foi
 * pego. Desmarcar, sim, é uma correção deliberada e precisa ser mais recente.
 */
export function mergeItem(a: Item | null, b: Item | null): Item | null {
  const base = mergeRecord(a, b);
  if (!base || !a || !b) return base;

  const marcouA = a.bought && !b.bought;
  const marcouB = b.bought && !a.bought;
  if (marcouA || marcouB) {
    const queMarcou = marcouA ? a : b;
    const outro = marcouA ? b : a;
    // só preserva a marcação se o outro lado não a desfez explicitamente depois
    if (queMarcou.updatedAt >= outro.updatedAt) {
      return { ...base, bought: true, boughtBy: queMarcou.boughtBy };
    }
  }
  return base;
}

export function mergeCollection<T extends Timestamped>(
  locais: T[],
  remotos: T[],
  fn: (a: T | null, b: T | null) => T | null = mergeRecord
): T[] {
  const indice = new Map<string, T>();
  for (const r of locais) indice.set(r.id, r);
  for (const r of remotos) {
    const anterior = indice.get(r.id) ?? null;
    const juntos = fn(anterior, r);
    if (juntos) indice.set(r.id, juntos);
  }
  return [...indice.values()].filter((r) => !isDead(r));
}

export function mergeItems(locais: Item[], remotos: Item[]): Item[] {
  return mergeCollection(locais, remotos, mergeItem as (a: Item | null, b: Item | null) => Item | null)
    .sort((x, y) => x.position - y.position);
}

export function mergeLists(locais: ShoppingList[], remotos: ShoppingList[]): ShoppingList[] {
  return mergeCollection(locais, remotos);
}
