/**
 * Migração v4 → v5 — bloco F.
 *
 * A v4 guardava tudo num documento por usuário (ou por família):
 *
 *     { state: { lists:[{...items:[...]}], finishedLists:[...],
 *                itemHistory:{}, aisleOrders:{}, priceHistory:{}, stores:[] } }
 *
 * Aqui esse bloco é desmontado em coleções. A regra que orienta tudo: a
 * migração **nunca apaga a origem**. O documento antigo continua no
 * Firestore, e a migração é idempotente — rodar duas vezes não duplica nada,
 * porque os ids são preservados.
 *
 * Isso importa mais do que parece: se algo der errado depois do deploy, a
 * saída é apontar o app de volta para o modelo antigo, não restaurar backup.
 */

import type {
  AisleOrder, Item, ItemStat, OwnerRef, PriceEntry,
  Purchase, ShoppingList, UserProfile
} from '../domain/types';
import { SCHEMA_VERSION, POSITION_STEP } from '../domain/types';
import { uid } from '../domain/items';
import { normalizeName } from '../domain/categorize';

/** Formato antigo, tipado com folga porque vem de dados reais e imperfeitos. */
export interface EstadoV4 {
  schemaVersion?: number;
  lists?: any[];
  finishedLists?: any[];
  itemHistory?: Record<string, any>;
  aisleOrders?: Record<string, any>;
  priceHistory?: Record<string, any[]>;
  stores?: string[];
  appMode?: string;
  theme?: string;
  updatedAt?: number;
}

export interface ResultadoMigracao {
  lists: ShoppingList[];
  items: Item[];
  purchases: Purchase[];
  prices: PriceEntry[];
  profile: Partial<UserProfile>;
  avisos: string[];
}

export function migrarV4(
  antigo: EstadoV4 | null | undefined,
  owner: OwnerRef,
  donoUid: string
): ResultadoMigracao {
  const avisos: string[] = [];
  const out: ResultadoMigracao = {
    lists: [], items: [], purchases: [], prices: [], profile: {}, avisos
  };
  if (!antigo || typeof antigo !== 'object') {
    avisos.push('Nada para migrar.');
    return out;
  }

  const agora = Date.now();

  // ---------- listas e itens ----------
  for (const l of antigo.lists ?? []) {
    if (!l || typeof l !== 'object') continue;
    const listId = String(l.id || uid());
    out.lists.push({
      id: listId,
      owner,
      name: String(l.name ?? 'Lista'),
      baseName: String(l.baseName ?? l.name ?? 'Lista'),
      recurring: {
        enabled: !!l.recurring?.enabled,
        frequencyDays: Number(l.recurring?.frequencyDays) || 7
      },
      location: l.location ?? null,
      categoryOrder: [],
      createdAt: Number(l.createdAt) || agora,
      updatedAt: Number(l.updatedAt) || Number(l.createdAt) || agora,
      deletedAt: null
    });

    // A ordem do array vira `position`. Espaçamos para permitir inserções
    // futuras entre dois itens sem renumerar a lista inteira.
    (l.items ?? []).forEach((it: any, idx: number) => {
      if (!it) return;
      out.items.push({
        id: String(it.id || uid()),
        listId,
        name: String(it.name ?? ''),
        qty: it.qty == null || it.qty === '' ? '1' : String(it.qty),
        unit: String(it.unit ?? ''),
        category: String(it.category ?? ''),
        price: numeroOuNulo(it.price),
        bought: !!it.bought,
        position: (idx + 1) * POSITION_STEP,
        addedBy: it.addedBy ?? null,
        boughtBy: it.boughtBy ?? null,
        assignedTo: it.assignedTo ?? null,
        createdAt: Number(it.updatedAt) || Number(l.createdAt) || agora,
        updatedAt: Number(it.updatedAt) || Number(l.updatedAt) || agora,
        deletedAt: null
      });
    });
  }

  // ---------- compras finalizadas ----------
  for (const f of antigo.finishedLists ?? []) {
    if (!f) continue;
    const itens = (f.items ?? []).map((it: any) => ({
      name: String(it?.name ?? ''),
      qty: String(it?.qty ?? '1'),
      unit: String(it?.unit ?? ''),
      category: String(it?.category ?? ''),
      price: numeroOuNulo(it?.price),
      bought: !!it?.bought,
      boughtBy: it?.boughtBy ?? null
    }));
    out.purchases.push({
      id: String(f.id || uid()),
      owner,
      listName: String(f.name ?? 'Compra'),
      items: itens,
      store: f.store ?? f.location?.value ?? null,
      actualTotal: numeroOuNulo(f.actualTotal),
      estimatedTotal: itens.reduce((s: number, i: any) => {
        if (i.price == null) return s;
        const q = parseFloat(i.qty);
        return s + i.price * (isNaN(q) ? 1 : q);
      }, 0),
      finishedAt: Number(f.finishedAt) || Number(f.createdAt) || agora,
      finishedBy: null,
      recurring: !!f.recurring?.enabled
    });
  }

  // ---------- histórico de preços ----------
  for (const [chave, registros] of Object.entries(antigo.priceHistory ?? {})) {
    if (!Array.isArray(registros)) continue;
    for (const e of registros) {
      if (!e || typeof e.precoUnit !== 'number') continue;
      out.prices.push({
        // id determinístico: rodar a migração de novo não duplica o registro
        id: `mig-${chave}-${e.data}-${Math.round(e.precoUnit * 100)}`,
        owner,
        key: normalizeName(chave),
        displayName: nomeExibivel(chave, antigo),
        store: e.loja ?? null,
        unitPrice: e.precoUnit,
        unit: String(e.unit ?? ''),
        qty: String(e.qty ?? '1'),
        date: Number(e.data) || agora,
        source: 'manual',
        purchaseId: null
      });
    }
  }

  // ---------- perfil ----------
  const aisleOrders: Record<string, AisleOrder> = {};
  for (const [k, v] of Object.entries(antigo.aisleOrders ?? {})) {
    if (!v || !Array.isArray((v as any).order)) continue;
    aisleOrders[k] = { key: k, order: (v as any).order, updatedAt: Number((v as any).updatedAt) || agora };
  }

  const itemStats: Record<string, ItemStat> = {};
  for (const [k, v] of Object.entries(antigo.itemHistory ?? {})) {
    if (!v?.name) continue;
    itemStats[normalizeName(k)] = {
      name: String(v.name),
      category: String(v.category ?? ''),
      unit: String(v.unit ?? ''),
      lastPrice: numeroOuNulo(v.price),
      count: Number(v.count) || 1,
      lastUsed: Number(v.lastUsed) || agora
    };
  }

  out.profile = {
    uid: donoUid,
    aisleOrders,
    stores: Array.isArray(antigo.stores) ? antigo.stores : [],
    itemStats,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: agora
  };

  avisos.push(
    `Migrados: ${out.lists.length} listas, ${out.items.length} itens, ` +
    `${out.purchases.length} compras e ${out.prices.length} registros de preço.`
  );
  return out;
}

