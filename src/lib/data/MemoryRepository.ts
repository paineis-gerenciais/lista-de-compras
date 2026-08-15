/**
 * Implementação em memória do repositório.
 *
 * Serve a dois propósitos, e não por acaso: é o que os testes usam (rápido,
 * sem rede, sem emulador) e é a base do modo "usar sem conta", que
 * simplesmente persiste esta mesma estrutura no localStorage.
 *
 * Ter os testes rodando contra a mesma interface que a produção é o que
 * impede a camada de dados de virar mock-teatro.
 */

import type { Repository as Repo } from './repository';
import type {
  Household, Invite, Item, OwnerRef, PriceEntry, Presence,
  Purchase, ShoppingList, UserProfile
} from '../domain/types';
import { ownerKey, sameOwner } from '../domain/types';
import { conviteValido } from '../domain/roles';

type Ouvinte<T> = (v: T) => void;

class Canal<T> {
  private ouvintes = new Set<Ouvinte<T>>();
  inscrever(cb: Ouvinte<T>, valorInicial: T): () => void {
    this.ouvintes.add(cb);
    cb(valorInicial);
    return () => { this.ouvintes.delete(cb); };
  }
  emitir(v: T): void {
    for (const cb of this.ouvintes) cb(v);
  }
}

export interface EstadoMemoria {
  lists: ShoppingList[];
  items: Item[];
  purchases: Purchase[];
  prices: PriceEntry[];
  profiles: UserProfile[];
  households: Household[];
  invites: Invite[];
  presence: Record<string, Presence[]>;
}

export function estadoVazio(): EstadoMemoria {
  return { lists: [], items: [], purchases: [], prices: [], profiles: [], households: [], invites: [], presence: {} };
}

export class MemoryRepository implements Repo {
  readonly remoto = false;
  db: EstadoMemoria;

  private canalListas = new Map<string, Canal<ShoppingList[]>>();
  private canalItens = new Map<string, Canal<Item[]>>();
  private canalCompras = new Map<string, Canal<Purchase[]>>();
  private canalPrecos = new Map<string, Canal<PriceEntry[]>>();
  private canalPerfil = new Map<string, Canal<UserProfile | null>>();
  private canalCasas = new Map<string, Canal<Household[]>>();
  private canalCasa = new Map<string, Canal<Household | null>>();
  private canalPresenca = new Map<string, Canal<Presence[]>>();

  /** Permite ao chamador persistir o estado (é como o modo sem conta grava). */
  aoMudar: (db: EstadoMemoria) => void = () => {};

  constructor(inicial?: EstadoMemoria) {
    this.db = inicial ?? estadoVazio();
  }

  private canal<T>(mapa: Map<string, Canal<T>>, chave: string): Canal<T> {
    let c = mapa.get(chave);
    if (!c) { c = new Canal<T>(); mapa.set(chave, c); }
    return c;
  }

  private vivos<T extends { deletedAt?: number | null }>(arr: T[]): T[] {
    return arr.filter((r) => r.deletedAt == null);
  }

  private notificarListas(owner: OwnerRef): void {
    const k = ownerKey(owner);
    this.canal(this.canalListas, k).emitir(this.listasDe(owner));
    this.aoMudar(this.db);
  }
  private notificarItens(listId: string): void {
    this.canal(this.canalItens, listId).emitir(this.itensDe(listId));
    this.aoMudar(this.db);
  }

