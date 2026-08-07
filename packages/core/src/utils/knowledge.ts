/**
 * Recuperação na base de conhecimento.
 *
 * **Isto não é o RAG da seção 16.2.** O RAG real fragmenta o documento, gera
 * embeddings, guarda em pgvector e recupera por similaridade semântica, com
 * permissão e versionamento por documento — tudo trabalho de back-end. O que
 * está aqui é recuperação léxica sobre um punhado de artigos em memória.
 *
 * Vale a pena assim mesmo por um motivo prático: o que muda quando o pgvector
 * entrar é **de onde o trecho vem**, não o contrato. O agente continua pedindo
 * `buscar_conhecimento` com uma consulta e recebendo trechos com a fonte
 * identificada. Trocar a implementação desta função não toca o prompt, o
 * executor nem a interface.
 *
 * É função pura e vive em `@crm/core` de propósito: o executor do servidor e o
 * simulador do editor precisam recuperar igual. Duas implementações produziriam
 * o desencontro clássico — o artigo que aparece no teste e não aparece em
 * produção.
 */

import type { AgentKnowledgeSource } from "../types/agents";

export interface KnowledgeHit {
  sourceId: string;
  title: string;
  /** Trecho relevante, não o artigo inteiro. */
  excerpt: string;
  score: number;
}

/**
 * Palavras que aparecem em toda pergunta e não distinguem nada.
 *
 * Sem esta lista, "o que é" e "como faço" pontuavam mais que o termo técnico da
 * pergunta, porque conectivo é o que mais se repete em texto em português.
 */
const STOPWORDS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "essa",
  "esse",
  "eu",
  "faz",
  "fazer",
  "faco",
  "isso",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "pra",
  "por",
  "posso",
  "que",
  "qual",
  "quais",
  "quando",
  "quanto",
  "quero",
  "se",
  "seu",
  "sua",
  "tem",
  "um",
  "uma",
  "vou",
  "voces",
]);

export function normalizeTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeTerm(value)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

/**
 * Artigo curto vai inteiro; artigo longo vai recortado.
 *
 * O limite existe por causa de um erro observado. A primeira versão devolvia
 * **um** parágrafo, o de maior pontuação, e o agente respondeu "quais documentos
 * você precisa" corretamente e emendou "sobre o prazo, preciso verificar" — o
 * prazo estava no parágrafo seguinte do mesmo artigo. Uma pergunta comum tem
 * duas partes, e recortar por parágrafo corta uma delas.
 *
 * Acima do limite o recorte volta a valer, porque aí o problema se inverte:
 * despejar um documento inteiro dilui a instrução e aumenta a chance de o modelo
 * responder pelo trecho errado.
 */
const WHOLE_ARTICLE_LIMIT = 1200;
const EXCERPT_PARAGRAPHS = 2;

function bestExcerpt(body: string, terms: string[]): string {
  const trimmed = body.trim();
  if (trimmed.length <= WHOLE_ARTICLE_LIMIT) return trimmed;

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return trimmed;

  const scored = paragraphs.map((paragraph, order) => {
    const haystack = normalizeTerm(paragraph);
    return {
      paragraph,
      order,
      score: terms.reduce((total, term) => (haystack.includes(term) ? total + 1 : total), 0),
    };
  });

  return (
    scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, EXCERPT_PARAGRAPHS)
      // De volta à ordem do artigo: parágrafo fora de ordem lê como texto quebrado.
      .sort((a, b) => a.order - b.order)
      .map((item) => item.paragraph)
      .join("\n\n")
  );
}

/**
 * Busca nos artigos permitidos ao agente.
 *
 * O peso do tópico é três vezes o do corpo porque tópico é curadoria: alguém
 * escreveu ali o termo pelo qual aquele artigo deve ser encontrado. Casar no
 * corpo é sinal mais fraco — a palavra pode aparecer de passagem numa ressalva.
 */
export function searchKnowledge(
  sources: AgentKnowledgeSource[],
  query: string,
  limit = 2,
): KnowledgeHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  return sources
    .map((source) => {
      const topics = normalizeTerm(source.topics.join(" "));
      const body = normalizeTerm(`${source.title} ${source.body}`);

      const score = terms.reduce((total, term) => {
        let value = 0;
        if (topics.includes(term)) value += 3;
        if (body.includes(term)) value += 1;
        return total + value;
      }, 0);

      return {
        sourceId: source.id,
        title: source.title,
        excerpt: bestExcerpt(source.body, terms),
        score,
      } satisfies KnowledgeHit;
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
