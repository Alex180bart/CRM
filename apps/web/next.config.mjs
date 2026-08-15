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
   * Pacote autocontido para hospedagem própria, sob demanda.
   *
   * `NEXT_OUTPUT=standalone` faz o build emitir `server.js` com apenas as
   * dependências que o rastreamento provou necessárias — é o que permite subir a
   * aplicação para um servidor onde `pnpm install` não roda. A hospedagem
   * compartilhada em que este projeto vai ao ar tem `npm`, e `npm` não resolve o
   * protocolo `workspace:*` que `@elora/core` e `@elora/ui` usam: instalar lá
   * falharia, e o standalone existe para não precisar instalar nada.
   *
   * Fica atrás de variável porque plataformas gerenciadas montam o próprio
   * pacote a partir do rastreamento e não usam esta saída — ligá-la sempre
   * produziria artefato ignorado e minutos de build gastos à toa.
   */
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  /**
   * A raiz do rastreamento é o monorepo, não `apps/web`.
   *
   * O `pnpm` guarda os pacotes em `node_modules/.pnpm` na raiz e liga por
   * symlink; com a raiz padrão (a pasta do app), o Next segue os links para fora
   * do escopo e **não copia** o que está do lado de lá. O sintoma é o pior tipo:
   * o build passa, o pacote sobe, e a aplicação morre na primeira requisição com
   * `Cannot find module`, apontando uma dependência que existe na máquina de quem
   * compilou.
   */
  outputFileTracingRoot: resolve(here, "../.."),
  /**
   * O indicador de desenvolvimento do Next fica desligado.
   *
   * Não é preferência estética: ele é renderizado dentro de **todo** documento,
   * inclusive do `iframe` do widget de webchat, onde aparece como um círculo
   * escuro sobre o lançador — em cima justamente da peça que se está ajustando.
   */
  devIndicators: false,
  reactStrictMode: true,
  /**
   * Barris de importação reescritos para importação direta.
   *
   * `@elora/core` é um `export *` de cinco subárvores, e uma delas é `demo/` —
   * as quatro verticais inteiras, 1,3 MB de fonte. Como 138 arquivos importam
   * daquele barril, uma tela que só queria `formatDateTime` arrastava a base de
   * demonstração de e-commerce junto, no servidor e no pacote do navegador. O
   * mesmo vale para `@elora/ui`, importado por 114 arquivos.
   *
   * Esta opção faz o Next reescrever `import { x } from "@elora/core"` para o
   * arquivo que define `x`. O efeito é medido, não presumido: o primeiro
   * carregamento caiu de 299 kB para 171 kB em `/inicio`, de 337 para 232 em
   * `/administracao` e de 231 para 109 no quadro do webchat — que é o que roda
   * no site do cliente, onde cada quilobyte é de outra pessoa.
   *
   * `lucide-react` não está na lista porque o Next já a otimiza por padrão.
   *
   * **A condição para isto ser seguro é que os módulos do core não tenham efeito
   * colateral de importação.** Se algum passar a semear armazém ao ser carregado,
   * a reescrita pode pular o efeito — e o sintoma seria dado ausente numa tela
   * só, sem erro. O armazém atual é preenchido por chamada (`dataset()`,
   * `reseedStore()`), não por importação, e é isso que sustenta a otimização.
   */
  experimental: {
    optimizePackageImports: ["@elora/core", "@elora/ui", "@xyflow/react"],
  },
  /**
   * O conteúdo do site viaja junto com **toda** função.
   *
   * `lib/site/content-store.ts` monta o caminho em tempo de execução
   * (`path.join(process.cwd(), "content", "site-content.json")`), e o rastreador
   * de arquivos do Next resolve isso só em parte: no build de verificação, o JSON
   * entrou no pacote de `/`, `/precos` e `/admin` — que chamam `readSiteContent`
   * no próprio módulo da página — e **ficou de fora** de `/orcamento`, `/entrar`,
   * `/cadastrar` e `/conta`, que leem o mesmo arquivo pelo layout do grupo, para
   * desenhar cabeçalho e rodapé.
   *
   * Em hospedagem serverless, onde cada rota é empacotada com os arquivos que o
   * rastreamento apontou, o efeito seria silencioso e confuso: metade do site com
   * o menu editado, a outra metade com o texto padrão do código — sem erro, sem
   * log, e sem relação aparente com a publicação que acabou de acontecer.
   *
   * O arquivo tem dezenas de kilobytes. Incluí-lo em todas as rotas custa menos
   * que a chance de alguém acrescentar uma página ao site e reencontrar isto.
   */
  outputFileTracingIncludes: {
    "/**": ["./content/site-content.json"],
  },
  /**
   * O nodemailer sai do empacotamento.
   *
   * Ele resolve transporte e codificação por `require` dinâmico, e o empacotador
   * não consegue seguir esses caminhos: o pacote quebra em tempo de execução, no
   * envio, e não no build — o pior lugar para descobrir, porque o único sintoma é
   * o pedido de proposta que não chega.
   */
  serverExternalPackages: ["nodemailer"],
  // Os pacotes internos são publicados como TypeScript puro; o Next transpila.
  transpilePackages: ["@elora/ui", "@elora/core"],
  eslint: {
    // O lint roda na raiz do monorepo, com a mesma configuração para todos os pacotes.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
