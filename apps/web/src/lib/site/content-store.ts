import { constants } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, type SiteContent } from "@elora/core";

/**
 * O conteúdo do site, gravado em disco.
 *
 * ## Por que arquivo, e não o armazém em memória do resto do projeto
 *
 * Toda escrita deste repositório vive em `globalThis` e morre no reinício — é o
 * compromisso honesto para dado de **demonstração**, que é recarregado a cada
 * apresentação de qualquer forma. Texto de marketing é outra coisa: quem passou
 * a tarde ajustando o título do herói não pode perdê-lo porque alguém salvou um
 * arquivo e o `next dev` reiniciou. Um editor que esquece é um editor que
 * ninguém usa duas vezes.
 *
 * O arquivo tem um segundo efeito, e ele é o motivo real da escolha: **entra no
 * Git**. A mudança de texto passa a ter histórico, autor e reversão, como todo o
 * resto do repositório — que é mais do que um banco daria sem uma tabela de
 * versões escrita à mão.
 *
 * ## Onde isto falha, e a tela diz
 *
 * Sistema de arquivos somente leitura (Vercel e a maioria das hospedagens
 * serverless) recusa a escrita. A leitura continua funcionando — o arquivo
 * versionado é servido normalmente —, e a gravação devolve o motivo escrito em
 * vez de estourar. É por isso que `saveSiteContent` nunca lança: recusa do
 * ambiente é resposta, não exceção, e precisa chegar à tela de quem editou com o
 * texto ainda na mão.
 *
 * ## O cache confere a data do arquivo
 *
 * Guardar o conteúdo em memória sem conferir nada faria a edição direta do JSON
 * — por `git pull`, por exemplo — só aparecer no reinício seguinte. Um `stat`
 * por leitura custa quase nada e elimina a classe inteira de "editei o arquivo e
 * o site não mudou".
 */

/** Nome do arquivo. Relativo à raiz do aplicativo web (`apps/web`). */
const CONTENT_PATH =
  process.env.ELORA_CONTENT_FILE ?? path.join(process.cwd(), "content", "site-content.json");

/**
 * O carimbo da publicação usa o relógio **real**, não o ancorado.
 *
 * É a mesma distinção que separa `lastActivityAt` de `touchedAtMs` nas sessões
 * do webchat, e confundi-la quebraria em silêncio de dois jeitos. Primeiro, a
 * tela diria "última publicação em 27/07/2026" para sempre, porque
 * `REFERENCE_NOW_ISO` não anda. Segundo, e pior: a conferência de conflito
 * compara o carimbo carregado com o gravado — com um valor fixo, duas gravações
 * simultâneas produziriam o mesmo carimbo, a comparação passaria sempre e a
 * proteção deixaria de existir sem nada indicar isso.
 *
 * A âncora vale para dado de demonstração, que precisa que os contadores de SLA
 * façam sentido em qualquer dia. Isto aqui é um fato sobre o sistema de
 * arquivos.
 */
function publishedAt(): string {
  return new Date().toISOString();
}

/**
 * O cache guarda o JSON **cru**, não o documento normalizado.
 *
 * A primeira versão guardava o resultado de `normalizeSiteContent`, e isso
 * produziu um defeito que vale registrar porque parece intermitente e não é.
 *
 * O `next dev` recarrega módulos a cada edição de arquivo, mas o `globalThis`
 * sobrevive. Então: alguém acrescenta um campo ao modelo (foi `titleRoll`, as
 * palavras que rolam no título do herói), a normalização passa a preenchê-lo, o
 * módulo recarrega — e o objeto **já normalizado** que está no `globalThis`
 * continua sem o campo, porque foi montado pela versão anterior do código. A
 * tela quebra com `Cannot read properties of undefined (reading 'length')`
 * apontando para um componente que está correto, e reiniciar o servidor
 * "resolve", o que faz o defeito parecer ambiental.
 *
 * É a mesma armadilha que `repositories/store.ts` documenta ao mesclar coleção
 * nova em vez de usar `??=`. Aqui a saída é mais simples: guardar o cru e
 * normalizar a cada leitura. A normalização é pura, idempotente (há teste) e
 * custa microssegundos — o que o cache evita é o acesso a disco e o `JSON.parse`,
 * que é onde está o custo de verdade.
 */
interface ContentCache {
  raw: unknown;
  /** Modificação do arquivo quando o conteúdo foi lido. Nulo quando não há arquivo. */
  mtimeMs: number | null;
}

const globalCache = globalThis as unknown as { __eloraSiteContent?: ContentCache };

/** Estado do arquivo, para a tela do editor explicar o que está acontecendo. */
export interface ContentSource {
  /** Caminho absoluto, mostrado ao administrador — é ele quem versiona o arquivo. */
  file: string;
  /** Falso quando nada foi gravado ainda: a página está servindo o padrão do código. */
  exists: boolean;
  /** Falso quando o diretório não aceita escrita (hospedagem somente leitura). */
  writable: boolean;
}

