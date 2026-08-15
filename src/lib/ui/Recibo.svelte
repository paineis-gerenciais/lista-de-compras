<script lang="ts">
  /**
   * O recibo — o componente central da identidade visual.
   * Recebe dados por props e emite intenções por callback: não conhece o
   * repositório, o que o torna testável e reaproveitável no modo compra.
   */
  import type { Item, ShoppingList, AisleOrder } from '../domain/types';
  import { agruparPorCategoria, totalEstimado } from '../domain/items';
  import { ordenarCategorias } from '../domain/aisles';
  import { formatPrice } from '../domain/prices';
  import ItemLinha from './ItemLinha.svelte';

  interface Props {
    lista: ShoppingList;
    itens: Item[];
    ordens?: Record<string, AisleOrder>;
    ocultarComprados?: boolean;
    podeEditar?: boolean;
    modoCompra?: boolean;
    nomeDe?: (uid: string | null) => string;
    onToggle: (item: Item) => void;
    onRemover?: (item: Item) => void;
    onEditar?: (item: Item) => void;
    onMover?: (item: Item, direcao: -1 | 1) => void;
  }

  let {
    lista, itens, ordens = {}, ocultarComprados = false, podeEditar = true,
    modoCompra = false, nomeDe = () => '', onToggle, onRemover, onEditar, onMover
  }: Props = $props();

  const visiveis = $derived(ocultarComprados ? itens.filter((i) => !i.bought) : itens);
  const grupos = $derived(agruparPorCategoria(visiveis));
  const categorias = $derived(ordenarCategorias(Object.keys(grupos), ordens, lista));
  const comprados = $derived(itens.filter((i) => i.bought).length);
  const estimado = $derived(totalEstimado(itens));
  const progresso = $derived(itens.length ? Math.round((comprados / itens.length) * 100) : 0);
</script>

<article class="recibo" class:compacto={modoCompra}>
  <div class="serrilha-topo" aria-hidden="true"></div>
  <div class="corpo">
    {#if !modoCompra}
      <header class="cabeca">
        <h2>{lista.name}</h2>
        <p class="meta">
          {new Date(lista.createdAt).toLocaleDateString('pt-BR')}
          {#if lista.recurring.enabled}· repete a cada {lista.recurring.frequencyDays} dias{/if}
          {#if lista.location?.value}· {lista.location.value}{/if}
        </p>
      </header>
    {/if}

    <div class="progresso">
      <div class="trilho"><div class="preenchido" style:width="{progresso}%"></div></div>
      <span class="rotulo">{comprados} de {itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
    </div>

    {#if estimado > 0 && !modoCompra}
      <p class="total">Total estimado: <strong>{formatPrice(estimado)}</strong></p>
    {/if}

    {#if itens.length === 0}
      <p class="vazio">Sua lista está vazia. Adicione itens abaixo.</p>
    {:else if visiveis.length === 0}
      <p class="vazio">Tudo pego! {itens.length} {itens.length === 1 ? 'item comprado' : 'itens comprados'}.</p>
    {:else}
      {#each categorias as cat (cat)}
        <section class="grupo">
          <h3>{cat === '' ? 'Sem categoria' : cat}</h3>
          {#each grupos[cat] ?? [] as item, i (item.id)}
            <ItemLinha
              {item}
              {podeEditar}
              {modoCompra}
              autor={nomeDe(item.addedBy)}
              comprador={nomeDe(item.boughtBy)}
              atribuido={nomeDe(item.assignedTo)}
              primeiro={i === 0}
              ultimo={i === (grupos[cat]?.length ?? 1) - 1}
              {onToggle} {onRemover} {onEditar} {onMover}
            />
          {/each}
        </section>
      {/each}
    {/if}
  </div>
  <div class="serrilha-base" aria-hidden="true"></div>
</article>

<style>
  .recibo {
    max-width: 560px;
    margin: 0 auto var(--sp-4);
    filter: drop-shadow(0 8px 20px var(--shadow));
  }
  .corpo {
    background: var(--card);
    padding: var(--sp-4) var(--sp-4) var(--sp-5);
  }
  .compacto .corpo { padding-top: var(--sp-2); }

  .cabeca { text-align: center; border-bottom: 1px dashed var(--border); padding-bottom: var(--sp-3); }
  .cabeca h2 {
    font-family: var(--font-mono);
    font-size: var(--fs-lg);
    text-transform: uppercase;
    letter-spacing: var(--tracking-stamp);
    margin: 0 0 var(--sp-1);
  }
  .meta { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--ink-light); margin: 0; }

  .progresso { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) 0; }
  .trilho { flex: 1; height: 8px; background: var(--border); border-radius: var(--r-pill); overflow: hidden; }
  .preenchido { height: 100%; background: var(--green); transition: width var(--dur-base); }
  .rotulo { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--ink-light); white-space: nowrap; }

  .total {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    text-align: right; margin: 0 0 var(--sp-2); color: var(--ink-light);
  }
  .total strong { color: var(--ink); }

  .vazio { color: var(--ink-light); font-size: var(--fs-sm); padding: var(--sp-4) 0; text-align: center; }

  /* Corta o custo de layout em listas longas sem tocar na lógica. */
  .grupo { content-visibility: auto; contain-intrinsic-size: auto 220px; margin-top: var(--sp-3); }
  .grupo h3 {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    text-transform: uppercase; letter-spacing: var(--tracking-stamp);
    color: var(--ink-light); margin: 0 0 var(--sp-1);
    border-bottom: 1px dashed var(--border); padding-bottom: var(--sp-1);
  }
</style>
