// Sugere mangas com temas parecidos com o de um manga da lista, para ler depois.
// Faz o mesmo que RecomendacaoService.java; uma mudanca de regra precisa ser feita nos dois.
// A fonte e o AniList: primeiro as recomendacoes que os leitores de la fizeram para a obra; se forem poucas,
// completa com obras populares dos mesmos generos e temas. Quem ja esta cadastrado nunca e sugerido.
import { clienteHttp } from './_sinopse.js';

export const QUANTIDADE = 6;
const VALIDADE_MS = 12 * 60 * 60 * 1000;
const MAXIMO_GUARDADO = 300;
const CAMPOS = 'id type isAdult title{romaji english native} synonyms genres siteUrl coverImage{large}';
const GENEROS = {
    Action: 'Ação', Adventure: 'Aventura', Comedy: 'Comédia', Drama: 'Drama', Fantasy: 'Fantasia', Horror: 'Terror',
    Mystery: 'Mistério', Psychological: 'Psicológico', Romance: 'Romance', 'Sci-Fi': 'Ficção científica',
    'Slice of Life': 'Cotidiano', Sports: 'Esportes', Supernatural: 'Sobrenatural', Thriller: 'Suspense', Music: 'Música',
    'Mahou Shoujo': 'Garota mágica', Mecha: 'Mecha', Ecchi: 'Ecchi',
};

// tags sugeridas no cadastro que o AniList chama por outro nome
const TEMAS_COM_OUTRO_NOME = { murim: 'Wuxia', regression: 'Time Manipulation', 'school life': 'School', 'martial arts': 'Martial Arts' };

// letras de qualquer alfabeto, sem acentos nem sinais
// tags gerais que no AniList sao divididas em varias: uma obra serve se tiver QUALQUER uma delas.
// "Harem" la e "Female Harem" (varias garotas) ou "Male Harem" (varios rapazes)
const TEMAS_COM_VARIAS_FORMAS = { harem: ['Female Harem', 'Male Harem'] };
const MAXIMO_DE_COMBINACOES = 4;

/**
 * As listas de temas a buscar: os temas fixos mais uma forma de cada tag que tem varias.
 * Sem tags assim, e uma busca so. O total e limitado para nao fazer pedidos demais.
 */
function combinar(temas, comVariasFormas) {
    let buscas = [[...temas]];
    for (const formasDaTag of comVariasFormas) {
        buscas = buscas.flatMap(busca => formasDaTag.map(forma => [...busca, forma])).slice(0, MAXIMO_DE_COMBINACOES);
    }
    return buscas;
}

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Entre os nomes guardados de um manga, o que comeca assim diz qual e a obra no AniList: "anilist:105398". */
export const MARCA_DA_OBRA = 'anilist:';
export const TITULOS_POR_PEDIDO = 20;
const MAXIMO_NO_MANGADEX = 8;
const MAXIMO_DE_TRADUCOES = 6;
const PALAVRAS_DE_LIGACAO = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'o', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'um', 'uma',
    'no', 'na', 'em', 'el', 'la', 'los', 'las', 'le', 'les', 'du', 'des', 's']);
const PALAVRAS_DE_ENDERECO = new Set(['chapter', 'chapters', 'chap', 'ch', 'capitulo', 'capitulos', 'cap', 'episode', 'episodio', 'ep', 'manga',
    'mangas', 'manhwa', 'manhua', 'comic', 'comics', 'title', 'titles', 'series', 'serie', 'obra', 'obras', 'read', 'reader', 'ler', 'leitor',
    'online', 'pt', 'br', 'en', 'raw', 'scan', 'scans', 'html', 'php']);
const MAXIMO_DE_NOMES = 60;

/**
 * Um mesmo nome escrito dos jeitos que costumam variar entre sites: com e sem espacos ("Re Zero", "ReZero")
 * e com e sem o artigo do comeco ("The Beginning...", "Beginning..."; "O Começo...", "Começo...").
 */
