"use client";

import { useEffect, useState } from "react";
import type { WebchatWidgetVersion } from "@crm/core";
import { darken, lighten, readableInk } from "@crm/core";
import { cn } from "@crm/ui";
import { ChevronDown, Minus, Paperclip, Send, Smile, X } from "lucide-react";

import { LauncherIcon } from "./launcher-icon";

/**
 * Prévia do widget.
 *
 * Este componente é a fonte de verdade visual do webchat no editor: o que se vê
 * aqui é o que o visitante vê no site do cliente. Por isso ele **não usa token do
 * design system** — usa a cor da marca configurada e neutros literais. Um widget
 * pintado com `bg-primary` mudaria de cor junto com o nosso tema e mentiria sobre
 * o resultado; e no site do cliente não existe `--primary` nenhum.
 *
 * A moldura do site em volta existe pelo mesmo motivo da moldura de celular na
 * prévia de campanha: aprovar um widget olhando os campos do formulário esconde
 * o que decide a adoção — se o lançador briga com o botão de compra, se a janela
 * cobre o menu, se o rótulo cabe.
 */

const CORNER_RADIUS = {
  arredondado: { window: 20, launcher: 999, bubble: 16 },
  suave: { window: 12, launcher: 12, bubble: 10 },
  reto: { window: 2, launcher: 4, bubble: 3 },
} as const;

/**
 * Aparelho da prévia.
 *
 * Não é enfeite: no celular o widget aberto ocupa **a tela inteira**, e é aí que
 * decisões tomadas no desktop desandam — rótulo longo vira duas linhas, o
 * formulário de três campos empurra o compositor para fora, e a barra na base
 * cobre o menu fixo do site. Ver os dois é a única forma de decidir.
 */
export type PreviewDevice = "desktop" | "celular";

export type PreviewStage = "fechado" | "saudacao" | "formulario" | "conversa" | "fora_do_horario";

