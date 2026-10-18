// Busca na internet a descricao de um manga pelo titulo, em portugues, para preencher o cadastro.
// Faz o mesmo que SinopseService.java; uma mudanca de regra precisa ser feita nos dois.
// Fontes (doc 103), pesquisadas ao mesmo tempo: MangaDex (tem descricoes em portugues escritas por pessoas), AniList,
// MangaUpdates, MyAnimeList (pela API Jikan) e Kitsu. A descricao vem do MangaDex em portugues, ou da primeira em
// ingles na ordem AniList, MangaUpdates, MyAnimeList, Kitsu, MangaDex; as tags juntam as de todas as fontes que
// acharam a MESMA obra (o mesmo nome, ou um nome em comum com outra fonte que achou). Quando so existe em ingles, o texto e traduzido (doc 102): primeiro pelo Google (dois
// enderecos gratuitos), e so se os dois falharem pelo MyMemory. Uma traducao so vale se voltou mesmo em portugues.

const TAMANHO_MAXIMO = 1500;
const MAXIMO_POR_TRADUCAO = 450; // o MyMemory aceita ate 500 bytes por pedido
const MAXIMO_DE_TRADUCOES = 8;
// esses servicos pedem que cada programa se identifique
const IDENTIFICACAO = 'Viracap/1.0 (rastreador pessoal de leitura; github.com/GilvanPedro/ArmazenarManga)';

async function pedir(endereco, opcoes = {}) {
    try {
        const resposta = await fetch(endereco, {
            ...opcoes,
            signal: AbortSignal.timeout(6000),
            headers: { 'User-Agent': IDENTIFICACAO, Accept: 'application/json', ...(opcoes.headers || {}) },
        });
        return resposta.status === 200 ? await resposta.json() : null;
    } catch {
        return null;
    }
}

/** Chamadas de verdade. Devolvem o JSON da resposta, ou null quando nao da certo. */
export const clienteHttp = {
    get: (endereco, cabecalhos = {}) => pedir(endereco, { headers: cabecalhos }),
    postJson: (endereco, corpo) => pedir(endereco, { method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'application/json' } }),
};

