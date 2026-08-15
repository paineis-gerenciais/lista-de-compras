/**
 * Ordem dos corredores (C3). Guardada por mercado, porque o trajeto do Extra
 * não é o do Carrefour — e o ganho prático de uma lista de compras é seguir
 * o trajeto real da loja.
 */

import type { AisleOrder, ShoppingList } from './types';
import { normalizeName } from './categorize';

export const CHAVE_PADRAO = '__default__';

export function aisleKey(list: Pick<ShoppingList, 'location'> | null): string {
  const v = list?.location?.type === 'address' ? list.location.value : null;
  return v ? `loja:${normalizeName(v)}` : CHAVE_PADRAO;
}

/**
 * "Sem categoria" sempre primeiro; depois a ordem salva; o que não estiver
 * na ordem vai para o fim, em ordem alfabética.
 */
export function ordenarCategorias(
  cats: string[],
  ordens: Record<string, AisleOrder>,
  list: Pick<ShoppingList, 'location'> | null
): string[] {
  const salva = ordens[aisleKey(list)]?.order ?? ordens[CHAVE_PADRAO]?.order ?? null;
  const rank: Record<string, number> = {};
  salva?.forEach((c, i) => { rank[c] = i; });

  return [...cats].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    const ra = rank[a] ?? Infinity;
    const rb = rank[b] ?? Infinity;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, 'pt-BR');
  });
}
