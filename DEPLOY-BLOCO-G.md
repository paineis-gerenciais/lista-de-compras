# Implantação — correção do modal + Bloco G (colaboração familiar)

Runbook desta entrega. Pressupõe que a **Fase 3 já está em produção** (se não
estiver, siga primeiro o `DEPLOY-FASE-3.md` — este documento parte de lá).

Tempo estimado: **1h a 1h30**. A parte nova exige **duas contas diferentes**
para testar de verdade, não dois aparelhos com a mesma conta.

---

## O que está sendo publicado

| | O quê | Risco |
|---|---|---|
| 1 | **Correção**: botões "Criar lista"/"Cancelar" inacessíveis | baixo — só CSS e foco |
| 2 | **Bloco G**: famílias, convites, papéis, presença, atribuição | médio — coleções e regras novas |

O Bloco G é **aditivo**: quem não criar nenhuma família não vê diferença
nenhuma. As listas pessoais continuam exatamente onde estavam.

---

## Antes de começar

### 0.1 Backup

Agora existe exportação nativa. Em cada aparelho:

> Ícone de sincronização (topo) → **Exportar backup**

- [ ] Backup exportado e guardado

### 0.2 Anotar o estado

- [ ] Listas ativas: ______   Histórico: ______

---

## Etapa 1 — Código (10 min)

```bash
git checkout beta
```

Copie por cima os arquivos da entrega:

```
index.html          ← substitui (correção + bloco G)
sw.js               ← substitui (CACHE_NAME v3 → v5)
firestore.rules     ← substitui (+ households e householdInvites)
package.json        ← substitui
testes/             ← substitui (72 testes, era 51)
README.md · PLANO-EVOLUCAO-PRODUTO.md · BLOCO-G-RESUMO.md
```

```bash
npm run verificar
```

Esperado: `sintaxe ok` e `72 passaram · 0 falharam`.

- [ ] Verde
- [ ] `CACHE_NAME` em `sw.js` está em `lista-compras-v5`

```bash
git add -A && git commit -m "Corrige acesso aos botões do modal; Fase 4 bloco G: colaboração familiar" && git push
```

- [ ] Enviado, workflow **QA** verde

---

## Etapa 2 — Verificar a correção do modal (10 min)

**No celular, não no desktop.** O bug só aparece com teclado virtual.

```bash
python3 -m http.server 8080
```

Acesse pelo celular na rede local (`http://SEU-IP:8080`).

| # | Teste | Esperado | OK |
|---|---|---|---|
| 0a | **Desktop:** abrir pela aba `+ nova lista` e tocar em **Cancelar** | Fecha (era aqui que travava) | ☐ |
| 0b | **Desktop:** abrir pela aba, digitar nome, **Criar lista** | Cria a lista | ☐ |
| 0c | Repetir 0a e 0b pelo botão **+** do cabeçalho | Idem | ☐ |
| 1 | Tocar em **+** (nova lista) | Modal abre e o teclado **não** sobe sozinho | ☐ |
| 2 | Tocar em **Cancelar** | Fecha | ☐ |
| 3 | Abrir de novo, tocar no campo de nome (teclado sobe), digitar, tocar em **Criar lista** | **Funciona** — os botões ficam grudados no fim do modal, acima do teclado | ☐ |
| 4 | Abrir e tocar fora do modal | Fecha | ☐ |
| 5 | No desktop, abrir e apertar **Esc** | Fecha | ☐ |
| 6 | Modal com muitas sugestões de recompra | Conteúdo rola, botões permanecem visíveis | ☐ |

