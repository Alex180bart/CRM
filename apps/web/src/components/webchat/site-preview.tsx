"use client";

import { useState } from "react";
import type { WebchatWidgetVersion } from "@crm/core";
import { readableInk } from "@crm/core";
import { Button, Callout, Input, Tooltip, cn } from "@crm/ui";
import { Globe, Info, Loader2, Monitor, Smartphone, X } from "lucide-react";

import type { SitePreviewResult } from "@/app/api/webchat/site-preview/route";
import { WidgetPreview, type PreviewDevice, type PreviewStage } from "./widget-preview";

/**
 * Prévia sobre o site de verdade.
 *
 * Cola-se o endereço e, quando o site permite ser embutido, o widget aparece
 * **em cima da página real** — que é a única forma de responder as perguntas que
 * importam: o lançador briga com o botão de compra? cobre o aceite de cookies?
 * some no rodapé escuro?
 *
 * Boa parte dos sites recusa ser embutida, e essa recusa é invisível no cliente:
 * o quadro fica branco sem disparar erro. Por isso a checagem acontece no
 * servidor **antes** de montar o quadro — melhor explicar o motivo que exibir um
 * retângulo vazio e deixar a pessoa achar que o editor quebrou.
 */
export function SitePreview({
  version,
  stage,
  device,
  onDeviceChange,
  onStageChange,
}: {
  version: WebchatWidgetVersion;
  stage: PreviewStage;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  onStageChange: (stage: PreviewStage) => void;
}) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [site, setSite] = useState<SitePreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setChecking(true);
    setError(null);
    setSite(null);

    try {
      const response = await fetch("/api/webchat/site-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const payload = (await response.json()) as SitePreviewResult | { error: { message: string } };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Não foi possível verificar o site.");
        return;
      }
      setSite(payload);
    } catch {
      setError("A verificação do site falhou. Confira a conexão.");
    } finally {
      setChecking(false);
    }
  }

  const left = version.appearance.position === "esquerda";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="bg-muted flex items-center rounded-md p-0.5">
          {(
            [
              { id: "desktop", label: "Desktop", icon: Monitor },
              { id: "celular", label: "Celular", icon: Smartphone },
            ] as const
          ).map((option) => {
            const Icon = option.icon;
            return (
              <Tooltip key={option.id} content={`Ver em ${option.label.toLowerCase()}`}>
                <button
                  type="button"
                  onClick={() => onDeviceChange(option.id)}
                  aria-pressed={device === option.id}
                  aria-label={`Ver em ${option.label.toLowerCase()}`}
                  className={cn(
                    "flex size-7 items-center justify-center rounded transition-colors",
                    device === option.id
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </button>
              </Tooltip>
            );
          })}
        </div>
        <p className="text-muted-foreground text-[10px]">
          {device === "celular" ? "Aberto ocupa a tela toda" : "Janela flutuante"}
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void check();
        }}
      >
        <Input
          value={url}
          placeholder="cole o endereço do seu site"
          aria-label="Endereço do site para a prévia"
          className="text-xs"
          onChange={(event) => setUrl(event.target.value)}
        />
        {site ? (
          <Tooltip content="Voltar ao site genérico">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Limpar site"
              onClick={() => {
                setSite(null);
                setUrl("");
                setError(null);
              }}
            >
              <X />
            </Button>
          </Tooltip>
        ) : (
          <Button type="submit" variant="outline" size="sm" disabled={checking || !url.trim()}>
            {checking ? <Loader2 className="animate-spin" /> : <Globe />}
            Ver no site
          </Button>
        )}
      </form>

      {error ? (
        <Callout variant="danger" className="text-[11px]">
          {error}
        </Callout>
      ) : null}

      {site && !site.framable ? (
        <Callout variant="warning" icon={<Info />} className="text-[11px]">
          <span className="block font-medium">Este site não permite ser exibido dentro de um quadro.</span>
          {site.reason} Isso não afeta o widget — ele funciona normalmente lá. A prévia abaixo segue
          no site genérico.
        </Callout>
      ) : null}

      {site?.framable ? (
        <>
          <div
            className={cn(
              "relative overflow-hidden bg-white",
              device === "celular"
                ? "mx-auto w-[19.5rem] rounded-[1.75rem] ring-8 ring-slate-900"
                : "rounded-lg",
            )}
            style={{ height: 470 }}
          >
            {/* O site real. `sandbox` sem `allow-top-navigation` impede que ele
                arraste o editor para outro endereço; sem `allow-forms` ninguém
                envia formulário de terceiro sem querer. */}
            <iframe
              src={site.finalUrl}
              title={`Prévia em ${site.finalUrl}`}
              className="size-full border-0"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
            />

            {/* O widget por cima, na posição configurada. Sem interação: aqui o
                objetivo é ver o encaixe, e a prévia interativa é a de baixo.
                A barra é a exceção: ela atravessa a base, então ignora a
                posição lateral. */}
            <div
              className={cn(
                "pointer-events-none absolute",
                version.appearance.launcher === "barra"
                  ? "inset-x-0 bottom-0"
                  : left
                    ? "bottom-3 left-3"
                    : "bottom-3 right-3",
              )}
            >
              <FloatingLauncher version={version} />
            </div>
          </div>

          <p className="text-muted-foreground text-[10px] leading-relaxed">
            Site real carregado de {new URL(site.finalUrl).hostname}. O lançador acima é o seu, na
            posição e cor configuradas.
          </p>
        </>
      ) : (
        <WidgetPreview
          version={version}
          stage={stage}
          device={device}
          onStageChange={onStageChange}
        />
      )}
    </div>
  );
}

/** Só o lançador, para sobrepor ao site real sem capturar clique. */
function FloatingLauncher({ version }: { version: WebchatWidgetVersion }) {
  const { appearance } = version;
  const brand = appearance.brandColor;
  // Mesma escolha de tinta do widget: quem decide é a razão de contraste.
  const ink = readableInk(brand).hex;

  const radius =
    appearance.corner === "arredondado" ? 999 : appearance.corner === "suave" ? 12 : 4;

  // A barra ocupa a largura da página e não leva ícone: é uma faixa de chamada,
  // não um botão flutuante. Desenhá-la como bolha esconderia justamente o que
  // se está avaliando — quanto do site ela cobre.
  if (appearance.launcher === "barra") {
    return (
      <span
        className="flex w-full items-center justify-center py-3 text-xs font-semibold shadow-[0_-4px_16px_rgba(16,40,80,0.22)]"
        style={{ backgroundColor: brand, color: ink }}
      >
        {appearance.launcherLabel || "Falar com a gente"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center gap-2 shadow-[0_6px_20px_rgba(16,40,80,0.3)]",
        appearance.launcher === "bolha_rotulo" ? "px-4 py-3" : "size-14 justify-center",
      )}
      style={{ backgroundColor: brand, color: ink, borderRadius: radius }}
    >
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" aria-hidden>
        <path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.7A.75.75 0 0 1 4 19.1V5.5Z"
          fill="currentColor"
        />
      </svg>
      {appearance.launcher === "bolha_rotulo" ? (
        <span className="whitespace-nowrap text-xs font-semibold">
          {appearance.launcherLabel || "Falar com a gente"}
        </span>
      ) : null}
    </span>
  );
}
