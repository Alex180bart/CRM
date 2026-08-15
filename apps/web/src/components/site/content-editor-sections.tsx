"use client";

import * as React from "react";
import type {
  FaqItem,
  FooterContent,
  HeaderContent,
  IconCard,
  LandingContent,
  PricingContent,
  StepCard,
} from "@elora/core";

import {
  Bot,
  Boxes,
  Building2,
  HelpCircle,
  Layers,
  MessagesSquare,
  PanelBottom,
  PanelTop,
  Receipt,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";

import {
  AreaField,
  HeadingFields,
  IconField,
  LinkField,
  ListEditor,
  NumberField,
  StringListEditor,
  TextField,
} from "./content-fields";
import { SectionBox, SectionedEditor } from "./content-editor-shell";

/**
 * Os quatro editores de superfície.
 *
 * Cada um recebe o pedaço do documento que lhe cabe e devolve o pedaço alterado.
 * O documento inteiro nunca é montado aqui — quem o costura é `ContentEditor`.
 * A separação evita o padrão que envenena editor de árvore: uma função gigante
 * que recebe um caminho em string e faz `set(obj, "landing.hero.stats.2.label")`,
 * onde o TypeScript deixa de ajudar exatamente no ponto em que mais faria falta.
 */

/* Landing --------------------------------------------------------------------------- */

export function LandingEditor({
  value,
  onChange,
}: {
  value: LandingContent;
  onChange: (value: LandingContent) => void;
}) {
  function patch(next: Partial<LandingContent>) {
    onChange({ ...value, ...next });
  }

  return (
    <SectionedEditor>
      <SectionBox
        title="Herói"
        description="A primeira dobra: selo, título, chamada, botões e os números."
        icon={Sparkles}
      >
        <TextField
          label="Selo acima do título"
          value={value.hero.eyebrow}
          onChange={(next) => patch({ hero: { ...value.hero, eyebrow: next } })}
          hint="Vazio esconde o selo."
        />
        <TextField
          label="Título — primeira parte"
          value={value.hero.titleLead}
          onChange={(next) => patch({ hero: { ...value.hero, titleLead: next } })}
        />
        <StringListEditor
          label="Título — palavras que se alternam"
          description="Entram entre as duas partes do título, rolando caractere a caractere. Apagar todas devolve o título de duas partes, sem rolagem. A maior palavra reserva a largura — use nomes curtos."
          items={value.hero.titleRoll}
          onChange={(titleRoll) => patch({ hero: { ...value.hero, titleRoll } })}
          addLabel="Acrescentar palavra"
        />
        <TextField
          label="Título — parte em âmbar"
          value={value.hero.titleAccent}
          onChange={(next) => patch({ hero: { ...value.hero, titleAccent: next } })}
          hint="Sai destacada na cor de acento, logo após a primeira parte."
        />
        <AreaField
          label="Chamada"
          rows={4}
          value={value.hero.subtitle}
          onChange={(next) => patch({ hero: { ...value.hero, subtitle: next } })}
        />

        <LinkField
          label="Botão principal"
          optional
          value={value.hero.primary}
          onChange={(next) => patch({ hero: { ...value.hero, primary: next } })}
        />
        <LinkField
          label="Botão secundário"
          optional
          value={value.hero.secondary}
          onChange={(next) => patch({ hero: { ...value.hero, secondary: next } })}
        />
        <LinkField
          label="Link discreto"
          optional
          value={value.hero.tertiary}
          onChange={(next) => patch({ hero: { ...value.hero, tertiary: next } })}
        />

        <ListEditor
          label="Números do herói"
          description="Descrevem o produto — canais, módulos, edições. Número de resultado de operação (taxa de resolução, tempo de resposta) não deveria entrar aqui sem cliente em produção que o sustente."
          items={value.hero.stats}
          onChange={(stats) => patch({ hero: { ...value.hero, stats } })}
          create={(id) => ({ id, value: 0, suffix: "", label: "" })}
          titleOf={(stat) => stat.label || "Número sem rótulo"}
          addLabel="Acrescentar número"
          render={(stat, update) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Valor"
                value={stat.value}
                onChange={(next) => update({ value: next })}
              />
              <TextField
                label="Sufixo"
                value={stat.suffix}
                onChange={(next) => update({ suffix: next })}
                placeholder=" h"
              />
              <TextField
                label="Rótulo"
                value={stat.label}
                onChange={(next) => update({ label: next })}
              />
            </div>
          )}
        />
      </SectionBox>

      <SectionBox
        title="Segmentos"
        description="A faixa de nomes que desliza abaixo do herói."
        icon={Building2}
        count={value.segments.length}
      >
        <TextField
          label="Chamada da faixa"
          value={value.segmentsLabel}
          onChange={(next) => patch({ segmentsLabel: next })}
        />
        <StringListEditor
          label="Segmentos"
          description="A lista é duplicada na renderização para o laço fechar sem vão branco."
          items={value.segments}
          onChange={(segments) => patch({ segments })}
          addLabel="Acrescentar segmento"
        />
      </SectionBox>

      <SectionBox
        title="O problema"
        description="Os três cartões que abrem o argumento da página."
        icon={Timer}
        count={value.problems.length}
      >
        <HeadingFields value={value.problem} onChange={(problem) => patch({ problem })} />
        <ListEditor
          label="Cartões"
          items={value.problems}
          onChange={(problems) => patch({ problems })}
          create={(id): IconCard => ({ id, icon: "Layers", title: "", body: "" })}
          titleOf={(item) => item.title || "Cartão sem título"}
          addLabel="Acrescentar cartão"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <IconField label="Ícone" value={item.icon} onChange={(icon) => update({ icon })} />
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(title) => update({ title })}
                />
              </div>
              <AreaField label="Texto" value={item.body} onChange={(body) => update({ body })} />
            </>
          )}
        />
      </SectionBox>

      <SectionBox
        title="Por dentro"
        description="Só o cabeçalho. As oito prévias são desenhadas em JSX."
        icon={Layers}
      >
        <HeadingFields value={value.showcase} onChange={(showcase) => patch({ showcase })} />
      </SectionBox>

      <SectionBox
        title="Módulos"
        description="É aqui que se acrescenta recurso novo à página."
        icon={Boxes}
        count={value.moduleCards.length}
      >
        <HeadingFields value={value.modules} onChange={(modules) => patch({ modules })} />
        <ListEditor
          label="Módulos"
          description="É aqui que se acrescenta recurso novo à página."
          items={value.moduleCards}
          onChange={(moduleCards) => patch({ moduleCards })}
          create={(id): IconCard => ({ id, icon: "Sparkles", title: "", body: "" })}
          titleOf={(item) => item.title || "Módulo sem título"}
          addLabel="Acrescentar módulo"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <IconField label="Ícone" value={item.icon} onChange={(icon) => update({ icon })} />
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(title) => update({ title })}
                />
              </div>
              <AreaField label="Texto" value={item.body} onChange={(body) => update({ body })} />
            </>
          )}
        />
      </SectionBox>

      <SectionBox
        title="Edições e preço"
        description="Os cartões vêm do catálogo. Aqui ficam só os textos ao redor."
        icon={Receipt}
        count={value.plans.notes.length}
      >
        <HeadingFields
          value={{
            eyebrow: value.plans.eyebrow,
            title: value.plans.title,
            body: value.plans.body,
          }}
          onChange={(heading) => patch({ plans: { ...value.plans, ...heading } })}
        />
        <ListEditor
          label="Notas abaixo dos cartões"
          description="A resposta antecipada às perguntas que todo orçamento recebe depois de assinado."
          items={value.plans.notes}
          onChange={(notes) => patch({ plans: { ...value.plans, notes } })}
          create={(id): IconCard => ({ id, icon: "Receipt", title: "", body: "" })}
          titleOf={(item) => item.title || "Nota sem título"}
          addLabel="Acrescentar nota"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <IconField label="Ícone" value={item.icon} onChange={(icon) => update({ icon })} />
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(title) => update({ title })}
                />
              </div>
              <AreaField
                label="Texto"
                placeholders
                value={item.body}
                onChange={(body) => update({ body })}
              />
            </>
          )}
        />
        <AreaField
          label="Nota de rodapé da seção"
          rows={3}
          placeholders
          value={value.plans.footnote}
          onChange={(footnote) => patch({ plans: { ...value.plans, footnote } })}
        />
      </SectionBox>

      <SectionBox
        title="Inteligência artificial"
        description="A seção escura, com a lista de garantias e o rastro de execução."
        icon={Bot}
        count={value.ai.trace.length}
      >
        <TextField
          label="Selo"
          value={value.ai.badge}
          onChange={(badge) => patch({ ai: { ...value.ai, badge } })}
        />
        <AreaField
          label="Título"
          rows={2}
          value={value.ai.title}
          onChange={(title) => patch({ ai: { ...value.ai, title } })}
        />
        <AreaField
          label="Texto"
          rows={4}
          value={value.ai.body}
          onChange={(body) => patch({ ai: { ...value.ai, body } })}
        />
        <StringListEditor
          label="Lista de garantias"
          multiline
          items={value.ai.bullets}
          onChange={(bullets) => patch({ ai: { ...value.ai, bullets } })}
          addLabel="Acrescentar item"
        />
        <TextField
          label="Título do rastro"
          value={value.ai.traceTitle}
          onChange={(traceTitle) => patch({ ai: { ...value.ai, traceTitle } })}
        />
        <ListEditor
          label="Passos do rastro"
          description="A ilustração de uma execução do agente. A numeração é automática pela posição."
          items={value.ai.trace}
          onChange={(trace) => patch({ ai: { ...value.ai, trace } })}
          create={(id) => ({ id, title: "", detail: "", pending: false })}
          titleOf={(item, index) => `${index + 1}. ${item.title || "Passo sem título"}`}
          addLabel="Acrescentar passo"
          render={(item, update) => (
            <>
              <TextField
                label="Decisão"
                value={item.title}
                onChange={(title) => update({ title })}
              />
              <TextField
                label="Detalhe técnico"
                value={item.detail}
                onChange={(detail) => update({ detail })}
                hint="Sai em tipo pequeno, abaixo da decisão."
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.pending}
                  onChange={(event) => update({ pending: event.target.checked })}
                  className="accent-accent size-4"
                />
                Pendente — sai em âmbar, ilustrando &ldquo;a escrita espera gente&rdquo;
              </label>
            </>
          )}
        />
        <AreaField
          label="Nota abaixo do rastro"
          rows={2}
          value={value.ai.traceFootnote}
          onChange={(traceFootnote) => patch({ ai: { ...value.ai, traceFootnote } })}
        />
      </SectionBox>

      <SectionBox
        title="Implantação"
        description="Os passos até estar no ar, com prazo por cartão."
        icon={Rocket}
        count={value.stepCards.length}
      >
        <HeadingFields value={value.steps} onChange={(steps) => patch({ steps })} />
        <ListEditor
          label="Passos"
          items={value.stepCards}
          onChange={(stepCards) => patch({ stepCards })}
          create={(id): StepCard => ({ id, icon: "Rocket", title: "", body: "", detail: "" })}
          titleOf={(item) => item.title || "Passo sem título"}
          addLabel="Acrescentar passo"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <IconField label="Ícone" value={item.icon} onChange={(icon) => update({ icon })} />
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(title) => update({ title })}
                />
              </div>
              <AreaField label="Texto" value={item.body} onChange={(body) => update({ body })} />
              <TextField
                label="Prazo"
                value={item.detail}
                onChange={(detail) => update({ detail })}
                placeholder="1 a 3 dias"
                hint="Vazio esconde a linha do rodapé do cartão."
              />
            </>
          )}
        />
      </SectionBox>

      <SectionBox
        title="Segurança e LGPD"
        description="A governança que aparece no tipo, não só na política."
        icon={ShieldCheck}
        count={value.securityCards.length}
      >
        <HeadingFields value={value.security} onChange={(security) => patch({ security })} />
        <ListEditor
          label="Cartões"
          items={value.securityCards}
          onChange={(securityCards) => patch({ securityCards })}
          create={(id): IconCard => ({ id, icon: "ShieldCheck", title: "", body: "" })}
          titleOf={(item) => item.title || "Cartão sem título"}
          addLabel="Acrescentar cartão"
          render={(item, update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <IconField label="Ícone" value={item.icon} onChange={(icon) => update({ icon })} />
                <TextField
                  label="Título"
                  value={item.title}
                  onChange={(title) => update({ title })}
                />
              </div>
              <AreaField label="Texto" value={item.body} onChange={(body) => update({ body })} />
            </>
          )}
        />
      </SectionBox>

      <SectionBox
        title="Chamada final"
        description="A última seção antes do rodapé."
        icon={MessagesSquare}
      >
        <TextField
          label="Título da seção de perguntas"
          value={value.faqTitle}
          onChange={(faqTitle) => patch({ faqTitle })}
          hint="As perguntas em si ficam na aba Perguntas frequentes."
        />
        <IconField
          label="Ícone"
          value={value.cta.icon}
          onChange={(icon) => patch({ cta: { ...value.cta, icon } })}
        />
        <AreaField
          label="Título"
          rows={2}
          value={value.cta.title}
          onChange={(title) => patch({ cta: { ...value.cta, title } })}
        />
        <AreaField
          label="Texto"
          value={value.cta.body}
          onChange={(body) => patch({ cta: { ...value.cta, body } })}
        />
        <LinkField
          label="Botão principal"
          optional
          value={value.cta.primary}
          onChange={(primary) => patch({ cta: { ...value.cta, primary } })}
        />
        <LinkField
          label="Botão secundário"
          optional
          value={value.cta.secondary}
          onChange={(secondary) => patch({ cta: { ...value.cta, secondary } })}
        />
      </SectionBox>

      <SectionBox
        title="Busca"
        description="Título da aba do navegador e descrição no resultado de busca."
        icon={Search}
      >
        <TextField
          label="Título da página"
          value={value.meta.title}
          onChange={(title) => patch({ meta: { ...value.meta, title } })}
        />
        <AreaField
          label="Descrição"
          rows={3}
          value={value.meta.description}
          onChange={(description) => patch({ meta: { ...value.meta, description } })}
          hint="Entre 120 e 160 caracteres é o que o Google costuma exibir inteiro."
        />
      </SectionBox>
    </SectionedEditor>
  );
}

