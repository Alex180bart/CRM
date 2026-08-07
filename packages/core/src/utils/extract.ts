/**
 * Extração de texto para a base de conhecimento.
 *
 * Funções puras, em `@crm/core`, pelo mesmo motivo da classificação de URL em
 * `media.ts`: a rota que ingere e a tela que mostra a prévia precisam concordar
 * sobre o que foi extraído. Duplicar a lógica no componente produziria a prévia
 * que mostra uma coisa e a fonte que guarda outra.
 *
 * **O que está aqui não é um parser de documento.** HTML e texto delimitado se
 * leem sem biblioteca; PDF, Word e planilha não — dependem do extrator do
 * caminho de mídia da seção 11, que é back-end. O tipo `AgentSourceStatus`
 * carrega essa diferença até a tela, em vez de ela virar um arquivo que sumiu.
 */

import {
  AGENT_PENDING_EXTENSIONS,
  AGENT_TEXT_EXTENSIONS,
  type AgentSourceStatus,
} from "../types/agents";

/* HTML ------------------------------------------------------------------------ */

/**
 * Entidades que aparecem em texto brasileiro e quebram a leitura se ficarem.
 *
 * Lista curta de propósito: decodificar HTML completo pede um parser, e o que
 * sobra depois destas é ruído raro. `&nbsp;` vira espaço normal porque o espaço
 * inquebrável atrapalha a busca por termo — "Simples&nbsp;Nacional" não casaria
 * com "simples nacional".
 */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&aacute;": "á",
  "&eacute;": "é",
  "&iacute;": "í",
  "&oacute;": "ó",
  "&uacute;": "ú",
  "&atilde;": "ã",
  "&otilde;": "õ",
  "&ccedil;": "ç",
  "&acirc;": "â",
  "&ecirc;": "ê",
  "&ocirc;": "ô",
  "&agrave;": "à",
};

function decodeEntities(value: string): string {
  let out = value;
  for (const [entity, char] of Object.entries(ENTITIES)) {
    out = out.split(entity).join(char);
  }
  // Numéricas decimais, que aparecem em página gerada por CMS.
  return out.replace(/&#(\d{2,5});/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

export function readHtmlTitle(html: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]).trim();

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return title?.[1] ? decodeEntities(title[1]).trim() : "";
}

/**
 * Converte HTML em texto legível.
 *
 * A ordem importa. Script, estilo e `<noscript>` saem **antes** de qualquer
 * outra coisa: o conteúdo deles é código, e um JSON de configuração deixado no
 * texto vira ruído que a busca casa e o agente cita. Cabeçalho e parágrafo
 * viram quebra dupla porque é ela que `searchKnowledge` usa para recortar
 * trecho — sem isso, a página inteira vira um parágrafo só.
 */
