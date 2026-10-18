// Banners de anuncio: o cadastro (so o dono do site, na aba Banners do Gerenciar) e os relatorios: um geral do mes,
// para o dono, e um de cada banner para a empresa dona dele, por um link privado que nao pede login. Os lugares do site
// onde os banners vao aparecer ainda nao existem; quando existirem, eles somam as exibicoes e os cliques na tabela
// metricas_de_banner, que os relatorios ja leem. Mesmo desenho do painel de anuncios do CuidaMed (ADR-0055 e 0057).
//
// Sem rastrear ninguem: as contagens sao por dia, banner e lugar no site, sem conta, IP ou aparelho.
import { randomBytes } from 'node:crypto';

export const ESTRUTURA_DOS_BANNERS = `
    -- formato: horizontal ou vertical. pausado: fica no cadastro, mas nao aparece. peso: a parte das exibicoes (1 a 100)
    -- codigo_do_relatorio: o segredo do link do relatorio da empresa (trocar o codigo invalida o link antigo)
    CREATE TABLE IF NOT EXISTS banners (id TEXT PRIMARY KEY, empresa TEXT NOT NULL, texto TEXT NOT NULL DEFAULT '', link TEXT,
        formato TEXT NOT NULL, peso INT NOT NULL DEFAULT 1, pausado BOOLEAN NOT NULL DEFAULT false, imagem BYTEA NOT NULL,
        tipo_imagem TEXT NOT NULL, largura INT NOT NULL, altura INT NOT NULL, codigo_do_relatorio TEXT NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now());
    -- as contagens: por dia, banner e lugar do site. Sem chave estrangeira de proposito: um banner apagado continua nos
    -- numeros dos meses em que apareceu
    CREATE TABLE IF NOT EXISTS metricas_de_banner (dia DATE NOT NULL, banner TEXT NOT NULL, posicao TEXT NOT NULL DEFAULT '',
        exibicoes INT NOT NULL DEFAULT 0, cliques INT NOT NULL DEFAULT 0, PRIMARY KEY (dia, banner, posicao));
    CREATE INDEX IF NOT EXISTS metricas_de_banner_banner ON metricas_de_banner (banner, dia);
`;

export const BANNERS_MAXIMOS = 50;
export const TAMANHO_MAXIMO_DO_BANNER = 1024 * 1024;

/**
 * As medidas aceitas de cada formato (em pixels), e as proporcoes: um horizontal tem a largura de 2 a 11 vezes a
 * altura (1280 x 400, 970 x 250, 728 x 90); um vertical tem a altura de 1,5 a 5 vezes a largura (300 x 600,
 * 160 x 600, 120 x 600).
 */
export const FORMATOS_DE_BANNER = {
    horizontal: { nome: 'Horizontal', largura: [300, 4000], altura: [50, 2000], proporcao: [2, 11], exemplos: '1280 × 400, 970 × 250 ou 728 × 90' },
    vertical: { nome: 'Vertical', largura: [100, 2000], altura: [250, 4000], proporcao: [1.5, 5], exemplos: '300 × 600 ou 160 × 600' },
};

export class DadoInvalidoNoBanner extends Error {}

/** "Padaria do Zé!" -> "padaria-do-ze"; com numero no fim se ja existir. */
export function idDaEmpresa(empresa, existentes = []) {
    const base = String(empresa).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'banner';
    let id = base;
    for (let numero = 2; existentes.includes(id); numero++) id = `${base}-${numero}`;
    return id;
}

/**
 * O link do banner: vazio (o banner nao e clicavel), um endereco https://, ou um mailto: so com destinatario, assunto
 * e mensagem (sem copia oculta nem anexo). Nada de http:, javascript: e afins.
 */
