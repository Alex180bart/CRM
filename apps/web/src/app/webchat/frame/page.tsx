import type { Metadata } from "next";

import { LiveWidget } from "@/components/webchat/live-widget";

/**
 * Quadro do widget.
 *
 * Página carregada dentro do `iframe` que o `embed.js` cria no site do cliente.
 * Fica fora de `(workspace)` de propósito: não tem barra lateral, cabeçalho nem
 * nada do CRM — é só o widget, num fundo transparente.
 */
export const metadata: Metadata = {
  title: "Atendimento",
  // Quadro de widget não é página para buscador indexar.
  robots: { index: false, follow: false },
};

export default async function WebchatFramePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; host?: string }>;
}) {
  const { key, host } = await searchParams;

  if (!key) {
    return (
      <main className="flex h-dvh items-center justify-center p-4">
        <p className="text-xs text-[#8A3A3A]">Chave do widget ausente no endereço do quadro.</p>
      </main>
    );
  }

  return (
    <main className="h-dvh bg-transparent">
      <LiveWidget embedKey={key} hostOrigin={host} />
    </main>
  );
}
