"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebchatPublicConfig } from "@/lib/webchat/server";
import type { WebchatMessage } from "@/lib/webchat/server";
import { darken, lighten, readableInk } from "@crm/core";
import { Minus, Send, X } from "lucide-react";

import { LauncherIcon } from "./launcher-icon";

/**
 * Widget ao vivo.
 *
 * Roda dentro do `iframe` que o `embed.js` cria no site do cliente. Fala com
 * `/api/webchat/*` de verdade: busca a configuração publicada, abre sessão,
 * envia mensagem e pergunta por resposta do atendente.
 *
 * Não usa token do design system, pelo mesmo motivo da prévia: aqui não existe
 * `--primary`. Tudo sai da cor configurada e de neutros literais.
 *
 * O tamanho é negociado com a página hospedeira por `postMessage`: o `iframe`
 * nasce do tamanho do lançador e cresce ao abrir. Um quadro grande e
 * transparente cobriria o site e roubaria todo clique.
 */

const CORNER_RADIUS = {
  arredondado: { window: 20, launcher: 999, bubble: 16 },
  suave: { window: 12, launcher: 12, bubble: 10 },
  reto: { window: 2, launcher: 4, bubble: 3 },
} as const;

/**
 * Caixa da janela aberta, em pixels. A do lançador fechado é **medida**, não
 * fixada: um `iframe` transparente continua capturando clique, e sobrar largura
 * ao lado de uma bolha de 56 px bloquearia o link do site que estivesse ali.
 */
const WINDOW_SIZE = { width: 380, height: 560 };
/**
 * Folga em volta do widget dentro do quadro.
 *
 * Serve a duas coisas: dar a margem que faz o widget flutuar em vez de ficar
 * colado na quina do navegador, e impedir que a sombra seja cortada pela borda
 * do `iframe` — sombra cortada é o detalhe que denuncia widget mal feito.
 */
const FRAME_PADDING = 24;

const OPEN_BOX = {
  width: WINDOW_SIZE.width + FRAME_PADDING,
  height: WINDOW_SIZE.height + FRAME_PADDING,
};

/** Duração da animação de saída. Precisa bater com `.webchat-close` nos tokens. */
const CLOSE_MS = 140;

/** Intervalo de leitura. Curto o bastante para parecer conversa, longo o bastante para não pesar. */
const POLL_MS = 4_000;

interface SessionView {
  sessionId: string;
  messages: WebchatMessage[];
  options: Array<{ id: string; label: string }>;
  awaitingAnswer: boolean;
  handedOff: boolean;
  open: boolean;
}

