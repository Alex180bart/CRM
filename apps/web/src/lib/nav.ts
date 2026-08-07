import {
  BarChart3,
  Bot,
  Building2,
  Home,
  KanbanSquare,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareCode,
  Sparkles,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Módulos ainda não construídos aparecem, mas desabilitados: o roadmap fica visível. */
  phase?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Navegação do produto, agrupada pelo que a pessoa vai fazer — não pelo módulo
 * técnico. O que ainda não existe continua visível com a fase do roadmap
 * (seção 28 do plano), para que a lacuna seja informação e não surpresa.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Hoje",
    items: [{ href: "/inicio", label: "Início", icon: Home }],
  },
  {
    title: "Operação",
    items: [
      { href: "/inbox", label: "Inbox", icon: MessageSquare },
      { href: "/contatos", label: "Contatos", icon: Users },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
    ],
  },
  {
    title: "Automação",
    items: [
      { href: "/campanhas", label: "Campanhas", icon: Megaphone },
      { href: "/automacoes", label: "Automações", icon: Zap },
      { href: "/chatbots", label: "Chatbots", icon: Bot },
      { href: "/agentes", label: "Agentes de IA", icon: Sparkles },
      { href: "/jornadas", label: "Jornadas", icon: Workflow },
      { href: "/email-studio", label: "E-mail Studio", icon: Mail },
      { href: "/webchat", label: "Webchat", icon: MessageSquareCode },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/administracao", label: "Administração", icon: Building2 },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
