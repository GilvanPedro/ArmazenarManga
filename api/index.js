// API do site para o Vercel, que nao roda Java. Faz o mesmo que o backend Java
// (src/main/java/.../web/ApiServer.java) e usa o mesmo banco Postgres, com as mesmas tabelas.
// Uma mudanca de regra precisa ser feita nos dois lugares.
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { criarBuscador, criarVerificador, derivarModelo, mensagemDaVerificacao, mesmoEndereco } from './_verificador.js';
import { criarBuscadorDeSinopse } from './_sinopse.js';
import { COOKIE, DURACAO_SEGUNDOS, contaDoCookie, criarSessao, lerCookie, segredoDoTexto, textoDoCookie, validarSessao } from './_sessao.js';
import { DadoInvalidoNaComunidade, ESTRUTURA_DA_COMUNIDADE, criarComunidade } from './_comunidade_rotas.js';
import { DadoInvalido, gastarTempoDeUmaSenha, gerarHash, normalizarEmail, senhaConfere, validarEmail, validarNick, validarSenha } from './_contas.js';
import { criarBuscadorDeRecomendacoes, nomesDoLink, ORDENS, TITULOS_POR_PEDIDO } from './_recomendacoes.js';

const buscarSinopse = criarBuscadorDeSinopse();
const buscarRecomendacoes = criarBuscadorDeRecomendacoes();
const TAMANHO_DA_PAGINA = 24; // 4 fileiras de 6 colunas
const TAMANHO_MAXIMO_DA_PAGINA = 100;
const TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA = 2000;

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
// tags oferecidas no cadastro mesmo antes de serem usadas (generos e temas comuns, em ingles)
const TAGS_SUGERIDAS = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Psychological', 'Romance',
    'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
    'Dungeon', 'Historical', 'Isekai', 'Magic', 'Martial Arts', 'Murim', 'Regression', 'Reincarnation',
    'Revenge', 'School Life', 'System', 'Villainess'];
const MARCADOR = '{cap}';
// o Vercel recusa requisicoes maiores que 4,5 MB
const TAMANHO_MAXIMO = 4 * 1024 * 1024;
const TIPOS = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
// "-mini" e a miniatura de uma capa enviada
const NOME_VALIDO = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(-mini)?\.(png|jpg|gif|webp)$/;
const NOME_DE_CAPA = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;
const TAMANHO_MAXIMO_DA_MINIATURA = 300 * 1024;
const ID_VALIDO = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Erro que vira uma resposta {"mensagem": ...} com o status informado. */
class Recusa extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

// ------------------------------------------------------------------ banco e conta

/**
 * Cada manga e cada capa pertencem a uma conta, e toda consulta filtra pela conta de quem esta usando, que vem da
 * sessao (veja rotear). Sem sessao nao ha conta, e qualquer consulta de dados falha em vez de cair na conta de
 * outra pessoa. "principal" e a conta de antes do cadastro de contas: os mangas dela esperam ser trazidos para
 * uma conta de verdade (POST /api/conta/mangas-antigos).
 */
const CONTA_ANTIGA = 'principal';
const contexto = new AsyncLocalStorage();
function contaAtual() {
    const conta = contexto.getStore()?.conta;
    if (!conta) throw new Error('Consulta de dados sem conta');
    return conta;
}

let conexoes;
let tabelasProntas;

/**
 * Cria e atualiza as tabelas. So acrescenta (colunas, indices), nunca apaga: roda igual em um banco novo e em um
 * que ja tem dados. A trava garante que duas instancias da funcao nao facam isso ao mesmo tempo.
 */
const ESTRUTURA = `
    SELECT pg_advisory_xact_lock(7316250);
    CREATE TABLE IF NOT EXISTS mangas (id UUID PRIMARY KEY, ordem BIGSERIAL, dados JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS imagens (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL);
    CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tentativas_de_login (quando TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE mangas ADD COLUMN IF NOT EXISTS conta TEXT NOT NULL DEFAULT 'principal';
    ALTER TABLE mangas ADD COLUMN IF NOT EXISTS titulo_busca TEXT;
    ALTER TABLE mangas ADD COLUMN IF NOT EXISTS tags_busca TEXT[];
    ALTER TABLE imagens ADD COLUMN IF NOT EXISTS conta TEXT NOT NULL DEFAULT 'principal';
    CREATE INDEX IF NOT EXISTS mangas_conta_ordem ON mangas (conta, ordem);
    CREATE INDEX IF NOT EXISTS mangas_conta_titulo ON mangas (conta, titulo_busca COLLATE "C");
    CREATE INDEX IF NOT EXISTS mangas_conta_status ON mangas (conta, (dados->>'readingStatus'));
    CREATE INDEX IF NOT EXISTS mangas_conta_imagem ON mangas (conta, (dados->>'imagePath'));
    CREATE INDEX IF NOT EXISTS mangas_tags_busca ON mangas USING GIN (tags_busca);
    CREATE TABLE IF NOT EXISTS contas (id UUID PRIMARY KEY, email TEXT NOT NULL, nick TEXT NOT NULL, senha_hash TEXT NOT NULL,
        admin BOOLEAN NOT NULL DEFAULT false, criada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX IF NOT EXISTS contas_email ON contas (email);
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS foto TEXT;
    ALTER TABLE tentativas_de_login ADD COLUMN IF NOT EXISTS chave TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS tentativas_chave ON tentativas_de_login (chave, quando);
` + ESTRUTURA_DA_COMUNIDADE;

async function banco() {
    if (!conexoes) {
        // poucas conexoes: cada instancia da funcao atende uma requisicao por vez
        conexoes = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10_000 });
    }
    if (!tabelasProntas) {
        tabelasProntas = conexoes.query(ESTRUTURA).then(() => preencherColunasDeBusca(conexoes)).catch(erro => {
            tabelasProntas = null;
            throw erro;
        });
    }
    await tabelasProntas;
    return conexoes;
}

/** Colunas que o banco usa para buscar e ordenar sem abrir o JSON de cada manga. Atualizadas a cada gravacao. */
function colunasDeBusca(manga) {
    return {
        titulo: semAcentos(manga.title),
        tags: [...new Set((manga.tags || []).map(normalizar).filter(Boolean))],
    };
}

