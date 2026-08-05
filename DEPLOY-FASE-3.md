# Implantação da Fase 3 — passo a passo

Runbook de publicação. Feito para ser seguido de cima para baixo, marcando cada
caixa. Tempo total estimado: **1h30 a 2h**, sendo a maior parte espera e teste.

**Princípio que orienta tudo aqui:** em nenhum momento o app em produção pode
ficar quebrado. Cada etapa é reversível, e a etapa que não é (publicar as regras)
só acontece depois que tudo o que ela depende já foi comprovado funcionando.

---

## Antes de começar — 5 minutos que evitam a dor

### Passo 0.1 — Exportar um backup seu

Abra o app **atual** em produção, em cada aparelho que você usa, e:

> Ícone de sincronização → não existe ainda na versão atual.

Na versão atual (Fase 2) não há exportação. Então faça pelo navegador, no
desktop, com o app aberto — F12 → Console:

```js
copy(localStorage.getItem('shopping-app-data'))
```

Cole num arquivo `backup-pre-fase3.json` e guarde. Faça isso **em cada aparelho**,
porque os estados podem estar diferentes entre eles.

- [ ] Backup do desktop salvo
- [ ] Backup do celular salvo (se der; se não der, siga — a nuvem tem uma cópia)

> Por que isso importa: a Fase 3 muda o formato dos dados (adiciona `updatedAt`
> em cada item). A migração é automática e foi testada, mas backup custa 2
> minutos e a alternativa não tem preço.

### Passo 0.2 — Anotar o estado atual

- [ ] Quantas listas ativas você tem hoje? ______
- [ ] Quantas compras no histórico? ______
- [ ] Qual o código de sincronização em uso? ________________

No fim da implantação você confere esses três números. Se bater, a migração
funcionou.

---

## Etapa 1 — Preparar o repositório (15 min)

### 1.1 Clonar e criar a branch de trabalho

```bash
git clone https://github.com/paineis-gerenciais/lista-de-compras.git
cd lista-de-compras
git checkout -b fase-3
```

- [ ] Feito

### 1.2 Copiar os arquivos da entrega

Descompacte `lista-de-compras-fase3.zip` e copie por cima:

```
index.html          ← substitui
sw.js               ← substitui
manifest.json       ← substitui
firestore.rules     ← substitui
README.md           ← substitui
FIREBASE-SETUP.md   ← substitui
package.json        ← novo
CHECKLIST-QA.md     ← novo
FASE-3-RESUMO.md    ← novo
testes/             ← nova pasta
.github/workflows/  ← nova pasta
```

**Não sobrescreva:** `icon-192.png`, `icon-512.png`, `FASE-2-RESUMO.md`,
`HISTORICO-DESENVOLVIMENTO.md`, `PLANO-DE-MELHORIAS.md`.

- [ ] Arquivos copiados
- [ ] Ícones ainda estão lá (`ls *.png`)

### 1.3 Conferir o `firebaseConfig`

Abra `index.html` e localize `const firebaseConfig`. Confirme que o `projectId`
é `lista-de-compras-bc2dc` — ou o projeto que você quer usar como projeto único
do produto.

- [ ] Config confere

### 1.4 Rodar o portão automático

```bash
npm run verificar
```

Esperado: `sintaxe ok` e `51 passaram · 0 falharam`.

- [ ] Verde

> Se falhar aqui, **pare**. Não há por que testar à mão algo que já não passa no
> automático.

### 1.5 Commitar

```bash
git add -A
git commit -m "Fase 3: autenticação, merge por item, modo compra, entrada rápida"
git push -u origin fase-3
```

- [ ] Feito

---

## Etapa 2 — Homologar no localhost (25 min)

**Por que localhost e não uma pasta `/beta/` no GitHub Pages:** `localStorage` é
compartilhado por origem. Uma pasta `/beta/` no mesmo `paineis-gerenciais.github.io`
usaria **os mesmos dados locais** da produção — um bug no beta contaminaria o app
que sua família usa. `localhost` é outra origem, totalmente isolada, e já vem
autorizada no Firebase.

