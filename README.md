# Lista de Compras

PWA para criar e gerenciar listas de compras do dia a dia. Funciona no navegador do celular e do computador, sincroniza entre aparelhos em tempo real, e continua funcionando offline dentro do mercado.

O visual é inspirado em um cupom fiscal: fundo de papel kraft, recibo com bordas serrilhadas, tipografia monoespaçada e itens dispostos como em uma nota de compra.

**Versão atual:** 4.0-G (Fase 3 completa + Fase 4 bloco G — colaboração familiar)
**Publicado em:** https://paineis-gerenciais.github.io/lista-de-compras/

> **Nota sobre este documento.** Até a versão 2 o README descrevia um app local que usava `window.storage` e não tinha nuvem nem edição de item. Isso ficou desatualizado por duas fases inteiras. A partir da Fase 3, atualizar a documentação faz parte da Definition of Done — não é tarefa para depois.

---

## 1. Visão geral

O objetivo é resolver um problema simples e recorrente: organizar o que precisa ser comprado, marcar o que já foi pego durante a compra e reaproveitar o que sobrou para a próxima ida ao mercado.

- **Público-alvo:** uso pessoal e familiar.
- **Plataforma:** navegador desktop e mobile; instalável como app (PWA).
- **Persistência:** `localStorage` no aparelho + Cloud Firestore na conta do usuário, com cache offline.
- **Arquitetura:** arquivo único `index.html` autocontido (HTML + CSS + JS), sem build. Dependências externas: Google Fonts, jsPDF (CDN) e o SDK do Firebase (CDN).

---

## 2. Funcionalidades

### Listas compartilhadas (famílias)
- Criar uma **família** com listas próprias, separadas das pessoais.
- **Convite** por código de 8 letras ou link, válido por 7 dias.
- **Papéis**: responsável, editor e só leitura.
- **Presença em tempo real**: avatares de quem está com o app aberto, e aviso de quem está no mercado agora.
- **Autoria**: quem adicionou e quem pegou cada item — exibido apenas em contexto de família.
- **Atribuição** de item a uma pessoa ("você pega a padaria").
- **Avisos** quando alguém mexe na lista, inclusive com o app em segundo plano.

### Contas e sincronização
- Login com **Google** ou **e-mail/senha** (Firebase Auth).
- Sincronização em tempo real entre todos os aparelhos da mesma conta, sem botão e sem polling.
- **Modo sem conta**: dá para usar tudo localmente, sem cadastro — com aviso claro de que os dados ficam só naquele navegador.
- **Reconciliação por item**: dois aparelhos editando ao mesmo tempo não se sobrescrevem (ver §4).
- **Offline real**: alterações feitas sem rede ficam na fila e sobem sozinhas ao reconectar.
- Exportar/importar backup em `.json` e restaurar uma das 3 cópias automáticas locais.

### Listas
- Várias listas simultâneas (Mercado, Farmácia, Feira), alternáveis por abas roláveis.
- Renomear e excluir listas.
- **Recorrência** (a cada 1, 7, 14 ou 30 dias): ao finalizar, a lista é arquivada e a próxima nasce automaticamente com a data e os itens desmarcados.
- **Ordem dos corredores**: as categorias podem ser reordenadas para seguir o trajeto da loja, e a ordem fica salva **por mercado**.

### Itens
- **Entrada rápida em um campo só**: `2kg tomate`, `500 g queijo`, `3 leite`, `1,5L refrigerante`, `tomate 2kg`, `2x leite`. Quantidade, unidade e nome saem interpretados.
- **Entrada em lote**: colar várias linhas de uma vez (do WhatsApp, por exemplo). Marcadores como `-`, `•` e `1.` são removidos.
- **Ditado por voz** (onde o navegador suportar): "arroz, feijão e café" vira três itens.
- **Categoria automática** por dicionário de ~300 produtos brasileiros, sempre corrigível à mão.
- **Consolidação de duplicados**: adicionar "leite" duas vezes soma a quantidade em vez de criar outra linha.
- **Sugestões de recompra** ao criar uma lista, a partir do histórico de uso.
- Edição de item, exclusão com desfazer, arrastar para reordenar e **botões ▲▼** como alternativa acessível.
- Campos opcionais de unidade e preço, com total estimado da compra.
- Favoritos/itens frequentes com adição em um toque.

