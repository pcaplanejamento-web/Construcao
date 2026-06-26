# Contrato da API

A API é um **único Web App** do Apps Script. Um `doPost` despacha por `action`.

## Envelope

**Requisição** (sempre POST, "simple request" — sem `Content-Type` custom):
```json
{ "action": "despesas.criar", "token": "uuid-da-sessao", "data": { } }
```

**Resposta** (sempre HTTP 200):
```json
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "NAO_AUTENTICADO", "message": "Sessão inválida." } }
```

`doGet` retorna um health-check: `{ ok:true, data:{ service, status, versao, horario } }`.

## Autenticação

- Toda action **exceto `auth.login`** exige `token`.
- O token é validado em cache → aba `Sessoes` → checagem de `expira_em`.
- Actions `admin.*` exigem `role === "admin"` (verificado no servidor).
- O `usuario_id` vem **sempre da sessão**; valores de cliente são ignorados.

## Códigos de erro

`REQUISICAO_INVALIDA`, `ACAO_DESCONHECIDA`, `NAO_AUTENTICADO`, `NAO_AUTORIZADO`,
`CREDENCIAIS_INVALIDAS`, `NAO_ENCONTRADO`, `VALIDACAO`, `CONFLITO`, `INTERNO`.

---

## Actions

### Autenticação
| Action | `data` | Retorno |
|--------|--------|---------|
| `auth.login` | `{ email, senha }` | `{ token, usuario, config }` |
| `auth.logout` | `{}` | `{ encerrada: true }` |
| `auth.me` | `{}` | `{ usuario, config }` |
| `auth.alterarSenha` | `{ senhaAtual, novaSenha }` | `{ alterada: true }` (o próprio usuário) |

> **Auditoria universal:** toda entidade grava `criado_em`/`autor_nome` (criação) e
> `atualizado_em`/`editor_nome` (edição), com o nome resolvido no servidor
> (`buscarUsuarioPorId(...).nome`). Esses campos vêm em todos os retornos.

> **Bloqueio de exclusão:** `itens.remover`, `fornecedores.remover`, `contatos.remover`,
> `categorias.remover`, `cargos.remover` e `cotacoes.removerPreco` lançam
> `ERRO.VALIDACAO` ("… vinculado; remova os vínculos primeiro") quando a entidade
> ainda tem vínculos. O cliente também antecipa via banner (`features/shared/vinculos.js`).

### Estado inicial (cache-first)
| Action | `data` | Retorno |
|--------|--------|---------|
| `dados.snapshot` | `{}` | `{ usuario, config, categorias, obras, despesas:{obraId:[...]}, resumos:{obraId:{...}}, categoriasPorObra:{obraId:[...]}, participantesPorObra:{obraId:[...]}, fornecedores:[...], contatos:[...], cargos:[...], itens:[...], cotacoes:[...], ofertas:[...], historicoPorCotacao:{cotacaoId:[...]}, orcamentos:[...], usuarios?, servidor_em }` — TUDO numa chamada (carregamento único + cache). `ofertas` é a **lista plana** de todas as ofertas do usuário (independentes da cotação). `usuarios` só para admin. |

### Obras (próprias + compartilhadas)
Cada obra inclui `ehDono` (bool), `dono_nome`/`dono_email` e `total_gasto`.
Editar/remover/compartilhar exigem ser o **dono**; ver e lançar despesas valem
para dono **e** colaboradores.