> **O que eram os bugs — foram dois.** O primeiro, e o que você viu no
> desktop: a aba `+ nova lista` registrava o handler como
> `addTab.onclick = openNewListModal`, e o navegador entrega o `MouseEvent`
> como primeiro argumento. Ele chegava no lugar da lista de pré-preenchimento,
> o bloco de sugestões de recompra chamava `.forEach` nele, a exceção
> abortava a função **antes** de os botões serem ligados — e o modal ficava
> na tela, bonito e inerte, sem nenhuma saída. Foi um bug que eu mesmo
> introduzi no bloco B6 da Fase 3.
>
> O segundo, só no celular: o modal usava `max-height:88vh`. `vh` ignora o teclado
> virtual, então o modal continuava dimensionado para a tela inteira e o rodapé
> com os botões ficava **debaixo do teclado** — visível na hora de abrir, mas
> intocável depois que o campo recebia foco. As sugestões de recompra do bloco
> B6 deixaram o modal mais alto e agravaram isso. A correção tem três partes:
> `dvh` (altura real da janela), rodapé `sticky` e não dar foco automático em
> telas de toque.

Se os 6 passarem, a correção está feita. **Se algum falhar, pare** e relate qual.

---

## Etapa 3 — Publicar as regras do Bloco G (10 min)

As coleções `households` e `householdInvites` **não existem ainda** nas regras
atuais, e a regra final nega tudo o que não está declarado. Sem este passo, criar
família falha com `permission-denied`.

Diferente da Fase 3, aqui a ordem é a inversa: **as regras vêm primeiro**, porque
o código novo depende delas e o código antigo não usa essas coleções.

1. Console → **Firestore Database → Regras**
2. Substituir tudo pelo `firestore.rules` desta entrega
3. **Publicar**

- [ ] Regras publicadas
- [ ] Verificação: no app **antigo** ainda em produção, adicionar um item e
      confirmar que continua salvando (as regras de `shoppingLists` não mudaram)

> Se a verificação falhar, reverta as regras imediatamente e relate — significa
> que algo além das coleções novas foi alterado.

---

## Etapa 4 — Testar o Bloco G (30 min)

**Precisa de duas contas diferentes.** Use a sua e uma segunda (Google
secundária, ou e-mail/senha criada na hora). Dois navegadores, um deles anônimo,
já resolve.

### 4.1 Criar e convidar

Na conta A:

| # | Teste | Esperado | OK |
|---|---|---|---|
| 1 | Tocar na pílula de escopo (abaixo de Resumida/Completa) | Abre "Listas compartilhadas" com "Minhas listas" marcada | ☐ |
| 2 | **Criar uma família** → nome "Casa" | Cria, troca para ela e abre o gerenciamento | ☐ |
| 3 | A lista está **vazia** | Sim — família nasce do zero, não herda o pessoal | ☐ |
| 4 | **Convidar alguém** | Gera código de 8 letras e botões Copiar/Compartilhar | ☐ |
| 5 | Adicionar itens na família | Salvam normalmente | ☐ |
| 6 | Voltar para "Minhas listas" | Suas listas pessoais estão **intactas** | ☐ |

> **Item 6 é o mais importante desta etapa.** Se as listas pessoais sumiram ou
> se misturaram com as da família, é bloqueio de release.

### 4.2 Entrar pela conta B

| # | Teste | Esperado | OK |
|---|---|---|---|
| 7 | Abrir o link do convite no navegador da conta B | Depois do login, abre o modal com o código preenchido | ☐ |
| 8 | Confirmar | Entra na família e vê os itens da conta A | ☐ |
| 9 | Testar o código **digitado à mão** (não o link) | Também funciona | ☐ |
| 10 | Tentar um código inventado (`ZZZZ2222`) | "Convite não encontrado", sem quebrar | ☐ |

### 4.3 Tempo real e presença

Com as duas contas abertas lado a lado:

| # | Teste | Esperado | OK |
|---|---|---|---|
| 11 | B adiciona "café" | Aparece em A em segundos, com toast nomeando quem adicionou | ☐ |
| 12 | A marca um item | B vê a marcação e a etiqueta "*(nome)* pegou" | ☐ |
| 13 | Avatares no topo | Cada conta vê o avatar da outra, com bolinha verde | ☐ |
| 14 | B entra no **Modo compra** | A vê "*(nome)* está no mercado agora" | ☐ |
| 15 | B atribui um item a A (botão 👤, modo Completa) | A vê a etiqueta "você pega" | ☐ |
| 16 | **Merge sob concorrência:** as duas adicionam itens diferentes ao mesmo tempo | **Os dois sobrevivem** | ☐ |