export function formas(nome) {
    const normal = normalizar(nome);
    if (!normal) return [];
    const resultado = new Set([normal, normal.replaceAll(' ', '')]);
    const semArtigo = normal.replace(/^(the|a|an|o|os|as|um|uma|el|la|los|las|le|les) /, '');
    if (semArtigo.length >= 4) {
        resultado.add(semArtigo);
        resultado.add(semArtigo.replaceAll(' ', ''));
    }
    // as mesmas palavras em qualquer ordem e sem as de ligacao: "Ponto de Vista do Leitor" e "Ponto de Vista de um Leitor"
    const palavras = [...new Set(normal.split(' ').filter(palavra => !PALAVRAS_DE_LIGACAO.has(palavra)))];
    if (palavras.length >= 2) resultado.add('#' + palavras.sort().join('|'));
    return [...resultado];
}

/**
 * Nomes que da para tirar do link de leitura: muitos sites colocam o nome da obra (em ingles ou no original)
 * no endereco, mesmo quando o manga foi cadastrado com o titulo traduzido.
 * ".../comics/omniscient-readers-viewpoint-3ec3b16f/chapter/{cap}" -> "omniscient readers viewpoint".
 */
export function nomesDoLink(link) {
    if (typeof link !== 'string') return [];
    const inicio = link.indexOf('/', link.indexOf('://') + 3);
    const caminho = inicio < 0 ? '' : link.slice(inicio).split(/[?#]/)[0];
    const nomes = [];
    for (const trecho of caminho.split('/')) {
        // ids misturam letras e numeros; palavras de pasta e de capitulo nao fazem parte do nome
        const palavras = trecho.replaceAll('{cap}', ' ').toLowerCase().split(/[-_ .+]+|%20/)
            .filter(pedaco => /\p{L}/u.test(pedaco) && !/\d/.test(pedaco) && !PALAVRAS_DE_ENDERECO.has(pedaco));
        if (palavras.length >= 2) nomes.push(palavras.join(' '));
    }
    return nomes;
}

const acrescentar = (nomes, nome) => {
    const limpo = typeof nome === 'string' ? nome.trim() : '';
    if (limpo && limpo.length <= 200 && nomes.length < MAXIMO_DE_NOMES && !nomes.includes(limpo)) nomes.push(limpo);
};

export const POR_PAGINA = 24;
/** Como ordenar a busca geral de obras. RELEVANCIA = as que mais combinam com o nome buscado. */
export const ORDENS = {
    RELEVANCIA: { noAniList: 'SEARCH_MATCH', descricao: 'Mais relevantes' },
    POPULARIDADE: { noAniList: 'POPULARITY_DESC', descricao: 'Mais populares' },
    NOTA: { noAniList: 'SCORE_DESC', descricao: 'Melhor avaliados' },
    EM_ALTA: { noAniList: 'TRENDING_DESC', descricao: 'Em alta agora' },
    RECENTES: { noAniList: 'START_DATE_DESC', descricao: 'Mais recentes' },
    TITULO: { noAniList: 'TITLE_ENGLISH', descricao: 'Título (A–Z)' },
};

/** O titulo sem o que esta entre (parenteses) e [colchetes], que costuma ser observacao de quem cadastrou. */
const semObservacoes = titulo => String(titulo ?? '').replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim();

/** O titulo como esta e versoes mais curtas dele, para quando o cadastro tem subtitulo ou observacao a mais. */
export function variacoesDoTitulo(titulo) {
    const variacoes = new Set([titulo.trim(), titulo.replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim()]);
    for (const separador of [':', ' - ', ' – ']) {
        const posicao = titulo.indexOf(separador);
        if (posicao > 2) variacoes.add(titulo.slice(0, posicao).trim());
    }
    return [...variacoes].filter(Boolean).slice(0, 3);
}

/**
 * Devolve a funcao (titulo, nomesCadastrados, tagsDoManga) -> ate 6 sugestoes { titulo, capa, generos, link }.
 * Lista vazia se a obra nao for encontrada ou o servico falhar.
 */
export function criarBuscadorDeRecomendacoes(http = clienteHttp) {
    // as recomendacoes de uma obra mudam pouco: guardar evita consultar o AniList a cada visita a pagina do manga
    const guardados = new Map();

    const perguntar = async (query, variables) => (await http.postJson('https://graphql.anilist.co', { query, variables }))?.data ?? {};

    function adicionar(obra, candidatas, vistos) {
        if (!obra || obra.type !== 'MANGA' || obra.isAdult) return;
        const ingles = obra.title?.english || '';
        const romaji = obra.title?.romaji || '';
        const titulo = ingles.trim() ? ingles : romaji;
        const link = obra.siteUrl || '';
        if (!titulo.trim() || !link.startsWith('https://') || vistos.has(obra.id)) return;
        vistos.add(obra.id);
        const capa = obra.coverImage?.large || '';
        candidatas.push({
            id: obra.id,
            recomendacao: {
                titulo,
                capa: capa.startsWith('https://') ? capa : '',
                generos: (obra.genres || []).map(genero => GENEROS[genero] || genero), // em portugues, para mostrar
                link,
                tags: obra.genres || [], // em ingles, para virar tags se a obra for cadastrada
            },
            nomes: new Set([...Object.values(obra.title || {}), ...(obra.synonyms || [])].flatMap(formas)),
        });
    }

    /** Obras populares com algum dos generos e, se informados, algum dos temas; quem divide mais generos vem primeiro. */
    async function porGenerosETemas(generos, temas) {
        if (generos.length === 0 && temas.length === 0) return [];
        const parametros = [];
        const filtros = [];
        const variaveis = {};
        if (generos.length > 0) {
            parametros.push('$g:[String]');
            filtros.push('genre_in:$g,');
            variaveis.g = generos;
        }
        if (temas.length > 0) {
            parametros.push('$t:[String]');
            filtros.push('tag_in:$t,');
            variaveis.t = temas;
        }
        const parecidas = (await perguntar('query(' + parametros.join(',') + '){Page(perPage:30){media(type:MANGA,isAdult:false,'
            + filtros.join('') + 'sort:POPULARITY_DESC){' + CAMPOS + '}}}', variaveis)).Page?.media || [];
        const emComum = parecida => (parecida?.genres || []).filter(genero => generos.includes(genero)).length;
        return [...parecidas].sort((a, b) => emComum(b) - emComum(a));
    }

    async function consultar(titulo, tagsDoManga) {
        const candidatas = [];
        const vistos = new Set();

        // 1) pelo titulo: acha a obra no AniList
        let obra = null;
        for (const variacao of variacoesDoTitulo(titulo)) {
            obra = (await perguntar('query($s:String){Media(search:$s,type:MANGA){id genres tags{name rank} '
                + 'recommendations(sort:RATING_DESC,perPage:25){nodes{mediaRecommendation{' + CAMPOS + '}}}}}', { s: variacao })).Media;
            if (obra) break;
        }
        if (obra) {
            vistos.add(obra.id);
            // o que os leitores recomendaram para quem leu esta obra
            for (const no of obra.recommendations?.nodes || []) adicionar(no?.mediaRecommendation, candidatas, vistos);
            // poucas recomendacoes: completa com obras populares dos mesmos generos e dos temas mais marcantes dela
            if (candidatas.length < QUANTIDADE * 2) {
                const temas = (obra.tags || []).filter(tema => tema.rank >= 60).slice(0, 3).map(tema => tema.name);
                for (const parecida of await porGenerosETemas(obra.genres || [], temas)) adicionar(parecida, candidatas, vistos);
            }
        }

        // 2) pelas tags do manga na lista: completa o que veio do titulo, ou substitui quando o titulo nao foi encontrado
        if (candidatas.length < QUANTIDADE * 2 && tagsDoManga.length > 0) {
            const generos = [];
            const temas = [];
            const comVariasFormas = [];
            for (const tag of tagsDoManga) {
                const genero = Object.keys(GENEROS).find(conhecido => normalizar(conhecido) === normalizar(tag));
                if (genero) generos.push(genero);
                else if (TEMAS_COM_VARIAS_FORMAS[normalizar(tag)]) comVariasFormas.push(TEMAS_COM_VARIAS_FORMAS[normalizar(tag)]);
                else if (typeof tag === 'string' && tag.trim() && temas.length < 4) temas.push(TEMAS_COM_OUTRO_NOME[normalizar(tag)] ?? tag.trim());
            }
            let parecidas = [];
            for (const temasDaBusca of combinar(temas, comVariasFormas)) parecidas.push(...await porGenerosETemas(generos, temasDaBusca));
            // varias buscas juntas: de novo quem divide mais generos primeiro
            const emComum = parecida => (parecida?.genres || []).filter(genero => generos.includes(genero)).length;
            parecidas.sort((a, b) => emComum(b) - emComum(a));
            // nenhuma obra com esses generos E esses temas (ou o AniList nao tem tema com esse nome): tenta so os generos
            if (parecidas.length === 0 && generos.length > 0 && (temas.length > 0 || comVariasFormas.length > 0)) parecidas = await porGenerosETemas(generos, []);
            for (const parecida of parecidas) adicionar(parecida, candidatas, vistos);
        }
        return candidatas;
    }

    /**
     * Procura pelo titulo e tambem pelas tags do manga: o titulo acha a obra e o que os leitores recomendam para
     * ela; as tags trazem obras dos mesmos generos e temas, inclusive quando o AniList nao conhece o titulo.
     */
    async function buscarRecomendacoes(titulo, nomesCadastrados = [], tagsDoManga = []) {
        if (typeof titulo !== 'string' || !titulo.trim()) return [];
        const tags = Array.isArray(tagsDoManga) ? tagsDoManga : [];
        // as tags fazem parte da chave: mudar as tags do manga muda o que e sugerido
        const chave = normalizar(titulo) + '|' + tags.map(normalizar).filter(Boolean).sort().join(',');
        let guardado = guardados.get(chave);
        if (!guardado || Date.now() - guardado.quando > VALIDADE_MS) {
            const candidatas = await consultar(titulo.trim(), tags);
            guardado = { quando: Date.now(), candidatas };
            // falha ou obra desconhecida nao fica guardada: da para tentar de novo depois
            if (candidatas.length > 0) {
                if (guardados.size >= MAXIMO_GUARDADO) guardados.clear();
                guardados.set(chave, guardado);
            }
        }
        // quem ja esta na lista sai pelo nome (em qualquer um dos nomes conhecidos da obra, escrito de varios jeitos)
        // ou por ser exatamente a mesma obra no AniList
        const lista = Array.isArray(nomesCadastrados) ? nomesCadastrados.filter(nome => typeof nome === 'string') : [];
        const obras = new Set(lista.filter(nome => nome.startsWith(MARCA_DA_OBRA)).map(nome => Number(nome.slice(MARCA_DA_OBRA.length))));
        const nomes = new Set([titulo, ...lista.filter(nome => !nome.startsWith(MARCA_DA_OBRA))]
            .flatMap(nome => [...formas(nome), ...formas(semObservacoes(nome))]));
        return guardado.candidatas
            .filter(candidata => !obras.has(candidata.id) && ![...candidata.nomes].some(nome => nomes.has(nome)))
            .slice(0, QUANTIDADE)
            .map(candidata => candidata.recomendacao);
    }

    /** Todos os nomes da obra no MangaDex; [] se ele nao tem obra com exatamente esse nome; null se falhou. */
    async function nomesNoMangaDex(titulo) {
        const resposta = await http.get('https://api.mangadex.org/manga?limit=5&order%5Brelevance%5D=desc'
            + '&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&title=' + encodeURIComponent(semObservacoes(titulo)));
        if (!Array.isArray(resposta?.data)) return null;
        const procurado = new Set(formas(semObservacoes(titulo)));
        for (const manga of resposta.data) {
            const nomes = [];
            for (const nome of Object.values(manga?.attributes?.title || {})) acrescentar(nomes, nome);
            for (const alternativo of manga?.attributes?.altTitles || []) for (const nome of Object.values(alternativo || {})) acrescentar(nomes, nome);
            // a busca de la e aproximada: so vale a obra que tem exatamente o nome procurado entre os dela
            if (nomes.some(nome => formas(nome).some(forma => procurado.has(forma)))) return nomes;
        }
        return [];
    }

    /** Pergunta ao AniList por varios titulos no mesmo pedido (m0, m1...). null se o servico nao respondeu. */
    async function consultarEmLote(buscas, obrasPorTitulo) {
        const resposta = await perguntar(
            'query(' + buscas.map((_, i) => '$t' + i + ':String').join(',') + '){'
            + buscas.map((_, i) => 'm' + i + ':Page(perPage:' + obrasPorTitulo + '){media(search:$t' + i + ',type:MANGA){id title{romaji english native} synonyms}}').join(' ') + '}',
            Object.fromEntries(buscas.map((busca, i) => ['t' + i, busca])));
        return resposta.m0 ? resposta : null;
    }

    /** A marca de cada obra ("anilist:123") seguida de todos os nomes delas; [] se nao veio obra nenhuma. */
    function nomesDasObras(obras) {
        const lista = Array.isArray(obras) ? obras.filter(Boolean) : [];
        const nomes = lista.map(obra => MARCA_DA_OBRA + obra.id);
        for (const obra of lista) {
            for (const nome of Object.values(obra.title || {})) acrescentar(nomes, nome);
            for (const nome of obra.synonyms || []) acrescentar(nomes, nome);
        }
        return nomes;
    }

    /** Traduz um titulo do portugues para o ingles. null se o tradutor falhou. */
    async function traduzir(titulo) {
        const resposta = await http.get('https://api.mymemory.translated.net/get?langpair=pt-br%7Cen&q=' + encodeURIComponent(titulo));
        const traducao = String(resposta?.responseData?.translatedText ?? '').trim();
        return Number(resposta?.responseStatus) === 200 && traducao && !traducao.toUpperCase().includes('MYMEMORY WARNING') ? traducao : null;
    }

    /**
     * Busca na internet os outros nomes de cada titulo da lista: o original, em outras linguas e apelidos.
     * E o que permite reconhecer um manga cadastrado com um titulo alternativo ou traduzido.
     * Primeiro o AniList, com varios titulos no mesmo pedido; para os que ele nao conhece, o MangaDex, que tem
     * os nomes em muitas linguas; e, se nem ele conhecer, o titulo e traduzido do portugues para o ingles e
     * procurado de novo no AniList (e assim que "Ponto de Vista do Leitor Onisciente" vira "Omniscient Reader").
     *
     * Devolve um Map titulo -> nomes ([] = nenhuma fonte conhece a obra). Titulos que nao deu para consultar
     * agora ficam de fora do Map, para tentar de novo depois.
     */
    async function nomesAlternativos(titulos) {
        const lote = [...new Set((titulos || []).filter(titulo => typeof titulo === 'string' && titulo.trim()))].slice(0, TITULOS_POR_PEDIDO);
        const resultado = new Map();
        if (lote.length === 0) return resultado;
        const resposta = await consultarEmLote(lote.map(semObservacoes), 1);
        if (!resposta) return resultado; // servico fora do ar ou no limite: nada resolvido desta vez
        const semObra = [];
        lote.forEach((titulo, i) => {
            const nomes = nomesDasObras(resposta['m' + i]?.media);
            if (nomes.length > 0) resultado.set(titulo, nomes);
            else semObra.push(titulo);
        });
        // o AniList nao conhece por esse nome: MangaDex
        const noMangaDex = semObra.slice(0, MAXIMO_NO_MANGADEX);
        const achados = await Promise.all(noMangaDex.map(nomesNoMangaDex));
        const paraTraduzir = [];
        noMangaDex.forEach((titulo, i) => {
            if (achados[i] === null) return;
            if (achados[i].length > 0) resultado.set(titulo, achados[i]);
            else paraTraduzir.push(titulo);
        });
        // nenhum dos dois conhece: traduz o titulo para o ingles e procura de novo
        const originais = [];
        const traduzidos = [];
        for (const titulo of paraTraduzir.slice(0, MAXIMO_DE_TRADUCOES)) {
            const traducao = await traduzir(semObservacoes(titulo));
            if (traducao === null) continue; // tradutor fora do ar: tenta de novo depois
            const doTitulo = new Set(formas(semObservacoes(titulo)));
            if (formas(traducao).some(forma => doTitulo.has(forma))) {
                resultado.set(titulo, []); // ja estava em ingles (ou nao tem traducao): nao ha mais o que tentar
            } else {
                originais.push(titulo);
                traduzidos.push(traducao);
            }
        }
        if (traduzidos.length > 0) {
            const peloIngles = await consultarEmLote(traduzidos, 2);
            originais.forEach((titulo, i) => {
                if (!peloIngles) return;
                const nomes = nomesDasObras(peloIngles['m' + i]?.media);
                if (nomes.length > 0) acrescentar(nomes, traduzidos[i]);
                resultado.set(titulo, nomes);
            });
        }
        return resultado;
    }

    // nomes dos temas (tags) que o AniList tem, pelo nome normalizado; guardado por um dia
    let temasConhecidos = new Map();
    let temasBuscadosEm = 0;
    async function temasDoAniList() {
        if (temasConhecidos.size === 0 || Date.now() - temasBuscadosEm > 24 * 60 * 60 * 1000) {
            const lista = (await perguntar('query{MediaTagCollection{name isAdult}}', {})).MediaTagCollection;
            const novos = new Map((Array.isArray(lista) ? lista : []).filter(tema => tema?.name && !tema.isAdult).map(tema => [normalizar(tema.name), tema.name]));
            if (novos.size > 0) {
                temasConhecidos = novos;
                temasBuscadosEm = Date.now();
            }
        }
        return temasConhecidos;
    }

    /**
     * Busca geral de obras no AniList: por nome, por tags (a obra precisa ter todas as escolhidas) e em varias ordens.
     * Quem ja esta na lista nao aparece. As tags que o AniList nao tem sao ignoradas e devolvidas em tagsIgnoradas.
     * Devolve { itens, pagina, temMais, ocultos, tagsIgnoradas }; sem itens se o servico falhar.
     */
    async function explorar(busca, tags, ordem, pagina, nomesCadastrados) {
        const nome = typeof busca === 'string' ? busca.trim() : '';
        const numero = Math.max(1, Math.min(Number(pagina) || 1, 200));
        const generos = [];
        const temas = [];
        const tagsIgnoradas = [];
        const comVariasFormas = [];
        const conhecidos = await temasDoAniList();
        for (const tag of Array.isArray(tags) ? tags : []) {
            if (typeof tag !== 'string' || !tag.trim()) continue;
            if (TEMAS_COM_VARIAS_FORMAS[normalizar(tag)]) {
                comVariasFormas.push(TEMAS_COM_VARIAS_FORMAS[normalizar(tag)]);
                continue;
            }
            const procurada = TEMAS_COM_OUTRO_NOME[normalizar(tag)] ?? tag.trim();
            const genero = Object.keys(GENEROS).find(conhecido => normalizar(conhecido) === normalizar(procurada));
            if (genero) generos.push(genero);
            else if (conhecidos.has(normalizar(procurada))) temas.push(conhecidos.get(normalizar(procurada)));
            else if (conhecidos.size === 0) temas.push(procurada); // nao deu para conferir a lista de temas: tenta com o nome como esta
            else tagsIgnoradas.push(tag.trim());
        }
        // "mais relevantes" so faz sentido com um nome buscado
        const escolhida = !ORDENS[ordem] || (ordem === 'RELEVANCIA' && !nome) ? 'POPULARIDADE' : ordem;

        const parametros = ['$p:Int', '$o:[MediaSort]'];
        let filtros = '';
        const variaveis = { p: numero, o: [ORDENS[escolhida].noAniList] };
        if (nome) {
            parametros.push('$s:String');
            filtros += 'search:$s,';
            variaveis.s = nome.slice(0, 100);
        }
        if (generos.length > 0) {
            parametros.push('$g:[String]');
            filtros += 'genre_in:$g,';
            variaveis.g = generos;
        }
        // o AniList so sabe pedir "todas estas tags". Para uma tag com varias formas (qualquer uma serve), faz uma busca
        // para cada forma e junta os resultados
        const buscas = combinar(temas, comVariasFormas);
        const achadas = [];
        const jaVistas = new Set();
        let temMais = false;
        for (const temasDaBusca of buscas) {
            const comTemas = temasDaBusca.length > 0;
            const pagina = (await perguntar('query(' + [...parametros, ...(comTemas ? ['$t:[String]'] : [])].join(',') + '){Page(page:$p,perPage:' + POR_PAGINA + '){pageInfo{hasNextPage} '
                + 'media(type:MANGA,isAdult:false,' + filtros + (comTemas ? 'tag_in:$t,' : '') + 'sort:$o){' + CAMPOS
                + ' averageScore popularity trending startDate{year month day}}}}', comTemas ? { ...variaveis, t: temasDaBusca } : variaveis)).Page;
            temMais = temMais || pagina?.pageInfo?.hasNextPage === true;
            for (const obra of pagina?.media || []) {
                if (obra && !jaVistas.has(obra.id)) {
                    jaVistas.add(obra.id);
                    achadas.push(obra);
                }
            }
        }
        // resultados de varias buscas juntos precisam ser ordenados de novo, pela mesma regra pedida ao AniList
        if (buscas.length > 1) {
            const data = obra => (obra.startDate?.year || 0) * 10000 + (obra.startDate?.month || 0) * 100 + (obra.startDate?.day || 0);
            const nomeDe = obra => normalizar(obra.title?.english || obra.title?.romaji || '');
            const regras = {
                NOTA: (a, b) => (b.averageScore || 0) - (a.averageScore || 0),
                EM_ALTA: (a, b) => (b.trending || 0) - (a.trending || 0),
                RECENTES: (a, b) => data(b) - data(a),
                TITULO: (a, b) => (nomeDe(a) < nomeDe(b) ? -1 : nomeDe(a) > nomeDe(b) ? 1 : 0),
            };
            // POPULARIDADE; e RELEVANCIA, que nao tem um numero para comparar: as mais conhecidas primeiro
            achadas.sort(regras[escolhida] || ((a, b) => (b.popularity || 0) - (a.popularity || 0)));
        }

        const lista = Array.isArray(nomesCadastrados) ? nomesCadastrados.filter(cadastrado => typeof cadastrado === 'string') : [];
        const obras = new Set(lista.filter(cadastrado => cadastrado.startsWith(MARCA_DA_OBRA)).map(cadastrado => Number(cadastrado.slice(MARCA_DA_OBRA.length))));
        const nomes = new Set(lista.filter(cadastrado => !cadastrado.startsWith(MARCA_DA_OBRA)).flatMap(cadastrado => [...formas(cadastrado), ...formas(semObservacoes(cadastrado))]));
        const itens = [];
        let ocultos = 0;
        for (const obra of achadas) {
            const lida = [];
            adicionar(obra, lida, new Set());
            if (lida.length === 0) continue;
            if (obras.has(lida[0].id) || [...lida[0].nomes].some(forma => nomes.has(forma))) {
                ocultos++;
                continue;
            }
            itens.push({
                ...lida[0].recomendacao,
                nota: Number.isInteger(obra.averageScore) ? obra.averageScore : null,
                ano: Number.isInteger(obra.startDate?.year) ? obra.startDate.year : null,
            });
        }
        return { itens, pagina: numero, temMais, ocultos, tagsIgnoradas };
    }

    buscarRecomendacoes.nomesAlternativos = nomesAlternativos;
    buscarRecomendacoes.explorar = explorar;
    return buscarRecomendacoes;
}