function numeroOuNulo(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return v == null || v === '' || isNaN(n) ? null : n;
}

function nomeExibivel(chave: string, antigo: EstadoV4): string {
  const h = antigo.itemHistory?.[chave];
  if (h?.name) return String(h.name);
  for (const l of antigo.lists ?? []) {
    for (const it of l?.items ?? []) {
      if (normalizeName(it?.name ?? '') === normalizeName(chave)) return String(it.name);
    }
  }
  return chave.charAt(0).toUpperCase() + chave.slice(1);
}

/** Grava o resultado no repositório. Idempotente por construção. */
export async function aplicarMigracao(
  repo: import('./repository').Repository,
  r: ResultadoMigracao
): Promise<void> {
  for (const l of r.lists) await repo.lists.createList(l);
  if (r.items.length) await repo.items.addItems(r.items);
  for (const p of r.purchases) await repo.purchases.addPurchase(p);
  if (r.prices.length) await repo.prices.addEntries(r.prices);
  if (r.profile.uid) {
    const atual = await repo.profiles.getProfile(r.profile.uid);
    const agora = Date.now();
    await repo.profiles.saveProfile({
      uid: r.profile.uid,
      displayName: atual?.displayName ?? '',
      email: atual?.email ?? null,
      aisleOrders: { ...(atual?.aisleOrders ?? {}), ...(r.profile.aisleOrders ?? {}) },
      stores: [...new Set([...(atual?.stores ?? []), ...(r.profile.stores ?? [])])],
      itemStats: { ...(atual?.itemStats ?? {}), ...(r.profile.itemStats ?? {}) },
      schemaVersion: SCHEMA_VERSION,
      createdAt: atual?.createdAt ?? agora,
      updatedAt: agora
    });
  }
}
