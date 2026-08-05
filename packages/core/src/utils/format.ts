import { APP_LOCALE } from "./datetime";

const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const currencyPreciseFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(APP_LOCALE);

/** Valores monetários trafegam em centavos para evitar erro de ponto flutuante. */
export function formatCurrencyCents(cents: number, precise = false): string {
  const value = cents / 100;
  return precise ? currencyPreciseFormatter.format(value) : currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Máscara de exibição para telefone brasileiro em E.164.
 * A normalização canônica (para deduplicação) continua sendo E.164 puro —
 * esta função é apenas de apresentação.
 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return e164;
}

/** Mascara documento para exibição a perfis sem permissão de dado sensível. */
export function maskDocument(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (digits.length !== 11) return document;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
