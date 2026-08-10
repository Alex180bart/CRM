import { cn } from "@elora/ui";

/**
 * Marca da Elora.
 *
 * ## Por que não há mais imagem
 *
 * O logotipo anterior era um PNG (`/nexa-crm.png`) de uma marca que nem chegou a
 * ser a deste produto, e trazia dois defeitos que nenhum CSS resolve: o texto era
 * branco — some em qualquer superfície clara — e a única forma de ter símbolo
 * nítido em 20 px era redesenhar a arte à mão, o que já havia sido feito e
 * anotado como "derivação, não arte aprovada".
 *
 * O símbolo agora é **SVG desenhado aqui**, e a diferença prática é grande: ele
 * herda cor de token, funciona nos dois temas sem segundo arquivo, escala de 16
 * a 200 px sem borrar e acompanha a troca de paleta da organização de graça.
 *
 * ## O desenho
 *
 * Um anel que **não se fecha**, e a abertura é preenchida pelas três hastes do E.
 * Diz "elo" e "Elora" na mesma forma. O arco cobre 260°; a falta dos 100° à
 * direita é exatamente onde as hastes saem — por isso as coordenadas do vão e as
 * alturas das hastes são solidárias, e mexer numa sem a outra fecha o E dentro do
 * anel ou deixa haste atravessando o traço.
 *
 * A haste do meio sai do acento, as outras duas de `currentColor`. É a regra do
 * "um acento por tela" aplicada à própria marca: a cor marca uma coisa só.
 */

/**
 * O arco e as três hastes.
 *
 * As hastes começam em `x` diferentes — 6,4 / 4,7 / 6,4 — porque a espinha do E
 * **é o anel**, e o anel é curvo. Alinhar as três no mesmo `x` produziria uma
 * espinha reta encostada numa curva, com folga visível no meio. Os valores são a
 * borda interna do traço em cada altura, calculados, não estimados.
 */
export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* Anel aberto: 260° de arco, vão de 100° à direita. */}
      <path d="M17.79 5.11A9 9 0 1 0 17.79 18.89" />
      {/* Hastes superior e inferior atravessam o vão. */}
      <path d="M6.4 6.6H18.2" />
      <path d="M6.4 17.4H18.2" />
      {/* A do meio é mais curta, como em qualquer E — e leva o acento. */}
      <path d="M4.7 12H14.4" stroke="hsl(var(--accent))" />
    </svg>
  );
}

/**
 * Símbolo mais o nome.
 *
 * O nome é **texto**, não traçado: usa a face de exibição (Sora) que a aplicação
 * já carrega e por isso não custa requisição nenhuma, herda a cor do contexto e
 * permanece selecionável e legível por leitor de tela. Um wordmark vetorizado
 * exigiria um segundo arquivo por tema pelo mesmo motivo que derrubou o PNG.
 */
export function LogoWordmark({
  height = 24,
  className,
}: {
  height?: number;
  className?: string;
  /**
   * Aceito e ignorado: o wordmark não é mais imagem, então não há o que
   * priorizar no carregamento. Mantido para não quebrar quem já passava.
   */
  priority?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex select-none items-center gap-2", className)}
      style={{ height }}
    >
      <LogoMark size={Math.round(height * 0.92)} />
      <span
        className="font-display font-semibold leading-none"
        style={{ fontSize: height * 0.78, letterSpacing: "-0.02em" }}
      >
        Elora
      </span>
    </span>
  );
}

/**
 * Bloco de marca da barra lateral.
 *
 * Recolhido mostra só o símbolo; expandido, o nome com o da organização embaixo —
 * que continua sendo o dado que diferencia uma instalação da outra numa
 * plataforma multiempresa.
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
        className="bg-sidebar-accent shadow-raised lift flex size-9 shrink-0 items-center justify-center rounded-xl"
        title="Elora"
      >
        <LogoMark size={20} />
      </span>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <LogoWordmark height={22} />
      <p className="text-sidebar-muted mt-1 truncate text-[11px] leading-tight">
        {organizationName}
      </p>
    </div>
  );
}
