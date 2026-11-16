const select = document.getElementById("interface");
const status = document.getElementById("estado");
const painel = document.getElementById("painel");
const fmt = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const labelNames = {
  agencia: "Agência", empresa: "Empresa", startup: "Startup",
  prestadora_de_servico: "Prestadora de serviço", consultoria: "Consultoria"
};

const platformName = (name) => name === "Google AI Mode" ? "Modo IA do Google" : name;
const rate = (n, d) => d ? fmt.format(n / d) : "—";
const fraction = (n, d) => d ? `${n}/${d}` : "—";
const set = (id, text) => { document.getElementById(id).textContent = text; };

function sum(rows, field) {
  return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
}

function bar(label, numerator, denominator, showPercent = true) {
  const row = document.createElement("div");
  row.className = "bar";
  const name = document.createElement("span");
  name.className = "bar-label";
  name.textContent = label;
  const value = document.createElement("span");
  value.className = "bar-value";
  value.textContent = denominator
    ? `${fraction(numerator, denominator)}${showPercent ? ` · ${rate(numerator, denominator)}` : ""}`
    : "Sem válidas";

  const track = document.createElement(denominator ? "progress" : "span");
  if (denominator) {
    track.max = denominator;
    track.value = numerator;
    track.setAttribute("aria-label", `${label}, ${value.textContent}`);
  } else {
    track.className = "bar-track-missing";
    track.setAttribute("aria-hidden", "true");
  }
  row.append(name, track, value);
  return row;
}

function appendRow(tbody, values) {
  const tr = tbody.insertRow();
  for (const value of values) tr.insertCell().textContent = value;
}

function renderPresence(data) {
  const rows = data.indicadores.filter(row => row.etapa === "espontanea" &&
    (select.value === "todos" || row.interface === select.value));
  const n = sum(rows, "ocorrencias");
  const d = sum(rows, "denominador");
  const planned = sum(rows, "tentativas_planejadas");
  set("cobertura", fraction(d, planned));
  set("cobertura-detalhe", `${rate(d, planned)} das tentativas planejadas`);
  set("presencas", fraction(n, d));
  set("presencas-detalhe", d ? "Respostas iniciais com a marca" : "Nenhuma resposta válida nessa interface");
  set("taxa", rate(n, d));
  const chart = document.getElementById("presenca-chart");
  chart.replaceChildren(...Object.entries(data.intencoes).map(([id, name]) => {
    const subset = rows.filter(row => row.intencao === id);
    return bar(name, sum(subset, "ocorrencias"), sum(subset, "denominador"));
  }));
  status.textContent = select.value === "todos" ? "" : `Filtro ativo: ${platformName(data.interfaces[select.value])}.`;
  status.hidden = !status.textContent;
}

function renderEvidence(data) {
  const total = data.agencias_total;
  document.getElementById("agencias-chart").replaceChildren(
    bar("Evidência nominal classificada", total.respostas_classificadas_agencia_nomeada, total.respostas_validas),
    bar("Evidência nominal insuficiente", total.respostas_sem_evidencia_suficiente_de_agencia_nomeada, total.respostas_validas)
  );
  const agencies = document.getElementById("tabela-agencias");
  for (const row of data.agencias_por_grupo) {
    const denominator = row.respostas_classificadas_agencia_nomeada;
    appendRow(agencies, [
      data.intencoes[row.intencao], platformName(data.interfaces[row.interface]), row.respostas_validas,
      fraction(row.agencia_nomeada_confirmada, denominator),
      denominator ? row.agencia_seo_ou_marketing_confirmada : "—",
      row.palavra_agencia_confirmada || "—",
      row.respostas_validas ? row.respostas_sem_evidencia_suficiente_de_agencia_nomeada : "—",
      denominator ? row.coocorrencia_agencia_e_quaerion : "—"
    ]);
  }
  for (const row of data.posicoes_assistidas) {
    appendRow(document.getElementById("posicoes"), [
      platformName(data.interfaces[row.interface]), `${row.posicao}º de ${row.fornecedores_na_lista}`, row.comparativos_observados
    ]);
  }
  for (const row of data.cenarios_30_dias) {
    appendRow(document.getElementById("cenarios"), [
      row.rotulo, fraction(row.presencas, row.validas), rate(row.presencas, row.validas)
    ]);
  }
  const labels = data.rotulos_fornecedores.filter(row => row.interface === "todos");
  document.getElementById("rotulos-chart").replaceChildren(...labels.filter(row => row.rotulo in labelNames).map(row =>
    bar(labelNames[row.rotulo], row.ocorrencias_com_rotulo, row.ocorrencias_classificadas)
  ));
  const subtype = labels.find(row => row.rotulo === "agencia_seo_ou_marketing");
  const agency = labels.find(row => row.rotulo === "agencia");
  set("subtipo", `Em ${subtype.ocorrencias_com_rotulo} de ${agency.ocorrencias_com_rotulo} ocorrências rotuladas como agência, o texto preservado explicitou SEO ou marketing.`);
}

async function load() {
  try {
    const response = await fetch("./data/benchmark.json");
    if (!response.ok) throw new Error("dados indisponíveis");
    const data = await response.json();
    renderEvidence(data);
    renderPresence(data);
    select.disabled = false;
    painel.hidden = false;
    select.addEventListener("change", () => renderPresence(data));
  } catch {
    status.hidden = false;
    status.textContent = "Os dados interativos estão indisponíveis. Os arquivos CSV e JSON estão na seção Dados.";
  }
}

load();
