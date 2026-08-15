/**
 * Papéis (bloco G). A interface esconde o que o papel não permite, e as
 * regras do Firestore recusam de qualquer forma — a checagem no cliente é
 * conveniência, não segurança.
 */

import type { Household, Role, OwnerRef } from './types';

export function papelNa(household: Household | null, uid: string | null): Role {
  if (!household || !uid) return 'viewer';
  return household.members[uid]?.role ?? 'viewer';
}

export function podeEditar(owner: OwnerRef, household: Household | null, uid: string | null): boolean {
  if (owner.kind === 'user') return owner.id === uid;
  const papel = papelNa(household, uid);
  return papel === 'owner' || papel === 'editor';
}

export function ehResponsavel(household: Household | null, uid: string | null): boolean {
  return papelNa(household, uid) === 'owner';
}

export function papelPorExtenso(role: Role): string {
  return ({ owner: 'responsável', editor: 'editor', viewer: 'só leitura' } as const)[role] ?? role;
}

export function iniciais(nome: string): string {
  const partes = String(nome ?? '?').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

const PALETA = ['#3F6B4A','#B5651D','#5B6E8C','#8C5B6E','#6E8C5B','#8C7A5B','#5B8C86','#7A5B8C'];

/** Cor derivada do id: estável entre aparelhos, sem precisar guardar nada. */
export function corDe(id: string): string {
  let h = 0;
  for (const c of String(id ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length]!;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I

export function gerarCodigoConvite(rnd: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALFABETO[Math.floor(rnd() * ALFABETO.length)];
  return out;
}

export function conviteValido(inv: { expiresAt: number; revokedAt?: number | null } | null, agora = Date.now()): boolean {
  if (!inv) return false;
  if (inv.revokedAt != null) return false;
  return inv.expiresAt > agora;
}
