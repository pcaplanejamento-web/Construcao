/**
 * Router.gs — Mapa de actions -> handlers.
 *
 * Cada action aponta para uma função `fn(data, sessao, token)`.
 * `publica: true` dispensa token (apenas auth.login). As demais exigem sessão
 * válida; o dispatcher (Code.gs) valida o token e injeta `sessao`.
 * A autorização de admin é feita DENTRO dos handlers (exigirAdmin), garantindo
 * verificação server-side mesmo se a rota for chamada diretamente.
 */
const ROTAS = {
  // Autenticação
  "auth.login": { fn: authLogin, publica: true },
  "auth.loginGoogle": { fn: authLoginGoogle, publica: true },
  "auth.logout": { fn: authLogout },
  "auth.me": { fn: authMe },
  // Primeiro acesso / esqueci a senha / trocar senha — PIN por e-mail (públicas).
  "auth.solicitarPin": { fn: authSolicitarPin, publica: true },
  "auth.confirmarPin": { fn: authConfirmarPin, publica: true },
  "auth.definirSenha": { fn: authDefinirSenha, publica: true },

  // Config pública (Client ID do Google p/ o botão de login — sem token)
  "config.publico": { fn: configPublico, publica: true },
  // Config do próprio usuário (allowlist: sync_agenda/sync_notas)
  "config.definir": { fn: configDefinir },

  // Estado inicial completo (carregamento único + cache no cliente)
  "dados.snapshot": { fn: dadosSnapshot },

  // E-mail do app (Resend) — teste envia só para o próprio e-mail do usuário.
  "email.teste": { fn: emailTeste },

  // Caixa de e-mail da empresa (GmailApp; backend roda como dattaobra) — admin-only
  "email.caixa.remetentes": { fn: emailCaixaRemetentes },
  "email.caixa.criarEndereco": { fn: emailCaixaCriarEndereco },
  "email.caixa.removerEndereco": { fn: emailCaixaRemoverEndereco },
  "email.caixa.listar": { fn: emailCaixaListar },
  "email.caixa.ler": { fn: emailCaixaLer },
  "email.caixa.enviar": { fn: emailCaixaEnviar },
  "email.caixa.responder": { fn: emailCaixaResponder },
  "email.caixa.encaminhar": { fn: emailCaixaEncaminhar },
  "email.caixa.marcar": { fn: emailCaixaMarcar },
  "email.caixa.marcarVarios": { fn: emailCaixaMarcarVarios },
  "email.caixa.labels": { fn: emailCaixaLabels },
  "email.caixa.aplicarLabel": { fn: emailCaixaAplicarLabel },
  "email.caixa.anexo": { fn: emailCaixaAnexo },
  "email.caixa.rascunhos": { fn: emailCaixaRascunhos },
  "email.caixa.salvarRascunho": { fn: emailCaixaSalvarRascunho },
  "email.caixa.enviarRascunho": { fn: emailCaixaEnviarRascunho },
  "email.caixa.excluirRascunho": { fn: emailCaixaExcluirRascunho },
  "email.caixa.assinatura": { fn: emailCaixaAssinatura },

  // Obras
  "obras.listar": { fn: obrasListar },
  "obras.obter": { fn: obrasObter },
  "obras.criar": { fn: obrasCriar },
  "obras.atualizar": { fn: obrasAtualizar },
  "obras.remover": { fn: obrasRemover },
  "obras.compartilhamentos": { fn: obrasCompartilhamentos },
  "obras.compartilhar": { fn: obrasCompartilhar },
  "obras.descompartilhar": { fn: obrasDescompartilhar },
  "obras.gerarLink": { fn: obrasGerarLink },
  "obras.removerLink": { fn: obrasRemoverLink },
  "obras.acessosLink": { fn: obrasAcessosLink },

  // Visão pública somente-leitura (sem login)
  "publico.obra": { fn: publicoObra, publica: true },

  // Participantes da obra
  "participantes.listar": { fn: participantesListar },
  "participantes.adicionarContato": { fn: participantesAdicionarContato },
  "participantes.definirResponsavel": { fn: participantesDefinirResponsavel },
  "participantes.remover": { fn: participantesRemover },

  // Despesas
  "despesas.listar": { fn: despesasListar },
  "despesas.resumo": { fn: despesasResumo },
  "despesas.criar": { fn: despesasCriar },
  "despesas.atualizar": { fn: despesasAtualizar },
  "despesas.remover": { fn: despesasRemover },
  "despesas.lancarPagamento": { fn: despesasLancarPagamento },
  "despesas.removerPagamento": { fn: despesasRemoverPagamento },

  // Transferências (agrupam pagamentos) / Pagamentos / Repasses (entidades próprias)
  "transferencias.lancar": { fn: transferenciasLancar },
  "transferencias.remover": { fn: transferenciasRemover },
  "transferencias.anexarComprovante": { fn: transferenciasAnexarComprovante },
  "transferencias.removerComprovante": { fn: transferenciasRemoverComprovante },
  "pagamentos.lancar": { fn: pagamentosLancar },
  "pagamentos.remover": { fn: pagamentosRemover },
  "repasses.lancar": { fn: repassesLancar },
  "repasses.remover": { fn: repassesRemover },

  // Categorias
  "categorias.listar": { fn: categoriasListar },
  "categorias.criar": { fn: categoriasCriar },
  "categorias.atualizar": { fn: categoriasAtualizar },
  "categorias.remover": { fn: categoriasRemover },
  "categorias.incorporar": { fn: categoriasIncorporar },

  // Compras — Fornecedores
  "fornecedores.listar": { fn: fornecedoresListar },
  "fornecedores.criar": { fn: fornecedoresCriar },
  "fornecedores.atualizar": { fn: fornecedoresAtualizar },
  "fornecedores.remover": { fn: fornecedoresRemover },
  "fornecedores.incorporar": { fn: fornecedoresIncorporar },

  // Compras — Contatos
  "contatos.listar": { fn: contatosListar },
  "contatos.criar": { fn: contatosCriar },
  "contatos.atualizar": { fn: contatosAtualizar },
  "contatos.remover": { fn: contatosRemover },
  "contatos.incorporar": { fn: contatosIncorporar },

  // Cargos (de contatos)
  "cargos.listar": { fn: cargosListar },
  "cargos.criar": { fn: cargosCriar },
  "cargos.atualizar": { fn: cargosAtualizar },
  "cargos.remover": { fn: cargosRemover },
  "cargos.incorporar": { fn: cargosIncorporar },

  // Tipos de transferência (configuráveis)
  "tiposTransferencia.listar": { fn: tiposTransferenciaListar },
  "tiposTransferencia.criar": { fn: tiposTransferenciaCriar },
  "tiposTransferencia.atualizar": { fn: tiposTransferenciaAtualizar },
  "tiposTransferencia.remover": { fn: tiposTransferenciaRemover },

  "classificacoes.listar": { fn: classificacoesListar },
  "classificacoes.criar": { fn: classificacoesCriar },
  "classificacoes.atualizar": { fn: classificacoesAtualizar },
  "classificacoes.remover": { fn: classificacoesRemover },

  // Itens (catálogo Material/Serviço)
  "itens.listar": { fn: itensListar },
  "itens.criar": { fn: itensCriar },
  "itens.atualizar": { fn: itensAtualizar },
  "itens.remover": { fn: itensRemover },
  "itens.incorporar": { fn: itensIncorporar },

  // Compras — Cotações + ofertas
  "cotacoes.listar": { fn: cotacoesListar },
  "cotacoes.criar": { fn: cotacoesCriar },
  "cotacoes.atualizar": { fn: cotacoesAtualizar },
  "cotacoes.remover": { fn: cotacoesRemover },
  "cotacoes.adicionarPreco": { fn: cotacoesAdicionarPreco },
  "cotacoes.atualizarPreco": { fn: cotacoesAtualizarPreco },
  "cotacoes.removerPreco": { fn: cotacoesRemoverPreco },
  "cotacoes.escolherPreco": { fn: cotacoesEscolherPreco },
  "cotacoes.registrarDespesa": { fn: cotacoesRegistrarDespesa },
  "cotacoes.incorporar": { fn: cotacoesIncorporar },
  "ofertas.incorporar": { fn: ofertasIncorporar },

  // Compras — Orçamentos (container de ofertas)
  "orcamentos.listar": { fn: orcamentosListar },
  "orcamentos.criar": { fn: orcamentosCriar },
  "orcamentos.atualizar": { fn: orcamentosAtualizar },
  "orcamentos.remover": { fn: orcamentosRemover },
  "orcamentos.incorporar": { fn: orcamentosIncorporar },

  // Equipes (grupos: líder + membros + obras)
  "equipes.listar": { fn: equipesListar },
  "equipes.criar": { fn: equipesCriar },
  "equipes.atualizar": { fn: equipesAtualizar },
  "equipes.remover": { fn: equipesRemover },
  "equipes.incorporar": { fn: equipesIncorporar },

  // Estoque (livro-razão de movimentos por obra)
  "estoque.listar": { fn: estoqueListar },
  "estoque.criarMovimento": { fn: estoqueCriarMovimento },
  "estoque.remover": { fn: estoqueRemover },

  // Notas da obra (anotações compartilhadas)
  "notas.listar": { fn: notasListar },
  "notas.criar": { fn: notasCriar },
  "notas.atualizar": { fn: notasAtualizar },
  "notas.remover": { fn: notasRemover },

  // Conexão Google (OAuth2 por usuário — agenda)
  "google.iniciarOAuth": { fn: googleIniciarOAuth },
  "google.concluirOAuth": { fn: googleConcluirOAuth, publica: true }, // callback pelo site (sem sessão; valida o state)
  "google.status": { fn: googleStatus },
  "google.desconectar": { fn: googleDesconectar },
  "google.testarConexao": { fn: googleTestarConexao },
  "google.agenda.listar": { fn: googleAgendaListar },
  "google.agenda.criar": { fn: googleAgendaCriar },
  "google.agenda.atualizar": { fn: googleAgendaAtualizar },
  "google.agenda.remover": { fn: googleAgendaRemover },
  "google.agenda.sincronizarObra": { fn: googleAgendaSincronizarObra },

  // Google Contacts (People API — contatos/empresas + cargo<->grupo)
  "google.contatos.listar": { fn: googleContatosListar },
  "google.contatos.enviar": { fn: googleContatosEnviar },
  "google.contatos.vincular": { fn: googleContatosVincular },
  "google.contatos.desvincular": { fn: googleContatosDesvincular },
  "google.contatos.importar": { fn: googleContatosImportar },
  "google.cargos.sincronizar": { fn: googleCargosSincronizar },

  // Usuários (autenticado)
  "usuarios.listar": { fn: usuariosListar },

  // Admin
  "admin.usuarios.listar": { fn: adminUsuariosListar },
  "admin.usuarios.criar": { fn: adminUsuariosCriar },
  "admin.usuarios.atualizar": { fn: adminUsuariosAtualizar },
  "admin.config.obter": { fn: adminConfigObter },
  "admin.config.definir": { fn: adminConfigDefinir },
  "admin.email.obter": { fn: adminEmailObter },
  "admin.email.definir": { fn: adminEmailDefinir },
};

/** Resolve a action: valida token quando necessário e executa o handler. */
function despacharAcao(action, token, data) {
  const rota = ROTAS[action];
  if (!rota) {
    lancar(ERRO.ACAO_DESCONHECIDA, "Ação desconhecida: " + action);
  }
  let sessao = null;
  if (!rota.publica) {
    sessao = validarToken(token);
  }
  return rota.fn(data || {}, sessao, token);
}
