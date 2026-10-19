// Loja: bordas e efeitos para as capas dos mangas favoritos, pagas com dinheiro de verdade pelo Mercado Pago (Checkout Pro:
// Pix ou cartao, na pagina do proprio Mercado Pago). O site nunca ve os dados do cartao.
//
// Como uma compra anda:
// 1. POST /api/loja/comprar: o servidor cria a compra (pendente), com o preco daqui (nunca o que o navegador manda), e
//    pede ao Mercado Pago uma "preferencia" de pagamento com external_reference = id da compra. Devolve o endereco do
//    pagamento, e o site leva a pessoa ate la.
// 2. O Mercado Pago avisa em POST /api/loja/webhook. O aviso so diz o numero do pagamento: o servidor busca o pagamento
//    na API do Mercado Pago com o token secreto (a unica fonte de verdade) e, aprovado com o valor e a moeda certos,
//    poe a borda na mochila. Reembolso ou estorno tiram a borda de novo.
// 3. Ao voltar do Mercado Pago, o site pergunta GET /api/loja/compras/{id}, que tambem confere no Mercado Pago: a
//    borda aparece mesmo se o aviso atrasar.
//
// Variaveis de ambiente (no Vercel):
// - MERCADOPAGO_ACCESS_TOKEN: o "Access Token" das credenciais (TEST-... para testar, APP_USR-... para valer);
// - MERCADOPAGO_WEBHOOK_SECRET: a "assinatura secreta" dos avisos (Webhooks), para conferir que o aviso veio dele.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/** Precos, em centavos: cada borda e cada efeito. */
export const PRECO_DA_BORDA = 450;
export const PRECO_DO_EFEITO = 250;
export const PRECO_DO_TEMA = 500;
export const PRECO_DO_TEMA_ANIMADO = 750;

/*
 * Roleta (doc 115): um giro sorteia um item da loja que a pessoa ainda nao tem. Toda conta ganha um giro de graca; os
 * outros custam R$ 5,00 cada, comprados de 1 a 3 por vez (e girados ate 3 ao mesmo tempo). O tipo do item sai pelos
 * pesos (borda 5, efeito 3, tema 1: 55,6%, 33,3% e 11,1%); um tipo que a pessoa ja tem inteiro sai da conta, e os pesos
 * dos outros se dividem de novo. Dentro do tipo, qualquer item que falta, com a mesma chance. Nunca sai repetido.
 */
export const PRECO_DO_GIRO = 500;
export const GIROS_POR_VEZ = 3;
export const PESOS_DA_ROLETA = { borda: 5, efeito: 3, tema: 1 };

/** Os giros de uma compra da roleta ('giros-2' = 2 giros); 0 se a compra e de um item. */
export function girosDaCompra(item) {
    const encontrado = /^giros-([1-9])$/.exec(item || '');
    return encontrado && Number(encontrado[1]) <= GIROS_POR_VEZ ? Number(encontrado[1]) : 0;
}

/** A chance de cada tipo (de 0 a 1), so entre os tipos que ainda tem item para sair. */
export function chancesDaRoleta(disponiveis) {
    const tipos = Object.keys(PESOS_DA_ROLETA).filter(tipo => disponiveis.some(item => item.tipo === tipo));
    const total = tipos.reduce((soma, tipo) => soma + PESOS_DA_ROLETA[tipo], 0);
    return Object.fromEntries(tipos.map(tipo => [tipo, PESOS_DA_ROLETA[tipo] / total]));
}

/** Sorteia um item entre os disponiveis: primeiro o tipo, pelos pesos; depois o item, por igual. */
export function sortearDaRoleta(disponiveis, aleatorio = Math.random) {
    const chances = chancesDaRoleta(disponiveis);
    const tipos = Object.keys(chances);
    if (!tipos.length) return null;
    let sorteio = aleatorio();
    const tipo = tipos.find(t => (sorteio -= chances[t]) < 0) || tipos.at(-1);
    const doTipo = disponiveis.filter(item => item.tipo === tipo);
    return doTipo[Math.min(doTipo.length - 1, Math.floor(aleatorio() * doTipo.length))];
}

/**
 * O que a loja vende. O id vira a classe "borda-{id}" ou "efeito-{id}" das capas (app.css). A pessoa equipa uma borda
 * e um efeito ao mesmo tempo; sem nenhum, a borda roxa e o brilho de sempre.
 */
