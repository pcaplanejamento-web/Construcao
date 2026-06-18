# 🏗️ Sistema de Gestão de Obras

Sistema web para **gerenciar obras e acompanhar despesas em tempo real**. Cada
usuário cadastra suas próprias obras e registra despesas (item, valor,
classificação, data) com totais atualizados na hora. Um usuário **administrador**
cadastra os demais usuários e define as configurações de cada um.

## Stack

| Camada      | Tecnologia |
|-------------|------------|
| Frontend    | **Web Components** puros (Custom Elements + ES Modules) — sem build, sem dependências |
| Backend/API | **Google Apps Script** (Web App `doPost`/`doGet`, JSON) |
| Banco       | **Google Sheets** (uma planilha com várias abas) |
| Hospedagem  | GitHub Pages (frontend estático) + Web App do Apps Script (API) |

## Funcionalidades

- 🔐 **Login** por e-mail e senha (senha com hash SHA-256 + salt).
- 🏢 Cada usuário cadastra e gerencia **suas próprias obras**.
- 💸 Registro de **despesas** com item, valor, **classificação** e data.
- 📊 **Dashboard em tempo real**: total gasto, orçamento, saldo e gasto por categoria.
- 🏷️ **Categorias** globais + categorias próprias por usuário.
- 👤 **Admin** cadastra usuários e define **configurações por usuário** (chave-valor).

## Como rodar localmente

O frontend é estático — basta servir a pasta raiz com qualquer servidor HTTP:

```bash
# Python
python3 -m http.server 8123
# ou Node
npx serve .
```

Abra `http://localhost:8123`. Para que o login funcione, configure a API
(veja **[SETUP-E-DEPLOY.md](SETUP-E-DEPLOY.md)**) e cole a URL do Web App em
[`src/core/config.js`](../src/core/config.js).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [ARQUITETURA.md](ARQUITETURA.md) | Camadas, fluxo de uma requisição e decisão de CORS. |
| [PRINCIPIOS-DE-EXECUCAO.md](PRINCIPIOS-DE-EXECUCAO.md) | As regras que governam todo o sistema. |
| [COMPONENTES.md](COMPONENTES.md) | Catálogo de cada Web Component (props/eventos). |
| [API.md](API.md) | Contrato JSON de cada `action`. |
| [MODELO-DE-DADOS.md](MODELO-DE-DADOS.md) | Abas e colunas do Google Sheets. |
| [SETUP-E-DEPLOY.md](SETUP-E-DEPLOY.md) | Passo a passo de configuração e deploy. |

## Estrutura do projeto

```
.
├── index.html              # carrega src/app.js
├── src/
│   ├── app.js              # composition root (rotas + boot)
│   ├── core/               # camada compartilhada (api, auth, router, store, bus, utils)
│   ├── components/         # primitivos reutilizáveis (ui-*) — sem regra de negócio
│   ├── features/           # componentes de domínio (obras, despesas, dashboard, admin, auth)
│   └── styles/             # tokens, reset, layout global
├── apps-script/            # backend (deploy via clasp)
└── docs/                   # esta documentação
```

> **Onde começar a ler o código:** [`src/app.js`](../src/app.js) →
> [`src/features/app-shell.js`](../src/features/app-shell.js) →
> [`src/features/obras/obra-detail-view.js`](../src/features/obras/obra-detail-view.js)
> (o coração do "tempo real"). No backend, comece por
> [`apps-script/Code.gs`](../apps-script/Code.gs).
