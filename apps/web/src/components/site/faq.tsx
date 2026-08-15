import type { FaqItem } from "@elora/core";
import { ChevronDown } from "lucide-react";

import { RichText } from "./rich-text";

/**
 * Perguntas frequentes em `<details>`.
 *
 * Sem JavaScript, sem estado, sem componente de acordeão: `<details>` já é
 * acessível por teclado, anunciado corretamente por leitor de tela e funciona
 * antes do bundle carregar. Reimplementá-lo em React acrescentaria peso a uma
 * seção que o visitante talvez nem abra.
 *
 * ## A resposta é texto, e não mais JSX
 *
 * As respostas viviam como `React.ReactNode` neste arquivo, com `<strong>` e
 * `<em>` escritos à mão — o que fazia toda edição de FAQ passar por quem
 * programa. Hoje são Markdown mínimo vindo do conteúdo editável, e a ênfase
 * sobrevive: `**leitura o agente executa**` continua saindo em negrito, agora
 * escrito por quem entende da pergunta.
 *
 * As respostas continuam deliberadamente específicas. FAQ genérica ("sim, é
 * seguro!") não responde nada e transfere a pergunta para a reunião — que é
 * justamente o que ela deveria evitar.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="divide-border border-border divide-y border-y">
      {items.map((item) => (
        <details key={item.id} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
            <span className="text-base font-medium">{item.question}</span>
            <ChevronDown
              className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <RichText className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
            {item.answer}
          </RichText>
        </details>
      ))}
    </div>
  );
}
