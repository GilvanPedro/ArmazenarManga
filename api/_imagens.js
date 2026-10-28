// Imagens enviadas pelas pessoas (capas, fotos de perfil e imagens dos posts), doc 139.
//
// Com o Vercel Blob ligado (BLOB_READ_WRITE_TOKEN), cada imagem e conferida, limpa e guardada la em varias larguras,
// em AVIF e WebP; o banco fica so com os dados dela (endereco, medidas, hash e uma previa borrada de poucos bytes).
// Sem o Blob, tudo continua no banco como antes, so que ja limpo e em WebP.

import { createHash } from 'node:crypto';

/** As larguras guardadas de cada tipo de imagem: o dobro do maior espaco em que ela aparece, para telas de alta resolucao. */
export const LARGURAS = {
    capa: [240, 480, 720], // na grade a capa ocupa ~110-220 px; na pagina do manga, ~320 px
    post: [480, 960, 1440], // num post, a imagem ocupa ate ~600 px; aberta grande, a tela toda
    foto: [96, 256], // a foto de perfil aparece com 26 a 128 px
};
// qualidade calibrada (a diferenca para 100 nao se ve, e o arquivo cai para uma fracao)
const QUALIDADE = { avif: 55, webp: 78 };
const UM_ANO = 365 * 24 * 60 * 60;
// imagens com mais pixels que isso nao sao abertas (protege contra imagens "bomba")
const PIXELS_MAXIMOS = 40_000_000;

export class ImagemInvalida extends Error {}

/** O Vercel Blob esta ligado? (a chave aparece sozinha quando o Blob Store e conectado ao projeto) */
export function blobAtivo() {
    // com a chave, ou so com o BLOB_STORE_ID: o Blob conectado ao projeto pode ser usado sem chave, e a biblioteca se
    // autentica sozinha com o token que a Vercel poe em cada requisicao do site (OIDC)
    return Boolean(chaveDoBlob() || process.env.BLOB_STORE_ID);
}

/** O "token" a passar para a biblioteca: so quando ha chave; sem ela, a biblioteca usa o BLOB_STORE_ID (OIDC). */
function comChave() {
    const chave = chaveDoBlob();
    return chave ? { token: chave } : {};
}

/**
 * A chave do Blob: BLOB_READ_WRITE_TOKEN ou, se um prefixo foi escolhido ao conectar o Blob ao projeto, a variavel
 * PREFIXO_READ_WRITE_TOKEN (achada pelo comeco do valor, "vercel_blob_rw_", que e o de toda chave do Blob). Na
 * primeira vez, diz no log se achou e por qual nome (sem o valor), para conferir nos registros da Vercel.
 */
let chaveAvisada = false;
function chaveDoBlob() {
    const nome = process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN'
        : Object.keys(process.env).find(outro => outro.endsWith('_READ_WRITE_TOKEN') && String(process.env[outro]).startsWith('vercel_blob_rw_'));
    if (!chaveAvisada) {
        chaveAvisada = true;
        // so os nomes das variaveis, nunca os valores
        const nomes = Object.keys(process.env).filter(outro => /BLOB/i.test(outro)).sort().join(', ') || 'nenhuma';
        console.log(nome ? `Imagens: Vercel Blob ligado (chave em ${nome})`
            : process.env.BLOB_STORE_ID ? 'Imagens: Vercel Blob ligado (BLOB_STORE_ID, sem chave: autenticacao da Vercel)'
                : 'Imagens: Vercel Blob desligado; as imagens ficam no banco', `| variaveis com BLOB: ${nomes}`);
    }
    return nome ? process.env[nome] : null;
}

/**
 * A biblioteca do Blob. Nos testes locais, VIRACAP_BLOB_DE_TESTE aponta para uma imitacao (que guarda em uma pasta),
 * para testar sem a chave de verdade; no site essa variavel nao existe.
 */
async function biblioteca() {
    return import(process.env.VIRACAP_BLOB_DE_TESTE || '@vercel/blob');
}

async function sharpDe(bytes, animada) {
    const { default: sharp } = await import('sharp');
    return sharp(bytes, { animated: animada, limitInputPixels: PIXELS_MAXIMOS });
}

/**
 * Confere e prepara uma imagem: o tipo de verdade pelo conteudo (nao pela extensao), as medidas, a rotacao da camera,
 * e sem os metadados (EXIF: foto de celular pode trazer a localizacao). Devolve as versoes a guardar:
 * { hash, largura, altura, animada, placeholder, principal: {bytes, tipo, extensao}, variantes: [{largura, formato, bytes}] }.
 * GIF animado vira WebP animado (o AVIF animado ainda nao e bem aceito pelos navegadores).
 */
