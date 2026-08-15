<script lang="ts">
  /**
   * Entrada rápida (B1/B2/B3). O gargalo do produto inteiro: se colocar um
   * item na lista custa mais que um campo e um Enter, o app é abandonado.
   */
  import { parseQuickItem, parseMultiline, withCategory, speechToLines } from '../domain/parse';
  import { guessCategory } from '../domain/categorize';
  import type { ParsedItem } from '../domain/parse';

  interface Props {
    onAdicionar: (itens: ParsedItem[]) => void;
    conhecidos?: Record<string, { category?: string }>;
    desabilitado?: boolean;
  }
  let { onAdicionar, conhecidos = {}, desabilitado = false }: Props = $props();

  let texto = $state('');
  let gravando = $state(false);
  let campo: HTMLInputElement | undefined = $state();

  const previa = $derived.by(() => {
    const t = texto.trim();
    if (!t || t.includes('\n')) return '';
    const p = parseQuickItem(t);
    const cat = p.category || guessCategory(p.name, conhecidos);
    return `→ ${p.qty}${p.unit ? ' ' + p.unit : 'x'} ${p.name}${cat ? ' · ' + cat : ''}`;
  });

  const temVoz = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function enviar(): void {
    const t = texto.trim();
    if (!t) return;
    const itens = parseMultiline(t).map((p) => withCategory(p, conhecidos));
    if (itens.length) onAdicionar(itens);
    texto = '';
    campo?.focus();
  }

  function aoColar(e: ClipboardEvent): void {
    const t = e.clipboardData?.getData('text') ?? '';
    if (!t.includes('\n')) return;
    e.preventDefault();
    const itens = parseMultiline(t).map((p) => withCategory(p, conhecidos));
    if (itens.length) onAdicionar(itens);
    texto = '';
  }

  function ditar(): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    gravando = true;
    rec.onresult = (ev: any) => {
      const fala = Array.from(ev.results).map((r: any) => r[0].transcript).join(' ');
      const itens = parseMultiline(speechToLines(fala)).map((p) => withCategory(p, conhecidos));
      if (itens.length) onAdicionar(itens);
      else texto = fala;
    };
    rec.onend = () => { gravando = false; };
    rec.onerror = () => { gravando = false; };
    rec.start();
  }
</script>

<div class="entrada">
  <div class="campos">
    <input
      bind:this={campo}
      bind:value={texto}
      type="text"
      placeholder="2kg tomate"
      aria-label="Adicionar item rapidamente"
      autocomplete="off"
      enterkeyhint="done"
      disabled={desabilitado}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }}
      onpaste={aoColar}
    />
    {#if temVoz}
      <button class="icone" class:gravando aria-label={gravando ? 'Parar de ditar' : 'Ditar itens por voz'}
        disabled={desabilitado} onclick={ditar}>🎤</button>
    {/if}
    <button class="icone principal" aria-label="Adicionar item" disabled={desabilitado} onclick={enviar}>+</button>
  </div>
  <p class="previa" aria-live="polite">{previa}</p>
  <p class="dica">
    Quantidade, unidade e nome juntos — <strong>2kg tomate</strong>, <strong>3 leite</strong>.
    Várias linhas de uma vez também funcionam.
  </p>
</div>

<style>
  .entrada { border-top: 1px dashed var(--border); padding-top: var(--sp-3); margin-top: var(--sp-2); }
  .campos { display: flex; gap: var(--sp-2); align-items: center; }
  input {
    flex: 1; min-width: 0; font-size: 15px; padding: 11px var(--sp-3);
    border: 1px solid var(--border); border-radius: var(--r-md);
    background: var(--paper); color: var(--ink);
  }
  .icone {
    width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--r-md);
    border: 1px solid var(--border); background: var(--card);
    display: flex; align-items: center; justify-content: center; font-size: 17px;
  }
  .icone.principal { background: var(--green); color: #fff; border-color: var(--green); font-weight: 700; }
  .icone.gravando { background: var(--red); color: #fff; border-color: var(--red); }
  .icone:disabled { opacity: 0.5; }
  .previa {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--green); margin: var(--sp-1) 0 0; min-height: 16px;
  }
  .dica { font-size: var(--fs-xs); color: var(--ink-light); margin: var(--sp-1) 0 0; line-height: 1.45; }
</style>