### 2.1 Servir localmente

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`.

- [ ] App carrega

Neste momento o login **ainda não funciona** (os provedores não foram
habilitados). Isso é esperado.

### 2.2 Testar sem conta

Clique em **"Usar sem conta neste aparelho"** e percorra os fluxos:

- [ ] Digitar `2kg tomate` + Enter → item com categoria Hortifruti
- [ ] Colar 3 linhas de uma vez → 3 itens
- [ ] Adicionar "leite" duas vezes → uma linha, qtd somada
- [ ] Entrar no **Modo compra**, marcar itens, sair
- [ ] Excluir um item → toast com **Desfazer** → item volta na mesma posição
- [ ] Ordenar corredores e ver a lista seguir a ordem
- [ ] Finalizar compra → **Desfazer** → lista volta
- [ ] Gerar PDF

> Isso valida ~70% da Fase 3 antes de mexer em qualquer configuração de nuvem.
> Se algo aqui falhar, corrija antes de seguir — ainda não houve nenhuma
> mudança irreversível.

---

## Etapa 3 — Configurar o Firebase (20 min)

**A partir daqui a ordem é obrigatória.** Publicar as regras antes do login
funcionar deixa o app sem gravar nada.

```
3.1 provedores → 3.2 domínios → 3.3 testar login → 3.4 regras
```

### 3.1 Habilitar os provedores

Console do Firebase → **Authentication** → (Começar, se for a primeira vez) →
aba **Sign-in method**:

- [ ] **Google** habilitado (escolher e-mail de suporte do projeto)
- [ ] **E-mail/senha** habilitado — apenas a primeira opção; o "link por e-mail"
      não é usado pelo app

### 3.2 Autorizar os domínios

**Authentication → Settings → Authorized domains**:

- [ ] `localhost` presente (já vem por padrão)
- [ ] `paineis-gerenciais.github.io` adicionado

> Sem isso o login com Google falha com `auth/unauthorized-domain`.

### 3.3 Testar o login no localhost

Recarregue `http://localhost:8080`. A tela de login deve aparecer.

- [ ] Entrar com **Google** funciona
- [ ] A pílula no topo mostra **salvo na nuvem**
- [ ] **A migração aconteceu**: as listas do código de sincronização apareceram,
      e o toast "Listas do código de sincronização importadas" foi exibido
- [ ] Os números do Passo 0.2 batem (listas ativas e histórico)
- [ ] Sair da conta, criar uma conta de e-mail/senha, entrar — funciona
- [ ] Voltar para a conta Google — as listas voltam

> **Se a migração não trouxe os dados:** não entre em pânico. O documento antigo
> continua intacto no Firestore. Use **Conta e sincronização → Importar backup**
> com o `.json` do Passo 0.1. Investigue antes de seguir.

### 3.4 Publicar as regras de segurança

Só agora. Console → **Firestore Database** → aba **Regras** → substituir todo o
conteúdo pelo arquivo `firestore.rules` da entrega → **Publicar**.

- [ ] Regras publicadas

**Verificação imediata** (30 segundos, não pule):

- [ ] No localhost, adicionar um item → sobe, pílula fica **salvo na nuvem**
- [ ] Sair da conta → a tela de login aparece e nada vaza atrás dela

> Se der `Missing or insufficient permissions`: saia da conta e entre de novo
> (a sessão pode estar com token velho). Se persistir, revise 3.1 e 3.2.

---

## Etapa 4 — Testar sincronização de verdade (20 min)

Esta é a etapa que valida o motivo de existir da Fase 3. Precisa de **dois
aparelhos**. Localhost não serve aqui — use dois navegadores no desktop
(um deles anônimo) ou desktop + celular pelo localhost na rede local.

### 4.1 Sincronização básica

Com a mesma conta nos dois:

- [ ] Adicionar item no A → aparece no B em poucos segundos, sem recarregar
- [ ] Marcar item no A → reflete no B
- [ ] Excluir item no A → some no B **e não volta**

### 4.2 O teste do merge — o item 6 do checklist

Com **os dois abertos ao mesmo tempo**:

1. No A, adicione "café"
2. No B, **imediatamente**, adicione "pão"
3. Espere 10 segundos

- [ ] **Os dois itens sobrevivem, nos dois aparelhos**

> Este é o teste que a Fase 2 falhava. Se falhar aqui, é bloqueio: **não
> publique**. Anote exatamente o que sumiu e em qual aparelho.

### 4.3 Offline

- [ ] Modo avião no celular → editar a lista → voltar a conexão → alterações
      sobem sozinhas e a pílula sai de **offline** para **salvo na nuvem**

---

## Etapa 5 — Publicar em produção (10 min)

### 5.1 Mesclar

```bash
git checkout main
git merge fase-3
git push origin main
```

- [ ] Feito
- [ ] O workflow **QA** no GitHub Actions ficou verde

### 5.2 Esperar o Pages

Leva 1 a 3 minutos. Acompanhe em **Actions** ou em **Settings → Pages**.

- [ ] Site atualizado

### 5.3 Forçar a atualização do PWA instalado

