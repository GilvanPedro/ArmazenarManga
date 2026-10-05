// API do site para o Vercel, que nao roda Java. Faz o mesmo que o backend Java
// (src/main/java/.../web/ApiServer.java) e usa o mesmo banco Postgres, com as mesmas tabelas.
// Uma mudanca de regra precisa ser feita nos dois lugares.
import pg from 'pg';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { criarBuscador, criarVerificador, mensagemDaVerificacao, mesmoEndereco } from './_verificador.js';

const verificar = criarVerificador(criarBuscador());

const STATUS = {
    LENDO: 'Lendo',
    DROPADO: 'Dropado',
    CANCELADO: 'Cancelado',
    CONCLUIDO: 'Concluído',
    HIATUS: 'Hiatus',
    LER: 'Para Ler',
};
const FORMATOS = {
    HIFEN: { separador: '-', descricao: 'X-5' },
    PONTO: { separador: '.', descricao: 'X.5' },
    UNDERLINE: { separador: '_', descricao: 'X_5' },
};
const DIAS = {
    SEGUNDA: 'Segunda-feira',
    TERCA: 'Terça-feira',
    QUARTA: 'Quarta-feira',
    QUINTA: 'Quinta-feira',
    SEXTA: 'Sexta-feira',
    SABADO: 'Sábado',
    DOMINGO: 'Domingo',
};
// nao ha mais o que ler nesses, entao nao entram no sorteio
const FORA_DO_SORTEIO = ['CONCLUIDO', 'CANCELADO'];
const MARCADOR = '{cap}';
const SENHA_MINIMA = 12;
// o Vercel recusa requisicoes maiores que 4,5 MB
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
const TIPOS = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const NOME_VALIDO = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;
const ID_VALIDO = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Erro que vira uma resposta {"mensagem": ...} com o status informado. */
class Recusa extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

// ------------------------------------------------------------------ banco

let conexoes;
let tabelasProntas;

async function banco() {
    if (!conexoes) {
        // poucas conexoes: cada instancia da funcao atende uma requisicao por vez
        conexoes = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10_000 });
    }
    if (!tabelasProntas) {
        tabelasProntas = conexoes.query(`
            CREATE TABLE IF NOT EXISTS mangas (id UUID PRIMARY KEY, ordem BIGSERIAL, dados JSONB NOT NULL);
            CREATE TABLE IF NOT EXISTS imagens (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL);
        `).catch(erro => {
            tabelasProntas = null;
            throw erro;
        });
    }
    await tabelasProntas;
    return conexoes;
}

async function listarTodos() {
    const { rows } = await (await banco()).query('SELECT dados FROM mangas ORDER BY ordem');
    return rows.map(linha => linha.dados);
}

async function buscarPorId(id) {
    if (!ID_VALIDO.test(id)) throw new Recusa(404, 'Mangá não encontrado');
    const { rows } = await (await banco()).query('SELECT dados FROM mangas WHERE id = $1', [id]);
    if (rows.length === 0) throw new Recusa(404, 'Mangá não encontrado');
    return rows[0].dados;
}

async function salvar(manga) {
    await (await banco()).query(
        `INSERT INTO mangas (id, dados) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados`,
        [manga.id, JSON.stringify(manga)]);
}

async function imagemExiste(nome) {
    if (typeof nome !== 'string' || !NOME_VALIDO.test(nome)) return false;
    const { rows } = await (await banco()).query('SELECT 1 FROM imagens WHERE nome = $1', [nome]);
    return rows.length > 0;
}

/** Apaga a capa enviada se nenhum manga usa mais. Links de fora sao ignorados. */
async function excluirImagemSemUso(imagePath) {
    if (typeof imagePath !== 'string' || !NOME_VALIDO.test(imagePath)) return;
    const db = await banco();
    const { rows } = await db.query(`SELECT 1 FROM mangas WHERE dados->>'imagePath' = $1 LIMIT 1`, [imagePath]);
    if (rows.length === 0) {
        await db.query('DELETE FROM imagens WHERE nome = $1', [imagePath]);
    }
}

// ------------------------------------------------------------------ regras do manga

function isUrlHttp(texto) {
    if (typeof texto !== 'string') return false;
    try {
        const url = new URL(texto.trim());
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
    } catch {
        return false;
    }
}

