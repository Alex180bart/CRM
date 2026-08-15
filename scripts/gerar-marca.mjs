/**
 * Gera os arquivos soltos da marca Elora a partir da geometria do componente.
 *
 *     node scripts/gerar-marca.mjs
 *
 * ## Por que existe
 *
 * A marca do produto é o componente `components/shell/logo.tsx`: SVG desenhado em
 * JSX, que herda cor de token e acompanha a troca de paleta de graça. Fora do
 * aplicativo — apresentação, assinatura de e-mail, avatar de rede social, papel —
 * nada disso existe, e é preciso um arquivo.
 *
 * Este script é o que impede as duas marcas de divergirem. Sem ele, alguém abre
 * o Figma, redesenha "parecido", e seis meses depois o logotipo do slide não é o
 * mesmo do produto. Aqui os quatro traçados do símbolo são copiados do
 * componente e o nome é convertido em contorno a partir da mesma fonte que a
 * aplicação carrega.
 *
 * **Ao mexer no desenho do componente, rode isto de novo** — e confira o
 * resultado, porque o script não tem como saber que o desenho mudou.
 *
 * ## As duas dependências não estão no `package.json`
 *
 * `opentype.js` converte o nome em contorno; `sharp` rasteriza. Instale sob
 * demanda, **dentro de `scripts/`**:
 *
 *     npm i --no-save --prefix scripts opentype.js sharp
 *
 * O `--prefix scripts` não é preciosismo: a árvore de `node_modules` da raiz é
 * gerenciada pelo pnpm, e mandar o npm reconciliá-la para acrescentar dois
 * pacotes pode desfazer os vínculos que o pnpm criou — a repo pararia de
 * compilar até alguém rodar `pnpm install` de novo. Em `scripts/node_modules` o
 * npm fica no próprio canto, e a resolução de módulo do Node encontra a partir
 * daqui porque sobe diretório por diretório.
 *
 * Ficam de fora das dependências do projeto de propósito: são pesadas — `sharp`
 * traz binário nativo por plataforma — e servem a um comando que roda quando a
 * marca muda, o que não acontece por release. Carregá-las em todo `pnpm install`
 * de todo mundo para um script anual é o tipo de custo que ninguém percebe estar
 * pagando.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "apps/web/public/marca");

/**
 * A fonte vem do pacote instalado, não de uma cópia no repositório.
 *
 * `@fontsource/sora` já é dependência da aplicação — é a mesma face que o site
 * carrega. Guardar um `.woff` à parte criaria a segunda cópia que este script
 * inteiro existe para evitar, agora do lado da tipografia.
 */
const FONTE = path.join(
  RAIZ,
  "node_modules/.pnpm/@fontsource+sora@5.3.0/node_modules/@fontsource/sora/files/sora-latin-600-normal.woff",
);

const [{ default: opentype }, { default: sharp }] = await Promise.all([
  import("opentype.js").catch(falta("opentype.js")),
  import("sharp").catch(falta("sharp")),
]);

function falta(nome) {
  return () => {
    console.error(
      `\nFalta ${nome}. Instale sem gravar no package.json e sem tocar na árvore do pnpm:\n\n` +
        "    npm i --no-save --prefix scripts opentype.js sharp\n",
    );
    process.exit(1);
  };
}

if (!fs.existsSync(FONTE)) {
  console.error(
    `\nFonte não encontrada em:\n  ${FONTE}\n\n` +
      "O caminho carrega a versão do pacote. Se o @fontsource/sora foi atualizado, ajuste a constante FONTE.\n",
  );
  process.exit(1);
}

/* Paleta ------------------------------------------------------------------- */

/**
 * Os literais existem porque arquivo solto não tem `tokens.css`.
 *
 * São os valores da paleta padrão: `--primary` (244 47% 20%) e `--accent`
 * (38 92% 45%). Ao trocar a paleta padrão, este script acompanha à mão — mesma
 * nota que `app/icon.svg` carrega, e pelo mesmo motivo. Converta do HSL do
 * token; não copie de outro arquivo, que foi como o âmbar do ícone da aba
 * chegou a ficar cinco pontos mais claro que a marca.
 */
const INDIGO = "#1E1B4B";
const AMBAR = "#DC8F09";
const BRANCO = "#FFFFFF";

/* Símbolo ------------------------------------------------------------------ */

/** Os quatro traçados de `LogoMark`, no quadro de 24. Copiados, não redesenhados. */
const ARCO = "M17.79 5.11A9 9 0 1 0 17.79 18.89";
const HASTE_ALTA = "M6.4 6.6H18.2";
const HASTE_BAIXA = "M6.4 17.4H18.2";
const HASTE_MEIO = "M4.7 12H14.4";

function simbolo(traco, acento) {
  return [
    `<g fill="none" stroke="${traco}" stroke-width="2.4" stroke-linecap="round">`,
    `<path d="${ARCO}"/>`,
    `<path d="${HASTE_ALTA}"/>`,
    `<path d="${HASTE_BAIXA}"/>`,
    `<path d="${HASTE_MEIO}"${acento ? ` stroke="${acento}"` : ""}/>`,
    `</g>`,
  ].join("");
}

