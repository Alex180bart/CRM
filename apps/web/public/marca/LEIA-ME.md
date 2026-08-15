# Marca Elora — arquivos soltos

Gerados por `scripts/gerar-marca.mjs` a partir do desenho de
`apps/web/src/components/shell/logo.tsx`. **Não edite nada aqui à mão**: a
próxima execução do script sobrescreve, e a alteração perdida seria justamente a
que alguém fez com pressa antes de uma reunião.

Para mudar a marca, mude o componente e rode:

```bash
npm i --no-save --prefix scripts opentype.js sharp   # só na primeira vez
node scripts/gerar-marca.mjs
```

## Dentro do produto, use o componente

`LogoMark` e `LogoWordmark` herdam cor de token, funcionam nos dois temas e
acompanham a troca de paleta da organização de graça. Estes arquivos têm a cor
**fixa** — usá-los numa tela do produto traz de volta exatamente o defeito que
derrubou o PNG anterior: o logotipo some quando o fundo muda.

Estes arquivos servem ao que está **fora** do aplicativo: apresentação,
proposta, assinatura de e-mail, avatar de rede social, papel, brinde.

## Qual escolher

| Arquivo                      | Quando                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| `elora-logo.svg`             | Fundo claro. É o padrão — use este se estiver em dúvida.    |
| `elora-logo-claro.svg`       | Fundo escuro ou foto escura.                                |
| `elora-logo-mono.svg`        | Uma cor só: gravação, bordado, fax, carimbo, marca d'água.  |
| `elora-simbolo*.svg`         | Só o símbolo, onde o nome já aparece ao lado ou não cabe.   |
| `elora-selo.svg`             | Imagem quadrada: avatar de rede, WhatsApp Business, perfil. |
| `elora-compartilhamento.svg` | Prévia de link. Já está aplicada no site.                   |

O monocromático usa `currentColor`: herda a cor de quem o desenha. Num editor
que não resolve isso, ele aparece preto — troque o valor no arquivo, é um
atributo só.

## PNG

Em `png/`, para onde SVG não entra. Fundo transparente, exceto o selo e a imagem
de compartilhamento.

Escolha o tamanho **acima** do que precisa e deixe a ferramenta reduzir; ampliar
PNG borra, e o símbolo tem traço fino. Precisando de um tamanho que não está
aqui, gere do SVG em vez de esticar um PNG.

## As duas peças do site não vivem aqui

`apple-icon.png` e `opengraph-image.png` ficam em `apps/web/src/app/`, porque é o
**nome do arquivo naquele diretório** que o Next usa para emitir as tags. Movê-los
para cá os desliga em silêncio: o site continua no ar, e a prévia do link some.
O mesmo vale para `icon.svg`, o ícone da aba.

## Cores

| Papel            | Valor     | Token       |
| ---------------- | --------- | ----------- |
| Índigo principal | `#1E1B4B` | `--primary` |
| Âmbar (acento)   | `#DC8F09` | `--accent`  |
| Branco           | `#FFFFFF` | superfícies |

O âmbar é `#DC8F09`, não `#F59E0B`. Os dois já conviveram no repositório por
engano, e o segundo é cinco pontos mais claro — confira antes de copiar de
qualquer arquivo antigo.

## O desenho

Um anel que não se fecha, e a abertura é preenchida pelas três hastes do E: diz
"elo" e "Elora" na mesma forma. A haste do meio leva o acento, e é a única peça
em âmbar — a regra de "um acento por tela" aplicada à própria marca.

O nome está em contorno, não em texto. Fora do site a fonte Sora não existe, e um
editor sem ela cairia numa substituta.
