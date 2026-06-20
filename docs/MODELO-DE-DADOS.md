# Modelo de Dados (Google Sheets)

O banco é **uma planilha** do Google Sheets com várias abas. A linha 1 de cada
aba é o cabeçalho. IDs são UUID (`Utilities.getUuid()`). Datas são strings ISO
(`YYYY-MM-DD`) para evitar ambiguidade de fuso/serial. Valores monetários são
números.

Os nomes de abas/colunas são definidos em um só lugar:
[`apps-script/Schema.gs`](../apps-script/Schema.gs).

## Relações

```
Usuarios 1───* Obras 1───* Despesas *───1 Categorias
Usuarios 1───* Configuracoes
Usuarios 1───* Categorias (próprias)   +   Categorias GLOBAL (compartilhadas)
Usuarios 1───* Sessoes
Obras *───* Usuarios  (via Compartilhamentos — colaboradores convidados)

Módulo Compras (tudo por usuário):
Usuarios 1───* Fornecedores 1───* Contatos
Usuarios 1───* Cotacoes (obra_id opcional) 1───* CotacaoPrecos *───1 Contatos
```

## Aba `Usuarios`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| email | string | login, único (case-insensitive) |
| nome | string | nome de exibição |
| senha_hash | hex | SHA-256 de `salt + senha` |
| salt | hex | salt aleatório por usuário |
| role | `admin` \| `usuario` | papel |
| ativo | boolean | desativa sem apagar |
| criado_em | ISO datetime | |
| criado_por | UUID \| `BOOTSTRAP` | quem criou |

## Aba `Configuracoes` (chave-valor por usuário)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id |
| chave | string | ex.: `moeda`, `tema`, `limite_obras`, `categorias_padrao` |
| valor | string | valor (JSON quando composto) |
| atualizado_em | ISO datetime | |

Modelo flexível: o admin cria chaves arbitrárias sem alterar o schema.

## Aba `Obras`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| nome | string | |
| endereco | string | opcional |
| descricao | string | opcional |
| orcamento | number | orçamento previsto (opcional) |
| status | `ativa` \| `pausada` \| `concluida` | |
| criado_em | ISO datetime | |
| atualizado_em | ISO datetime | |
| link_token | string | token curto (12 chars) do link público de leitura (vazio = desativado) |

## Aba `Despesas`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| obra_id | UUID | FK → Obras.id |
| usuario_id | UUID | FK → Usuarios.id (desnormalizado p/ segurança) |
| item | string | nome do item |
| valor | number | valor da despesa |
| categoria_id | UUID | FK → Categorias.id |
| data | ISO `YYYY-MM-DD` | data da despesa |
| observacao | string | opcional |
| criado_em | ISO datetime | data da adição |
| autor_nome | string | quem adicionou (desnormalizado) |
| atualizado_em | ISO datetime | data da última edição |
| editor_nome | string | quem editou por último (desnormalizado) |

> Auditoria: `criado_em`/`autor_nome` registram a adição; `atualizado_em`/
> `editor_nome` a última edição. Nomes são desnormalizados para exibir sem
> lookup no cliente (definidos no servidor a cada criar/atualizar).

## Aba `Categorias`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID \| `GLOBAL` | dono; `GLOBAL` = padrão do sistema |
| nome | string | ex.: Material, Mão de obra |
| cor | hex | usada pelo `category-badge` |
| ativo | boolean | exclusão é lógica (ativo=false) |

Categorias semente (`GLOBAL`) são criadas no bootstrap. A listagem de um usuário
= categorias `GLOBAL` + as próprias.

## Módulo Compras

Tudo é **por usuário** (`usuario_id` = dono). Cotações comparam ofertas de
contatos; a melhor oferta pode virar uma despesa numa obra (reusa `despesas.criar`).

### Aba `Fornecedores` (empresas/lojas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| nome | string | nome/empresa |
| telefone | string | opcional |
| email | string | opcional |
| cnpj | string | opcional |
| categoria_id | UUID | FK → Categorias.id (opcional) |
| observacao | string | opcional |
| ativo | boolean | exclusão lógica |
| criado_em / atualizado_em | ISO datetime | |

### Aba `Contatos` (pessoas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| nome | string | |
| telefone | string | opcional |
| email | string | opcional |
| cargo | string | opcional |
| fornecedor_id | UUID | FK → Fornecedores.id (opcional — empresa do contato) |
| observacao | string | opcional |
| ativo | boolean | exclusão lógica |
| criado_em / atualizado_em | ISO datetime | |

### Aba `Cotacoes` (necessidade a cotar)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| obra_id | UUID | FK → Obras.id (**opcional**; vazio = cotação geral) |
| descricao | string | item/necessidade |
| quantidade | number | opcional |
| unidade | string | texto livre (un, m², kg, saco…) |
| categoria_id | UUID | FK → Categorias.id (opcional) |
| status | `aberta` \| `fechada` | |
| criado_em / atualizado_em | ISO datetime | |

### Aba `CotacaoPrecos` (oferta de um contato)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| cotacao_id | UUID | FK → Cotacoes.id |
| contato_id | UUID | FK → Contatos.id (quem ofertou) |
| valor_unit | number | valor unitário ofertado |
| prazo_entrega | string | opcional |
| observacao | string | opcional |
| escolhido | boolean | a oferta escolhida (exclusiva por cotação) |
| criado_em | ISO datetime | |

> Total de uma oferta = `valor_unit × quantidade` (calculado no cliente; não
> persiste). Excluir uma cotação remove suas ofertas.

## Aba `Compartilhamentos`
Relaciona obras a usuários convidados (colaboradores). O dono permanece em
`Obras.usuario_id`; cada linha aqui dá acesso de colaboração a outro usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| obra_id | UUID | FK → Obras.id |
| usuario_id | UUID | FK → Usuarios.id (convidado) |
| criado_em | ISO datetime | |

Colaboradores podem ver a obra e lançar/editar despesas; **não** podem editar,
excluir nem compartilhar a obra (só o dono).

## Aba `AcessosLink`
Registra cada acesso ao link público de uma obra (log).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| obra_id | UUID | FK → Obras.id |
| token | string | token do link usado no acesso |
| acessado_em | ISO datetime | quando foi acessado |

## Aba `Sessoes`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| token | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id |
| role | enum | cópia do papel (autorização rápida) |
| criado_em | ISO datetime | |
| expira_em | ISO datetime | +12h do login |
| ultimo_acesso | ISO datetime | |

As sessões ativas também ficam no `CacheService` (TTL ≤ 6h) para validação
rápida; a aba é a fonte de verdade.