/** 48 -> "48", 48.5 -> "48-5" / "48.5" / "48_5". */
function formatarCapitulo(capitulo, formato) {
    return String(capitulo).replace('.', FORMATOS[formato].separador);
}

function montarLink(manga, capitulo) {
    return manga.chapterLinkModel.replace(MARCADOR, formatarCapitulo(capitulo, manga.decimalFormat || 'HIFEN'));
}

/** Proximo capitulo inteiro ainda nao lido: 48 -> 49, 48.5 -> 49, 0 -> 1. */
function proximoCapitulo(manga) {
    return Math.floor(manga.lastChapter) + 1;
}

/** Minusculas e sem acentos, para "acao" encontrar "Ação". */
function normalizar(texto) {
    return String(texto ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function lerCapitulo(valor) {
    if (valor === null || valor === undefined) return null;
    const numero = typeof valor === 'number' ? valor
        : typeof valor === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(valor) ? Number(valor)
        : NaN;
    if (!Number.isFinite(numero)) throw new Recusa(400, "Valor inválido no campo 'lastChapter'");
    if (numero < 0) throw new Recusa(400, 'O capítulo não pode ser negativo');
    return numero;
}

function lerOpcao(valor, opcoes, campo) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor !== 'string' || !Object.hasOwn(opcoes, valor)) {
        throw new Recusa(400, `Valor inválido no campo '${campo}'`);
    }
    return valor;
}

function lerTexto(valor, campo) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return String(valor);
    if (typeof valor !== 'string') throw new Recusa(400, `Valor inválido no campo '${campo}'`);
    return valor;
}

/** Tira espacos, vazios e repetidos (sem diferenciar maiusculas). */
function montarTags(nomes) {
    if (nomes === null || nomes === undefined) return [];
    if (!Array.isArray(nomes)) throw new Recusa(400, "Valor inválido no campo 'tags'");
    const tags = [];
    const vistos = new Set();
    for (const nome of nomes) {
        if (typeof nome !== 'string' || nome.trim() === '') continue;
        if (!vistos.has(normalizar(nome))) {
            vistos.add(normalizar(nome));
            tags.push(nome.trim());
        }
    }
    return tags;
}

/** Valida os dados do cadastro/edicao geral e devolve o manga pronto para salvar. */
async function montarManga(id, dados) {
    const title = lerTexto(dados.title, 'title');
    const imagePath = lerTexto(dados.imagePath, 'imagePath');
    const chapterLinkModel = lerTexto(dados.chapterLinkModel, 'chapterLinkModel');
    const description = lerTexto(dados.description, 'description');
    const lastChapter = lerCapituloSemValidarSinal(dados.lastChapter);
    const readingStatus = lerOpcao(dados.readingStatus, STATUS, 'readingStatus');
    const decimalFormat = lerOpcao(dados.decimalFormat, FORMATOS, 'decimalFormat') || 'HIFEN';
    const releaseDay = lerOpcao(dados.releaseDay, DIAS, 'releaseDay');
    const tags = montarTags(dados.tags);

    if (!title || title.trim() === '') throw new Recusa(400, 'O título é obrigatório');
    if (!imagePath || imagePath.trim() === '') throw new Recusa(400, 'A imagem é obrigatória');
    if (!chapterLinkModel || chapterLinkModel.trim() === '') {
        throw new Recusa(400, 'Verifique se você preencheu o link corretamente');
    }
    if (lastChapter === null) throw new Recusa(400, 'O último capítulo lido é obrigatório');
    if (lastChapter < 0) throw new Recusa(400, 'O capítulo não pode ser negativo');
    if (!readingStatus) throw new Recusa(400, 'O status é obrigatório');
    if (!chapterLinkModel.includes(MARCADOR)) {
        throw new Recusa(400, `O link precisa ter ${MARCADOR} no lugar do número do capítulo`);
    }
    if (!isUrlHttp(chapterLinkModel.replace(MARCADOR, '1'))) {
        throw new Recusa(400, 'O link precisa ser um endereço http:// ou https:// válido');
    }
    const imagem = imagePath.trim();
    if (!isUrlHttp(imagem) && !(await imagemExiste(imagem))) {
        throw new Recusa(400, 'A imagem informada não existe. Envie a imagem antes de salvar o mangá');
    }
    if (releaseDay && readingStatus !== 'LENDO') {
        throw new Recusa(400, 'O dia de lançamento só pode ser definido para mangás com status Lendo');
    }

    // mesma ordem de campos do mangas.json do backend Java
    return {
        id,
        title: title.trim(),
        imagePath: imagem,
        tags,
        chapterLinkModel: chapterLinkModel.trim(),
        decimalFormat,
        lastChapter,
        readingStatus,
        releaseDay,
        description: description === null ? '' : description.trim(),
    };
}