export function validarLinkDeBanner(link) {
    const texto = typeof link === 'string' ? link.trim() : '';
    if (!texto) return null;
    if (texto.length > 500) throw new DadoInvalidoNoBanner('O link pode ter no máximo 500 caracteres');
    let url;
    try {
        url = new URL(texto);
    } catch {
        throw new DadoInvalidoNoBanner('Link inválido: use um endereço que comece com https://');
    }
    if (url.protocol === 'https:' && url.hostname.includes('.')) return url.toString();
    if (url.protocol === 'mailto:' && /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(decodeURIComponent(url.pathname))) {
        const proibidos = [...url.searchParams.keys()].filter(chave => !['subject', 'body'].includes(chave.toLowerCase()));
        if (proibidos.length === 0) return texto;
        throw new DadoInvalidoNoBanner('O link de e-mail só pode ter o destinatário, o assunto e a mensagem');
    }
    throw new DadoInvalidoNoBanner('Link inválido: use um endereço que comece com https:// (ou mailto: para e-mail)');
}

/** Os campos do formulario de um banner, conferidos: { empresa, texto, link, formato, peso }. */
export function validarDadosDoBanner(dados) {
    const empresa = typeof dados.empresa === 'string' ? dados.empresa.trim().replace(/\s+/g, ' ') : '';
    if (!empresa) throw new DadoInvalidoNoBanner('Informe o nome da empresa');
    if ([...empresa].length > 120) throw new DadoInvalidoNoBanner('O nome da empresa pode ter no máximo 120 caracteres');
    const texto = typeof dados.texto === 'string' ? dados.texto.trim().replace(/\s+/g, ' ') : '';
    if ([...texto].length > 200) throw new DadoInvalidoNoBanner('A descrição pode ter no máximo 200 caracteres');
    if (!Object.hasOwn(FORMATOS_DE_BANNER, dados.formato)) throw new DadoInvalidoNoBanner('Escolha o formato: horizontal ou vertical');
    const peso = Number(dados.peso ?? 1);
    if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new DadoInvalidoNoBanner('O peso vai de 1 a 100 (para tirar o banner do ar, use Pausar)');
    return { empresa, texto, link: validarLinkDeBanner(dados.link), formato: dados.formato, peso };
}

/** O tipo de verdade de uma imagem pelos primeiros bytes: PNG, JPEG ou WebP (nulo para o resto, inclusive SVG e GIF). */
export function tipoDaImagemDoBanner(bytes) {
    const b = Buffer.from(bytes);
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
}

/** Confere as medidas da imagem para o formato escolhido; devolve a mensagem do problema, ou nulo se esta tudo certo. */
export function problemaNasMedidas(formato, largura, altura) {
    const regra = FORMATOS_DE_BANNER[formato];
    if (!regra || !largura || !altura) return 'Não deu para ler as medidas da imagem';
    const [lMin, lMax] = regra.largura;
    const [aMin, aMax] = regra.altura;
    const exemplo = ` (por exemplo, ${regra.exemplos})`;
    if (largura < lMin || largura > lMax) return `Um banner ${regra.nome.toLowerCase()} tem de ${lMin} a ${lMax} px de largura; esta imagem tem ${largura}${exemplo}`;
    if (altura < aMin || altura > aMax) return `Um banner ${regra.nome.toLowerCase()} tem de ${aMin} a ${aMax} px de altura; esta imagem tem ${altura}${exemplo}`;
    const proporcao = formato === 'horizontal' ? largura / altura : altura / largura;
    const [pMin, pMax] = regra.proporcao;
    if (proporcao < pMin || proporcao > pMax) {
        return formato === 'horizontal'
            ? `Um banner horizontal é deitado: a largura precisa ser de ${pMin} a ${pMax} vezes a altura; esta imagem tem ${largura} × ${altura}${exemplo}`
            : `Um banner vertical é em pé: a altura precisa ser de ${pMin} a ${pMax} vezes a largura; esta imagem tem ${largura} × ${altura}${exemplo}`;
    }
    return null;
}

/** "AAAA-MM" valido, ou erro. */
export function lerMesDoRelatorio(valor) {
    const texto = String(valor ?? '');
    if (!/^(20[2-9]\d|2100)-(0[1-9]|1[0-2])$/.test(texto)) throw new DadoInvalidoNoBanner('Escolha um mês válido');
    return texto;
}

