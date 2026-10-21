// Banners de anuncio: o cadastro (so o dono do site, na aba Banners do Gerenciar), os lugares do site onde eles
// aparecem (doc 91: a lista dos que estao no ar, a contagem das exibicoes e o clique que leva ao site da empresa) e os
// relatorios: um geral do mes, para o dono, e um de cada banner para a empresa dona dele, por um link privado que nao
// pede login. As contagens ficam em metricas_de_banner. Mesmo desenho do painel de anuncios do CuidaMed (ADR-0055 e 0057).
//
// Sem rastrear ninguem: as contagens sao por dia, banner e lugar no site, sem conta, IP ou aparelho.
import { randomBytes, randomUUID } from 'node:crypto';

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
    -- quanto o banner rende (centavos) e como e cobrado (mensal ou unica): vira uma receita nas Financas (lancamento);
    -- termina_em: o dia em que o banner acaba (dai em diante o peso vira 0)
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS valor INT;
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS cobranca TEXT;
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS termina_em DATE;
    ALTER TABLE banners ADD COLUMN IF NOT EXISTS lancamento UUID;
    -- as imagens (doc 96): um banner pode ter a horizontal, a vertical ou as duas (no minimo uma). Antes era uma imagem
    -- so, nas colunas imagem/tipo_imagem/largura/altura do banner, no formato da coluna formato; elas passam para esta
    -- tabela (uma vez) e ficam vazias
    CREATE TABLE IF NOT EXISTS imagens_de_banner (banner TEXT NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
        formato TEXT NOT NULL, imagem BYTEA NOT NULL, tipo TEXT NOT NULL, largura INT NOT NULL, altura INT NOT NULL,
        atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (banner, formato));
    ALTER TABLE banners ALTER COLUMN formato DROP NOT NULL, ALTER COLUMN imagem DROP NOT NULL, ALTER COLUMN tipo_imagem DROP NOT NULL,
        ALTER COLUMN largura DROP NOT NULL, ALTER COLUMN altura DROP NOT NULL;
    INSERT INTO imagens_de_banner (banner, formato, imagem, tipo, largura, altura, atualizada_em)
        SELECT id, formato, imagem, tipo_imagem, largura, altura, atualizado_em FROM banners WHERE imagem IS NOT NULL AND formato IS NOT NULL
        ON CONFLICT DO NOTHING;
    UPDATE banners SET imagem = NULL, tipo_imagem = NULL, largura = NULL, altura = NULL, formato = NULL WHERE imagem IS NOT NULL;