function lerCapituloSemValidarSinal(valor) {
    try {
        return lerCapitulo(valor);
    } catch (erro) {
        // o capitulo negativo e avisado depois dos campos obrigatorios, como no backend Java
        if (erro.message === 'O capítulo não pode ser negativo') return Number(valor);
        throw erro;
    }
}

/** Manga do jeito que a API devolve: os dados salvos + os links ja montados. */
function resposta(manga) {
    return {
        id: manga.id,
        title: manga.title,
        imagePath: manga.imagePath,
        imageUrl: isUrlHttp(manga.imagePath) ? manga.imagePath : '/api/imagens/' + manga.imagePath,
        tags: manga.tags || [],
        chapterLinkModel: manga.chapterLinkModel,
        decimalFormat: manga.decimalFormat || 'HIFEN',
        lastChapter: manga.lastChapter,
        readingStatus: manga.readingStatus,
        releaseDay: manga.releaseDay ?? null,
        description: manga.description ?? '',
        firstChapterLink: montarLink(manga, 1),
        // enderecos exatos gravados pela verificacao de link do backend Java, quando existem
        lastChapterLink: manga.lastChapterUrl || montarLink(manga, manga.lastChapter),
        nextChapter: proximoCapitulo(manga),
        nextChapterLink: manga.nextChapterUrl || montarLink(manga, proximoCapitulo(manga)),
        nextChapterLinkExact: Boolean(manga.nextChapterUrl),
    };
}

async function listar(titulo, status) {
    const busca = normalizar(titulo);
    return (await listarTodos())
        .filter(manga => !status || manga.readingStatus === status)
        .filter(manga => normalizar(manga.title).includes(busca));
}

// ------------------------------------------------------------------ verificacao de link

/** Confere no site o link do proximo capitulo e salva a correcao se o endereco mudou. */
async function verificarLink(id) {
    const consultado = await buscarPorId(id);
    const linkAnterior = resposta(consultado).nextChapterLink;
    const verificacao = await verificar(consultado);

    // a consulta ao site demora: so grava se o manga nao foi alterado nesse meio tempo
    let manga = await buscarPorId(id);
    const mesmoDeAntes = manga.chapterLinkModel === consultado.chapterLinkModel
        && manga.lastChapter === consultado.lastChapter
        && (manga.lastChapterUrl ?? null) === (consultado.lastChapterUrl ?? null);
    const haCorrecao = manga.chapterLinkModel !== verificacao.chapterLinkModel
        || (manga.nextChapterUrl ?? null) !== verificacao.nextChapterUrl;
    if (mesmoDeAntes && haCorrecao && verificacao.situacao !== 'NAO_VERIFICADO') {
        manga = { ...manga, chapterLinkModel: verificacao.chapterLinkModel, nextChapterUrl: verificacao.nextChapterUrl };
        await salvar(manga);
    }
    const linkMudou = !mesmoEndereco(linkAnterior, resposta(manga).nextChapterLink);
    return {
        situacao: verificacao.situacao,
        linkMudou,
        linkAnterior,
        mensagem: mensagemDaVerificacao(verificacao.situacao, linkMudou, manga),
        manga,
    };
}

// ------------------------------------------------------------------ imagens

function comecaCom(bytes, posicao, assinatura) {
    return bytes.length >= posicao + assinatura.length
        && assinatura.every((byte, i) => bytes[posicao + i] === byte);
}

const ascii = texto => [...texto].map(letra => letra.charCodeAt(0));

