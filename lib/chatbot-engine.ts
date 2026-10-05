export interface ChatbotResult {
  intent: string;
  response: string;
  confidence: number;
  action: string | null;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (text: string, values: string[]) => values.some((value) => text.includes(value));

function formatAddress(marker: any) {
  const address = marker.address || {};
  const description = marker.description || [
    address.street,
    address.number,
    address.city,
    address.state,
    address.cep,
  ].filter(Boolean).join(", ");
  return `📍 *${marker.title || "Biodigestor"}*\n${description || "Endereço não informado."}`;
}

function formatMetrics(indicators: any[]) {
  if (!indicators.length) {
    return "Nenhuma métrica encontrada. Diga *adicionar métricas* para registrar os dados do biodigestor.";
  }
  const latest = indicators[0];
  return [
    "📊 *Últimas métricas do biodigestor*",
    `♻️ Resíduos: *${Number(latest.waste_processed || 0).toFixed(2)} kg*`,
    `⚡ Energia: *${Number(latest.energy_generated || 0).toFixed(2)} kWh*`,
    `💰 Benefícios fiscais: *R$ ${Number(latest.tax_savings || 0).toFixed(2)}*`,
  ].join("\n");
}

export function runChatbot(message: string, markers: any[], indicators: any[]): ChatbotResult {
  const text = normalize(message);
  const result = (intent: string, response: string, action: string | null = null): ChatbotResult => ({
    intent,
    response,
    action,
    confidence: 1,
  });

  if (containsAny(text, ["editar metrica", "editar indicador", "corrigir dado", "atualizar metrica"])) {
    return result("editar_metrica", "✏️ Qual **mês e ano** deseja atualizar?\n(ex: outubro 2026)", "start_flow_editar_metrica");
  }
  if (containsAny(text, ["adicionar metrica", "incluir metrica", "registrar metrica", "inserir indicador", "lancar metrica"])) {
    return result("incluir_metrica", "📊 Qual a quantidade de **resíduos processados** em kg?", "start_flow_metrica");
  }
  if (containsAny(text, ["agendar manutencao", "criar manutencao", "marcar manutencao", "programar manutencao", "agendar revisao"])) {
    return result("agendar_manutencao", "📅 Qual o **nome** da manutenção?", "start_flow_manutencao");
  }
  if (containsAny(text, ["adicionar biodigestor", "cadastrar biodigestor", "novo biodigestor", "cadastrar endereco", "adicionar localizacao"])) {
    return result("adicionar_endereco", "📍 Qual o **nome** do novo biodigestor?", "start_flow_endereco");
  }
  if (containsAny(text, ["relatorio por periodo", "relatorio entre", "relatorio mensal", "exportar periodo", "dados do periodo"])) {
    return result("relatorio_periodo", "📅 Qual o **mês e ano inicial** do relatório?", "start_flow_relatorio");
  }
  if (containsAny(text, ["pdf", "relatorio em pdf"])) {
    return result("exportar_pdf", "📄 Vou gerar o relatório em PDF.", "export_pdf");
  }
  if (containsAny(text, ["csv", "arquivo csv"])) {
    return result("exportar_csv", "📊 Vou gerar o arquivo CSV.", "export_csv");
  }
  if (containsAny(text, ["excel", "xlsx", "planilha"])) {
    return result("exportar_excel", "📋 Vou gerar a planilha Excel.", "export_excel");
  }
  if (containsAny(text, ["onde fica", "endereco do biodigestor", "localizacao do biodigestor", "mostrar endereco"])) {
    if (!markers.length) return result("pedido_endereco", "Não encontrei biodigestores cadastrados.");
    return result(
      "pedido_endereco",
      markers.length === 1
        ? formatAddress(markers[0])
        : `Encontrei ${markers.length} biodigestores:\n\n${markers.slice(0, 5).map(formatAddress).join("\n\n")}`
    );
  }
  if (containsAny(text, ["residuo", "energia", "metrica", "indicador", "como esta o biodigestor", "status do biodigestor"])) {
    return result("pedido_metricas", formatMetrics(indicators));
  }
  if (containsAny(text, ["tchau", "ate logo", "obrigado", "obrigada"])) {
    return result("despedida", "Foi um prazer ajudar! Continuo à disposição. 🌿");
  }
  if (containsAny(text, ["ola", "oi", "bom dia", "boa tarde", "boa noite"])) {
    return result(
      "saudacao",
      "Olá! Posso consultar biodigestores e métricas, cadastrar dados, agendar manutenções e gerar relatórios. Como posso ajudar?"
    );
  }

  return result(
    "desconhecido",
    "Posso ajudar com endereços dos biodigestores, métricas de energia e resíduos, manutenções, cadastros e relatórios."
  );
}
