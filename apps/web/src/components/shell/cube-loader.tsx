import { cn } from "@crm/ui";

/**
 * Carregador de rota.
 *
 * ## Onde ele entra, e onde não entra
 *
 * Este é o carregador de **navegação** — a espera entre clicar num item do menu
 * e a página renderizar no servidor. Não substitui `Skeleton` nem
 * `SkeletonList`: superfície de dados continua carregando com esqueleto, porque
 * ali o esqueleto informa a **forma** do que vem, e um cubo girando no meio de
 * uma tabela informa apenas que algo trava.
 *
 * A distinção importa porque a regra dos quatro estados — vazio, carregando,
 * erro, sucesso — vale por superfície. Trocar todos os esqueletos por isto
 * pioraria cada um deles.
 *
 * ## Sobre o movimento
 *
 * As animações vivem em `tokens.css`, e não num `<style jsx>`, para ficarem sob
 * o `prefers-reduced-motion` global. Quem desligou animação no sistema vê o
 * cubo parado e montado — e é por isso que o texto abaixo dele não é enfeite:
 * **é o único indicador de que algo está acontecendo** para essa pessoa. Um
 * carregador que só comunica por movimento não comunica para quem pediu para o
 * movimento parar.
 */
export function CubeLoader({
  label = "Carregando",
  hint = "Preparando a sua área de trabalho.",
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "cube-scene flex min-h-[24rem] flex-col items-center justify-center gap-12 p-12",
        className,
      )}
      /**
       * `status` e não `alert`: é informação em andamento, não interrupção. O
       * leitor de tela anuncia quando a região aparece e não rouba o foco.
       */
      role="status"
      aria-live="polite"
    >
      <div className="cube-3d relative flex size-24 items-center justify-center">
        <div className="cube-3d cube-spin relative size-full">
          {/* Núcleo: a fonte de luz que o cubo revela ao expandir. */}
          <div
            className="bg-accent cube-core absolute inset-0 m-auto size-8 rounded-full blur-md"
            aria-hidden
          />

          <div className="cube-side cube-front" aria-hidden>
            <div className="cube-face" />
          </div>
          <div className="cube-side cube-back" aria-hidden>
            <div className="cube-face" />
          </div>
          <div className="cube-side cube-right cube-side-x" aria-hidden>
            <div className="cube-face" />
          </div>
          <div className="cube-side cube-left cube-side-x" aria-hidden>
            <div className="cube-face" />
          </div>
          <div className="cube-side cube-top cube-side-y" aria-hidden>
            <div className="cube-face" />
          </div>
          <div className="cube-side cube-bottom cube-side-y" aria-hidden>
            <div className="cube-face" />
          </div>
        </div>

        {/* Sombra no chão: acompanha a respiração e dá o apoio da peça. */}
        <div
          className="cube-shadow absolute -bottom-16 h-6 w-24 rounded-[100%] bg-black/40 blur-xl"
          aria-hidden
        />
      </div>

      <div className="mt-4 flex flex-col items-center gap-1 text-center">
        <p className="text-accent-ink text-xs font-semibold uppercase tracking-[0.3em]">{label}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    </div>
  );
}