/** Mangas gravados antes das colunas de busca existirem ganham as colunas preenchidas (uma vez, aos poucos). */
async function preencherColunasDeBusca(db) {
    for (;;) {
        const { rows } = await db.query('SELECT id, dados FROM mangas WHERE titulo_busca IS NULL LIMIT 500');
        if (rows.length === 0) return;
        // uma gravacao para cada 500 mangas, e nao uma por manga
        const colunas = rows.map(({ id, dados }) => ({ id, ...colunasDeBusca(dados) }));
        await db.query(
            `UPDATE mangas SET titulo_busca = v.titulo, tags_busca = ARRAY(SELECT jsonb_array_elements_text(v.tags))
             FROM jsonb_to_recordset($1::jsonb) AS v (id uuid, titulo text, tags jsonb) WHERE mangas.id = v.id`,
            [JSON.stringify(colunas)]);
    }
}

/** O manga sem os campos que so a pagina dele usa: para listas grandes. */
const SEM_DESCRICAO = "dados - 'description'";

async function buscarPorId(id) {
    if (!ID_VALIDO.test(id)) throw new Recusa(404, 'Mangá não encontrado');
    const { rows } = await (await banco()).query('SELECT dados FROM mangas WHERE id = $1 AND conta = $2', [id, contaAtual()]);
    if (rows.length === 0) throw new Recusa(404, 'Mangá não encontrado');
    return rows[0].dados;
}

async function salvar(manga) {
    const { titulo, tags } = colunasDeBusca(manga);
    // o WHERE impede gravar por cima do manga de outra conta que tenha o mesmo id
    await (await banco()).query(
        `INSERT INTO mangas (id, dados, conta, titulo_busca, tags_busca) VALUES ($1, $2::jsonb, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, titulo_busca = EXCLUDED.titulo_busca, tags_busca = EXCLUDED.tags_busca
         WHERE mangas.conta = EXCLUDED.conta`,
        [manga.id, JSON.stringify(manga), contaAtual(), titulo, tags]);
}

async function imagemExiste(nome) {
    if (typeof nome !== 'string' || !NOME_VALIDO.test(nome)) return false;
    const { rows } = await (await banco()).query('SELECT 1 FROM imagens WHERE nome = $1 AND conta = $2', [nome, contaAtual()]);
    return rows.length > 0;
}

/** Apaga a capa enviada se nenhum manga usa mais. Links de fora sao ignorados. */
async function excluirImagemSemUso(imagePath) {
    if (typeof imagePath !== 'string' || !NOME_VALIDO.test(imagePath)) return;
    const db = await banco();
    // em uso por um manga da conta, ou como foto de perfil dela
    const { rows } = await db.query(
        `SELECT 1 FROM mangas WHERE conta = $1 AND dados->>'imagePath' = $2
         UNION ALL SELECT 1 FROM contas WHERE id::text = $1 AND foto = $2 LIMIT 1`, [contaAtual(), imagePath]);
    if (rows.length === 0) {
        const base = imagePath.slice(0, imagePath.lastIndexOf('.'));
        // a capa e a miniatura dela
        await db.query('DELETE FROM imagens WHERE conta = $1 AND nome = ANY($2)', [contaAtual(), [imagePath, base + '-mini.webp', base + '-mini.jpg']]);
    }
}

/**
 * Miniaturas que existem para as capas destes mangas: nome da capa (sem extensao) -> nome da miniatura. Procura so
 * pelos nomes possiveis (pela chave da tabela), entao o custo depende dos mangas pedidos, e nao do total guardado.
 */
async function miniaturas(mangas) {
    const nomes = mangas.map(manga => manga.imagePath).filter(nome => typeof nome === 'string' && NOME_DE_CAPA.test(nome))
        .flatMap(nome => { const base = nome.slice(0, nome.lastIndexOf('.')); return [base + '-mini.webp', base + '-mini.jpg']; });
    if (nomes.length === 0) return new Map();
    const { rows } = await (await banco()).query('SELECT nome FROM imagens WHERE nome = ANY($1) AND conta = $2', [nomes, contaAtual()]);
    return new Map(rows.map(({ nome }) => [nome.slice(0, nome.lastIndexOf('-mini.')), nome]));
}

/**
 * Guarda uma versao pequena da capa enviada, feita pelo navegador, para a lista mostrar no lugar da original.
 * A capa original nao muda. Corpo: a imagem (WebP ou JPEG, ate 300 KB).
 */
async function guardarMiniatura(nomeDaCapa, request) {
    if (!NOME_DE_CAPA.test(nomeDaCapa) || !(await imagemExiste(nomeDaCapa))) throw new Recusa(404, 'Imagem não encontrada');
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0) throw new Recusa(400, 'A miniatura está vazia');
    if (bytes.length > TAMANHO_MAXIMO_DA_MINIATURA) throw new Recusa(400, 'A miniatura pode ter no máximo 300 KB');
    const extensao = descobrirExtensao(bytes);
    if (extensao !== 'webp' && extensao !== 'jpg') throw new Recusa(400, 'A miniatura precisa ser WEBP ou JPG');
    const base = nomeDaCapa.slice(0, nomeDaCapa.lastIndexOf('.'));
    const nome = base + '-mini.' + extensao;
    const db = await banco();
    // uma miniatura so por capa
    await db.query('DELETE FROM imagens WHERE nome = $1 AND conta = $2', [base + (extensao === 'webp' ? '-mini.jpg' : '-mini.webp'), contaAtual()]);
    await db.query(`INSERT INTO imagens (nome, conteudo, conta) VALUES ($1, $2, $3)
                    ON CONFLICT (nome) DO UPDATE SET conteudo = EXCLUDED.conteudo WHERE imagens.conta = EXCLUDED.conta`, [nome, bytes, contaAtual()]);
    return json(200, { thumbUrl: '/api/imagens/' + nome });
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

/** Nota de 0 a 10; null, ausente ou vazio = sem nota. */
function lerNota(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor !== 'number' || !Number.isInteger(valor)) throw new Recusa(400, "Valor inválido no campo 'rating'");
    if (valor < 0 || valor > 10) throw new Recusa(400, 'A nota precisa ser um número inteiro de 0 a 10');
    return valor;
}

function lerTexto(valor, campo) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') return String(valor);
    if (typeof valor !== 'string') throw new Recusa(400, `Valor inválido no campo '${campo}'`);
    return valor;
}

/** Tira espacos, vazios e repetidos (sem diferenciar maiusculas). */
/**
 * Tira espacos, vazios e repetidos (sem diferenciar maiusculas).
 * Uma tag que ja existe na lista geral entra com o nome de la ("action" vira "Action"),
 * para a mesma tag nao aparecer escrita de dois jeitos; so nome novo cria tag nova.
 */
