<script lang="ts">
  /**
   * Casca da aplicação. Monta o repositório, liga as assinaturas e delega.
   * Deliberadamente fino: as regras estão em src/lib/servicos.
   */
  import { onMount } from 'svelte';
  import { app } from './lib/stores/app.svelte';
  import { MemoryRepository } from './lib/data/MemoryRepository';
  import type { Repository } from './lib/data/repository';
  import type { Item } from './lib/domain/types';
  import Recibo from './lib/ui/Recibo.svelte';
  import EntradaRapida from './lib/ui/EntradaRapida.svelte';
  import {
    adicionarItens, alternarComprado, criarLista, moverItem
  } from './lib/servicos/listas';

  const repo: Repository = new MemoryRepository();
  let desassinarItens: (() => void) | null = null;

  onMount(() => {
    app.usuario = { uid: 'local', nome: 'Você', email: null };
    app.conectar(repo);
    if (!app.listas.length) {
      const l = criarLista(app.escopo.owner, 'Mercado');
      repo.lists.createList(l);
    }
    return () => { app.desconectar(); desassinarItens?.(); };
  });

  // Assina os itens da lista ativa e troca a assinatura quando ela muda.
  $effect(() => {
    const id = app.listaAtiva?.id ?? null;
    desassinarItens?.();
    desassinarItens = app.conectarItens(repo, id);
  });

  $effect(() => {
    document.documentElement.dataset.tema = app.tema === 'escuro' ? 'escuro' : 'claro';
  });

  const nomeDe = (uid: string | null): string => {
    if (!uid) return '';
    if (uid === app.usuario?.uid) return 'você';
    return app.casaAtual?.members[uid]?.name ?? 'alguém';
  };

  async function aoAdicionar(entradas: Parameters<typeof adicionarItens>[3]) {
    const lista = app.listaAtiva;
    if (!lista) return;
    await adicionarItens(repo, lista, app.itensDaAtiva, entradas, app.usuario?.uid ?? null);
  }

  const aoAlternar = (i: Item) => alternarComprado(repo, i, app.usuario?.uid ?? null);
  const aoRemover = (i: Item) => repo.items.deleteItem(i.listId, i.id);
  const aoMover = (i: Item, d: -1 | 1) =>
    moverItem(repo, i, app.itensDaAtiva.filter((x) => x.category === i.category), d);
</script>

<header>
  <h1><span class="ponto">●</span> Lista de Compras</h1>
  <div class="abas" role="tablist" aria-label="Listas">
    {#each app.listas as l (l.id)}
      <button role="tab" aria-selected={l.id === app.listaAtiva?.id}
        class:ativa={l.id === app.listaAtiva?.id}
        onclick={() => (app.listaAtivaId = l.id)}>{l.name}</button>
    {/each}
  </div>
</header>

<main>
  {#if app.listaAtiva}
    <Recibo
      lista={app.listaAtiva}
      itens={app.itensDaAtiva}
      ordens={app.perfil?.aisleOrders ?? {}}
      ocultarComprados={app.ocultarComprados}
      podeEditar={app.podeEditar}
      modoCompra={app.modoCompra}
      {nomeDe}
      onToggle={aoAlternar}
      onRemover={aoRemover}
      onMover={aoMover}
    />
    <div class="entrada-area">
      <EntradaRapida
        onAdicionar={aoAdicionar}
        conhecidos={app.perfil?.itemStats ?? {}}
        desabilitado={!app.podeEditar}
      />
    </div>
  {:else}
    <p class="vazio">Nenhuma lista ainda.</p>
  {/if}
</main>

<style>
  header {
    position: sticky; top: 0; z-index: var(--z-header);
    background: var(--paper); border-bottom: 1px solid var(--border);
    padding: var(--sp-3) var(--sp-4);
  }
  h1 {
    font-family: var(--font-mono); font-size: var(--fs-lg);
    letter-spacing: var(--tracking-stamp); margin: 0 0 var(--sp-2);
  }
  .ponto { color: var(--green); }
  .abas { display: flex; gap: var(--sp-2); overflow-x: auto; padding-bottom: 2px; }
  .abas button {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: var(--sp-2) var(--sp-3); border-radius: var(--r-pill);
    border: 1px solid var(--border); background: var(--card);
    color: var(--ink-light); white-space: nowrap; min-height: 36px;
  }
  .abas button.ativa { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  main { padding: var(--sp-4); }
  .entrada-area { max-width: 560px; margin: 0 auto; }
  .vazio { text-align: center; color: var(--ink-light); padding: var(--sp-6); }
</style>
