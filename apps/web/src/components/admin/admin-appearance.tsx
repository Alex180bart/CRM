"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppearanceMode, DensityKey, OrganizationAppearance, PaletteKey } from "@elora/core";
import {
  DENSITY_LABEL,
  DENSITY_ROOT_PX,
  MODE_LABEL,
  PALETTE_CATALOG,
  isAppearanceMode,
  isDensityKey,
} from "@elora/core";
import { Badge, Button, Callout, Eyebrow, Reveal, Switch, cn } from "@elora/ui";
import { Check, Info, Monitor, MoonStar, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";

/**
 * Aparência: a paleta da instalação e a preferência de cada pessoa.
 *
 * ## As duas metades desta tela gravam em lugares diferentes
 *
 * A metade de cima é **da organização** e passa pelo `AdminRepository` como
 * qualquer outra escrita da Administração: valida, grava e audita. A metade de
 * baixo é **da pessoa** e vive no `localStorage` do navegador — não há usuário
 * autenticado a que prendê-la, e inventar um registro por pessoa numa base sem
 * sessão produziria preferência do "usuário de demonstração" aplicada a todo
 * mundo que abrisse a instalação.
 *
 * É a divisão honesta hoje, e é a que menos muda quando a autenticação entrar: a
 * metade de cima já está no lugar definitivo; a de baixo troca `localStorage`
 * por uma coluna em `users`, sem mexer em mais nada desta tela.
 *
 * ## Por que a preferência aplica na hora e a paleta não
 *
 * Modo e densidade mexem em `<html>` no mesmo quadro do clique — é a única forma
 * de a pessoa avaliar a escolha, que é visual. A paleta exige ida ao servidor
 * porque vale para todos, e o retorno vem pelo `router.refresh()`; o atributo
 * `data-palette` é reescrito no HTML seguinte. Aplicá-la localmente antes da
 * confirmação mostraria a cor certa numa gravação que pode ter sido recusada.
 */

const THEME_KEY = "elora-theme";
const DENSITY_KEY = "elora-density";

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

type Submit = (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;

const MODES: AppearanceMode[] = ["claro", "escuro", "sistema"];
const DENSITIES: DensityKey[] = ["compacto", "padrao", "amplo"];

const MODE_ICON = {
  claro: Sun,
  escuro: MoonStar,
  sistema: Monitor,
} as const;

/* Preferência da pessoa ------------------------------------------------------ */

/**
 * Lê o que está gravado e devolve também **se** está gravado.
 *
 * A distinção importa na tela: "esta pessoa escolheu escuro" e "esta pessoa não
 * escolheu nada e a organização usa escuro" mostram a mesma cor e pedem botões
 * diferentes — só o primeiro caso tem o que reverter.
 */
function readStored(): { mode: AppearanceMode | null; density: DensityKey | null } {
  try {
    const mode = localStorage.getItem(THEME_KEY);
    const density = localStorage.getItem(DENSITY_KEY);
    return {
      mode: isAppearanceMode(mode) ? mode : null,
      density: isDensityKey(density) ? density : null,
    };
  } catch {
    return { mode: null, density: null };
  }
}

function applyMode(mode: AppearanceMode): void {
  const dark =
    mode === "escuro" ||
    (mode === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function applyDensity(density: DensityKey): void {
  document.documentElement.setAttribute("data-density", density);
}

/* Tela ----------------------------------------------------------------------- */

export function AppearanceTab({
  appearance,
  onSubmit,
  busy,
}: {
  appearance: OrganizationAppearance;
  onSubmit: Submit;
  busy: boolean;
}) {
  const [stored, setStored] = useState<{
    mode: AppearanceMode | null;
    density: DensityKey | null;
  }>({ mode: null, density: null });

  /**
   * A leitura acontece depois de montar, e não durante a renderização, porque
   * `localStorage` não existe no servidor: ler ali produziria marcação diferente
   * da do cliente e a hidratação quebraria. É a mesma razão pela qual o botão de
   * tema na barra lateral só desenha o ícone depois de montado.
   */
  useEffect(() => {
    setStored(readStored());
  }, []);

  const effectiveMode = stored.mode ?? appearance.defaultMode;
  const effectiveDensity = stored.density ?? appearance.defaultDensity;
  const personal = appearance.allowPersonalOverride;

  const chooseMode = useCallback((mode: AppearanceMode) => {
    applyMode(mode);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* Sem localStorage a escolha vale para esta aba e não persiste. */
    }
    setStored((current) => ({ ...current, mode }));
  }, []);

  const chooseDensity = useCallback((density: DensityKey) => {
    applyDensity(density);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* idem */
    }
    setStored((current) => ({ ...current, density }));
  }, []);

  const resetPersonal = useCallback(() => {
    try {
      localStorage.removeItem(THEME_KEY);
      localStorage.removeItem(DENSITY_KEY);
    } catch {
      /* idem */
    }
    applyMode(appearance.defaultMode);
    applyDensity(appearance.defaultDensity);
    setStored({ mode: null, density: null });
    toast.success("Preferência devolvida ao padrão da organização.");
  }, [appearance.defaultMode, appearance.defaultDensity]);

  async function saveOrg(patch: Partial<OrganizationAppearance>, label: string) {
    const result = await onSubmit({ entity: "aparencia", action: "editar", data: patch });
    if (result.ok) {
      toast.success(label);
    } else {
      toast.error(result.reason ?? "Não foi possível gravar.");
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- Paleta */}
      <Reveal index={0}>
        <section className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Organização</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">Paleta</h3>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                Vale para todo mundo desta organização e repinta a plataforma inteira. Só os tokens
                de marca mudam: sucesso, alerta e erro continuam significando a mesma coisa, e as
                seis séries de gráfico permanecem como estão porque foram validadas para daltonismo.
              </p>
            </div>
            <Badge variant="neutral">{PALETTE_CATALOG.length} paletas</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PALETTE_CATALOG.map((palette) => {
              const active = palette.key === appearance.palette;
              return (
                <button
                  key={palette.key}
                  type="button"
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => {
                    if (active) return;
                    void saveOrg(
                      { palette: palette.key as PaletteKey },
                      `Paleta ${palette.label}.`,
                    );
                  }}
                  className={cn(
                    "sheen lift-3d group relative overflow-hidden rounded-xl p-4 text-left transition-colors",
                    "bg-surface shadow-card disabled:opacity-60",
                    active ? "ring-accent ring-2" : "hover:shadow-raised",
                  )}
                >
                  {/**
                   * A amostra é o único lugar da interface com hexadecimal
                   * literal, e ele vem do catálogo em `types/appearance.ts` — a
                   * tela não conhece cor nenhuma, só desenha a que recebeu. É o
                   * que permite mostrar as três paletas inativas: os tokens CSS
                   * só sabem da que está aplicada.
                   */}
                  <span className="flex gap-1.5">
                    {palette.swatch.map((color) => (
                      <span
                        key={color}
                        className="size-7 rounded-lg shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>

                  <span className="mt-3 flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{palette.label}</span>
                    {active ? <Check className="text-accent size-4" /> : null}
                  </span>

                  <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                    {palette.description}
                  </span>

                  <span className="text-muted-foreground/80 mt-2 block font-mono text-[11px]">
                    acento {palette.accentContrast.toFixed(2).replace(".", ",")}:1 sobre branco
                  </span>
                </button>
              );
            })}
          </div>

          <Callout icon={<Info className="size-4" />}>
            Nenhuma delas chega a 3:1 no acento porque não precisa: acento preenche peça, e quem
            desenha traço fino — o anel de foco — tem valor próprio em cada paleta, sempre acima do
            piso da WCAG 1.4.11. Só o violeta do Grafite passa dos 4,5:1 e também serve para texto.
          </Callout>
        </section>
      </Reveal>

      {/* --------------------------------------------------------------- Padrões */}
      <Reveal index={1}>
        <section className="panel space-y-5 p-5">
          <div>
            <Eyebrow>Organização</Eyebrow>
            <h3 className="mt-1 text-base font-semibold">Padrões de quem ainda não escolheu</h3>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              Aplicados a quem nunca mexeu na própria preferência. Não sobrescrevem quem já escolheu
              — para isso existe o bloqueio logo abaixo.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Modo</p>
              <div className="flex flex-wrap gap-2">
                {MODES.map((mode) => {
                  const Icon = MODE_ICON[mode];
                  const active = appearance.defaultMode === mode;
                  return (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "outline"}
                      disabled={busy}
                      className="press"
                      onClick={() => {
                        if (active) return;
                        void saveOrg(
                          { defaultMode: mode },
                          `Modo padrão: ${MODE_LABEL[mode].toLowerCase()}.`,
                        );
                      }}
                    >
                      <Icon className="size-4" />
                      {MODE_LABEL[mode]}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Densidade</p>
              <div className="flex flex-wrap gap-2">
                {DENSITIES.map((density) => {
                  const active = appearance.defaultDensity === density;
                  return (
                    <Button
                      key={density}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "outline"}
                      disabled={busy}
                      className="press"
                      onClick={() => {
                        if (active) return;
                        void saveOrg(
                          { defaultDensity: density },
                          `Densidade padrão: ${DENSITY_LABEL[density].toLowerCase()}.`,
                        );
                      }}
                    >
                      {DENSITY_LABEL[density]}
                      <span className="text-muted-foreground ml-1 font-mono text-[11px]">
                        {DENSITY_ROOT_PX[density]}px
                      </span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                A densidade escala a raiz tipográfica, e com ela todo espaçamento medido em{" "}
                <code className="font-mono">rem</code>. Compacto encolhe cada medida em 6,25% — numa
                lista de conversas, isso devolve uma linha inteira por tela.
              </p>
            </div>
          </div>

          <div className="border-border flex items-start justify-between gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Permitir escolha individual</p>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
                Desligado, os padrões acima deixam de ser padrão e passam a valer para todos —
                inclusive para quem já tinha escolhido antes. Faz sentido em quiosque e balcão; em
                escritório, tira da pessoa a única decisão visual que depende do monitor e da vista
                dela.
              </p>
            </div>
            <Switch
              checked={appearance.allowPersonalOverride}
              disabled={busy}
              onCheckedChange={(next) => {
                void saveOrg(
                  { allowPersonalOverride: next },
                  next ? "Escolha individual liberada." : "Escolha individual bloqueada.",
                );
              }}
              aria-label="Permitir escolha individual de tema e densidade"
            />
          </div>
        </section>
      </Reveal>

      {/* ------------------------------------------------------------- Preferência */}
      <Reveal index={2}>
        <section className="panel space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Você</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">Sua preferência neste navegador</h3>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                Vale só para você e só neste navegador. Enquanto não há autenticação, não existe
                usuário a que prender a escolha — quando a sessão entrar, ela passa a acompanhar a
                pessoa entre dispositivos, e esta tela não muda.
              </p>
            </div>
            {stored.mode || stored.density ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetPersonal}
                className="press"
              >
                <RotateCcw className="size-4" />
                Voltar ao padrão
              </Button>
            ) : (
              <Badge variant="neutral">Usando o padrão da organização</Badge>
            )}
          </div>

          {personal ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Modo</p>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((mode) => {
                    const Icon = MODE_ICON[mode];
                    return (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={effectiveMode === mode ? "primary" : "outline"}
                        className="press"
                        onClick={() => chooseMode(mode)}
                      >
                        <Icon className="size-4" />
                        {MODE_LABEL[mode]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Densidade</p>
                <div className="flex flex-wrap gap-2">
                  {DENSITIES.map((density) => (
                    <Button
                      key={density}
                      type="button"
                      size="sm"
                      variant={effectiveDensity === density ? "primary" : "outline"}
                      className="press"
                      onClick={() => chooseDensity(density)}
                    >
                      {DENSITY_LABEL[density]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Callout variant="warning" icon={<Info className="size-4" />}>
              A organização bloqueou a escolha individual. Todo mundo está em{" "}
              <strong>{MODE_LABEL[appearance.defaultMode].toLowerCase()}</strong> com densidade{" "}
              <strong>{DENSITY_LABEL[appearance.defaultDensity].toLowerCase()}</strong>, e qualquer
              preferência gravada antes deixou de ser aplicada.
            </Callout>
          )}
        </section>
      </Reveal>
    </div>
  );
}
