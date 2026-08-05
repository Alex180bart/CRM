/**
 * Validação e incorporação do widget de webchat.
 *
 * Mesma disciplina de `flow-validation.ts` e `email-validation.ts`: a checagem
 * roda antes de publicar, separa erro de alerta, e erro **bloqueia**. O que
 * bloqueia aqui foi escolhido pelo dano: widget sem domínio autorizado aceita
 * conversa de qualquer site, e contraste reprovado entrega ao visitante um botão
 * que ele não vê. Os dois quebram em produção, não no editor.
 */

import { checkWidgetContrast } from "./color";
import type { WebchatWidget, WebchatWidgetVersion, WidgetValidationIssue } from "../types/webchat";

export function validateWidget(
  widget: WebchatWidget,
  version: WebchatWidgetVersion,
): WidgetValidationIssue[] {
  const issues: WidgetValidationIssue[] = [];
  const { appearance, messages, behavior, privacy } = version;

  if (widget.allowedDomains.length === 0) {
    issues.push({
      id: "sem_dominio",
      rule: "sem_dominio",
      severity: "erro",
      message:
        "Sem domínio autorizado, o trecho de incorporação funciona em qualquer site — inclusive num que você não controla.",
    });
  }

  const contrast = checkWidgetContrast(appearance.brandColor);
  if (contrast.verdict === "reprovado") {
    issues.push({
      id: "contraste",
      rule: "contraste_insuficiente",
      severity: "erro",
      message: contrast.message,
    });
  } else if (contrast.verdict === "limite") {
    issues.push({
      id: "contraste",
      rule: "contraste_insuficiente",
      severity: "alerta",
      message: contrast.message,
    });
  }

  if (!messages.greeting.trim()) {
    issues.push({
      id: "saudacao",
      rule: "saudacao_vazia",
      severity: "alerta",
      message:
        "Sem saudação, a janela abre em branco e o visitante precisa adivinhar o que perguntar.",
    });
  }

  if (behavior.prechatEnabled) {
    for (const field of behavior.prechatFields) {
      if (!field.label.trim()) {
        issues.push({
          id: `campo_${field.id}`,
          rule: "campo_sem_rotulo",
          severity: "erro",
          message: "Um campo do formulário está sem rótulo — o visitante não sabe o que preencher.",
        });
      }
      if (field.kind === "selecao" && (field.options ?? []).length < 2) {
        issues.push({
          id: `opcoes_${field.id}`,
          rule: "selecao_sem_opcoes",
          severity: "erro",
          message: `O campo "${field.label || "sem rótulo"}" é de seleção e tem menos de duas opções.`,
        });
      }
    }
  }

  if (privacy.consentRequired && !privacy.consentText.trim()) {
    issues.push({
      id: "consentimento",
      rule: "consentimento_sem_texto",
      severity: "erro",
      message:
        "O aceite é obrigatório mas não há texto. É o texto exibido que fica gravado como prova (seção 18).",
    });
  }

  const openDays = behavior.schedule.filter((day) => day.from && day.to);
  if (openDays.length === 0) {
    issues.push({
      id: "horario",
      rule: "horario_vazio",
      severity: "erro",
      message: "Nenhum dia com horário de atendimento: o widget ficaria sempre fechado.",
    });
  }

  if (behavior.outsideHours === "bot" && !behavior.botFlowId) {
    issues.push({
      id: "fora_horario",
      rule: "fora_do_horario_sem_bot",
      severity: "erro",
      message:
        "Fora do horário está configurado para o chatbot atender, mas nenhum fluxo foi escolhido.",
    });
  }

  return issues;
}

export function hasBlockingWidgetIssue(issues: WidgetValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "erro");
}

/**
 * Trecho de incorporação.
 *
 * Assíncrono e sem `document.write`: um script bloqueante no site do cliente
 * atrasa a primeira pintura da página dele, e a conta chega como "o chat deixou
 * meu site lento". A `data-key` é pública de propósito — quem autoriza é a lista
 * de domínios no servidor, não o segredo da chave, que estaria no HTML de
 * qualquer forma.
 */
export function buildEmbedSnippet(widget: WebchatWidget, origin: string): string {
  return `<!-- Webchat · ${widget.name} -->
<script>
  (function () {
    var s = document.createElement("script");
    s.src = "${origin}/webchat/embed.js";
    s.async = true;
    s.dataset.key = "${widget.embedKey}";
    document.head.appendChild(s);
  })();
</script>`;
}

/** Está dentro do horário de atendimento agora? */
export function isWithinSchedule(
  version: WebchatWidgetVersion,
  reference: Date,
  minutesOfDay?: number,
): boolean {
  const day = version.behavior.schedule.find((item) => item.weekday === reference.getDay());
  if (!day?.from || !day.to) return false;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  };

  const now = minutesOfDay ?? reference.getHours() * 60 + reference.getMinutes();
  return now >= toMinutes(day.from) && now < toMinutes(day.to);
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS[weekday] ?? "";
}

/**
 * Resume o horário agrupando dias iguais e seguidos.
 *
 * "Segunda a sexta, 09:00–18:00" em vez de cinco linhas idênticas. A leitura de
 * um horário de atendimento é sempre por faixa, nunca dia a dia.
 */
export function summarizeSchedule(version: WebchatWidgetVersion): string {
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => version.behavior.schedule.find((day) => day.weekday === weekday))
    .filter((day): day is NonNullable<typeof day> => Boolean(day));

  const groups: Array<{ days: number[]; from: string; to: string }> = [];

  for (const day of ordered) {
    if (!day.from || !day.to) continue;
    const last = groups[groups.length - 1];
    if (last && last.from === day.from && last.to === day.to) {
      last.days.push(day.weekday);
    } else {
      groups.push({ days: [day.weekday], from: day.from, to: day.to });
    }
  }

  if (groups.length === 0) return "Sem horário de atendimento";

  return groups
    .map((group) => {
      const first = weekdayLabel(group.days[0]!);
      const last = weekdayLabel(group.days[group.days.length - 1]!);
      const span = group.days.length === 1 ? first : `${first} a ${last}`;
      return `${span}, ${group.from}–${group.to}`;
    })
    .join(" · ");
}
