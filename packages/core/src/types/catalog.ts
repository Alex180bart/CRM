/**
 * Catálogo editável: o vocabulário que a operação usa todo dia.
 * Referência: Plano Completo, seções 9.1 (atributos), 10 (produtividade) e 27.2.
 *
 * Tag, resposta rápida e campo personalizado já existiam como dado de
 * demonstração — desenhados nas telas, sem lugar para criar ou corrigir. O que
 * este arquivo acrescenta é o que faltava para eles serem administráveis, mais
 * duas listas que o produto usava implícitas:
 *
 * - **motivo de encerramento**, que é o que transforma "conversa fechada" em
 *   relatório de por quê;
 * - **habilidade**, que é o vocabulário do modelo de distribuição por
 *   competência. Sem cadastro, cada pessoa digitaria "fiscal", "Fiscal" e
 *   "tributário" e o filtro nunca casaria.
 *
 * ## Chave é imutável, rótulo não
 *
 * `key` é o que fica gravado em conversa, contato e evento; `label` é o que
 * aparece na tela. Permitir editar a chave depois de usada renomearia o passado
 * pela metade: os registros antigos guardam a chave antiga, e o relatório passa
 * a mostrar duas linhas para a mesma coisa.
 */

import type { BaseEntity, ChannelKind, Id } from "./common";

/* Motivos de encerramento ---------------------------------------------------- */

/**
 * Por que a conversa terminou.
 *
 * `resolvido` separa o que virou solução do que virou desistência — e é essa
 * separação, não a contagem de conversas fechadas, que responde se o
 * atendimento está funcionando.
 */
export interface ClosingReason extends BaseEntity {
  key: string;
  label: string;
  description: string;
  resolved: boolean;
  /** Exige texto livre do atendente ao escolher este motivo. */
  requiresNote: boolean;
  active: boolean;
  order: number;
}

/* Campos personalizados ------------------------------------------------------ */

export type CustomFieldType = "texto" | "numero" | "data" | "selecao" | "booleano" | "documento";

export const CUSTOM_FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
  selecao: "Seleção",
  booleano: "Sim / Não",
  documento: "Documento (CPF/CNPJ)",
};

export type CustomFieldEntity = "contato" | "empresa" | "negocio" | "conversa";

export const CUSTOM_FIELD_ENTITY_LABEL: Record<CustomFieldEntity, string> = {
  contato: "Contato",
  empresa: "Empresa",
  negocio: "Negócio",
  conversa: "Conversa",
};

export interface CustomFieldDefinition extends BaseEntity {
  key: string;
  label: string;
  description: string;
  entity: CustomFieldEntity;
  type: CustomFieldType;
  /** Opções quando o tipo é `selecao`. */
  options: string[];
  required: boolean;
  /**
   * Campo derivado é calculado, não digitado (seção 27.2).
   *
   * Marcado assim, a tela mostra e não deixa editar. Sem a marca, alguém
   * corrigiria à mão um valor que o próximo cálculo sobrescreve — e o sintoma
   * apareceria como "o sistema desfez o que eu salvei".
   */
  derived: boolean;
  /**
   * Contém dado pessoal sensível.
   *
   * Muda dois comportamentos: o mascaramento no contexto que a IA recebe
   * (seção 16.4) e a exigência de base legal no relatório de retenção.
   */
  sensitive: boolean;
  active: boolean;
}

/* Habilidades ---------------------------------------------------------------- */

/**
 * Competência que uma pessoa declara e uma fila pode exigir.
 *
 * Existe como cadastro, e não como texto livre no perfil, porque o modelo de
 * distribuição por habilidade compara chaves. Texto livre produziria o filtro
 * que nunca casa e o diagnóstico mais caro de todos: "a fila está parada e
 * ninguém sabe por quê".
 */
export interface SkillDefinition extends BaseEntity {
  key: string;
  label: string;
  description: string;
  /** Matiz HSL do chip, no mesmo esquema das tags. */
  hue: number;
  active: boolean;
}

/* Respostas rápidas ---------------------------------------------------------- */

/**
 * O tipo de leitura vive em `types/inbox.ts` porque é lá que ele é consumido.
 * Aqui fica só o que a Administração precisa saber para editá-lo: a quem
 * pertence e se está publicada.
 */
export interface CannedResponseAdmin {
  id: Id;
  shortcut: string;
  title: string;
  body: string;
  channels: ChannelKind[];
  /** Vazio significa disponível para toda a organização. */
  teamIds: Id[];
  active: boolean;
}