| Action | `data` | Retorno |
|--------|--------|---------|
| `obras.listar` | `{}` | `{ obras: [...] }` (próprias + compartilhadas comigo) |
| `obras.obter` | `{ id }` | `{ obra, categorias, compartilhamentos }` |
| `obras.criar` | `{ nome, endereco?, descricao?, orcamento?, status? }` | `{ obra }` |
| `obras.atualizar` | `{ id, ...campos }` | `{ obra }` (só dono) |
| `obras.remover` | `{ id }` | `{ id }` (só dono; remove despesas e compartilhamentos) |
| `obras.compartilhamentos` | `{ obra_id }` | `{ compartilhamentos: [{usuario_id,nome,email}] }` (só dono) |
| `obras.compartilhar` | `{ obra_id, usuario_id }` | `{ compartilhamentos }` (só dono) |
| `obras.descompartilhar` | `{ obra_id, usuario_id }` | `{ compartilhamentos }` (só dono) |
| `obras.gerarLink` | `{ obra_id }` | `{ link_token }` (só dono — token curto de 12 chars) |
| `obras.removerLink` | `{ obra_id }` | `{ link_token: "" }` (só dono — desativa o link) |
| `obras.acessosLink` | `{ obra_id }` | `{ total, acessos:[{acessado_em}] }` (só dono — log de acessos ao link) |

### Público (sem login — somente leitura)
| Action | `data` | Retorno |
|--------|--------|---------|
| `publico.obra` | `{ token }` | Obra INTEIRA p/ a visão pública somente-leitura (todas as abas): `{ obra:{id,nome,endereco,descricao,orcamento,status}, resumo, despesas:[{item,valor,data,classificacao,categoria_nome,categoria_cor}] (itens), despesasRaw (cru → balanços/acerto), participantes, categorias, fornecedores, contatos, equipes (estes três **só os referenciados** nesta obra — privacidade), orcamentos, transferencias, pagamentos, tiposTransferencia }` — **não** expõe usuários/observações nem dados de outras obras do dono |

### Usuários (autenticado)
| Action | `data` | Retorno |
|--------|--------|---------|
| `usuarios.listar` | `{}` | `{ usuarios: [{id,nome,email}] }` (ativos, exceto você — usado no compartilhamento) |

### Despesas
| Action | `data` | Retorno |
|--------|--------|---------|
| `despesas.listar` | `{ obra_id }` | `{ despesas: [...] }` (cada despesa inclui `criado_em`/`autor_nome` e `atualizado_em`/`editor_nome` — auditoria) |
| `despesas.resumo` | `{ obra_id }` | `{ total, qtd, orcamento, saldo, por_subclassificacao:[{categoria_id,nome,cor,total}], por_classificacao:[{nome,cor,total}], por_categoria (alias de por_subclassificacao) }` |
| `despesas.criar` | `{ obra_id, item_id, valor, categoria_id?, data, observacao?, pago?, pagamentos?, responsaveis? }` | `{ despesa, resumo }` — **`item_id` obrigatório**. ⚠️ O front **não** usa mais esta action: despesas são criadas só por `cotacoes.registrarDespesa` (oferta). Mantida no servidor por segurança/legado. |
| `despesas.atualizar` | `{ id, ...campos }` (`item_id` re-deriva nome+classificação; inclui `responsaveis`; `pagamentos` é derivado das levas, não enviado) | `{ despesa, resumo }` |
| `despesas.remover` | `{ id }` | `{ id, resumo, preco, cotacao }` — se a despesa veio de uma **oferta** (`preco_id`), **reverte o registro**: desvincula a oferta (`despesa_id=""`, `escolhido=false`) e **reabre a cotação** (`status="aberta"`), devolvendo a oferta/cotação atualizadas (`preco`/`cotacao`; `null` se não havia). **Estoque (itens 18/19/20):** se a despesa virou estoque (`entrada_despesa`) e parte já foi consumida (`em_estoque < qtd`), **bloqueia** com instrução (devolver na aba Estoque › Consumidos); senão exclui e **remove a entrada** (reduz o saldo). |
| `despesas.lancarPagamento` | `{ despesa_id, valor, pagador, data?, distribuicao? }` | `{ despesa, resumo }` — lança um pagamento **parcial (leva)** ao ofertante. `pagador` (chave de participante) é **obrigatório**; o servidor **deriva `pagamentos`** (quem pagou quanto → acerto) somando as levas por `pagador`. Deriva o recebedor (equipe → líder + exige `distribuicao`; senão contato ofertante + empresa) e carimba data/autor. Valida `Σrealizados+valor ≤ valor` e (equipe) `Σdistribuicao ≤ valor` |
| `despesas.removerPagamento` | `{ despesa_id, lancamento_id }` | `{ despesa, resumo }` — remove uma leva lançada |

