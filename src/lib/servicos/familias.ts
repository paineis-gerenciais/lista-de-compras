/**
 * Casos de uso de colaboração (bloco G) sobre o modelo granular.
 */

import type { Household, Invite, Role } from '../domain/types';
import type { Repository } from '../data/repository';
import { gerarCodigoConvite, conviteValido } from '../domain/roles';
import { uid } from '../domain/items';

export async function criarFamilia(
  repo: Repository, nome: string, donoUid: string, donoNome: string
): Promise<Household> {
  const agora = Date.now();
  const h: Household = {
    id: uid(), name: nome, ownerUid: donoUid,
    memberUids: [donoUid],
    members: { [donoUid]: { role: 'owner', name: donoNome, joinedAt: agora } },
    createdAt: agora, updatedAt: agora
  };
  await repo.households.createHousehold(h);
  return h;
}

/**
 * O papel do convite é escolhido na criação — a v4 só sabia criar convite de
 * editor, o que obrigava a rebaixar a pessoa depois de ela já ter entrado
 * com permissão de escrita. Aqui dá para convidar direto como só leitura.
 */
export async function criarConvite(
  repo: Repository, householdId: string, criadoPor: string,
  papel: Exclude<Role, 'owner'> = 'editor', dias = 7
): Promise<Invite> {
  const agora = Date.now();
  const inv: Invite = {
    code: gerarCodigoConvite(),
    householdId, role: papel, createdBy: criadoPor,
    createdAt: agora, expiresAt: agora + dias * 86400000,
    revokedAt: null
  };
  await repo.households.createInvite(inv);
  return inv;
}

/**
 * PENDÊNCIA 3 — revogar um convite já emitido.
 *
 * Marca em vez de apagar, de propósito: quem tentar usar um convite revogado
 * recebe "este convite foi cancelado" em vez de "não existe". A diferença
 * importa quando alguém compartilhou o link no grupo errado e precisa saber
 * que o cancelamento funcionou.
 */
export async function revogarConvite(repo: Repository, code: string): Promise<void> {
  await repo.households.revokeInvite(code);
}

export interface ConviteVisivel extends Invite {
  ativo: boolean;
  situacao: 'ativo' | 'expirado' | 'cancelado';
}

export async function listarConvites(repo: Repository, householdId: string): Promise<ConviteVisivel[]> {
  const brutos = await repo.households.listInvites(householdId);
  return brutos.map((i) => ({
    ...i,
    ativo: conviteValido(i),
    situacao: i.revokedAt != null ? 'cancelado' : (i.expiresAt <= Date.now() ? 'expirado' : 'ativo')
  }));
}

export function linkDoConvite(code: string, base: string): string {
  return `${base}?convite=${code}`;
}

export async function entrarComConvite(
  repo: Repository, code: string, uidUsuario: string, nome: string
) {
  return repo.households.joinByInvite(code, uidUsuario, nome);
}

export async function sairDaFamilia(
  repo: Repository, h: Household, uidUsuario: string
): Promise<void> {
  const sozinho = h.memberUids.length === 1 && h.ownerUid === uidUsuario;
  if (sozinho) await repo.households.deleteHousehold(h.id);
  else await repo.households.removeMember(h.id, uidUsuario);
}
