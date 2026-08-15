# Implantação v5 — blocos E e F

Reescrita em Svelte + TypeScript e troca do modelo de dados. É a implantação
mais arriscada do projeto até aqui, e por isso o roteiro é diferente dos
anteriores: **os dois modelos convivem por um período**, e a migração só
acontece quando você mandar.

Tempo estimado: **2h a 3h**, mais uma semana de convivência antes de desligar
o modelo antigo.

---

## O que muda

| | v4 (em produção) | v5 (esta entrega) |
|---|---|---|
| Código | 1 arquivo, ~4.400 linhas de script | módulos TS + componentes Svelte |
| Build | nenhum | Vite (27,7 KB gzip) |
| Dados | 1 documento por usuário/família | coleções: `lists`, `items`, `purchases`, `priceEntries` |
| Testes | 92, harness caseiro | 89, Vitest, importando módulos |
| Tipos | nenhum | TypeScript estrito |

**A migração não apaga nada.** O documento monolítico continua no Firestore,
e as regras v5 permitem lê-lo mas proíbem escrever nele — o que impede o app
antigo de gravar em cima depois que você migrar.

---

## Etapa 0 — Preparação (15 min)

### 0.1 Backup em cada aparelho

No app **atual**: ícone de sincronização → **Exportar backup**.

- [ ] Backup do desktop
- [ ] Backup de cada celular da família

### 0.2 Anotar os números

- [ ] Listas ativas: ______  Itens no total: ______
- [ ] Compras no histórico: ______
- [ ] Itens com histórico de preço: ______ (tela Preços)
- [ ] Famílias: ______

Esses números são o critério de aceite da migração na Etapa 4.

---

## Etapa 1 — Estrutura do repositório (20 min)

A v5 tem build, então o que vai para o GitHub Pages é a pasta `dist/`, não o
código-fonte. Duas mudanças no repositório:

```
lista-de-compras/
├── src/                    ← código-fonte (novo)
├── public/                 ← manifest.json, sw.js, ícones
├── tests/
├── package.json, vite.config.ts, tsconfig.json, svelte.config.js
├── firestore.rules         ← substitui
├── firestore.indexes.json  ← novo
└── .github/workflows/      ← publica dist/ no Pages
```

```bash
git checkout -b v5
# copiar os arquivos da entrega
npm install
npm run verificar     # svelte-check + 89 testes + build
```

- [ ] `svelte-check found 0 errors`
- [ ] `89 passed`
- [ ] `built in ...`

### 1.1 Ícones

Copie `icon-192.png` e `icon-512.png` do repositório atual para `public/`.
O Vite copia `public/` para `dist/` tal e qual.

- [ ] Ícones em `public/`

### 1.2 Workflow de publicação

O Pages passa a servir `dist/`, não a raiz. Ajuste em
**Settings → Pages → Source → GitHub Actions** e use o workflow da entrega.

- [ ] Workflow ajustado

---

## Etapa 2 — Índices do Firestore (15 min, mas espere mais)

O modelo granular consulta por `owner` — e consulta composta no Firestore
exige índice. **Crie os índices antes de qualquer coisa**, porque eles levam
minutos (às vezes muito mais) para ficarem prontos, e até lá as consultas
falham.

```bash
firebase deploy --only firestore:indexes
```

Ou crie à mão pelo Console, seguindo `firestore.indexes.json`.

- [ ] Índices criados
- [ ] Todos com status **Ativado** no Console (não "Compilando")

> Não avance enquanto algum estiver compilando. É a causa mais comum de "a
> lista aparece vazia" logo depois de uma migração de modelo.

---

## Etapa 3 — Regras (10 min)

As regras v5 protegem coleções novas **e** mantêm `shoppingLists` legível
para a migração poder ler os dados antigos.

1. Console → Firestore → Regras
2. Substituir por `firestore.rules` da entrega
3. Publicar

- [ ] Regras publicadas
- [ ] **Verificação:** o app v4 em produção ainda lê as listas, mas ao tentar
      adicionar um item mostra erro de permissão

Essa segunda linha é esperada e é o ponto de não retorno parcial: a partir
daqui o app antigo é somente leitura. Se precisar voltar, republique as
regras v4 — elas continuam válidas para o documento monolítico, que não foi
tocado.

---

## Etapa 4 — Migração dos seus dados (30 min)

### 4.1 Ensaio local, sem tocar em produção

```bash
npm run dev
```

Abra `http://localhost:5173`, entre com sua conta e aceite a migração quando
o app oferecer.

Confira contra a Etapa 0.2:

