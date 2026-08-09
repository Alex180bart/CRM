import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ambiente compartilhado do monorepo.
 *
 * O Next só lê `.env*` da pasta do próprio app, mas segredo de infraestrutura
 * (chave de provedor de IA, futura conexão do Supabase) pertence à raiz: é um
 * valor por repositório, não por aplicação. Em vez de duplicar o arquivo — e
 * arriscar duas verdades divergentes —, carregamos a raiz aqui.
 *
 * A precedência é a esperada: quem já está no ambiente (CI, painel de deploy,
 * shell) manda, e `.env.local` da raiz vence o `.env` versionado.
 */
const here = dirname(fileURLToPath(import.meta.url));

function loadRootEnv(fileName) {
  let content;
  try {
    content = readFileSync(resolve(here, "../..", fileName), "utf8");
  } catch {
    return; // Ausência de arquivo de ambiente é normal, não é erro.
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    // Remove espaço ao redor do valor e as aspas que costumam sobrar de cópia.
    process.env[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
}

loadRootEnv(".env.local");
loadRootEnv(".env");

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Diretório de build isolável.
   *
   * `next dev` e `next build` compartilham `.next`, e rodar os dois ao mesmo
   * tempo no mesmo repositório derruba o servidor com `ENOENT
   * routes-manifest.json` — o build apaga o manifesto que o servidor está
   * lendo. Com esta variável, uma verificação em paralelo aponta para outro
   * diretório (`NEXT_DIST_DIR=.next-check pnpm dev -p 3101`) e os dois convivem.
   *
   * O padrão continua `.next`: sem a variável, nada muda.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /**
   * O indicador de desenvolvimento do Next fica desligado.
   *
   * Não é preferência estética: ele é renderizado dentro de **todo** documento,
   * inclusive do `iframe` do widget de webchat, onde aparece como um círculo
   * escuro sobre o lançador — em cima justamente da peça que se está ajustando.
   */
  devIndicators: false,
  reactStrictMode: true,
  // Os pacotes internos são publicados como TypeScript puro; o Next transpila.
  transpilePackages: ["@elora/ui", "@elora/core"],
  eslint: {
    // O lint roda na raiz do monorepo, com a mesma configuração para todos os pacotes.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