export const ITENS_DA_LOJA = [
    { id: 'dourada', tipo: 'borda', nome: 'Ouro Lendário', descricao: 'Moldura de ouro polido com um brilho que passa de tempos em tempos.', preco: PRECO_DA_BORDA },
    { id: 'neon', tipo: 'borda', nome: 'Neon', descricao: 'Ciano e rosa elétrico, com um brilho que pulsa em volta da capa.', preco: PRECO_DA_BORDA },
    { id: 'sakura', tipo: 'borda', nome: 'Sakura', descricao: 'Rosa das cerejeiras, com uma flor no lugar da estrela.', preco: PRECO_DA_BORDA },
    { id: 'chamas', tipo: 'borda', nome: 'Chamas', descricao: 'Fogo que corre pela borda, do vermelho ao amarelo.', preco: PRECO_DA_BORDA },
    { id: 'galaxia', tipo: 'borda', nome: 'Galáxia', descricao: 'Azul e roxo do espaço, com estrelas piscando na moldura.', preco: PRECO_DA_BORDA },
    { id: 'cristal', tipo: 'borda', nome: 'Cristal', descricao: 'Cristais de gelo e prismas congelados que reluzem com a luz.', preco: PRECO_DA_BORDA },
    { id: 'cyberpunk', tipo: 'borda', nome: 'Cyberpunk', descricao: 'Moldura de circuitos com luzes em neon verde e roxo que correm pela borda.', preco: PRECO_DA_BORDA },
    { id: 'abissal', tipo: 'borda', nome: 'Abissal', descricao: 'Correntes de água profunda e bolhas bioluminescentes subindo.', preco: PRECO_DA_BORDA },
    { id: 'sombrio', tipo: 'borda', nome: 'Sombrio', descricao: 'Névoa mística e escuridão em volta, com fragmentos de energia.', preco: PRECO_DA_BORDA },
    { id: 'floresta', tipo: 'borda', nome: 'Floresta', descricao: 'Vinhas com folhas balançando e vaga-lumes da mata.', preco: PRECO_DA_BORDA },
    { id: 'eletrico', tipo: 'borda', nome: 'Elétrico', descricao: 'Descargas elétricas e raios de alta voltagem em volta da capa.', preco: PRECO_DA_BORDA },
    { id: 'arcano', tipo: 'borda', nome: 'Arcano', descricao: 'Moldura de prata com cantos dourados e runas antigas que brilham.', preco: PRECO_DA_BORDA },
    { id: 'celestial', tipo: 'borda', nome: 'Celestial', descricao: 'Moldura dourada com arabescos, runas azuis brilhando e uma estrela com a lua no canto.', preco: PRECO_DA_BORDA },
    { id: 'boreal', tipo: 'borda', nome: 'Aurora Boreal', descricao: 'Luzes verdes, azuis e violeta que correm devagar em volta da capa, com um brilho suave por fora.', preco: PRECO_DA_BORDA },
    { id: 'eclipse', tipo: 'borda', nome: 'Eclipse', descricao: 'Moldura de obsidiana com um ponto de luz dourada que dá a volta, e um anel de diamante que faísca no canto.', preco: PRECO_DA_BORDA },
    { id: 'reliquia', tipo: 'borda', nome: 'Relíquia', descricao: 'Moldura antiga de bronze, gasta pelo tempo, com runas gravadas e o sol e a lua no canto.', preco: PRECO_DA_BORDA },
    { id: 'elfica', tipo: 'borda', nome: 'Bosque Élfico', descricao: 'Moldura de madeira com vinhas, flores, runas verdes acesas e uma esmeralda no canto.', preco: PRECO_DA_BORDA },
    { id: 'inferno', tipo: 'borda', nome: 'Portão do Inferno', descricao: 'Pedra escura com lava nas rachaduras, correntes e um demônio de olhos em brasa no canto.', preco: PRECO_DA_BORDA },
    { id: 'holografico', tipo: 'efeito', nome: 'Holográfico', descricao: 'Um reflexo de arco-íris que atravessa a capa, como uma carta rara.', preco: PRECO_DO_EFEITO },
    { id: 'faiscas', tipo: 'efeito', nome: 'Faíscas', descricao: 'Estrelinhas que acendem e apagam em cima da capa.', preco: PRECO_DO_EFEITO },
    { id: 'neve', tipo: 'efeito', nome: 'Neve', descricao: 'Flocos de neve caindo devagar sobre a capa.', preco: PRECO_DO_EFEITO },
    { id: 'raios', tipo: 'efeito', nome: 'Raios', descricao: 'Clarões elétricos azuis que piscam nas bordas da capa.', preco: PRECO_DO_EFEITO },
    { id: 'aura', tipo: 'efeito', nome: 'Aura', descricao: 'Uma luz que pulsa de dentro da capa, mudando de cor.', preco: PRECO_DO_EFEITO },
    { id: 'brasas', tipo: 'efeito', nome: 'Brasas', descricao: 'Brasas acesas subindo pela capa, com um calor que vem de baixo.', preco: PRECO_DO_EFEITO },
    { id: 'chuva', tipo: 'efeito', nome: 'Chuva', descricao: 'Uma chuva fina caindo na diagonal sobre a capa.', preco: PRECO_DO_EFEITO },
    { id: 'coracoes', tipo: 'efeito', nome: 'Corações', descricao: 'Coraçõezinhos subindo e sumindo, para os mangás do coração.', preco: PRECO_DO_EFEITO },
    { id: 'glitch', tipo: 'efeito', nome: 'Glitch', descricao: 'Faixas de cor que tremem e pulam, como uma tela com defeito.', preco: PRECO_DO_EFEITO },
    { id: 'crt', tipo: 'efeito', nome: 'Tela CRT', descricao: 'As linhas de uma TV antiga, com uma faixa de luz passando de cima para baixo.', preco: PRECO_DO_EFEITO },
    { id: 'confete', tipo: 'efeito', nome: 'Confete', descricao: 'Confetes coloridos caindo sem parar, para comemorar.', preco: PRECO_DO_EFEITO },
    { id: 'reticula', tipo: 'efeito', nome: 'Retícula', descricao: 'Os pontinhos da impressão de mangá surgindo dos cantos, como uma sombra de retícula que respira.', preco: PRECO_DO_EFEITO },
    { id: 'foco', tipo: 'efeito', nome: 'Linhas de Ação', descricao: 'As linhas de foco do anime nas beiradas, tremendo como se fossem desenhadas à mão. O meio fica limpo.', preco: PRECO_DO_EFEITO },
    { id: 'feixes', tipo: 'efeito', nome: 'Feixes de Luz', descricao: 'Raios de sol quentes entrando pelo canto de cima e balançando devagar, como luz pela janela.', preco: PRECO_DO_EFEITO },
    { id: 'verde', tipo: 'tema', nome: 'Verde pastel', descricao: 'O site todo em tons claros de verde-menta, leve para ler de dia.', preco: PRECO_DO_TEMA },
    { id: 'rosa', tipo: 'tema', nome: 'Rosa pastel', descricao: 'Rosa e lilás claros, com os painéis meio transparentes sobre um degradê.', preco: PRECO_DO_TEMA },
    { id: 'vermelho', tipo: 'tema', nome: 'Vermelho', descricao: 'Escuro, com detalhes em vermelho intenso.', preco: PRECO_DO_TEMA },
    { id: 'roxo', tipo: 'tema', nome: 'Roxo', descricao: 'Escuro, em tons de roxo e lavanda.', preco: PRECO_DO_TEMA },
    { id: 'cinza', tipo: 'tema', nome: 'Degradê cinza', descricao: 'Grafite em degradê, com os painéis meio transparentes e detalhes em prata.', preco: PRECO_DO_TEMA },
    { id: 'aurora', tipo: 'tema', nome: 'Aurora', descricao: 'Fundo animado: luzes verdes, azuis e roxas se mexendo devagar no escuro.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'estrelas', tipo: 'tema', nome: 'Noite estrelada', descricao: 'Fundo animado: um céu noturno com estrelas piscando.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'petalas', tipo: 'tema', nome: 'Sakura ao vento', descricao: 'Fundo animado: pétalas de cerejeira caindo sobre um rosa bem claro.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'cosmos', tipo: 'tema', nome: 'Galáxia', descricao: 'Fundo animado: nebulosas roxas, azuis e rosas girando devagar, com estrelas piscando.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'fazenda', tipo: 'tema', nome: 'Fazenda', descricao: 'Fundo animado: céu azul com nuvens passando, sol, morros verdes e uma cerca de madeira.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'synthwave', tipo: 'tema', nome: 'Synthwave', descricao: 'Fundo animado: sol retrô no horizonte e uma grade neon vindo na sua direção.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'entardecer', tipo: 'tema', nome: 'Entardecer', descricao: 'Fundo animado: o pôr do sol dos animes, com postes e fios contra o céu laranja e rosa, nuvens passando e um avião riscando o céu.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'matsuri', tipo: 'tema', nome: 'Festival de Verão', descricao: 'Fundo animado: uma noite de matsuri, com lanternas de papel acesas balançando e fogos de artifício abrindo ao longe.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'pagina', tipo: 'tema', nome: 'Página de Mangá', descricao: 'Fundo animado: o site vira uma página de mangá, com papel, tinta preta, quadrinhos, retícula e um ドキドキ batendo no canto.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'palacio', tipo: 'tema', nome: 'Palácio Zen', descricao: 'Fundo animado em vídeo: um palácio japonês sobre a água, bordos vermelhos e pássaros voando, numa pintura em tinta. Escurecido, para a leitura.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'kyoto', tipo: 'tema', nome: 'Primavera em Kyoto', descricao: 'Fundo animado em vídeo, em pixel art: uma cerejeira em flor ao lado de uma casinha japonesa, com lanternas, um cachorro dormindo e pétalas caindo. Tema claro, em creme e rosa.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
    { id: 'lamina', tipo: 'tema', nome: 'Lâmina Sombria', descricao: 'Fundo animado em vídeo, em preto e branco: uma espadachim na sombra, com a luz correndo pela lâmina da katana. Tema escuro, em aço e prata.', preco: PRECO_DO_TEMA_ANIMADO, animado: true },
];

/** Os temas de graca, que toda conta tem: o escuro (o de sempre) e o claro. Sem tema, o site segue o sistema. */
export const TEMAS_GRATIS = [
    { id: 'escuro', tipo: 'tema', nome: 'Escuro', descricao: 'O tema de sempre do Viracap. Vem com todas as contas.', preco: 0 },
    { id: 'claro', tipo: 'tema', nome: 'Claro', descricao: 'Fundo claro e letras escuras. Vem com todas as contas.', preco: 0 },
];

/**
 * O tema equipado, se ele ainda existe (na loja ou entre os de graca); senao, nulo (o Automatico). Um tema que saiu
 * da loja (como o Silhueta) nao fica preso na conta de quem o tinha equipado.
 */
export function temaQueExiste(id) {
    return [...ITENS_DA_LOJA, ...TEMAS_GRATIS].some(item => item.tipo === 'tema' && item.id === id) ? id : null;
}

/** A coluna de "contas" onde fica o item equipado de cada tipo. */
export const COLUNA_DO_TIPO = { borda: 'borda', efeito: 'efeito', tema: 'tema' };

export const itemDaLoja = id => ITENS_DA_LOJA.find(item => item.id === id) || null;

/** Tabelas da loja, criadas junto com as outras (so acrescenta). */
export const ESTRUTURA_DA_LOJA = `
    -- status: pendente, aprovada, recusada, reembolsada ou divergente (pago com valor ou moeda errados: nao entrega)
    CREATE TABLE IF NOT EXISTS compras (id UUID PRIMARY KEY, conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
        item TEXT NOT NULL, preco INT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', pagamento TEXT,
        criada_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS compras_conta ON compras (conta, criada_em DESC);
    -- as financas e o painel do dono contam as vendas por situacao e pelo mes em que foram aprovadas
    CREATE INDEX IF NOT EXISTS compras_situacao ON compras (status, atualizada_em);
    CREATE TABLE IF NOT EXISTS mochila (conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, item TEXT NOT NULL,
        compra UUID REFERENCES compras(id) ON DELETE SET NULL, obtido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (conta, item));
    -- as imagens dos itens que nao sao feitos so com CSS (a moldura da borda Celestial): ficam no banco, enviadas pela
    -- aba "Imagens da loja" do Gerenciar (so o dono do site) ou por ferramentas/imagens-da-loja.mjs
    CREATE TABLE IF NOT EXISTS imagens_da_loja (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL, tipo TEXT NOT NULL,
        tamanho INT NOT NULL, atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    -- a borda e o efeito equipados (nulos: a borda roxa e o brilho de sempre)
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS borda TEXT;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS efeito TEXT;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS tema TEXT;
    -- a roleta (doc 115): o giro de graca de cada conta, e quantos giros pagos de cada compra ainda nao foram usados
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS giro_gratis_usado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE compras ADD COLUMN IF NOT EXISTS giros_restantes INT NOT NULL DEFAULT 0;
`;

/**
 * Imagens (e videos) da loja: nome do arquivo (que o CSS e o site usam em /api/loja/imagens/{nome}), formatos e
 * tamanho maximo. Os videos (doc 108) sao os fundos dos temas em video; ate 3 MB, porque a funcao do Vercel nao devolve
 * mais que 4,5 MB.
 */
export const NOME_DA_IMAGEM = /^[a-z0-9][a-z0-9-]{0,58}\.(webp|png|gif|jpg|webm|mp4)$/;
const TIPO_DA_EXTENSAO = { webp: 'image/webp', png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', webm: 'video/webm', mp4: 'video/mp4' };
export const TAMANHO_MAXIMO_DA_IMAGEM_DA_LOJA = 3 * 1024 * 1024;

/**
 * O formato de verdade de uma imagem, pelos primeiros bytes (nao pelo nome): 'image/webp', 'image/png' (inclusive
 * APNG, a PNG animada) ou 'image/gif'. Nulo se nao for nenhum desses.
 */
export function formatoDaImagem(bytes) {
    const b = Buffer.from(bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
    if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))) return 'image/gif';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    // video: WebM (Matroska, que comeca com 1A 45 DF A3) e MP4 ("ftyp" a partir do 5o byte)
    if (b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
    if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
    return null;
}

/**
 * A resposta com um arquivo da loja. Imagens: guardadas por uma hora (trocar uma imagem com o mesmo nome aparece em
 * ate uma hora). Videos (doc 108): guardados por uma semana (o nome leva a versao, "palacio-zen-1.webm": um video novo
 * vai com outro nome), e com pedidos por pedaco (Range), que o Safari exige para tocar video.
 */
export function respostaDoArquivo(conteudo, tipo, range) {
    const bytes = Buffer.from(conteudo);
    const video = tipo.startsWith('video/');
    const cabecalhos = {
        'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
        'Cache-Control': video ? 'public, max-age=604800, s-maxage=604800, immutable' : 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    };
    const pedaco = /^bytes=(\d*)-(\d*)$/.exec(range || '');
    if (pedaco && (pedaco[1] || pedaco[2])) {
        let inicio = pedaco[1] ? Number(pedaco[1]) : bytes.length - Number(pedaco[2]);
        let fim = pedaco[1] && pedaco[2] ? Number(pedaco[2]) : bytes.length - 1;
        inicio = Math.max(0, inicio);
        fim = Math.min(fim, bytes.length - 1);
        if (inicio > fim || inicio >= bytes.length) {
            return new Response(null, { status: 416, headers: { ...cabecalhos, 'Content-Range': `bytes */${bytes.length}` } });
        }
        return new Response(bytes.subarray(inicio, fim + 1), { status: 206, headers: { ...cabecalhos, 'Content-Range': `bytes ${inicio}-${fim}/${bytes.length}`, 'Content-Length': String(fim - inicio + 1) } });
    }
    return new Response(bytes, { status: 200, headers: { ...cabecalhos, 'Content-Length': String(bytes.length) } });
}

/** A extensao do nome tem que bater com o formato de verdade. */
export function conferirImagemDaLoja(nome, bytes) {
    if (!NOME_DA_IMAGEM.test(nome || '')) {
        throw new ErroDaLoja(400, 'Nome inválido: use letras minúsculas, números e hífen, terminando em .webp, .png, .gif, .jpg, .webm ou .mp4 (ex.: celestial.webp)');
    }
    if (!bytes || bytes.length === 0) throw new ErroDaLoja(400, 'Envie o arquivo da imagem');
    if (bytes.length > TAMANHO_MAXIMO_DA_IMAGEM_DA_LOJA) throw new ErroDaLoja(413, 'O arquivo pode ter no máximo 3 MB');
    const tipo = formatoDaImagem(bytes);
    if (!tipo) throw new ErroDaLoja(400, 'O arquivo não é uma imagem WebP, PNG, GIF ou JPEG, nem um vídeo WebM ou MP4');
    const extensao = nome.slice(nome.lastIndexOf('.') + 1);
    if (tipo !== TIPO_DA_EXTENSAO[extensao]) throw new ErroDaLoja(400, `O arquivo é ${tipo.split('/')[1].toUpperCase()}, mas o nome termina em .${extensao}`);
    return tipo;
}

export class ErroDaLoja extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

const API = () => (process.env.MERCADOPAGO_API || 'https://api.mercadopago.com').replace(/\/$/, '');
export const pagamentoConfigurado = () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);

