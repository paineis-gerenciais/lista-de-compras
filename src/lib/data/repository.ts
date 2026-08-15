/**
 * Camada de repositório — bloco E.
 *
 * Nenhum componente de interface conhece o Firebase. Toda persistência passa
 * por estas interfaces, o que dá três coisas de graça:
 *
 *   1. testar a lógica de aplicação sem rede e sem emulador (ver
 *      MemoryRepository, usado nos testes);
 *   2. rodar o app inteiro sem conta, trocando a implementação por uma
 *      local — o "usar sem conta" deixa de ser um caso especial no meio do
 *      código de sincronização e vira uma escolha de implementação;
 *   3. trocar de backend no futuro sem tocar em um único .svelte.
 *
 * As assinaturas são deliberadamente granulares (`updateItem`, não
 * `saveEverything`): é isso que torna possível escrever um item sem
 * reescrever a lista, que era a limitação central do modelo monolítico.
 */

import type {
  Household, Invite, Item, OwnerRef, PriceEntry, Presence,
  Purchase, ShoppingList, UserProfile
} from '../domain/types';

/** Cancela uma inscrição em tempo real. */
export type Unsubscribe = () => void;

export interface ListRepository {
  watchLists(owner: OwnerRef, cb: (lists: ShoppingList[]) => void): Unsubscribe;
  getList(id: string): Promise<ShoppingList | null>;
  createList(list: ShoppingList): Promise<void>;
  updateList(id: string, patch: Partial<ShoppingList>): Promise<void>;
  deleteList(id: string): Promise<void>;
  /** Pendência 1: mover uma lista entre pessoal e família. */
  moveList(id: string, novoOwner: OwnerRef): Promise<void>;
}

export interface ItemRepository {
  watchItems(listId: string, cb: (items: Item[]) => void): Unsubscribe;
  getItems(listId: string): Promise<Item[]>;
  addItem(item: Item): Promise<void>;
  addItems(items: Item[]): Promise<void>;
  updateItem(listId: string, itemId: string, patch: Partial<Item>): Promise<void>;
  deleteItem(listId: string, itemId: string): Promise<void>;
  /** Usado ao mover uma lista de escopo: os itens acompanham. */
  reassignItems(listId: string, novoListId: string): Promise<void>;
}

export interface PurchaseRepository {
  watchPurchases(owner: OwnerRef, cb: (p: Purchase[]) => void): Unsubscribe;
  addPurchase(p: Purchase): Promise<void>;
  deletePurchase(id: string): Promise<void>;
}

export interface PriceRepository {
  watchPrices(owner: OwnerRef, cb: (e: PriceEntry[]) => void): Unsubscribe;
  addEntries(entries: PriceEntry[]): Promise<void>;
  /** Poda registros antigos demais para não inflar a coleção. */
  prune(owner: OwnerRef, anteriorA: number): Promise<number>;
}

export interface ProfileRepository {
  watchProfile(uid: string, cb: (p: UserProfile | null) => void): Unsubscribe;
  getProfile(uid: string): Promise<UserProfile | null>;
  saveProfile(p: UserProfile): Promise<void>;
  updateProfile(uid: string, patch: Partial<UserProfile>): Promise<void>;
}

export interface HouseholdRepository {
  watchMyHouseholds(uid: string, cb: (h: Household[]) => void): Unsubscribe;
  watchHousehold(hid: string, cb: (h: Household | null) => void): Unsubscribe;
  createHousehold(h: Household): Promise<void>;
  updateHousehold(hid: string, patch: Partial<Household>): Promise<void>;
  deleteHousehold(hid: string): Promise<void>;
  setMemberRole(hid: string, uid: string, role: Household['members'][string]['role']): Promise<void>;
  removeMember(hid: string, uid: string): Promise<void>;

  createInvite(inv: Invite): Promise<void>;
  getInvite(code: string): Promise<Invite | null>;
  /** Pendência 3: revogar um convite já emitido. */
  revokeInvite(code: string): Promise<void>;
  listInvites(hid: string): Promise<Invite[]>;
  joinByInvite(code: string, uid: string, nome: string): Promise<{ ok: true; household: Household } | { ok: false; erro: string }>;

  watchPresence(hid: string, cb: (p: Presence[]) => void): Unsubscribe;
  heartbeat(hid: string, p: Presence): Promise<void>;
}

/** Fachada única, para a interface receber uma dependência só. */
export interface Repository {
  lists: ListRepository;
  items: ItemRepository;
  purchases: PurchaseRepository;
  prices: PriceRepository;
  profiles: ProfileRepository;
  households: HouseholdRepository;
  /** Verdadeiro quando há backend remoto; falso no modo sem conta. */
  readonly remoto: boolean;
}
