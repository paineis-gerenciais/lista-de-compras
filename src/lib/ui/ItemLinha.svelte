<script lang="ts">
  import type { Item } from '../domain/types';
  import { formatPrice } from '../domain/prices';

  interface Props {
    item: Item;
    podeEditar?: boolean;
    modoCompra?: boolean;
    autor?: string;
    comprador?: string;
    atribuido?: string;
    primeiro?: boolean;
    ultimo?: boolean;
    onToggle: (i: Item) => void;
    onRemover?: (i: Item) => void;
    onEditar?: (i: Item) => void;
    onMover?: (i: Item, d: -1 | 1) => void;
  }

  let {
    item, podeEditar = true, modoCompra = false,
    comprador = '', atribuido = '',
    primeiro = false, ultimo = false,
    onToggle, onRemover, onEditar, onMover
  }: Props = $props();

  const qtd = $derived(item.unit ? `${item.qty} ${item.unit}` : item.qty);
</script>

<div class="linha" class:comprado={item.bought} class:grande={modoCompra}>
  <button
    class="check"
    aria-pressed={item.bought}
    aria-label="{item.bought ? 'Desmarcar' : 'Marcar como comprado'}: {item.name}"
    disabled={!podeEditar}
    onclick={() => onToggle(item)}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 12 9 18 20 6" />
    </svg>
  </button>

  <!-- No corredor, a linha inteira é o alvo: uma mão, sem mira. -->
  {#if modoCompra}
    <button class="area" onclick={() => onToggle(item)} disabled={!podeEditar}>
      <span class="nome">{item.name}</span>
      {#if atribuido}<span class="etiqueta">{atribuido} pega</span>{/if}
    </button>
  {:else}
    <div class="area estatica">
      <span class="nome">{item.name}</span>
      {#if item.price != null}<span class="preco">{formatPrice(item.price)}</span>{/if}
      {#if atribuido || (item.bought && comprador)}
        <span class="etiquetas">
          {#if atribuido}<span class="etiqueta">{atribuido} pega</span>{/if}
          {#if item.bought && comprador}<span class="etiqueta">{comprador} pegou</span>{/if}
        </span>
      {/if}
    </div>
  {/if}

  <span class="qtd">{qtd}</span>

  {#if podeEditar && !modoCompra}
    <!-- Alternativa acessível ao arrastar: funciona com teclado e leitor de tela. -->
    <span class="reordenar" role="group" aria-label="Reordenar {item.name}">
      <button aria-label="Mover {item.name} para cima" disabled={primeiro} onclick={() => onMover?.(item, -1)}>▲</button>
      <button aria-label="Mover {item.name} para baixo" disabled={ultimo} onclick={() => onMover?.(item, 1)}>▼</button>
    </span>
    <button class="acao" aria-label="Editar {item.name}" onclick={() => onEditar?.(item)}>✎</button>
    <button class="acao remover" aria-label="Remover {item.name}" onclick={() => onRemover?.(item)}>&times;</button>
  {/if}
</div>

<style>
  .linha {
    display: flex; align-items: flex-start; gap: var(--sp-2);
    padding: var(--sp-2) 0; border-bottom: 1px dotted var(--border);
  }
  .linha:last-child { border-bottom: none; }
  .linha.grande { align-items: center; padding: 13px 0; }

  .check {
    width: 26px; height: 26px; min-width: 26px; min-height: 26px;
    border: 1.5px solid var(--border); border-radius: var(--r-sm);
    background: transparent; display: flex; align-items: center; justify-content: center;
    color: transparent; flex-shrink: 0; transition: all var(--dur-fast);
  }
  .grande .check { width: 30px; height: 30px; border-radius: 7px; }
  .check svg { width: 15px; height: 15px; }
  .grande .check svg { width: 19px; height: 19px; }
  .comprado .check { background: var(--green); border-color: var(--green); color: #fff; }
  .check:disabled { opacity: 0.4; }

  .area {
    flex: 1; min-width: 0; text-align: left; background: none; border: none; padding: 0;
    display: flex; flex-direction: column; gap: 2px;
  }
  .area.estatica { cursor: default; }

  .nome { font-size: var(--fs-md); word-break: break-word; }
  .grande .nome { font-size: 17px; }
  .comprado .nome { text-decoration: line-through; color: var(--ink-light); }

  .preco { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--green); }

  .etiquetas { display: flex; gap: var(--sp-1); flex-wrap: wrap; }
  .etiqueta {
    font-family: var(--font-mono); font-size: 10px; color: var(--ink-light);
    border: 1px solid var(--border); border-radius: var(--r-pill); padding: 1px 7px;
  }

  .qtd {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--ink-light); white-space: nowrap; flex-shrink: 0; padding-top: 2px;
  }
  .grande .qtd { font-size: var(--fs-md); }

  .reordenar { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
  .reordenar button {
    background: none; border: none; color: var(--ink-light);
    font-size: 10px; line-height: 1; padding: 3px 5px;
  }
  .reordenar button:disabled { opacity: 0.25; }

  .acao {
    background: none; border: none; color: var(--ink-light);
    min-width: 36px; min-height: 36px; flex-shrink: 0; font-size: var(--fs-md);
  }
  .acao.remover { font-size: var(--fs-lg); }
  .acao:hover { color: var(--ink); }
</style>
