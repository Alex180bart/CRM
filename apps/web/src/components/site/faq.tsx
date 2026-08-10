import { ChevronDown } from "lucide-react";

/**
 * Perguntas frequentes em `<details>`.
 *
 * Sem JavaScript, sem estado, sem componente de acordeão: `<details>` já é
 * acessível por teclado, anunciado corretamente por leitor de tela e funciona
 * antes do bundle carregar. Reimplementá-lo em React acrescentaria peso a uma
 * seção que o visitante talvez nem abra.
 *
 * As respostas são deliberadamente específicas. FAQ genérica ("sim, é seguro!")
 * não responde nada e transfere a pergunta para a reunião — que é justamente o
 * que ela deveria evitar.
 */

const ITEMS: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: "Como funciona a cobrança de WhatsApp?",
    answer: (
      <>
        <p>
          Em duas linhas separadas. A Meta cobra por mensagem, por categoria — marketing, utilidade
          e autenticação têm preços diferentes, e a resposta dentro da janela de 24 horas aberta
          pelo cliente é <strong>gratuita</strong>. Isso é repasse: entra no seu orçamento pelo
          mesmo valor que a Meta cobra de nós, sem margem.
        </p>
        <p className="mt-2">
          A Elora cobra por <strong>conversa tratada</strong>, com uma franquia mensal por edição.
          As duas linhas ficam separadas no simulador e na fatura de propósito: quando a Meta
          reajusta, você consegue ver exatamente o que mudou.
        </p>
      </>
    ),
  },
  {
    question: "Colaboradores ilimitados é ilimitado mesmo?",
    answer: (
      <p>
        Na edição Corporativo, sim — o assento não é cobrado e não há teto. Nas demais, o preço é
        por pessoa, com mínimo e máximo declarados no cartão. Não anunciamos ilimitado nas edições
        de entrada porque isso costuma ser um preço por assento escondido dentro de um número
        redondo, que quebra no dia em que a empresa cadastra a operação inteira.
      </p>
    ),
  },
  {
    question: "O que acontece se eu passar da franquia?",
    answer: (
      <p>
        Nada para. O excedente é cobrado na fatura seguinte, com preço unitário declarado por edição
        — e, no caso de contatos, em faixas progressivas: cada fatia paga o preço da própria faixa,
        nunca o preço da faixa final aplicado a tudo. O simulador mostra a conta antes de você
        assinar.
      </p>
    ),
  },
  {
    question: "Preciso migrar tudo de uma vez?",
    answer: (
      <p>
        Não, e não recomendamos. A migração é por domínio — atendimento primeiro, depois funil,
        depois campanhas —, com o sistema antigo continuando dono dos dados que ainda não migraram.
        Para quem vem do Salesforce, existe um trabalho específico de matriz de propriedade de
        campos, para que os dois lados não sobrescrevam um ao outro durante a coexistência.
      </p>
    ),
  },
  {
    question: "A inteligência artificial responde sozinha aos meus clientes?",
    answer: (
      <>
        <p>
          Responde, dentro de um limite que você configura — e a fronteira é sempre a mesma:{" "}
          <strong>leitura o agente executa, escrita espera confirmação humana</strong>. Consultar um
          pedido, explicar uma política, buscar na base de conhecimento: o agente faz. Emitir
          cobrança, cancelar, agendar: ele propõe, e alguém do time clica.
        </p>
        <p className="mt-2">
          Três guardas ficam na aplicação, não no texto do prompt: piso de confiança que transfere
          para humano, fila de destino validada contra o catálogo, e teto de custo por conversa
          conferido antes de gastar.
        </p>
      </>
    ),
  },
  {
    question: "Vocês usam meus dados para treinar modelo?",
    answer: (
      <p>
        Não. O contexto enviado ao modelo é decidido num único ponto do código e leva o mínimo
        necessário — campo marcado como sensível viaja como <em>presença</em>, não como conteúdo: a
        IA sabe que o documento está vazio, nunca qual documento estaria lá. Cada execução registra
        modelo, tokens, latência, custo e versão do prompt, e esse rastro fica disponível para
        auditoria.
      </p>
    ),
  },
  {
    question: "Qual o prazo de implantação?",
    answer: (
      <p>
        De duas a seis semanas, conforme a edição e o número de canais. A implantação assistida
        cobre filas, escalas, catálogo, conexão dos canais e a primeira automação, com
        acompanhamento até o fim do primeiro mês em produção. É cobrança única e aparece separada do
        recorrente no orçamento.
      </p>
    ),
  },
  {
    question: "Consigo testar com dados parecidos com os meus?",
    answer: (
      <p>
        Sim — é para isso que existem as demonstrações por segmento. Cada uma carrega uma operação
        completa e fictícia do ramo: contatos, conversas, funis, campanhas e automações coerentes
        com o vocabulário daquele negócio. Você entra no produto de verdade, não num vídeo.
      </p>
    ),
  },
];

export function Faq() {
  return (
    <div className="divide-border border-border divide-y border-y">
      {ITEMS.map((item) => (
        <details key={item.question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
            <span className="text-base font-medium">{item.question}</span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
