/**
 * E-mail Studio e infraestrutura de entrega.
 * Referência: Plano Completo, seção 14.
 *
 * Duas ideias sustentam o módulo:
 *
 * 1. **O e-mail é um documento de blocos**, não um HTML solto. O usuário monta
 *    por blocos; a compilação para HTML com CSS embutido é responsabilidade do
 *    renderizador, não de quem escreve.
 * 2. **Entrega é assunto separado do editor** (seção 14.3). Domínio, SPF/DKIM/
 *    DMARC, bounce, reclamação e supressão vivem fora do template e não podem
 *    ser contornados por ele.
 */

import type { BaseEntity, Id, IsoDateTime } from "./common";
import type { FlowStatus } from "./automation";

/* Blocos ------------------------------------------------------------------ */

export type EmailBlockKind =
  | "texto"
  | "imagem"
  | "botao"
  | "divisor"
  | "espacador"
  | "colunas"
  | "menu"
  | "social"
  | "video"
  | "rodape"
  | "html";

export const EMAIL_BLOCK_LABEL: Record<EmailBlockKind, string> = {
  texto: "Texto",
  imagem: "Imagem",
  botao: "Botão",
  divisor: "Divisor",
  espacador: "Espaçamento",
  colunas: "Colunas",
  menu: "Menu",
  social: "Redes sociais",
  video: "Vídeo",
  rodape: "Rodapé",
  html: "HTML controlado",
};

export type EmailAlign = "esquerda" | "centro" | "direita";
export type EmailTextScale = "titulo" | "subtitulo" | "corpo" | "legenda";

interface EmailBlockBase {
  id: Id;
  /** Bloco de marca travado: o time de marketing não altera sem permissão. */
  locked?: boolean;
}

export interface EmailTextBlock extends EmailBlockBase {
  kind: "texto";
  content: string;
  align: EmailAlign;
  scale: EmailTextScale;
}

export interface EmailImageBlock extends EmailBlockBase {
  kind: "imagem";
  /** Descrição do arquivo na biblioteca. Não há upload no protótipo. */
  source: string;
  /** Texto alternativo é obrigatório: metade dos clientes bloqueia imagem. */
  alt: string;
  caption?: string;
  ratio: "16:9" | "4:3" | "1:1";
  href?: string;
}

export interface EmailButtonBlock extends EmailBlockBase {
  kind: "botao";
  label: string;
  href: string;
  align: EmailAlign;
  variant: "primario" | "secundario";
}

export interface EmailDividerBlock extends EmailBlockBase {
  kind: "divisor";
}

export interface EmailSpacerBlock extends EmailBlockBase {
  kind: "espacador";
  height: number;
}

export interface EmailColumnsBlock extends EmailBlockBase {
  kind: "colunas";
  columns: Array<{ id: Id; title: string; body: string }>;
}

export interface EmailMenuBlock extends EmailBlockBase {
  kind: "menu";
  items: Array<{ id: Id; label: string; href: string }>;
}

export interface EmailSocialBlock extends EmailBlockBase {
  kind: "social";
  networks: Array<"instagram" | "linkedin" | "youtube" | "facebook">;
}

export interface EmailVideoBlock extends EmailBlockBase {
  kind: "video";
  title: string;
  href: string;
  /** Texto exibido onde o vídeo não roda — a maioria dos clientes de e-mail. */
  fallbackText: string;
}

export interface EmailFooterBlock extends EmailBlockBase {
  kind: "rodape";
  address: string;
  legal: string;
  unsubscribeLabel: string;
}

export interface EmailHtmlBlock extends EmailBlockBase {
  kind: "html";
  html: string;
}

export type EmailBlock =
  | EmailTextBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailDividerBlock
  | EmailSpacerBlock
  | EmailColumnsBlock
  | EmailMenuBlock
  | EmailSocialBlock
  | EmailVideoBlock
  | EmailFooterBlock
  | EmailHtmlBlock;

/* Merge tags -------------------------------------------------------------- */

export interface MergeTag {
  token: string;
  label: string;
  /** Valor usado na prévia e no envio de teste. */
  sample: string;
}

export const EMAIL_MERGE_TAGS: MergeTag[] = [
  { token: "{{contato.primeiro_nome}}", label: "Primeiro nome", sample: "Helena" },
  { token: "{{contato.nome_completo}}", label: "Nome completo", sample: "Helena Ribeiro" },
  { token: "{{contato.email}}", label: "E-mail", sample: "helena.ribeiro@paonosso.com.br" },
  { token: "{{empresa.nome}}", label: "Empresa", sample: "Padaria Pão Nosso Ltda" },
  { token: "{{consultor.nome}}", label: "Consultor responsável", sample: "Bruno Tavares" },
  { token: "{{aluno.curso}}", label: "Curso do aluno", sample: "Departamento Pessoal" },
  { token: "{{fiscal.competencia}}", label: "Competência fiscal", sample: "agosto/2026" },
  { token: "{{unidade.cidade}}", label: "Cidade da unidade", sample: "Campinas" },
];

