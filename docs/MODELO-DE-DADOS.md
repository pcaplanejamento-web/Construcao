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
| pago | boolean | marcada como paga? |
| pagamentos | JSON | `[{chave, valor}]` — quem pagou quanto (participantes) |
| responsaveis | JSON | `[{chave, pct}]` — de quem é a responsabilidade (% por participante) |

> `chave` de participante = `u:<usuario_id>` ou `c:<contato_id>`. `pagamentos`/
> `responsaveis` são guardados como **JSON string** e devolvidos como **arrays** ao
> cliente (o backend faz parse). Total pago = soma de `pagamentos[].valor`;
> distribuição (Único/Distribuído) é derivada do nº de pagantes.

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

> **Na UI**, a entidade `Categorias` é exibida como **Subclassificação** (lista livre,
> aba "Subclassificações" da página **Itens**). A estrutura da aba não mudou — só o rótulo.
> As classificações fixas (Material/Serviço) ficam em `Itens.classificacao`, não aqui.
> **Todas as subclassificações são editáveis** (não há mais “padrão só leitura”): as
> `GLOBAL` agora podem ser editadas/removidas por qualquer usuário — como são
> compartilhadas, a alteração afeta todos e invalida o cache de todos
> (`bumpVersaoCategorias`, versão na chave `categorias:<versao>:<usuarioId>`).

## Aba `Itens` (catálogo)
Cada item é classificado como **Material** ou **Serviço** (constante
`CLASSIFICACOES_ITEM = ["Material","Serviço"]`). Despesas e cotações referenciarão
um item (Fase 2). Por usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| nome | string | nome do item |
| classificacao | string | `Material` \| `Serviço` (fixas) |
| ativo | boolean | exclusão lógica (ativo=false) |
| criado_em / atualizado_em | ISO datetime | |

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
| cargo | string | nome do cargo (lista fixos + extras) |
| fornecedor_id | UUID | FK → Fornecedores.id (obrigatório p/ **Vendedor**) |
| superior_id | UUID | FK → Contatos.id (obrigatório p/ **Pedreiro**: um Mestre de Obra/Engenheiro) |
| observacao | string | opcional |
| ativo | boolean | exclusão lógica |
| criado_em / atualizado_em | ISO datetime | |

### Aba `Cargos` (cargos extras de contato)
Os 6 obrigatórios (Vendedor, Mestre de Obra, Pedreiro, Engenheiro, Despachante,
Gestor) são **fixos** (constante `CARGOS_OBRIGATORIOS`, não persistidos). Esta aba
guarda só os **extras** criados pelo usuário (com log).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| usuario_id | UUID | FK → Usuarios.id (dono) |
| nome | string | único (não pode repetir fixo/extra) |
| criado_em / atualizado_em | ISO datetime | log de criação/edição |

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
| despesa_id | UUID | FK → Despesas.id (preenchido quando a oferta é **registrada como despesa**) |

> Total de uma oferta = `valor_unit × quantidade` (calculado no cliente; não
> persiste). Excluir uma cotação remove suas ofertas.

### Aba `CotacaoPrecoHistorico` (evolução de preço no tempo)
Log append-only: grava 1 ponto quando uma oferta é **criada** e a cada **edição do
valor**. Alimenta o gráfico de evolução (uma linha por contato).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| cotacao_id | UUID | FK → Cotacoes.id |
| preco_id | UUID | FK → CotacaoPrecos.id (a oferta de origem) |
| contato_id | UUID | FK → Contatos.id |
| valor_unit | number | valor unitário registrado naquele instante |
| registrado_em | ISO datetime | quando o ponto foi gravado |

> O histórico é **preservado** mesmo quando a oferta é editada ou **excluída**
> (o objetivo é acompanhar a evolução). Só é removido em cascade ao excluir a
> **cotação** inteira.

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

## Aba `ObraParticipantes`
Participantes adicionados a uma obra. Dono e usuários compartilhados são
**derivados** (não têm linha); só **contatos adicionados** (e, na Fase 2, usuários
marcados como responsável) viram linha aqui.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| obra_id | UUID | FK → Obras.id |
| tipo | `usuario` \| `contato` | |
| ref_id | UUID | usuario_id ou contato_id |
| nome | string | desnormalizado (exibição) |
| eh_responsavel | boolean | responsável da obra (Fase 2) |
| criado_em | ISO datetime | |

> A lista de participantes de uma obra = dono + compartilhados (derivados de
> `Obras`/`Compartilhamentos`) **+** contatos desta aba. Chave estável:
> `u:<usuario_id>` / `c:<contato_id>`.

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