/* Perguntas frequentes -------------------------------------------------------------- */

export function FaqEditor({
  value,
  onChange,
}: {
  value: FaqItem[];
  onChange: (value: FaqItem[]) => void;
}) {
  return (
    <SectionedEditor>
      <SectionBox
        title="Perguntas frequentes"
        description="A mesma lista alimenta a landing page e a página de preços."
        icon={HelpCircle}
        count={value.length}
      >
        <ListEditor
          label="Perguntas"
          description="Resposta específica evita a reunião; resposta genérica só a adia."
          items={value}
          onChange={onChange}
          create={(id) => ({ id, question: "", answer: "" })}
          titleOf={(item) => item.question || "Pergunta sem texto"}
          addLabel="Acrescentar pergunta"
          render={(item, update) => (
            <>
              <TextField
                label="Pergunta"
                value={item.question}
                onChange={(question) => update({ question })}
              />
              <AreaField
                label="Resposta"
                rows={6}
                value={item.answer}
                onChange={(answer) => update({ answer })}
                hint="Linha em branco separa parágrafos."
              />
            </>
          )}
        />
      </SectionBox>
    </SectionedEditor>
  );
}

/* Preços ---------------------------------------------------------------------------- */

export function PricingEditor({
  value,
  onChange,
}: {
  value: PricingContent;
  onChange: (value: PricingContent) => void;
}) {
  function patch(next: Partial<PricingContent>) {
    onChange({ ...value, ...next });
  }

  return (
    <SectionedEditor>
      <SectionBox title="Abertura" description="O herói da página de preços." icon={Sparkles}>
        <AreaField
          label="Título"
          rows={2}
          value={value.hero.title}
          onChange={(title) => patch({ hero: { ...value.hero, title } })}
        />
        <AreaField
          label="Chamada"
          rows={3}
          value={value.hero.subtitle}
          onChange={(subtitle) => patch({ hero: { ...value.hero, subtitle } })}
        />
      </SectionBox>

      <SectionBox
        title="Excedente"
        description="O texto ao redor da tabela de preço por excedente."
        icon={TrendingUp}
      >
        <TextField
          label="Título"
          value={value.overage.title}
          onChange={(title) => patch({ overage: { ...value.overage, title } })}
        />
        <AreaField
          label="Texto"
          value={value.overage.body}
          onChange={(body) => patch({ overage: { ...value.overage, body } })}
        />
        <AreaField
          label="Nota abaixo da tabela"
          rows={2}
          value={value.overage.footnote}
          onChange={(footnote) => patch({ overage: { ...value.overage, footnote } })}
        />
      </SectionBox>

      <SectionBox title="WhatsApp" description="O cartão de tarifas da Meta." icon={MessagesSquare}>
        <TextField
          label="Título"
          value={value.whatsapp.title}
          onChange={(title) => patch({ whatsapp: { ...value.whatsapp, title } })}
        />
        <AreaField
          label="Texto"
          value={value.whatsapp.body}
          onChange={(body) => patch({ whatsapp: { ...value.whatsapp, body } })}
        />
        <AreaField
          label="Nota de vigência"
          rows={3}
          placeholders
          value={value.whatsapp.footnote}
          onChange={(footnote) => patch({ whatsapp: { ...value.whatsapp, footnote } })}
          hint="As datas viajam como marcador e saem do catálogo — não digite a data à mão."
        />
      </SectionBox>

      <SectionBox
        title="Complementos"
        description="Os dois blocos abaixo da tabela principal."
        icon={Boxes}
      >
        <TextField
          label="Título dos complementos"
          value={value.addons.title}
          onChange={(title) => patch({ addons: { ...value.addons, title } })}
        />
        <AreaField
          label="Texto dos complementos"
          value={value.addons.body}
          onChange={(body) => patch({ addons: { ...value.addons, body } })}
        />
        <TextField
          label="Título da tabela de franquias"
          value={value.included.title}
          onChange={(title) => patch({ included: { title } })}
        />
      </SectionBox>

      <SectionBox
        title="Fechamento"
        description="O cartão de chamada antes das perguntas."
        icon={Receipt}
      >
        <TextField
          label="Título"
          value={value.close.title}
          onChange={(title) => patch({ close: { ...value.close, title } })}
        />
        <AreaField
          label="Texto"
          rows={6}
          value={value.close.body}
          onChange={(body) => patch({ close: { ...value.close, body } })}
          hint="Linha em branco separa parágrafos."
        />
        <LinkField
          label="Botão principal"
          optional
          value={value.close.primary}
          onChange={(primary) => patch({ close: { ...value.close, primary } })}
        />
        <LinkField
          label="Botão secundário"
          optional
          value={value.close.secondary}
          onChange={(secondary) => patch({ close: { ...value.close, secondary } })}
        />
      </SectionBox>

      <SectionBox
        title="Perguntas e busca"
        description="Título da seção de dúvidas e os campos de busca."
        icon={Search}
      >
        <TextField
          label="Título da seção de perguntas"
          value={value.faq.title}
          onChange={(title) => patch({ faq: { ...value.faq, title } })}
        />
        <AreaField
          label="Nota abaixo das perguntas"
          rows={2}
          value={value.faq.footnote}
          onChange={(footnote) => patch({ faq: { ...value.faq, footnote } })}
        />
        <TextField
          label="Título da página"
          value={value.meta.title}
          onChange={(title) => patch({ meta: { ...value.meta, title } })}
        />
        <AreaField
          label="Descrição para busca"
          rows={3}
          value={value.meta.description}
          onChange={(description) => patch({ meta: { ...value.meta, description } })}
        />
      </SectionBox>
    </SectionedEditor>
  );
}

