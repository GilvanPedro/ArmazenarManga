// Rotas da Comunidade: feed, posts (com imagens e listas anexadas), curtidas, comentarios, seguir e perfis.
// Tudo pede login; quem esta usando chega em "eu" (a conta da sessao). So a versao do Vercel tem a Comunidade.
import { randomUUID } from 'node:crypto';
import { DadoInvalidoNaComunidade, IMAGENS_POR_POST, PESOS, POSTS_DO_FEED, POSTS_POR_PAGINA, TAMANHO_MAXIMO_DA_IMAGEM, escaparLike, hashtagsDo, hashtagsQueComecamCom, doMaisNovoParaOMaisAntigo, lerBusca, validarComentario, validarDescricao, validarPost } from './_comunidade.js';
import { criarFinancas } from './_financas.js';
import { dadosDoPainel, lerPeriodo } from './_painel.js';
import { DadoInvalidoNaModeracao, ESTRUTURA_DA_MODERACAO, MENSAGEM_DE_IMAGEM_BARRADA, mensagemDaPunicao, registrarNaModeracao, situacaoDaConta, validarMotivo, validarSuspensao } from './_moderacao.js';
import { verificarImagem } from './_robo_de_imagens.js';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOME = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;
const TIPOS = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

/** Tabelas da Comunidade, criadas junto com as outras (api/index.js). Apagar uma conta apaga tudo dela aqui. */
export const ESTRUTURA_DA_COMUNIDADE = `
    CREATE TABLE IF NOT EXISTS posts (id UUID PRIMARY KEY, autor UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
        texto TEXT NOT NULL DEFAULT '', imagens TEXT[] NOT NULL DEFAULT '{}', lista JSONB, criado_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS posts_criado ON posts (criado_em DESC);
    CREATE INDEX IF NOT EXISTS posts_autor ON posts (autor, criado_em DESC);
    CREATE TABLE IF NOT EXISTS curtidas (post UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, criada_em TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (post, conta));
    CREATE INDEX IF NOT EXISTS curtidas_conta ON curtidas (conta, criada_em DESC);
    CREATE TABLE IF NOT EXISTS comentarios (id UUID PRIMARY KEY, post UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        autor UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, texto TEXT NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS comentarios_post ON comentarios (post, criado_em);
    CREATE INDEX IF NOT EXISTS comentarios_autor ON comentarios (autor, criado_em DESC);
    CREATE TABLE IF NOT EXISTS seguindo (seguidor UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
        seguido UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (seguidor, seguido), CHECK (seguidor <> seguido));
    CREATE INDEX IF NOT EXISTS seguindo_seguido ON seguindo (seguido);
    CREATE TABLE IF NOT EXISTS imagens_da_comunidade (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL,
        conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, post UUID REFERENCES posts(id) ON DELETE CASCADE,
        criada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS imagens_da_comunidade_soltas ON imagens_da_comunidade (conta, criada_em) WHERE post IS NULL;
    -- a descricao do perfil, que todos veem (ate 300 caracteres)
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '';
    -- contadores no proprio post, mantidos pelo banco: o feed ordena sem recontar curtidas e comentarios
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS curtidas_total INT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS comentarios_total INT;
    UPDATE posts p SET curtidas_total = (SELECT count(*) FROM curtidas WHERE post = p.id) WHERE curtidas_total IS NULL;
    UPDATE posts p SET comentarios_total = (SELECT count(*) FROM comentarios WHERE post = p.id) WHERE comentarios_total IS NULL;
    ALTER TABLE posts ALTER COLUMN curtidas_total SET DEFAULT 0, ALTER COLUMN curtidas_total SET NOT NULL;
    ALTER TABLE posts ALTER COLUMN comentarios_total SET DEFAULT 0, ALTER COLUMN comentarios_total SET NOT NULL;
    CREATE OR REPLACE FUNCTION contar_curtida() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN UPDATE posts SET curtidas_total = curtidas_total + 1 WHERE id = NEW.post;
        ELSE UPDATE posts SET curtidas_total = curtidas_total - 1 WHERE id = OLD.post; END IF;
        RETURN NULL;
    END $$;
    CREATE OR REPLACE FUNCTION contar_comentario() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN UPDATE posts SET comentarios_total = comentarios_total + 1 WHERE id = NEW.post;
        ELSE UPDATE posts SET comentarios_total = comentarios_total - 1 WHERE id = OLD.post; END IF;
        RETURN NULL;
    END $$;
    CREATE OR REPLACE TRIGGER contar_curtidas AFTER INSERT OR DELETE ON curtidas FOR EACH ROW EXECUTE FUNCTION contar_curtida();
    CREATE OR REPLACE TRIGGER contar_comentarios AFTER INSERT OR DELETE ON comentarios FOR EACH ROW EXECUTE FUNCTION contar_comentario();
` + ESTRUTURA_DA_MODERACAO;

/**
 * Passa a imagem pelo robo (api/_robo_de_imagens.js). Barrada, fica no registro da moderacao (sem a imagem) e quem
 * enviou recebe o aviso. Se o robo nao conseguir conferir, a imagem nao entra: melhor pedir para tentar de novo do
 * que deixar passar sem olhar. onde: 'post' ou 'foto'.
 */
export async function exigirImagemPermitida(db, bytes, contaId, onde, Recusa) {
    let resultado;
    try {
        resultado = await verificarImagem(bytes);
    } catch (erro) {
        console.error('Robo de imagens: nao deu para conferir', erro);
        throw new Recusa(503, 'Não deu para verificar a imagem agora. Tente de novo em instantes ou use outra imagem');
    }
    if (resultado.permitida) return;
    await registrarNaModeracao(db, { conta: contaId, acao: 'imagem_barrada', motivo: 'Foto com conteúdo sexual explícito',
        detalhes: { onde, probabilidades: resultado.probabilidades } });
    throw new Recusa(400, MENSAGEM_DE_IMAGEM_BARRADA);
}

// limites por conta: posts, comentarios e imagens enviadas por hora
const LIMITES = {
    post: { maximo: 30, minutos: 60 },
    comentario: { maximo: 60, minutos: 60 },
    imagem: { maximo: 60, minutos: 60 },
};