Quem instalou o app na Fase 2 tem a versão antiga em cache. O `CACHE_NAME` subiu
de `v2` para `v3`, o que resolve isso — mas a troca acontece na **segunda**
abertura, não na primeira.

Em cada aparelho da família:

- [ ] Abrir o app, fechar completamente, abrir de novo
- [ ] A tela de login aparece (sinal de que a v3 carregou)
- [ ] Entrar com a conta e conferir as listas

> Se algum aparelho insistir na versão velha: fechar o app, aguardar um minuto,
> abrir de novo. Em último caso, desinstalar e reinstalar o PWA — os dados estão
> na nuvem, não se perdem.

---

## Etapa 6 — Checklist de regressão no celular real (20 min)

Percorra o `CHECKLIST-QA.md` — 38 verificações. Não dá para pular: DevTools em
modo responsivo não reproduz teclado virtual, wake lock nem instalação de PWA.

- [ ] Checklist percorrido num Android ou iPhone real
- [ ] Item 17 (Wake Lock) anotado — pode falhar no iOS, é limitação conhecida
- [ ] Item 14 (voz) anotado — o botão some se o navegador não suportar

---

## Etapa 7 — Fechamento (10 min)

### 7.1 Confirmar a migração de toda a família

Cada pessoa que usava o código de sincronização precisa entrar com conta própria
**ou** com a mesma conta, dependendo de como vocês querem organizar.

> **Atenção:** a Fase 3 não tem compartilhamento entre contas. Se a família
> compartilhava o mesmo código de sincronização, todos precisam entrar com **a
> mesma conta** para continuar vendo as mesmas listas. Compartilhamento com
> contas separadas e papéis é o bloco G da Fase 4.

- [ ] Todos os aparelhos migrados e sincronizando

### 7.2 Limpar o documento antigo

Só depois de confirmar o item acima. Console → **Firestore Database** → coleção
`shoppingLists` → localizar o documento com o nome do código de sincronização
antigo → excluir.

- [ ] Documento antigo removido (opcional; com as regras novas ele já está
      inacessível a qualquer pessoa)

### 7.3 Criar a branch `beta` para as próximas entregas

```bash
git checkout -b beta
git push -u origin beta
```

Daqui em diante o fluxo é: trabalhar em `beta` → `npm run verificar` →
homologar no localhost → checklist → mesclar em `main`.

- [ ] Branch criada

### 7.4 Registrar

- [ ] Preencher a data e o resultado no cabeçalho do `CHECKLIST-QA.md`
- [ ] Anotar no `FASE-3-RESUMO.md` qualquer desvio do plano

---

## Plano de reversão

Se algo der errado depois de publicar em `main`:

### Reverter o código (2 minutos)

```bash
git revert HEAD --no-edit
git push origin main
```

Aguarde o Pages republicar. **Mas atenção:** o `sw.js` revertido volta ao
`CACHE_NAME` `v2`, que os aparelhos já descartaram. Eles vão baixar a versão
antiga normalmente, mas pode levar duas aberturas.

### Reverter as regras (1 minuto)

Console → Firestore → Regras → cole a versão antiga e publique:

```
allow read, write: if ownerId is string && ownerId.size() > 0;
```

> Use isso **apenas** como medida emergencial e por pouco tempo. Enquanto essa
> regra estiver no ar, qualquer pessoa com o `projectId` acessa qualquer
> documento.

### Recuperar dados

Os dados não são apagados em nenhuma etapa desta implantação. Se algo parecer
perdido, nesta ordem:

1. **Conta e sincronização → Restaurar cópia automática** (3 últimas versões locais)
2. **Importar backup** com o `.json` do Passo 0.1
3. Console do Firestore → documento antigo do código de sincronização, que
   continua lá se você não fez o passo 7.2

---

## Resumo em uma tela

| Etapa | O que é | Reversível? | Tempo |
|---|---|---|---|
| 0 | Backup e contagem | — | 5 min |
| 1 | Repositório + `npm run verificar` | sim | 15 min |
| 2 | Homologar no localhost, sem conta | sim | 25 min |
| 3 | Firebase: provedores → domínios → login → **regras** | sim, com esforço | 20 min |
| 4 | Sincronização entre dois aparelhos + **teste do merge** | sim | 20 min |
| 5 | Merge em `main` e atualização do PWA | sim | 10 min |
| 6 | Checklist de regressão no celular | — | 20 min |
| 7 | Fechamento e branch `beta` | — | 10 min |

**Os dois pontos onde parar e não seguir adiante:**
- Etapa 1.4 vermelho (portão automático)
- Etapa 4.2 falhando (o teste do merge)