export async function prepararImagem(bytes, tipoDeImagem) {
    const larguras = LARGURAS[tipoDeImagem] || LARGURAS.post;
    let info;
    try {
        info = await (await sharpDe(bytes, true)).metadata();
    } catch {
        throw new ImagemInvalida('Não deu para ler essa imagem. Use PNG, JPG, GIF ou WebP');
    }
    if (!['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'].includes(info.format)) throw new ImagemInvalida('Formato de imagem não suportado. Use PNG, JPG, GIF ou WebP');
    const animada = (info.pages || 1) > 1;
    // a rotacao da camera ja aplicada: largura e altura como a imagem aparece
    const girada = (info.orientation || 1) >= 5;
    const largura = girada ? info.height : info.width;
    const altura = animada ? info.pageHeight : (girada ? info.width : info.height);
    const base = async () => (await sharpDe(bytes, animada)).rotate();
    const hash = createHash('sha256').update(bytes).digest('hex');

    const variantes = [];
    // so as larguras menores que a da imagem, e sempre a propria largura (limitada a maior das listadas)
    const alvos = [...new Set([...larguras.filter(alvo => alvo < largura), Math.min(largura, larguras[larguras.length - 1])])];
    for (const alvo of alvos) {
        const redimensionada = async () => (await base()).resize({ width: alvo, withoutEnlargement: true });
        if (!animada) variantes.push({ largura: alvo, formato: 'avif', bytes: await (await redimensionada()).avif({ quality: QUALIDADE.avif, effort: 3 }).toBuffer() });
        variantes.push({ largura: alvo, formato: 'webp', bytes: await (await redimensionada()).webp({ quality: QUALIDADE.webp, effort: 4 }).toBuffer() });
    }
    // a principal: a maior em WebP (para quem pede a imagem "inteira", como o link antigo e a janela de ampliar)
    const maior = variantes.filter(v => v.formato === 'webp').at(-1);
    // a previa: 16 px de largura, borrada pelo proprio navegador ao esticar; poucos bytes, vai junto com os dados
    const previa = await (await sharpDe(bytes, false)).rotate().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
    return {
        hash, largura, altura, animada,
        placeholder: 'data:image/webp;base64,' + previa.toString('base64'),
        principal: { bytes: maior.bytes, tipo: 'image/webp', extensao: 'webp' },
        variantes,
    };
}

/**
 * Guarda as versoes no Blob, num caminho feito do hash do conteudo: o nome muda quando o conteudo muda (o cache pode
 * durar um ano) e a mesma imagem enviada duas vezes cai no mesmo lugar (sem copia repetida).
 * Devolve os dados que ficam no banco: { url, variantes: [{largura, formato, url}], placeholder, largura, altura, hash, tamanho }.
 */
export async function guardarNoBlob(pasta, preparada) {
    const { put } = await biblioteca();
    const prefixo = `${pasta}/${preparada.hash.slice(0, 32)}`;
    const opcoes = tipo => ({ access: 'public', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: UM_ANO, contentType: tipo, ...comChave() });
    const variantes = await Promise.all(preparada.variantes.map(async variante => {
        const enviado = await put(`${prefixo}/${variante.largura}.${variante.formato}`, variante.bytes, opcoes('image/' + variante.formato));
        return { largura: variante.largura, formato: variante.formato, url: enviado.url };
    }));
    const principal = variantes.filter(variante => variante.formato === 'webp').at(-1);
    return {
        url: principal.url, variantes, placeholder: preparada.placeholder, largura: preparada.largura, altura: preparada.altura,
        hash: preparada.hash, tamanho: preparada.variantes.reduce((soma, variante) => soma + variante.bytes.length, 0),
    };
}

/**
 * Um arquivo inteiro no Blob, sem converter (doc 140): os banners (ja otimizados no envio) e as imagens e videos da
 * loja (como o dono enviou). O caminho leva o hash do conteudo: trocar o arquivo muda o endereco. Devolve a url.
 */
export async function guardarArquivoNoBlob(pasta, nome, bytes, tipo) {
    const { put } = await biblioteca();
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
    const enviado = await put(`${pasta}/${hash}/${nome}`, bytes,
        { access: 'public', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: UM_ANO, contentType: tipo, ...comChave() });
    return enviado.url;
}

const PASTA_E_TIPO = { imagens: ['capas', 'capa'], imagens_da_comunidade: ['comunidade', 'post'] };

/**
 * Leva para o Blob, na hora, uma imagem que ainda esta no banco (doc 140): a capa de origem de uma miniatura ou de uma
 * lista publicada, para nada novo nascer no banco a partir dela. Devolve a linha com os dados do Blob (ou a linha como
 * estava, se o Blob esta desligado ou ela ja estava la).
 */