/** Uma chamada a API do Mercado Pago com o token secreto. */
async function mercadoPago(caminho, { metodo = 'GET', corpo, idempotencia } = {}) {
    const cabecalhos = { Authorization: 'Bearer ' + process.env.MERCADOPAGO_ACCESS_TOKEN };
    if (corpo) cabecalhos['Content-Type'] = 'application/json';
    // a mesma chave faz o Mercado Pago devolver a mesma resposta se o pedido for repetido
    if (idempotencia) cabecalhos['X-Idempotency-Key'] = idempotencia;
    const resposta = await fetch(API() + caminho, { method: metodo, headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(15_000) });
    const texto = await resposta.text();
    if (!resposta.ok) throw new Error(`Mercado Pago respondeu ${resposta.status} em ${caminho}: ${texto.slice(0, 300)}`);
    return texto ? JSON.parse(texto) : null;
}

/**
 * Confere a assinatura de um aviso (cabecalho x-signature "ts=...,v1=..."): HMAC-SHA256, com a assinatura secreta, de
 * "id:{data.id};request-id:{x-request-id};ts:{ts};". O id vai em minusculas, como o Mercado Pago manda conferir.
 */
export function assinaturaValida({ assinatura, requestId, dataId, segredo }) {
    if (!assinatura || !segredo) return false;
    const partes = Object.fromEntries(String(assinatura).split(',').map(parte => parte.trim().split('=').map(lado => lado.trim())));
    if (!partes.ts || !partes.v1) return false;
    let manifesto = '';
    if (dataId) manifesto += `id:${String(dataId).toLowerCase()};`;
    if (requestId) manifesto += `request-id:${requestId};`;
    manifesto += `ts:${partes.ts};`;
    const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');
    const recebido = String(partes.v1).toLowerCase();
    return esperado.length === recebido.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

/**
 * O que um pagamento do Mercado Pago significa para a compra: 'aprovada' (so com o valor e a moeda certos),
 * 'divergente' (aprovado, mas com valor ou moeda errados), 'reembolsada' (devolvido ou estornado), 'recusada'
 * (recusado ou cancelado) ou 'pendente' (esperando o Pix, em analise...).
 */
export function situacaoDoPagamento(pagamento, compra) {
    switch (pagamento?.status) {
    case 'approved': {
        const valorCerto = Math.round(Number(pagamento.transaction_amount) * 100) === compra.preco;
        return valorCerto && pagamento.currency_id === 'BRL' ? 'aprovada' : 'divergente';
    }
    case 'refunded':
    case 'charged_back':
        return 'reembolsada';
    case 'rejected':
    case 'cancelled':
        return 'recusada';
    default:
        return 'pendente';
    }
}

/** Quais mudancas de status valem: uma compra aprovada so muda para reembolsada; as outras nao voltam a ser pendentes. */
export function podeMudar(de, para) {
    if (de === para || para === 'pendente') return false;
    if (de === 'aprovada') return para === 'reembolsada';
    if (de === 'reembolsada' || de === 'divergente') return false;
    return true;
}

/**
 * @param f ferramentas do api/index.js: banco, json, Recusa, lerCorpo, semCache, ehDono
 */
export function criarLoja(f) {
    // o dono do site tem todos os itens, os de hoje e os que entrarem na loja depois, sem comprar
    const temTudo = eu => Boolean(f.ehDono?.(eu));

    const { banco, json } = f;

    /** Aplica o que o Mercado Pago diz de um pagamento a compra dele (pelo external_reference). Pode repetir. */
    async function aplicarPagamento(pagamento) {
        const compraId = pagamento?.external_reference;
        if (!/^[0-9a-f-]{36}$/i.test(compraId || '')) return null;
        const db = await banco();
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');
            const { rows } = await cliente.query('SELECT * FROM compras WHERE id = $1 FOR UPDATE', [compraId]);
            const compra = rows[0];
            if (!compra) {
                await cliente.query('ROLLBACK');
                return null;
            }
            const nova = situacaoDoPagamento(pagamento, compra);
            if (podeMudar(compra.status, nova)) {
                await cliente.query('UPDATE compras SET status = $2, pagamento = $3, atualizada_em = now() WHERE id = $1', [compra.id, nova, String(pagamento.id)]);
                const giros = girosDaCompra(compra.item);
                if (nova === 'aprovada' && giros) {
                    // giros da roleta: ficam guardados na compra ate a pessoa girar
                    await cliente.query('UPDATE compras SET giros_restantes = $2 WHERE id = $1', [compra.id, giros]);
                } else if (nova === 'aprovada') {
                    await cliente.query('INSERT INTO mochila (conta, item, compra) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [compra.conta, compra.item, compra.id]);
                } else if (nova === 'reembolsada' && giros) {
                    // giros devolvidos: os que sobraram somem, e os itens que sairam deles saem da mochila (e das capas)
                    await cliente.query('UPDATE compras SET giros_restantes = 0 WHERE id = $1', [compra.id]);
                    const { rows: tirados } = await cliente.query('DELETE FROM mochila WHERE conta = $1 AND compra = $2 RETURNING item', [compra.conta, compra.id]);
                    const itens = tirados.map(linha => linha.item);
                    if (itens.length) {
                        await cliente.query(`UPDATE contas SET borda = CASE WHEN borda = ANY($2) THEN NULL ELSE borda END,
                            efeito = CASE WHEN efeito = ANY($2) THEN NULL ELSE efeito END, tema = CASE WHEN tema = ANY($2) THEN NULL ELSE tema END
                            WHERE id = $1`, [compra.conta, itens]);
                    }
                } else if (nova === 'reembolsada') {
                    // devolvido: o item sai da mochila (e de cima das capas, se estava equipado)
                    await cliente.query('DELETE FROM mochila WHERE conta = $1 AND item = $2 AND compra = $3', [compra.conta, compra.item, compra.id]);
                    await cliente.query(`UPDATE contas SET borda = CASE WHEN borda = $2 THEN NULL ELSE borda END,
                        efeito = CASE WHEN efeito = $2 THEN NULL ELSE efeito END, tema = CASE WHEN tema = $2 THEN NULL ELSE tema END
                        WHERE id = $1`, [compra.conta, compra.item]);
                } else if (nova === 'divergente') {
                    console.error(`Compra ${compra.id}: pago ${pagamento.transaction_amount} ${pagamento.currency_id}, esperado ${compra.preco / 100} BRL`);
                }
                compra.status = nova;
            }
            await cliente.query('COMMIT');
            return compra;
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
    }

    /** O que a pessoa tem e o que a loja vende. */
    async function vitrine(eu) {
        const db = await banco();
        const [{ rows: meus }, { rows: conta }, { rows: [{ giros }] }] = await Promise.all([
            db.query('SELECT item, obtido_em FROM mochila WHERE conta = $1 ORDER BY obtido_em', [eu.id]),
            db.query('SELECT borda, efeito, tema, giro_gratis_usado FROM contas WHERE id = $1', [eu.id]),
            db.query(`SELECT coalesce(sum(giros_restantes), 0)::int AS giros FROM compras WHERE conta = $1 AND status = 'aprovada'`, [eu.id]),
        ]);
        const comprados = meus.filter(linha => itemDaLoja(linha.item)).map(linha => ({ item: linha.item, obtidoEm: linha.obtido_em }));
        const disponiveis = temTudo(eu) ? ITENS_DA_LOJA : ITENS_DA_LOJA.filter(item => !comprados.some(meu => meu.item === item.id));
        return {
            roleta: {
                gratis: temTudo(eu) || !conta[0]?.giro_gratis_usado,
                giros,
                preco: PRECO_DO_GIRO,
                porVez: GIROS_POR_VEZ,
                chances: chancesDaRoleta(disponiveis),
                faltam: disponiveis.length,
                // o dono tem tudo: os giros dele sao so para ver a roleta (nao gastam nada nem guardam o item)
                demonstracao: temTudo(eu),
            },
            itens: ITENS_DA_LOJA,
            gratis: TEMAS_GRATIS,
            mochila: temTudo(eu) ? ITENS_DA_LOJA.map(item => ({ item: item.id, obtidoEm: null })) : comprados,
            temTudo: temTudo(eu),
            equipados: { borda: conta[0]?.borda || null, efeito: conta[0]?.efeito || null, tema: temaQueExiste(conta[0]?.tema) },
            pagamentoConfigurado: pagamentoConfigurado(),
        };
    }

    async function comprar(request, eu) {
        if (!pagamentoConfigurado()) throw new ErroDaLoja(503, 'A loja ainda não está recebendo pagamentos. Tente mais tarde.');
        const corpo = await f.lerCorpo(request);
        const db = await banco();
        let item;
        if (corpo.giros !== undefined) {
            // giros da roleta (doc 115): de 1 a 3, a R$ 5,00 cada
            const quantos = Number(corpo.giros);
            if (!Number.isInteger(quantos) || quantos < 1 || quantos > GIROS_POR_VEZ) throw new ErroDaLoja(400, `Compre de 1 a ${GIROS_POR_VEZ} giros por vez`);
            if (temTudo(eu)) throw new ErroDaLoja(409, 'Você é o dono do site: já tem todos os itens');
            // nao vende giro que nao tem o que dar: os itens que faltam tem que bastar para os giros guardados e os novos
            const [{ rows: meus }, { rows: [{ guardados }] }] = await Promise.all([
                db.query('SELECT item FROM mochila WHERE conta = $1', [eu.id]),
                db.query(`SELECT coalesce(sum(giros_restantes), 0)::int AS guardados FROM compras WHERE conta = $1 AND status = 'aprovada'`, [eu.id]),
            ]);
            const faltam = ITENS_DA_LOJA.filter(itemDaLista => !meus.some(meu => meu.item === itemDaLista.id)).length;
            if (faltam < guardados + quantos) {
                throw new ErroDaLoja(409, faltam === 0 ? 'Você já tem todos os itens da loja!'
                    : faltam <= guardados ? 'Seus giros guardados já dão para todos os itens que faltam'
                    : `Faltam só ${faltam} itens para você: dá para comprar até ${faltam - guardados} giro${faltam - guardados > 1 ? 's' : ''}`);
            }
            item = { id: 'giros-' + quantos, tipo: 'giros', nome: quantos + (quantos > 1 ? ' giros' : ' giro') + ' da roleta',
                descricao: 'Cada giro sorteia um item da loja que você ainda não tem.', preco: PRECO_DO_GIRO * quantos };
        } else {
            item = itemDaLoja(corpo.item);
            if (!item) throw new ErroDaLoja(404, 'Item não encontrado na loja');
            if (temTudo(eu)) throw new ErroDaLoja(409, 'Você é o dono do site: todos os itens já estão na sua mochila');
            const { rows: tem } = await db.query('SELECT 1 FROM mochila WHERE conta = $1 AND item = $2', [eu.id, item.id]);
            if (tem.length) throw new ErroDaLoja(409, 'Esse item já está na sua mochila');
        }
        // contra abuso: no maximo 10 compras abertas por hora
        const { rows: [{ abertas }] } = await db.query(
            `SELECT count(*)::int AS abertas FROM compras WHERE conta = $1 AND criada_em > now() - interval '1 hour'`, [eu.id]);
        if (abertas >= 10) throw new ErroDaLoja(429, 'Muitas compras começadas na última hora. Espere um pouco e tente de novo.');
        const compraId = randomUUID();
        await db.query('INSERT INTO compras (id, conta, item, preco) VALUES ($1, $2, $3, $4)', [compraId, eu.id, item.id, item.preco]);
        const site = origemDoSite(request);
        const retorno = `${site}/api/loja/retorno?compra=${compraId}`;
        const preferencia = await mercadoPago('/checkout/preferences', {
            metodo: 'POST',
            idempotencia: compraId,
            corpo: {
                items: [{ id: item.id, title: `${item.tipo === 'giros' ? 'Roleta:' : { efeito: 'Efeito', tema: 'Tema' }[item.tipo] || 'Borda'} ${item.nome} - Viracap`, description: item.descricao, category_id: 'virtual_goods',
                    quantity: 1, currency_id: 'BRL', unit_price: item.preco / 100 }],
                external_reference: compraId,
                back_urls: { success: retorno, pending: retorno, failure: retorno },
                auto_return: 'approved',
                notification_url: `${site}/api/loja/webhook?source_news=webhooks`,
                statement_descriptor: 'VIRACAP',
                // bordas sao digitais: nada de endereco de entrega
                shipments: { mode: 'not_specified' },
                expires: true,
                expiration_date_to: new Date(Date.now() + 24 * 3600_000).toISOString(),
            },
        });
        const endereco = preferencia.init_point || preferencia.sandbox_init_point;
        if (!endereco) throw new Error('O Mercado Pago não devolveu o endereço do pagamento');
        return { compra: compraId, endereco };
    }

    /** A situacao de uma compra da pessoa; se ainda esta pendente, pergunta ao Mercado Pago. */
    async function conferirCompra(id, eu) {
        if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new ErroDaLoja(404, 'Compra não encontrada');
        const db = await banco();
        const { rows } = await db.query('SELECT id, item, status FROM compras WHERE id = $1 AND conta = $2', [id, eu.id]);
        if (!rows.length) throw new ErroDaLoja(404, 'Compra não encontrada');
        let compra = rows[0];
        if (compra.status === 'pendente' && pagamentoConfigurado()) {
            try {
                const busca = await mercadoPago(`/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc`);
                // um pagamento aprovado vale mais que tentativas recusadas da mesma compra
                const pagamentos = busca?.results || [];
                const melhor = pagamentos.find(pagamento => pagamento.status === 'approved') || pagamentos[0];
                if (melhor) compra = (await aplicarPagamento(melhor)) || compra;
            } catch (erro) {
                console.error('Não deu para conferir a compra no Mercado Pago:', erro.message);
            }
        }
        return { compra: compra.id, item: compra.item, status: compra.status };
    }

    /**
     * Gira a roleta (doc 115): { gratis: true } usa o giro de graca; { quantidade: 1 a 3 } usa giros comprados, todos
     * de uma vez. O sorteio e feito aqui (nunca no navegador), sem repetir item, e os itens vao para a mochila na mesma
     * transacao em que o giro e gasto. O dono so ve a roleta: nada e gasto nem guardado.
     */
    async function girar(request, eu) {
        const { gratis, quantidade } = await f.lerCorpo(request);
        const quantos = gratis ? 1 : Number(quantidade);
        if (!Number.isInteger(quantos) || quantos < 1 || quantos > GIROS_POR_VEZ) throw new ErroDaLoja(400, `Gire de 1 a ${GIROS_POR_VEZ} vezes`);
        const sortear = disponiveis => {
            const saiu = [];
            const restantes = [...disponiveis];
            for (let i = 0; i < quantos && restantes.length; i++) {
                const item = sortearDaRoleta(restantes);
                saiu.push(item);
                restantes.splice(restantes.indexOf(item), 1);
            }
            return saiu;
        };
        if (temTudo(eu)) return { itens: sortear(ITENS_DA_LOJA), demonstracao: true, gratis: true, giros: 0 };
        const db = await banco();
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');
            // uma conta gira de cada vez (dois cliques ao mesmo tempo nao gastam o mesmo giro)
            const { rows: [conta] } = await cliente.query('SELECT giro_gratis_usado FROM contas WHERE id = $1 FOR UPDATE', [eu.id]);
            const { rows: meus } = await cliente.query('SELECT item FROM mochila WHERE conta = $1', [eu.id]);
            const disponiveis = ITENS_DA_LOJA.filter(item => !meus.some(meu => meu.item === item.id));
            if (disponiveis.length < quantos) throw new ErroDaLoja(409, disponiveis.length ? `Faltam só ${disponiveis.length} itens para você` : 'Você já tem todos os itens da loja!');
            const compras = [];
            if (gratis) {
                if (conta.giro_gratis_usado) throw new ErroDaLoja(409, 'Você já usou o seu giro grátis');
                await cliente.query('UPDATE contas SET giro_gratis_usado = true WHERE id = $1', [eu.id]);
                compras.push(null);
            } else {
                // os giros guardados, dos mais antigos para os mais novos; cada item fica marcado com a compra de onde saiu
                const { rows: guardadas } = await cliente.query(
                    `SELECT id, giros_restantes FROM compras WHERE conta = $1 AND status = 'aprovada' AND giros_restantes > 0 ORDER BY criada_em FOR UPDATE`, [eu.id]);
                for (const compra of guardadas) {
                    while (compra.giros_restantes > 0 && compras.length < quantos) {
                        compra.giros_restantes--;
                        compras.push(compra.id);
                    }
                }
                if (compras.length < quantos) {
                    throw new ErroDaLoja(402, compras.length ? `Você tem só ${compras.length} giro${compras.length > 1 ? 's' : ''}` : 'Você não tem giros. Compre giros para girar a roleta.');
                }
                for (const compra of guardadas) await cliente.query('UPDATE compras SET giros_restantes = $2 WHERE id = $1', [compra.id, compra.giros_restantes]);
            }
            const itens = sortear(disponiveis);
            for (const [i, item] of itens.entries()) {
                await cliente.query('INSERT INTO mochila (conta, item, compra) VALUES ($1, $2, $3)', [eu.id, item.id, compras[i]]);
            }
            const { rows: [{ giros }] } = await cliente.query(
                `SELECT coalesce(sum(giros_restantes), 0)::int AS giros FROM compras WHERE conta = $1 AND status = 'aprovada'`, [eu.id]);
            await cliente.query('COMMIT');
            return { itens, gratis: false, giros };
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
    }

    /**
     * Imagens da loja, so para o dono: GET lista; PUT /{nome} envia ou troca (o corpo e o arquivo, como veio);
     * DELETE /{nome} apaga.
     */
    async function imagensDaLoja(request, nome, eu) {
        if (!temTudo(eu)) throw new ErroDaLoja(403, 'Só o dono do site gerencia as imagens da loja');
        const db = await banco();
        const metodo = request.method;
        if (!nome && metodo === 'GET') {
            const { rows } = await db.query('SELECT nome, tipo, tamanho, atualizada_em FROM imagens_da_loja ORDER BY nome');
            return f.semCache(json(200, rows.map(linha => ({ nome: linha.nome, tipo: linha.tipo, tamanho: linha.tamanho,
                atualizadaEm: linha.atualizada_em, endereco: '/api/loja/imagens/' + linha.nome }))));
        }
        if (nome && metodo === 'PUT') {
            const bytes = Buffer.from(await request.arrayBuffer());
            const tipo = conferirImagemDaLoja(nome, bytes);
            await db.query(`INSERT INTO imagens_da_loja (nome, conteudo, tipo, tamanho) VALUES ($1, $2, $3, $4)
                ON CONFLICT (nome) DO UPDATE SET conteudo = $2, tipo = $3, tamanho = $4, atualizada_em = now()`, [nome, bytes, tipo, bytes.length]);
            return json(200, { nome, tipo, tamanho: bytes.length, endereco: '/api/loja/imagens/' + nome });
        }
        if (nome && metodo === 'DELETE') {
            await db.query('DELETE FROM imagens_da_loja WHERE nome = $1', [nome]);
            return new Response(null, { status: 204 });
        }
        throw new ErroDaLoja(404, 'Endereço não encontrado');
    }

    /** { item } equipa um item da mochila; { tipo, item: null } volta ao de sempre daquele tipo. */
    async function equipar(request, eu) {
        const { item, tipo } = await f.lerCorpo(request);
        const db = await banco();
        const equipados = async () => {
            const { rows } = await db.query('SELECT borda, efeito, tema FROM contas WHERE id = $1', [eu.id]);
            return { equipados: { borda: rows[0]?.borda || null, efeito: rows[0]?.efeito || null, tema: temaQueExiste(rows[0]?.tema) } };
        };
        if (item === null) {
            const coluna = Object.hasOwn(COLUNA_DO_TIPO, tipo) ? COLUNA_DO_TIPO[tipo] : null;
            if (!coluna) throw new ErroDaLoja(400, 'Informe o tipo: borda, efeito ou tema');
            await db.query(`UPDATE contas SET ${coluna} = NULL WHERE id = $1`, [eu.id]);
            return equipados();
        }
        // os temas de graca (escuro e claro) qualquer conta equipa
        const gratis = TEMAS_GRATIS.find(tema => tema.id === item);
        if (gratis) {
            await db.query('UPDATE contas SET tema = $2 WHERE id = $1', [eu.id, gratis.id]);
            return equipados();
        }
        const achado = itemDaLoja(item);
        if (!achado) throw new ErroDaLoja(404, 'Item não encontrado');
        if (!temTudo(eu)) {
            const { rows } = await db.query('SELECT 1 FROM mochila WHERE conta = $1 AND item = $2', [eu.id, item]);
            if (!rows.length) throw new ErroDaLoja(403, 'Esse item não está na sua mochila');
        }
        await db.query(`UPDATE contas SET ${COLUNA_DO_TIPO[achado.tipo]} = $2 WHERE id = $1`, [eu.id, achado.id]);
        return equipados();
    }

    return {
        /**
         * Rotas sem login: o aviso do Mercado Pago e a volta da pagina de pagamento (que so redireciona para o site).
         * Devolve null quando a rota nao e uma delas.
         */
        async semLogin(request, url, partes) {
            const [acao] = partes;
            if (acao === 'retorno' && request.method === 'GET') {
                const compra = url.searchParams.get('compra') || url.searchParams.get('external_reference') || '';
                const destino = '/#/loja' + (/^[0-9a-f-]{36}$/i.test(compra) ? '?compra=' + compra : '');
                return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
            }
            if (acao === 'webhook' && request.method === 'POST') return webhook(request, url);
            // as imagens das bordas e efeitos: abertas (aparecem em capas que qualquer leitor ve) e guardadas pela CDN
            // por uma hora; trocar uma imagem leva ate uma hora para aparecer para todo mundo
            if (acao === 'imagens' && partes[1] && request.method === 'GET') {
                const nome = partes[1];
                if (!NOME_DA_IMAGEM.test(nome)) return new Response('Imagem não encontrada', { status: 404 });
                const { rows } = await (await banco()).query('SELECT conteudo, tipo FROM imagens_da_loja WHERE nome = $1', [nome]);
                if (!rows.length) return new Response('Imagem não encontrada', { status: 404, headers: { 'Cache-Control': 'no-store' } });
                return respostaDoArquivo(rows[0].conteudo, rows[0].tipo, request.headers.get('range'));
            }
            return null;
        },
        async comLogin(request, url, partes, eu) {
            const [acao, id] = partes;
            const metodo = request.method;
            try {
                if (!acao && metodo === 'GET') return f.semCache(json(200, await vitrine(eu)));
                if (acao === 'comprar' && !id && metodo === 'POST') return json(201, await comprar(request, eu));
                if (acao === 'compras' && id && metodo === 'GET') return f.semCache(json(200, await conferirCompra(id, eu)));
                if (acao === 'equipar' && !id && metodo === 'PUT') return json(200, await equipar(request, eu));
                if (acao === 'roleta' && !id && metodo === 'POST') return json(200, await girar(request, eu));
                if (acao === 'imagens') return await imagensDaLoja(request, id, eu);
            } catch (erro) {
                if (erro instanceof ErroDaLoja) throw new f.Recusa(erro.status, erro.message);
                throw erro;
            }
            throw new f.Recusa(404, 'Endereço não encontrado');
        },
    };

    /**
     * O aviso do Mercado Pago. Responde 200 a tudo o que nao e da loja (senao ele fica repetindo o aviso); um pagamento
     * so muda a compra depois de buscado na API com o token. Com MERCADOPAGO_WEBHOOK_SECRET definida, avisos sem a
     * assinatura certa sao recusados.
     */
    async function webhook(request, url) {
        let corpo = {};
        try {
            corpo = await request.json();
        } catch {
            // aviso sem corpo: o id vem no endereco
        }
        const tipo = url.searchParams.get('type') || url.searchParams.get('topic') || corpo.type || corpo.topic;
        const pagamentoId = url.searchParams.get('data.id') || corpo?.data?.id || (tipo === 'payment' ? url.searchParams.get('id') : null);
        const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (segredo && !assinaturaValida({ assinatura: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'),
            dataId: url.searchParams.get('data.id') || corpo?.data?.id, segredo })) {
            return json(401, { erro: 'Assinatura inválida' });
        }
        if (tipo !== 'payment' || !/^\d+$/.test(String(pagamentoId || '')) || !pagamentoConfigurado()) return json(200, { ok: true });
        const pagamento = await mercadoPago('/v1/payments/' + pagamentoId);
        await aplicarPagamento(pagamento);
        return json(200, { ok: true });
    }
}

/** https://viracap.vercel.app (ou o endereco local, nos testes): para as voltas e os avisos do Mercado Pago. */
function origemDoSite(request) {
    if (process.env.MANGATRACKER_SITE) return process.env.MANGATRACKER_SITE.replace(/\/$/, '');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocolo = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
    return `${protocolo}://${host}`;
}
