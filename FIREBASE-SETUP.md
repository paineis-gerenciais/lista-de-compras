# Configuração do Firebase — Lista de Compras (Fase 3)

Este guia substitui a versão da Fase 2, que usava um "código de sincronização"
digitado à mão. Agora há login de verdade e as regras de segurança exigem
autenticação.

O front continua no **GitHub Pages** — o Firebase é usado apenas como
autenticação e banco de dados. Não é preciso migrar hospedagem.

---

## ⚠️ Ordem importa

Faça na ordem abaixo. **Publicar as regras antes de o login funcionar deixa o
app sem conseguir gravar nada** — a regra nova exige `request.auth`, e sem os
provedores habilitados não existe `request.auth`.

```
1. Habilitar provedores  →  2. Autorizar domínio  →  3. Testar login
                                                          ↓
                                             4. Publicar as regras
```

---

## 1. Habilitar os provedores de login

1. Console do Firebase → **Authentication**
2. Se for a primeira vez, clique em **Começar**
3. Aba **Sign-in method**
4. Habilite **Google**
   - Escolha um "e-mail de suporte do projeto" (o seu)
   - Salvar
5. Habilite **E-mail/senha**
   - Ative apenas a primeira opção ("E-mail/senha"). O "link por e-mail"
     não é usado pelo app.
   - Salvar

## 2. Autorizar o domínio do GitHub Pages

Sem isso, o login com Google falha com `auth/unauthorized-domain`.

1. **Authentication → Settings → Authorized domains**
2. **Adicionar domínio**: `paineis-gerenciais.github.io`
3. `localhost` já vem autorizado, para testes locais

## 3. Testar o login antes de fechar as regras

1. Abra o app publicado (de preferência no `beta`)
2. A tela de login deve aparecer
3. Entre com Google e depois saia e entre com e-mail/senha
4. Adicione um item e confirme que a pílula no topo mostra **salvo na nuvem**
5. Abra em outro aparelho com a mesma conta e confirme que a lista aparece

Se algo falhar aqui, **não avance para o passo 4.** Com as regras antigas
ainda publicadas o app continua funcionando enquanto você investiga.

## 4. Publicar as regras de segurança

1. **Firestore Database → Regras**
2. Substitua todo o conteúdo pelo arquivo `firestore.rules` desta entrega
3. **Publicar**

Confirme logo depois: adicione um item e veja se ele sobe. Se der erro de
permissão, revise se os passos 1 e 2 foram concluídos.

---

## Migração de quem usava o código de sincronização

O app faz isso sozinho. No primeiro login, ele procura o documento antigo
(identificado pelo código que estava salvo no aparelho) e **combina** aquele
conteúdo com o da conta — por merge, nunca por substituição. Nada é apagado, e
a operação acontece uma vez só.

O documento antigo permanece no Firestore. Depois de confirmar que tudo migrou
em todos os aparelhos da família, ele pode ser apagado à mão pelo Console.
Com as regras novas publicadas, ele já não é acessível por ninguém.

---

## Sobre o `firebaseConfig`

Os valores dentro de `index.html` **não são secretos**. Todo app Firebase os
expõe no próprio HTML — é assim que o SDK funciona. A segurança real vem das
Regras de Segurança, e é exatamente por isso que o passo 4 importa tanto.

---

## Infraestrutura (já definida na Fase 2, mantida)

- **Edição do banco:** Standard — suficiente para o volume pessoal/familiar
- **Região:** `southamerica-east1` (São Paulo), menor latência

## Custos

O free tier do Firebase (plano Spark) cobre com folga o uso pessoal e familiar:
50 mil leituras e 20 mil escritas por dia. O app grava com debounce de 1
segundo e lê o documento inteiro a cada mudança remota.

Vale acompanhar em **Firestore → Uso**. Se o número de leituras começar a
crescer de forma desproporcional, o motivo será o modelo de documento único —
que é justamente o que o bloco F da Fase 4 substitui.

---

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `auth/unauthorized-domain` | Domínio não autorizado | Passo 2 |
| `auth/operation-not-allowed` | Provedor não habilitado | Passo 1 |
| Login funciona, mas nada salva | Regras publicadas antes do login | Confirme os passos 1 e 2 e recarregue |
| Popup do Google não abre | Bloqueador de popup | O app já cai para redirect automaticamente; libere o popup para uma experiência melhor |
| `Missing or insufficient permissions` | Regra nova + sessão sem token válido | Saia da conta e entre de novo |
| Dados antigos não apareceram | Migração já marcada como concluída | Use **Conta e sincronização → Importar backup** com um `.json` exportado do aparelho antigo |
