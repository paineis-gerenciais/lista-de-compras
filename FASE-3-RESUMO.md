# Fase 3 — Onda Rápida

Registro do que foi decidido e construído na Fase 3, para continuidade do projeto.

**Objetivo da fase:** eliminar os dois riscos críticos de dados e reduzir o atrito do uso diário, **sem trocar a arquitetura** (arquivo único + Firestore).

---

## 1. Ponto de partida

O diagnóstico que abriu a fase encontrou um descompasso: o README descrevia a v2 (`window.storage`, sem nuvem, sem edição de item), enquanto o `index.html` já tinha PWA, Firestore em tempo real, edição, arrastar e soltar, preço, favoritos, tema escuro e busca. A Fase 1 estava ~85% pronta e a Fase 2, concluída.

Isso deslocou o foco: o projeto não precisava de mais recursos, precisava parar de perder e de vazar dados.

---

## 2. Os dois riscos críticos e o que foi feito

### R1 — Sobrescrita silenciosa entre dispositivos

**O problema.** O estado inteiro era um único documento gravado com `set({ state })`. Dois aparelhos gravando com segundos de diferença faziam um apagar o trabalho do outro — listas, itens, histórico. Sem erro, sem aviso. Justamente no caso de uso alvo: um no corredor, outro em casa lembrando de algo.

**A correção.** Reconciliação por registro:
- `updatedAt` carimbado em cada item e cada lista, com migração automática dos dados antigos (`normalizeState`).
- `mergeStates()` — função pura que funde local e remoto item a item; quem editou por último vence *naquele item*, o resto sobrevive.
- **Lápides** (`state.deleted`) para que item apagado de propósito não ressuscite pelo merge. Edição posterior à exclusão prevalece — o gesto mais recente ganha.
- Merge idempotente e testado: 14 testes cobrem só esse caminho.
- O listener devolve o resultado do merge à nuvem quando ele contém algo que a nuvem ainda não tinha.

**O que isso não é.** Um remendo bom, não a solução. O documento continua monolítico e cresce com o histórico. A correção definitiva é o modelo granular da Fase 4.

### R2 — Regra de segurança aberta

**O problema.** A regra liberava qualquer documento a quem soubesse o `projectId` — que é público em todo app Firebase. O "código de sincronização" não era senha: era o nome do morador na placa da porta destrancada. Códigos legíveis como `familia-silva` são enumeráveis.

**A correção.** Firebase Auth (Google + e-mail/senha), `ownerId` passa a ser o `uid`, e as regras exigem `request.auth.uid == ownerId`, validam a forma do payload, recusam `updatedAt` retroativo e negam todas as outras coleções por padrão.

---

## 3. Entregas por bloco

### Bloco A — Segurança e integridade
| Item | Entrega |
|---|---|
| A1 | Firebase Auth com Google e e-mail/senha; tela de login com erros em português; regras reescritas |
| A2 | Migração automática do código de sincronização da Fase 2 no primeiro login — **por merge, nunca por substituição** |
| A3 | Projeto Firebase único do produto: ninguém mais precisa criar projeto próprio |
| A4 | `mergeStates()` + `normalizeState()` + lápides |
| A5 | Persistência offline do Firestore (`enablePersistence`) |
| A6 | Exportar/importar `.json` + 3 cópias automáticas rotativas locais |

### Bloco B — Atrito zero na entrada
| Item | Entrega |
|---|---|
| B1 | `parseQuickItem()`: `2kg tomate`, `500 g queijo`, `1,5L refri`, `tomate 2kg`, `2x leite`, `queijo #Frios` |
| B2 | Entrada em lote por colagem ou várias linhas; marcadores (`-`, `•`, `1.`) removidos |
| B3 | Ditado por voz (Web Speech API); botão some onde não há suporte |
| B4 | `guessCategory()` com dicionário de ~300 produtos br-PT, casamento por n-gramas e plural |
| B5 | Consolidação de duplicados (mesma unidade, item não comprado) |
| B6 | Sugestões de recompra na criação de lista, ponderadas por frequência e recência |

### Bloco C — Modo compra
| Item | Entrega |
|---|---|
| C1 | Tela dedicada: linha inteira tocável, fonte maior, rodapé fixo com progresso e total gasto |
| C2 | Wake Lock, com reaquisição ao voltar do segundo plano |
| C3 | Ordem dos corredores salva **por mercado** (`aisleOrders`) |
| C4 | Desfazer de 6 s em exclusão de item e em "Finalizar compra" |
| C5 | Ocultar comprados, disponível na lista e no modo compra |

### Bloco D — Acessibilidade e qualidade
| Item | Entrega |
|---|---|
| D1 | Botões ▲▼ para reordenar sem arrastar, com foco preservado e anúncio para leitor de tela |
| D2 | `--ink-light` corrigido de `#84796A` (4.0:1) para `#6E6355` (~5.4:1); alvos de toque mínimos |
| D3 | Pílula de status de sincronização com texto legível, não só cor |
| D4 | Convite de instalação do PWA a partir da 2ª visita, dispensável e não repetitivo |
| D5 | `CHECKLIST-QA.md` (38 verificações) + workflow de CI com `beta` → `main` |
| D6 | 51 testes unitários da lógica pura, rodando sem build e sem navegador |
| D7 | 6 eventos anônimos guardados só no aparelho; `metricasLista()` no console |
| D8 | README, FIREBASE-SETUP e este documento atualizados **na mesma entrega** |

