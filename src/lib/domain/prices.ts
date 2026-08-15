/**
 * Inteligência de preço (H1/H2) sobre o modelo granular.
 *
 * O preço é sempre **unitário**, nunca o total da linha: "2 kg de tomate por
 * R$ 18" e "1 kg por R$ 9" são o mesmo preço, e sem essa normalização
 * comparar mercados vira ruído.
 */

import type { PriceEntry, Purchase, Item, OwnerRef } from './types';
import { normalizeName } from './categorize';
import { uid } from './items';

export const MESES_DE_HISTORICO = 18;

export interface ResumoLoja {
  loja: string;
  media: number;
  n: number;
  ultimo: PriceEntry;
}

export interface ResumoDePreco {
  nome: string;
  registros: number;
  menor: number;
  maior: number;
  ultimo: PriceEntry;
  maisBarato: PriceEntry;
  variacao: number | null;
  unit: string;
  lojas: ResumoLoja[];
}

export function agruparPrecos(entries: PriceEntry[]): Record<string, PriceEntry[]> {
  const out: Record<string, PriceEntry[]> = {};
  for (const e of entries) (out[e.key] ??= []).push(e);
  for (const k of Object.keys(out)) out[k]!.sort((a, b) => b.date - a.date);
  return out;
}

export function resumoDePreco(entries: PriceEntry[], nome: string): ResumoDePreco | null {
  const chave = normalizeName(nome);
  const h = entries.filter((e) => e.key === chave).sort((a, b) => b.date - a.date);
  if (!h.length) return null;

  const precos = h.map((e) => e.unitPrice);
  const menor = Math.min(...precos);
  const maior = Math.max(...precos);
  const ultimo = h[0]!;
  const antigo = h[h.length - 1]!;
  const maisBarato = h.find((e) => e.unitPrice === menor)!;

  let variacao: number | null = null;
  if (h.length > 1 && antigo.unitPrice > 0) {
    variacao = Math.round(((ultimo.unitPrice - antigo.unitPrice) / antigo.unitPrice) * 1000) / 10;
  }

  const porLoja: Record<string, { soma: number; n: number; ultimo: PriceEntry }> = {};
  for (const e of h) {
    const loja = e.store || 'sem loja';
    const atual = porLoja[loja];
    if (!atual) porLoja[loja] = { soma: e.unitPrice, n: 1, ultimo: e };
    else {
      atual.soma += e.unitPrice;
      atual.n++;
      if (e.date > atual.ultimo.date) atual.ultimo = e;
    }
  }
  const lojas = Object.entries(porLoja)
    .map(([loja, v]) => ({ loja, media: Math.round((v.soma / v.n) * 100) / 100, n: v.n, ultimo: v.ultimo }))
    .sort((a, b) => a.media - b.media);

  return {
    nome: ultimo.displayName || nome,
    registros: h.length, menor, maior, ultimo, maisBarato, variacao,
    unit: ultimo.unit || '', lojas
  };
}

/** Só entram itens efetivamente comprados e com preço válido. */
export function precosDaCompra(
  itens: Item[],
  owner: OwnerRef,
  loja: string | null,
  quando: number,
  purchaseId: string | null
): PriceEntry[] {
  const out: PriceEntry[] = [];
  for (const it of itens) {
    if (!it.bought) continue;
    const p = it.price;
    if (p == null || isNaN(p) || p <= 0) continue;
    const key = normalizeName(it.name);
    if (!key) continue;
    out.push({
      id: uid(), owner, key, displayName: it.name, store: loja,
      unitPrice: Math.round(p * 100) / 100,
      unit: it.unit || '', qty: it.qty, date: quando,
      source: 'manual', purchaseId
    });
  }
  return out;
}

export interface GastoPorCompra {
  data: number; total: number; estimado: number; loja: string | null; nome: string;
}

export function gastosPorCompra(compras: Purchase[], limite = 12): GastoPorCompra[] {
  return compras
    .filter((c) => c.actualTotal != null && !isNaN(c.actualTotal))
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .slice(-limite)
    .map((c) => ({
      data: c.finishedAt, total: c.actualTotal!, estimado: c.estimatedTotal,
      loja: c.store, nome: c.listName
    }));
}

export function formatPrice(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