### Modo compra
Tela dedicada ao momento dentro do mercado:
- Linha inteira tocável, fonte maior, alvos de toque generosos — uso com uma mão.
- Rodapé fixo com progresso e total já gasto.
- **Wake Lock**: a tela não apaga no meio da compra.
- Ocultar itens já pegos.
- Adicionar item sem sair do modo.

### Histórico
- Todas as compras finalizadas ficam consultáveis, com data e proporção de itens comprados.
- Visualização somente leitura e **reativação** da compra (todos os itens ou só os não comprados).

### Outros
- Tema claro/escuro; modos **Resumida** e **Completa**.
- Busca dentro da lista.
- Compartilhar como texto (WhatsApp) e gerar PDF em formato de cupom.
- Integração com Google Maps no nível da lista (mercados próximos ou rota até um endereço salvo).
- Convite de instalação do PWA a partir da segunda visita.
- Métricas de uso anônimas, guardadas apenas no aparelho (`metricasLista()` no console).

---

## 3. Como usar

1. Acesse o app e **entre com sua conta** (ou escolha usar sem conta).
2. Adicione itens digitando direto no campo de entrada rápida — `2kg tomate` e Enter.
3. Ajuste a **ordem dos corredores** conforme o seu mercado (uma vez só; fica salva).
4. No mercado, toque em **Modo compra** e vá marcando o que pegar.
5. Ao terminar, **Finalizar compra**. Vai para o histórico e, se for recorrente, a próxima já nasce.
6. Para usar em outro aparelho, basta entrar com a mesma conta.

> **Sobre o mapa:** a rota abre o Google Maps em nova aba. Embutir o mapa na página exigiria chave de API paga; os links diretos resolvem a consulta rápida sem custo.

---

## 4. Arquitetura técnica

Aplicação single-page, sem framework, organizada em funções dentro de um único `<script>`.

### Camadas
- **Persistência local** — `loadData()` / `saveDataLocal()` serializam o `state` em JSON sob a chave `shopping-app-data`. `writeRollingBackup()` mantém 3 cópias.
- **Autenticação** — Firebase Auth. O `uid` do usuário é o identificador do documento na nuvem.
- **Sincronização** — Firestore com `onSnapshot` e cache offline (IndexedDB). Toda escrita passa por `mergeStates()`.
- **Estado** — objeto global `state`.
- **Renderização** — `render()` decide entre `renderShopMode()` e o par `renderTabs()` + `renderMain()`. A UI é reconstruída a cada alteração.
- **Modais** — funções `open...Modal()` criam um overlay, anexam ao `body` e se removem ao fechar.
- **PWA** — `manifest.json` e `sw.js` (cache dos assets; dados nunca são cacheados).

### Estrutura de dados

```js
state = {
  schemaVersion: 3,
  activeListId: "ab12cd34",
  lists: [ Lista, ... ],
  finishedLists: [ ListaFinalizada, ... ],
  itemHistory: { "arroz": { name, category, unit, price, count, lastUsed } },
  aisleOrders: { "loja:extra savassi": { order: [...], updatedAt } },
  deleted: { "ef56gh78": 1717000000000 },   // lápides, para o merge
  appMode: "simple" | "full",
  theme: "light" | "dark",
  updatedAt: 1717000000000
}

Lista = {
  id, name, baseName,
  recurring: { enabled, frequencyDays },
  createdAt, updatedAt,                      // updatedAt: novo na Fase 3
  location: { type:'address', value } | null,
  items: [ Item, ... ]
}

Item = {
  id, name, qty, unit, category, price, bought,
  updatedAt                                  // novo na Fase 3
}

ListaFinalizada = Lista + { finishedAt }
```

Na nuvem, um documento por usuário:

```
shoppingLists/{uid} = { state, updatedAt, schemaVersion }
```