export function WidgetPreview({
  version,
  stage,
  device = "desktop",
  onStageChange,
  className,
}: {
  version: WebchatWidgetVersion;
  stage: PreviewStage;
  device?: PreviewDevice;
  onStageChange: (stage: PreviewStage) => void;
  className?: string;
}) {
  const { appearance, messages, behavior, privacy } = version;
  const brand = appearance.brandColor;
  const ink = readableInk(brand).hex;
  const radius = CORNER_RADIUS[appearance.corner];
  const left = appearance.position === "esquerda";

  /**
   * A saudação respeita o atraso configurado.
   *
   * Não é enfeite: quatro segundos e zero segundo produzem experiências
   * diferentes, e a única forma de decidir entre elas é sentir a espera. Mostrar
   * a bolha na hora, com o campo dizendo "4 s", esconderia justamente o que se
   * está configurando.
   */
  const [greetingVisible, setGreetingVisible] = useState(stage !== "fechado");

  useEffect(() => {
    if (stage === "fechado") {
      setGreetingVisible(false);
      return;
    }
    if (messages.greetingDelaySeconds <= 0) {
      setGreetingVisible(true);
      return;
    }
    setGreetingVisible(false);
    const timer = setTimeout(() => setGreetingVisible(true), messages.greetingDelaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [stage, messages.greetingDelaySeconds]);

  const open = stage !== "fechado";
  const mobile = device === "celular";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        // O plano do site fingido é neutro literal, não `surface`: ele representa
        // a página de terceiro, não a nossa interface.
        "bg-[#F4F6F9]",
        mobile ? "mx-auto w-[19.5rem] rounded-[1.75rem] ring-8 ring-slate-900" : "rounded-lg",
        className,
      )}
      style={{ height: 470 }}
    >
      {/* Casca do navegador do cliente */}
      {mobile ? (
        <div className="flex items-center justify-between bg-[#E2E6EC] px-4 py-1.5 text-[9px] text-[#6B7A90]">
          <span className="font-medium tabular-nums">14:32</span>
          <span className="truncate px-2">contabilidadefacilitada.com</span>
          <span>100%</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-[#E2E6EC] px-3 py-2">
          <span className="size-2 rounded-full bg-[#C9CFD8]" />
          <span className="size-2 rounded-full bg-[#C9CFD8]" />
          <span className="size-2 rounded-full bg-[#C9CFD8]" />
          <span className="ml-2 flex-1 truncate rounded bg-white px-2 py-0.5 text-[10px] text-[#6B7A90]">
            contabilidadefacilitada.com
          </span>
        </div>
      )}

      {/* Conteúdo esqueleto da página — cinza para o widget ser a única cor. */}
      <div className={mobile ? "px-4 py-4" : "px-6 py-5"} aria-hidden>
        <div className="mb-4 flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-[#D6DBE3]" />
          {mobile ? (
            <div className="h-3 w-6 rounded bg-[#E2E6EC]" />
          ) : (
            <div className="flex gap-2">
              <div className="h-3 w-12 rounded bg-[#E2E6EC]" />
              <div className="h-3 w-12 rounded bg-[#E2E6EC]" />
              <div className="h-3 w-12 rounded bg-[#E2E6EC]" />
            </div>
          )}
        </div>
        <div className="mb-2 h-6 w-3/5 rounded bg-[#D6DBE3]" />
        <div className="mb-1.5 h-3 w-4/5 rounded bg-[#E2E6EC]" />
        <div className="mb-4 h-3 w-2/3 rounded bg-[#E2E6EC]" />
        <div className="h-8 w-32 rounded bg-[#D6DBE3]" />
        <div className={cn("mt-6 grid gap-3", mobile ? "grid-cols-1" : "grid-cols-3")}>
          <div className="h-20 rounded bg-[#E9EDF2]" />
          {mobile ? null : (
            <>
              <div className="h-20 rounded bg-[#E9EDF2]" />
              <div className="h-20 rounded bg-[#E9EDF2]" />
            </>
          )}
        </div>
      </div>

      {/* Lançador ---------------------------------------------------------- */}
      {!open ? (
        appearance.launcher === "barra" ? (
          <button
            type="button"
            onClick={() => onStageChange("saudacao")}
            className="webchat-launcher-in absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 py-3 text-xs font-semibold shadow-[0_-4px_16px_rgba(16,40,80,0.18)]"
            style={{ backgroundColor: brand, color: ink }}
          >
            {appearance.launcherLabel || "Falar com a gente"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStageChange("saudacao")}
            className={cn(
              "webchat-launcher-in absolute bottom-4 flex items-center gap-2 shadow-[0_6px_20px_rgba(16,40,80,0.24)] transition-transform hover:scale-105",
              appearance.launcher === "bolha_rotulo" ? "px-4 py-3" : "size-14 justify-center",
              left ? "left-4" : "right-4",
            )}
            style={
              {
                backgroundColor: brand,
                color: ink,
                borderRadius: radius.launcher,
                // Tinta do miolo dos glifos de duas cores.
                "--launcher-ink": brand,
              } as React.CSSProperties
            }
          >
            <LauncherIcon icon={appearance.icon} logoUrl={appearance.logoUrl} />
            {appearance.launcher === "bolha_rotulo" ? (
              <span className="whitespace-nowrap text-xs font-semibold">
                {appearance.launcherLabel || "Falar com a gente"}
              </span>
            ) : null}
          </button>
        )
      ) : null}

      {/* Janela ------------------------------------------------------------ */}
      {open ? (
        <div
          className={cn(
            "webchat-open absolute flex flex-col overflow-hidden bg-white shadow-[0_12px_40px_rgba(16,40,80,0.28)]",
            // No celular a janela toma a tela: é assim que todo webchat se
            // comporta ali, e mostrar uma janelinha flutuante enganaria quem
            // está decidindo se o formulário de três campos cabe.
            mobile
              ? "inset-x-2 bottom-2 top-9"
              : cn("bottom-4 w-[19rem]", left ? "left-4" : "right-4"),
          )}
          style={
            {
              borderRadius: radius.window,
              maxHeight: mobile ? undefined : 400,
              "--webchat-origin": left ? "bottom left" : "bottom right",
            } as React.CSSProperties
          }
        >
          {/* Cabeçalho */}
          <div
            className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ backgroundColor: brand, color: ink }}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
              style={{ backgroundColor: `${ink}22` }}
            >
              {appearance.icon === "logo" && appearance.logoUrl ? (
                <img src={appearance.logoUrl} alt="" className="size-full object-contain" />
              ) : (
                appearance.avatarInitials || "CF"
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight">
                {appearance.headerTitle || "Atendimento"}
              </span>
              <span className="block truncate text-[10px] leading-tight opacity-80">
                {appearance.headerSubtitle}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onStageChange("fechado")}
              aria-label="Minimizar prévia"
              className="shrink-0 opacity-80 hover:opacity-100"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onStageChange("fechado")}
              aria-label="Fechar prévia"
              className="shrink-0 opacity-80 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Corpo */}
          <div
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
            style={{ backgroundColor: lighten(brand, 0.96) }}
          >
            {stage === "fora_do_horario" ? (
              <Bubble radius={radius.bubble} tone="agent">
                {messages.awayOutside || "Estamos fora do horário de atendimento."}
              </Bubble>
            ) : (
              <>
                {greetingVisible ? (
                  <Bubble radius={radius.bubble} tone="agent">
                    {messages.greeting || "…"}
                  </Bubble>
                ) : (
                  <TypingBubble radius={radius.bubble} />
                )}

                {stage === "formulario" && behavior.prechatEnabled ? (
                  <div
                    className="webchat-bubble-in bg-white p-3 shadow-[0_1px_3px_rgba(16,40,80,0.12)]"
                    style={{ borderRadius: radius.bubble }}
                  >
                    {messages.prechatIntro ? (
                      <p className="mb-2.5 text-[11px] leading-relaxed text-[#48566B]">
                        {messages.prechatIntro}
                      </p>
                    ) : null}

                    <div className="space-y-2">
                      {behavior.prechatFields.map((field) => (
                        <div key={field.id}>
                          <label className="mb-0.5 block text-[10px] font-medium text-[#48566B]">
                            {field.label || "Sem rótulo"}
                            {field.required ? <span style={{ color: brand }}> *</span> : null}
                          </label>
                          {field.kind === "selecao" ? (
                            <div className="flex items-center justify-between rounded border border-[#D6DBE3] px-2 py-1.5 text-[11px] text-[#8A96A8]">
                              {field.options?.[0] ?? "Escolha uma opção"}
                              <ChevronDown className="size-3" />
                            </div>
                          ) : (
                            <div className="rounded border border-[#D6DBE3] px-2 py-1.5 text-[11px] text-[#8A96A8]">
                              {field.placeholder ||
                                (field.kind === "email"
                                  ? "nome@empresa.com"
                                  : field.kind === "telefone"
                                    ? "(11) 90000-0000"
                                    : "Digite aqui")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {privacy.consentRequired ? (
                      <p className="mt-2.5 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#6B7A90]">
                        <span
                          className="mt-px size-3 shrink-0 rounded-sm border"
                          style={{ borderColor: brand }}
                        />
                        {privacy.consentText || "Texto de consentimento não preenchido."}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onStageChange("conversa")}
                      className="mt-2.5 w-full py-2 text-[11px] font-semibold"
                      style={{ backgroundColor: brand, color: ink, borderRadius: radius.bubble }}
                    >
                      Começar conversa
                    </button>
                  </div>
                ) : null}

                {stage === "conversa" ? (
                  <>
                    <Bubble radius={radius.bubble} tone="visitor" brand={brand} ink={ink}>
                      Preciso trocar de contador. Vocês fazem a migração?
                    </Bubble>
                    <Bubble radius={radius.bubble} tone="agent">
                      {messages.awayInside || "Recebemos sua mensagem."}
                    </Bubble>
                  </>
                ) : null}
              </>
            )}
          </div>

          {/* Compositor */}
          <div className="flex items-center gap-1.5 border-t border-[#E9EDF2] bg-white px-2.5 py-2">
            <Smile className="size-4 shrink-0 text-[#A6B0BF]" />
            <span className="flex-1 truncate text-[11px] text-[#A6B0BF]">
              {messages.placeholder || "Escreva sua mensagem"}
            </span>
            <Paperclip className="size-4 shrink-0 text-[#A6B0BF]" />
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: brand, color: ink }}
            >
              <Send className="size-3.5" />
            </span>
          </div>

          {appearance.showBranding ? (
            <p className="bg-white pb-2 text-center text-[9px] text-[#A6B0BF]">
              Atendimento por <span className="font-semibold">CRM CF</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Bubble({
  children,
  radius,
  tone,
  brand,
  ink,
}: {
  children: React.ReactNode;
  radius: number;
  tone: "agent" | "visitor";
  brand?: string;
  ink?: string;
}) {
  const visitor = tone === "visitor";
  return (
    <div className={cn("webchat-bubble-in flex", visitor ? "justify-end" : "justify-start")}>
      <p
        className="max-w-[85%] whitespace-pre-wrap break-words px-2.5 py-1.5 text-[11.5px] leading-relaxed"
        style={
          visitor
            ? { backgroundColor: darken(brand ?? "#102850", 0.1), color: ink, borderRadius: radius }
            : {
                backgroundColor: "#FFFFFF",
                color: "#1E2A3B",
                borderRadius: radius,
                boxShadow: "0 1px 3px rgba(16,40,80,0.12)",
              }
        }
      >
        {children}
      </p>
    </div>
  );
}

/** Três pontos enquanto a saudação não chega — mostra o atraso configurado. */
function TypingBubble({ radius }: { radius: number }) {
  return (
    <div className="flex justify-start">
      <span
        className="flex items-center gap-1 bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(16,40,80,0.12)]"
        style={{ borderRadius: radius }}
        aria-label="Digitando"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-pulse rounded-full bg-[#A6B0BF]"
            style={{ animationDelay: `${index * 180}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