/* Marca ------------------------------------------------------------------- */

export interface BrandKit extends BaseEntity {
  name: string;
  description: string;
  /** Cores em hexadecimal: o e-mail é compilado fora do sistema de tokens. */
  primaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  fontStack: string;
  logoText: string;
  footerAddress: string;
  footerLegal: string;
  isDefault: boolean;
}

/** Grupo de blocos reutilizável — cabeçalho, assinatura, CTA, aviso legal. */
export interface EmailModule extends BaseEntity {
  name: string;
  description: string;
  category: "cabecalho" | "conteudo" | "chamada" | "rodape";
  blocks: EmailBlock[];
  /** Módulo de marca não é editável dentro do template que o usa. */
  locked: boolean;
  usageCount: number;
}

/* Templates --------------------------------------------------------------- */

export interface EmailTemplateVersion {
  id: Id;
  templateId: Id;
  version: number;
  status: FlowStatus;
  subject: string;
  /** Texto de pré-visualização; sem ele, o cliente mostra o começo do corpo. */
  preheader: string;
  blocks: EmailBlock[];
  publishedAt?: IsoDateTime;
  publishedBy?: Id;
  changeNote?: string;
}

export interface EmailTemplateStats {
  sends30d: number;
  deliveredPct: number;
  openPct: number;
  clickPct: number;
  unsubscribePct: number;
  bouncePct: number;
}

export interface EmailDesignTemplate extends BaseEntity {
  name: string;
  description: string;
  category: "campanha" | "jornada" | "transacional" | "institucional";
  brandKitId: Id;
  ownerId: Id;
  activeVersionId?: Id;
  draftVersionId: Id;
  versions: EmailTemplateVersion[];
  stats: EmailTemplateStats;
}

/* Validação pré-envio ----------------------------------------------------- */

export type EmailValidationRule =
  | "assunto_vazio"
  | "preheader_vazio"
  | "sem_conteudo"
  | "imagem_sem_alt"
  | "link_invalido"
  | "sem_descadastro"
  | "html_bruto"
  | "peso_excessivo"
  | "assunto_longo";

export const EMAIL_VALIDATION_LABEL: Record<EmailValidationRule, string> = {
  assunto_vazio: "Assunto vazio",
  preheader_vazio: "Preheader vazio",
  sem_conteudo: "E-mail sem conteúdo",
  imagem_sem_alt: "Imagem sem texto alternativo",
  link_invalido: "Link inválido",
  sem_descadastro: "Sem descadastro",
  html_bruto: "HTML controlado",
  peso_excessivo: "Peso acima do corte do Gmail",
  assunto_longo: "Assunto longo demais",
};

export interface EmailValidationIssue {
  id: string;
  rule: EmailValidationRule;
  severity: "erro" | "alerta";
  message: string;
  blockId?: Id;
}

/* Entregabilidade --------------------------------------------------------- */

export type DnsRecordStatus = "verificado" | "pendente" | "falhou";

export interface DnsRecord {
  type: "TXT" | "CNAME" | "MX";
  host: string;
  value: string;
  status: DnsRecordStatus;
  purpose: "SPF" | "DKIM" | "DMARC" | "rastreamento";
}

export interface EmailDomain extends BaseEntity {
  domain: string;
  /**
   * Domínio de marketing separado do transacional: uma campanha ruim não pode
   * derrubar a entrega de um boleto (seção 14.3).
   */
  purpose: "marketing" | "transacional";
  spf: DnsRecordStatus;
  dkim: DnsRecordStatus;
  dmarc: DnsRecordStatus;
  dmarcPolicy: "none" | "quarantine" | "reject";
  reputation: "alta" | "media" | "baixa";
  records: DnsRecord[];
  dailyLimit: number;
  sentToday: number;
  /** Aquecimento: dia atual e total planejado. Ausente quando já aquecido. */
  warmupDay?: number;
  warmupTotalDays?: number;
  verifiedAt?: IsoDateTime;
}

export type SuppressionReason =
  "bounce_permanente" | "bounce_temporario" | "reclamacao" | "descadastro" | "manual";

export const SUPPRESSION_REASON_LABEL: Record<SuppressionReason, string> = {
  bounce_permanente: "Bounce permanente",
  bounce_temporario: "Bounce temporário",
  reclamacao: "Marcado como spam",
  descadastro: "Descadastro",
  manual: "Bloqueio manual",
};

export interface SuppressionEntry {
  id: Id;
  organizationId: Id;
  address: string;
  reason: SuppressionReason;
  /** Origem: campanha, jornada, e-mail transacional ou ação manual. */
  source: string;
  detail?: string;
  occurredAt: IsoDateTime;
  /** Bounce temporário pode expirar; permanente e reclamação, nunca. */
  expiresAt?: IsoDateTime;
}

export interface EmailDeliveryStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}