const normalizar = texto => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Tira HTML, marcacoes e os avisos que as fontes colocam depois da descricao, e limita o tamanho. */
export function limpar(texto) {
    if (typeof texto !== 'string') return '';
    let limpo = texto.replaceAll('\r', '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&nbsp;', ' ');
    // no MangaDex, depois de uma linha "---" vem links e avisos que nao sao da historia
    const separador = limpo.indexOf('\n---');
    if (separador >= 0) limpo = limpo.slice(0, separador);
    limpo = limpo.replace(/\(\s*(source|fonte)\s*:[^)]*\)/gi, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [texto](link) -> texto
        .replace(/(\*\*|__|~~)/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (limpo.length > TAMANHO_MAXIMO) {
        const fim = limpo.lastIndexOf('. ', TAMANHO_MAXIMO);
        limpo = limpo.slice(0, fim > TAMANHO_MAXIMO / 2 ? fim + 1 : TAMANHO_MAXIMO).trim();
    }
    return limpo;
}

// palavras muito comuns de cada lingua, para saber em qual um texto esta (sem as que existem nas duas, como "a")
const PALAVRAS_DO_INGLES = new Set(('the and of to is his her with that was for he she they are but who when after their this from has have be by '
    + 'it not an will what which been into would were its him them you your my me our there then than only must').split(' '));
const PALAVRAS_DO_PORTUGUES = new Set(('de que o os um uma com para não nao é seu sua ele ela eles elas mas quando depois por se mais no na do da dos '
    + 'das em ao aos pela pelo seus suas foi são sao está esta como também tambem já ja ser ter isso este essa dele dela').split(' '));

/**
 * O texto parece estar em ingles? Conta as palavras comuns de cada lingua: ingles quando tem pelo menos 3 do ingles
 * e mais que o dobro das do portugues. Texto curto demais para dizer: false.
 */
export function pareceIngles(texto) {
    const palavras = String(texto || '').toLowerCase().match(/\p{L}+/gu) || [];
    let ingles = 0;
    let portugues = 0;
    for (const palavra of palavras) {
        if (PALAVRAS_DO_INGLES.has(palavra)) ingles++;
        if (PALAVRAS_DO_PORTUGUES.has(palavra)) portugues++;
    }
    return ingles >= 3 && ingles > portugues * 2;
}

// tags que dizem o formato ou a publicacao, nao a historia: ficam de fora das sugestoes
const TAGS_DE_FORMATO = new Set(['full color', 'long strip', 'web comic', 'webtoon', 'webtoons', 'adaptation', 'official colored', 'fan colored',
    'manhwa', 'manhua', 'manga', 'oneshot', 'one shot', 'doujinshi', 'anthology', 'award winning', 'adult cast', '4 koma', 'user created',
    'male protagonist', 'female protagonist', 'primarily adult cast', 'primarily female cast', 'primarily male cast', 'primarily child cast',
    'primarily teen cast', 'ensemble cast', 'lgbtq themes', 'novel', 'light novel', 'pov']);
// o mesmo genero com nomes diferentes em cada site: vira um nome so
const MESMA_TAG = {
    'sci fi': 'Sci-Fi', scifi: 'Sci-Fi', 'science fiction': 'Sci-Fi',
    shonen: 'Shounen', shounen: 'Shounen', shojo: 'Shoujo', shoujo: 'Shoujo',
    school: 'School Life', 'school life': 'School Life', 'slice of life': 'Slice of Life',
    'boys love': "Boys' Love", 'boys s love': "Boys' Love", yaoi: "Boys' Love", 'shounen ai': "Boys' Love",
    'girls love': "Girls' Love", 'girls s love': "Girls' Love", yuri: "Girls' Love", 'shoujo ai': "Girls' Love",
    'female harem': 'Harem', harem: 'Harem', 'gender bender': 'Gender Bender', genderswap: 'Gender Bender',
    'martial arts': 'Martial Arts', 'super power': 'Super Power', superpower: 'Super Power', 'time travel': 'Time Travel',
    'video games': 'Video Games', 'reverse harem': 'Reverse Harem', 'male harem': 'Reverse Harem', 'post apocalyptic': 'Post-Apocalyptic',
};
export const MAXIMO_DE_TAGS = 12;
const PRAZO_DAS_FONTES_EXTRAS = 4000;

/** O nome de uma tag para o cadastro: o mesmo genero com um nome so, sem as de formato; null para ignorar. */
export function nomeDaTag(tag) {
    if (typeof tag !== 'string' || !tag.trim()) return null;
    const chave = normalizar(tag);
    if (!chave || TAGS_DE_FORMATO.has(chave)) return null;
    if (MESMA_TAG[chave]) return MESMA_TAG[chave];
    // "slice of life" -> "Slice of Life"; o resto, como veio (com a primeira letra maiuscula)
    const limpa = tag.trim().replace(/\s+/g, ' ');
    return limpa.charAt(0).toUpperCase() + limpa.slice(1);
}

/**
 * Junta as tags de varias fontes: cada tag uma vez (pelo nome normalizado), as que mais fontes trazem primeiro (em
 * empate, a ordem em que apareceram), no maximo MAXIMO_DE_TAGS.
 */
export function juntarTags(listas) {
    const contagem = new Map();
    let ordem = 0;
    for (const lista of listas) {
        const desta = new Set();
        for (const tag of lista || []) {
            const nome = nomeDaTag(tag);
            if (!nome) continue;
            const chave = normalizar(nome);
            if (desta.has(chave)) continue;
            desta.add(chave);
            const atual = contagem.get(chave) || { nome, fontes: 0, ordem: ordem++ };
            atual.fontes++;
            contagem.set(chave, atual);
        }
    }
    return [...contagem.values()].sort((a, b) => b.fontes - a.fontes || a.ordem - b.ordem).slice(0, MAXIMO_DE_TAGS).map(tag => tag.nome);
}

/** Divide em trechos de no maximo MAXIMO_POR_TRADUCAO letras, de preferencia no fim de uma frase. */
export function emPedacos(texto) {
    const pedacos = [];
    let resto = texto;
    while (resto.length > MAXIMO_POR_TRADUCAO) {
        let corte = Math.max(resto.lastIndexOf('. ', MAXIMO_POR_TRADUCAO), resto.lastIndexOf('! ', MAXIMO_POR_TRADUCAO), resto.lastIndexOf('? ', MAXIMO_POR_TRADUCAO));
        if (corte < 0) corte = resto.lastIndexOf(' ', MAXIMO_POR_TRADUCAO);
        corte = corte < 0 ? MAXIMO_POR_TRADUCAO : corte + 1;
        pedacos.push(resto.slice(0, corte).trim());
        resto = resto.slice(corte).trim();
    }
    if (resto) pedacos.push(resto);
    return pedacos;
}

/**
 * Devolve a funcao (titulo) -> { descricao, idioma, fonte, tituloEncontrado, traduzida } ou null se nao achar.
 * idioma e "pt" ou, se a traducao falhou, "en". tituloEncontrado serve para conferir se e a mesma obra.
 */
export function criarBuscadorDeSinopse(http = clienteHttp) {
    /*
     * Cada fonte devolve ate 5 candidatos no mesmo formato: { fonte, titulos, nome, pt, en, tags }. pt e en sao as
     * descricoes (limpas); tags, os generos e temas em ingles. Fonte fora do ar ou sem resultado: lista vazia.
     */
    const textos = valores => valores.filter(valor => typeof valor === 'string' && valor.trim());

    async function buscarNoMangaDex(titulo) {
        const resposta = await http.get('https://api.mangadex.org/manga?limit=5&order%5Brelevance%5D=desc'
            + '&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&title=' + encodeURIComponent(titulo));
        const lista = Array.isArray(resposta?.data) ? resposta.data.map(manga => manga.attributes || {}) : [];
        return lista.map(atributos => ({
            fonte: 'MangaDex',
            titulos: textos([...Object.values(atributos.title || {}), ...(atributos.altTitles || []).flatMap(alternativo => Object.values(alternativo || {}))]),
            nome: atributos.title?.en ?? Object.values(atributos.title || {})[0] ?? '',
            pt: limpar(atributos.description?.['pt-br']) || limpar(atributos.description?.pt),
            en: limpar(atributos.description?.en),
            tags: tagsDoMangaDex(atributos),
        }));
    }

    /** Generos e temas da obra, em ingles, para sugerir como tags no cadastro. */
    const tagsDoMangaDex = atributos => (Array.isArray(atributos?.tags) ? atributos.tags : [])
        .filter(tag => ['genre', 'theme'].includes(tag?.attributes?.group) && tag.attributes.name?.en)
        .map(tag => tag.attributes.name.en)
        .slice(0, 8);

    async function buscarNoAniList(titulo) {
        const resposta = await http.postJson('https://graphql.anilist.co', {
            query: 'query($s:String){Page(perPage:5){media(search:$s,type:MANGA){title{romaji english native} synonyms genres '
                + 'tags{name rank isGeneralSpoiler isMediaSpoiler} description(asHtml:false)}}}',
            variables: { s: titulo },
        });
        const lista = Array.isArray(resposta?.data?.Page?.media) ? resposta.data.Page.media : [];
        return lista.filter(Boolean).map(obra => ({
            fonte: 'AniList',
            titulos: textos([obra.title?.english, obra.title?.romaji, obra.title?.native, ...(obra.synonyms || [])]),
            nome: obra.title?.english || obra.title?.romaji || titulo,
            pt: '',
            en: limpar(obra.description),
            // os generos e os temas fortes (60% ou mais), sem os que contam a historia
            tags: [...textos(obra.genres || []),
                ...(obra.tags || []).filter(tema => tema?.rank >= 60 && !tema.isGeneralSpoiler && !tema.isMediaSpoiler).map(tema => tema.name)],
        }));
    }

    /** MangaUpdates: conhece muita obra e tem os generos completos. Sem as versoes em novel. */
    async function buscarNoMangaUpdates(titulo) {
        const resposta = await http.postJson('https://api.mangaupdates.com/v1/series/search', { search: titulo, perpage: 5 });
        const lista = Array.isArray(resposta?.results) ? resposta.results : [];
        return lista.filter(item => item?.record && !/novel/i.test(item.record.type || '')).slice(0, 5).map(item => ({
            fonte: 'MangaUpdates',
            titulos: textos([item.hit_title, item.record.title]),
            nome: item.record.title || titulo,
            pt: '',
            // tira o "From Yen Press:" do comeco, que diz de onde a descricao foi copiada
            en: limpar(String(item.record.description || '').replace(/^\s*from [^:\n]{1,60}:\s*/i, '')),
            tags: (item.record.genres || []).map(genero => genero?.genre),
        }));
    }

    /** MyAnimeList, pela API Jikan: generos, temas e o publico (Shounen, Seinen...). */
    async function buscarNoMyAnimeList(titulo) {
        const resposta = await http.get('https://api.jikan.moe/v4/manga?limit=5&q=' + encodeURIComponent(titulo));
        const lista = Array.isArray(resposta?.data) ? resposta.data : [];
        return lista.filter(obra => !/novel/i.test(obra?.type || '')).map(obra => ({
            fonte: 'MyAnimeList',
            titulos: textos([obra.title, obra.title_english, obra.title_japanese, ...(obra.title_synonyms || []), ...(obra.titles || []).map(t => t?.title)]),
            nome: obra.title_english || obra.title || titulo,
            pt: '',
            en: limpar(String(obra.synopsis || '').replace(/\[written by mal rewrite\]/i, '')),
            tags: [...(obra.genres || []), ...(obra.themes || []), ...(obra.demographics || [])].map(genero => genero?.name),
        }));
    }

    /** Kitsu: as categorias (Isekai, Magic, Dark Fantasy...). */
    async function buscarNoKitsu(titulo) {
        const resposta = await http.get('https://kitsu.io/api/edge/manga?page%5Blimit%5D=5&include=categories&filter%5Btext%5D=' + encodeURIComponent(titulo),
            { Accept: 'application/vnd.api+json' });
        const lista = Array.isArray(resposta?.data) ? resposta.data : [];
        const categorias = new Map((resposta?.included || []).filter(item => item?.type === 'categories').map(item => [item.id, item.attributes?.title]));
        return lista.map(obra => ({
            fonte: 'Kitsu',
            titulos: textos([obra.attributes?.canonicalTitle, ...Object.values(obra.attributes?.titles || {}), ...(obra.attributes?.abbreviatedTitles || [])]),
            nome: obra.attributes?.titles?.en || obra.attributes?.canonicalTitle || titulo,
            pt: '',
            en: limpar(obra.attributes?.synopsis),
            tags: (obra.relationships?.categories?.data || []).map(categoria => categorias.get(categoria.id)),
        }));
    }

    /**
     * Escolhe, em cada fonte, a mesma obra: primeiro as que tem exatamente o nome pesquisado; depois as que tem um
     * nome em comum com uma ja escolhida (o MangaUpdates chama "Raising Villains the Right Way" de "The Patron of
     * Villains", e o Kitsu conhece os dois). Sem nenhuma com o nome exato, vale a primeira do MangaDex (ou do
     * AniList), como antes. Devolve os candidatos escolhidos, um por fonte, na ordem das fontes.
     */
    function mesmaObra(busca, listas) {
        const nomes = new Set([normalizar(busca)]);
        const temUmNome = candidato => candidato.titulos.some(nome => nomes.has(normalizar(nome)));
        const escolhidos = new Array(listas.length).fill(null);
        const guardar = (i, candidato) => {
            escolhidos[i] = candidato;
            for (const nome of candidato.titulos) if (normalizar(nome)) nomes.add(normalizar(nome));
        };
        listas.forEach((lista, i) => {
            const exato = lista.find(temUmNome);
            if (exato) escolhidos[i] = exato;
        });
        escolhidos.forEach((candidato, i) => candidato && guardar(i, candidato));
        if (!escolhidos.some(Boolean)) {
            const i = listas[0].length ? 0 : listas[1].length ? 1 : listas.findIndex(lista => lista.length);
            if (i < 0) return [];
            guardar(i, listas[i][0]);
        }
        // duas voltas: um nome achado numa fonte pode ligar outra
        for (let volta = 0; volta < 2; volta++) {
            listas.forEach((lista, i) => {
                if (escolhidos[i]) return;
                const ligado = lista.find(temUmNome);
                if (ligado) guardar(i, ligado);
            });
        }
        return escolhidos.filter(Boolean);
    }

    /** MyMemory: aos pedacos de ate 450 letras. Devolve null se qualquer pedaco falhar. */
    async function peloMyMemory(texto) {
        const paragrafos = [];
        let pedidos = 0;
        for (const paragrafo of texto.split('\n')) {
            if (!paragrafo.trim()) {
                paragrafos.push('');
                continue;
            }
            const traduzidos = [];
            for (const pedaco of emPedacos(paragrafo.trim())) {
                if (++pedidos > MAXIMO_DE_TRADUCOES) return null;
                const resposta = await http.get('https://api.mymemory.translated.net/get?langpair=en%7Cpt-br&q=' + encodeURIComponent(pedaco));
                const traduzido = String(resposta?.responseData?.translatedText ?? '');
                // quando a cota gratuita acaba, o servico responde com um aviso no lugar da traducao
                if (Number(resposta?.responseStatus) !== 200 || !traduzido.trim() || traduzido.toUpperCase().includes('MYMEMORY WARNING')) return null;
                traduzidos.push(traduzido.trim());
            }
            paragrafos.push(traduzidos.join(' '));
        }
        return paragrafos.join('\n').trim();
    }

    /** Google, pelo endereco da extensao do Chrome: o texto inteiro de uma vez (mantem os paragrafos). */
    async function peloGoogle(texto) {
        const resposta = await http.get('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=pt&q=' + encodeURIComponent(texto));
        const traduzido = Array.isArray(resposta) ? resposta.flat(Infinity).find(parte => typeof parte === 'string') : null;
        return typeof traduzido === 'string' && traduzido.trim() ? traduzido.trim() : null;
    }

    /** Google, pelo outro endereco gratuito: devolve a traducao em frases, que sao juntadas. */
    async function peloGoogleGtx(texto) {
        const resposta = await http.get('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=' + encodeURIComponent(texto));
        if (!Array.isArray(resposta?.[0])) return null;
        const traduzido = resposta[0].map(frase => (Array.isArray(frase) && typeof frase[0] === 'string' ? frase[0] : '')).join('');
        return traduzido.trim() || null;
    }

    /**
     * Traduz do ingles para o portugues, tentando os tradutores em ordem. Uma traducao so vale se voltou diferente do
     * original e sem cara de ingles (o MyMemory as vezes devolve o mesmo texto, ou lixo da memoria dele). Devolve
     * null se nenhum conseguir.
     */
    async function traduzir(texto) {
        for (const tradutor of [peloGoogle, peloGoogleGtx, peloMyMemory]) {
            let traduzido = null;
            try {
                traduzido = await tradutor(texto);
            } catch {
                traduzido = null;
            }
            if (traduzido && traduzido.trim() !== texto.trim() && !pareceIngles(traduzido)) return limpar(traduzido);
        }
        return null;
    }

    const buscarSinopse = async function buscarSinopse(titulo) {
        if (typeof titulo !== 'string' || !titulo.trim()) return null;
        const busca = titulo.trim();

        // as cinco fontes ao mesmo tempo (cada uma com o seu limite de tempo): a resposta vem quando a mais lenta
        // responde ou desiste, e nao a soma de todas
        const seguro = promessa => promessa.then(lista => (Array.isArray(lista) ? lista : []), () => []);
        // as fontes extras (MangaUpdates, MyAnimeList, Kitsu) tem 4 s: uma fora do ar nao segura a resposta
        const comPrazo = promessa => Promise.race([seguro(promessa), new Promise(pronto => setTimeout(() => pronto([]), PRAZO_DAS_FONTES_EXTRAS).unref?.())]);
        const listas = await Promise.all([seguro(buscarNoMangaDex(busca)), seguro(buscarNoAniList(busca)), comPrazo(buscarNoMangaUpdates(busca)),
            comPrazo(buscarNoMyAnimeList(busca)), comPrazo(buscarNoKitsu(busca))]);
        const obra = mesmaObra(busca, listas);
        if (!obra.length) return null;
        const tags = juntarTags(obra.map(candidato => candidato.tags));
        const fontes = obra.map(candidato => candidato.fonte);
        // o nome a mostrar: o pesquisado quando ele bate exatamente (o principal da fonte pode estar em outra lingua)
        const nomeDe = candidato => (candidato.titulos.some(nome => normalizar(nome) === normalizar(busca)) ? busca : candidato.nome);

        // em portugues, escrita por pessoas (MangaDex); "em portugues" que esta em ingles passa pela traducao
        const emPortugues = obra.find(candidato => candidato.pt && !pareceIngles(candidato.pt));
        if (emPortugues) {
            return { descricao: emPortugues.pt, idioma: 'pt', fonte: emPortugues.fonte, tituloEncontrado: nomeDe(emPortugues), traduzida: false, tags, fontes };
        }
        // em ingles: AniList, MangaUpdates, MyAnimeList, Kitsu e MangaDex, nessa ordem (a ordem das listas)
        const ordem = ['AniList', 'MangaUpdates', 'MyAnimeList', 'Kitsu', 'MangaDex'];
        const comIngles = [...obra].sort((a, b) => ordem.indexOf(a.fonte) - ordem.indexOf(b.fonte)).find(candidato => candidato.en || candidato.pt);
        if (!comIngles) return null;
        const emIngles = comIngles.en || comIngles.pt;
        const traduzida = await traduzir(emIngles);
        const nome = nomeDe(comIngles);
        return traduzida !== null
            ? { descricao: traduzida, idioma: 'pt', fonte: comIngles.fonte, tituloEncontrado: nome, traduzida: true, tags, fontes }
            : { descricao: emIngles, idioma: 'en', fonte: comIngles.fonte, tituloEncontrado: nome, traduzida: false, tags, fontes };
    };
    buscarSinopse.traduzir = traduzir;
    return buscarSinopse;
}

/**
 * Para o cadastro (doc 102): devolve o texto em portugues. Se ele parece estar em ingles (buscado, colado ou escrito),
 * traduz; se a traducao falhar, devolve como veio. Texto em portugues passa direto, sem chamar ninguem.
 */
export function criarTradutorDeDescricao(http = clienteHttp) {
    // reaproveita os tradutores do buscador: um titulo vazio nao busca nada, so expoe a funcao de traduzir
    const tradutores = criarBuscadorDeSinopse(http);
    return async function paraPortugues(texto) {
        if (typeof texto !== 'string' || !pareceIngles(texto)) return texto;
        return (await tradutores.traduzir(texto)) ?? texto;
    };
}
