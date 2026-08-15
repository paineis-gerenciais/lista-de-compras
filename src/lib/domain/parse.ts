/**
 * Entrada rápida — bloco B1/B2 da Fase 3, portado para TypeScript.
 *
 * O objetivo é que colocar um item na lista custe um campo e um Enter.
 * "2kg tomate" precisa virar {qty:2, unit:kg, name:Tomate} sem que o usuário
 * pense em campos.
 */

import { normalizeName, titleCaseFirst, guessCategory } from './categorize';

export const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg', k: 'kg',
  g: 'g', grama: 'g', gramas: 'g', gr: 'g',
  l: 'L', litro: 'L', litros: 'L', lt: 'L',
  ml: 'ml',
  un: 'un', unidade: 'un', unidades: 'un', und: 'un', uni: 'un',
  pacote: 'pacote', pacotes: 'pacote', pct: 'pacote', pc: 'pacote',
  caixa: 'caixa', caixas: 'caixa', cx: 'caixa',
  dz: 'dz', duzia: 'dz', duzias: 'dz',
  lata: 'un', latas: 'un', garrafa: 'un', garrafas: 'un', pote: 'un', potes: 'un'
};

export const UNIDADES = ['', 'un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'dz'];

export interface ParsedItem {
  name: string;
  qty: string;
  unit: string;
  category: string;
}

function stripLeadingDe(s: string): string {
  return s.replace(/^de\s+/i, '');
}

/**
 * Pura e sem efeitos — é a função com mais testes do projeto, e por bom
 * motivo: cada formato aqui saiu de um jeito diferente de alguém digitar.
 */
export function parseQuickItem(raw: string): ParsedItem {
  let text = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const result: ParsedItem = { name: '', qty: '1', unit: '', category: '' };
  if (!text) return result;

  // categoria explícita ao fim: "queijo #Frios" ou "queijo (Frios)"
  const catMatch = text.match(/[#(]\s*([^)#]+?)\s*\)?$/);
  if (catMatch && catMatch[1] && catMatch[1].length <= 24) {
    result.category = titleCaseFirst(catMatch[1].trim());
    text = text.slice(0, catMatch.index).trim();
  }

  // "2x leite" — o x é multiplicador. Precisa vir ANTES do padrão de unidade,
  // senão o "x" é lido como unidade e o item vira "X leite" (bug real da v3).
  const xForm = text.match(/^(\d+(?:[.,]\d+)?)\s*x\s+(.+)$/i);
  if (xForm) {
    result.qty = String(parseFloat(xForm[1]!.replace(',', '.')));
    result.name = titleCaseFirst(stripLeadingDe(xForm[2]!));
    return result;
  }

  // "2kg tomate" / "2 kg tomate" / "500g queijo" / "3 leite"
  const lead = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zà-úÀ-Ú]*)\s+(.+)$/);
  if (lead) {
    const num = lead[1]!.replace(',', '.');
    const maybeUnit = normalizeName(lead[2] ?? '');
    const rest = lead[3]!;
    result.qty = String(parseFloat(num));
    if (maybeUnit && UNIT_ALIASES[maybeUnit]) {
      result.unit = UNIT_ALIASES[maybeUnit]!;
      result.name = titleCaseFirst(stripLeadingDe(rest));
    } else if (!maybeUnit) {
      result.name = titleCaseFirst(stripLeadingDe(rest));
    } else {
      result.name = titleCaseFirst(stripLeadingDe(`${lead[2]} ${rest}`));
    }
    return result;
  }

  // "tomate 2kg" — quantidade ao final
  const trail = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Zà-úÀ-Ú]*)$/);
  if (trail) {
    const maybeUnit = normalizeName(trail[3] ?? '');
    if (!maybeUnit || UNIT_ALIASES[maybeUnit]) {
      result.qty = String(parseFloat(trail[2]!.replace(',', '.')));
      result.unit = maybeUnit ? UNIT_ALIASES[maybeUnit]! : '';
      result.name = titleCaseFirst(trail[1]!);
      return result;
    }
  }

  result.name = titleCaseFirst(text);
  return result;
}

/** Entrada em lote: colar do WhatsApp, ditar uma sequência, etc. */
export function parseMultiline(text: string): ParsedItem[] {
  return String(text ?? '')
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linha) =>
      linha.replace(/^[-–—•*\u2022]\s*/, '').replace(/^\d+[.)]\s+/, '').trim()
    )
    .filter(Boolean)
    .map((limpa) => parseQuickItem(limpa))
    .filter((p) => !!p.name);
}

/** Aplica a categoria automática quando o usuário não informou uma. */
export function withCategory(
  p: ParsedItem,
  conhecidos?: Record<string, { category?: string }>
): ParsedItem {
  if (p.category) return p;
  return { ...p, category: guessCategory(p.name, conhecidos) };
}

/** Fala reconhecida: "arroz, feijão e café" → três linhas. */
export function speechToLines(text: string): string {
  return String(text ?? '').replace(/\s+e\s+/gi, '\n').replace(/,/g, '\n');
}
