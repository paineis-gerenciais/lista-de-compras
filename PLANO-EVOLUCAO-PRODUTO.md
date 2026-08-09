# Lista de Compras — Plano de Evolução do Produto
### Parecer de consultoria multidisciplinar (UX · Engenharia · Produto · Qualidade)

**Revisão 2** — atualizada com o que já foi executado
**Base:** código atual (~3.500 linhas de script), 69 testes automatizados, Fase 3 completa, Fase 4 bloco G entregue
**Data:** agosto de 2026

---

## 0. Onde o projeto está

```
✅ FASE 1  refino local (~85%, o restante foi absorvido pela Fase 3)
✅ FASE 2  PWA + Firestore em tempo real
✅ FASE 3  ONDA RÁPIDA — completa (blocos A, B, C, D)
🔄 FASE 4  PRODUTO — em andamento
   ⬜ E · reestruturação técnica
   ⬜ F · modelo de dados de verdade
   ✅ G · colaboração familiar
   ⬜ H · inteligência de preço          ← o diferencial
   ⬜ I · lojas (Capacitor)
   ⬜ J · qualidade, operação, LGPD
```

**Progresso da Fase 4: 1 de 6 blocos.**

Os dois riscos que abriram este plano estão fechados. O app deixou de perder
dados entre dispositivos e deixou de expor dados a quem soubesse o `projectId`.
Com o bloco G, também deixou de ser um app de uma pessoa só.

**A recomendação da revisão 1 era:** faça o Bloco A antes de qualquer recurso
novo. Feito. **A recomendação desta revisão é:** vá para H1 e H2 antes de E e F.
O motivo está em §4.

---

## 1. O que foi executado

### ✅ Fase 3 — Onda Rápida (completa)

| Bloco | Entregas | Situação |
|---|---|---|
| **A** · segurança e integridade | Firebase Auth (Google + e-mail/senha); `ownerId` → `uid`; regras exigindo autenticação; **merge por item** com lápides; persistência offline; exportar/importar; 3 cópias automáticas; migração do código de sincronização | ✅ |
| **B** · atrito zero na entrada | Parser de campo único (`2kg tomate`); entrada em lote; ditado por voz; dicionário de ~300 produtos br-PT; consolidação de duplicados; sugestões de recompra | ✅ |
| **C** · modo compra | Tela dedicada com alvos de toque grandes; Wake Lock; ordem de corredor por mercado; desfazer de 6 s; ocultar comprados | ✅ |
| **D** · acessibilidade e qualidade | Botões ▲▼; contraste corrigido para AA; status de sincronização legível; convite de instalação; CI com `beta`→`main`; 51 testes; métricas anônimas; documentação em dia | ✅ |

### ✅ Fase 4 · Bloco G — Colaboração familiar (completo)

| Item | Entrega |
|---|---|
| G1 | **Famílias** (`households`) com listas próprias, separadas das pessoais |
| G2 | **Alternador de escopo** no cabeçalho; cada escopo tem estado local e backups próprios |
| G3 | **Convites** por código de 8 caracteres e link; validade de 7 dias; verificados no servidor |
| G4 | **Papéis** responsável / editor / só leitura, com bloqueio real na interface e nas regras |
| G5 | **Presença em tempo real**: avatares de quem está com o app aberto, e "*fulano* está no mercado agora" |
| G6 | **Autoria**: quem adicionou, quem pegou — mostrado só em contexto de família |
| G7 | **Atribuição de item** a um membro ("você pega a padaria") |
| G8 | **Avisos** quando outra pessoa mexe na lista, inclusive com o app em segundo plano |
| G9 | Regras de segurança para `households`, `householdInvites` e presença |
| G10 | 18 testes novos (total: 69) |

### ✅ Correções pontuais

| Problema | Causa | Correção |
|---|---|---|
| Botões "Criar lista"/"Cancelar" inacessíveis | `max-height:88vh` ignora o teclado virtual; o rodapé do modal ficava embaixo do teclado. Agravado pelas sugestões de recompra, que deixaram o modal mais alto | `dvh`, rodapé `sticky`, sem foco automático em telas de toque, e fechamento por Esc / toque fora |
| `2x leite` virava um item chamado "X leite" | Ordem de avaliação do parser | Multiplicador testado antes do padrão de unidade |
| Leite condensado no corredor refrigerado | Grupo errado no dicionário | Movido para Mercearia |

---

## 2. O que falta executar

### ⬜ Bloco E — Reestruturação técnica

Do arquivo único para uma base modular: Vite + TypeScript + **Svelte**
(recomendado; React se a intenção for contratar ajuda depois). Camada de
repositório isolando o Firestore, design system "Cupom" com tokens extraídos do
CSS atual, migração por etapas com o app antigo no ar.

**Esforço:** 5–7 blocos.
**Pré-requisito:** rede de testes — já existe (69 testes, CI).