export function LiveWidget({
  embedKey,
  hostOrigin,
}: {
  embedKey: string;
  /** Endereço da página que incorporou o widget, informado pelo `embed.js`. */
  hostOrigin?: string;
}) {
  const [config, setConfig] = useState<WebchatPublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionView | null>(null);
  const [prechat, setPrechat] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [greetingVisible, setGreetingVisible] = useState(false);
  /**
   * Fase do fechamento.
   *
   * A janela precisa continuar montada durante a animacao de saida; desmontar no
   * clique cortaria o movimento pela metade. O quadro so encolhe quando a saida
   * termina, senao o `iframe` corta a janela antes de ela sumir.
   */
  const [closing, setClosing] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLDivElement>(null);

  /** Avisa a página hospedeira do tamanho que o quadro precisa ter. */
  const announce = useCallback(
    (box: { width: number; height: number }, type: "resize" | "close" = "resize") => {
      window.parent?.postMessage(
        {
          source: "crmcf-webchat",
          type,
          width: box.width,
          height: box.height,
          position: config?.appearance.position ?? "direita",
        },
        "*",
      );
    },
    [config?.appearance.position],
  );

  // Configuração: primeira coisa que acontece.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/webchat/config?key=${encodeURIComponent(embedKey)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as
          | WebchatPublicConfig
          | { error: { message: string } };

        if (cancelled) return;

        if (!response.ok || "error" in payload) {
          setError("error" in payload ? payload.error.message : "Widget indisponível.");
          return;
        }
        setConfig(payload);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o atendimento.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embedKey]);

  /**
   * O quadro fechado tem o tamanho do lançador — medido, não estimado.
   *
   * O rótulo é texto livre em fonte variável: calcular a largura a partir do
   * número de caracteres erra, e errar para menos corta o rótulo, para mais
   * bloqueia clique no site. O `ResizeObserver` acompanha inclusive a troca de
   * rótulo pelo editor.
   */
  useEffect(() => {
    if (!config || open) return;
    const element = launcherRef.current;
    if (!element) return;

    function report() {
      const box = element!.getBoundingClientRect();
      announce(
        {
          width: Math.ceil(box.width) + FRAME_PADDING,
          height: Math.ceil(box.height) + FRAME_PADDING,
        },
        "close",
      );
    }

    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [config, open, announce]);

  // A saudação respeita o atraso configurado, como na prévia do editor.
  useEffect(() => {
    if (!open || !config) return;
    if (config.messages.greetingDelaySeconds <= 0) {
      setGreetingVisible(true);
      return;
    }
    setGreetingVisible(false);
    const timer = setTimeout(
      () => setGreetingVisible(true),
      config.messages.greetingDelaySeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [open, config]);

  // Enquanto a conversa está com humano, pergunta se chegou resposta.
  useEffect(() => {
    if (!session || !open) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/webchat/message?session=${encodeURIComponent(session.sessionId)}`,
            { cache: "no-store" },
          );
          if (!response.ok) return;
          const next = (await response.json()) as SessionView;
          setSession(next);
        } catch {
          // Falha de rede momentânea não merece mensagem: a próxima leitura resolve.
        }
      })();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [session, open]);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session?.messages.length, greetingVisible]);

  if (error) {
    return (
      <div className="flex h-full items-end justify-end p-3">
        <p className="rounded-lg bg-white px-3 py-2 text-[11px] text-[#8A3A3A] shadow-lg">{error}</p>
      </div>
    );
  }

  if (!config) return null;

  const brand = config.appearance.brandColor;
  const ink = readableInk(brand).hex;
  const radius = CORNER_RADIUS[config.appearance.corner];
  const left = config.appearance.position === "esquerda";
  const needsForm = config.prechatEnabled && !session;

  function toggle(next: boolean) {
    if (next) {
      setOpen(true);
      announce(OPEN_BOX);
      return;
    }
    /**
     * Fecha em duas etapas: anima a saída, depois desmonta.
     *
     * Desmontar no clique cortaria o movimento pela metade, e encolher o quadro
     * junto cortaria a janela na borda do `iframe`. O tamanho só volta ao do
     * lançador quando a animação termina — é o efeito que faz o widget parecer
     * recolher para dentro do botão em vez de sumir.
     */
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, CLOSE_MS);
  }

  async function beginSession(): Promise<SessionView | null> {
    try {
      const response = await fetch("/api/webchat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: embedKey, prechat, host: hostOrigin }),
      });
      if (!response.ok) return null;
      const next = (await response.json()) as SessionView;
      setSession(next);
      return next;
    } catch {
      return null;
    }
  }

  async function send(text: string, portId?: string) {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");

    try {
      let active = session;
      if (!active) {
        active = await beginSession();
        if (!active) return;
      }

      const response = await fetch("/api/webchat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: active.sessionId, body, portId }),
      });

      if (response.status === 410) {
        // Sessão expirada: abre outra e reenvia, em vez de mostrar erro a quem
        // só quis escrever uma frase.
        const renewed = await beginSession();
        if (!renewed) return;
        const retry = await fetch("/api/webchat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: renewed.sessionId, body, portId }),
        });
        if (retry.ok) setSession((await retry.json()) as SessionView);
        return;
      }

      if (response.ok) setSession((await response.json()) as SessionView);
    } finally {
      setSending(false);
    }
  }

  const requiredMissing = config.prechatFields.some(
    (field) => field.required && !prechat[field.mapsTo ?? field.id]?.trim(),
  );
  const consentMissing = config.privacy.consentRequired && !consent;

  /* Fechado ---------------------------------------------------------------- */
  if (!open) {
    // A barra é a exceção: ela ocupa a largura da página de propósito, e por isso
    // o quadro pede 100% em vez do tamanho medido do botão.
    const isBar = config.appearance.launcher === "barra";

    return (
      <div
        className={`flex h-full items-end p-3 ${
          isBar ? "" : left ? "justify-start" : "justify-end"
        }`}
      >
        <div ref={launcherRef} className={`webchat-launcher-in ${isBar ? "w-full" : "inline-flex"}`}>
          {isBar ? (
            <button
              type="button"
              onClick={() => toggle(true)}
              className="w-full py-3 text-xs font-semibold shadow-lg"
              style={{ backgroundColor: brand, color: ink, borderRadius: radius.launcher }}
            >
              {config.appearance.launcherLabel || "Falar com a gente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => toggle(true)}
              className={`flex items-center gap-2 shadow-lg transition-transform hover:scale-105 ${
                config.appearance.launcher === "bolha_rotulo"
                  ? "px-4 py-3"
                  : "size-14 justify-center"
              }`}
              aria-label={config.appearance.launcherLabel || "Abrir atendimento"}
              style={
                {
                  backgroundColor: brand,
                  color: ink,
                  borderRadius: radius.launcher,
                  // A tinta do miolo dos glifos de duas cores sai daqui.
                  "--launcher-ink": brand,
                } as React.CSSProperties
              }
            >
              <LauncherIcon icon={config.appearance.icon} logoUrl={config.appearance.logoUrl} />
              {config.appearance.launcher === "bolha_rotulo" ? (
                <span className="whitespace-nowrap text-xs font-semibold">
                  {config.appearance.launcherLabel || "Falar com a gente"}
                </span>
              ) : null}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Aberto ----------------------------------------------------------------- */
  return (
    <div className={`flex h-full p-3 ${left ? "justify-start" : "justify-end"}`}>
      <div
        className={`flex size-full flex-col overflow-hidden bg-white shadow-[0_12px_40px_rgba(16,40,80,0.28)] ${
          closing ? "webchat-close" : "webchat-open"
        }`}
        style={
          {
            borderRadius: radius.window,
            "--webchat-origin": left ? "bottom left" : "bottom right",
          } as React.CSSProperties
        }
      >
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ backgroundColor: brand, color: ink }}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
          style={{ backgroundColor: `${ink}22` }}
        >
          {config.appearance.icon === "logo" && config.appearance.logoUrl ? (
                  <img src={config.appearance.logoUrl} alt="" className="size-full object-contain" />
          ) : (
            (config.appearance.avatarInitials || "CF")
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">
            {config.appearance.headerTitle}
          </span>
          <span className="block truncate text-[10px] leading-tight opacity-80">
            {config.open ? config.appearance.headerSubtitle : "Fora do horário de atendimento"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Minimizar"
          className="shrink-0 opacity-80 hover:opacity-100"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Fechar"
          className="shrink-0 opacity-80 hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
        style={{ backgroundColor: lighten(brand, 0.96) }}
      >
        {!session && greetingVisible ? (
          <Bubble radius={radius.bubble} tone="agent">
            {config.messages.greeting}
          </Bubble>
        ) : null}
        {!session && !greetingVisible ? <TypingBubble radius={radius.bubble} /> : null}

        {session?.messages.map((message) =>
          message.role === "visitante" ? (
            <Bubble key={message.id} radius={radius.bubble} tone="visitor" brand={brand} ink={ink}>
              {message.body}
            </Bubble>
          ) : message.role === "sistema" ? (
            <p key={message.id} className="text-center text-[10px] text-[#6B7A90]">
              {message.body}
            </p>
          ) : (
            <Bubble key={message.id} radius={radius.bubble} tone="agent">
              {message.body}
            </Bubble>
          ),
        )}

        {/* Formulário anterior à conversa */}
        {needsForm ? (
          <div
            className="bg-white p-3 shadow-[0_1px_3px_rgba(16,40,80,0.12)]"
            style={{ borderRadius: radius.bubble }}
          >
            {config.messages.prechatIntro ? (
              <p className="mb-2.5 text-[11px] leading-relaxed text-[#48566B]">
                {config.messages.prechatIntro}
              </p>
            ) : null}

            <div className="space-y-2">
              {config.prechatFields.map((field) => {
                const slot = field.mapsTo ?? field.id;
                return (
                  <div key={field.id}>
                    <label
                      htmlFor={`pf-${field.id}`}
                      className="mb-0.5 block text-[10px] font-medium text-[#48566B]"
                    >
                      {field.label}
                      {field.required ? <span style={{ color: brand }}> *</span> : null}
                    </label>
                    {field.kind === "selecao" ? (
                      <select
                        id={`pf-${field.id}`}
                        value={prechat[slot] ?? ""}
                        onChange={(event) =>
                          setPrechat((current) => ({ ...current, [slot]: event.target.value }))
                        }
                        className="w-full rounded border border-[#D6DBE3] bg-white px-2 py-1.5 text-[11px] text-[#1E2A3B]"
                      >
                        <option value="">Escolha uma opção</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`pf-${field.id}`}
                        type={
                          field.kind === "email" ? "email" : field.kind === "telefone" ? "tel" : "text"
                        }
                        value={prechat[slot] ?? ""}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setPrechat((current) => ({ ...current, [slot]: event.target.value }))
                        }
                        className="w-full rounded border border-[#D6DBE3] px-2 py-1.5 text-[11px] text-[#1E2A3B]"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {config.privacy.consentRequired ? (
              <label className="mt-2.5 flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[#6B7A90]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-px"
                  style={{ accentColor: brand }}
                />
                <span>
                  {config.privacy.consentText}
                  {config.privacy.privacyUrl ? (
                    <>
                      {" "}
                      <a
                        href={config.privacy.privacyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Política de privacidade
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
            ) : null}

            <button
              type="button"
              disabled={requiredMissing || consentMissing}
              onClick={() => void beginSession()}
              className="mt-2.5 w-full py-2 text-[11px] font-semibold disabled:opacity-50"
              style={{ backgroundColor: brand, color: ink, borderRadius: radius.bubble }}
            >
              Começar conversa
            </button>
          </div>
        ) : null}

        {/* Respostas rápidas do fluxo */}
        {session?.options.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {session.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void send(option.label, option.id)}
                className="border px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: brand, color: darken(brand, 0.1), borderRadius: radius.bubble }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Compositor */}
      <form
        className="flex items-center gap-1.5 border-t border-[#E9EDF2] bg-white px-2.5 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={config.messages.placeholder}
          disabled={needsForm}
          aria-label="Mensagem"
          className="min-w-0 flex-1 text-[11.5px] text-[#1E2A3B] outline-none disabled:bg-white"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending || needsForm}
          aria-label="Enviar"
          className="flex size-7 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          style={{ backgroundColor: brand, color: ink }}
        >
          <Send className="size-3.5" />
        </button>
      </form>

        {config.appearance.showBranding ? (
          <p className="bg-white pb-2 text-center text-[9px] text-[#A6B0BF]">
            Atendimento por <span className="font-semibold">CRM CF</span>
          </p>
        ) : null}
      </div>
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
    <div className={`flex ${visitor ? "justify-end" : "justify-start"}`}>
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