/* Cabeçalho e rodapé ---------------------------------------------------------------- */

export function ChromeEditor({
  header,
  footer,
  onHeaderChange,
  onFooterChange,
}: {
  header: HeaderContent;
  footer: FooterContent;
  onHeaderChange: (value: HeaderContent) => void;
  onFooterChange: (value: FooterContent) => void;
}) {
  return (
    <SectionedEditor>
      <SectionBox
        title="Cabeçalho"
        description="Aparece em todas as páginas públicas, inclusive no celular."
        icon={PanelTop}
        count={header.links.length}
      >
        <ListEditor
          label="Links de navegação"
          description="Não acrescente as bases de demonstração aqui: carregá-las troca os dados da instância inteira, e o menu público convidaria qualquer visitante a fazer isso no meio de uma apresentação."
          items={header.links}
          onChange={(links) => onHeaderChange({ ...header, links })}
          create={(id) => ({ id, label: "", href: "/" })}
          titleOf={(item) => item.label || "Link sem rótulo"}
          addLabel="Acrescentar link"
          render={(item, update) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Rótulo"
                value={item.label}
                onChange={(label) => update({ label })}
              />
              <TextField label="Endereço" value={item.href} onChange={(href) => update({ href })} />
            </div>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Botão de entrar"
            value={header.signInLabel}
            onChange={(signInLabel) => onHeaderChange({ ...header, signInLabel })}
          />
          <TextField
            label="Botão de quem já entrou"
            value={header.accountLabel}
            onChange={(accountLabel) => onHeaderChange({ ...header, accountLabel })}
            hint="Só aparece no menu de celular."
          />
        </div>
        <LinkField
          label="Botão de ação"
          value={header.cta}
          onChange={(cta) => onHeaderChange({ ...header, cta })}
        />
      </SectionBox>

      <SectionBox
        title="Rodapé"
        description="Colunas de links, estado da plataforma e a linha legal."
        icon={PanelBottom}
        count={footer.columns.length}
      >
        <AreaField
          label="Parágrafo ao lado do logotipo"
          value={footer.tagline}
          onChange={(tagline) => onFooterChange({ ...footer, tagline })}
        />

        <ListEditor
          label="Colunas de links"
          items={footer.columns}
          onChange={(columns) => onFooterChange({ ...footer, columns })}
          create={(id) => ({ id, title: "", links: [] })}
          titleOf={(item) => item.title || "Coluna sem título"}
          addLabel="Acrescentar coluna"
          render={(column, update) => (
            <>
              <TextField
                label="Título da coluna"
                value={column.title}
                onChange={(title) => update({ title })}
              />
              <ListEditor
                label="Links"
                items={column.links}
                onChange={(links) => update({ links })}
                create={(id) => ({ id, label: "", href: "/" })}
                titleOf={(item) => item.label || "Link sem rótulo"}
                addLabel="Acrescentar link"
                render={(item, updateLink) => (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Rótulo"
                      value={item.label}
                      onChange={(label) => updateLink({ label })}
                    />
                    <TextField
                      label="Endereço"
                      value={item.href}
                      onChange={(href) => updateLink({ href })}
                    />
                  </div>
                )}
              />
            </>
          )}
        />

        <TextField
          label="Título do bloco de estado"
          value={footer.statusTitle}
          onChange={(statusTitle) => onFooterChange({ ...footer, statusTitle })}
          hint="Sai em negrito, colado ao início do parágrafo."
        />
        <AreaField
          label="Estado da plataforma"
          rows={6}
          value={footer.statusBody}
          onChange={(statusBody) => onFooterChange({ ...footer, statusBody })}
          hint="Este é o parágrafo que diz o que ainda não funciona. A página inteira acaba de prometer bastante — apagá-lo transfere a conversa para a primeira reunião."
        />
        <TextField
          label="Linha legal"
          value={footer.legal}
          onChange={(legal) => onFooterChange({ ...footer, legal })}
        />
      </SectionBox>
    </SectionedEditor>
  );
}
