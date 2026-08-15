/**
 * Modelo de dados — Fase 4, bloco F.
 *
 * O que muda em relação à v4: o estado deixa de ser um documento único por
 * usuário. Cada lista é um documento, cada item é um documento dentro dela.
 *
 * Por que isso importa, mesmo com o merge por item funcionando desde a
 * Fase 3: o merge resolve a *perda* de dados, não o custo. No modelo
 * monolítico toda mudança remota trafega o estado inteiro, o histórico faz
 * o documento crescer sem teto, e o limite de 1 MiB por documento do
 * Firestore é uma parede real para uma família ativa depois de alguns meses.
 *
 * Coleções:
 *   users/{uid}
 *   households/{hid}
 *   lists/{listId}
 *   lists/{listId}/items/{itemId}
 *   purchases/{purchaseId}
 *   priceEntries/{entryId}
 */

/** Quem é o dono de uma lista: uma pessoa ou uma família. */
export type OwnerRef =
  | { kind: 'user'; id: string }
  | { kind: 'household'; id: string };

export function ownerKey(o: OwnerRef): string {
  return `${o.kind}:${o.id}`;
}

export function sameOwner(a: OwnerRef, b: OwnerRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export type Role = 'owner' | 'editor' | 'viewer';

export interface Member {
  role: Role;
  name: string;
  joinedAt: number;
  inviteCode?: string;
}

export interface Household {
  id: string;
  name: string;
  ownerUid: string;
  memberUids: string[];
  members: Record<string, Member>;
  createdAt: number;
  updatedAt: number;
}

export interface Recurrence {
  enabled: boolean;
  frequencyDays: number;
}

export interface ListLocation {
  type: 'auto' | 'address';
  value?: string;
}

/**
 * Documento de lista. Note que `items` NÃO está aqui: eles vivem numa
 * subcoleção. É essa separação que permite escrever um item sem reescrever
 * a lista inteira.
 */
export interface ShoppingList {
  id: string;
  owner: OwnerRef;
  name: string;
  baseName: string;
  recurring: Recurrence;
  location: ListLocation | null;
  /** Ordem manual das categorias nesta lista; vazio = usa a do mercado. */
  categoryOrder: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  qty: string;
  unit: string;
  category: string;
  price: number | null;
  bought: boolean;
  /** Posição manual. Números esparsos evitam reescrever vizinhos ao mover. */
  position: number;
  addedBy: string | null;
  boughtBy: string | null;
  assignedTo: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

/** Compra finalizada: retrato imutável, não uma lista viva. */
export interface Purchase {
  id: string;
  owner: OwnerRef;
  listName: string;
  items: PurchaseItem[];
  store: string | null;
  actualTotal: number | null;
  estimatedTotal: number;
  finishedAt: number;
  finishedBy: string | null;
  recurring: boolean;
}

export interface PurchaseItem {
  name: string;
  qty: string;
  unit: string;
  category: string;
  price: number | null;
  bought: boolean;
  boughtBy: string | null;
}

/** Um preço pago, uma vez, num mercado. Fato do passado — nunca é editado. */
export interface PriceEntry {
  id: string;
  owner: OwnerRef;
  /** Nome normalizado do produto; é a chave de agrupamento. */
  key: string;
  displayName: string;
  store: string | null;
  unitPrice: number;
  unit: string;
  qty: string;
  date: number;
  source: 'manual' | 'ocr';
  purchaseId: string | null;
}

export interface AisleOrder {
  /** "__default__" ou "loja:<nome normalizado>" */
  key: string;
  order: string[];
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  aisleOrders: Record<string, AisleOrder>;
  stores: string[];
  /** Frequência de uso por produto, para sugestões de recompra. */
  itemStats: Record<string, ItemStat>;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface ItemStat {
  name: string;
  category: string;
  unit: string;
  lastPrice: number | null;
  count: number;
  lastUsed: number;
}

export interface Invite {
  code: string;
  householdId: string;
  role: Exclude<Role, 'owner'>;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number | null;
}

export interface Presence {
  uid: string;
  name: string;
  lastSeen: number;
  shopping: boolean;
}

export const SCHEMA_VERSION = 4;

/** Espaçamento das posições: permite inserir entre dois itens sem renumerar. */
export const POSITION_STEP = 1000;