function montarTags(nomes, existentes) {
    if (nomes === null || nomes === undefined) return [];
    if (!Array.isArray(nomes)) throw new Recusa(400, "Valor inválido no campo 'tags'");
    const nomeNaListaGeral = new Map();
    for (const existente of existentes) {
        if (!nomeNaListaGeral.has(normalizar(existente.nome))) nomeNaListaGeral.set(normalizar(existente.nome), existente.nome);
    }
    const tags = [];
    const vistos = new Set();
    for (const nome of nomes) {
        if (typeof nome !== 'string' || nome.trim() === '') continue;
        const limpo = nome.trim().replace(/\s+/g, ' ');
        if (!vistos.has(normalizar(limpo))) {
            vistos.add(normalizar(limpo));
            tags.push(nomeNaListaGeral.get(normalizar(limpo)) ?? limpo);
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
    const rating = lerNota(dados.rating);
    const tags = montarTags(dados.tags, await listarTags());

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
        rating,
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

/** Guarda a hora em que o capitulo avancou; se nao avancou (ficou igual ou voltou), mantem a que ja havia. */
function anotarLeitura(antes, depois) {
    depois.lastChapterAt = depois.lastChapter > antes.lastChapter ? new Date().toISOString() : antes.lastChapterAt ?? null;
}

/** Manga do jeito que a API devolve: os dados salvos + os links ja montados. */
/** @param miniaturas as miniaturas guardadas (de miniaturas()); sem elas, thumbUrl fica null */
function resposta(manga, miniaturasGuardadas) {
    const miniatura = miniaturasGuardadas instanceof Map && NOME_DE_CAPA.test(manga.imagePath || '')
        ? miniaturasGuardadas.get(manga.imagePath.slice(0, manga.imagePath.lastIndexOf('.'))) : null;
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
        // outros nomes da mesma obra ja descobertos; as marcas internas ("anilist:123") nao sao nomes
        altTitles: (Array.isArray(manga.altTitles) ? manga.altTitles : []).filter(nome => typeof nome === 'string' && !nome.startsWith('anilist:')),
        nextChapterLinkExact: Boolean(manga.nextChapterUrl),
        // nota de 0 a 10 dada pelo dono da lista; null = sem nota
        rating: notaDe(manga),
        favorite: manga.favorite === true,
        // versao pequena da capa, para a lista; null quando ainda nao existe (use imageUrl)
        thumbUrl: miniatura ? '/api/imagens/' + miniatura : null,
    };
}

const tagsNormalizadas = manga => new Set((manga.tags || []).map(normalizar).filter(Boolean));

/** Ordem de cada forma de ordenar, feita pelo banco. Empates ficam pelo titulo e, depois, pela ordem de cadastro. */
const TITULO_SQL = 'titulo_busca COLLATE "C"';
const NOTA_SQL = "CASE WHEN dados->>'rating' ~ '^(10|[0-9])$' THEN (dados->>'rating')::int END";
const ORDEM_SQL = {
    CADASTRO: 'ordem',
    RECENTES: 'ordem DESC',
    TITULO: `${TITULO_SQL}, ordem`,
    TITULO_DESC: `${TITULO_SQL} DESC, ordem`,
    MAIS_CAPITULOS: `(dados->>'lastChapter')::numeric DESC, ${TITULO_SQL}, ordem`,
    MENOS_CAPITULOS: `(dados->>'lastChapter')::numeric, ${TITULO_SQL}, ordem`,
    // quem nao tem nota fica sempre no fim, nas duas ordens
    MELHORES_NOTAS: `${NOTA_SQL} DESC NULLS LAST, ${TITULO_SQL}, ordem`,
    PIORES_NOTAS: `${NOTA_SQL} NULLS LAST, ${TITULO_SQL}, ordem`,
    // os favoritos sobem e o resto continua na ordem de cadastro
    FAVORITOS: `(dados->>'favorite' = 'true') IS NOT TRUE, ordem`,
};

/**
 * Mangas da conta, filtrados, ordenados e paginados pelo proprio banco: so a pagina pedida sai de la. Devolve
 * { mangas, total }. limite null = todos.
 */
function filtrosEmSql({ titulo, status, tag }) {
    const valores = [contaAtual()];
    const condicoes = ['conta = $1'];
    if (status) {
        valores.push(status);
        condicoes.push(`dados->>'readingStatus' = $${valores.length}`);
    }
    const busca = normalizar(titulo);
    if (busca) {
        valores.push(busca);
        condicoes.push(`strpos(titulo_busca, $${valores.length}) > 0`);
    }
    const tagBuscada = normalizar(tag);
    if (tagBuscada) {
        valores.push([tagBuscada]);
        condicoes.push(`tags_busca @> $${valores.length}::text[]`);
    }
    return { valores, onde: condicoes.join(' AND ') };
}

/** Quantos mangas da conta passam nos filtros. */
async function contar(filtros) {
    const { valores, onde } = filtrosEmSql(filtros);
    const { rows } = await (await banco()).query(`SELECT count(*) AS total FROM mangas WHERE ${onde}`, valores);
    return Number(rows[0].total);
}

async function consultar({ titulo, status, tag, ordem = 'CADASTRO', limite = null, deslocamento = 0, resumida = false } = {}) {
    const { valores, onde } = filtrosEmSql({ titulo, status, tag });
    let pagina = '';
    if (limite !== null) {
        valores.push(limite, deslocamento);
        pagina = `LIMIT $${valores.length - 1} OFFSET $${valores.length}`;
    }
    const { rows } = await (await banco()).query(
        `SELECT ${resumida ? SEM_DESCRICAO : 'dados'} AS dados, count(*) OVER () AS total FROM mangas
         WHERE ${onde} ORDER BY ${ORDEM_SQL[ordem] || ORDEM_SQL.CADASTRO} ${pagina}`, valores);
    // pagina alem do fim: so conta, para quem pediu saber quantas paginas existem
    const total = rows.length ? Number(rows[0].total) : deslocamento > 0 ? await contar({ titulo, status, tag }) : 0;
    return { mangas: rows.map(linha => linha.dados), total };
}

/** Lista geral de tags: as que estao em uso (as mais usadas primeiro) e depois as sugeridas ainda sem uso. */
async function listarTags() {
    // conta por nome sem diferenciar maiusculas nem acentos; o nome mostrado e o primeiro que apareceu
    const nomes = new Map();
    const quantidades = new Map();
    // so as tags, e nao o manga inteiro, saem do banco
    const { rows } = await (await banco()).query("SELECT dados->'tags' AS tags FROM mangas WHERE conta = $1", [contaAtual()]);
    for (const manga of rows) {
        const doManga = new Set();
        for (const tag of manga.tags || []) {
            const chave = normalizar(tag);
            if (!chave || doManga.has(chave)) continue;
            doManga.add(chave);
            if (!nomes.has(chave)) nomes.set(chave, String(tag).trim());
            quantidades.set(chave, (quantidades.get(chave) || 0) + 1);
        }
    }
    const tags = [...nomes].map(([chave, nome]) => ({ nome, quantidade: quantidades.get(chave) }))
        .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'en', { sensitivity: 'base' }));
    for (const sugerida of TAGS_SUGERIDAS) {
        if (!nomes.has(normalizar(sugerida))) tags.push({ nome: sugerida, quantidade: 0 });
    }
    return tags;
}