/** Os dias de um mes ('AAAA-MM'), do primeiro ao ultimo. */
export function diasDoMes(mes) {
    const [ano, numero] = mes.split('-').map(Number);
    const total = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
    return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

/** Taxa de cliques (cliques / exibicoes), em porcentagem com uma casa; nula sem exibicoes. */
export const taxaDeCliques = (cliques, exibicoes) => (exibicoes > 0 ? Math.round((cliques / exibicoes) * 1000) / 10 : null);

/**
 * Monta um relatorio a partir das linhas de metricas_de_banner do mes ([{ dia, banner, posicao, exibicoes, cliques }]):
 * os totais, uma serie por dia (todos os dias do mes, com zero) e os totais por banner e por lugar do site.
 */
export function montarRelatorio(mes, linhas) {
    const porDia = new Map(diasDoMes(mes).map(dia => [dia, { dia, exibicoes: 0, cliques: 0 }]));
    const porBanner = new Map();
    const porPosicao = new Map();
    let exibicoes = 0;
    let cliques = 0;
    for (const linha of linhas) {
        const e = Number(linha.exibicoes) || 0;
        const c = Number(linha.cliques) || 0;
        exibicoes += e;
        cliques += c;
        const dia = porDia.get(linha.dia);
        if (dia) {
            dia.exibicoes += e;
            dia.cliques += c;
        }
        const banner = porBanner.get(linha.banner) || { banner: linha.banner, exibicoes: 0, cliques: 0 };
        banner.exibicoes += e;
        banner.cliques += c;
        porBanner.set(linha.banner, banner);
        const nomeDaPosicao = linha.posicao || 'sem lugar';
        const posicao = porPosicao.get(nomeDaPosicao) || { posicao: nomeDaPosicao, exibicoes: 0, cliques: 0 };
        posicao.exibicoes += e;
        posicao.cliques += c;
        porPosicao.set(nomeDaPosicao, posicao);
    }
    const comTaxa = item => ({ ...item, taxa: taxaDeCliques(item.cliques, item.exibicoes), parte: exibicoes > 0 ? Math.round((item.exibicoes / exibicoes) * 1000) / 10 : 0 });
    return {
        mes,
        totais: { exibicoes, cliques, taxa: taxaDeCliques(cliques, exibicoes) },
        porDia: [...porDia.values()],
        porBanner: [...porBanner.values()].map(comTaxa).sort((a, b) => b.exibicoes - a.exibicoes || a.banner.localeCompare(b.banner)),
        porPosicao: [...porPosicao.values()].map(comTaxa).sort((a, b) => b.exibicoes - a.exibicoes || a.posicao.localeCompare(b.posicao)),
    };
}

/** Uma celula de planilha (CSV) segura: entre aspas, e sem virar formula se comecar com = + - @. */
export function celulaDoCsv(valor) {
    let texto = valor == null ? '' : String(valor);
    if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
}

/**
 * @param f ferramentas do api/index.js: banco, json, Recusa, semCache, ehDono
 */
export function criarBanners(f) {
    const { banco, json, Recusa } = f;
    const MES_ATUAL = `to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')`;
    const CAMPOS = 'id, empresa, texto, link, formato, peso, pausado, tipo_imagem, largura, altura, codigo_do_relatorio, criado_em, atualizado_em';
    const novoCodigo = () => randomBytes(18).toString('base64url');

    const publico = (banner, numeros = {}) => ({
        id: banner.id, empresa: banner.empresa, texto: banner.texto, link: banner.link, formato: banner.formato,
        peso: banner.peso, pausado: banner.pausado, largura: banner.largura, altura: banner.altura,
        imagem: `/api/banners/${encodeURIComponent(banner.id)}/imagem?v=${new Date(banner.atualizado_em).getTime()}`,
        criadoEm: banner.criado_em, atualizadoEm: banner.atualizado_em,
        // o caminho do relatorio da empresa (o site monta o endereco completo)
        relatorio: `#/relatorio-de-banner/${encodeURIComponent(banner.id)}/${banner.codigo_do_relatorio}`,
        exibicoes: numeros.exibicoes || 0, cliques: numeros.cliques || 0, taxa: taxaDeCliques(numeros.cliques || 0, numeros.exibicoes || 0),
    });

    async function exigirBanner(id) {
        if (!/^[a-z0-9-]{1,50}$/.test(id || '')) throw new Recusa(404, 'Banner não encontrado');
        const { rows } = await (await banco()).query(`SELECT ${CAMPOS} FROM banners WHERE id = $1`, [id]);
        if (!rows.length) throw new Recusa(404, 'Banner não encontrado');
        return rows[0];
    }

    /** A imagem do formulario (multipart), conferida pelo conteudo: { bytes, tipo, largura, altura }. */
    async function lerImagem(arquivo, formato) {
        if (!arquivo || typeof arquivo === 'string' || arquivo.size === 0) return null;
        if (arquivo.size > TAMANHO_MAXIMO_DO_BANNER) throw new DadoInvalidoNoBanner('A imagem pode ter no máximo 1 MB (o ideal é até uns 300 KB)');
        const bytes = Buffer.from(await arquivo.arrayBuffer());
        const tipo = tipoDaImagemDoBanner(bytes);
        if (!tipo) throw new DadoInvalidoNoBanner('A imagem precisa ser PNG, JPEG ou WebP');
        const { default: sharp } = await import('sharp');
        let largura;
        let altura;
        try {
            // so o cabecalho: uma imagem "bomba" nao chega a ser aberta inteira
            ({ width: largura, height: altura } = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata());
        } catch {
            throw new DadoInvalidoNoBanner('Não deu para ler essa imagem');
        }
        const problema = problemaNasMedidas(formato, largura, altura);
        if (problema) throw new DadoInvalidoNoBanner(problema);
        return { bytes, tipo, largura, altura };
    }

    async function linhasDoMes(mes, banner) {
        const { rows } = await (await banco()).query(`
            SELECT to_char(dia, 'YYYY-MM-DD') AS dia, banner, posicao, exibicoes, cliques FROM metricas_de_banner
            WHERE to_char(dia, 'YYYY-MM') = $1 ${banner ? 'AND banner = $2' : ''} ORDER BY dia`, banner ? [mes, banner] : [mes]);
        return rows;
    }

    async function mesPedido(url) {
        if (url.searchParams.get('mes')) return lerMesDoRelatorio(url.searchParams.get('mes'));
        const { rows } = await (await banco()).query(`SELECT ${MES_ATUAL} AS mes`);
        return rows[0].mes;
    }

    /** O relatorio de um banner, para o dono e para a empresa (sem o que so o dono ve). */
    async function relatorioDoBanner(banner, url) {
        const mes = await mesPedido(url);
        const { rows: [{ atual }] } = await (await banco()).query(`SELECT ${MES_ATUAL} AS atual`);
        const relatorio = montarRelatorio(mes, await linhasDoMes(mes, banner.id));
        delete relatorio.porBanner;
        return {
            ...relatorio, atual,
            banner: { id: banner.id, empresa: banner.empresa, texto: banner.texto, link: banner.link, formato: banner.formato,
                largura: banner.largura, altura: banner.altura, pausado: banner.pausado,
                imagem: `/api/banners/${encodeURIComponent(banner.id)}/imagem?v=${new Date(banner.atualizado_em).getTime()}`,
                desde: banner.criado_em },
        };
    }

    async function salvar(request, id) {
        let formulario;
        try {
            formulario = await request.formData();
        } catch {
            throw new DadoInvalidoNoBanner('Envie o formulário do banner');
        }
        const campo = nome => formulario.get(nome);
        const dados = validarDadosDoBanner({ empresa: campo('empresa'), texto: campo('texto'), link: campo('link'), formato: campo('formato'), peso: campo('peso') });
        const db = await banco();
        const imagem = await lerImagem(campo('imagem'), dados.formato);
        if (!id) {
            if (!imagem) throw new DadoInvalidoNoBanner('Escolha a imagem do banner');
            const { rows } = await db.query('SELECT id FROM banners');
            if (rows.length >= BANNERS_MAXIMOS) throw new DadoInvalidoNoBanner(`No máximo ${BANNERS_MAXIMOS} banners: apague algum antigo antes`);
            const novoId = idDaEmpresa(dados.empresa, rows.map(linha => linha.id));
            await db.query(`INSERT INTO banners (id, empresa, texto, link, formato, peso, imagem, tipo_imagem, largura, altura, codigo_do_relatorio)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [novoId, dados.empresa, dados.texto, dados.link, dados.formato, dados.peso, imagem.bytes, imagem.tipo, imagem.largura, imagem.altura, novoCodigo()]);
            return publico(await exigirBanner(novoId));
        }
        const atual = await exigirBanner(id);
        // trocar o formato sem trocar a imagem: a imagem que ja esta la tem que servir no formato novo
        if (!imagem && dados.formato !== atual.formato) {
            const problema = problemaNasMedidas(dados.formato, atual.largura, atual.altura);
            if (problema) throw new DadoInvalidoNoBanner(problema + '. Envie uma imagem nova para o formato novo');
        }
        await db.query(`UPDATE banners SET empresa = $2, texto = $3, link = $4, formato = $5, peso = $6, atualizado_em = now()
            ${imagem ? ', imagem = $7, tipo_imagem = $8, largura = $9, altura = $10' : ''} WHERE id = $1`,
        imagem ? [id, dados.empresa, dados.texto, dados.link, dados.formato, dados.peso, imagem.bytes, imagem.tipo, imagem.largura, imagem.altura]
            : [id, dados.empresa, dados.texto, dados.link, dados.formato, dados.peso]);
        return publico(await exigirBanner(id));
    }

    async function lista() {
        const db = await banco();
        const [{ rows: banners }, { rows: numeros }] = await Promise.all([
            db.query(`SELECT ${CAMPOS} FROM banners ORDER BY pausado, criado_em DESC`),
            db.query(`SELECT banner, sum(exibicoes)::int AS exibicoes, sum(cliques)::int AS cliques FROM metricas_de_banner
                WHERE to_char(dia, 'YYYY-MM') = ${MES_ATUAL} GROUP BY banner`),
        ]);
        const doMes = new Map(numeros.map(linha => [linha.banner, linha]));
        return { banners: banners.map(banner => publico(banner, doMes.get(banner.id))), maximo: BANNERS_MAXIMOS, formatos: FORMATOS_DE_BANNER };
    }

    async function relatorioGeral(url) {
        const mes = await mesPedido(url);
        const db = await banco();
        const [{ rows: [{ atual }] }, linhas, { rows: banners }] = await Promise.all([
            db.query(`SELECT ${MES_ATUAL} AS atual`),
            linhasDoMes(mes),
            db.query('SELECT id, empresa, formato, pausado FROM banners'),
        ]);
        const relatorio = montarRelatorio(mes, linhas);
        const cadastro = new Map(banners.map(banner => [banner.id, banner]));
        // os banners do cadastro que nao apareceram no mes entram com zero; os apagados aparecem como "fora do cadastro"
        for (const banner of banners) {
            if (!relatorio.porBanner.some(item => item.banner === banner.id)) relatorio.porBanner.push({ banner: banner.id, exibicoes: 0, cliques: 0, taxa: null, parte: 0 });
        }
        relatorio.porBanner = relatorio.porBanner.map(item => ({ ...item, empresa: cadastro.get(item.banner)?.empresa || null,
            formato: cadastro.get(item.banner)?.formato || null, pausado: cadastro.get(item.banner)?.pausado ?? null, foraDoCadastro: !cadastro.has(item.banner) }));
        return { ...relatorio, atual, ativos: banners.filter(banner => !banner.pausado).length, cadastrados: banners.length };
    }

    async function planilha(url) {
        const mes = await mesPedido(url);
        const db = await banco();
        const [linhas, { rows: banners }] = await Promise.all([linhasDoMes(mes), db.query('SELECT id, empresa FROM banners')]);
        const empresas = new Map(banners.map(banner => [banner.id, banner.empresa]));
        const texto = [['dia', 'banner', 'empresa', 'lugar', 'exibicoes', 'cliques'].map(celulaDoCsv).join(','),
            ...linhas.map(linha => [linha.dia, linha.banner, empresas.get(linha.banner) || '(fora do cadastro)', linha.posicao, linha.exibicoes, linha.cliques].map(celulaDoCsv).join(','))].join('\r\n');
        // o BOM faz o Excel abrir com os acentos certos
        return new Response('﻿' + texto + '\r\n', { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="banners-viracap-${mes}.csv"`, 'Cache-Control': 'no-store' } });
    }

    function traduzirErros(funcao) {
        return async (...argumentos) => {
            try {
                return await funcao(...argumentos);
            } catch (erro) {
                if (erro instanceof DadoInvalidoNoBanner) throw new Recusa(400, erro.message);
                throw erro;
            }
        };
    }

    return {
        /** Rotas sem login: a imagem de um banner e o relatorio da empresa (pelo codigo do link). Nulo se nao for uma delas. */
        semLogin: traduzirErros(async (request, url, partes) => {
            const [id, acao, codigo] = partes;
            if (request.method !== 'GET') return null;
            if (id && acao === 'imagem' && !codigo) {
                const { rows } = await (await banco()).query('SELECT imagem, tipo_imagem FROM banners WHERE id = $1', [id]);
                if (!rows.length) return new Response('Banner não encontrado', { status: 404 });
                // o endereco leva ?v= (a ultima mudanca): pode ficar guardado por um ano
                return new Response(rows[0].imagem, { status: 200, headers: { 'Content-Type': rows[0].tipo_imagem, 'X-Content-Type-Options': 'nosniff',
                    'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300' } });
            }
            if (id === 'relatorio-da-empresa' && acao && codigo) {
                const { rows } = await (await banco()).query(`SELECT ${CAMPOS} FROM banners WHERE id = $1`, [acao]);
                // o mesmo "nao encontrado" para banner que nao existe e codigo errado: o link nao da pistas
                if (!rows.length || rows[0].codigo_do_relatorio.length !== codigo.length || rows[0].codigo_do_relatorio !== codigo) {
                    throw new Recusa(404, 'Relatório não encontrado. Confira o link ou peça um novo.');
                }
                const resposta = json(200, await relatorioDoBanner(rows[0], url));
                resposta.headers.set('Cache-Control', 'no-store');
                resposta.headers.set('X-Robots-Tag', 'noindex');
                return resposta;
            }
            return null;
        }),
        /** Rotas do dono do site. */
        comLogin: traduzirErros(async (request, url, partes, eu) => {
            if (!f.ehDono(eu)) throw new Recusa(403, 'Só o dono do site gerencia os banners');
            const [id, acao] = partes;
            const metodo = request.method;
            const db = await banco();
            if (!id && metodo === 'GET') return f.semCache(json(200, await lista()));
            if (!id && metodo === 'POST') return json(201, await salvar(request));
            if (id === 'relatorio' && !acao && metodo === 'GET') return f.semCache(json(200, await relatorioGeral(url)));
            if (id === 'planilha' && !acao && metodo === 'GET') return planilha(url);
            if (id && !acao && metodo === 'PUT') return json(200, await salvar(request, id));
            if (id && !acao && metodo === 'DELETE') {
                await exigirBanner(id);
                await db.query('DELETE FROM banners WHERE id = $1', [id]);
                return new Response(null, { status: 204 });
            }
            if (id && acao === 'pausa' && metodo === 'PUT') {
                await exigirBanner(id);
                const { pausado } = await f.lerCorpo(request);
                await db.query('UPDATE banners SET pausado = $2 WHERE id = $1', [id, pausado === true]);
                return json(200, publico(await exigirBanner(id)));
            }
            if (id && acao === 'novo-link' && metodo === 'POST') {
                await exigirBanner(id);
                await db.query('UPDATE banners SET codigo_do_relatorio = $2 WHERE id = $1', [id, novoCodigo()]);
                return json(200, publico(await exigirBanner(id)));
            }
            if (id && acao === 'relatorio' && metodo === 'GET') {
                const banner = await exigirBanner(id);
                return f.semCache(json(200, { ...(await relatorioDoBanner(banner, url)), linkDaEmpresa: publico(banner).relatorio }));
            }
            throw new Recusa(404, 'Endereço não encontrado');
        }),
    };
}