/* Nome --------------------------------------------------------------------- */

/**
 * "Elora" em contorno.
 *
 * Contorno, e não `<text>`: fora do site a fonte Sora não existe, e o editor ou
 * navegador cai numa substituta — o logotipo chegaria com outra letra. O custo é
 * o texto deixar de ser selecionável, que num logotipo não é perda.
 */
const fonte = opentype.parse(fs.readFileSync(FONTE).buffer);

/**
 * O corpo do nome, derivado da proporção do componente.
 *
 * Lá, com altura `H`: símbolo a `H × 0,92` e nome a `H × 0,78`. Desenhando o
 * símbolo no quadro nativo de 24, `H` vale `24 / 0,92` — e o corpo do nome sai
 * daí. Escrever "20" à mão aqui faria o arquivo e a tela divergirem no dia em
 * que alguém ajustasse a proporção do componente.
 */
const CORPO = (24 / 0.92) * 0.78;
const TRACKING = -0.02 * CORPO;

const partes = [];
let avanco = 0;

for (const [indice, glifo] of fonte.stringToGlyphs("Elora").entries()) {
  partes.push(glifo.getPath(avanco, 0, CORPO).toPathData(3));
  avanco += (glifo.advanceWidth / fonte.unitsPerEm) * CORPO;
  if (indice < 4) avanco += TRACKING;
}

const NOME = partes.join(" ");

/** Extremos do contorno: linha de base em 0, altura de maiúscula acima dela. */
const NOME_X1 = fonte.stringToGlyphs("E")[0].getPath(0, 0, CORPO).getBoundingBox().x1;
const NOME_LARGURA = avanco - TRACKING - NOME_X1 + sobraDireita();

function sobraDireita() {
  // O avanço do último glifo inclui a lateral direita; o contorno termina antes.
  const ultimo = fonte.stringToGlyphs("a")[0];
  const caixa = ultimo.getPath(0, 0, CORPO).getBoundingBox();
  return caixa.x2 - (ultimo.advanceWidth / fonte.unitsPerEm) * CORPO;
}

const ALTURA_MAIUSCULA = -fonte.stringToGlyphs("E")[0].getPath(0, 0, CORPO).getBoundingBox().y1;

/**
 * O vão entre símbolo e nome.
 *
 * No componente é `gap-2` (8 px) com o símbolo a 22 px. Aqui o símbolo está no
 * quadro nativo de 24, então o vão é reescalado por 24/22 — é o que faz o
 * arquivo solto e a tela terem a mesma respiração.
 */
const VAO = 8 * (24 / 22);
const NOME_X = 24 + VAO - NOME_X1;
/** Centrado pela altura de maiúscula, não pelo contorno: "Elora" não tem descida. */
const NOME_Y = 12 + ALTURA_MAIUSCULA / 2;

/**
 * A folga que o símbolo já tem, repetida à direita do nome.
 *
 * O traçado do anel tem 2,4 de espessura com ponta redonda, então a tinta começa
 * 1,8 dentro do quadro de 24 — e é por isso que o símbolo isolado é simétrico.
 * Sem repetir esse valor no fim, o logotipo completo ficaria com folga à
 * esquerda e zero à direita: o "a" encostado na borda, que é o que faz alguém
 * concluir que o arquivo veio cortado.
 */
const FOLGA = 1.8;
const LARGURA = Number((24 + VAO + NOME_LARGURA + FOLGA).toFixed(2));

/* Composição ---------------------------------------------------------------- */

function svg(largura, altura, corpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">${corpo}</svg>\n`;
}

function logotipo(tracoSimbolo, acento, corNome) {
  return svg(
    LARGURA,
    24,
    simbolo(tracoSimbolo, acento) +
      `<path d="${NOME}" fill="${corNome}" transform="translate(${NOME_X.toFixed(3)} ${NOME_Y.toFixed(3)})"/>`,
  );
}

/**
 * O símbolo dentro do quadrado de marca.
 *
 * Mesmo desenho de `app/icon.svg`: quadro de 32, folga de 4, canto de 7. Serve a
 * avatar de rede social, WhatsApp Business e qualquer lugar que peça imagem
 * quadrada — onde um símbolo transparente sumiria contra o fundo do serviço.
 */
function selo() {
  return svg(
    32,
    32,
    `<rect width="32" height="32" rx="7" fill="${INDIGO}"/><g transform="translate(4 4)">${simbolo(BRANCO, AMBAR)}</g>`,
  );
}

/**
 * A imagem que aparece ao colar o link do site no WhatsApp, LinkedIn ou Slack.
 *
 * 1200 × 630 é a proporção que os três recortam sem cortar nada. O texto é
 * grande de propósito: essa peça é lida em miniatura, dentro de uma conversa, ao
 * lado de outra dúzia de mensagens. A face é a genérica do sistema, e não Sora:
 * o rasterizador não carrega fonte do projeto, e uma substituição silenciosa
 * seria pior que a escolha explícita.
 */