### Por que existe `updatedAt` em cada item

Na Fase 2 o estado inteiro era um documento só, gravado com `set()`. Duas pessoas mexendo ao mesmo tempo perdiam dados **em silêncio** — a última escrita apagava a anterior, sem erro na tela. Com o carimbo por registro, `mergeStates()` reconcilia item a item: quem editou por último vence naquele item específico, e o resto sobrevive.

As **lápides** (`state.deleted`) existem para que um item apagado de propósito num aparelho não volte pelo merge vindo do outro. Se o item foi editado *depois* da exclusão, a edição prevalece — o gesto mais recente ganha.

Esse é o remendo possível sem trocar a arquitetura. A correção definitiva é o modelo granular (um documento por lista, subcoleção de itens) previsto para a Fase 4.

### Segurança

`firestore.rules` exige `request.auth.uid == ownerId`, valida a forma do payload e recusa escrita com `updatedAt` retroativo. A regra da Fase 2 liberava qualquer documento a quem soubesse o `projectId` — que é público em todo app Firebase.

---

## 5. Estrutura de arquivos

```
lista-de-compras/
├── index.html               App completo (HTML + CSS + JS)
├── manifest.json            Configuração do PWA
├── sw.js                    Service worker (cache v3)
├── icon-192.png
├── icon-512.png
├── firestore.rules          Regras de segurança
├── package.json             Scripts de verificação e teste
├── testes/
│   ├── harness.js           Carrega o script do index.html no Node
│   ├── testes.js            69 testes da lógica de negócio
│   └── checar-sintaxe.js    Verificação sem build
├── .github/workflows/qa.yml Portão de qualidade (beta → main)
├── README.md                Este documento
├── CHECKLIST-QA.md          38 verificações antes de publicar
├── FIREBASE-SETUP.md        Configuração do Firebase
├── FASE-2-RESUMO.md         Registro da Fase 2
├── FASE-3-RESUMO.md         Registro da Fase 3
├── DEPLOY-FASE-3.md         Runbook da Fase 3
├── DEPLOY-BLOCO-G.md        Runbook do bloco G
├── PLANO-EVOLUCAO-PRODUTO.md  Plano das Fases 3 e 4
└── HISTORICO-DESENVOLVIMENTO.md
```

---

## 6. Desenvolvimento

```bash
npm run check       # sintaxe de index.html, sw.js e manifest.json
npm test            # 69 testes unitários da lógica de negócio
npm run verificar   # os dois
```

Não há build: o `index.html` é servido como está. Os testes extraem o `<script>` do HTML e o avaliam no Node com stubs de DOM — o que permite testar sem abrir mão do arquivo único.

**Fluxo de publicação:** trabalhe em `beta`, rode `npm run verificar`, percorra o `CHECKLIST-QA.md` num celular real, só então promova para `main`. Ao mudar `index.html`, incremente `CACHE_NAME` em `sw.js` — senão quem já instalou o PWA continua vendo a versão antiga.

---

## 7. Limitações conhecidas

- **Um documento por usuário.** O merge por item resolve o pior caso, mas o documento cresce com o histórico e toda leitura traz o estado inteiro. Modelo granular é da Fase 4.
- **Um documento por família**, com a mesma limitação do documento por usuário.
- **Não há "mover lista" entre pessoal e família** — só exportar e importar.
- **Push com o app fechado não existe.** Os avisos funcionam com o app aberto em segundo plano; push real exige FCM e uma Cloud Function (bloco J).
- A recorrência é aplicada na finalização, não por agendador em segundo plano.
- **Wake Lock** não é suportado em todos os navegadores (notadamente partes do iOS).
- **Ditado por voz** depende da Web Speech API — ausente em alguns navegadores; o botão some quando não há suporte.
- **Categoria automática** cobre produtos comuns; itens regionais ou de nicho caem em "Sem categoria".
- **Leitura de nota fiscal / histórico de preços** ainda não existe — é o diferencial planejado para a Fase 4.

Essas limitações são o ponto de partida de `PLANO-EVOLUCAO-PRODUTO.md`.
