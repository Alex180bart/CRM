/**
 * Confronto entre o que o modelo propôs e o que o cadastro já sabe.
 *
 * Este é o ponto onde a seção 16.3 do plano se materializa: o modelo propõe, a
 * **aplicação** decide. Ela normaliza (E.164, minúsculas, máscara padrão),
 * verifica dígito verificador, compara com o valor atual e classifica em quatro
 * situações — porque as quatro pedem tratamentos diferentes na tela:
 *
 * - `novo`: o campo está vazio. Um clique resolve.
 * - `divergente`: o campo tem outro valor. Trocar exige ver os dois lados.
 * - `igual`: o cadastro já sabe. Some da lista; oferecer seria ruído.
 * - `invalido`: o dado não passa na verificação. Some da lista **e** guarda o
 *   motivo, porque um CPF com dígito errado costuma indicar erro de digitação
 *   do cliente, e isso é assunto do atendimento, não do cadastro.
 *
 * Função pura de propósito: a mesma decisão precisa valer no servidor quando a
 * camada de escrita existir. Duplicá-la em componente criaria duas verdades.
 */

import type { AiProposal, AiProposalStatus, AiResolvedProposal } from "../types/ai";
import type { Contact } from "../types/crm";
import {
  digitsOnly,
  formatCnpj,
  formatCpf,
  isValidCnpj,
  isValidCpf,
  normalizeEmail,
  normalizePhoneBr,
} from "./identity";

/**
 * Piso de confiança.
 *
 * Abaixo disto o modelo está adivinhando, e adivinhação no cadastro de um
 * escritório contábil custa mais caro que a lacuna que ela preencheria.
 */
export const PROPOSAL_CONFIDENCE_FLOOR = 60;

interface Normalized {
  value: string;
  reason?: string;
}

/** Normaliza e recusa. Devolver `reason` significa recusa. */
function normalize(field: string, raw: string): Normalized {
  const value = raw.trim();
  if (!value) return { value: "", reason: "valor vazio" };

  switch (field) {
    case "contato.documento": {
      const digits = digitsOnly(value);
      if (digits.length === 11) {
        return isValidCpf(digits)
          ? { value: formatCpf(digits) }
          : { value, reason: "CPF com dígito verificador inválido" };
      }
      if (digits.length === 14) {
        return isValidCnpj(digits)
          ? { value: formatCnpj(digits) }
          : { value, reason: "CNPJ com dígito verificador inválido" };
      }
      return { value, reason: "documento não tem 11 nem 14 dígitos" };
    }

    case "contato.telefone": {
      const phone = normalizePhoneBr(value);
      return phone ? { value: phone } : { value, reason: "telefone sem DDD ou fora do padrão" };
    }

    case "contato.email": {
      const email = normalizeEmail(value);
      return email ? { value: email } : { value, reason: "e-mail com formato inválido" };
    }

    case "contato.estado": {
      const uf = value.toUpperCase().replace(/[^A-Z]/g, "");
      return uf.length === 2 ? { value: uf } : { value, reason: "UF precisa ter duas letras" };
    }

    default:
      return { value };
  }
}

/** O que o cadastro tem hoje naquele campo. `undefined` significa lacuna. */
function currentValue(contact: Contact, field: string): string | undefined {
  switch (field) {
    case "contato.email":
      return contact.email;
    case "contato.telefone":
      return contact.phone;
    case "contato.cargo":
      return contact.jobTitle;
    case "contato.cidade":
      return contact.city;
    case "contato.estado":
      return contact.state;
    case "contato.documento":
      return contact.identifiers.find((item) => item.kind === "cpf")?.value;
    default: {
      if (!field.startsWith("campo.")) return undefined;
      const key = field.slice("campo.".length);
      return contact.customFields.find((item) => item.key === key)?.value || undefined;
    }
  }
}

/** Compara ignorando máscara e caixa — "11987654321" e "+5511987654321" são o mesmo. */
function sameValue(field: string, a: string, b: string): boolean {
  if (field === "contato.documento" || field === "contato.telefone") {
    return digitsOnly(a).endsWith(digitsOnly(b)) || digitsOnly(b).endsWith(digitsOnly(a));
  }
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function resolveProposal(proposal: AiProposal, contact?: Contact): AiResolvedProposal {
  // Ações que não tocam campo do contato entram como novidade: não há o que comparar.
  if (proposal.kind !== "preencher_campo" || !proposal.field) {
    return { proposal, status: "novo", normalized: proposal.value.trim() };
  }

  const field = proposal.field;

  // Campo personalizado que a organização não definiu não existe para gravar.
  if (field.startsWith("campo.") && contact) {
    const key = field.slice("campo.".length);
    const known = contact.customFields.some((item) => item.key === key);
    if (!known) {
      return {
        proposal,
        status: "invalido",
        normalized: proposal.value,
        reason: `campo personalizado "${key}" não existe nesta organização`,
      };
    }
  }

  const { value, reason } = normalize(field, proposal.value);
  if (reason) {
    return { proposal, status: "invalido", normalized: value, reason };
  }

  const current = contact ? currentValue(contact, field) : undefined;

  let status: AiProposalStatus;
  if (!current) status = "novo";
  else if (sameValue(field, current, value)) status = "igual";
  else status = "divergente";

  return { proposal, status, normalized: value, current };
}

/**
 * Resolve a lista inteira e devolve só o que merece a tela.
 *
 * `igual` e confiança baixa somem: a lista de tabulação precisa ser curta o
 * bastante para ser lida inteira, senão o atendente ignora o bloco todo — e aí
 * a lacuna que importava passa junto com o ruído. `invalido` também sai da
 * lista principal, mas volta em `discarded` para o painel poder explicar.
 */
export function resolveProposals(
  proposals: AiProposal[],
  contact?: Contact,
): { actionable: AiResolvedProposal[]; discarded: AiResolvedProposal[] } {
  const actionable: AiResolvedProposal[] = [];
  const discarded: AiResolvedProposal[] = [];

  for (const proposal of proposals) {
    const resolved = resolveProposal(proposal, contact);

    if (resolved.status === "igual") continue;
    if (resolved.status === "invalido") {
      discarded.push(resolved);
      continue;
    }
    if (proposal.confidence < PROPOSAL_CONFIDENCE_FLOOR) {
      discarded.push({ ...resolved, reason: `confiança de ${proposal.confidence}%` });
      continue;
    }

    actionable.push(resolved);
  }

  // Lacuna antes de divergência: preencher é decisão barata, trocar não é.
  return {
    actionable: actionable.sort((a, b) => {
      if (a.status !== b.status) return a.status === "novo" ? -1 : 1;
      return b.proposal.confidence - a.proposal.confidence;
    }),
    discarded,
  };
}
