// Rotas da Comunidade: feed, posts (com imagens e listas anexadas), curtidas, comentarios, seguir e perfis.
// Tudo pede login; quem esta usando chega em "eu" (a conta da sessao). So a versao do Vercel tem a Comunidade.
import { randomUUID } from 'node:crypto';
import { DadoInvalidoNaComunidade, IMAGENS_POR_POST, PESOS, POSTS_DO_FEED, POSTS_POR_PAGINA, TAMANHO_MAXIMO_DA_IMAGEM, validarComentario, validarPost } from './_comunidade.js';

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
`;

// limites por conta: posts, comentarios e imagens enviadas por hora
const LIMITES = {
    post: { maximo: 30, minutos: 60 },
    comentario: { maximo: 60, minutos: 60 },
    imagem: { maximo: 60, minutos: 60 },
};

/**
 * @param f ferramentas do api/index.js: banco, json, Recusa, lerCorpo, semCache, exigirQueNaoEstejaFreado,
 *          registrarTentativa, descobrirExtensao, ehAdmin, miniaturasDe (nome da capa -> nome da miniatura)
 */
export function criarComunidade(f) {
    const { banco, json, Recusa } = f;

    const urlDaFoto = (id, foto) => (foto ? `/api/comunidade/contas/${id}/foto?v=${encodeURIComponent(foto)}` : null);
    const autor = linha => ({ id: linha.autor_id, nick: linha.nick, foto: urlDaFoto(linha.autor_id, linha.foto) });

    // os campos que todo post devolvido leva; $1 e sempre quem esta usando. Os totais ja estao no post (gatilhos)
    const CAMPOS_DO_POST = `
        p.id, p.texto, p.imagens, p.lista, p.criado_em, c.id AS autor_id, c.nick, c.foto,
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
     * totais guardados no proprio post), divididos pelo tempo. So os ids saem: a ordem e calculada uma vez por abertura.
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
        else {
            const ranking = await rankingParaVoce(eu);
            // ?novosDesde=: a pessoa clicou em "N posts novos": os novos vem primeiro (na ordem de relevancia), depois o resto
            const desde = Date.parse(url.searchParams.get('novosDesde') || '');
            const novo = linha => !Number.isNaN(desde) && new Date(linha.criado_em).getTime() > desde && linha.autor !== eu.id;
            ids = [...ranking.filter(novo), ...ranking.filter(linha => !novo(linha))].map(linha => linha.id);
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

    async function umPost(id, eu) {
        const [achado] = await postsPorIds([id], eu);
        if (!achado) throw new Recusa(404, 'Post não encontrado');
        return achado;
    }

    /** Envia uma imagem para um post: fica solta ate o post ser publicado (as soltas de mais de um dia sao apagadas). */
    async function enviarImagem(request, eu) {
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
            SELECT (SELECT count(*) FROM posts WHERE autor = $2)::int AS posts,
                   (SELECT count(*) FROM seguindo WHERE seguido = $2)::int AS seguidores,
                   (SELECT count(*) FROM seguindo WHERE seguidor = $2)::int AS seguindo,
                   EXISTS (SELECT 1 FROM seguindo WHERE seguidor = $1 AND seguido = $2) AS sigo`, [eu.id, conta.id]);
        return { id: conta.id, nick: conta.nick, foto: urlDaFoto(conta.id, conta.foto), criadaEm: conta.criada_em, ...rows[0], euMesmo: conta.id === eu.id };
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
            await f.exigirQueNaoEstejaFreado('comentario:' + eu.id, LIMITES.comentario);
            await db.query('INSERT INTO comentarios (id, post, autor, texto) VALUES ($1, $2, $3, $4)', [randomUUID(), alvo.id, eu.id, texto]);
            await f.registrarTentativa('comentario:' + eu.id);
            return json(201, await comentarios(alvo.id, eu));
        }
        if (recurso === 'comentarios' && id && !acao && metodo === 'DELETE') {
            if (!ID.test(id)) throw new Recusa(404, 'Comentário não encontrado');
            const { rows } = await db.query('SELECT k.id, k.autor, p.autor AS dono_do_post FROM comentarios k JOIN posts p ON p.id = k.post WHERE k.id = $1', [id]);
            if (rows.length === 0) throw new Recusa(404, 'Comentário não encontrado');
            if (rows[0].autor !== eu.id && rows[0].dono_do_post !== eu.id && !f.ehAdmin(eu)) throw new Recusa(403, 'Você não pode apagar este comentário');
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
        if (recurso === 'contas' && id && !acao && metodo === 'GET') return f.semCache(json(200, await perfil(id, eu)));
        if (recurso === 'contas' && id && acao === 'seguir' && (metodo === 'POST' || metodo === 'DELETE')) {
            const conta = await exigirConta(id);
            if (conta.id === eu.id) throw new Recusa(400, 'Você não pode seguir a si mesmo');
            if (metodo === 'POST') await db.query('INSERT INTO seguindo (seguidor, seguido) VALUES ($1, $2) ON CONFLICT DO NOTHING', [eu.id, conta.id]);
            else await db.query('DELETE FROM seguindo WHERE seguidor = $1 AND seguido = $2', [eu.id, conta.id]);
            return json(200, await perfil(conta.id, eu));
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
