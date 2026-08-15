/**
 * Estado da aplicação com runes do Svelte 5.
 *
 * Diferença conceitual em relação à v4: aqui não existe `render()`. O estado
 * é reativo, e a interface se atualiza sozinha nos pontos que dependem do que
 * mudou. É isso que resolve a pendência 5 (scroll e foco perdidos) de forma
 * estrutural em vez de por remendo — os nós do DOM não são recriados.
 */

import type {
  Household, Item, OwnerRef, PriceEntry, Presence, Purchase, ShoppingList, UserProfile
} from '../domain/types';
import type { Repository, Unsubscribe } from '../data/repository';
import { podeEditar } from '../domain/roles';

export interface Escopo {
  owner: OwnerRef;
  nome: string;
}

class AppState {
  usuario = $state<{ uid: string; nome: string; email: string | null } | null>(null);
  escopo = $state<Escopo>({ owner: { kind: 'user', id: 'local' }, nome: 'Minhas listas' });

  listas = $state<ShoppingList[]>([]);
  itens = $state<Item[]>([]);
  compras = $state<Purchase[]>([]);
  precos = $state<PriceEntry[]>([]);
  perfil = $state<UserProfile | null>(null);
  casas = $state<Household[]>([]);
  casaAtual = $state<Household | null>(null);
  presenca = $state<Presence[]>([]);

  listaAtivaId = $state<string | null>(null);
  modoCompra = $state(false);
  ocultarComprados = $state(false);
  tema = $state<'claro' | 'escuro'>('claro');
  sincronizacao = $state<'local' | 'sincronizando' | 'salvo' | 'offline' | 'erro'>('local');

  listaAtiva = $derived(this.listas.find((l) => l.id === this.listaAtivaId) ?? this.listas[0] ?? null);
  itensDaAtiva = $derived(this.itens.filter((i) => i.listId === this.listaAtiva?.id));
  podeEditar = $derived(podeEditar(this.escopo.owner, this.casaAtual, this.usuario?.uid ?? 'local'));
  online = $derived(this.presenca.filter((p) => Date.now() - p.lastSeen < 90_000));

  private assinaturas: Unsubscribe[] = [];

  /** Reassina tudo ao trocar de escopo. Um lugar só, para não vazar listener. */
  conectar(repo: Repository): void {
    this.desconectar();
    const owner = this.escopo.owner;
    this.assinaturas.push(
      repo.lists.watchLists(owner, (l) => {
        this.listas = l;
        if (!this.listas.find((x) => x.id === this.listaAtivaId)) {
          this.listaAtivaId = this.listas[0]?.id ?? null;
        }
      }),
      repo.purchases.watchPurchases(owner, (c) => { this.compras = c; }),
      repo.prices.watchPrices(owner, (p) => { this.precos = p; })
    );
    if (this.usuario) {
      this.assinaturas.push(
        repo.profiles.watchProfile(this.usuario.uid, (p) => { this.perfil = p; }),
        repo.households.watchMyHouseholds(this.usuario.uid, (h) => { this.casas = h; })
      );
    }
    if (owner.kind === 'household') {
      this.assinaturas.push(
        repo.households.watchHousehold(owner.id, (h) => { this.casaAtual = h; }),
        repo.households.watchPresence(owner.id, (p) => { this.presenca = p; })
      );
    } else {
      this.casaAtual = null;
      this.presenca = [];
    }
  }

  /** Os itens são assinados por lista, separadamente das listas. */
  conectarItens(repo: Repository, listId: string | null): Unsubscribe {
    if (!listId) return () => {};
    return repo.items.watchItems(listId, (itens) => {
      const outras = this.itens.filter((i) => i.listId !== listId);
      this.itens = [...outras, ...itens];
    });
  }

  desconectar(): void {
    for (const u of this.assinaturas) u();
    this.assinaturas = [];
  }
}

export const app = new AppState();
