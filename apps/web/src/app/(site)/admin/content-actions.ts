"use server";

import { revalidatePath } from "next/cache";
import type { SiteContent } from "@elora/core";

import { currentAdmin } from "@/lib/site/auth";
import { readSiteContent, resetSiteContent, saveSiteContent } from "@/lib/site/content-store";

/**
 * Escritas do conteúdo do site.
 *
 * ## A checagem de papel acontece aqui, e não só na tela
 *
 * A mesma regra de `openVerticalAction`: Server Action tem endereço próprio, e
 * um `POST` montado à mão nunca passa pela função que renderiza a página. Sem a
 * conferência, qualquer pessoa na internet reescreveria a landing page — que é
 * uma superfície bem mais valiosa para quem ataca do que trocar a base de
 * demonstração, porque o texto publicado é assinado pela marca.
 *
 * ## Nenhuma delas lança
 *
 * Recusa é resposta, com o motivo escrito. Lançar levaria a pessoa à página de
 * erro do Next com o documento inteiro que ela acabou de editar ainda no estado
 * do componente — perdido no instante em que a rota trocasse.
 *
 * ## `revalidatePath("/", "layout")` é obrigatório
 *
 * O cabeçalho e o rodapé são desenhados pelo layout do grupo `(site)`, e as
 * páginas são estáticas por padrão. Revalidar só a rota deixaria o menu antigo
 * servindo por cima do conteúdo novo — a mesma armadilha da troca de vertical.
 */

export interface ContentActionResult {
  ok: boolean;
  reason?: string;
  /** Carimbo da versão gravada. O editor passa a exigi-lo na gravação seguinte. */
  updatedAt?: string;
  /** O documento como ficou, já normalizado. */
  content?: SiteContent;
}

const DENIED: ContentActionResult = {
  ok: false,
  reason: "Esta área é da equipe comercial. Entre com uma conta de administrador para publicar.",
};

export async function saveSiteContentAction(
  content: unknown,
  expectedUpdatedAt: string,
): Promise<ContentActionResult> {
  const admin = await currentAdmin();
  if (!admin) return DENIED;

  const result = await saveSiteContent(content, admin.name, expectedUpdatedAt);
  if (!result.ok || !result.content) return { ok: false, reason: result.reason };

  revalidatePath("/", "layout");

  return { ok: true, updatedAt: result.content.updatedAt, content: result.content };
}

export async function resetSiteContentAction(): Promise<ContentActionResult> {
  const admin = await currentAdmin();
  if (!admin) return DENIED;

  const result = await resetSiteContent(admin.name);
  if (!result.ok || !result.content) return { ok: false, reason: result.reason };

  revalidatePath("/", "layout");

  return { ok: true, updatedAt: result.content.updatedAt, content: result.content };
}

/**
 * Recarrega o documento do servidor.
 *
 * Existe para o caso da recusa por conflito: alguém gravou enquanto esta tela
 * estava aberta, e continuar apagaria o trabalho dessa pessoa. Botão que traz a
 * versão do servidor é melhor que instruir a recarregar a página, porque a
 * recarga descarta em silêncio o que estava escrito.
 */
export async function reloadSiteContentAction(): Promise<ContentActionResult> {
  if (!(await currentAdmin())) return DENIED;

  const content = await readSiteContent();
  return { ok: true, updatedAt: content.updatedAt, content };
}