- [ ] Nº de listas bate
- [ ] Nº de itens bate
- [ ] Nº de compras no histórico bate
- [ ] Itens com histórico de preço batem
- [ ] Preços por mercado aparecem corretos na tela Preços
- [ ] A ordem dos corredores foi preservada

> **Se algum número não bater, pare.** Os dados originais estão intactos: o
> problema é da migração, e ela pode rodar de novo depois de corrigida (os
> ids são preservados, então rodar duas vezes não duplica).

### 4.2 Migração de cada família

Repita para cada família: cada uma tem o próprio documento monolítico, e a
migração roda uma vez por escopo.

- [ ] Todas as famílias migradas e conferidas

---

## Etapa 5 — Regressão (40 min)

O `CHECKLIST-QA.md` continua valendo — é o mesmo produto. Acrescente estes,
específicos da reescrita:

| # | Teste | Esperado | OK |
|---|---|---|---|
| 1 | Rolar uma lista longa e marcar um item no meio | **A página não volta ao topo** (era a pendência 5) | ☐ |
| 2 | Digitar na entrada rápida e marcar um item | O campo **não perde o foco nem o cursor** | ☐ |
| 3 | Lista com 100+ itens | Rolagem fluida | ☐ |
| 4 | Modo compra no iPhone, 2 min parado | Tela não apaga (iOS 16.4+) | ☐ |
| 5 | **Mover uma lista para a família** (pendência 1) | Sai do pessoal, aparece na família, itens junto | ☐ |
| 6 | Mover de volta | Volta íntegra, sem duplicar | ☐ |
| 7 | **Revogar um convite** (pendência 3) | Quem tentar usar vê "cancelado", não "não existe" | ☐ |
| 8 | Criar convite direto como **só leitura** | Membro entra sem permissão de escrita | ☐ |
| 9 | Dois aparelhos adicionando item ao mesmo tempo | Os dois sobrevivem | ☐ |
| 10 | Dois aparelhos marcando o **mesmo** item | Fica marcado; ninguém "desmarca" o outro | ☐ |
| 11 | Offline: editar, voltar a conexão | Sobe sozinho | ☐ |
| 12 | Reinstalar o PWA | Abre na v5 | ☐ |

---

## Etapa 6 — Publicar (15 min)

```bash
git checkout main && git merge v5 && git push origin main
```

- [ ] Actions verde, `dist/` publicado
- [ ] Abrir, fechar e reabrir o PWA em cada aparelho

---

## Etapa 7 — Convivência (1 semana)

Não apague nada ainda. Durante uma semana:

- [ ] Use normalmente e confira a tela Preços de vez em quando
- [ ] Nenhum item sumiu
- [ ] Nenhum erro de permissão no console

Só depois:

- [ ] Apagar os documentos de `shoppingLists` no Console
- [ ] Remover a regra de leitura de `shoppingLists` do `firestore.rules`

---

## Reversão

**Antes da Etapa 4** (migração): reverter é trivial. Republique as regras v4
e o `index.html` antigo; nada foi criado.

**Depois da Etapa 4:** o monolítico continua íntegro e é ele que o app v4 lê.
Republique as regras v4 e o `index.html` antigo. **O que você perde** são as
alterações feitas na v5 depois da migração — por isso a Etapa 7 existe: uma
semana é tempo de descobrir problema estrutural, e as alterações do período
seriam poucas.

**Recuperação de dados**, em ordem: cópia automática no app → backup `.json`
da Etapa 0.1 → documento monolítico no Console.

---

## O que a v5 ainda NÃO tem

Sendo direto, porque isso muda o que você pode testar:

A reescrita entregou a **arquitetura completa** (domínio, repositório,
migração, design system, regras) e as **telas principais** (recibo, itens,
entrada rápida). Os modais que ainda não foram portados da v4 continuam
funcionando lá e migram nas próximas entregas, um a um, sem tocar na
arquitetura:

- [ ] Finalizar compra (checkout H1, pendentes, recorrente)
- [ ] Preços e detalhe por item
- [ ] Famílias, convites e gerenciamento de membros
- [ ] Modo compra
- [ ] Histórico, mapa, PDF, edição de item, ordem dos corredores
- [ ] Login e tela de autenticação
- [ ] Repositório Firestore (hoje só o de memória está implementado)

**Consequência prática:** a v5 ainda não substitui a v4 em produção. Este
runbook descreve a implantação completa para quando essas telas estiverem
portadas — a Etapa 1 e a Etapa 2 podem ser feitas desde já, porque não
afetam o app em uso.