---

## 4. Decisões de projeto

**Testar um arquivo único sem quebrar o arquivo único.** O harness extrai o `<script>` do `index.html` e o avalia no Node com stubs mínimos de DOM. Preserva a premissa da fase (não mexer na arquitetura) e ainda assim dá cobertura à lógica de negócio.

**Exclusão de item deixou de pedir confirmação.** Trocamos por desfazer de 6 segundos. Confirmar toda exclusão custa um toque em 100% dos casos para proteger os 2% de engano; desfazer custa zero e cobre o engano melhor.

**Preferências de exibição não sincronizam.** `appMode` e `theme` são do aparelho — o celular pode estar no escuro e o desktop no claro. O merge deixa o lado local sempre vencer nesses dois campos.

**"Usar sem conta" continua sendo opção de primeira classe.** Login obrigatório mataria o uso casual e o primeiro contato. O aviso é explícito sobre o risco de perder os dados.

**Leite condensado e creme de leite foram para Mercearia.** Estavam classificados como refrigerados. No supermercado brasileiro eles ficam no corredor seco, perto dos itens de confeitaria — e o dicionário existe para refletir o trajeto real da loja, não a taxonomia do produto.

---

## 5. Bugs encontrados durante a fase

Os três foram descobertos pelos testes, não pela leitura do código.

| Bug | Causa | Correção |
|---|---|---|
| `2x leite` virava um item chamado "X leite" | A forma `Nx` era testada *depois* do padrão "número + unidade + nome", que consumia o `x` como se fosse parte do nome | Multiplicador `x` passou a ser testado primeiro |
| "Leite condensado" caía em Frios e Laticínios | Estava no grupo errado do dicionário | Movido para Mercearia, junto com creme de leite |
| Sugestões de recompra ofereciam item já presente na lista | O teste parecia falhar por bug de filtro; na verdade `state` é declarado com `let`, então **não** é propriedade do objeto global e o harness não conseguia trocá-lo — o teste estava exercitando um estado vazio | Ponte `__setState`/`__getState` avaliada no mesmo realm; o filtro estava correto o tempo todo |

O terceiro é o mais instrutivo: uma falha de teste apontando para o lugar errado. Sem investigar a causa, teríamos "corrigido" código que funcionava.

---

## 6. Pendências que dependem da conta do Daniel

**Nesta ordem** — publicar as regras antes do login funcionar deixa o app sem gravar nada:

1. Console do Firebase → **Authentication → Sign-in method**: habilitar **Google** e **E-mail/senha**.
2. **Authentication → Settings → Authorized domains**: adicionar `paineis-gerenciais.github.io`.
3. Testar o login no `beta` e confirmar que a sincronização funciona.
4. **Firestore Database → Regras**: publicar o novo `firestore.rules`.
5. Criar a branch `beta` no repositório e ativar o GitHub Pages para ela (ou uma pasta `/beta/`).
6. Percorrer o `CHECKLIST-QA.md` num celular real antes de promover para `main`.

---

## 7. Estado dos arquivos ao fim da Fase 3

```
lista-de-compras/
├── index.html               2.732 linhas de script (era ~1.390)
├── manifest.json            + atalho "Nova lista"
├── sw.js                    cache v2 → v3
├── firestore.rules          reescrito (auth obrigatório)
├── package.json             npm run check / test / verificar
├── testes/                  harness + 51 testes + checagem de sintaxe
├── .github/workflows/qa.yml portão de qualidade
├── README.md                reescrito
├── CHECKLIST-QA.md          novo
└── FASE-3-RESUMO.md         este documento
```

---

## 8. O que a Fase 3 deliberadamente não fez

- **Não** trocou o modelo de dados monolítico (Fase 4, bloco F).
- **Não** introduziu compartilhamento entre contas nem papéis de família (Fase 4, bloco G).
- **Não** tocou em histórico de preços nem em leitura de nota fiscal — o diferencial de mercado (Fase 4, bloco H).
- **Não** reescreveu em framework nem adotou TypeScript (Fase 4, bloco E).

A Fase 3 termina com o app pronto para ser usado por uma família de verdade sem risco de perder dados. Se a Fase 4 nunca acontecer, isso já é um bom produto pessoal.

---

## 9. Preparação para a Fase 4

Decisões já tomadas aqui para reduzir retrabalho:

- `mergeStates()` é pura e testada — a lógica de reconciliação sobrevive à reescrita em outro framework.
- `normalizeState()` centraliza a migração de esquema; a Fase 4 acrescenta um passo, não reescreve o caminho.
- `schemaVersion` gravado no documento da nuvem permite migração progressiva sem quebrar aparelhos ainda na v3.
- `aisleOrders` já é indexado por local, pronto para virar coleção própria.
- A instrumentação (D7) começa a responder, antes da Fase 4, as perguntas que hoje só temos por dedução: quantos itens tem uma lista real, por onde os itens entram e se o modo Resumida é usado.

**As quatro decisões pendentes do plano continuam abertas:** intenção de mercado, framework da Fase 4, e se vale o spike de captura de cupom fiscal (NFC-e ou OCR).