`;

export const BANNERS_MAXIMOS = 50;

/**
 * Os lugares do site onde aparecem banners (doc 91), com o nome que vai para os relatorios. Os verticais ficam nas
 * laterais quando sobra espaco ao lado do conteudo; sem espaco, a pagina mostra os horizontais no lugar deles.
 */
export const LUGARES_DE_BANNER = {
    'biblioteca-fim': 'Biblioteca, embaixo da lista',
    'hoje-fim': 'Lançam hoje, embaixo da lista',
    'descobrir-esquerda': 'Descobrir, lateral esquerda',
    'descobrir-direita': 'Descobrir, lateral direita',
    'descobrir-topo': 'Descobrir, em cima das obras',
    'atalho-1': 'Extensão e atalho, ao lado do texto (primeiro)',
    'atalho-2': 'Extensão e atalho, ao lado do texto (segundo)',
    'atalho-fim': 'Extensão e atalho, embaixo do texto',
    'loja-esquerda': 'Loja, lateral esquerda',
    'loja-direita': 'Loja, lateral direita',
    'loja-topo': 'Loja, em cima',
    'loja-fim': 'Loja, embaixo',
    'comunidade-esquerda': 'Comunidade, lateral esquerda',
    'comunidade-direita': 'Comunidade, embaixo de Quem seguir',
    'comunidade-topo': 'Comunidade, em cima do feed',
    'manga-esquerda': 'Página do mangá, lateral esquerda',
    'manga-direita': 'Página do mangá, lateral direita',
    'manga-meio': 'Página do mangá, entre as informações e as listas',
    'manga-fim': 'Página do mangá, embaixo',
    'formulario-esquerda': 'Novo mangá e edição, lateral esquerda',
    'formulario-direita': 'Novo mangá e edição, lateral direita',
    'formulario-topo': 'Novo mangá e edição, em cima',
    'formulario-fim': 'Novo mangá e edição, embaixo',
};

/** As exibicoes que uma pagina manda de uma vez: [{ banner, posicao }], conferidas (no maximo 12, lugares conhecidos). */
export function lerExibicoes(corpo) {
    const itens = Array.isArray(corpo?.itens) ? corpo.itens : [];
    if (itens.length > 12) throw new DadoInvalidoNoBanner('Exibições demais de uma vez');
    return itens.filter(item => typeof item?.banner === 'string' && item.banner.length <= 80 && Object.hasOwn(LUGARES_DE_BANNER, item?.posicao))
        .map(item => ({ banner: item.banner, posicao: item.posicao }));
}
// 4 MB por imagem (doc 125): o Vercel recusa envios acima de 4,5 MB, entao com as duas grandes o site manda uma por vez
export const TAMANHO_MAXIMO_DO_BANNER = 4 * 1024 * 1024;

/**
 * As medidas aceitas de cada formato (em pixels), e as proporcoes. O vertical e o horizontal deitado em pe (doc 97):
 * um horizontal tem de 300 a 4000 px de largura, de 50 a 2000 de altura e a largura de 2 a 11 vezes a altura
 * (1280 x 400, 970 x 250, 728 x 90); um vertical tem as medidas trocadas: de 50 a 2000 px de largura, de 300 a 4000
 * de altura e a altura de 2 a 11 vezes a largura (400 x 1280, 250 x 970, 90 x 728).
 */
const HORIZONTAL = { largura: [300, 4000], altura: [50, 2000], proporcao: [2, 11] };
export const FORMATOS_DE_BANNER = {
    horizontal: { nome: 'Horizontal', ...HORIZONTAL, exemplos: '1280 × 400, 970 × 250 ou 728 × 90' },
    vertical: { nome: 'Vertical', largura: HORIZONTAL.altura, altura: HORIZONTAL.largura, proporcao: HORIZONTAL.proporcao, exemplos: '400 × 1280, 250 × 970 ou 90 × 728' },
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

/** "1.234,56", "1234.56", "R$ 150" -> centavos; vazio -> nulo. */
export function lerValorEmReais(texto) {
    const limpo = String(texto ?? '').replace(/[R$\s]/g, '');
    if (!limpo) return null;
    const numero = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
    if (!/^\d+(\.\d{1,2})?$/.test(numero)) throw new DadoInvalidoNoBanner('Escreva o valor como 150,00');
    const centavos = Math.round(Number(numero) * 100);
    if (centavos < 1 || centavos > 100_000_000) throw new DadoInvalidoNoBanner('O valor vai de R$ 0,01 a R$ 1.000.000,00');
    return centavos;
}

/** "AAAA-MM-DD" valido (uma data que existe), vazio -> nulo. */
export function lerDataDeTermino(texto) {
    const valor = String(texto ?? '').trim();
    if (!valor) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || new Date(valor + 'T12:00:00Z').toISOString().slice(0, 10) !== valor) {
        throw new DadoInvalidoNoBanner('Escolha uma data de término válida');
    }
    return valor;
}

/** Os campos do formulario de um banner, conferidos: { empresa, texto, link, peso, valor, cobranca, terminaEm }. As imagens sao conferidas a parte. */
export function validarDadosDoBanner(dados) {
    const empresa = typeof dados.empresa === 'string' ? dados.empresa.trim().replace(/\s+/g, ' ') : '';
    if (!empresa) throw new DadoInvalidoNoBanner('Informe o nome da empresa');
    if ([...empresa].length > 120) throw new DadoInvalidoNoBanner('O nome da empresa pode ter no máximo 120 caracteres');
    const texto = typeof dados.texto === 'string' ? dados.texto.trim().replace(/\s+/g, ' ') : '';
    if ([...texto].length > 200) throw new DadoInvalidoNoBanner('A descrição pode ter no máximo 200 caracteres');
    const peso = Number(dados.peso ?? 1);
    if (!Number.isInteger(peso) || peso < 0 || peso > 100) throw new DadoInvalidoNoBanner('O peso vai de 0 a 100 (0: o banner não aparece)');
    const valor = lerValorEmReais(dados.valor);
    const cobranca = valor == null ? null : dados.cobranca;
    if (valor != null && !['mensal', 'unica'].includes(cobranca)) throw new DadoInvalidoNoBanner('Escolha se o valor é por mês ou de uma vez só');
    return { empresa, texto, link: validarLinkDeBanner(dados.link), peso, valor, cobranca, terminaEm: lerDataDeTermino(dados.terminaEm) };
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
        const nomeDaPosicao = LUGARES_DE_BANNER[linha.posicao] || linha.posicao || 'sem lugar';
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
    // imagens: { horizontal: { largura, altura, v }, vertical: {...} } (so os formatos que o banner tem)
    const CAMPOS = `id, empresa, texto, link, peso, pausado, codigo_do_relatorio, criado_em, atualizado_em,
        (SELECT json_object_agg(formato, json_build_object('largura', largura, 'altura', altura, 'v', (extract(epoch FROM atualizada_em) * 1000)::bigint))
            FROM imagens_de_banner WHERE banner = banners.id) AS imagens,
        valor, cobranca, to_char(termina_em, 'YYYY-MM-DD') AS termina_em, lancamento`;
    const HOJE = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
    /** "AAAA-MM-DD" de hoje no horario de Brasilia. */
    const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const mesAnterior = mes => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);

    /** Banners que chegaram ao dia do termino: o peso vira 0 (deixam de aparecer). Roda antes de mostrar a lista. */
    async function encerrarVencidos(db) {
        await db.query(`UPDATE banners SET peso = 0 WHERE termina_em IS NOT NULL AND termina_em <= ${HOJE} AND peso > 0`);
    }

    /**
     * Deixa a receita do banner nas Financas igual ao cadastro (dentro da mesma transacao). Mensal: conta todo mes,
     * do mes em que comecou ate o mes do termino (ou sem fim); unica: conta no dia em que foi cadastrada. Mudar o valor
     * de um mensal vale a partir deste mes (os meses de antes ficam com o valor antigo); tirar o valor ou trocar a
     * cobranca encerra a receita antiga no mes passado (ou apaga, se ela comecou este mes).
     */
    async function sincronizarReceita(db, banner, dados) {
        const mes = hoje().slice(0, 7);
        const nome = ('Banner: ' + dados.empresa).slice(0, 60);
        const fimDoMensal = dados.terminaEm ? dados.terminaEm.slice(0, 7) + '-01' : null;
        const { rows } = banner.lancamento
            ? await db.query(`SELECT id, valor, recorrencia, to_char(inicio, 'YYYY-MM-DD') AS inicio FROM financas WHERE id = $1`, [banner.lancamento])
            : { rows: [] };
        const atual = rows[0] || null;
        // encerra (ou apaga) a receita atual
        const encerrar = async () => {
            if (!atual) return;
            if (atual.recorrencia === 'mensal' && atual.inicio.slice(0, 7) < mes) {
                await db.query(`UPDATE financas SET fim = $2 WHERE id = $1 AND (fim IS NULL OR fim >= $2)`, [atual.id, mesAnterior(mes) + '-01']);
            } else if (atual.recorrencia === 'mensal' || atual.inicio.slice(0, 7) === mes) {
                await db.query('DELETE FROM financas WHERE id = $1', [atual.id]);
            }
            // uma unica de um mes que ja passou fica: o dinheiro entrou
        };
        const criar = async (inicio) => {
            const id = randomUUID();
            await db.query(`INSERT INTO financas (id, tipo, nome, valor, recorrencia, inicio, fim, banner) VALUES ($1, 'receita', $2, $3, $4, $5, $6, $7)`,
                [id, nome, dados.valor, dados.cobranca, inicio, dados.cobranca === 'mensal' ? fimDoMensal : null, banner.id]);
            return id;
        };
        let novo = atual?.id || null;
        if (dados.valor == null) {
            await encerrar();
            novo = null;
        } else if (!atual || atual.recorrencia !== dados.cobranca) {
            await encerrar();
            novo = await criar(dados.cobranca === 'mensal' ? mes + '-01' : hoje());
        } else if (dados.cobranca === 'mensal' && atual.valor !== dados.valor && atual.inicio.slice(0, 7) < mes) {
            // o valor novo vale deste mes em diante
            await db.query('UPDATE financas SET fim = $2 WHERE id = $1', [atual.id, mesAnterior(mes) + '-01']);
            novo = await criar(mes + '-01');
        } else {
            await db.query(`UPDATE financas SET nome = $2, valor = $3, fim = $4 WHERE id = $1`,
                [atual.id, nome, dados.valor, dados.cobranca === 'mensal' ? fimDoMensal : null]);
        }
        if (novo !== banner.lancamento) await db.query('UPDATE banners SET lancamento = $2 WHERE id = $1', [banner.id, novo]);
    }
    const novoCodigo = () => randomBytes(18).toString('base64url');

    /**
     * As imagens do banner para a API: { horizontal: { url, largura, altura } ou null, vertical: ... }, e a "principal"
     * (a horizontal, ou a vertical se so tiver ela), para as telas que mostram uma so.
     */
    const imagensPublicas = banner => {
        const imagens = Object.fromEntries(Object.keys(FORMATOS_DE_BANNER).map(formato => {
            const imagem = banner.imagens?.[formato];
            return [formato, imagem ? { url: `/api/banners/${encodeURIComponent(banner.id)}/imagem?formato=${formato}&v=${imagem.v}`,
                largura: imagem.largura, altura: imagem.altura } : null];
        }));
        const principal = imagens.horizontal || imagens.vertical;
        const formatos = Object.keys(imagens).filter(formato => imagens[formato]);
        return { imagens, imagem: principal?.url || null, largura: principal?.largura || null, altura: principal?.altura || null,
            formatos, formato: formatos.length === 2 ? 'ambos' : formatos[0] || null };
    };

    const publico = (banner, numeros = {}) => ({
        id: banner.id, empresa: banner.empresa, texto: banner.texto, link: banner.link,
        peso: banner.peso, pausado: banner.pausado, ...imagensPublicas(banner),
        criadoEm: banner.criado_em, atualizadoEm: banner.atualizado_em,
        valor: banner.valor, cobranca: banner.cobranca, terminaEm: banner.termina_em,
        // chegou ao dia do termino: nao aparece mais (o peso ja virou 0)
        encerrado: Boolean(banner.termina_em) && banner.termina_em <= hoje(),
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
        if (arquivo.size > TAMANHO_MAXIMO_DO_BANNER) throw new DadoInvalidoNoBanner('A imagem pode ter no máximo 4 MB (o ideal é até uns 300 KB, para o site abrir rápido)');
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
            banner: { id: banner.id, empresa: banner.empresa, texto: banner.texto, link: banner.link, pausado: banner.pausado,
                ...imagensPublicas(banner), desde: banner.criado_em },
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
        const dados = validarDadosDoBanner({ empresa: campo('empresa'), texto: campo('texto'), link: campo('link'), peso: campo('peso'),
            valor: campo('valor'), cobranca: campo('cobranca'), terminaEm: campo('terminaEm') });
        // com o termino ja chegado, o banner nao aparece: o peso fica 0
        if (dados.terminaEm && dados.terminaEm <= hoje()) dados.peso = 0;
        const atual = id ? await exigirBanner(id) : null;
        // as duas imagens (doc 96): "imagemHorizontal" e "imagemVertical" trocam ou poem; "removerHorizontal" e
        // "removerVertical" ("1") tiram a que ja estava. No fim, o banner precisa ter pelo menos uma
        const novas = {};
        const tirar = [];
        for (const [formato, sufixo] of [['horizontal', 'Horizontal'], ['vertical', 'Vertical']]) {
            const imagem = await lerImagem(campo('imagem' + sufixo), formato);
            if (imagem) novas[formato] = imagem;
            else if (campo('remover' + sufixo) === '1') tirar.push(formato);
        }
        const ficam = Object.keys(FORMATOS_DE_BANNER).filter(formato => novas[formato] || (atual?.imagens?.[formato] && !tirar.includes(formato)));
        if (ficam.length === 0) throw new DadoInvalidoNoBanner('O banner precisa de pelo menos uma imagem: a horizontal, a vertical ou as duas');
        const cliente = await (await banco()).connect();
        let salvoId = id;
        try {
            await cliente.query('BEGIN');
            if (!id) {
                const { rows } = await cliente.query('SELECT id FROM banners');
                if (rows.length >= BANNERS_MAXIMOS) throw new DadoInvalidoNoBanner(`No máximo ${BANNERS_MAXIMOS} banners: apague algum antigo antes`);
                salvoId = idDaEmpresa(dados.empresa, rows.map(linha => linha.id));
                await cliente.query(`INSERT INTO banners (id, empresa, texto, link, peso, codigo_do_relatorio, valor, cobranca, termina_em)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [salvoId, dados.empresa, dados.texto, dados.link, dados.peso, novoCodigo(), dados.valor, dados.cobranca, dados.terminaEm]);
            } else {
                await cliente.query(`UPDATE banners SET empresa = $2, texto = $3, link = $4, peso = $5, valor = $6, cobranca = $7, termina_em = $8,
                    atualizado_em = now() WHERE id = $1`,
                [id, dados.empresa, dados.texto, dados.link, dados.peso, dados.valor, dados.cobranca, dados.terminaEm]);
            }
            if (tirar.length) await cliente.query('DELETE FROM imagens_de_banner WHERE banner = $1 AND formato = ANY($2)', [salvoId, tirar]);
            for (const [formato, imagem] of Object.entries(novas)) {
                await cliente.query(`INSERT INTO imagens_de_banner (banner, formato, imagem, tipo, largura, altura) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (banner, formato) DO UPDATE SET imagem = $3, tipo = $4, largura = $5, altura = $6, atualizada_em = now()`,
                [salvoId, formato, imagem.bytes, imagem.tipo, imagem.largura, imagem.altura]);
            }
            await sincronizarReceita(cliente, { id: salvoId, lancamento: atual?.lancamento || null }, dados);
            await cliente.query('COMMIT');
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
        return publico(await exigirBanner(salvoId));
    }

    async function lista() {
        const db = await banco();
        await encerrarVencidos(db);
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
        await encerrarVencidos(db);
        const [{ rows: [{ atual }] }, linhas, { rows: banners }] = await Promise.all([
            db.query(`SELECT ${MES_ATUAL} AS atual`),
            linhasDoMes(mes),
            db.query(`SELECT id, empresa, pausado, (SELECT CASE WHEN count(*) = 2 THEN 'ambos' ELSE min(formato) END FROM imagens_de_banner WHERE banner = banners.id) AS formato
                FROM banners`),
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
        /**
         * Rotas sem login: os banners no ar, a contagem das exibicoes, o clique, a imagem de um banner e o relatorio da
         * empresa (pelo codigo do link). Nulo se nao for uma delas.
         */
        semLogin: traduzirErros(async (request, url, partes) => {
            const [id, acao, codigo] = partes;
            // os banners que podem aparecer agora (nao pausados, com peso e antes do dia do termino), para as paginas
            // sortearem pelo peso. A CDN guarda um minuto
            if (id === 'no-ar' && !acao && request.method === 'GET') {
                // uma linha por imagem: um banner com as duas entra no sorteio dos lugares horizontais e dos verticais
                const { rows } = await (await banco()).query(`SELECT b.id, b.empresa, b.texto, i.formato, b.peso, i.largura, i.altura, b.link IS NOT NULL AS tem_link,
                        (extract(epoch FROM i.atualizada_em) * 1000)::bigint AS v
                    FROM banners b JOIN imagens_de_banner i ON i.banner = b.id
                    WHERE NOT b.pausado AND b.peso > 0 AND (b.termina_em IS NULL OR b.termina_em > ${HOJE}) ORDER BY b.id, i.formato`);
                const resposta = json(200, { banners: rows.map(banner => ({ id: banner.id, empresa: banner.empresa, texto: banner.texto, formato: banner.formato,
                    peso: banner.peso, largura: banner.largura, altura: banner.altura, temLink: banner.tem_link,
                    imagem: `/api/banners/${encodeURIComponent(banner.id)}/imagem?formato=${banner.formato}&v=${banner.v}` })) });
                resposta.headers.set('Cache-Control', 'public, max-age=60');
                return resposta;
            }
            // as exibicoes que a pagina mostrou (somam no dia, por banner e lugar; sem conta, IP ou aparelho)
            if (id === 'exibicoes' && !acao && request.method === 'POST') {
                const itens = lerExibicoes(await f.lerCorpo(request));
                if (itens.length) {
                    const db = await banco();
                    const { rows } = await db.query('SELECT id FROM banners WHERE id = ANY($1) AND NOT pausado AND peso > 0', [[...new Set(itens.map(item => item.banner))]]);
                    const existem = new Set(rows.map(linha => linha.id));
                    for (const item of itens.filter(item => existem.has(item.banner))) {
                        await db.query(`INSERT INTO metricas_de_banner (dia, banner, posicao, exibicoes) VALUES (${HOJE}, $1, $2, 1)
                            ON CONFLICT (dia, banner, posicao) DO UPDATE SET exibicoes = metricas_de_banner.exibicoes + 1`, [item.banner, item.posicao]);
                    }
                }
                return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
            }
            // o clique: conta e leva para o site da empresa
            if (id && acao === 'clique' && !codigo && request.method === 'GET') {
                const { rows } = await (await banco()).query('SELECT link FROM banners WHERE id = $1', [id]);
                if (!rows.length || !rows[0].link) return new Response('Banner não encontrado', { status: 404 });
                const posicao = url.searchParams.get('posicao');
                if (Object.hasOwn(LUGARES_DE_BANNER, posicao)) {
                    await (await banco()).query(`INSERT INTO metricas_de_banner (dia, banner, posicao, cliques) VALUES (${HOJE}, $1, $2, 1)
                        ON CONFLICT (dia, banner, posicao) DO UPDATE SET cliques = metricas_de_banner.cliques + 1`, [id, posicao]);
                }
                return new Response(null, { status: 302, headers: { Location: rows[0].link, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
            }
            if (request.method !== 'GET') return null;
            if (id && acao === 'imagem' && !codigo) {
                // ?formato=horizontal ou vertical; sem ele (enderecos antigos), a horizontal ou, se nao tiver, a vertical
                const formato = url.searchParams.get('formato');
                const { rows } = await (await banco()).query(`SELECT imagem, tipo AS tipo_imagem FROM imagens_de_banner WHERE banner = $1
                    ${Object.hasOwn(FORMATOS_DE_BANNER, formato) ? 'AND formato = $2' : ''} ORDER BY formato LIMIT 1`,
                Object.hasOwn(FORMATOS_DE_BANNER, formato) ? [id, formato] : [id]);
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
                const banner = await exigirBanner(id);
                // a receita mensal do banner para neste mes (que ja conta); a de uma vez so fica, porque o dinheiro entrou
                if (banner.lancamento) {
                    await db.query(`UPDATE financas SET fim = date_trunc('month', ${HOJE})::date
                        WHERE id = $1 AND recorrencia = 'mensal' AND (fim IS NULL OR fim > date_trunc('month', ${HOJE})::date)`, [banner.lancamento]);
                }
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