export function htmlToText(html: string): string {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Navegação e rodapé são o mesmo texto em toda página do site: recuperá-los
    // faz toda consulta casar com todas as páginas.
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  const blocked = withoutCode
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ");

  return (
    decodeEntities(blocked.replace(/<[^>]+>/g, " "))
      .replace(/[ \t\u00a0]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      /**
       * Marcador de lista sem conteúdo é o resíduo do menu.
       *
       * Um site real tem dezenas de `<li>` de navegação com só um ícone
       * dentro, e cada um vira uma linha "-" no texto. Sem esta limpeza, o
       * primeiro trecho recuperado de qualquer página é uma coluna de traços
       * — que é o que o modelo lê antes do conteúdo.
       */
      .filter((line) => line !== "-" && line !== "")
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/* Texto delimitado ------------------------------------------------------------ */

/**
 * Converte CSV em linhas legíveis.
 *
 * Devolver o CSV cru levaria ao modelo uma grade de vírgulas onde cada linha
 * depende do cabeçalho que ficou vinte linhas acima. Repetir o rótulo em cada
 * campo custa tokens e resolve: o trecho recuperado passa a fazer sentido
 * sozinho, que é a única coisa que a recuperação garante.
 *
 * O leitor respeita aspas, porque valor com vírgula dentro é comum em qualquer
 * exportação de planilha brasileira — endereço, descrição, razão social.
 */
export function csvToText(csv: string, separator?: string): string {
  const text = csv.replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  const delimiter = separator ?? guessSeparator(text);
  const rows = text.split("\n").map((line) => splitRow(line, delimiter));
  const header = rows[0];

  if (!header || rows.length < 2) return text;

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) =>
      header
        .map((label, index) => {
          const value = row[index]?.trim();
          return value ? `${label.trim()}: ${value}` : "";
        })
        .filter(Boolean)
        .join(" · "),
    )
    .join("\n\n");
}

function guessSeparator(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const counts = [";", ",", "\t"].map((candidate) => ({
    candidate,
    // Fora de aspas: um cabeçalho raramente tem aspas, e a contagem aqui só
    // precisa ser boa o bastante para escolher entre três candidatos.
    total: firstLine.split(candidate).length - 1,
  }));

  // Ponto e vírgula primeiro: é o que o Excel em português gera por padrão, e
  // adivinhar vírgula ali produz uma coluna só com o conteúdo inteiro dentro.
  return counts.sort((a, b) => b.total - a.total)[0]?.candidate ?? ",";
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;

    if (char === '"') {
      // Aspas dobradas dentro de campo entre aspas representam uma aspa literal.
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

/* Classificação de arquivo ---------------------------------------------------- */

export interface FilePlan {
  status: AgentSourceStatus;
  /** Como extrair, quando dá para extrair aqui. */
  reader?: "texto" | "csv";
  reason?: string;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * O que fazer com um arquivo enviado.
 *
 * Três respostas possíveis, e cada uma é honesta sobre o motivo. Texto e CSV se
 * leem aqui. PDF, Word e planilha ficam **registrados e pendentes** — aceitá-los
 * silenciosamente como vazios seria pior, porque o agente responderia "não
 * encontrei" sobre um documento que a operação acredita ter cadastrado. Formato
 * desconhecido é recusa, não pendência: não há extrator no horizonte para um
 * `.dwg`.
 */
export function planFile(fileName: string): FilePlan {
  const extension = extensionOf(fileName);

  if (AGENT_TEXT_EXTENSIONS.includes(extension)) {
    return {
      status: "pronto",
      reader: extension === ".csv" || extension === ".tsv" ? "csv" : "texto",
    };
  }

  if (AGENT_PENDING_EXTENSIONS.includes(extension)) {
    return {
      status: "processando",
      reason:
        "A extração de PDF, Word e planilha depende do caminho de mídia da seção 11 — upload, antivírus e armazenamento —, que é back-end. O arquivo fica registrado e o agente ainda não o consulta.",
    };
  }

  return {
    status: "falhou",
    reason: `Formato ${extension || "desconhecido"} não é lido como texto. Converta para PDF, TXT, Markdown ou CSV.`,
  };
}

/* Tópicos --------------------------------------------------------------------- */

const TOPIC_STOPWORDS = new Set([
  "para",
  "com",
  "como",
  "que",
  "dos",
  "das",
  "uma",
  "por",
  "nos",
  "nas",
  "pelo",
  "pela",
  "mais",
  "sobre",
  "quando",
  "onde",
  "todo",
  "toda",
  "esse",
  "essa",
  "isso",
  "seu",
  "sua",
  "ser",
  "tem",
  "ter",
  "foi",
  "sao",
  "são",
  "ate",
  "até",
  "apos",
  "após",
  "entre",
  "cada",
  "pode",
  "deve",
  "nao",
  "não",
]);

/**
 * Sugere assuntos a partir do texto extraído.
 *
 * Existe porque tópico é o sinal mais forte da recuperação — vale três vezes o
 * corpo em `searchKnowledge` — e exigir que alguém digite os assuntos de cada
 * página colada faria o campo ficar vazio. Sugestão automática que a pessoa
 * corrige é melhor que campo obrigatório que ninguém preenche.
 *
 * O título pesa mais que o corpo pela razão óbvia: quem escreveu o título já
 * escolheu as palavras que descrevem a página.
 */
export function suggestTopics(title: string, body: string, limit = 6): string[] {
  const counts = new Map<string, number>();

  const add = (source: string, weight: number) => {
    for (const raw of source.toLowerCase().split(/[^a-zà-ú0-9]+/i)) {
      const term = raw.trim();
      if (term.length < 4 || TOPIC_STOPWORDS.has(term)) continue;
      counts.set(term, (counts.get(term) ?? 0) + weight);
    }
  };

  add(title, 5);
  add(body.slice(0, 4_000), 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}
