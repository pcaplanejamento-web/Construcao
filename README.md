# 🏗️ Sistema de Gestão de Obras

SPA de **gestão de obras e despesas em tempo real**, com login, multiusuário e
painel de administração. Frontend em **Web Components** puros (sem build) e
backend em **Google Apps Script + Google Sheets**.

```
index.html → src/app.js → core/ (api, auth, router) + components/ (ui-*) + features/ (domínio)
                                   │ fetch (simple request)
                                   ▼
                        Apps Script Web App (doPost) → Google Sheets
```

## Começo rápido

1. **Backend:** suba `apps-script/` (clasp ou editor), defina as Script
   Properties `ADMIN_EMAIL`/`ADMIN_SENHA`, rode `bootstrapAdmin()` e publique
   como Web App ("Qualquer pessoa").
2. **Frontend:** cole a URL `/exec` em [`src/core/config.js`](src/core/config.js)
   e sirva a raiz (`python3 -m http.server 8123`).

Passo a passo completo: **[docs/SETUP-E-DEPLOY.md](docs/SETUP-E-DEPLOY.md)**.

## Documentação

- 📖 [Visão geral](docs/README.md)
- 🧭 [Arquitetura](docs/ARQUITETURA.md)
- 📜 [Princípios de execução](docs/PRINCIPIOS-DE-EXECUCAO.md)
- 🧩 [Catálogo de componentes](docs/COMPONENTES.md)
- 🔌 [Contrato da API](docs/API.md)
- 🗃️ [Modelo de dados](docs/MODELO-DE-DADOS.md)

## Funcionalidades

Login • header persistente + menu lateral em abas • obras por usuário •
compartilhamento de obras entre usuários • despesas com classificação •
dashboard de gastos em tempo real • classificações próprias por usuário •
página de perfil com troca de senha • carregamento único com cache (todas as
telas instantâneas) • admin cadastra usuários e define configurações.