function compartilhamento() {
  const escala = 7.2;
  const x = (1200 - LARGURA * escala) / 2;

  return svg(
    1200,
    630,
    [
      `<defs>`,
      `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">`,
      `<stop offset="0" stop-color="#312E81"/>`,
      `<stop offset="0.55" stop-color="${INDIGO}"/>`,
      `<stop offset="1" stop-color="#15132F"/>`,
      `</linearGradient>`,
      `<radialGradient id="halo" cx="0.5" cy="0.42" r="0.6">`,
      `<stop offset="0" stop-color="${AMBAR}" stop-opacity="0.18"/>`,
      `<stop offset="1" stop-color="${AMBAR}" stop-opacity="0"/>`,
      `</radialGradient>`,
      `</defs>`,
      `<rect width="1200" height="630" fill="url(#fundo)"/>`,
      `<rect width="1200" height="630" fill="url(#halo)"/>`,
      `<g transform="translate(${x.toFixed(2)} 214) scale(${escala})">`,
      simbolo(BRANCO, AMBAR),
      `<path d="${NOME}" fill="${BRANCO}" transform="translate(${NOME_X.toFixed(3)} ${NOME_Y.toFixed(3)})"/>`,
      `</g>`,
      `<rect x="546" y="392" width="108" height="3" rx="1.5" fill="${AMBAR}"/>`,
      `<text x="600" y="452" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30" fill="#FFFFFF" fill-opacity="0.78">Atendimento, CRM 360º, automação e IA numa plataforma só</text>`,
      `<text x="600" y="500" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="24" fill="#FFFFFF" fill-opacity="0.5">Contabilidade Facilitada</text>`,
    ].join(""),
  );
}

/* Escrita ------------------------------------------------------------------- */

const arquivos = {
  "elora-simbolo.svg": svg(24, 24, simbolo(INDIGO, AMBAR)),
  "elora-simbolo-claro.svg": svg(24, 24, simbolo(BRANCO, AMBAR)),
  "elora-simbolo-mono.svg": svg(24, 24, simbolo("currentColor", null)),
  "elora-logo.svg": logotipo(INDIGO, AMBAR, INDIGO),
  "elora-logo-claro.svg": logotipo(BRANCO, AMBAR, BRANCO),
  "elora-logo-mono.svg": logotipo("currentColor", null, "currentColor"),
  "elora-selo.svg": selo(),
  "elora-compartilhamento.svg": compartilhamento(),
};

fs.mkdirSync(path.join(SAIDA, "png"), { recursive: true });
for (const [nome, conteudo] of Object.entries(arquivos)) {
  fs.writeFileSync(path.join(SAIDA, nome), conteudo, "utf8");
}

/**
 * Rasterização.
 *
 * O monocromático fica de fora: `currentColor` não tem valor sem um documento
 * que o defina, e o rasterizador o pinta de preto — um PNG preto chamado "mono"
 * acabaria usado por engano como se fosse a marca.
 */
const raster = [
  ["elora-simbolo.svg", "elora-simbolo", [512, 256, 128, 64, 32]],
  ["elora-simbolo-claro.svg", "elora-simbolo-claro", [512, 256, 128]],
  ["elora-selo.svg", "elora-selo", [1024, 512, 256, 192, 128]],
  ["elora-logo.svg", "elora-logo", [1024, 512, 256]],
  ["elora-logo-claro.svg", "elora-logo-claro", [1024, 512, 256]],
];

for (const [origem, base, larguras] of raster) {
  const buffer = fs.readFileSync(path.join(SAIDA, origem));
  for (const largura of larguras) {
    await sharp(buffer, { density: 900 })
      .resize({ width: largura })
      .png({ compressionLevel: 9 })
      .toFile(path.join(SAIDA, "png", `${base}-${largura}.png`));
  }
}

const socialSvg = fs.readFileSync(path.join(SAIDA, "elora-compartilhamento.svg"));
await sharp(socialSvg, { density: 300 })
  .resize({ width: 1200, height: 630 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(SAIDA, "png", "elora-compartilhamento-1200x630.png"));

/**
 * Os dois arquivos que o Next serve por convenção de nome.
 *
 * `apple-icon.png` vira o ícone da tela de início do iOS; `opengraph-image.png`
 * vira a `og:image` de todo o site. Ficam em `app/`, não em `public/marca/`,
 * porque é o nome do arquivo naquele diretório que os liga às tags — mover
 * qualquer um deles os desliga em silêncio.
 */
await sharp(fs.readFileSync(path.join(SAIDA, "elora-selo.svg")), { density: 900 })
  .resize({ width: 180, height: 180 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(RAIZ, "apps/web/src/app/apple-icon.png"));

await sharp(socialSvg, { density: 300 })
  .resize({ width: 1200, height: 630 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(RAIZ, "apps/web/src/app/opengraph-image.png"));

console.log(`logotipo ${LARGURA} × 24 · vão ${VAO.toFixed(3)} · corpo ${CORPO.toFixed(3)}`);
console.log(
  `${Object.keys(arquivos).length} SVG e ${fs.readdirSync(path.join(SAIDA, "png")).length} PNG em apps/web/public/marca`,
);
console.log("apple-icon.png e opengraph-image.png atualizados em apps/web/src/app");
