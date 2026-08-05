# Checklist de regressão — Lista de Compras

> **Regra:** nenhuma publicação em produção (`main`) sem este checklist verde no `beta`.
> Tempo estimado: 12 a 18 minutos. Vale o incômodo — a alternativa é descobrir o bug
> pelo celular de alguém da família às 22h, com o service worker servindo o arquivo
> quebrado do cache para todo mundo.

**Versão testada:** ______________  **Data:** ____/____/______  **Testado por:** ______________

**Ambiente:** ( ) beta  ( ) produção
**Aparelhos:** ( ) Android  ( ) iPhone  ( ) desktop — *no mínimo um celular real; o
DevTools em modo responsivo não reproduz teclado virtual, wake lock nem instalação de PWA.*

---

## Antes de começar

Rode o portão automático. Se ele falhar, pare aqui — não adianta testar à mão.

```bash
npm run verificar     # sintaxe + 51 testes unitários
```

- [ ] `npm run check` passou
- [ ] `npm test` passou (51/51)
- [ ] `CACHE_NAME` em `sw.js` foi incrementado se `index.html` mudou

---

## Bloco 1 — Conta e sincronização (A1, A2, A4, A5)

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 1 | Abrir o app deslogado | Tela de login aparece; nada do app fica visível atrás | ☐ |
| 2 | Entrar com Google | Entra e as listas da conta carregam | ☐ |
| 3 | Entrar com e-mail/senha inexistente | Mensagem em português, sem código de erro cru | ☐ |
| 4 | "Usar sem conta neste aparelho" | App abre e funciona; pílula mostra *só neste aparelho* | ☐ |
| 5 | **Sincronização real:** abrir a mesma conta em dois aparelhos, adicionar item no A | Aparece no B em poucos segundos, sem recarregar | ☐ |
| 6 | **Merge (o risco crítico):** com os dois aparelhos abertos, adicionar item diferente em cada um ao mesmo tempo | **Os dois itens sobrevivem.** Nenhum some | ☐ |
| 7 | Marcar um item como comprado no A enquanto o B está aberto | B reflete a marcação | ☐ |
| 8 | Excluir um item no A | Some no B e **não volta** depois de alguns segundos | ☐ |
| 9 | Colocar o celular em modo avião, editar a lista, voltar a conexão | Alterações sobem sozinhas; pílula sai de *offline* para *salvo na nuvem* | ☐ |
| 10 | Sair da conta e entrar de novo | As listas voltam íntegras | ☐ |

> **Se o item 6 falhar, é bloqueio de release.** É exatamente a falha que a Fase 3 existe para corrigir.

## Bloco 2 — Entrada de itens (B1, B2, B3, B4, B5)

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 11 | Digitar `2kg tomate` e dar Enter | Item "Tomate", qtd 2, unidade kg, categoria Hortifruti | ☐ |
| 12 | Colar 5 linhas de uma vez | 5 itens criados; marcadores (`-`, `•`, `1.`) removidos | ☐ |
| 13 | Adicionar "leite" duas vezes | Uma linha só, quantidade somada | ☐ |
| 14 | Tocar no microfone e ditar "arroz, feijão e café" | 3 itens; se não houver suporte, o botão nem aparece | ☐ |
| 15 | Abrir "campos detalhados" e adicionar com preço | Item entra com preço; total estimado atualiza | ☐ |

## Bloco 3 — Modo compra (C1, C2, C3, C5)

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 16 | Entrar no Modo compra **segurando o celular com uma mão** | Dá para marcar tudo sem zoom e sem a outra mão | ☐ |
| 17 | Deixar a tela parada 2 minutos no Modo compra | Tela **não** apaga (Android; iOS pode não suportar) | ☐ |
| 18 | Ativar "Ocultar pegos" e marcar itens | Lista encolhe; ao final, mensagem "Tudo pego!" | ☐ |
| 19 | Definir ordem dos corredores e voltar à lista | Categorias seguem a ordem escolhida, não a alfabética | ☐ |
| 20 | Sair do Modo compra | Cabeçalho e abas voltam; rodapé fixo desaparece | ☐ |

## Bloco 4 — Fluxos críticos que não podem regredir

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 21 | Finalizar compra **não recorrente** com itens pendentes | Pergunta sobre carregar pendentes; permite retirar item a item | ☐ |
| 22 | Finalizar compra **recorrente** | Arquiva e cria a próxima com a data certa e itens desmarcados | ☐ |
| 23 | Tocar em "Desfazer" logo após finalizar | Lista volta exatamente como estava | ☐ |
| 24 | Excluir item e tocar em "Desfazer" | Item volta **na mesma posição** | ☐ |
| 25 | Reativar uma compra do histórico ("somente não comprados") | Só os pendentes voltam, desmarcados | ☐ |
| 26 | Gerar PDF | Abre/baixa com itens agrupados e `[x]`/`[ ]` corretos | ☐ |
| 27 | Compartilhar como texto | Texto legível, agrupado por categoria | ☐ |

## Bloco 5 — Dados e recuperação (A6)

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 28 | Exportar backup | Baixa `.json` com data no nome | ☐ |
| 29 | Importar esse mesmo arquivo | Nada duplica (o merge é idempotente) | ☐ |
| 30 | Restaurar uma cópia automática | Combina com o atual, sem apagar nada | ☐ |

## Bloco 6 — PWA, offline e acessibilidade (D1–D4)

| # | Teste | Resultado esperado | OK |
|---|---|---|---|
| 31 | Segunda visita pelo navegador | Convite de instalação aparece; "Agora não" não reaparece | ☐ |
| 32 | Instalar e abrir em modo avião | App abre e mostra as listas | ☐ |
| 33 | Publicar versão nova e reabrir o PWA instalado | Versão nova carrega (não fica presa no cache antigo) | ☐ |
| 34 | Navegar a lista **só com Tab e Enter** | Todo controle é alcançável e o foco é visível | ☐ |
| 35 | Reordenar um item pelos botões ▲▼ | Funciona sem arrastar; o foco permanece no botão | ☐ |
| 36 | Ativar o leitor de tela (TalkBack/VoiceOver) e marcar um item | Anuncia o nome do item e o novo estado | ☐ |
| 37 | Alternar tema claro/escuro | Nenhum texto fica ilegível nos dois temas | ☐ |
| 38 | Abrir o console e rodar `metricasLista()` | Devolve o resumo de uso sem erro | ☐ |

---

## Se algo falhar

1. **Não publique.** Anote o número do item, o aparelho e o passo exato.
2. Se for algo que os testes unitários poderiam ter pego, **escreva o teste antes da correção** — foi assim que os três bugs da entrega da Fase 3 apareceram.
3. Depois de corrigir, rode o checklist inteiro de novo, não só o item que falhou.

## Notas da rodada

```
```

---

### Definition of Done (vale para toda entrega, da Fase 3 em diante)

1. Funciona no Android e no iPhone, em uso real — não só no desktop.
2. Funciona offline, ou degrada com mensagem clara.
3. Não quebra nenhum item deste checklist.
4. Tem alternativa por teclado e rótulo para leitor de tela.
5. Toda ação destrutiva é confirmada ou reversível.
6. A documentação foi atualizada **na mesma entrega**.
7. Está publicada e o usuário consegue usar.