> `pagamentos` = `[{chave, valor}]`, `responsaveis` = `[{chave, pct}]`
> (`chave` = `u:<usuario_id>`/`c:<contato_id>`). Enviados como arrays; persistidos
> como JSON; devolvidos como arrays.

### Participantes da obra
| Action | `data` | Retorno |
|--------|--------|---------|
| `participantes.listar` | `{ obra_id }` | `{ participantes:[{chave,tipo,ref_id,nome,email,origem,eh_responsavel}] }` (dono+compartilhados+contatos) |
| `participantes.adicionarContato` | `{ obra_id, contato_id }` | `{ participante }` (idempotente) |
| `participantes.definirResponsavel` | `{ obra_id, chave, eh_responsavel }` | `{ participantes }` (marca/desmarca responsável) |
| `participantes.remover` | `{ id }` | `{ id }` (só contatos têm linha) |

> **Acerto de contas** (cliente, `despesa-split.acerto`): por participante `pago` = Σ
> pagamentos, `devido` = Σ valor×(pct/100), `saldo` = pago − devido; e `acertos`
> pareados (quem deve a quem). Não há action de servidor — é derivado das despesas.

> **Pagamentos parciais / balanços** (cliente, `despesa-split`): `statusPagamento`
> (A pagar/Em pagamento/Pago) + `totalRealizado`/`restoDespesa`; **`balancos(despesas)`**
> → `porChave` `{pago, recebido, saldoApagar, saldoReceber}` e `porFornecedor`
> `{total, recebido, saldoReceber}`. Modelo **paga ↔ recebe**: cada leva tem `pagador`
> (deduz saldoApagar → vira pago) e um recebedor — ofertante contato `c:`/grupo `e:`/
> empresa (deduz saldoReceber → vira recebido). Alimenta Participantes, a aba Fornecedores
> da obra e as abas **Dados** de contato/fornecedor/equipe. Derivado (sem action).

### Categorias (= Subclassificações na UI)
| Action | `data` | Retorno |
|--------|--------|---------|
| `categorias.listar` | `{}` | `{ categorias: [...] }` (GLOBAL + do usuário) |
| `categorias.criar` | `{ nome, cor?, tipo? }` | `{ categoria }` — `tipo` = `item` (subclassificação, default) \| `fornecedor` (classificação de fornecedor); própria do usuário; grava log |
| `categorias.atualizar` | `{ id, nome?, cor?, ativo? }` | `{ categoria }` (grava `atualizado_em`/`editor_nome`) |
| `categorias.remover` | `{ id }` | `{ id }` (desativa) |

> **Lista livre, todas editáveis:** não há mais subclassificação “só leitura”. As
> padrão **GLOBAL** agora podem ser editadas/removidas por qualquer usuário
> (`_categoriaEditavel` aceita própria ou GLOBAL). Como GLOBAL é compartilhada,
> alterá-la afeta todos: o cache é invalidado para todos via `bumpVersaoCategorias()`
> (versão embutida na chave `categorias:<versao>:<usuarioId>`).

### Compras — Fornecedores (próprios do usuário)
| Action | `data` | Retorno |
|--------|--------|---------|
| `fornecedores.listar` | `{}` | `{ fornecedores: [...] }` (ativos) |
| `fornecedores.criar` | `{ nome, telefone?, email?, cnpj?, categoria_id?, observacao? }` | `{ fornecedor }` |
| `fornecedores.atualizar` | `{ id, ...campos }` | `{ fornecedor }` |
| `fornecedores.remover` | `{ id }` | `{ id }` (desativa) |

### Compras — Contatos (próprios do usuário)
| Action | `data` | Retorno |
|--------|--------|---------|
| `contatos.listar` | `{}` | `{ contatos: [...] }` (ativos) |
| `contatos.criar` | `{ nome, telefone?, email?, cargo?, fornecedor_id?, observacao? }` | `{ contato }` |
| `contatos.atualizar` | `{ id, ...campos }` | `{ contato }` |
| `contatos.remover` | `{ id }` | `{ id }` (desativa) |

