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

### Usuários (autenticado)
| Action | `data` | Retorno |
|--------|--------|---------|
| `usuarios.listar` | `{}` | `{ usuarios: [{id,nome,email}] }` (ativos, exceto você — usado no compartilhamento) |

### Despesas
| Action | `data` | Retorno |
|--------|--------|---------|
| `despesas.listar` | `{ obra_id }` | `{ despesas: [...] }` |
| `despesas.resumo` | `{ obra_id }` | `{ total, qtd, orcamento, saldo, por_categoria:[{categoria_id,nome,cor,total}] }` |
| `despesas.criar` | `{ obra_id, item, valor, categoria_id, data, observacao? }` | `{ despesa, resumo }` |
| `despesas.atualizar` | `{ id, ...campos }` | `{ despesa, resumo }` |
| `despesas.remover` | `{ id }` | `{ id, resumo }` |

### Categorias
| Action | `data` | Retorno |
|--------|--------|---------|
| `categorias.listar` | `{}` | `{ categorias: [...] }` (GLOBAL + do usuário) |
| `categorias.criar` | `{ nome, cor? }` | `{ categoria }` |
| `categorias.atualizar` | `{ id, nome?, cor?, ativo? }` | `{ categoria }` |
| `categorias.remover` | `{ id }` | `{ id }` (desativa) |

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