async function fileMtime(): Promise<number | null> {
  try {
    return (await stat(CONTENT_PATH)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Lê o conteúdo publicado.
 *
 * Sem arquivo, devolve o padrão do código — que é o texto original das páginas,
 * palavra por palavra. É o que garante que a extração do conteúdo não mudou o
 * site: uma instalação recém-clonada renderiza exatamente o que renderizava
 * antes de este módulo existir.
 *
 * JSON corrompido também cai no padrão, e **não** derruba a página. A landing
 * page é a porta de entrada do produto; servir o texto anterior enquanto alguém
 * conserta o arquivo é sempre melhor que servir uma tela de erro.
 */
export async function readSiteContent(): Promise<SiteContent> {
  const mtimeMs = await fileMtime();
  const cached = globalCache.__eloraSiteContent;

  // Normaliza **sempre**, inclusive no acerto de cache. Ver `ContentCache`.
  if (cached && cached.mtimeMs === mtimeMs) return normalizeSiteContent(cached.raw);

  if (mtimeMs === null) {
    globalCache.__eloraSiteContent = { raw: DEFAULT_SITE_CONTENT, mtimeMs: null };
    return DEFAULT_SITE_CONTENT;
  }

  let raw: unknown = DEFAULT_SITE_CONTENT;

  try {
    raw = JSON.parse(await readFile(CONTENT_PATH, "utf8"));
  } catch (error) {
    console.error("[conteudo] arquivo ilegível, servindo o padrão do código:", error);
  }

  globalCache.__eloraSiteContent = { raw, mtimeMs };
  return normalizeSiteContent(raw);
}

/**
 * O diretório aceita escrita?
 *
 * ## Por que a pergunta sobe pelos ancestrais
 *
 * A permissão é conferida no **diretório**, não no arquivo: a gravação escreve
 * um temporário ao lado e renomeia por cima, então quem precisa aceitar escrita
 * é a pasta. Conferir o arquivo aprovaria o caso em que ele ainda não existe, e
 * a primeira gravação falharia depois de a pessoa ter escrito a página inteira.
 *
 * Só que a pasta **também** pode não existir — é o estado de toda instalação
 * recém-clonada, porque `content/` só nasce na primeira publicação. A primeira
 * versão respondia "somente leitura" nesse caso, e o efeito era o pior possível:
 * o botão de publicar nascia desabilitado para sempre, com um aviso dizendo que
 * o servidor não aceita gravação. O servidor aceitava; a pasta é que ainda não
 * estava lá, e `mkdir` recursivo a criaria no ato.
 *
 * Então a pergunta sobe até o primeiro ancestral que existe — que é exatamente
 * onde o `mkdir` vai começar a criar.
 */
async function canWrite(directory: string): Promise<boolean> {
  let current = directory;

  for (;;) {
    try {
      await access(current, constants.W_OK);
      return true;
    } catch {
      const parent = path.dirname(current);
      // `dirname` da raiz devolve a própria raiz: é o critério de parada, e sem
      // ele o laço giraria para sempre em `C:\` ou `/`.
      if (parent === current) return false;
      current = parent;
    }
  }
}

export async function siteContentSource(): Promise<ContentSource> {
  const directory = path.dirname(CONTENT_PATH);
  const exists = (await fileMtime()) !== null;

  return { file: CONTENT_PATH, exists, writable: await canWrite(directory) };
}

export interface ContentWriteResult {
  ok: boolean;
  /** Motivo da recusa, escrito para quem edita. Ausente em sucesso. */
  reason?: string;
  content?: SiteContent;
}

/**
 * Grava o conteúdo.
 *
 * ## A gravação é atômica
 *
 * Escreve num temporário e renomeia por cima. `writeFile` direto no destino tem
 * uma janela em que o arquivo existe truncado — e se o processo morrer nela, a
 * próxima leitura encontra JSON vazio e o site volta ao padrão sem que ninguém
 * entenda por quê. `rename` no mesmo sistema de arquivos é atômico: ou o arquivo
 * antigo, ou o novo.
 *
 * ## A conferência de versão evita a sobrescrita silenciosa
 *
 * `expectedUpdatedAt` é o carimbo que o editor carregou ao abrir a tela. Se o
 * arquivo mudou depois disso, alguém gravou no meio — e continuar apagaria o
 * trabalho dessa pessoa sem aviso. Recusar com o motivo escrito custa uma
 * recarga de página; a sobrescrita custa o texto de outro alguém, que só
 * descobre dias depois.
 */
export async function saveSiteContent(
  raw: unknown,
  actor: string,
  expectedUpdatedAt?: string,
): Promise<ContentWriteResult> {
  const current = await readSiteContent();

  if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) {
    return {
      ok: false,
      reason:
        "O conteúdo foi alterado por outra pessoa depois que você abriu esta tela. " +
        "Recarregue a página para ver a versão atual — gravar agora apagaria o que ela escreveu.",
    };
  }

  const content: SiteContent = {
    ...normalizeSiteContent(raw),
    updatedAt: publishedAt(),
    updatedBy: actor,
  };

  const temporary = `${CONTENT_PATH}.tmp`;

  try {
    await mkdir(path.dirname(CONTENT_PATH), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`, "utf8");
    await rename(temporary, CONTENT_PATH);
  } catch (error) {
    console.error("[conteudo] falha ao gravar:", error);
    return {
      ok: false,
      reason:
        "Não foi possível gravar o arquivo de conteúdo. Em hospedagem com sistema de arquivos " +
        "somente leitura isso é esperado — baixe o JSON pelo botão de exportar e publique o " +
        "arquivo pelo repositório.",
    };
  }

  globalCache.__eloraSiteContent = { raw: content, mtimeMs: await fileMtime() };
  return { ok: true, content };
}

/**
 * Volta ao texto original.
 *
 * Grava o padrão em disco em vez de apagar o arquivo. Apagar seria equivalente
 * do ponto de vista da leitura e péssimo do ponto de vista do Git: a mudança
 * apareceria como arquivo removido, e recuperar o texto anterior exigiria
 * navegar no histórico em vez de desfazer um diff.
 */
export async function resetSiteContent(actor: string): Promise<ContentWriteResult> {
  return saveSiteContent(DEFAULT_SITE_CONTENT, actor);
}