> Contato: `cargo` (nome), `fornecedor_id` (obrigatório p/ **Vendedor**),
> `superior_id` (obrigatório p/ **Pedreiro**: contato Mestre de Obra/Engenheiro).
> Validado no servidor (`_validarVinculosContato`).

### Cargos (de contatos)
| Action | `data` | Retorno |
|--------|--------|---------|
| `cargos.listar` | `{}` | `{ cargos:[{id,nome,fixo,criado_em?,atualizado_em?}] }` (6 fixos + extras) |
| `cargos.criar` | `{ nome }` | `{ cargo }` (nome único; log de criação) |
| `cargos.atualizar` | `{ id, nome }` | `{ cargo }` (só extras) |
| `cargos.remover` | `{ id }` | `{ id }` (só extras) |

### Itens (catálogo Material/Serviço)
| Action | `data` | Retorno |
|--------|--------|---------|
| `itens.listar` | `{}` | `{ itens:[{id,nome,classificacao,ativo,criado_em,atualizado_em,autor_nome,editor_nome}] }` (ativos, por nome) |
| `itens.criar` | `{ nome, classificacao, categoria_id }` | `{ item }` (`classificacao` ∈ `Material`/`Serviço`; **`categoria_id` = subclassificação OBRIGATÓRIA**; grava `autor_nome`) |
| `itens.atualizar` | `{ id, nome?, classificacao?, categoria_id? }` | `{ item }` (`categoria_id` não pode ficar vazio) |
| `itens.remover` | `{ id }` | `{ id }` (remoção lógica, `ativo=false`) |

### Compras — Cotações + ofertas
| Action | `data` | Retorno |
|--------|--------|---------|
| `cotacoes.listar` | `{}` | `{ cotacoes: [...] }` |
| `cotacoes.criar` | `{ categoria_id, quantidade?, unidade?, obra_id?, status? }` | `{ cotacao }` — **modo ÚNICO `subclasse`** + **get-or-create: 1 cotação por subclassificação** (se já existe uma p/ a `categoria_id` do usuário, devolve a existente — não duplica). `categoria_id` obrigatório; `descricao` = nome da subclasse; `item_id` vazio (cada oferta define o item). Migrações: `mig_cotacoes_subclasse_v1` (converte "por item" → subclasse) + `mig_cotacoes_unicas_v1` (unifica duplicatas da mesma subclasse: reatribui ofertas+histórico e remove as duplicatas) |
| `cotacoes.atualizar` | `{ id, ...campos }` (ao mudar `categoria_id`, re-deriva `descricao` = nome da subclasse) | `{ cotacao }` |
| `cotacoes.remover` | `{ id }` | `{ id }` (remove a cotação e suas ofertas) |
| `cotacoes.adicionarPreco` | `{ item_id, cotacao_id?, orcamento_id?, contato_id?, equipe_id?, fornecedor_id?, valor_unit, quantidade?, valor_unit_desconto?, prazo_entrega, observacao? }` | `{ preco, historico }`. **Criar oferta** (universal): `item_id` obrigatório; cotação/orçamento opcionais. Pela classificação do item — **Material**: fornecedor obrigatório, ofertante opcional; **Serviço**: ofertante obrigatório, fornecedor opcional. `prazo_entrega` obrigatório. Dentro de orçamento, herda ofertante/fornecedor dele. Grava `usuario_id`. |
| `cotacoes.atualizarPreco` | `{ id, item_id?, contato_id?, equipe_id?, fornecedor_id?, valor_unit?, quantidade?, valor_unit_desconto?, prazo_entrega?, observacao? }` | `{ preco, historico }` (`historico` só se o valor mudou; senão `null`) |
| `cotacoes.removerPreco` | `{ id }` | `{ id, cotacao_id }` (mantém o histórico; **bloqueia** se registrada) |
| `cotacoes.escolherPreco` | `{ id }` | `{ precos }` (marca a escolhida e desmarca as demais da cotação) |
| `cotacoes.registrarDespesa` | `{ preco_id, obra_id, categoria_id?, responsaveis? }` | `{ despesa, resumo, precos, cotacao, preco }` — **único caminho** p/ criar despesa. Item/fornecedor vêm da **oferta** (`cotacao` é opcional → `null` p/ avulsa/orçamento). Valor = `(valor_unit_desconto||valor_unit) × (preco.quantidade||cotacao.quantidade)`; **subclassificação herdada do item**. "Orçamento completo" = o front chama esta action por oferta. |