// ------------------------------------------------------------------ recomendacoes e ordenacao

/**
 * Todos os nomes pelos quais os mangas da lista sao conhecidos, para nao sugerir o que ja esta cadastrado:
 * o titulo, os outros nomes da obra e o nome que vem no link de leitura.
 */
async function nomesDosCadastrados() {
    // antes, descobre os outros nomes dos mangas da lista que ainda nao foram consultados (alguns por vez)
    // so os campos com nomes saem do banco
    const nomesDaConta = async () => (await (await banco()).query(
        `SELECT jsonb_build_object('id', dados->'id', 'title', dados->'title', 'altTitles', dados->'altTitles',
                'chapterLinkModel', dados->'chapterLinkModel', 'lastChapterUrl', dados->'lastChapterUrl') AS dados
         FROM mangas WHERE conta = $1 ORDER BY ordem`, [contaAtual()])).rows.map(linha => linha.dados);
    let lista = await nomesDaConta();
    const semNomes = lista.filter(cadastrado => !Array.isArray(cadastrado.altTitles)).slice(0, TITULOS_POR_PEDIDO);
    if (semNomes.length > 0) {
        const nomes = await buscarRecomendacoes.nomesAlternativos(semNomes.map(cadastrado => cadastrado.title));
        const db = await banco();
        for (const cadastrado of semNomes) {
            if (!nomes.has(cadastrado.title)) continue;
            // so esse campo e so se o titulo continua o mesmo: nao desfaz uma mudanca feita enquanto a busca corria
            await db.query(`UPDATE mangas SET dados = jsonb_set(dados, '{altTitles}', $2::jsonb) WHERE id = $1 AND conta = $4 AND dados->>'title' = $3`,
                [cadastrado.id, JSON.stringify(nomes.get(cadastrado.title)), cadastrado.title, contaAtual()]);
        }
        lista = await nomesDaConta();
    }
    return lista.flatMap(cadastrado => [cadastrado.title, ...(Array.isArray(cadastrado.altTitles) ? cadastrado.altTitles : []),
        ...nomesDoLink(cadastrado.chapterLinkModel), ...nomesDoLink(cadastrado.lastChapterUrl)]);
}

/** Formas de ordenar a lista de mangas cadastrados (?ordem=). A lista chega na ordem de cadastro. */
const semAcentos = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
// a ordem em si e feita pelo banco (ORDEM_SQL)
const ORDENS_DA_LISTA = {
    CADASTRO: { descricao: 'Ordem de cadastro' },
    RECENTES: { descricao: 'Adicionados por último' },
    TITULO: { descricao: 'Título (A–Z)' },
    TITULO_DESC: { descricao: 'Título (Z–A)' },
    MAIS_CAPITULOS: { descricao: 'Mais capítulos lidos' },
    MENOS_CAPITULOS: { descricao: 'Menos capítulos lidos' },
    MELHORES_NOTAS: { descricao: 'Melhores notas' },
    PIORES_NOTAS: { descricao: 'Piores notas' },
    FAVORITOS: { descricao: 'Favoritos primeiro' },
};

/** Nota valida do manga guardado, ou null. */
function notaDe(manga) {
    return Number.isInteger(manga.rating) && manga.rating >= 0 && manga.rating <= 10 ? manga.rating : null;
}


function lerOrdem(url, ordens, padrao) {
    const ordem = (url.searchParams.get('ordem') || '').trim().toUpperCase();
    if (ordem === '') return padrao;
    if (!Object.hasOwn(ordens, ordem)) throw new Recusa(400, 'Ordem inválida. Use uma de: [' + Object.keys(ordens).join(', ') + ']');
    return ordem;
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
    await (await banco()).query('INSERT INTO imagens (nome, conteudo, conta) VALUES ($1, $2, $3)', [nome, bytes, contaAtual()]);
    return json(201, { imagePath: nome, imageUrl: '/api/imagens/' + nome });
}

