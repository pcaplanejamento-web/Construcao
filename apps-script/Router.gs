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
  "auth.logout": { fn: authLogout },
  "auth.me": { fn: authMe },
  "auth.alterarSenha": { fn: authAlterarSenha },

  // Estado inicial completo (carregamento único + cache no cliente)
  "dados.snapshot": { fn: dadosSnapshot },

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

  // Categorias
  "categorias.listar": { fn: categoriasListar },
  "categorias.criar": { fn: categoriasCriar },
  "categorias.atualizar": { fn: categoriasAtualizar },
  "categorias.remover": { fn: categoriasRemover },

  // Compras — Fornecedores
  "fornecedores.listar": { fn: fornecedoresListar },
  "fornecedores.criar": { fn: fornecedoresCriar },
  "fornecedores.atualizar": { fn: fornecedoresAtualizar },
  "fornecedores.remover": { fn: fornecedoresRemover },

  // Compras — Contatos
  "contatos.listar": { fn: contatosListar },
  "contatos.criar": { fn: contatosCriar },
  "contatos.atualizar": { fn: contatosAtualizar },
  "contatos.remover": { fn: contatosRemover },

  // Cargos (de contatos)
  "cargos.listar": { fn: cargosListar },
  "cargos.criar": { fn: cargosCriar },
  "cargos.atualizar": { fn: cargosAtualizar },
  "cargos.remover": { fn: cargosRemover },

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

  // Usuários (autenticado)
  "usuarios.listar": { fn: usuariosListar },

  // Admin
  "admin.usuarios.listar": { fn: adminUsuariosListar },
  "admin.usuarios.criar": { fn: adminUsuariosCriar },
  "admin.usuarios.atualizar": { fn: adminUsuariosAtualizar },
  "admin.config.obter": { fn: adminConfigObter },
  "admin.config.definir": { fn: adminConfigDefinir },
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
