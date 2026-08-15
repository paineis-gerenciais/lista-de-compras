/**
 * Recorrência. A lista guarda um `baseName` justamente para que renovar não
 * acumule datas ("Mercado 07/07 14/07 21/07").
 */

import type { ShoppingList, Item } from './types';
import { novoItem, proximaPosicao } from './items';

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export interface ProximaOcorrencia {
  base: string;
  label: string;
  data: Date;
}

export function proximaOcorrencia(list: ShoppingList, agora = new Date()): ProximaOcorrencia {
  const base = list.baseName || list.name.replace(/\s+\d{2}\/\d{2}$/, '');
  const dias = list.recurring.frequencyDays || 7;
  const data = new Date(agora.getTime() + dias * 86400000);
  return { base, label: `${base} ${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}`, data };
}

/** A lista renovada nasce com os mesmos itens, todos desmarcados e com ids novos. */
export function renovar(list: ShoppingList, itens: Item[], agora = new Date()): {
  lista: ShoppingList;
  itens: Item[];
} {
  const prox = proximaOcorrencia(list, agora);
  const ts = Date.now();
  const nova: ShoppingList = {
    ...list,
    id: `${Math.random().toString(36).slice(2, 10)}${ts.toString(36).slice(-4)}`,
    name: prox.label,
    baseName: prox.base,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null
  };
  const novos: Item[] = [];
  for (const it of itens) {
    novos.push(novoItem(nova.id, {
      name: it.name, qty: it.qty, unit: it.unit, category: it.category,
      price: it.price, position: proximaPosicao(novos)
    }, it.addedBy));
  }
  return { lista: nova, itens: novos };
}
