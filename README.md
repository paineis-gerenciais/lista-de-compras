# Lista de Compras — v5

PWA de lista de compras com sincronização entre aparelhos, listas
compartilhadas em família, modo compra e histórico de preços.

**Esta é a reescrita da Fase 4 (blocos E e F):** Svelte 5 + TypeScript,
camada de repositório e modelo de dados granular.

> **Estado:** arquitetura e telas principais prontas e testadas. Vários
> modais ainda não foram portados da v4 — ver a lista no fim do
> `DEPLOY-V5.md`. A v4 continua sendo o app em produção até que o porte
> termine.

---

## Rodar

```bash
npm install
npm run dev          # servidor de desenvolvimento
npm run verificar    # tipos + testes + build
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite em modo desenvolvimento |
| `npm run check` | `svelte-check` com TypeScript estrito |
| `npm run test` | 89 testes (Vitest) |
| `npm run build` | gera `dist/` |

---

## Arquitetura

```
src/
├── app.css                  design system "Cupom" (tokens)
├── main.ts
├── App.svelte
└── lib/
    ├── domain/              lógica pura, sem DOM e sem rede
    │   ├── types.ts         modelo de dados
    │   ├── parse.ts         entrada rápida ("2kg tomate")
    │   ├── categorize.ts    dicionário de ~300 produtos br-PT
    │   ├── items.ts         consolidação, posições, ordenação
    │   ├── merge.ts         reconciliação entre aparelhos
    │   ├── prices.ts        histórico e comparação de preços
    │   ├── aisles.ts        ordem dos corredores
    │   ├── recurrence.ts    listas recorrentes
    │   └── roles.ts         papéis e convites
    ├── data/                persistência
    │   ├── repository.ts    interfaces
    │   ├── MemoryRepository.ts
    │   └── migration.ts     v4 monolítico → v5 granular
    ├── servicos/            casos de uso
    ├── stores/              estado reativo (runes)
    └── ui/                  componentes
```

**A regra que sustenta tudo:** componente `.svelte` não chama repositório
direto, e nada em `domain/` conhece DOM ou rede. É o que permite testar 89
casos em 1 segundo, sem navegador e sem emulador.

### Modelo de dados

```
users/{uid}                      perfil, corredores, estatísticas
households/{hid}                 famílias e membros
lists/{listId}                   { owner: user|household, ... }
lists/{listId}/items/{itemId}    escrita granular
purchases/{purchaseId}           compras finalizadas (imutáveis)
priceEntries/{entryId}           preços pagos (imutáveis)
householdInvites/{code}
```

`owner` decide quem lê e quem escreve, e é ele que torna possível **mover uma
lista entre pessoal e família** — bastava trocar um campo, o que o modelo
monolítico não permitia.

### Posições esparsas

Itens têm `position` numérica espaçada de 1000. Mover um item calcula a média
entre os vizinhos, então só o item movido é reescrito — nunca a lista inteira.

---

## Decisões

**Svelte, não React.** O time é uma pessoa: React exige decisões acessórias
que Svelte responde por padrão. O modelo mental é o mais próximo do código
que já existia. E o bundle importa num PWA que abre em 3G no corredor do
mercado — Svelte compila sem runtime.

**Preço unitário, nunca total da linha.** "2 kg por R$ 18" e "1 kg por R$ 9"
são o mesmo preço; sem normalizar, comparar mercados vira ruído.

**Compras e preços são imutáveis.** Um preço pago é fato consumado; corrigir
se faz apagando e lançando de novo. As regras do Firestore proíbem `update`
nessas coleções.

**Marcar vence desmarcar no merge.** Duas pessoas no mercado marcando o mesmo
item quase nunca é conflito — o item foi pego. Desmarcar, sim, é correção
deliberada, e por isso só prevalece se for mais recente.

---

## Testes

```bash
npm test
```

89 testes cobrindo domínio, repositório, casos de uso e migração. Rodam
contra `MemoryRepository`, a mesma interface que a produção usa — testar
contra a interface real, e não contra mocks, é o que impede a camada de dados
de virar teatro.