  private listasDe(owner: OwnerRef): ShoppingList[] {
    return this.vivos(this.db.lists.filter((l) => sameOwner(l.owner, owner)))
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  private itensDe(listId: string): Item[] {
    return this.vivos(this.db.items.filter((i) => i.listId === listId))
      .sort((a, b) => a.position - b.position);
  }

  // ---------------- listas ----------------
  lists = {
    watchLists: (owner: OwnerRef, cb: (l: ShoppingList[]) => void) =>
      this.canal(this.canalListas, ownerKey(owner)).inscrever(cb, this.listasDe(owner)),

    getList: async (id: string) => this.db.lists.find((l) => l.id === id) ?? null,

    createList: async (list: ShoppingList) => {
      this.db.lists.push(list);
      this.notificarListas(list.owner);
    },

    updateList: async (id: string, patch: Partial<ShoppingList>) => {
      const i = this.db.lists.findIndex((l) => l.id === id);
      if (i < 0) return;
      const antes = this.db.lists[i]!;
      this.db.lists[i] = { ...antes, ...patch, updatedAt: Date.now() };
      this.notificarListas(antes.owner);
      if (patch.owner && !sameOwner(patch.owner, antes.owner)) this.notificarListas(patch.owner);
    },

    deleteList: async (id: string) => {
      const l = this.db.lists.find((x) => x.id === id);
      if (!l) return;
      const ts = Date.now();
      l.deletedAt = ts; l.updatedAt = ts;
      for (const it of this.db.items) if (it.listId === id) { it.deletedAt = ts; it.updatedAt = ts; }
      this.notificarListas(l.owner);
      this.notificarItens(id);
    },

    /**
     * Pendência 1 — mover lista entre pessoal e família.
     * Como itens são identificados por `listId` e não pelo dono, mover a
     * lista basta: os itens acompanham sem serem tocados. Era exatamente
     * isso que o modelo monolítico impedia, e por isso a v4 só sabia
     * exportar e importar.
     */
    moveList: async (id: string, novoOwner: OwnerRef) => {
      const l = this.db.lists.find((x) => x.id === id);
      if (!l) return;
      const antigo = l.owner;
      l.owner = novoOwner;
      l.updatedAt = Date.now();
      this.notificarListas(antigo);
      this.notificarListas(novoOwner);
    }
  };

  // ---------------- itens ----------------
  items = {
    watchItems: (listId: string, cb: (i: Item[]) => void) =>
      this.canal(this.canalItens, listId).inscrever(cb, this.itensDe(listId)),

    getItems: async (listId: string) => this.itensDe(listId),

    addItem: async (item: Item) => {
      this.db.items.push(item);
      this.notificarItens(item.listId);
    },

    addItems: async (items: Item[]) => {
      if (!items.length) return;
      this.db.items.push(...items);
      this.notificarItens(items[0]!.listId);
    },

    updateItem: async (listId: string, itemId: string, patch: Partial<Item>) => {
      const i = this.db.items.findIndex((x) => x.id === itemId && x.listId === listId);
      if (i < 0) return;
      this.db.items[i] = { ...this.db.items[i]!, ...patch, updatedAt: Date.now() };
      this.notificarItens(listId);
    },

    deleteItem: async (listId: string, itemId: string) => {
      const it = this.db.items.find((x) => x.id === itemId && x.listId === listId);
      if (!it) return;
      it.deletedAt = Date.now(); it.updatedAt = it.deletedAt;
      this.notificarItens(listId);
    },

    reassignItems: async (listId: string, novoListId: string) => {
      for (const it of this.db.items) {
        if (it.listId === listId) { it.listId = novoListId; it.updatedAt = Date.now(); }
      }
      this.notificarItens(listId);
      this.notificarItens(novoListId);
    }
  };

  // ---------------- compras ----------------
  purchases = {
    watchPurchases: (owner: OwnerRef, cb: (p: Purchase[]) => void) =>
      this.canal(this.canalCompras, ownerKey(owner)).inscrever(cb, this.comprasDe(owner)),

    addPurchase: async (p: Purchase) => {
      this.db.purchases.push(p);
      this.canal(this.canalCompras, ownerKey(p.owner)).emitir(this.comprasDe(p.owner));
      this.aoMudar(this.db);
    },

    deletePurchase: async (id: string) => {
      const p = this.db.purchases.find((x) => x.id === id);
      this.db.purchases = this.db.purchases.filter((x) => x.id !== id);
      if (p) this.canal(this.canalCompras, ownerKey(p.owner)).emitir(this.comprasDe(p.owner));
      this.aoMudar(this.db);
    }
  };

  private comprasDe(owner: OwnerRef): Purchase[] {
    return this.db.purchases.filter((p) => sameOwner(p.owner, owner))
      .sort((a, b) => b.finishedAt - a.finishedAt);
  }

  // ---------------- preços ----------------
  prices = {
    watchPrices: (owner: OwnerRef, cb: (e: PriceEntry[]) => void) =>
      this.canal(this.canalPrecos, ownerKey(owner)).inscrever(cb, this.precosDe(owner)),

    addEntries: async (entries: PriceEntry[]) => {
      if (!entries.length) return;
      this.db.prices.push(...entries);
      const owner = entries[0]!.owner;
      this.canal(this.canalPrecos, ownerKey(owner)).emitir(this.precosDe(owner));
      this.aoMudar(this.db);
    },

    prune: async (owner: OwnerRef, anteriorA: number) => {
      const antes = this.db.prices.length;
      this.db.prices = this.db.prices.filter((e) => !(sameOwner(e.owner, owner) && e.date < anteriorA));
      const removidos = antes - this.db.prices.length;
      if (removidos) {
        this.canal(this.canalPrecos, ownerKey(owner)).emitir(this.precosDe(owner));
        this.aoMudar(this.db);
      }
      return removidos;
    }
  };

  private precosDe(owner: OwnerRef): PriceEntry[] {
    return this.db.prices.filter((e) => sameOwner(e.owner, owner)).sort((a, b) => b.date - a.date);
  }

  // ---------------- perfil ----------------
  profiles = {
    watchProfile: (uid: string, cb: (p: UserProfile | null) => void) =>
      this.canal(this.canalPerfil, uid).inscrever(cb, this.db.profiles.find((p) => p.uid === uid) ?? null),

    getProfile: async (uid: string) => this.db.profiles.find((p) => p.uid === uid) ?? null,

    saveProfile: async (p: UserProfile) => {
      const i = this.db.profiles.findIndex((x) => x.uid === p.uid);
      if (i < 0) this.db.profiles.push(p); else this.db.profiles[i] = p;
      this.canal(this.canalPerfil, p.uid).emitir(p);
      this.aoMudar(this.db);
    },

    updateProfile: async (uid: string, patch: Partial<UserProfile>) => {
      const i = this.db.profiles.findIndex((x) => x.uid === uid);
      if (i < 0) return;
      this.db.profiles[i] = { ...this.db.profiles[i]!, ...patch, updatedAt: Date.now() };
      this.canal(this.canalPerfil, uid).emitir(this.db.profiles[i]!);
      this.aoMudar(this.db);
    }
  };

  // ---------------- famílias ----------------
  households = {
    watchMyHouseholds: (uid: string, cb: (h: Household[]) => void) =>
      this.canal(this.canalCasas, uid).inscrever(cb, this.casasDe(uid)),

    watchHousehold: (hid: string, cb: (h: Household | null) => void) =>
      this.canal(this.canalCasa, hid).inscrever(cb, this.db.households.find((h) => h.id === hid) ?? null),

    createHousehold: async (h: Household) => {
      this.db.households.push(h);
      this.notificarCasa(h.id);
      this.aoMudar(this.db);
    },

    updateHousehold: async (hid: string, patch: Partial<Household>) => {
      const i = this.db.households.findIndex((h) => h.id === hid);
      if (i < 0) return;
      this.db.households[i] = { ...this.db.households[i]!, ...patch, updatedAt: Date.now() };
      this.notificarCasa(hid);
      this.aoMudar(this.db);
    },

    deleteHousehold: async (hid: string) => {
      const h = this.db.households.find((x) => x.id === hid);
      this.db.households = this.db.households.filter((x) => x.id !== hid);
      this.canal(this.canalCasa, hid).emitir(null);
      for (const uid of h?.memberUids ?? []) this.canal(this.canalCasas, uid).emitir(this.casasDe(uid));
      this.aoMudar(this.db);
    },

    setMemberRole: async (hid: string, uid: string, role: Household['members'][string]['role']) => {
      const h = this.db.households.find((x) => x.id === hid);
      const m = h?.members[uid];
      if (!h || !m) return;
      h.members = { ...h.members, [uid]: { ...m, role } };
      h.updatedAt = Date.now();
      this.notificarCasa(hid);
      this.aoMudar(this.db);
    },

    removeMember: async (hid: string, uid: string) => {
      const h = this.db.households.find((x) => x.id === hid);
      if (!h) return;
      const { [uid]: _fora, ...resto } = h.members;
      h.members = resto;
      h.memberUids = h.memberUids.filter((u) => u !== uid);
      h.updatedAt = Date.now();
      this.notificarCasa(hid);
      this.canal(this.canalCasas, uid).emitir(this.casasDe(uid));
      this.aoMudar(this.db);
    },

    createInvite: async (inv: Invite) => {
      this.db.invites.push(inv);
      this.aoMudar(this.db);
    },

    getInvite: async (code: string) =>
      this.db.invites.find((i) => i.code === code.toUpperCase()) ?? null,

    /** Pendência 3 — revogar convite. Marca em vez de apagar, para que quem
     *  tentar usar receba "não é mais válido" em vez de "não existe". */
    revokeInvite: async (code: string) => {
      const inv = this.db.invites.find((i) => i.code === code.toUpperCase());
      if (!inv) return;
      inv.revokedAt = Date.now();
      this.aoMudar(this.db);
    },

    listInvites: async (hid: string) =>
      this.db.invites.filter((i) => i.householdId === hid).sort((a, b) => b.createdAt - a.createdAt),

    joinByInvite: async (code: string, uid: string, nome: string) => {
      const inv = this.db.invites.find((i) => i.code === code.trim().toUpperCase());
      if (!inv) return { ok: false as const, erro: 'Convite não encontrado. Confira o código.' };
      if (inv.revokedAt != null) return { ok: false as const, erro: 'Este convite foi cancelado.' };
      if (!conviteValido(inv)) return { ok: false as const, erro: 'Este convite expirou. Peça um novo.' };
      const h = this.db.households.find((x) => x.id === inv.householdId);
      if (!h) return { ok: false as const, erro: 'Esta família não existe mais.' };
      if (!h.memberUids.includes(uid)) {
        h.memberUids = [...h.memberUids, uid];
        h.members = { ...h.members, [uid]: { role: inv.role, name: nome, joinedAt: Date.now(), inviteCode: inv.code } };
        h.updatedAt = Date.now();
        this.notificarCasa(h.id);
      }
      this.aoMudar(this.db);
      return { ok: true as const, household: h };
    },

    watchPresence: (hid: string, cb: (p: Presence[]) => void) =>
      this.canal(this.canalPresenca, hid).inscrever(cb, this.db.presence[hid] ?? []),

    heartbeat: async (hid: string, p: Presence) => {
      const atual = this.db.presence[hid] ?? [];
      this.db.presence[hid] = [...atual.filter((x) => x.uid !== p.uid), p];
      this.canal(this.canalPresenca, hid).emitir(this.db.presence[hid]!);
    }
  };

  private notificarCasa(hid: string): void {
    const h = this.db.households.find((x) => x.id === hid) ?? null;
    this.canal(this.canalCasa, hid).emitir(h);
    for (const uid of h?.memberUids ?? []) this.canal(this.canalCasas, uid).emitir(this.casasDe(uid));
  }

  private casasDe(uid: string): Household[] {
    return this.db.households.filter((h) => h.memberUids.includes(uid));
  }
}

export type { Repo as Repository };