### Compras — Orçamentos (container de ofertas)
| Action | `data` | Retorno |
|--------|--------|---------|
| `orcamentos.listar` | `{}` | `{ orcamentos: [...] }` |
| `orcamentos.criar` | `{ tipo, fornecedor_id?, contato_id?, equipe_id?, obra_id?, titulo? }` | `{ orcamento }` — Material exige `fornecedor_id` + `contato_id` (vendedor); Serviço exige o **ofertante = contato_id OU equipe_id** |
| `orcamentos.atualizar` | `{ id, ...campos }` | `{ orcamento }` — se o **ofertante** (contato/equipe) muda, **propaga** `contato_id`/`equipe_id` às ofertas |
| `orcamentos.remover` | `{ id }` | `{ id }` — remove o orçamento + ofertas (cascade); **bloqueia** se alguma oferta virou despesa |

> Snapshot inclui `orcamentos` e a **lista plana `ofertas`** (toda `CotacaoPrecos` do
> usuário). O cliente filtra: `precosDaCotacao` (por `cotacao_id`), `ofertasDoOrcamento`
> (por `orcamento_id`), `todasOfertas` (a lista inteira — aba Ofertas).

### Equipes (grupos: líder + membros + obras)
| Action | `data` | Retorno |
|--------|--------|---------|
| `equipes.listar` | `{}` | `{ equipes: [...] }` (membros/obras como arrays) |
| `equipes.criar` | `{ nome, lider_id, membros?, obras? }` | `{ equipe }` — líder ∈ Mestre de Obra/Engenheiro/Gestor |
| `equipes.atualizar` | `{ id, nome?, lider_id?, membros?, obras? }` | `{ equipe }` (membros/obras = arrays de ids) |
| `equipes.remover` | `{ id }` | `{ id }` (desativa) |

> A antiga validação "Pedreiro → superior" foi **removida** de `contatos.*`;
> o Pedreiro agora é organizado por Equipes. Snapshot inclui `equipes`.

### Transferências (comprovante no Drive)
| Action | `data` | Retorno |
|--------|--------|---------|
| `transferencias.lancar` | `{ obra_id, alocacoes, pagador, tipo, data, distribuicao?, comprovante? }` | `{ transferencia, pagamentos, despesas, resumo }` — `comprovante` (opcional) = `{ base64, nome, mime }` (PDF/imagem ≤10MB); salvo no Drive e vinculado. Drive falhar **não** derruba a transferência |
| `transferencias.remover` | `{ id }` | `{ id, despesas, resumo }` — cascata; **exclui o comprovante** do Drive |
| `transferencias.anexarComprovante` | `{ id, comprovante:{base64,nome,mime} }` | `{ transferencia }` — anexa ou **substitui** (trasheia o antigo) |
| `transferencias.removerComprovante` | `{ id }` | `{ transferencia }` — remove o anexo (e o arquivo no Drive) |

> Arquivos vão para o Drive do dono (escopo `drive`): pasta-raiz do app (`DRIVE_ROOT_FOLDER_ID` em Script Properties) + subpasta por usuário (`Configuracoes.drive_folder_id`). O `comprovante_url` (compartilhado por link) é exposto também em `publico.obra`. **Setup:** rodar `autorizarDrive()` no editor após adicionar o escopo.