async function baixarImagem(nome) {
    if (!NOME_VALIDO.test(nome)) throw new Recusa(404, 'Imagem não encontrada');
    const { rows } = await (await banco()).query('SELECT conteudo FROM imagens WHERE nome = $1 AND conta = $2', [nome, contaAtual()]);
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

// ------------------------------------------------------------------ login

let segredoGuardado;

/**
 * Segredo que assina os cookies de login. Vem de MANGATRACKER_SEGREDO, se definida; senao e criado sozinho na
 * primeira vez e guardado no banco (a versao Java le o mesmo, para um login valer nas duas). Apagar desfaz os logins.
 */
async function segredoDaSessao() {
    const daVariavel = segredoDoTexto(process.env.MANGATRACKER_SEGREDO);
    if (daVariavel) return daVariavel;
    if (!segredoGuardado) {
        const conexao = await banco();
        // se dois servidores criarem ao mesmo tempo, fica o primeiro
        await conexao.query('INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO NOTHING',
            ['segredo-da-sessao', randomBytes(32).toString('base64')]);
        const { rows } = await conexao.query('SELECT valor FROM configuracoes WHERE chave = $1', ['segredo-da-sessao']);
        const segredo = rows.length ? Buffer.from(rows[0].valor, 'base64') : Buffer.alloc(0);
        if (segredo.length < 32) throw new Error('O segredo do login guardado no banco está estragado');
        segredoGuardado = segredo;
    }
    return segredoGuardado;
}

/** A conta do cookie, se o login for verdadeiro e valer ainda: { conta, expira } ou null. */
async function sessaoValida(request) {
    const cookie = lerCookie(request.headers.get('cookie'), COOKIE);
    const id = contaDoCookie(cookie);
    if (!id) return null;
    const { rows } = await (await banco()).query('SELECT id, email, nick, senha_hash, admin, criada_em, foto FROM contas WHERE id = $1', [id]);
    if (rows.length === 0) return null; // conta excluida
    const expira = validarSessao(cookie, await segredoDaSessao(), rows[0].id, rows[0].senha_hash);
    return expira ? { conta: rows[0], expira } : null;
}

function usaHttps(request) {
    return new URL(request.url).protocol === 'https:' || (request.headers.get('x-forwarded-proto') || '').toLowerCase() === 'https';
}

function semCache(resposta) {
    resposta.headers.set('Cache-Control', 'no-store');
    return resposta;
}

/**
 * Contas de administracao: as marcadas no banco e as dos e-mails em MANGATRACKER_ADMIN_EMAIL (separados por virgula).
 * Pela variavel, o dono do site se torna admin sem precisar mexer no banco.
 */
function ehAdmin(conta) {
    const emails = (process.env.MANGATRACKER_ADMIN_EMAIL || '').split(',').map(normalizarEmail).filter(Boolean);
    return conta.admin === true || emails.includes(normalizarEmail(conta.email));
}

/** A conta como o site ve: nunca leva a senha guardada. */
const contaPublica = conta => ({
    id: conta.id, email: conta.email, nick: conta.nick, admin: ehAdmin(conta),
    // a foto e uma imagem da propria conta: so quem esta nela consegue abrir
    foto: conta.foto ? '/api/imagens/' + conta.foto : null,
});

const respostaDaSessao = sessao => ({
    exigeLogin: true,
    logado: Boolean(sessao),
    conta: sessao ? contaPublica(sessao.conta) : null,
    expiraEm: sessao ? sessao.expira.toISOString() : null,
});

/** Entra na conta: grava o cookie de 30 dias e responde como GET /api/sessao. */
async function entrarNaConta(request, conta, status = 200) {
    const segredo = await segredoDaSessao();
    const cookie = criarSessao(segredo, conta.id, conta.senha_hash);
    const resposta = semCache(json(status, respostaDaSessao({ conta, expira: validarSessao(cookie, segredo, conta.id, conta.senha_hash) })));
    resposta.headers.set('Set-Cookie', textoDoCookie(cookie, DURACAO_SEGUNDOS, usaHttps(request)));
    return resposta;
}

function apagarCookie(request, resposta) {
    resposta.headers.set('Set-Cookie', textoDoCookie('', 0, usaHttps(request)));
    return resposta;
}

// ------------------------------------------------------------------ limites de tentativas

/**
 * Freia quem tenta adivinhar senhas ou criar contas em massa. As tentativas ficam no banco, porque cada chamada
 * pode cair em uma instancia diferente da funcao. Quem ja entrou continua dentro.
 */
const LIMITES = {
    // senha errada de um e-mail: 10 em 15 minutos
    login: { maximo: 10, minutos: 15 },
    // senha errada no site inteiro, somando todos os e-mails: 100 em 15 minutos
    loginGeral: { maximo: 100, minutos: 15 },
    // contas criadas no site inteiro: 20 por hora
    cadastro: { maximo: 20, minutos: 60 },
};

/** Minutos de espera antes de poder tentar de novo (0 = pode agora). chave com % no fim conta todas que comecam assim. */
async function minutosDeEspera(chave, { maximo, minutos }) {
    const { rows } = await (await banco()).query(
        `SELECT count(*)::int AS vezes, extract(epoch FROM min(quando) + make_interval(mins => $2) - now()) AS faltam
         FROM tentativas_de_login WHERE chave LIKE $1 AND quando > now() - make_interval(mins => $2)`, [chave, minutos]);
    return rows[0].vezes < maximo ? 0 : Math.max(1, Math.ceil(Number(rows[0].faltam) / 60));
}

async function registrarTentativa(chave) {
    const conexao = await banco();
    await conexao.query('INSERT INTO tentativas_de_login (chave) VALUES ($1)', [chave]);
    await conexao.query("DELETE FROM tentativas_de_login WHERE quando < now() - interval '1 day'");
}

async function exigirQueNaoEstejaFreado(chave, limite) {
    const espera = await minutosDeEspera(chave, limite);
    if (espera > 0) throw new Recusa(429, `Muitas tentativas. Tente de novo em ${espera} ${espera === 1 ? 'minuto' : 'minutos'}`);
}

// a chave do e-mail nao pode ter % nem _, que o LIKE leria como curinga
const chaveDoLogin = email => 'login:' + normalizarEmail(email).replace(/[%_\\]/g, '');

// ------------------------------------------------------------------ rotas de sessao e de conta

/** GET ve se entrou, POST entra (e-mail e senha), DELETE sai (so neste navegador). */
async function tratarSessao(request) {
    if (request.method === 'GET') return semCache(json(200, respostaDaSessao(await sessaoValida(request))));
    if (request.method === 'DELETE') return apagarCookie(request, semCache(new Response(null, { status: 204 })));
    if (request.method !== 'POST') throw new Recusa(404, 'Endereço não encontrado');
    const { email, senha } = await lerCorpo(request);
    if (typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || senha === '') throw new Recusa(400, 'Informe o e-mail e a senha');
    const chave = chaveDoLogin(email);
    await exigirQueNaoEstejaFreado(chave, LIMITES.login);
    await exigirQueNaoEstejaFreado('login:%', LIMITES.loginGeral);
    const { rows } = await (await banco()).query('SELECT * FROM contas WHERE email = $1', [normalizarEmail(email)]);
    // a mesma resposta e o mesmo tempo para e-mail que nao existe e senha errada
    const certo = rows.length ? await senhaConfere(senha, rows[0].senha_hash) : (await gastarTempoDeUmaSenha(senha), false);
    if (!certo) {
        await registrarTentativa(chave);
        throw new Recusa(401, 'E-mail ou senha incorretos');
    }
    return entrarNaConta(request, rows[0]);
}

/** POST /api/contas: cria a conta e ja entra nela. */
async function criarConta(request) {
    const dados = await lerCorpo(request);
    const email = validarEmail(dados.email);
    const nick = validarNick(dados.nick);
    const senha = validarSenha(dados.senha);
    await exigirQueNaoEstejaFreado('cadastro', LIMITES.cadastro);
    const senhaHash = await gerarHash(senha);
    const { rows } = await (await banco()).query(
        `INSERT INTO contas (id, email, nick, senha_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING *`,
        [randomUUID(), email, nick, senhaHash]);
    if (rows.length === 0) throw new Recusa(409, 'Já existe uma conta com esse e-mail');
    await registrarTentativa('cadastro');
    return entrarNaConta(request, rows[0], 201);
}

/** Confere a senha atual antes de mudancas que pedem ela (trocar e-mail ou senha, excluir a conta). */
async function exigirSenhaAtual(conta, senha) {
    const chave = chaveDoLogin(conta.email);
    await exigirQueNaoEstejaFreado(chave, LIMITES.login);
    if (typeof senha !== 'string' || senha === '') throw new Recusa(400, 'Confirme com a sua senha atual');
    if (!(await senhaConfere(senha, conta.senha_hash))) {
        await registrarTentativa(chave);
        throw new Recusa(403, 'Senha atual incorreta');
    }
}

/** A conta de quem esta usando: GET mostra, PUT edita, DELETE exclui (com a senha). */
async function tratarConta(request, sessao, acao) {
    const db = await banco();
    const conta = sessao.conta;
    if (acao === 'mangas-antigos' && request.method === 'POST') return trazerMangasAntigos(request, conta);
    if (acao) throw new Recusa(404, 'Endereço não encontrado');
    if (request.method === 'GET') {
        const { rows } = await db.query(
            `SELECT (SELECT count(*) FROM mangas WHERE conta = $1)::int AS mangas, (SELECT count(*) FROM mangas WHERE conta = $2)::int AS antigos`,
            [conta.id, CONTA_ANTIGA]);
        return semCache(json(200, {
            ...contaPublica(conta),
            criadaEm: conta.criada_em,
            mangas: rows[0].mangas,
            // os mangas de antes das contas: so os admins veem e podem trazer
            mangasAntigos: ehAdmin(conta) ? rows[0].antigos : 0,
        }));
    }
    if (request.method === 'PUT') {
        const dados = await lerCorpo(request);
        const nick = dados.nick === undefined ? conta.nick : validarNick(dados.nick);
        const email = dados.email === undefined ? conta.email : validarEmail(dados.email);
        const senhaNova = dados.senhaNova === undefined || dados.senhaNova === '' ? null : validarSenha(dados.senhaNova);
        // trocar o e-mail ou a senha pede a senha atual; o nick, nao
        if (email !== conta.email || senhaNova) await exigirSenhaAtual(conta, dados.senhaAtual);
        const senhaHash = senhaNova ? await gerarHash(senhaNova) : conta.senha_hash;
        // foto: o nome de uma imagem ja enviada por esta conta (POST /api/imagens), ou null para tirar
        let foto = conta.foto ?? null;
        if (dados.foto !== undefined) {
            if (dados.foto !== null && (typeof dados.foto !== 'string' || !NOME_DE_CAPA.test(dados.foto) || !(await imagemExiste(dados.foto)))) {
                throw new Recusa(400, 'A foto informada não existe. Envie a imagem antes');
            }
            foto = dados.foto;
        }
        let rows;
        try {
            ({ rows } = await db.query('UPDATE contas SET nick = $2, email = $3, senha_hash = $4, foto = $5 WHERE id = $1 RETURNING *',
                [conta.id, nick, email, senhaHash, foto]));
        } catch (erro) {
            if (erro.code === '23505') throw new Recusa(409, 'Já existe uma conta com esse e-mail');
            throw erro;
        }
        // a foto antiga deixa de ser usada: sai do banco (a nao ser que algum manga use a mesma imagem)
        if (conta.foto && conta.foto !== foto) await excluirImagemSemUso(conta.foto);
        // senha nova desfaz os logins dos outros aparelhos; este ganha um cookie novo
        return senhaNova ? entrarNaConta(request, rows[0]) : semCache(json(200, respostaDaSessao({ conta: rows[0], expira: sessao.expira })));
    }
    if (request.method === 'DELETE') {
        const { senha } = await lerCorpo(request);
        await exigirSenhaAtual(conta, senha);
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');
            await cliente.query('DELETE FROM mangas WHERE conta = $1', [conta.id]);
            await cliente.query('DELETE FROM imagens WHERE conta = $1', [conta.id]);
            await cliente.query('DELETE FROM contas WHERE id = $1', [conta.id]);
            await cliente.query('COMMIT');
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
        return apagarCookie(request, semCache(new Response(null, { status: 204 })));
    }
    throw new Recusa(404, 'Endereço não encontrado');
}

/** Traz para esta conta os mangas e capas de antes do cadastro de contas (conta "principal"). So para admins. */
async function trazerMangasAntigos(request, conta) {
    if (!ehAdmin(conta)) throw new Recusa(403, 'Só administradores podem trazer os mangás antigos');
    const cliente = await (await banco()).connect();
    try {
        await cliente.query('BEGIN');
        const { rowCount } = await cliente.query('UPDATE mangas SET conta = $1 WHERE conta = $2', [conta.id, CONTA_ANTIGA]);
        await cliente.query('UPDATE imagens SET conta = $1 WHERE conta = $2', [conta.id, CONTA_ANTIGA]);
        await cliente.query('UPDATE contas SET admin = true WHERE id = $1', [conta.id]);
        await cliente.query('COMMIT');
        return json(200, { trazidos: rowCount, admin: true });
    } catch (erro) {
        await cliente.query('ROLLBACK');
        throw erro;
    } finally {
        cliente.release();
    }
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

function lerInteiroPositivo(url, nome, padrao) {
    const valor = (url.searchParams.get(nome) || '').trim();
    if (valor === '') return padrao;
    if (!/^\d{1,9}$/.test(valor) || Number(valor) < 1) {
        throw new Recusa(400, `O parâmetro '${nome}' precisa ser um número a partir de 1`);
    }
    return Number(valor);
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

const listaDeStatus = () => Object.entries(STATUS).map(([valor, descricao]) => ({ valor, descricao }));
const listaDeFormatos = () => Object.entries(FORMATOS).map(([valor, formato]) => ({ valor, descricao: formato.descricao }));
const listaDeDias = () => Object.entries(DIAS).map(([valor, descricao]) => ({ valor, descricao }));
const listaDeOrdens = ordens => Object.entries(ordens).map(([valor, ordem]) => ({ valor, descricao: ordem.descricao }));

/** O mesmo manga sem a descricao, para listas grandes (?resumo=1). */
function resumo(manga) {
    return { ...manga, description: null };
}

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
    if (vemDeOutroSite(request)) throw new Recusa(403, 'Requisição vinda de outro site');
    if (recurso === 'sessao' && partes.length === 1) return tratarSessao(request);
    if (recurso === 'contas' && partes.length === 1 && metodo === 'POST') return criarConta(request);
    // tudo o que o site precisa para abrir, em uma chamada so: a sessao e as listas fixas (nenhuma tem dados da lista)
    if (recurso === 'inicio' && partes.length === 1 && metodo === 'GET') {
        return semCache(json(200, {
            sessao: respostaDaSessao(await sessaoValida(request)),
            status: listaDeStatus(), formatos: listaDeFormatos(), dias: listaDeDias(),
            ordensDaLista: listaDeOrdens(ORDENS_DA_LISTA), ordensDeRecomendacao: listaDeOrdens(ORDENS),
        }));
    }
    // daqui em diante, so com login: a conta da sessao vale para todas as consultas desta requisicao
    const sessao = await sessaoValida(request);
    if (!sessao) throw new Recusa(401, 'Entre na sua conta');
    contexto.getStore().conta = sessao.conta.id;
    if (recurso === 'conta' && partes.length <= 2) return tratarConta(request, sessao, id);
    if (recurso === 'comunidade') return comunidade()(request, url, partes.slice(1), sessao.conta);

    if (recurso === 'status' && partes.length === 1 && metodo === 'GET') {
        return json(200, listaDeStatus());
    }
    if (recurso === 'formatos-decimais' && partes.length === 1 && metodo === 'GET') {
        return json(200, listaDeFormatos());
    }

    // descricao do manga buscada na internet pelo titulo, para preencher o cadastro
    if (recurso === 'sinopse' && partes.length === 1 && metodo === 'GET') {
        const titulo = (url.searchParams.get('titulo') || '').trim();
        if (!titulo) throw new Recusa(400, 'Informe o título');
        const sinopse = await buscarSinopse(titulo.slice(0, 200));
        if (!sinopse) throw new Recusa(404, 'Não encontrei uma descrição para esse título');
        return json(200, sinopse);
    }
    // busca geral de obras para ler: ?busca=solo&tags=Fantasy,Isekai&ordem=NOTA&pagina=1
    if (recurso === 'recomendacoes' && partes.length === 1 && metodo === 'GET') {
        const ordem = lerOrdem(url, ORDENS, 'POPULARIDADE');
        const tags = (url.searchParams.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 10);
        // ?sem=Harem,Horror: tags que a obra nao pode ter
        const sem = (url.searchParams.get('sem') || '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20);
        return json(200, await buscarRecomendacoes.explorar(url.searchParams.get('busca'), tags, ordem, lerInteiroPositivo(url, 'pagina', 1), await nomesDosCadastrados(), sem));
    }
    if (recurso === 'recomendacoes' && partes.length === 2 && id === 'ordens' && metodo === 'GET') {
        return json(200, listaDeOrdens(ORDENS));
    }
    if (recurso === 'ordens-da-lista' && partes.length === 1 && metodo === 'GET') {
        return json(200, listaDeOrdens(ORDENS_DA_LISTA));
    }
    // sites de leitura dos mangas da conta, sem repetir: a extensao mostra o botao "Lido" neles
    if (recurso === 'sites' && partes.length === 1 && metodo === 'GET') {
        const { rows } = await (await banco()).query(
            `SELECT DISTINCT lower(substring(endereco FROM '^https?://(?:[^@/]*@)?([^/?#]+)')) AS site
             FROM mangas, LATERAL (VALUES (dados->>'chapterLinkModel'), (dados->>'lastChapterUrl'), (dados->>'nextChapterUrl')) AS links (endereco)
             WHERE conta = $1 AND endereco IS NOT NULL ORDER BY 1`, [contaAtual()]);
        return json(200, rows.map(linha => linha.site).filter(Boolean));
    }
    // lista geral de tags, para escolher no cadastro em vez de digitar de novo
    if (recurso === 'tags' && partes.length === 1 && metodo === 'GET') {
        return json(200, await listarTags());
    }
    if (recurso === 'dias-da-semana' && partes.length === 1 && metodo === 'GET') {
        return json(200, listaDeDias());
    }

    if (recurso === 'imagens') {
        if (partes.length === 1 && metodo === 'POST') return enviarImagem(request);
        if (partes.length === 2 && metodo === 'GET') return baixarImagem(id);
        if (partes.length === 3 && acao === 'miniatura' && metodo === 'PUT') return guardarMiniatura(id, request);
    }

    if (recurso === 'mangas') {
        if (partes.length === 1 && metodo === 'GET') {
            const ordem = lerOrdem(url, ORDENS_DA_LISTA, 'CADASTRO');
            // ?resumo=1: sem a descricao, que os cartoes nao usam (a lista fica bem menor)
            const resumida = url.searchParams.get('resumo') === '1';
            const filtros = { titulo: url.searchParams.get('titulo'), status: lerStatusDaBusca(url), tag: url.searchParams.get('tag'), ordem, resumida };
            const comMiniaturas = async mangas => {
                const guardadas = await miniaturas(mangas);
                return mangas.map(manga => resposta(manga, guardadas)).map(manga => (resumida ? resumo(manga) : manga));
            };
            // sem ?pagina devolve a lista inteira (usada por quem precisa de todos, como a busca de mangas);
            // com ?pagina=N devolve so aquela pagina, junto com o total. A lista resumida aceita paginas de ate
            // 2000, para o site guardar a lista inteira de quem tem ate esse tanto e buscar sem esperar o servidor
            if (!url.searchParams.has('pagina')) return json(200, await comMiniaturas((await consultar(filtros)).mangas));
            // ?inteiraAte=N: se o total couber em N, devolve a lista inteira (inteira: true) em vez da pagina. Assim o
            // site descobre numa chamada so se pode guardar a lista toda ou se a conta e grande demais para isso
            if (url.searchParams.has('inteiraAte')) {
                const limite = Math.min(TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA, lerInteiroPositivo(url, 'inteiraAte', TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA));
                if (await contar(filtros) <= limite) {
                    const { mangas, total } = await consultar(filtros);
                    return json(200, { itens: await comMiniaturas(mangas), pagina: 1, tamanho: Math.max(1, total), total, paginas: 1, inteira: true });
                }
            }
            const tamanho = Math.min(resumida ? TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA : TAMANHO_MAXIMO_DA_PAGINA, lerInteiroPositivo(url, 'tamanho', TAMANHO_DA_PAGINA));
            const pedida = lerInteiroPositivo(url, 'pagina', 1);
            let { mangas, total } = await consultar({ ...filtros, limite: tamanho, deslocamento: (pedida - 1) * tamanho });
            const paginas = Math.max(1, Math.ceil(total / tamanho));
            // pagina alem do fim (um manga foi excluido, por exemplo) vira a ultima
            const pagina = Math.min(paginas, pedida);
            if (pagina !== pedida) ({ mangas } = await consultar({ ...filtros, limite: tamanho, deslocamento: (pagina - 1) * tamanho }));
            return json(200, { itens: await comMiniaturas(mangas), pagina, tamanho, total, paginas, inteira: paginas === 1 });
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
            // ?desde=2026-10-08T03:00:00Z: a meia-noite de quem esta olhando. Quem ja avancou o capitulo de la para ca
            // ja leu o lancamento do dia e sai da lista
            const desde = (url.searchParams.get('desde') || '').trim();
            const inicioDoDia = desde ? Date.parse(desde) : null;
            if (desde && (Number.isNaN(inicioDoDia) || !/^\d{4}-\d{2}-\d{2}T/.test(desde))) {
                throw new Recusa(400, "O parâmetro 'desde' precisa ser uma data e hora como 2026-10-08T03:00:00Z");
            }
            const lidoDesde = manga => inicioDoDia !== null && manga.lastChapterAt && Date.parse(manga.lastChapterAt) >= inicioDoDia;
            const { rows } = await (await banco()).query(
                `SELECT ${SEM_DESCRICAO} AS dados FROM mangas WHERE conta = $1 AND dados->>'readingStatus' = 'LENDO' AND dados->>'releaseDay' = $2 ORDER BY ordem`,
                [contaAtual(), dia]);
            const mangas = rows.map(linha => linha.dados).filter(manga => !lidoDesde(manga));
            const guardadas = await miniaturas(mangas);
            return json(200, mangas.map(manga => resposta(manga, guardadas)));
        }
        if (partes.length === 2 && id === 'sorteio' && metodo === 'GET') {
            // qualquer manga pode ser sorteado, de qualquer status (ou so do status pedido)
            const status = lerStatusDaBusca(url);
            const { rows } = await (await banco()).query(
                `SELECT dados FROM mangas WHERE conta = $1 ${status ? "AND dados->>'readingStatus' = $2" : ''} ORDER BY random() LIMIT 1`,
                status ? [contaAtual(), status] : [contaAtual()]);
            if (rows.length === 0) throw new Recusa(404, 'Nenhum mangá para sortear');
            return json(200, resposta(rows[0].dados));
        }
        if (partes.length === 2 && metodo === 'GET') {
            return json(200, resposta(await buscarPorId(id)));
        }
        if (partes.length === 2 && metodo === 'PUT') {
            const atual = await buscarPorId(id);
            const editado = await montarManga(atual.id, await lerCorpo(request));
            // os outros nomes da obra continuam valendo enquanto o titulo for o mesmo; titulo novo, busca nova
            if (Array.isArray(atual.altTitles) && normalizar(atual.title) === normalizar(editado.title)) editado.altTitles = atual.altTitles;
            // o favorito nao faz parte do formulario: editar o manga nao desmarca
            editado.favorite = atual.favorite === true;
            anotarLeitura(atual, editado);
            await salvar(editado);
            if (atual.imagePath !== editado.imagePath) await excluirImagemSemUso(atual.imagePath);
            return json(200, resposta(editado));
        }
        if (partes.length === 2 && metodo === 'DELETE') {
            const manga = await buscarPorId(id);
            await (await banco()).query('DELETE FROM mangas WHERE id = $1 AND conta = $2', [manga.id, contaAtual()]);
            await excluirImagemSemUso(manga.imagePath);
            return new Response(null, { status: 204 });
        }
        // da, troca ou tira (null) a nota, sem mexer no resto
        if (partes.length === 3 && acao === 'nota' && metodo === 'PUT') {
            const atual = await buscarPorId(id);
            const atualizado = { ...atual, rating: lerNota((await lerCorpo(request)).rating) };
            await salvar(atualizado);
            return json(200, resposta(atualizado));
        }
        // marca ou desmarca como favorito, sem mexer no resto
        if (partes.length === 3 && acao === 'favorito' && metodo === 'PUT') {
            const atual = await buscarPorId(id);
            const { favorite } = await lerCorpo(request);
            if (typeof favorite !== 'boolean') throw new Recusa(400, "Informe 'favorite' como true ou false");
            const atualizado = { ...atual, favorite };
            await salvar(atualizado);
            return json(200, resposta(atualizado));
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
            anotarLeitura(atual, atualizado);
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
        // mangas da lista que dividem tags com este, comecando pelos que dividem mais
        if (partes.length === 3 && acao === 'semelhantes' && metodo === 'GET') {
            const manga = await buscarPorId(id);
            const tagsDoManga = [...tagsNormalizadas(manga)];
            if (tagsDoManga.length === 0) return json(200, []);
            // o banco acha os que dividem alguma tag (pelo indice das tags) e conta quantas em comum
            const { rows } = await (await banco()).query(
                `SELECT ${SEM_DESCRICAO} AS dados,
                        (SELECT count(*) FROM unnest(tags_busca) AS tag WHERE tag = ANY($3::text[])) AS em_comum
                 FROM mangas WHERE conta = $1 AND id <> $2 AND tags_busca && $3::text[]
                 ORDER BY em_comum DESC, ${TITULO_SQL} LIMIT 6`, [contaAtual(), manga.id, tagsDoManga]);
            const semelhantes = rows.map(linha => linha.dados);
            const guardadas = await miniaturas(semelhantes);
            return json(200, semelhantes.map(outro => resposta(outro, guardadas)));
        }
        // mangas parecidos com este que ainda nao estao na lista, buscados na internet
        if (partes.length === 3 && acao === 'recomendacoes' && metodo === 'GET') {
            const manga = await buscarPorId(id);
            const cadastrados = await nomesDosCadastrados();
            return json(200, await buscarRecomendacoes(manga.title, cadastrados, manga.tags || []));
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
                // o modelo acompanha o endereco real: se o id do link mudou, o modelo salvo passa a ter o id novo
                chapterLinkModel: derivarModelo(corpo.lastChapterUrl.trim(), lastChapter, atual.decimalFormat || 'HIFEN') ?? atual.chapterLinkModel,
                lastChapter,
                lastChapterUrl: corpo.lastChapterUrl.trim(),
                nextChapterUrl: temProximo && semFinal(corpo.nextChapterUrl) !== semFinal(corpo.lastChapterUrl)
                    ? corpo.nextChapterUrl.trim() : null,
            };
            anotarLeitura(atual, atualizado);
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

// a Comunidade (api/_comunidade_rotas.js) usa as mesmas ferramentas do resto da API
let rotasDaComunidade;
function comunidade() {
    rotasDaComunidade ??= criarComunidade({
        banco, json, Recusa, lerCorpo, semCache, exigirQueNaoEstejaFreado, registrarTentativa, descobrirExtensao, ehAdmin,
        miniaturasDe: miniaturas,
    });
    return rotasDaComunidade;
}

async function tratar(request) {
    try {
        // a conta de quem esta usando vale para todas as consultas desta requisicao (hoje, sempre a principal)
        // a conta e preenchida por rotear depois de conferir o login; antes disso, nenhuma consulta de dados funciona
        return await contexto.run({ conta: null }, () => rotear(request));
    } catch (erro) {
        if (erro instanceof Recusa) return json(erro.status, { mensagem: erro.message });
        if (erro instanceof DadoInvalido || erro instanceof DadoInvalidoNaComunidade) return json(400, { mensagem: erro.message });
        console.error('Erro inesperado em', request.method, request.url, erro);
        return json(500, { mensagem: 'Erro inesperado' });
    }
}

export { tratar as GET, tratar as POST, tratar as PUT, tratar as PATCH, tratar as DELETE };
