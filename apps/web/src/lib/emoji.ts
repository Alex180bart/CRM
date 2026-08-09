/**
 * Catálogo de emojis do compositor.
 *
 * É uma lista curada, não o Unicode inteiro. Duas razões: um conjunto completo
 * (mais de 3.700 caracteres) exigiria dependência externa e rolagem infinita
 * para achar o que o atendimento realmente usa; e a busca em português é o que
 * decide a velocidade — "polegar", "aperto de mão", "gráfico" e "prazo" são
 * como um atendente brasileiro pensa, não "thumbs up".
 *
 * A primeira categoria é a do ofício: documento, dinheiro, calendário e sinal de
 * atenção aparecem mais num CRM de contabilidade que qualquer carinha.
 */

export interface EmojiEntry {
  char: string;
  /** Termos de busca em português, separados por espaço. */
  keywords: string;
}

export interface EmojiGroup {
  id: string;
  label: string;
  /** Emoji que representa a categoria na barra de abas. */
  icon: string;
  emojis: EmojiEntry[];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "trabalho",
    label: "Trabalho",
    icon: "📄",
    emojis: [
      { char: "📄", keywords: "documento pagina arquivo folha nota" },
      { char: "📃", keywords: "documento enrolado pagina texto" },
      { char: "📑", keywords: "marcador aba separador indice" },
      { char: "📋", keywords: "prancheta checklist lista area transferencia" },
      { char: "📊", keywords: "grafico barras relatorio analise dados" },
      { char: "📈", keywords: "grafico subindo alta crescimento aumento lucro" },
      { char: "📉", keywords: "grafico caindo queda baixa prejuizo reducao" },
      { char: "🧾", keywords: "recibo nota fiscal comprovante cupom" },
      { char: "💰", keywords: "dinheiro saco grana valor faturamento" },
      { char: "💵", keywords: "dinheiro nota cedula pagamento" },
      { char: "💳", keywords: "cartao credito debito pagamento" },
      { char: "🏦", keywords: "banco agencia financeiro" },
      { char: "🧮", keywords: "calculadora abaco calculo conta soma" },
      { char: "📅", keywords: "calendario data prazo agenda mes" },
      { char: "📆", keywords: "calendario data prazo dia" },
      { char: "⏰", keywords: "despertador alarme prazo hora urgente" },
      { char: "⏳", keywords: "ampulheta aguardando prazo espera tempo" },
      { char: "📌", keywords: "alfinete fixar importante marcar" },
      { char: "📎", keywords: "clipe anexo arquivo prender" },
      { char: "🗂️", keywords: "pasta arquivo organizacao divisoria" },
      { char: "📁", keywords: "pasta arquivo diretorio" },
      { char: "🗃️", keywords: "arquivo caixa fichario" },
      { char: "✏️", keywords: "lapis escrever anotar editar" },
      { char: "🖊️", keywords: "caneta assinar escrever" },
      { char: "✍️", keywords: "escrevendo assinatura assinar mao" },
      { char: "📝", keywords: "anotacao memorando nota escrever formulario" },
      { char: "🖨️", keywords: "impressora imprimir" },
      { char: "💻", keywords: "notebook computador laptop sistema" },
      { char: "📧", keywords: "email correio mensagem enviar" },
      { char: "📤", keywords: "enviado caixa saida envio" },
      { char: "📥", keywords: "recebido caixa entrada" },
      { char: "🔍", keywords: "lupa buscar procurar verificar analisar" },
      { char: "🏢", keywords: "empresa predio escritorio cnpj" },
      { char: "🤝", keywords: "aperto de mao acordo negocio parceria fechado" },
      { char: "⚖️", keywords: "balanca justica juridico lei equilibrio" },
      { char: "🔐", keywords: "cadeado chave seguranca acesso senha" },
      { char: "🖇️", keywords: "clipes anexos prender documentos" },
      { char: "🗓️", keywords: "calendario planejamento agenda" },
    ],
  },
  {
    id: "sinais",
    label: "Sinais",
    icon: "✅",
    emojis: [
      { char: "✅", keywords: "certo ok concluido feito aprovado verde" },
      { char: "☑️", keywords: "marcado caixa selecionado feito" },
      { char: "✔️", keywords: "certo confirmado visto" },
      { char: "❌", keywords: "errado nao cancelar remover reprovado" },
      { char: "❎", keywords: "errado nao cancelar" },
      { char: "⚠️", keywords: "atencao alerta cuidado aviso risco" },
      { char: "🚨", keywords: "alerta urgente sirene emergencia critico" },
      { char: "🔴", keywords: "vermelho bolinha parado critico" },
      { char: "🟡", keywords: "amarelo bolinha atencao andamento" },
      { char: "🟢", keywords: "verde bolinha ok liberado" },
      { char: "🔵", keywords: "azul bolinha informacao" },
      { char: "❗", keywords: "exclamacao importante atencao" },
      { char: "❓", keywords: "interrogacao duvida pergunta" },
      { char: "💡", keywords: "ideia lampada sugestao dica solucao" },
      { char: "📢", keywords: "aviso megafone anuncio comunicado" },
      { char: "🔔", keywords: "sino notificacao aviso lembrete" },
      { char: "🔕", keywords: "sino silenciado sem notificacao" },
      { char: "➡️", keywords: "seta direita proximo seguinte" },
      { char: "⬅️", keywords: "seta esquerda voltar anterior" },
      { char: "🔄", keywords: "atualizar recarregar repetir ciclo processar" },
      { char: "🔁", keywords: "repetir loop recorrente" },
      { char: "⭐", keywords: "estrela favorito destaque avaliacao" },
      { char: "🌟", keywords: "estrela brilho destaque especial" },
      { char: "🏆", keywords: "trofeu vitoria meta conquista premio" },
      { char: "🎯", keywords: "alvo meta objetivo foco" },
      { char: "🔥", keywords: "fogo urgente quente bombando" },
      { char: "💯", keywords: "cem completo perfeito total" },
      { char: "🆗", keywords: "ok certo tudo bem" },
      { char: "🆙", keywords: "atualizado novo up" },
      { char: "🔒", keywords: "cadeado fechado bloqueado seguro" },
      { char: "🔓", keywords: "cadeado aberto desbloqueado liberado" },
      { char: "♻️", keywords: "reciclar reprocessar refazer" },
      { char: "🚫", keywords: "proibido bloqueado nao permitido" },
      { char: "⛔", keywords: "proibido pare bloqueado" },
    ],
  },
  {
    id: "rostos",
    label: "Rostos",
    icon: "🙂",
    emojis: [
      { char: "😀", keywords: "sorriso feliz alegre" },
      { char: "😃", keywords: "sorriso feliz animado" },
      { char: "😄", keywords: "sorriso rindo feliz" },
      { char: "😁", keywords: "sorriso dentes empolgado" },
      { char: "😆", keywords: "rindo gargalhada engracado" },
      { char: "😅", keywords: "rindo suando alivio ufa" },
      { char: "😂", keywords: "chorando de rir engracado gargalhada" },
      { char: "🤣", keywords: "rolando de rir gargalhada engracado" },
      { char: "🙂", keywords: "sorriso leve simpatico cordial" },
      { char: "🙃", keywords: "de cabeca para baixo ironia" },
      { char: "😉", keywords: "piscada combinado" },
      { char: "😊", keywords: "sorriso timido gentil agradecido" },
      { char: "😇", keywords: "anjo inocente santo" },
      { char: "🥰", keywords: "apaixonado carinho amor" },
      { char: "😍", keywords: "encantado amor olhos de coracao" },
      { char: "😘", keywords: "beijo carinho" },
      { char: "😋", keywords: "delicia saboroso lambendo" },
      { char: "😎", keywords: "oculos escuros tranquilo estiloso" },
      { char: "🤓", keywords: "nerd estudioso oculos" },
      { char: "🧐", keywords: "monoculo analisando investigando" },
      { char: "🤔", keywords: "pensando duvida analisando hmm" },
      { char: "🤨", keywords: "sobrancelha erguida desconfiado estranho" },
      { char: "😐", keywords: "neutro sem expressao indiferente" },
      { char: "😑", keywords: "sem expressao impaciente" },
      { char: "😶", keywords: "sem boca calado sem palavras" },
      { char: "🙄", keywords: "revirando os olhos impaciente" },
      { char: "😏", keywords: "sorriso de canto malicioso" },
      { char: "😬", keywords: "constrangido nervoso desconforto" },
      { char: "😮", keywords: "surpreso boca aberta" },
      { char: "😲", keywords: "espantado chocado surpreso" },
      { char: "🤯", keywords: "cabeca explodindo chocado impressionado" },
      { char: "😳", keywords: "corado envergonhado surpreso" },
      { char: "🥺", keywords: "suplicante por favor pedido" },
      { char: "😢", keywords: "triste chorando lagrima" },
      { char: "😭", keywords: "chorando muito desespero" },
      { char: "😞", keywords: "desapontado triste" },
      { char: "😔", keywords: "cabeca baixa triste chateado" },
      { char: "😟", keywords: "preocupado apreensivo" },
      { char: "😥", keywords: "aliviado triste suando" },
      { char: "😓", keywords: "cansado suando exausto" },
      { char: "😩", keywords: "exausto cansado desesperado" },
      { char: "😫", keywords: "cansado esgotado" },
      { char: "🥵", keywords: "calor sobrecarregado quente" },
      { char: "😤", keywords: "bufando irritado determinado" },
      { char: "😠", keywords: "irritado bravo raiva" },
      { char: "😡", keywords: "furioso muito bravo raiva" },
      { char: "🤬", keywords: "praguejando furioso xingando" },
      { char: "😱", keywords: "grito medo pavor susto" },
      { char: "😨", keywords: "assustado medo" },
      { char: "😰", keywords: "ansioso nervoso suando" },
      { char: "🤗", keywords: "abraco acolhimento carinho" },
      { char: "🤩", keywords: "estrelas nos olhos maravilhado" },
      { char: "😴", keywords: "dormindo sono" },
      { char: "🤒", keywords: "doente febre termometro" },
      { char: "🤧", keywords: "espirro resfriado gripe" },
      { char: "😷", keywords: "mascara doente protecao" },
      { char: "🥳", keywords: "festa comemoracao celebrando" },
      { char: "🫡", keywords: "saudacao militar entendido as ordens" },
      { char: "🫠", keywords: "derretendo cansado sobrecarregado" },
      { char: "🙏", keywords: "obrigado por favor oracao agradecido" },
    ],
  },
  {
    id: "gestos",
    label: "Gestos",
    icon: "👍",
    emojis: [
      { char: "👍", keywords: "polegar positivo curti aprovado ok legal" },
      { char: "👎", keywords: "polegar negativo nao curti reprovado" },
      { char: "👌", keywords: "ok perfeito certo" },
      { char: "🤌", keywords: "mao italiana gesto" },
      { char: "✌️", keywords: "paz vitoria dois" },
      { char: "🤞", keywords: "dedos cruzados torcendo esperanca" },
      { char: "🤙", keywords: "me liga chamar" },
      { char: "👊", keywords: "soco cumprimento punho" },
      { char: "👋", keywords: "tchau ola oi acenar saudacao" },
      { char: "🖐️", keywords: "mao aberta cinco pare" },
      { char: "✋", keywords: "mao levantada pare espere" },
      { char: "👏", keywords: "palmas aplausos parabens" },
      { char: "🙌", keywords: "maos para cima comemoracao aleluia" },
      { char: "👐", keywords: "maos abertas acolhida" },
      { char: "🤲", keywords: "maos juntas pedido oferta" },
      { char: "💪", keywords: "forca musculo firme aguenta" },
      { char: "👇", keywords: "aponta para baixo abaixo veja" },
      { char: "👆", keywords: "aponta para cima acima veja" },
      { char: "👉", keywords: "aponta direita atencao aqui" },
      { char: "👈", keywords: "aponta esquerda" },
      { char: "☝️", keywords: "dedo para cima atencao um ponto" },
      { char: "✊", keywords: "punho firme forca" },
      { char: "🫶", keywords: "coracao com as maos carinho" },
      { char: "❤️", keywords: "coracao amor carinho vermelho" },
      { char: "🧡", keywords: "coracao laranja carinho" },
      { char: "💙", keywords: "coracao azul carinho" },
      { char: "💚", keywords: "coracao verde carinho" },
      { char: "💜", keywords: "coracao roxo carinho" },
      { char: "🤍", keywords: "coracao branco carinho" },
      { char: "💛", keywords: "coracao amarelo carinho" },
      { char: "💔", keywords: "coracao partido triste" },
      { char: "🫰", keywords: "dedos coracao dinheiro" },
      { char: "🤟", keywords: "te amo gesto mao" },
      { char: "🖖", keywords: "saudacao vulcano" },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    icon: "👥",
    emojis: [
      { char: "👤", keywords: "pessoa usuario contato perfil" },
      { char: "👥", keywords: "pessoas equipe time grupo" },
      { char: "🧑‍💼", keywords: "profissional escritorio funcionario" },
      { char: "👩‍💼", keywords: "profissional mulher escritorio gestora" },
      { char: "👨‍💼", keywords: "profissional homem escritorio gestor" },
      { char: "🧑‍💻", keywords: "tecnologia programador suporte" },
      { char: "👩‍⚕️", keywords: "medica saude clinica" },
      { char: "👨‍⚕️", keywords: "medico saude clinica" },
      { char: "🧑‍🏫", keywords: "professor aula curso instrutor" },
      { char: "🧑‍🎓", keywords: "aluno estudante formando curso" },
      { char: "🧑‍🔧", keywords: "tecnico manutencao oficina" },
      { char: "🧑‍🍳", keywords: "cozinheiro restaurante" },
      { char: "👮", keywords: "policia fiscalizacao autoridade" },
      { char: "🕵️", keywords: "investigador auditoria apuracao" },
      { char: "🧑‍⚖️", keywords: "juiz juridico processo" },
      { char: "🤵", keywords: "formal terno cerimonia" },
      { char: "🙋", keywords: "levantando a mao voluntario duvida" },
      { char: "🙅", keywords: "nao pode negativo proibido" },
      { char: "🤦", keywords: "mao na testa incredulo desanimo" },
      { char: "🤷", keywords: "ombros nao sei duvida" },
      { char: "💁", keywords: "informacao atendimento apontando" },
      { char: "🧑‍🤝‍🧑", keywords: "parceria socios juntos" },
    ],
  },
  {
    id: "objetos",
    label: "Objetos",
    icon: "📱",
    emojis: [
      { char: "📱", keywords: "celular telefone whatsapp movel" },
      { char: "☎️", keywords: "telefone ligacao fixo" },
      { char: "📞", keywords: "telefone ligar chamada" },
      { char: "📲", keywords: "celular chamada whatsapp receber" },
      { char: "💬", keywords: "balao mensagem conversa chat" },
      { char: "🗨️", keywords: "balao fala comentario" },
      { char: "💭", keywords: "pensamento ideia balao" },
      { char: "🔗", keywords: "link corrente url endereco" },
      { char: "📡", keywords: "antena integracao sinal transmissao" },
      { char: "⚙️", keywords: "engrenagem configuracao ajuste automacao" },
      { char: "🔧", keywords: "chave inglesa ajuste correcao" },
      { char: "🛠️", keywords: "ferramentas manutencao correcao" },
      { char: "🧰", keywords: "caixa de ferramentas manutencao" },
      { char: "🔑", keywords: "chave acesso senha credencial" },
      { char: "🗝️", keywords: "chave antiga acesso" },
      { char: "📦", keywords: "caixa pacote produto entrega estoque" },
      { char: "🏷️", keywords: "etiqueta tag rotulo preco" },
      { char: "🛒", keywords: "carrinho compra pedido" },
      { char: "🧑‍🚀", keywords: "lancamento novo projeto" },
      { char: "🚀", keywords: "foguete lancamento rapido crescimento" },
      { char: "⚡", keywords: "raio rapido energia instantaneo" },
      { char: "🖥️", keywords: "monitor computador sistema" },
      { char: "⌨️", keywords: "teclado digitar" },
      { char: "🖱️", keywords: "mouse clique" },
      { char: "💾", keywords: "salvar disquete backup" },
      { char: "☁️", keywords: "nuvem cloud armazenamento" },
      { char: "🔋", keywords: "bateria energia carga" },
      { char: "📷", keywords: "camera foto print imagem" },
      { char: "🎥", keywords: "video filmagem gravacao" },
      { char: "🎧", keywords: "fone audio escutar" },
      { char: "🎙️", keywords: "microfone audio gravar podcast" },
      { char: "📺", keywords: "televisao tela transmissao" },
      { char: "🔖", keywords: "marcador salvar favorito" },
      { char: "📚", keywords: "livros estudo material curso" },
      { char: "📖", keywords: "livro aberto leitura manual" },
      { char: "🗒️", keywords: "bloco notas anotacao" },
      { char: "🗑️", keywords: "lixeira excluir remover descartar" },
    ],
  },
  {
    id: "diversos",
    label: "Diversos",
    icon: "🎉",
    emojis: [
      { char: "🎉", keywords: "festa comemoracao parabens celebrar" },
      { char: "🎊", keywords: "confete festa comemoracao" },
      { char: "🎈", keywords: "balao festa aniversario" },
      { char: "🎁", keywords: "presente brinde bonus" },
      { char: "🎂", keywords: "bolo aniversario parabens" },
      { char: "☕", keywords: "cafe pausa manha" },
      { char: "🍵", keywords: "cha pausa calma" },
      { char: "🥂", keywords: "brinde comemoracao sucesso" },
      { char: "🍻", keywords: "brinde cerveja comemoracao" },
      { char: "🍽️", keywords: "almoco refeicao intervalo" },
      { char: "🍕", keywords: "pizza comida almoco" },
      { char: "🍔", keywords: "hamburguer comida lanche" },
      { char: "🌞", keywords: "sol bom dia manha" },
      { char: "🌤️", keywords: "sol nuvem tempo dia" },
      { char: "🌧️", keywords: "chuva tempo" },
      { char: "🌙", keywords: "lua noite boa noite" },
      { char: "🌱", keywords: "muda crescimento comeco novo" },
      { char: "🌳", keywords: "arvore natureza sustentavel" },
      { char: "🌸", keywords: "flor primavera delicado" },
      { char: "🐶", keywords: "cachorro pet animal" },
      { char: "🐱", keywords: "gato pet animal" },
      { char: "✈️", keywords: "aviao viagem voo" },
      { char: "🚗", keywords: "carro veiculo transporte frota" },
      { char: "🚚", keywords: "caminhao entrega transporte frete" },
      { char: "🏠", keywords: "casa residencia endereco" },
      { char: "🌎", keywords: "mundo global internacional exterior" },
      { char: "📍", keywords: "localizacao endereco mapa ponto" },
      { char: "🗺️", keywords: "mapa localizacao regiao" },
      { char: "🎓", keywords: "formatura curso certificado diploma" },
      { char: "🏅", keywords: "medalha reconhecimento premio" },
      { char: "🎵", keywords: "musica audio nota" },
      { char: "🧩", keywords: "peca quebra cabeca encaixe solucao" },
      { char: "🕐", keywords: "relogio hora tempo" },
      { char: "☀️", keywords: "sol claro dia" },
    ],
  },
];