### Estoque (livro-razão de movimentos por obra)
| Action | `data` | Retorno |
|--------|--------|---------|
| `estoque.listar` | `{ obra_id }` | `{ movimentos: [...] }` (da obra acessível) |
| `estoque.criarMovimento` | `{ acao, obra_id, item_id, quantidade, obra_destino_id?, observacao? }` | `{ movimentos: [...] }` — `acao` ∈ `consumir` \| `devolver` \| `manual` \| `transferir`. **Limites (item 10):** consumir ≤ em_estoque; devolver ≤ consumido; transferir ≤ em_estoque(origem). `transferir` grava 2 movimentos (saída na origem + entrada no destino com `obra_origem_id`, casados por `par_id`); `manual` herda classificação/subclasse do item (item 16) |
| `estoque.remover` | `{ id }` | `{ removidos: [ids] }` — remove `entrada_manual` ou estorna a transferência (par_id); **bloqueia** `entrada_despesa` (gerida pela despesa) e **bloqueia** se já consumido (devolva antes) |

> O estoque é **automático**: ao QUITAR uma despesa **Material** com `quantidade>0`, o backend cria a `entrada_despesa` (em `_sincronizarEstoqueDaDespesa`/Pagamentos.gs). O snapshot inclui `estoque` (movimentos das obras acessíveis); o cliente consolida por `(obra,item)` no helper puro `estoque.js`.

### E-mail do app (Resend)
| Action | `data` | Retorno |
|--------|--------|---------|
| `email.teste` | `{}` | `{ ok, id, para }` — envia um e-mail de teste **só para o próprio e-mail** do usuário logado |

> **Envio** (`Email.gs` → `enviarEmailResend(para, assunto, html)`): chama a API do Resend
> via `UrlFetchApp`. A **chave nunca fica no código/frontend** — vem das **Script Properties**:
> `RESEND_API_KEY`, `EMAIL_REMETENTE` (ex.: `Dataobra <notificacoes@dattaobra.com.br>`),
> `EMAIL_TESTE` (só p/ `testarEmailResend()` no editor). Domínio verificado no Resend:
> **`dattaobra.com.br`** (apex; o Resend isola o SPF dele num subdomínio `send.`). Helper interno
> reutilizável por futuros alertas/relatórios/link público.

> **Registrar como despesa** (`cotacoes.registrarDespesa`): **único** caminho para
> criar uma despesa (não há mais cadastro manual). Cria a despesa na obra (item =
> descrição da cotação, valor = **valor final** `(valor_unit_desconto||valor_unit) ×
> quantidade` da oferta — oferta **inteira**; a **subclassificação** vem do item),
> grava o **ofertante** (contato XOR equipe do preço) + a **empresa** (`fornecedor`
> do contato; vazio p/ equipe) e a **responsabilidade** (`responsaveis`, % por
> participante); **marca a oferta** (`despesa_id` + `escolhido`) e **fecha a cotação**
> (`status="fechada"`). Valida `Σ responsaveis ≤ 100`. Atômico (reusa `_novaDespesa`).
> A distribuição por integrante (equipe) é feita depois, em cada **leva** de pagamento.

### Admin (exigem role admin)
| Action | `data` | Retorno |
|--------|--------|---------|
| `admin.usuarios.listar` | `{}` | `{ usuarios: [...] }` (sem hash/salt) |
| `admin.usuarios.criar` | `{ nome, email, senha, role }` | `{ usuario }` |
| `admin.usuarios.atualizar` | `{ id, nome?, role?, ativo?, novaSenha? }` | `{ usuario }` |
| `admin.config.obter` | `{ usuario_id }` | `{ config: { chave: valor } }` |
| `admin.config.definir` | `{ usuario_id, chave, valor }` | `{ config }` |

---

## Exemplo (login pelo console do navegador)

```js
const URL = "https://script.google.com/macros/s/SEU_DEPLOY/exec";
const r = await fetch(URL, {
  method: "POST",
  body: JSON.stringify({ action: "auth.login", data: { email: "admin@exemplo.com", senha: "secreta" } }),
});
console.log(await r.json()); // { ok: true, data: { token, usuario, config } }
```
