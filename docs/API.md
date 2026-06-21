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
| `dados.snapshot` | `{}` | `{ usuario, config, categorias, obras, despesas:{obraId:[...]}, resumos:{obraId:{...}}, categoriasPorObra:{obraId:[...]}, participantesPorObra:{obraId:[...]}, fornecedores:[...], contatos:[...], cargos:[...], itens:[...], cotacoes:[...], precosPorCotacao:{cotacaoId:[...]}, historicoPorCotacao:{cotacaoId:[...]}, usuarios?, servidor_em }` — TUDO numa chamada (carregamento único + cache). `usuarios` só para admin. |

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
| `publico.obra` | `{ token }` | `{ obra:{nome,endereco,descricao,orcamento,status}, resumo, despesas:[{item,valor,data,categoria_nome,categoria_cor}] }` — **não** expõe usuários/observações |

### Usuários (autenticado)
| Action | `data` | Retorno |
|--------|--------|---------|
| `usuarios.listar` | `{}` | `{ usuarios: [{id,nome,email}] }` (ativos, exceto você — usado no compartilhamento) |

### Despesas
| Action | `data` | Retorno |
|--------|--------|---------|
| `despesas.listar` | `{ obra_id }` | `{ despesas: [...] }` (cada despesa inclui `criado_em`/`autor_nome` e `atualizado_em`/`editor_nome` — auditoria) |
| `despesas.resumo` | `{ obra_id }` | `{ total, qtd, orcamento, saldo, por_subclassificacao:[{categoria_id,nome,cor,total}], por_classificacao:[{nome,cor,total}], por_categoria (alias de por_subclassificacao) }` |
| `despesas.criar` | `{ obra_id, item_id, valor, categoria_id?, data, observacao?, pago?, pagamentos?, responsaveis? }` | `{ despesa, resumo }` — **`item_id` obrigatório**; servidor deriva `item`(nome)+`classificacao` do item; `categoria_id` = subclassificação (opcional) |
| `despesas.atualizar` | `{ id, ...campos }` (`item_id` re-deriva nome+classificação; inclui `pago`/`pagamentos`/`responsaveis`) | `{ despesa, resumo }` |
| `despesas.remover` | `{ id }` | `{ id, resumo }` |

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

### Categorias (= Subclassificações na UI)
| Action | `data` | Retorno |
|--------|--------|---------|
| `categorias.listar` | `{}` | `{ categorias: [...] }` (GLOBAL + do usuário) |
| `categorias.criar` | `{ nome, cor? }` | `{ categoria }` (própria do usuário; grava `criado_em`/`autor_nome`) |
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
| `itens.criar` | `{ nome, classificacao }` | `{ item }` (`classificacao` ∈ `Material`/`Serviço`; default `Material`; grava `autor_nome`) |
| `itens.atualizar` | `{ id, nome?, classificacao? }` | `{ item }` |
| `itens.remover` | `{ id }` | `{ id }` (remoção lógica, `ativo=false`) |

### Compras — Cotações + ofertas
| Action | `data` | Retorno |
|--------|--------|---------|
| `cotacoes.listar` | `{}` | `{ cotacoes: [...] }` |
| `cotacoes.criar` | `{ item_id, quantidade?, unidade?, categoria_id?, obra_id?, status? }` | `{ cotacao }` — **`item_id` obrigatório**; servidor deriva `descricao`(nome)+`classificacao`; `categoria_id` = subclassificação |
| `cotacoes.atualizar` | `{ id, ...campos }` (`item_id` re-deriva descrição+classificação) | `{ cotacao }` |
| `cotacoes.remover` | `{ id }` | `{ id }` (remove a cotação e suas ofertas) |
| `cotacoes.adicionarPreco` | `{ cotacao_id, contato_id, valor_unit, prazo_entrega?, observacao?, orcamento_id? }` | `{ preco, historico }`. Com `orcamento_id`, o `contato_id` é **forçado** ao ofertante do orçamento. |
| `cotacoes.atualizarPreco` | `{ id, contato_id?, valor_unit?, prazo_entrega?, observacao? }` | `{ preco, historico }` (`historico` só se o valor mudou; senão `null`) |
| `cotacoes.removerPreco` | `{ id }` | `{ id, cotacao_id }` (mantém o histórico; **bloqueia** se registrada) |
| `cotacoes.escolherPreco` | `{ id }` | `{ precos }` (marca a escolhida e desmarca as demais da cotação) |
| `cotacoes.registrarDespesa` | `{ preco_id, obra_id, categoria_id? }` | `{ despesa, resumo, precos, cotacao }` |

### Compras — Orçamentos (container de ofertas)
| Action | `data` | Retorno |
|--------|--------|---------|
| `orcamentos.listar` | `{}` | `{ orcamentos: [...] }` |
| `orcamentos.criar` | `{ tipo, fornecedor_id?, contato_id, obra_id?, titulo? }` | `{ orcamento }` — Material exige `fornecedor_id` + `contato_id` (vendedor do fornecedor); Serviço exige só `contato_id` |
| `orcamentos.atualizar` | `{ id, ...campos }` | `{ orcamento }` — se `contato_id` muda, **propaga** às ofertas |
| `orcamentos.remover` | `{ id }` | `{ id }` — remove o orçamento + ofertas (cascade); **bloqueia** se alguma oferta virou despesa |

> Snapshot inclui `orcamentos`. As ofertas do orçamento vêm em `precosPorCotacao`
> (têm `cotacao_id`); o cliente as agrupa por `orcamento_id`.

> **Registrar como despesa** (`cotacoes.registrarDespesa`): cria a despesa na obra
> (item = descrição da cotação, valor = `valor_unit × quantidade`), **marca a
> oferta** (`despesa_id` + `escolhido` exclusivo) e **fecha a cotação**
> (`status="fechada"`) — tudo atômico no servidor (reusa `_novaDespesa`).

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