function descobrirExtensao(bytes) {
    if (comecaCom(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (comecaCom(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpg';
    if (comecaCom(bytes, 0, ascii('GIF87a')) || comecaCom(bytes, 0, ascii('GIF89a'))) return 'gif';
    if (comecaCom(bytes, 0, ascii('RIFF')) && comecaCom(bytes, 8, ascii('WEBP'))) return 'webp';
    throw new Recusa(400, 'Formato de imagem não suportado. Use PNG, JPG, GIF ou WEBP');
}

async function enviarImagem(request) {
    const tipo = request.headers.get('content-type') || '';
    let arquivo = null;
    if (tipo.toLowerCase().startsWith('multipart/form-data')) {
        try {
            arquivo = (await request.formData()).get('arquivo');
        } catch {
            throw new Recusa(400, 'Não foi possível ler a imagem. Ela pode ter no máximo 4 MB');
        }
    }
    if (!arquivo || typeof arquivo === 'string') {
        throw new Recusa(400, "Envie a imagem em multipart/form-data, no campo 'arquivo'");
    }
    if (arquivo.size === 0) throw new Recusa(400, 'A imagem está vazia');
    if (arquivo.size > TAMANHO_MAXIMO) throw new Recusa(400, 'A imagem pode ter no máximo 4 MB');
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const nome = randomUUID() + '.' + descobrirExtensao(bytes);
    await (await banco()).query('INSERT INTO imagens (nome, conteudo) VALUES ($1, $2)', [nome, bytes]);
    return json(201, { imagePath: nome, imageUrl: '/api/imagens/' + nome });
}

async function baixarImagem(nome) {
    if (!NOME_VALIDO.test(nome)) throw new Recusa(404, 'Imagem não encontrada');
    const { rows } = await (await banco()).query('SELECT conteudo FROM imagens WHERE nome = $1', [nome]);
    if (rows.length === 0) throw new Recusa(404, 'Imagem não encontrada');
    return new Response(rows[0].conteudo, {
        status: 200,
        headers: {
            'Content-Type': TIPOS[nome.slice(nome.lastIndexOf('.') + 1)],
            'X-Content-Type-Options': 'nosniff',
            // o nome muda a cada envio, entao o navegador pode guardar para sempre
            'Cache-Control': 'private, max-age=31536000, immutable',
        },
    });
}

// ------------------------------------------------------------------ seguranca

function json(status, corpo) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
    });
}

function loginCorreto(cabecalho) {
    if (!cabecalho || !/^basic /i.test(cabecalho)) return false;
    const usuario = process.env.MANGATRACKER_USUARIO || 'manga';
    const esperado = Buffer.from(usuario + ':' + process.env.MANGATRACKER_SENHA, 'utf8');
    const informado = Buffer.from(cabecalho.slice(6).trim(), 'base64');
    // compara os resumos para o tempo nao depender de onde os textos diferem
    const resumo = bytes => createHash('sha256').update(bytes).digest();
    return timingSafeEqual(resumo(esperado), resumo(informado));
}

/** Impede que outro site aberto no navegador altere os dados usando o login de quem esta visitando. */
function vemDeOutroSite(request) {
    const origem = request.headers.get('origin');
    if (!origem || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return origem.toLowerCase() !== ('https://' + host).toLowerCase()
        && origem.toLowerCase() !== ('http://' + host).toLowerCase();
}

async function lerCorpo(request) {
    let corpo;
    try {
        corpo = await request.json();
    } catch {
        throw new Recusa(400, 'O corpo da requisição não é um JSON válido');
    }
    if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
        throw new Recusa(400, 'O corpo da requisição não é um JSON válido');
    }
    return corpo;
}

function lerStatusDaBusca(url) {
    const status = (url.searchParams.get('status') || '').trim().toUpperCase();
    if (status === '') return null;
    if (!Object.hasOwn(STATUS, status)) {
        throw new Recusa(400, 'Status inválido. Use um de: [' + Object.keys(STATUS).join(', ') + ']');
    }
    return status;
}

// ------------------------------------------------------------------ rotas

async function rotear(request) {
    const url = new URL(request.url);
    // o vercel.json manda /api/qualquer/coisa para esta funcao com o caminho em ?__rota=
    const caminho = url.searchParams.has('__rota')
        ? url.searchParams.get('__rota')
        : url.pathname.replace(/^\/api\/?/, '');
    const partes = caminho.split('/').filter(parte => parte !== '').map(decodeURIComponent);
    const metodo = request.method;
    const [recurso, id, acao] = partes;

    if (!process.env.DATABASE_URL) {
        throw new Recusa(503, 'Falta configurar o banco: defina DATABASE_URL nas variáveis de ambiente do Vercel e publique de novo');
    }
    if ((process.env.MANGATRACKER_SENHA || '').length < SENHA_MINIMA) {
        throw new Recusa(503, `Falta configurar a senha do site: defina MANGATRACKER_SENHA (mínimo de ${SENHA_MINIMA} caracteres) nas variáveis de ambiente do Vercel e publique de novo`);
    }
    if (!loginCorreto(request.headers.get('authorization'))) {
        const recusa = json(401, { mensagem: 'Informe o usuário e a senha' });
        recusa.headers.set('WWW-Authenticate', 'Basic realm="Meus Mangas", charset="UTF-8"');
        return recusa;
    }
    if (vemDeOutroSite(request)) throw new Recusa(403, 'Requisição vinda de outro site');

    if (recurso === 'status' && partes.length === 1 && metodo === 'GET') {
        return json(200, Object.entries(STATUS).map(([valor, descricao]) => ({ valor, descricao })));
    }
    if (recurso === 'formatos-decimais' && partes.length === 1 && metodo === 'GET') {
        return json(200, Object.entries(FORMATOS).map(([valor, formato]) => ({ valor, descricao: formato.descricao })));
    }

    if (recurso === 'dias-da-semana' && partes.length === 1 && metodo === 'GET') {
        return json(200, Object.entries(DIAS).map(([valor, descricao]) => ({ valor, descricao })));
    }

    if (recurso === 'imagens') {
        if (partes.length === 1 && metodo === 'POST') return enviarImagem(request);
        if (partes.length === 2 && metodo === 'GET') return baixarImagem(id);
    }

    if (recurso === 'mangas') {
        if (partes.length === 1 && metodo === 'GET') {
            const mangas = await listar(url.searchParams.get('titulo'), lerStatusDaBusca(url));
            return json(200, mangas.map(resposta));
        }
        if (partes.length === 1 && metodo === 'POST') {
            const manga = await montarManga(randomUUID(), await lerCorpo(request));
            await salvar(manga);
            return json(201, resposta(manga));
        }
        // o dia vem do navegador (?dia=QUARTA), porque "hoje" depende do fuso de quem esta usando
        if (partes.length === 2 && id === 'lancamentos' && metodo === 'GET') {
            const dia = (url.searchParams.get('dia') || '').trim().toUpperCase();
            if (!Object.hasOwn(DIAS, dia)) {
                throw new Recusa(400, 'Dia inválido. Use um de: [' + Object.keys(DIAS).join(', ') + ']');
            }
            const mangas = (await listarTodos())
                .filter(manga => manga.readingStatus === 'LENDO' && manga.releaseDay === dia);
            return json(200, mangas.map(resposta));
        }
        if (partes.length === 2 && id === 'sorteio' && metodo === 'GET') {
            const candidatos = (await listar(null, lerStatusDaBusca(url)))
                .filter(manga => !FORA_DO_SORTEIO.includes(manga.readingStatus));
            if (candidatos.length === 0) throw new Recusa(404, 'Nenhum mangá para sortear');
            return json(200, resposta(candidatos[Math.floor(Math.random() * candidatos.length)]));
        }
        if (partes.length === 2 && metodo === 'GET') {
            return json(200, resposta(await buscarPorId(id)));
        }
        if (partes.length === 2 && metodo === 'PUT') {
            const atual = await buscarPorId(id);
            const editado = await montarManga(atual.id, await lerCorpo(request));
            await salvar(editado);
            if (atual.imagePath !== editado.imagePath) await excluirImagemSemUso(atual.imagePath);
            return json(200, resposta(editado));
        }
        if (partes.length === 2 && metodo === 'DELETE') {
            const manga = await buscarPorId(id);
            await (await banco()).query('DELETE FROM mangas WHERE id = $1', [manga.id]);
            await excluirImagemSemUso(manga.imagePath);
            return new Response(null, { status: 204 });
        }
        if (partes.length === 3 && acao === 'progresso' && metodo === 'PATCH') {
            let atual = await buscarPorId(id);
            const corpo = await lerCorpo(request);
            const readingStatus = lerOpcao(corpo.readingStatus, STATUS, 'readingStatus');
            const lastChapter = lerCapitulo(corpo.lastChapter);
            if (lastChapter === null && !readingStatus) {
                throw new Recusa(400, 'Informe o último capítulo lido ou o status');
            }
            if (lastChapter === proximoCapitulo(atual) && !atual.nextChapterUrl) {
                // avancando para o proximo capitulo: antes descobre no site o endereco certo dele
                // (o id da obra ou do capitulo pode ter mudado), para ja salvar o link com o id novo
                atual = (await verificarLink(id)).manga;
            }
            const novoStatus = readingStatus || atual.readingStatus;
            const atualizado = {
                ...atual,
                lastChapter: lastChapter === null ? atual.lastChapter : lastChapter,
                readingStatus: novoStatus,
                // o dia de lancamento so vale enquanto o manga esta sendo lido
                releaseDay: novoStatus === 'LENDO' ? atual.releaseDay ?? null : null,
            };
            if (atualizado.lastChapter !== atual.lastChapter) {
                // os enderecos exatos eram do capitulo anterior
                atualizado.lastChapterUrl = atualizado.lastChapter === proximoCapitulo(atual) ? atual.nextChapterUrl ?? null : null;
                atualizado.nextChapterUrl = null;
            }
            await salvar(atualizado);
            return json(200, resposta(atualizado));
        }
        // manda o navegador para o proximo capitulo ainda nao lido, no site salvo.
        // antes confere o link no site, para ja abrir o endereco certo se ele tiver mudado
        if (partes.length === 3 && acao === 'ler' && metodo === 'GET') {
            const { situacao, manga } = await verificarLink(id);
            let destino = resposta(manga).nextChapterLink;
            // o capitulo nao existe no site: em vez de abrir uma pagina de erro de la, volta para o manga com o aviso
            if (situacao === 'NAO_ENCONTRADO') destino = '/#/manga/' + manga.id + '/sem-capitulo';
            if (situacao === 'LINK_QUEBRADO') destino = '/#/manga/' + manga.id + '/link-quebrado';
            // o site nao deixou verificar e so se conhece o endereco exato do ultimo capitulo lido: montar o proximo
            // pelo modelo daria um link errado, entao abre o ultimo lido, que tem o botao de proximo do site
            if (situacao === 'NAO_VERIFICADO' && !manga.nextChapterUrl && manga.lastChapterUrl) destino = manga.lastChapterUrl;
            return new Response(null, { status: 302, headers: { Location: destino } });
        }
        if (partes.length === 3 && acao === 'capitulo-lido' && metodo === 'POST') {
            const atual = await buscarPorId(id);
            const corpo = await lerCorpo(request);
            const lastChapter = lerCapitulo(corpo.lastChapter);
            if (lastChapter === null) throw new Recusa(400, 'O último capítulo lido é obrigatório');
            if (!isUrlHttp(corpo.lastChapterUrl)) {
                throw new Recusa(400, 'O link do capítulo lido precisa ser um endereço http:// ou https:// válido');
            }
            const temProximo = typeof corpo.nextChapterUrl === 'string' && corpo.nextChapterUrl.trim() !== '';
            if (temProximo && !isUrlHttp(corpo.nextChapterUrl)) {
                throw new Recusa(400, 'O link do próximo capítulo precisa ser um endereço http:// ou https:// válido');
            }
            const semFinal = endereco => endereco.trim().split('#')[0].replace(/\/+$/, '');
            const atualizado = {
                ...atual,
                lastChapter,
                lastChapterUrl: corpo.lastChapterUrl.trim(),
                nextChapterUrl: temProximo && semFinal(corpo.nextChapterUrl) !== semFinal(corpo.lastChapterUrl)
                    ? corpo.nextChapterUrl.trim() : null,
            };
            await salvar(atualizado);
            return json(200, resposta(atualizado));
        }
        if (partes.length === 3 && acao === 'verificacao-link' && metodo === 'POST') {
            const resultado = await verificarLink(id);
            return json(200, { ...resultado, manga: resposta(resultado.manga) });
        }
    }
    throw new Recusa(404, 'Rota não encontrada');
}

async function tratar(request) {
    try {
        return await rotear(request);
    } catch (erro) {
        if (erro instanceof Recusa) return json(erro.status, { mensagem: erro.message });
        console.error('Erro inesperado em', request.method, request.url, erro);
        return json(500, { mensagem: 'Erro inesperado' });
    }
}

export { tratar as GET, tratar as POST, tratar as PUT, tratar as PATCH, tratar as DELETE };
