import {
  BellRing,
  Boxes,
  CheckSquare,
  Clock,
  Flag,
  GitBranch,
  Globe,
  HelpCircle,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  MoveRight,
  Play,
  Sparkles,
  Tag as TagIcon,
  Target,
  UserCheck,
  UserCog,
  Variable,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NodeMeta {
  icon: LucideIcon;
  /** Matiz HSL do bloco. A cor comunica a família, não a marca. */
  hue: number;
  group: "entrada" | "mensagem" | "logica" | "dados" | "integracao" | "ia" | "saida";
  description: string;
}

export const GROUP_LABEL: Record<NodeMeta["group"], string> = {
  entrada: "Entrada",
  mensagem: "Mensagem",
  logica: "Lógica",
  dados: "Dados e CRM",
  integracao: "Integração",
  ia: "Inteligência artificial",
  saida: "Saída",
};

export const BOT_NODE_META: Record<string, NodeMeta> = {
  inicio: {
    icon: Play,
    hue: 145,
    group: "entrada",
    description: "Mensagem recebida, palavra-chave, evento, campanha, API ou horário.",
  },
  mensagem: {
    icon: MessageSquare,
    hue: 145,
    group: "mensagem",
    description: "Texto, mídia, botões, lista ou template, por canal.",
  },
  pergunta: {
    icon: HelpCircle,
    hue: 208,
    group: "mensagem",
    description: "Captura texto, e-mail, telefone, número, data, seleção ou arquivo.",
  },
  condicao: {
    icon: GitBranch,
    hue: 30,
    group: "logica",
    description: "Compara campos, tags, etapa do CRM, horário, consentimento ou score.",
  },
  variavel: {
    icon: Variable,
    hue: 250,
    group: "logica",
    description: "Cria, atualiza, normaliza ou limpa variáveis da sessão.",
  },
  crm: {
    icon: UserCog,
    hue: 218,
    group: "dados",
    description: "Cria ou edita contato, lead, negócio, tarefa, nota, tag ou etapa.",
  },
  http: {
    icon: Globe,
    hue: 190,
    group: "integracao",
    description: "GET/POST com autenticação, timeout, mapeamento e tratamento de erro.",
  },
  ia: {
    icon: Sparkles,
    hue: 280,
    group: "ia",
    description: "Classifica intenção, extrai dados, resume ou responde pela base de conhecimento.",
  },
  transferir: {
    icon: UserCheck,
    hue: 330,
    group: "saida",
    description: "Envia para uma fila humana com contexto, resumo, tags e SLA.",
  },
  aguardar: {
    icon: Clock,
    hue: 38,
    group: "logica",
    description: "Aguarda tempo, data, evento, resposta do usuário ou expiração.",
  },
  subfluxo: {
    icon: Boxes,
    hue: 250,
    group: "logica",
    description: "Chama um fluxo reutilizável com parâmetros e recebe retorno.",
  },
  finalizar: {
    icon: Flag,
    hue: 218,
    group: "saida",
    description: "Encerra a sessão, resolve a conversa e registra o resultado.",
  },
};

export const JOURNEY_NODE_META: Record<string, NodeMeta> = {
  gatilho: {
    icon: Zap,
    hue: 145,
    group: "entrada",
    description:
      "Contato criado, tag adicionada, compra aprovada, etapa alterada, data ou webhook.",
  },
  condicao: {
    icon: GitBranch,
    hue: 30,
    group: "logica",
    description: "Campos, tags, consentimento, canal disponível, atividade, score ou histórico.",
  },
  espera: {
    icon: Clock,
    hue: 38,
    group: "logica",
    description: "Grava next_run_at e devolve a execução à fila no momento correto.",
  },
  enviar_whatsapp: {
    icon: MessageCircle,
    hue: 145,
    group: "mensagem",
    description: "Template aprovado, respeitando janela, quiet hours e limite de frequência.",
  },
  enviar_email: {
    icon: Mail,
    hue: 208,
    group: "mensagem",
    description: "Template do E-mail Studio com merge tags e descadastro em um clique.",
  },
  atualizar_crm: {
    icon: UserCog,
    hue: 218,
    group: "dados",
    description: "Atualiza campos, proprietário, etapa ou estágio do ciclo de vida.",
  },
  criar_tarefa: {
    icon: CheckSquare,
    hue: 208,
    group: "dados",
    description: "Cria tarefa com prazo e responsável definidos por regra.",
  },
  webhook: {
    icon: Webhook,
    hue: 190,
    group: "integracao",
    description: "Chama sistema externo com retry exponencial e dead-letter queue.",
  },
  adicionar_tag: {
    icon: TagIcon,
    hue: 280,
    group: "dados",
    description: "Marca o contato para segmentação e relatórios.",
  },
  mover_etapa: {
    icon: MoveRight,
    hue: 30,
    group: "dados",
    description: "Move o negócio para outra etapa do funil.",
  },
  notificar_equipe: {
    icon: BellRing,
    hue: 330,
    group: "saida",
    description: "Avisa um time interno por canal configurado.",
  },
  meta: {
    icon: Target,
    hue: 160,
    group: "saida",
    description: "Objetivo da jornada. Atingir a meta encerra o participante com sucesso.",
  },
  saida: {
    icon: LogOut,
    hue: 218,
    group: "saida",
    description: "Encerra a participação e registra o motivo da saída.",
  },
};