export async function levarParaOBlob(db, tabela, nome) {
    const [pasta, tipo] = PASTA_E_TIPO[tabela];
    const { rows: [linha] } = await db.query(`SELECT nome, conteudo, url, variantes, placeholder, largura, altura, hash, tamanho FROM ${tabela} WHERE nome = $1`, [nome]);
    if (!linha || linha.url || !linha.conteudo || !blobAtivo()) return linha || null;
    const guardada = await guardarNoBlob(pasta, await prepararImagem(linha.conteudo, tipo));
    await db.query(`UPDATE ${tabela} SET url = $2, variantes = $3, placeholder = $4, largura = $5, altura = $6, hash = $7, tamanho = $8, conteudo = NULL
        WHERE nome = $1`, [nome, guardada.url, JSON.stringify(guardada.variantes), guardada.placeholder, guardada.largura, guardada.altura, guardada.hash, guardada.tamanho]);
    return { nome, conteudo: null, ...guardada };
}

/** Apaga do Blob os arquivos destas linhas (url e variantes). Falhar aqui nao impede o resto: sobra so um arquivo sem uso. */
export async function apagarDoBlob(linhas) {
    const urls = linhas.flatMap(linha => [linha.url, ...(Array.isArray(linha.variantes) ? linha.variantes.map(variante => variante.url) : [])]).filter(Boolean);
    if (urls.length === 0 || !blobAtivo()) return;
    try {
        const { del } = await biblioteca();
        await del([...new Set(urls)], comChave());
    } catch (erro) {
        console.error('Nao deu para apagar do Blob:', erro.message);
    }
}

/**
 * Apaga do Blob os arquivos de imagens que sairam do banco, menos os que outra linha ainda usa: a mesma imagem enviada
 * duas vezes (ou a capa copiada para um post) aponta para os mesmos arquivos. linhas: [{ url, variantes }].
 */
export async function apagarSeNinguemUsa(db, linhas) {
    const comArquivo = linhas.filter(linha => linha?.url);
    if (comArquivo.length === 0 || !blobAtivo()) return;
    const { rows } = await db.query(`SELECT url FROM imagens WHERE url = ANY($1) UNION SELECT url FROM imagens_da_comunidade WHERE url = ANY($1)`,
        [comArquivo.map(linha => linha.url)]);
    const emUso = new Set(rows.map(linha => linha.url));
    await apagarDoBlob(comArquivo.filter(linha => !emUso.has(linha.url)));
}

/** Os bytes de uma imagem guardada: do banco (as antigas) ou baixados do Blob. */
export async function bytesDe(linha) {
    if (linha.conteudo) return Buffer.from(linha.conteudo);
    if (!linha.url) return null;
    const resposta = await fetch(linha.url);
    if (!resposta.ok) throw new Error('Imagem não encontrada no armazenamento');
    return Buffer.from(await resposta.arrayBuffer());
}

/**
 * O que o site precisa para mostrar a imagem no tamanho certo (doc 139): srcset em AVIF e em WebP, a proporcao (para
 * reservar o espaco) e a previa borrada. null se a imagem ainda esta so no banco.
 */
export function imagemParaOSite(linha) {
    if (!linha?.url || !Array.isArray(linha.variantes)) return null;
    const srcset = formato => linha.variantes.filter(variante => variante.formato === formato).map(variante => `${variante.url} ${variante.largura}w`).join(', ');
    return { avif: srcset('avif') || null, webp: srcset('webp'), largura: linha.largura, altura: linha.altura, previa: linha.placeholder };
}

/** A versao WebP mais proxima (para cima) de uma largura: a miniatura da lista, a foto de perfil pequena. */
export function urlNaLargura(linha, largura) {
    const webps = (linha?.variantes || []).filter(variante => variante.formato === 'webp').sort((a, b) => a.largura - b.largura);
    return (webps.find(variante => variante.largura >= largura) || webps.at(-1))?.url || linha?.url || null;
}

/** As colunas de dados da imagem, iguais nas tabelas de imagens (a de capas e fotos e a da Comunidade). */
export const COLUNAS_DA_IMAGEM = `
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS variantes JSONB,
    ADD COLUMN IF NOT EXISTS placeholder TEXT,
    ADD COLUMN IF NOT EXISTS largura INT,
    ADD COLUMN IF NOT EXISTS altura INT,
    ADD COLUMN IF NOT EXISTS hash TEXT,
    ADD COLUMN IF NOT EXISTS tamanho INT,
    ALTER COLUMN conteudo DROP NOT NULL`;
