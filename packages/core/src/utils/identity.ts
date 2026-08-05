/**
 * Validação e normalização de identificadores brasileiros.
 *
 * Existe porque o copiloto propõe preencher cadastro a partir do que o cliente
 * escreveu, e texto de conversa é a pior fonte possível: dígito trocado, número
 * de outra pessoa, sequência de teste. **Nenhuma proposta chega à tela sem
 * passar por aqui.** Um CPF que falha o dígito verificador não é oferecido nem
 * como sugestão — oferecê-lo transferiria para o atendente o trabalho de
 * conferir onze dígitos a olho, que é exatamente o que a máquina faz melhor.
 *
 * Função pura, sem dependência de framework: a mesma verificação vale para a
 * rota do servidor e para a interface, e uma segunda implementação em qualquer
 * um dos dois lados seria uma segunda verdade.
 */

const DIGITS = /\D/g;

/**
 * Dígitos verificadores do CPF.
 *
 * Repetições (`111.111.111-11`) passam no cálculo e são recusadas à parte: são
 * o valor que alguém digita para "preencher o campo", nunca um CPF real.
 */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(DIGITS, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (const length of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    const check = remainder === 10 ? 0 : remainder;
    if (check !== Number(digits[length])) return false;
  }

  return true;
}

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(DIGITS, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weightsOf = (length: number) =>
    Array.from({ length }, (_, index) => ((length - index) % 8) + 2);

  for (const length of [12, 13]) {
    const weights = weightsOf(length);
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (weights[index] ?? 0);
    }
    const remainder = sum % 11;
    const check = remainder < 2 ? 0 : 11 - remainder;
    if (check !== Number(digits[length])) return false;
  }

  return true;
}

export function formatCpf(value: string): string {
  const d = value.replace(DIGITS, "");
  if (d.length !== 11) return value;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(value: string): string {
  const d = value.replace(DIGITS, "");
  if (d.length !== 14) return value;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Telefone brasileiro em E.164.
 *
 * Aceita o que se escreve numa conversa — "(11) 98765-4321", "11987654321",
 * "+55 11 98765 4321" — e devolve `+5511987654321`. Devolve `null` quando o
 * número não tem DDD ou tem dígitos demais: melhor recusar do que gravar um
 * número que o canal não consegue discar.
 */
export function normalizePhoneBr(value: string): string | null {
  let digits = value.replace(DIGITS, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);

  // Sem DDD não dá para discar, e supor um DDD seria inventar dado.
  if (digits.length !== 10 && digits.length !== 11) return null;

  const areaCode = Number(digits.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) return null;

  // Celular tem 11 dígitos e começa com 9 depois do DDD; fixo tem 10 e começa em 2–5.
  const subscriber = digits.slice(2);
  if (subscriber.length === 9 && !subscriber.startsWith("9")) return null;
  if (subscriber.length === 8 && !/^[2-5]/.test(subscriber)) return null;

  return `+55${digits}`;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

/** Minúsculas e sem espaço. Devolve `null` quando o formato não fecha. */
export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return EMAIL_SHAPE.test(trimmed) ? trimmed : null;
}

/** Só os dígitos, para comparar dois documentos escritos com máscaras diferentes. */
export function digitsOnly(value: string): string {
  return value.replace(DIGITS, "");
}