const RECENTS_KEY = "elora:emoji-recentes";
const MAX_RECENTS = 24;

/**
 * Os recentes ficam no navegador, e não no perfil do usuário, porque preferência
 * de digitação não justifica ida ao servidor a cada clique. Quando houver
 * back-end, isto pode virar preferência sincronizada — sem mudar a interface.
 */
export function readRecentEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENTS);
  } catch {
    // Armazenamento bloqueado ou corrompido não pode impedir o atendente de digitar.
    return [];
  }
}

export function pushRecentEmoji(char: string): string[] {
  const next = [char, ...readRecentEmojis().filter((item) => item !== char)].slice(0, MAX_RECENTS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // Modo privado sem cota: perder o histórico é aceitável, quebrar não é.
    }
  }
  return next;
}

const ALL_EMOJIS: EmojiEntry[] = EMOJI_GROUPS.flatMap((group) => group.emojis);

/**
 * Normaliza acento para que "coração" e "coracao" encontrem a mesma coisa.
 *
 * `NFD` separa a letra do acento e a classe Unicode `Mn` (marca sem avanço)
 * remove o que sobrou. É a forma legível: uma faixa escrita à mão traria
 * caracteres combinantes invisíveis no meio do código-fonte.
 */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");
}

export function searchEmojis(term: string, limit = 60): EmojiEntry[] {
  const needle = fold(term.trim());
  if (!needle) return [];

  const starts: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];

  for (const entry of ALL_EMOJIS) {
    const words = fold(entry.keywords).split(/\s+/);
    // Palavra que começa com o termo vale mais: quem digita "pol" quer
    // "polegar", não "protocolo" só porque contém as letras.
    if (words.some((word) => word.startsWith(needle))) starts.push(entry);
    else if (fold(entry.keywords).includes(needle)) contains.push(entry);

    if (starts.length >= limit) break;
  }

  return [...starts, ...contains].slice(0, limit);
}

export function findEmoji(char: string): EmojiEntry | undefined {
  return ALL_EMOJIS.find((entry) => entry.char === char);
}