> **Ressalva.** O arquivo único chegou a ~3.500 linhas de script. Ainda é
> navegável, mas já não é confortável. O ponto de dor prático não é a
> manutenção — é a impossibilidade de reaproveitar componentes e a ausência de
> tipos num modelo de dados que agora tem famílias, papéis, presença e autoria.

### ⬜ Bloco F — Modelo de dados de verdade

```
users/{uid}                          perfil, preferências, ordem de corredores
households/{hid}                     ✅ já existe (criado no bloco G)
lists/{listId}                       { householdId | ownerUid, name, recurring, order }
lists/{listId}/items/{itemId}        escrita granular
purchases/{purchaseId}               compra finalizada (snapshot imutável + total real)
priceHistory/{uid}/entries/{id}      { normalizedName, store, unitPrice, date, source }
catalog/{productId}                  dicionário compartilhado, somente leitura
```

**Por que ainda importa, mesmo com o merge funcionando:** o merge por item
resolve a perda de dados, mas o documento continua monolítico. Toda mudança
remota traz o estado inteiro pela rede, o histórico faz o documento crescer sem
teto, e o limite de 1 MiB por documento do Firestore é uma parede real — não
teórica — para uma família ativa depois de alguns meses.

**Esforço:** 4–6 blocos. **Migração:** função única no primeiro login, com o
documento antigo preservado por 90 dias.

### ⬜ Bloco H — Inteligência de preço *(o diferencial)*

Ordem deliberada, do menor para o maior risco:

| | O quê | Risco | Esforço |
|---|---|---|---|
| **H1** | Total real vs. estimado ao finalizar; gasto por compra ao longo do tempo | baixo | 1 bloco |
| **H2** | Histórico de preço por item e por mercado | baixo | 1–2 blocos |
| **H3** | **Spike:** captura automática — QR code da NFC-e *ou* foto do cupom com OCR | **a investigar** | 1–2 blocos |
| **H4** | Inflação pessoal e previsão de recompra | médio | 2 blocos |
| **H5** | Lista sugerida automaticamente a partir dos padrões | médio | 1–2 blocos |

⚠️ **A ressalva de viabilidade do H3 continua de pé.** Não existe API pública
nacional unificada de NFC-e para o consumidor: a consulta é por portal estadual
da SEFAZ, cada um com seu formato, alguns com captcha, estabilidade variável.
Critério de decisão do spike: **taxa de sucesso ≥ 80% em 20 cupons reais de pelo
menos 3 mercados diferentes**. Se nenhuma abordagem passar, o diferencial se
sustenta em H1+H2+H4 e o spike é encerrado sem custo afundado.

### ⬜ Bloco I — Presença nas lojas

Capacitor empacotando o PWA. Recursos nativos que valem a pena: câmera (H3),
notificações push, atalhos, widget de "adicionar item". Reservar um bloco inteiro
só para a burocracia da primeira submissão — ela sempre demora mais que o
previsto.

**Esforço:** 3–4 blocos.

### ⬜ Bloco J — Qualidade, operação e conformidade

- **Testes:** Vitest na lógica (já há 69, migrar do harness caseiro); Playwright
  nos 6 fluxos críticos.
- **Push de verdade (FCM):** o bloco G entrega aviso com o app em segundo plano.
  Push com o app **fechado** exige FCM + Cloud Function para enviar — não é
  possível só no cliente. Fica aqui.
- **Monitoramento:** Sentry, analytics respeitoso de privacidade, alerta de custo
  do Firestore.
- **LGPD:** política de privacidade, consentimento, exportação de dados do
  usuário, exclusão de conta com apagamento efetivo. Dados de compra são dados de
  comportamento de consumo — exigem cuidado real, não um texto de rodapé. **Isso
  ficou mais urgente com o bloco G**: agora há dados de terceiros (membros da
  família) sob a sua responsabilidade.
- **Feature flags** para liberar gradualmente e desligar sem republicar.

**Esforço:** 4–5 blocos.

---

## 3. Pendências menores acumuladas

Coisas pequenas que apareceram no caminho e ainda não foram feitas:

| # | Pendência | Origem | Esforço |
|---|---|---|---|
| 1 | **Mover uma lista entre pessoal e família** sem exportar/importar | bloco G | P |
| 2 | Convite só cria **editor**; não dá para convidar direto como "só leitura" pela interface (as regras já suportam) | bloco G | P |
| 3 | Revogar um convite já emitido | bloco G | P |
| 4 | Modo Resumida/Completa continua sendo uma decisão que o usuário toma; deveria virar revelação progressiva automática | diagnóstico UX rev. 1 | M |
| 5 | Re-render completo perde posição de scroll acima de ~60 itens | diagnóstico rev. 1 | M |
| 6 | Wake Lock não funciona em parte do iOS — sem alternativa hoje | bloco C | — |
| 7 | Categoria automática não cobre itens regionais | bloco B | P |

---

## 4. Recomendação de sequência

