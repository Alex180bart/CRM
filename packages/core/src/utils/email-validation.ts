import type { EmailBlock, EmailTemplateVersion, EmailValidationIssue } from "../types/email";

/**
 * Validação anterior ao envio (seções 14.2 e 14.3 do plano).
 *
 * `erro` bloqueia a publicação; `alerta` apenas informa. A lista não tenta ser
 * um verificador de spam — ela cobre o que quebra de verdade na caixa de
 * entrada: assunto ausente, imagem sem alternativa, link quebrado, falta de
 * descadastro e peso acima do corte do Gmail.
 */

/** O Gmail corta a mensagem acima de 102 KB e mostra "[Mensagem truncada]". */
const GMAIL_CLIP_BYTES = 102 * 1024;

/** Acima disso o assunto é truncado na maioria dos clientes móveis. */
const SUBJECT_MAX_CHARS = 60;

function isValidLink(href: string): boolean {
  const value = href.trim();
  if (value.length === 0) return false;
  // Merge tag no lugar do link é legítimo: a URL é resolvida no envio.
  if (value.startsWith("{{") && value.endsWith("}}")) return true;
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(value);
}

function blockText(block: EmailBlock): string {
  switch (block.kind) {
    case "texto":
      return block.content;
    case "botao":
      return block.label;
    case "colunas":
      return block.columns.map((column) => `${column.title} ${column.body}`).join(" ");
    case "imagem":
      return `${block.alt} ${block.caption ?? ""}`;
    case "video":
      return `${block.title} ${block.fallbackText}`;
    case "rodape":
      return `${block.address} ${block.legal} ${block.unsubscribeLabel}`;
    case "html":
      return block.html;
    case "menu":
      return block.items.map((item) => item.label).join(" ");
    default:
      return "";
  }
}

/** Estimativa do peso compilado: texto do documento mais o custo do HTML. */
export function estimateEmailBytes(version: EmailTemplateVersion): number {
  const content = version.blocks.map(blockText).join(" ");
  const textBytes = new TextEncoder().encode(
    `${version.subject} ${version.preheader} ${content}`,
  ).length;
  // Cada bloco vira tabela aninhada com estilo embutido; ~1,4 KB é a média
  // observada em compiladores de e-mail para um bloco simples.
  const markupBytes = version.blocks.length * 1400;
  return textBytes + markupBytes;
}

export function validateEmailTemplate(version: EmailTemplateVersion): EmailValidationIssue[] {
  const issues: EmailValidationIssue[] = [];

  if (version.subject.trim().length === 0) {
    issues.push({
      id: "assunto",
      rule: "assunto_vazio",
      severity: "erro",
      message: "O e-mail não tem assunto. Sem ele, o cliente mostra apenas o remetente.",
    });
  } else if (version.subject.length > SUBJECT_MAX_CHARS) {
    issues.push({
      id: "assunto-longo",
      rule: "assunto_longo",
      severity: "alerta",
      message: `Assunto com ${version.subject.length} caracteres. Acima de ${SUBJECT_MAX_CHARS}, o celular corta o fim.`,
    });
  }

  if (version.preheader.trim().length === 0) {
    issues.push({
      id: "preheader",
      rule: "preheader_vazio",
      severity: "alerta",
      message:
        "Sem preheader, a prévia da caixa de entrada mostra o começo do corpo — normalmente o cabeçalho.",
    });
  }

  const hasContent = version.blocks.some(
    (block) => block.kind !== "espacador" && block.kind !== "divisor",
  );
  if (!hasContent) {
    issues.push({
      id: "conteudo",
      rule: "sem_conteudo",
      severity: "erro",
      message: "O e-mail só tem espaçadores e divisores. Adicione ao menos um bloco de conteúdo.",
    });
  }

  for (const block of version.blocks) {
    if (block.kind === "imagem" && block.alt.trim().length === 0) {
      issues.push({
        id: `alt-${block.id}`,
        rule: "imagem_sem_alt",
        severity: "erro",
        blockId: block.id,
        message:
          "Imagem sem texto alternativo. Boa parte dos clientes bloqueia imagem por padrão e mostra só esse texto.",
      });
    }

    if (block.kind === "botao" && !isValidLink(block.href)) {
      issues.push({
        id: `link-${block.id}`,
        rule: "link_invalido",
        severity: "erro",
        blockId: block.id,
        message: `O botão "${block.label}" não tem um link válido.`,
      });
    }

    if (block.kind === "imagem" && block.href !== undefined && !isValidLink(block.href)) {
      issues.push({
        id: `link-img-${block.id}`,
        rule: "link_invalido",
        severity: "erro",
        blockId: block.id,
        message: "A imagem tem link, mas o endereço é inválido.",
      });
    }

    if (block.kind === "menu") {
      for (const item of block.items) {
        if (!isValidLink(item.href)) {
          issues.push({
            id: `link-menu-${item.id}`,
            rule: "link_invalido",
            severity: "erro",
            blockId: block.id,
            message: `O item de menu "${item.label}" não tem um link válido.`,
          });
        }
      }
    }

    if (block.kind === "html") {
      issues.push({
        id: `html-${block.id}`,
        rule: "html_bruto",
        severity: "alerta",
        blockId: block.id,
        message:
          "Bloco de HTML controlado. Ele não passa pelo compilador de compatibilidade — teste em Outlook antes de publicar.",
      });
    }
  }

  const hasUnsubscribe = version.blocks.some(
    (block) => block.kind === "rodape" && block.unsubscribeLabel.trim().length > 0,
  );
  if (!hasUnsubscribe) {
    issues.push({
      id: "descadastro",
      rule: "sem_descadastro",
      severity: "erro",
      message:
        "Falta o rodapé com descadastro em um clique. Sem ele, o e-mail não pode ser enviado a uma lista de marketing.",
    });
  }

  const bytes = estimateEmailBytes(version);
  if (bytes > GMAIL_CLIP_BYTES) {
    issues.push({
      id: "peso",
      rule: "peso_excessivo",
      severity: "alerta",
      message: `Peso estimado de ${Math.round(bytes / 1024)} KB. Acima de 102 KB o Gmail trunca a mensagem e esconde o descadastro.`,
    });
  }

  return issues;
}

export function hasBlockingEmailIssue(issues: EmailValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "erro");
}

/** Substitui merge tags pelos valores de amostra, para a prévia e o teste. */
export function applyMergeTags(
  text: string,
  tags: Array<{ token: string; sample: string }>,
): string {
  return tags.reduce((result, tag) => result.split(tag.token).join(tag.sample), text);
}
