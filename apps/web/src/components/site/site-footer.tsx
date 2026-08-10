import Link from "next/link";

import { LogoWordmark } from "@/components/shell/logo";

/**
 * Rodapé do site.
 *
 * O bloco de status no fim não é decoração: o produto está em construção, e a
 * página inteira acaba de prometer bastante. Dizer o que já funciona e o que
 * ainda não, no lugar onde a pessoa termina de ler, é mais barato que descobrir
 * na primeira reunião — e é a mesma disciplina do painel de política de acesso,
 * que declara o que ainda não vale antes dos campos.
 */

const COLUMNS = [
  {
    title: "Produto",
    links: [
      { href: "/#produto", label: "Inbox omnichannel" },
      { href: "/#produto", label: "CRM 360º e funis" },
      { href: "/#produto", label: "Chatbot e jornadas" },
      { href: "/#produto", label: "Campanhas e e-mail" },
      { href: "/#ia", label: "Agentes de IA" },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/precos", label: "Planos e preços" },
      { href: "/precos#faq", label: "Dúvidas de preço" },
      { href: "/orcamento", label: "Solicitar proposta" },
      { href: "/cadastrar", label: "Criar conta" },
    ],
  },
  {
    title: "Confiança",
    links: [
      { href: "/#seguranca", label: "Segurança e LGPD" },
      { href: "/#produto", label: "Como é a implantação" },
      { href: "/precos#faq", label: "Perguntas frequentes" },
      { href: "/entrar", label: "Área do cliente" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface-sunken border-t">
      <div className="mx-auto w-full max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <LogoWordmark height={26} />
            <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
              Atendimento, CRM 360º, automação e inteligência artificial numa plataforma só —
              construída para operação brasileira, com WhatsApp de verdade e LGPD desde o tipo.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-12 border-t pt-6">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong className="text-foreground font-semibold">Estado da plataforma.</strong> As
            telas são reais e navegáveis, e as bases de demonstração são abertas pela equipe
            comercial durante a apresentação. A camada de escrita persistente, a autenticação
            corporativa e a conexão com os canais estão em construção — contas criadas aqui vivem na
            memória do servidor e são apagadas no reinício. Preferimos dizer isso na primeira página
            a explicar na primeira reunião.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">
            © 2026 Elora · Contabilidade Facilitada · Dados de demonstração são fictícios.
          </p>
        </div>
      </div>
    </footer>
  );
}