**Vá para H1 e H2 antes de E e F.**

O argumento: E e F são reestruturação — custam 9 a 13 blocos e o usuário não
percebe **nada**. H1 e H2 custam 2 a 3 blocos e entregam a primeira coisa que
alguém pagaria para ter. Fazer a reestruturação primeiro é a ordem correta pela
engenharia e a errada pelo produto, porque adia por meses a validação da única
hipótese que sustenta a Fase 4 inteira: *as pessoas se importam com o histórico
de preços?*

H1 e H2 cabem na arquitetura atual sem forçar. Se a resposta for não, você
economizou a reescrita. Se for sim, você entra em E e F sabendo exatamente o que
o modelo de dados precisa suportar — o que é bem melhor do que projetar
`priceHistory` no escuro.

```
PRÓXIMO   H1 · total real vs. estimado         1 bloco   ← comece por aqui
          H2 · histórico de preço por mercado  1–2 blocos
          ── ponto de decisão: vale seguir? ──
DEPOIS    H3 · spike de captura de cupom       1–2 blocos
          E  · reestruturação técnica          5–7 blocos
          F  · modelo de dados granular        4–6 blocos
          H4/H5 · inflação e previsão          3–4 blocos
          J  · LGPD, push, monitoramento       4–5 blocos
          I  · lojas                           3–4 blocos
```

**A exceção:** se o uso familiar crescer rápido e o documento da família começar
a incomodar (lentidão ao abrir, custo de leitura subindo), F sobe na fila
imediatamente. A instrumentação do bloco D já mede o suficiente para perceber
isso antes de virar problema.

---

## 5. Métricas de sucesso

| Métrica | Definição | Meta | Já dá para medir? |
|---|---|---|---|
| **North Star** | Compras finalizadas por família por mês | ≥ 3 | ✅ D7 |
| Ativação | % que finaliza a 1ª compra em 7 dias | ≥ 40% | ✅ D7 |
| Atrito de entrada | Segundos entre abrir e ter o item na lista | ≤ 8 s | parcial |
| Retenção W4 | % ativos 4 semanas após o cadastro | ≥ 25% | ⬜ precisa de J |
| **Colaboração** | % de famílias com 2+ membros ativos | ≥ 30% | ✅ G + D7 |
| Confiabilidade | Incidentes de perda de dados | **0** | ✅ |

As perguntas que a revisão 1 dizia que só tínhamos por dedução — quantos itens
tem uma lista real, por onde os itens entram, se o modo Resumida é usado —
já têm instrumentação. **Vale olhar `metricasLista()` antes de decidir H4/H5.**

---

## 6. Modelo de negócio (se houver intenção de mercado)

Mantido da revisão 1, com uma correção que o bloco G impõe:

- **Grátis, para sempre:** listas e itens ilimitados, offline, PWA, **1 família
  com até 2 pessoas**.
- **Pro (~R$ 9,90/mês ou R$ 69/ano):** histórico de preços completo, inflação
  pessoal, importação de cupom, **famílias ilimitadas e sem limite de membros**,
  previsão de recompra.
- **Sem anúncios.** O público é sensível a preço; anúncio de supermercado dentro
  do app destrói a confiança de que a recomendação é honesta.

> **A correção:** o bloco G foi entregue sem limite de membros. Colocar limite
> depois seria cobrar por algo já dado de graça — exatamente o que a revisão 1
> disse para nunca fazer. Se a intenção de mercado for real, o limite precisa
> ser definido **agora**, antes de existirem famílias grandes em uso. Se não
> for, a questão desaparece.

---

## 7. Decisões ainda em aberto

1. **Uso pessoal/familiar ou produto de mercado?** Continua sendo a pergunta que
   destrava todas as outras. Sem resposta, o bloco J (LGPD) fica num limbo
   desconfortável — porque o bloco G já criou dados de terceiros.
2. **Framework da Fase 4:** Svelte (recomendado) ou React?
3. **Vale o spike H3** de captura de cupom, ou o diferencial se sustenta em
   H1+H2+H4?
4. **Novo:** limite de membros por família no plano grátis — decidir antes de
   haver famílias grandes.

---

## 8. Visão de conjunto

```
✅ FEITO
   Fase 1 · refino local
   Fase 2 · PWA + Firestore em tempo real
   Fase 3 · A segurança · B entrada · C modo compra · D qualidade
   Fase 4 · G colaboração familiar
   + correção do modal inacessível

🔄 PRÓXIMO
   H1 · total real vs. estimado          ← 1 bloco, valor imediato
   H2 · histórico de preço por mercado   ← o começo do diferencial

⬜ DEPOIS
   H3 spike · E reestruturação · F dados granulares
   H4/H5 inflação e previsão · J LGPD e operação · I lojas
```

**Em uma frase:** a fundação está pronta e o app já serve uma família de verdade;
o próximo passo não é reescrever, é descobrir se o histórico de preços importa —
e isso custa um bloco.
