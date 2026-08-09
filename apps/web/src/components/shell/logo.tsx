import Image from "next/image";

import { cn } from "@elora/ui";

/**
 * Marca do produto.
 *
 * Duas formas, e a existência das duas não é preferência: a barra lateral
 * recolhida tem 4,25 rem de largura, e um logotipo com texto ali vira um borrão
 * de 3 px de altura. Reduzir o mesmo arquivo até caber não é uma alternativa —
 * é a mesma decisão tomada mal.
 *
 * ## A restrição que veio junto com o arquivo
 *
 * O "nexa" do logotipo é **branco**. Ele funciona sobre o azul da barra lateral
 * e desaparece em qualquer superfície clara. Isso não se resolve com CSS: um
 * filtro que escurecesse o "nexa" escureceria o "CRM" laranja junto.
 *
 * Por isso `completo` declara que exige fundo escuro, e o padrão de uso é a
 * barra lateral. Para tela de login clara, e-mail ou documento, é preciso a
 * versão do logotipo com o "nexa" em tinta escura — que ainda não temos.
 */

/** Proporção do arquivo original: 2693 × 391. */
const RATIO = 2693 / 391;

export function LogoWordmark({
  height = 24,
  className,
  priority,
}: {
  height?: number;
  className?: string;
  /** Verdadeiro na barra lateral: é marca acima da dobra, e piscar aparece. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/nexa-crm.png"
      alt="Nexa CRM"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto select-none", className)}
      style={{ height, width: "auto" }}
    />
  );
}

/**
 * A seta, para quando só cabe um símbolo.
 *
 * É o elemento distintivo do logotipo — a diagonal que atravessa o "x" —
 * redesenhada em SVG para escalar sem borrar e para poder herdar cor.
 *
 * **É derivação minha, não arte aprovada.** Recortar o PNG daria uma seta
 * pixelada com fundo transparente irregular; desenhá-la é a única forma de ter
 * um símbolo nítido em 20 px. Vale a conferência de quem fez o logotipo antes
 * de virar definitivo.
 */
export function LogoMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/**
       * O gradiente reproduz o do arquivo: mais fechado embaixo à esquerda,
       * mais aberto na ponta. Sem ele a seta fica chapada e destoa do logotipo
       * completo quando os dois aparecem na mesma sessão.
       */}
      <defs>
        <linearGradient id="nexa-seta" x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D97A18" />
          <stop offset="1" stopColor="#FFA94D" />
        </linearGradient>
      </defs>

      {/* Haste, na diagonal do canto inferior esquerdo para o superior direito. */}
      <path d="M4.8 19.2 14.6 9.4l1.7 1.7L6.5 20.9z" fill="url(#nexa-seta)" />
      {/* Ponta triangular, alinhada ao mesmo eixo de 45°. */}
      <path d="M20.5 3.5 12.9 6.1l5 5z" fill="url(#nexa-seta)" />
    </svg>
  );
}

/**
 * Bloco de marca da barra lateral.
 *
 * Recolhido mostra só o símbolo; expandido, o logotipo com o nome da
 * organização embaixo — que continua sendo o dado que diferencia uma instalação
 * da outra numa plataforma multiempresa.
 */
export function SidebarBrand({
  organizationName,
  collapsed,
}: {
  organizationName: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <span
        className="bg-accent/15 shadow-raised flex size-9 shrink-0 items-center justify-center rounded-xl"
        title="Nexa CRM"
      >
        <LogoMark size={20} />
      </span>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <LogoWordmark height={22} priority />
      <p className="text-sidebar-muted mt-1 truncate text-[11px] leading-tight">
        {organizationName}
      </p>
    </div>
  );
}