### 4.4 Papéis

Na conta A (responsável), gerenciar → mudar B para **só leitura**:

| # | Teste | Esperado | OK |
|---|---|---|---|
| 17 | B recarrega | Aviso amarelo de somente leitura; campo de adicionar some | ☐ |
| 18 | B tenta marcar um item | Recusa com mensagem clara | ☐ |
| 19 | B tenta excluir um item | Recusa | ☐ |
| 20 | A devolve B para **editor** | B volta a editar | ☐ |
| 21 | A remove B da família | B é jogada de volta para "Minhas listas" com aviso | ☐ |
| 22 | B sai por conta própria de outra família | Sai; a família continua para os demais | ☐ |
| 23 | A exclui a família (sozinha nela) | Some da lista; listas pessoais intactas | ☐ |

### 4.5 Notificações e offline

| # | Teste | Esperado | OK |
|---|---|---|---|
| 24 | Aceitar "Avisar quando alguém mexer na lista" | Permissão pedida uma vez | ☐ |
| 25 | Com a aba em segundo plano, a outra conta adiciona item | Notificação do sistema aparece | ☐ |
| 26 | Modo avião numa conta, editar, voltar | Sobe sozinho, sem perder o da outra | ☐ |

> **Sobre push:** a notificação do item 25 funciona com o app **aberto em segundo
> plano**. Push com o app fechado exige FCM + uma Cloud Function para enviar —
> não é possível só no cliente. Está registrado como pendência do bloco J.

---

## Etapa 5 — Regressão e publicação (25 min)

- [ ] `CHECKLIST-QA.md` percorrido (38 itens) — a Fase 3 não pode ter regredido
- [ ] Confirmar em "Minhas listas" que os números do Passo 0.2 batem

```bash
git checkout main && git merge beta && git push origin main
```

- [ ] Publicado, workflow verde
- [ ] Em cada aparelho: abrir, fechar completamente, abrir de novo (o
      `CACHE_NAME` v4 força a atualização na segunda abertura)

---

## Etapa 6 — Colocar a família para usar (15 min)

Se vocês compartilhavam o mesmo código de sincronização até a Fase 3, agora dá
para separar de verdade:

1. Cada pessoa cria a **própria conta**
2. Você cria a família e envia o convite
3. **Mover as listas de casa para a família:** abra "Minhas listas", exporte o
   backup, troque para a família e importe. Depois apague da pessoal o que virou
   compartilhado.

- [ ] Todos com conta própria
- [ ] Família criada e convites aceitos
- [ ] Listas de casa movidas para a família

> Não há um botão "mover lista para a família" nesta entrega. Exportar/importar
> resolve, mas é desajeitado — fica anotado como melhoria.

---

## Reversão

**Código:**
```bash
git revert HEAD --no-edit && git push origin main
```

**Regras:** só reverta as regras se o problema for de permissão em
`shoppingLists`. As regras novas de `households` são aditivas — reverter apaga o
acesso das famílias já criadas, mas **não apaga os dados**. Recrie as regras e o
acesso volta.

**Dados:** nada nesta entrega apaga dados. Listas pessoais e de família vivem em
documentos separados. Se algo parecer perdido:
1. Sincronização → **Restaurar cópia automática**
2. **Importar backup** do Passo 0.1
3. Console do Firestore → o documento continua lá

---

## Resumo

| Etapa | O quê | Reversível? | Tempo |
|---|---|---|---|
| 0 | Backup | — | 5 min |
| 1 | Código + `npm run verificar` | sim | 10 min |
| 2 | **Correção do modal, no celular** | sim | 10 min |
| 3 | Publicar regras do bloco G | sim | 10 min |
| 4 | Testar colaboração com **duas contas** | sim | 30 min |
| 5 | Regressão e publicação | sim | 25 min |
| 6 | Migrar a família | — | 15 min |

**Pontos de parada:** Etapa 1 vermelha · qualquer item da Etapa 2 falhando ·
item 6 da Etapa 4 (listas pessoais afetadas) · item 16 (merge sob concorrência).
