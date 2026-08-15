import { CONTENT_ICONS, type ContentIcon } from "@elora/core";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Calculator,
  CalendarClock,
  Check,
  Clock,
  Fingerprint,
  GitBranch,
  Globe,
  Inbox,
  Layers,
  LifeBuoy,
  Lock,
  Mail,
  MessagesSquare,
  PlugZap,
  Receipt,
  Rocket,
  Route,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Nome de ícone → componente.
 *
 * ## Por que o mapa vive aqui e a lista vive no `core`
 *
 * `packages/core` não conhece React nem `lucide-react` — é dado e regra pura, e
 * importar uma biblioteca de ícones ali arrastaria a árvore inteira para dentro
 * do pacote que o servidor carrega para calcular preço. Então o `core` declara
 * os **nomes** e a aplicação resolve os **componentes**.
 *
 * ## O tipo é o que impede o quadrado vazio
 *
 * `Record<ContentIcon, LucideIcon>` obriga este objeto a cobrir a lista inteira:
 * acrescentar um nome em `CONTENT_ICONS` sem o par aqui **não compila**. Sem
 * essa amarra, o esquecimento apareceria como espaço em branco no meio de um
 * cartão da landing page, em produção, sem erro no console.
 */
export const CONTENT_ICON_COMPONENTS: Record<ContentIcon, LucideIcon> = {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  Calculator,
  CalendarClock,
  Check,
  Clock,
  Fingerprint,
  GitBranch,
  Globe,
  Inbox,
  Layers,
  LifeBuoy,
  Lock,
  Mail,
  MessagesSquare,
  PlugZap,
  Receipt,
  Route,
  Rocket,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Users,
  Workflow,
  Zap,
};

/**
 * Resolve o ícone, com queda para um genérico.
 *
 * O tipo já garante a cobertura, mas o dado vem de um arquivo JSON editável à
 * mão — e um nome inválido que escapou da normalização não deveria derrubar a
 * seção. `Sparkles` é a queda porque não significa nada em particular: um ícone
 * genérico num cartão é discreto, e o cartão continua legível pelo título.
 */
export function contentIcon(name: string): LucideIcon {
  return (CONTENT_ICON_COMPONENTS as Record<string, LucideIcon>)[name] ?? Sparkles;
}

/** A lista para o seletor do editor, em ordem alfabética. */
export const CONTENT_ICON_NAMES: readonly ContentIcon[] = CONTENT_ICONS;