/**
 * @param f ferramentas do api/index.js: banco, json, Recusa, lerCorpo, semCache, exigirQueNaoEstejaFreado,
 *          registrarTentativa, descobrirExtensao, ehAdmin, ehDono, miniaturasDe (nome da capa -> nome da miniatura)
 */
export function criarComunidade(f) {
    const { banco, json, Recusa } = f;

    const urlDaFoto = (id, foto) => (foto ? `/api/comunidade/contas/${id}/foto?v=${encodeURIComponent(foto)}` : null);
    // a borda e o efeito da loja que o autor equipou: aparecem nas capas dos favoritos das listas que ele publica
    const autor = linha => ({ id: linha.autor_id, nick: linha.nick, foto: urlDaFoto(linha.autor_id, linha.foto),
        borda: linha.borda || null, efeito: linha.efeito || null });

    // os campos que todo post devolvido leva; $1 e sempre quem esta usando. Os totais ja estao no post (gatilhos)
    const CAMPOS_DO_POST = `
        p.id, p.texto, p.imagens, p.lista, p.criado_em, c.id AS autor_id, c.nick, c.foto, c.borda, c.efeito,
        p.curtidas_total AS curtidas, p.comentarios_total AS comentarios,
        EXISTS (SELECT 1 FROM curtidas WHERE post = p.id AND conta = $1) AS curti,
        EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = p.autor) AS sigo`;

    function post(linha, eu) {
        return {
            id: linha.id,
            autor: autor(linha),
            texto: linha.texto,
            imagens: (linha.imagens || []).map(nome => '/api/comunidade/imagens/' + nome),
            lista: linha.lista,
            criadoEm: linha.criado_em,
            curtidas: linha.curtidas,
            comentarios: linha.comentarios,
            curti: linha.curti,
            sigoOAutor: linha.sigo,
            meu: linha.autor_id === eu.id,
            podeApagar: linha.autor_id === eu.id || f.ehAdmin(eu),
        };
    }

    /** Os posts destes ids, na mesma ordem (os que foram apagados nesse meio tempo ficam de fora). */
    async function postsPorIds(ids, eu) {
        if (ids.length === 0) return [];
        const { rows } = await (await banco()).query(
            `SELECT ${CAMPOS_DO_POST} FROM posts p JOIN contas c ON c.id = p.autor WHERE p.id = ANY($2::uuid[])`, [eu.id, ids]);
        const porId = new Map(rows.map(linha => [linha.id, linha]));
        return ids.map(id => porId.get(id)).filter(Boolean).map(linha => post(linha, eu));
    }

    /**
     * Ordem do feed "Para voce": entre os 1000 posts mais novos, os pontos de PESOS (veja api/_comunidade.js), com a
     * proximidade de quem le com cada autor (seguir, curtidas e comentarios dados a ele) e o interesse do post (os
     * totais guardados no proprio post), divididos pelo tempo. Os pontos escolhem os 300 posts do feed; na tela eles
     * aparecem do mais novo para o mais antigo (abrirFeed). So os ids saem: a escolha e feita uma vez por abertura.
     */
    async function rankingParaVoce(eu) {
        const { rows } = await (await banco()).query(`
            WITH proximidade AS (
                SELECT autor, least(sum(peso), ${PESOS.maximo}) AS peso FROM (
                    SELECT seguido AS autor, ${PESOS.seguir}::float AS peso FROM seguindo WHERE seguidor = $1
                    UNION ALL
                    SELECT p.autor, ${PESOS.curtida} FROM curtidas k JOIN posts p ON p.id = k.post
                        WHERE k.conta = $1 AND k.criada_em > now() - interval '${PESOS.dias} days'
                    UNION ALL
                    SELECT p.autor, ${PESOS.comentario} FROM comentarios k JOIN posts p ON p.id = k.post
                        WHERE k.autor = $1 AND k.criado_em > now() - interval '${PESOS.dias} days'
                ) AS pesos WHERE autor <> $1 GROUP BY autor
            ), recentes AS (SELECT id, autor, criado_em, curtidas_total, comentarios_total FROM posts ORDER BY criado_em DESC LIMIT 1000)
            SELECT p.id, p.autor, p.criado_em FROM recentes p LEFT JOIN proximidade x ON x.autor = p.autor
            ORDER BY (1 + CASE WHEN p.autor = $1 THEN ${PESOS.proprio} ELSE coalesce(x.peso, 0) END
                        + 2 * ln(1 + p.curtidas_total + 2 * p.comentarios_total))
                     -- em ponto flutuante: com numeros decimais exatos, a potencia de 1000 posts custava ~20 ms
                     / power(extract(epoch FROM now() - p.criado_em)::float8 / 3600 + 2, ${PESOS.expoente}::float8) DESC,
                     p.criado_em DESC, p.id
            LIMIT ${POSTS_DO_FEED}`, [eu.id]);
        return rows;
    }

    /** Ordem do feed "Seguindo": os posts de quem voce segue (e os seus), do mais novo para o mais antigo. */
    async function idsSeguindo(eu) {
        const { rows } = await (await banco()).query(`
            SELECT id FROM posts WHERE autor = $1 OR autor IN (SELECT seguido FROM seguindo WHERE seguidor = $1)
            ORDER BY criado_em DESC, id LIMIT ${POSTS_DO_FEED}`, [eu.id]);
        return rows.map(linha => linha.id);
    }

    /**
     * Ordem do feed de busca, do mais novo para o mais antigo: com "#tag", os posts com essa hashtag; com texto, os
     * posts que o tem. A hashtag e conferida aqui (letras com acento contam como parte dela), entre os candidatos que
     * o banco acha pelo texto.
     */
    async function idsDaBusca(consulta) {
        const busca = lerBusca(consulta);
        if (!busca) return [];
        const db = await banco();
        if (busca.tipo === 'hashtag') {
            const { rows } = await db.query(`SELECT id, texto FROM posts WHERE texto ILIKE $1 ORDER BY criado_em DESC, id LIMIT 2000`,
                ['%#' + escaparLike(busca.tag) + '%']);
            return rows.filter(linha => hashtagsDo(linha.texto).includes(busca.tag)).slice(0, POSTS_DO_FEED).map(linha => linha.id);
        }
        const { rows } = await db.query(`SELECT id FROM posts WHERE texto ILIKE $1 ORDER BY criado_em DESC, id LIMIT ${POSTS_DO_FEED}`,
            ['%' + escaparLike(busca.texto) + '%']);
        return rows.map(linha => linha.id);
    }

    /** Ate 20 pessoas pelo nick: o nick exato primeiro, depois quem tem mais seguidores. */
    async function pessoas(consulta, eu) {
        const busca = lerBusca(consulta);
        if (!busca || busca.tipo !== 'texto') return [];
        const { rows } = await (await banco()).query(`
            SELECT c.id, c.nick, c.foto, c.descricao,
                   (SELECT count(*) FROM seguindo WHERE seguido = c.id)::int AS seguidores,
                   EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = c.id) AS sigo
            FROM contas c WHERE c.nick ILIKE $2
            ORDER BY lower(c.nick) = lower($3) DESC, seguidores DESC, c.nick LIMIT 20`, [eu.id, '%' + escaparLike(busca.texto) + '%', busca.texto]);
        return rows.map(linha => ({
            id: linha.id, nick: linha.nick, foto: urlDaFoto(linha.id, linha.foto), descricao: linha.descricao,
            seguidores: linha.seguidores, sigo: linha.sigo, euMesmo: linha.id === eu.id,
        }));
    }

    /**
     * Sugestoes enquanto se digita na barra de pesquisa: ate 3, primeiro pessoas (pelo nick), depois #tags (as que
     * comecam com o texto, das mais usadas nos posts recentes) e depois posts (os mais novos com o texto). Com "#",
     * so tags e posts; com "@", pessoas primeiro do mesmo jeito.
     */
    async function buscaRapida(consulta) {
        const texto = (typeof consulta === 'string' ? consulta : '').trim().replace(/\s+/g, ' ').slice(0, 60);
        const semSinal = texto.replace(/^[#@]+/, '');
        if (!semSinal) return [];
        const db = await banco();
        const MAXIMO = 3;
        const itens = [];
        if (!texto.startsWith('#')) {
            const { rows } = await db.query(`
                SELECT id, nick, foto FROM contas WHERE nick ILIKE $1
                ORDER BY lower(nick) = lower($2) DESC, nick ILIKE $3 DESC, nick LIMIT ${MAXIMO}`,
                ['%' + escaparLike(semSinal) + '%', semSinal, escaparLike(semSinal) + '%']);
            itens.push(...rows.map(linha => ({ tipo: 'pessoa', id: linha.id, nick: linha.nick, foto: urlDaFoto(linha.id, linha.foto) })));
        }
        // so palavras que podem ser uma tag (letras, numeros e _)
        if (itens.length < MAXIMO && /^[\p{L}\p{N}_]+$/u.test(semSinal)) {
            const { rows } = await db.query(`SELECT texto FROM posts WHERE texto ILIKE $1 ORDER BY criado_em DESC LIMIT 1000`,
                ['%#' + escaparLike(semSinal) + '%']);
            itens.push(...hashtagsQueComecamCom(rows.map(linha => linha.texto), semSinal, MAXIMO - itens.length)
                .map(achada => ({ tipo: 'hashtag', tag: achada.tag, posts: achada.posts })));
        }
        if (itens.length < MAXIMO) {
            const { rows } = await db.query(`
                SELECT p.id, p.texto, c.nick FROM posts p JOIN contas c ON c.id = p.autor
                WHERE p.texto ILIKE $1 ORDER BY p.criado_em DESC LIMIT ${MAXIMO - itens.length}`, ['%' + escaparLike(texto) + '%']);
            itens.push(...rows.map(linha => ({ tipo: 'post', id: linha.id, texto: linha.texto.slice(0, 120), autor: linha.nick })));
        }
        return itens.slice(0, MAXIMO);
    }

    /**
     * Quem segue esta conta (qual 'seguidores') ou quem ela segue (qual 'seguindo'), ate 500, de quem seguiu por
     * ultimo para o primeiro. Cada pessoa como na busca, com o botao de seguir de quem esta vendo.
     */
    async function listaDeSeguir(contaId, qual, eu) {
        const [minha, outra] = qual === 'seguidores' ? ['seguido', 'seguidor'] : ['seguidor', 'seguido'];
        const { rows } = await (await banco()).query(`
            SELECT c.id, c.nick, c.foto, c.descricao,
                   (SELECT count(*) FROM seguindo WHERE seguido = c.id)::int AS seguidores,
                   EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = c.id) AS sigo
            FROM seguindo s JOIN contas c ON c.id = s.${outra}
            WHERE s.${minha} = $2 ORDER BY s.criado_em DESC, c.nick LIMIT 500`, [eu.id, contaId]);
        return rows.map(linha => ({
            id: linha.id, nick: linha.nick, foto: urlDaFoto(linha.id, linha.foto), descricao: linha.descricao,
            seguidores: linha.seguidores, sigo: linha.sigo, euMesmo: linha.id === eu.id,
        }));
    }

    async function idsDoPerfil(contaId) {
        const { rows } = await (await banco()).query(`SELECT id FROM posts WHERE autor = $1 ORDER BY criado_em DESC, id LIMIT ${POSTS_DO_FEED}`, [contaId]);
        return rows.map(linha => linha.id);
    }

    /**
     * Abre um feed: a ordem dos primeiros 300 posts (so os ids) e os 20 primeiros ja prontos. O site busca os seguintes
     * pelos ids (POST_POR_PAGINA de cada vez): rolar nao recalcula a ordem, e posts novos nao empurram nem repetem os ja
     * vistos. geradoEm serve para perguntar depois quantos posts novos apareceram.
     */
    async function abrirFeed(url, eu) {
        const qual = url.searchParams.get('feed');
        const geradoEm = new Date().toISOString();
        let ids;
        if (qual === 'seguindo') ids = await idsSeguindo(eu);
        else if (qual === 'perfil') ids = await idsDoPerfil((await exigirConta(url.searchParams.get('conta'))).id);
        else if (qual === 'busca') ids = await idsDaBusca(url.searchParams.get('q'));
        else {
            // do mais novo para o mais antigo, sejam seus ou de outra pessoa
            ids = doMaisNovoParaOMaisAntigo(await rankingParaVoce(eu)).map(linha => linha.id);
        }
        return { ids, itens: await postsPorIds(ids.slice(0, POSTS_POR_PAGINA), eu), geradoEm };
    }

    /**
     * Quantos posts novos (de outras pessoas) entraram no feed desde que ele foi aberto, ate 99. No "Para voce", so
     * contam os que entram no feed da pessoa (entre os 300 mais relevantes para ela); no "Seguindo", os de quem ela
     * segue. Consulta feita de tempos em tempos pelo site enquanto a pessoa rola o feed.
     */
    async function novidades(url, eu) {
        const desde = Date.parse(url.searchParams.get('desde') || '');
        if (Number.isNaN(desde)) throw new Recusa(400, "Informe 'desde' (a data em que o feed foi aberto)");
        if (url.searchParams.get('feed') !== 'seguindo') {
            const novos = (await rankingParaVoce(eu)).filter(linha => new Date(linha.criado_em).getTime() > desde && linha.autor !== eu.id).length;
            return { novos: Math.min(novos, 99) };
        }
        const { rows } = await (await banco()).query(`
            SELECT count(*)::int AS novos FROM (
                SELECT 1 FROM posts WHERE criado_em > $2 AND autor <> $1 AND autor IN (SELECT seguido FROM seguindo WHERE seguidor = $1)
                LIMIT 99) AS novos`, [eu.id, new Date(desde).toISOString()]);
        return { novos: rows[0].novos };
    }

    async function exigirConta(id) {
        if (!ID.test(id || '')) throw new Recusa(404, 'Conta não encontrada');
        const { rows } = await (await banco()).query('SELECT id, nick, foto, criada_em FROM contas WHERE id = $1', [id]);
        if (rows.length === 0) throw new Recusa(404, 'Conta não encontrada');
        return rows[0];
    }

    async function exigirPost(id) {
        if (!ID.test(id || '')) throw new Recusa(404, 'Post não encontrado');
        const { rows } = await (await banco()).query('SELECT id, autor FROM posts WHERE id = $1', [id]);
        if (rows.length === 0) throw new Recusa(404, 'Post não encontrado');
        return rows[0];
    }

    /** A punicao que vale agora para esta conta (null se estiver livre). */
    async function situacao(contaId) {
        const { rows } = await (await banco()).query('SELECT punicao, punida_ate, punicao_motivo FROM contas WHERE id = $1', [contaId]);
        return situacaoDaConta(rows[0]);
    }

    /** Suspensa ou banida nao publica, nao comenta e nao envia imagem (curtir e seguir continuam). */
    async function exigirQuePossaParticipar(eu) {
        const punicao = await situacao(eu.id);
        if (punicao) throw new Recusa(403, mensagemDaPunicao(punicao));
    }

    async function umPost(id, eu) {
        const [achado] = await postsPorIds([id], eu);
        if (!achado) throw new Recusa(404, 'Post não encontrado');
        return achado;
    }

    /** Envia uma imagem para um post: fica solta ate o post ser publicado (as soltas de mais de um dia sao apagadas). */
    async function enviarImagem(request, eu) {
        await exigirQuePossaParticipar(eu);
        await f.exigirQueNaoEstejaFreado('imagem:' + eu.id, LIMITES.imagem);
        let formulario;
        try {
            formulario = await request.formData();
        } catch {
            throw new Recusa(400, 'Envie a imagem no campo "arquivo"');
        }
        const arquivo = formulario.get('arquivo');
        if (!arquivo || typeof arquivo === 'string') throw new Recusa(400, 'Envie a imagem no campo "arquivo"');
        if (arquivo.size > TAMANHO_MAXIMO_DA_IMAGEM) throw new Recusa(400, 'A imagem pode ter no máximo 2 MB');
        const bytes = Buffer.from(await arquivo.arrayBuffer());
        const nome = randomUUID() + '.' + f.descobrirExtensao(bytes);
        const db = await banco();
        await exigirImagemPermitida(db, bytes, eu.id, 'post', Recusa);
        await db.query("DELETE FROM imagens_da_comunidade WHERE conta = $1 AND post IS NULL AND criada_em < now() - interval '1 day'", [eu.id]);
        await db.query('INSERT INTO imagens_da_comunidade (nome, conteudo, conta) VALUES ($1, $2, $3)', [nome, bytes, eu.id]);
        await f.registrarTentativa('imagem:' + eu.id);
        return json(201, { nome, url: '/api/comunidade/imagens/' + nome });
    }

    function servirImagem(conteudo, nome, cache) {
        return new Response(conteudo, {
            status: 200,
            headers: { 'Content-Type': TIPOS[nome.slice(nome.lastIndexOf('.') + 1)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache },
        });
    }

    /**
     * Monta a lista anexada: uma copia de cada manga como estava ao publicar (titulo, status, nota, favorito, capitulo
     * e capa). As capas enviadas sao privadas da conta; o post leva uma copia (a miniatura, se houver), para os outros
     * leitores verem.
     */
    async function montarLista(cliente, lista, eu, postId) {
        const { rows } = await cliente.query(`SELECT dados FROM mangas WHERE conta = $1 AND id = ANY($2::uuid[])`, [eu.id, lista.mangas]);
        const porId = new Map(rows.map(linha => [linha.dados.id.toLowerCase(), linha.dados]));
        const mangas = lista.mangas.map(id => porId.get(id)).filter(Boolean);
        if (mangas.length !== lista.mangas.length) throw new Recusa(400, 'Algum mangá da lista não está na sua biblioteca');
        const miniaturas = await f.miniaturasDe(mangas);
        const itens = [];
        for (const manga of mangas) {
            let capa = null;
            if (/^https?:\/\//i.test(manga.imagePath || '')) {
                capa = manga.imagePath;
            } else if (NOME.test(manga.imagePath || '')) {
                const base = manga.imagePath.slice(0, manga.imagePath.lastIndexOf('.'));
                const origem = miniaturas.get(base) || manga.imagePath;
                const { rows: imagem } = await cliente.query('SELECT conteudo FROM imagens WHERE nome = $1 AND conta = $2', [origem, eu.id]);
                if (imagem.length) {
                    const copia = randomUUID() + origem.slice(origem.lastIndexOf('.'));
                    await cliente.query('INSERT INTO imagens_da_comunidade (nome, conteudo, conta, post) VALUES ($1, $2, $3, $4)', [copia, imagem[0].conteudo, eu.id, postId]);
                    capa = '/api/comunidade/imagens/' + copia;
                }
            }
            itens.push({
                titulo: manga.title, capa, status: manga.readingStatus, nota: Number.isInteger(manga.rating) ? manga.rating : null,
                favorito: manga.favorite === true, capitulo: manga.lastChapter ?? null,
                // para quem abrir o manga na lista: as tags e a descricao como estavam na biblioteca
                tags: (Array.isArray(manga.tags) ? manga.tags : []).filter(tag => typeof tag === 'string').slice(0, 20),
                descricao: typeof manga.description === 'string' ? manga.description.slice(0, 2000) : '',
            });
        }
        return { titulo: lista.titulo, itens };
    }

    async function publicar(request, eu) {
        const dados = validarPost(await f.lerCorpo(request));
        await exigirQuePossaParticipar(eu);
        await f.exigirQueNaoEstejaFreado('post:' + eu.id, LIMITES.post);
        const id = randomUUID();
        const cliente = await (await banco()).connect();
        try {
            await cliente.query('BEGIN');
            // o post entra primeiro (as copias das capas da lista apontam para ele)
            await cliente.query('INSERT INTO posts (id, autor, texto, imagens) VALUES ($1, $2, $3, $4)', [id, eu.id, dados.texto, dados.imagens]);
            if (dados.imagens.length) {
                // so imagens desta conta, ainda soltas
                const { rowCount } = await cliente.query(
                    'UPDATE imagens_da_comunidade SET post = $1 WHERE nome = ANY($2) AND conta = $3 AND post IS NULL', [id, dados.imagens, eu.id]);
                if (rowCount !== dados.imagens.length) throw new Recusa(400, 'Alguma imagem do post não foi encontrada. Envie de novo');
            }
            if (dados.lista) {
                await cliente.query('UPDATE posts SET lista = $2 WHERE id = $1', [id, JSON.stringify(await montarLista(cliente, dados.lista, eu, id))]);
            }
            await cliente.query('COMMIT');
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
        await f.registrarTentativa('post:' + eu.id);
        return json(201, await umPost(id, eu));
    }

    async function perfil(id, eu) {
        const conta = await exigirConta(id);
        const { rows } = await (await banco()).query(`
            SELECT (SELECT descricao FROM contas WHERE id = $2) AS descricao,
                   (SELECT count(*) FROM mangas WHERE conta = $3)::int AS mangas,
                   (SELECT count(*) FROM posts WHERE autor = $2)::int AS posts,
                   (SELECT count(*) FROM seguindo WHERE seguido = $2)::int AS seguidores,
                   (SELECT count(*) FROM seguindo WHERE seguidor = $2)::int AS seguindo,
                   EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = $2) AS sigo`, [eu.id, conta.id, String(conta.id)]);
        const resposta = { id: conta.id, nick: conta.nick, foto: urlDaFoto(conta.id, conta.foto), criadaEm: conta.criada_em, ...rows[0], euMesmo: conta.id === eu.id };
        // para os admins: a punicao da conta e se ela pode ser punida (admins nao podem)
        if (f.ehAdmin(eu) && conta.id !== eu.id) {
            const { rows: completa } = await (await banco()).query('SELECT email, admin, punicao, punida_ate, punicao_motivo FROM contas WHERE id = $1', [conta.id]);
            resposta.moderacao = { punicao: situacaoDaConta(completa[0]), podePunir: !f.ehAdmin(completa[0]) };
        }
        return resposta;
    }

    // ------------------------------------------------------------------ gerenciamento (so admins)

    const POR_PAGINA_NO_GERENCIAMENTO = 30;

    /** Contas para o gerenciamento: busca por nick ou e-mail e filtro (todas, punidas, suspensas, banidas). */
    async function contasParaGerenciar(url) {
        const busca = (url.searchParams.get('busca') || '').trim().slice(0, 100);
        const filtro = url.searchParams.get('filtro') || 'todas';
        const pagina = Math.max(1, Number.parseInt(url.searchParams.get('pagina'), 10) || 1);
        const condicoes = [];
        const valores = [];
        if (busca) {
            valores.push('%' + busca.replace(/[\\%_]/g, letra => '\\' + letra) + '%');
            condicoes.push(`(c.nick ILIKE $${valores.length} OR c.email ILIKE $${valores.length})`);
        }
        const suspensa = "(c.punicao = 'suspensa' AND c.punida_ate > now())";
        if (filtro === 'suspensas') condicoes.push(suspensa);
        else if (filtro === 'banidas') condicoes.push("c.punicao = 'banida'");
        else if (filtro === 'punidas') condicoes.push(`(${suspensa} OR c.punicao = 'banida')`);
        const onde = condicoes.length ? 'WHERE ' + condicoes.join(' AND ') : '';
        const db = await banco();
        const { rows: [{ total }] } = await db.query(`SELECT count(*)::int AS total FROM contas c ${onde}`, valores);
        const { rows } = await db.query(`
            SELECT c.id, c.nick, c.email, c.foto, c.admin, c.criada_em, c.punicao, c.punida_ate, c.punicao_motivo, c.punida_em,
                   a.nick AS punida_por,
                   (SELECT count(*) FROM posts WHERE autor = c.id)::int AS posts,
                   (SELECT count(*) FROM moderacao m WHERE m.conta = c.id AND m.acao = 'imagem_barrada')::int AS imagens_barradas
            FROM contas c LEFT JOIN contas a ON a.id = c.punida_por ${onde}
            -- quem esta punido primeiro, depois as contas mais novas
            ORDER BY coalesce(c.punicao = 'banida' OR ${suspensa}, false) DESC, c.criada_em DESC, c.id
            LIMIT ${POR_PAGINA_NO_GERENCIAMENTO} OFFSET ${(pagina - 1) * POR_PAGINA_NO_GERENCIAMENTO}`, valores);
        return {
            pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA_NO_GERENCIAMENTO)), total,
            contas: rows.map(linha => ({
                id: linha.id, nick: linha.nick, email: linha.email, foto: urlDaFoto(linha.id, linha.foto), criadaEm: linha.criada_em,
                admin: f.ehAdmin(linha), posts: linha.posts, imagensBarradas: linha.imagens_barradas,
                punicao: situacaoDaConta(linha), punidaPor: linha.punida_por, punidaEm: linha.punida_em,
            })),
        };
    }

    /** O registro da moderacao, do mais novo para o mais antigo (de uma conta, se ?conta= vier). */
    async function registroDaModeracao(url) {
        const pagina = Math.max(1, Number.parseInt(url.searchParams.get('pagina'), 10) || 1);
        const conta = url.searchParams.get('conta');
        const valores = [];
        let onde = '';
        if (conta) {
            if (!ID.test(conta)) throw new Recusa(400, 'Conta inválida');
            valores.push(conta);
            onde = 'WHERE m.conta = $1';
        }
        const { rows } = await (await banco()).query(`
            SELECT m.id, m.acao, m.motivo, m.detalhes, m.criada_em, c.id AS conta_id, c.nick AS conta_nick, a.nick AS admin_nick
            FROM moderacao m LEFT JOIN contas c ON c.id = m.conta LEFT JOIN contas a ON a.id = m.admin ${onde}
            ORDER BY m.criada_em DESC, m.id
            LIMIT ${POR_PAGINA_NO_GERENCIAMENTO + 1} OFFSET ${(pagina - 1) * POR_PAGINA_NO_GERENCIAMENTO}`, valores);
        return {
            pagina, temMais: rows.length > POR_PAGINA_NO_GERENCIAMENTO,
            itens: rows.slice(0, POR_PAGINA_NO_GERENCIAMENTO).map(linha => ({
                id: linha.id, acao: linha.acao, motivo: linha.motivo, detalhes: linha.detalhes, criadaEm: linha.criada_em,
                conta: linha.conta_id ? { id: linha.conta_id, nick: linha.conta_nick } : null, admin: linha.admin_nick,
            })),
        };
    }

    /** Suspende, bane ou tira a punicao de uma conta. Admins nao punem a si mesmos nem outros admins. */
    async function punir(request, eu, id, acao, metodo) {
        const db = await banco();
        if (!ID.test(id || '')) throw new Recusa(404, 'Conta não encontrada');
        const { rows } = await db.query('SELECT id, email, admin, punicao, punida_ate, punicao_motivo FROM contas WHERE id = $1', [id]);
        if (rows.length === 0) throw new Recusa(404, 'Conta não encontrada');
        const alvo = rows[0];
        if (alvo.id === eu.id) throw new Recusa(400, 'Você não pode punir a si mesmo');
        if (f.ehAdmin(alvo)) throw new Recusa(400, 'Administradores não podem ser suspensos nem banidos');
        if (acao === 'suspensao' && metodo === 'POST') {
            const { horas, motivo } = validarSuspensao(await f.lerCorpo(request));
            await db.query(`UPDATE contas SET punicao = 'suspensa', punida_ate = now() + make_interval(hours => $2), punicao_motivo = $3,
                            punida_por = $4, punida_em = now() WHERE id = $1`, [alvo.id, horas, motivo, eu.id]);
            await registrarNaModeracao(db, { conta: alvo.id, admin: eu.id, acao: 'suspender', motivo, detalhes: { horas } });
        } else if (acao === 'banimento' && metodo === 'POST') {
            const motivo = validarMotivo((await f.lerCorpo(request)).motivo);
            await db.query(`UPDATE contas SET punicao = 'banida', punida_ate = NULL, punicao_motivo = $2, punida_por = $3, punida_em = now()
                            WHERE id = $1`, [alvo.id, motivo, eu.id]);
            await registrarNaModeracao(db, { conta: alvo.id, admin: eu.id, acao: 'banir', motivo });
        } else if (acao === 'punicao' && metodo === 'DELETE') {
            const antes = situacaoDaConta(alvo);
            await db.query('UPDATE contas SET punicao = NULL, punida_ate = NULL, punicao_motivo = NULL, punida_por = NULL, punida_em = NULL WHERE id = $1', [alvo.id]);
            if (antes) await registrarNaModeracao(db, { conta: alvo.id, admin: eu.id, acao: antes.tipo === 'banida' ? 'desbanir' : 'tirar_suspensao' });
        } else {
            throw new Recusa(404, 'Rota não encontrada');
        }
        const { rows: depois } = await db.query('SELECT punicao, punida_ate, punicao_motivo FROM contas WHERE id = $1', [alvo.id]);
        return json(200, { punicao: situacaoDaConta(depois[0]) });
    }

    // gastos e receitas do site (api/_financas.js), na aba Financas do Gerenciar
    const financas = criarFinancas(f);

    async function tratarGerenciamento(request, url, partes, eu) {
        if (!f.ehAdmin(eu)) throw new Recusa(403, 'Só administradores podem usar o gerenciamento');
        const [recurso, id, acao] = partes;
        const metodo = request.method;
        try {
            if (recurso === 'contas' && !id && metodo === 'GET') return f.semCache(json(200, await contasParaGerenciar(url)));
            if (recurso === 'contas' && id && acao) return await punir(request, eu, id, acao, metodo);
            if (recurso === 'registro' && !id && metodo === 'GET') return f.semCache(json(200, await registroDaModeracao(url)));
            // o painel e as financas sao so do dono do site; os outros admins so moderam
            if ((recurso === 'financas' || recurso === 'painel') && !f.ehDono(eu)) throw new Recusa(403, 'Só o dono do site vê o painel e as finanças');
            if (recurso === 'financas') return await financas(request, url, partes.slice(1));
            if (recurso === 'painel' && !id && metodo === 'GET') {
                return f.semCache(json(200, await dadosDoPainel(await banco(), lerPeriodo(url.searchParams.get('periodo')))));
            }
        } catch (erro) {
            if (erro instanceof DadoInvalidoNaModeracao) throw new Recusa(400, erro.message);
            throw erro;
        }
        throw new Recusa(404, 'Rota não encontrada');
    }

    // quem mais postou no ultimo mes vale para todo mundo: e guardado por um minuto em cada instancia da funcao
    let maisAtivos = { quando: 0, contas: [] };

    /** Ate 5 contas para seguir: as que mais postaram nos ultimos 30 dias, que voce ainda nao segue. */
    async function sugestoes(eu) {
        const db = await banco();
        if (Date.now() - maisAtivos.quando > 60_000) {
            const { rows } = await db.query(`
                SELECT autor AS id, count(*)::int AS posts FROM posts WHERE criado_em > now() - interval '30 days'
                GROUP BY autor ORDER BY count(*) DESC LIMIT 50`);
            maisAtivos = { quando: Date.now(), contas: rows };
        }
        const candidatos = maisAtivos.contas.filter(conta => conta.id !== eu.id);
        // poucos ativos (a Comunidade comecando): completa com as contas mais novas
        const { rows } = await db.query(`
            SELECT c.id, c.nick, c.foto, coalesce(a.posts, 0) AS posts FROM contas c
            LEFT JOIN jsonb_to_recordset($2::jsonb) AS a (id uuid, posts int) ON a.id = c.id
            WHERE c.id <> $1 AND NOT EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = c.id)
              AND (a.id IS NOT NULL OR c.id IN (SELECT id FROM contas ORDER BY criada_em DESC LIMIT 20))
            ORDER BY coalesce(a.posts, 0) DESC, c.criada_em DESC LIMIT 5`, [eu.id, JSON.stringify(candidatos)]);
        return rows.map(linha => ({ id: linha.id, nick: linha.nick, foto: urlDaFoto(linha.id, linha.foto), posts: linha.posts }));
    }

    async function comentarios(postId, eu) {
        const postDoComentario = await exigirPost(postId);
        const { rows } = await (await banco()).query(`
            SELECT k.id, k.texto, k.criado_em, c.id AS autor_id, c.nick, c.foto FROM comentarios k JOIN contas c ON c.id = k.autor
            WHERE k.post = $1 ORDER BY k.criado_em, k.id LIMIT 300`, [postId]);
        return rows.map(linha => ({
            id: linha.id, texto: linha.texto, criadoEm: linha.criado_em, autor: autor(linha),
            // apaga quem escreveu, o dono do post e os admins
            podeApagar: linha.autor_id === eu.id || postDoComentario.autor === eu.id || f.ehAdmin(eu),
        }));
    }

    /** Trata /api/comunidade/... . partes ja vem sem o "comunidade". */
    return async function tratarComunidade(request, url, partes, eu) {
        const metodo = request.method;
        const [recurso, id, acao] = partes;
        const db = await banco();

        if (recurso === 'gerenciamento') return tratarGerenciamento(request, url, partes.slice(1), eu);
        // a punicao de quem esta usando, para o site avisar antes de a pessoa tentar publicar
        if (recurso === 'situacao' && !id && metodo === 'GET') return f.semCache(json(200, { punicao: await situacao(eu.id) }));
        if (recurso === 'feed' && !id && metodo === 'GET') return f.semCache(json(200, await abrirFeed(url, eu)));
        if (recurso === 'novidades' && !id && metodo === 'GET') return f.semCache(json(200, await novidades(url, eu)));
        // as proximas paginas do feed: ?ids=a,b,c (ate 50), na ordem pedida
        if (recurso === 'posts' && !id && metodo === 'GET') {
            const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
            if (ids.length > 50 || ids.some(outro => !ID.test(outro))) throw new Recusa(400, 'Lista de posts inválida');
            return f.semCache(json(200, await postsPorIds(ids, eu)));
        }
        if (recurso === 'posts' && !id && metodo === 'POST') return publicar(request, eu);
        if (recurso === 'posts' && id && !acao && metodo === 'GET') return f.semCache(json(200, await umPost((await exigirPost(id)).id, eu)));
        if (recurso === 'posts' && id && !acao && metodo === 'DELETE') {
            const alvo = await exigirPost(id);
            if (alvo.autor !== eu.id && !f.ehAdmin(eu)) throw new Recusa(403, 'Só quem escreveu pode apagar o post');
            if (alvo.autor !== eu.id) {
                const { rows } = await db.query('SELECT texto, cardinality(imagens) AS imagens FROM posts WHERE id = $1', [alvo.id]);
                await registrarNaModeracao(db, { conta: alvo.autor, admin: eu.id, acao: 'apagar_post',
                    detalhes: { texto: (rows[0]?.texto || '').slice(0, 200), imagens: rows[0]?.imagens || 0 } });
            }
            await db.query('DELETE FROM posts WHERE id = $1', [alvo.id]);
            return new Response(null, { status: 204 });
        }
        if (recurso === 'posts' && id && acao === 'curtida' && (metodo === 'POST' || metodo === 'DELETE')) {
            const alvo = await exigirPost(id);
            if (metodo === 'POST') await db.query('INSERT INTO curtidas (post, conta) VALUES ($1, $2) ON CONFLICT DO NOTHING', [alvo.id, eu.id]);
            else await db.query('DELETE FROM curtidas WHERE post = $1 AND conta = $2', [alvo.id, eu.id]);
            const { rows } = await db.query('SELECT curtidas_total AS curtidas FROM posts WHERE id = $1', [alvo.id]);
            return json(200, { curti: metodo === 'POST', curtidas: rows[0].curtidas });
        }
        if (recurso === 'posts' && id && acao === 'comentarios' && metodo === 'GET') return f.semCache(json(200, await comentarios(id, eu)));
        if (recurso === 'posts' && id && acao === 'comentarios' && metodo === 'POST') {
            const alvo = await exigirPost(id);
            const texto = validarComentario(await f.lerCorpo(request));
            await exigirQuePossaParticipar(eu);
            await f.exigirQueNaoEstejaFreado('comentario:' + eu.id, LIMITES.comentario);
            await db.query('INSERT INTO comentarios (id, post, autor, texto) VALUES ($1, $2, $3, $4)', [randomUUID(), alvo.id, eu.id, texto]);
            await f.registrarTentativa('comentario:' + eu.id);
            return json(201, await comentarios(alvo.id, eu));
        }
        if (recurso === 'comentarios' && id && !acao && metodo === 'DELETE') {
            if (!ID.test(id)) throw new Recusa(404, 'Comentário não encontrado');
            const { rows } = await db.query('SELECT k.id, k.autor, k.texto, p.autor AS dono_do_post FROM comentarios k JOIN posts p ON p.id = k.post WHERE k.id = $1', [id]);
            if (rows.length === 0) throw new Recusa(404, 'Comentário não encontrado');
            if (rows[0].autor !== eu.id && rows[0].dono_do_post !== eu.id && !f.ehAdmin(eu)) throw new Recusa(403, 'Você não pode apagar este comentário');
            // so quando o admin apaga como admin (nem o comentario nem o post sao dele)
            if (rows[0].autor !== eu.id && rows[0].dono_do_post !== eu.id) {
                await registrarNaModeracao(db, { conta: rows[0].autor, admin: eu.id, acao: 'apagar_comentario', detalhes: { texto: rows[0].texto.slice(0, 200) } });
            }
            await db.query('DELETE FROM comentarios WHERE id = $1', [id]);
            return new Response(null, { status: 204 });
        }
        if (recurso === 'imagens' && !id && metodo === 'POST') return enviarImagem(request, eu);
        if (recurso === 'imagens' && id && !acao && metodo === 'GET') {
            if (!NOME.test(id)) throw new Recusa(404, 'Imagem não encontrada');
            const { rows } = await db.query('SELECT conteudo FROM imagens_da_comunidade WHERE nome = $1', [id]);
            if (rows.length === 0) throw new Recusa(404, 'Imagem não encontrada');
            // o nome muda a cada envio: o navegador e a CDN do Vercel podem guardar para sempre, sem chamar a funcao de novo.
            // As imagens da Comunidade sao feitas para serem vistas pelos outros leitores, e o nome nao da para adivinhar
            return servirImagem(rows[0].conteudo, id, 'public, max-age=31536000, s-maxage=31536000, immutable');
        }
        if (recurso === 'sugestoes' && !id && metodo === 'GET') return f.semCache(json(200, await sugestoes(eu)));
        if (recurso === 'busca-rapida' && !id && metodo === 'GET') return f.semCache(json(200, await buscaRapida(url.searchParams.get('q'))));
        if (recurso === 'pessoas' && !id && metodo === 'GET') return f.semCache(json(200, await pessoas(url.searchParams.get('q'), eu)));
        // a descricao do proprio perfil (o nick e a foto continuam em PUT /api/conta)
        if (recurso === 'perfil' && !id && metodo === 'PUT') {
            const descricao = validarDescricao(await f.lerCorpo(request));
            // quem esta punido nao troca a descricao, que todos veem
            if (descricao) await exigirQuePossaParticipar(eu);
            await db.query('UPDATE contas SET descricao = $2 WHERE id = $1', [eu.id, descricao]);
            return json(200, await perfil(eu.id, eu));
        }
        if (recurso === 'contas' && id && !acao && metodo === 'GET') return f.semCache(json(200, await perfil(id, eu)));
        if (recurso === 'contas' && id && (acao === 'seguidores' || acao === 'seguindo') && metodo === 'GET') {
            return f.semCache(json(200, await listaDeSeguir((await exigirConta(id)).id, acao, eu)));
        }
        if (recurso === 'contas' && id && acao === 'seguir' && (metodo === 'POST' || metodo === 'DELETE')) {
            const conta = await exigirConta(id);
            if (conta.id === eu.id) throw new Recusa(400, 'Você não pode seguir a si mesmo');
            if (metodo === 'POST') await db.query('INSERT INTO seguindo (seguidor, seguido) VALUES ($1, $2) ON CONFLICT DO NOTHING', [eu.id, conta.id]);
            else await db.query('DELETE FROM seguindo WHERE seguidor = $1 AND seguido = $2', [eu.id, conta.id]);
            return json(200, await perfil(conta.id, eu));
        }
        // os mangas da Biblioteca de uma conta, abertos pelo numero de mangas do perfil (so para ver)
        if (recurso === 'contas' && id && acao === 'mangas' && metodo === 'GET') {
            const conta = await exigirConta(id);
            return f.semCache(json(200, await f.mangasDeOutraConta(conta.id, url)));
        }
        // as capas desses mangas (o nome muda a cada envio: pode ficar guardada no navegador)
        if (recurso === 'contas' && id && acao === 'capas' && partes[3] && metodo === 'GET') {
            if (!ID.test(id)) throw new Recusa(404, 'Capa não encontrada');
            const conteudo = await f.capaDeOutraConta(id, partes[3]);
            if (!conteudo) throw new Recusa(404, 'Capa não encontrada');
            return servirImagem(conteudo, partes[3], 'private, max-age=86400');
        }
        // a foto de perfil e privada na conta; na Comunidade, quem esta logado pode ver a dos outros
        if (recurso === 'contas' && id && acao === 'foto' && metodo === 'GET') {
            if (!ID.test(id)) throw new Recusa(404, 'Foto não encontrada');
            const { rows } = await db.query(
                'SELECT c.foto, i.conteudo FROM contas c JOIN imagens i ON i.nome = c.foto AND i.conta = c.id::text WHERE c.id = $1', [id]);
            if (rows.length === 0) throw new Recusa(404, 'Foto não encontrada');
            // o endereco leva o nome da foto (?v=): trocar a foto muda o endereco, entao pode ser guardada para sempre
            return servirImagem(rows[0].conteudo, rows[0].foto, 'public, max-age=31536000, s-maxage=31536000, immutable');
        }
        throw new Recusa(404, 'Endereço não encontrado');
    };
}

export { DadoInvalidoNaComunidade, IMAGENS_POR_POST };
