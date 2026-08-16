import {
  Calculator,
  Compass,
  Layers,
  type LucideIcon,
  MessagesSquare,
  Receipt,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

/**
 * Ícone de um destino da navegação, derivado do endereço.
 *
 * ## Por que derivar, e não guardar
 *
 * A barra inferior do celular precisa de ícone — rótulo sozinho num alvo de
 * 64 px vira texto minúsculo, e é a diferença entre "tab bar" e "lista de links
 * espremida". O modelo de conteúdo, porém, não tem esse campo: `ContentLink`
 * guarda rótulo e endereço, e o normalizador é o **mesmo** do rodapé, onde
 * ícone não faz sentido nenhum.
 *
 * Acrescentar `icon` ao tipo custaria um normalizador separado para o cabeçalho,
 * um campo novo no editor e uma decisão para quem escreve texto de marketing —
 * tudo para um enfeite que a própria aplicação sabe deduzir. O endereço já
 * carrega a informação: `/precos` é preço, `/#seguranca` é segurança.
 *
 * ## O que acontece quando alguém troca o endereço no editor
 *
 * Cai na bússola. É o ponto todo de existir uma queda nomeada: um destino novo
 * — digamos `/casos` — aparece na barra com ícone genérico e rótulo correto, que
 * é feio e funciona. A alternativa, quadrado vazio, é a que faz a barra parecer
 * quebrada.
 *
 * A comparação ignora a barra final e o prefixo `/`, porque `#ia`, `/#ia` e
 * `/#ia/` são o mesmo lugar e a distinção só existe para quem digitou.
 */
const BY_HREF: Record<string, LucideIcon> = {
  "": Rocket,
  "#produto": Layers,
  "#ia": Sparkles,
  "#seguranca": ShieldCheck,
  "#planos": Receipt,
  precos: Receipt,
  orcamento: MessagesSquare,
  entrar: Users,
  cadastrar: Users,
  conta: Users,
  admin: Calculator,
};

function chave(href: string): string {
  return href.trim().replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

export function navIcon(href: string): LucideIcon {
  return BY_HREF[chave(href)] ?? Compass;
}
