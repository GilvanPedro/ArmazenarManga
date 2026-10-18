'use strict';

const app = document.getElementById('app');
const avisos = document.getElementById('avisos');
const SEPARADORES = {HIFEN: '-', PONTO: '.', UNDERLINE: '_'};

/** Preferencia guardada neste navegador (o site funciona igual se o navegador nao deixar guardar). */
function lembrado(chave, padrao) {
    try {
        return localStorage.getItem('meus-mangas-' + chave) || padrao;
    } catch (e) {
        return padrao;
    }
}

function lembrar(chave, valor) {
    try {
        localStorage.setItem('meus-mangas-' + chave, valor);
    } catch (e) {
        // sem armazenamento: a escolha vale so ate fechar a pagina
    }
}

const estado = {
    status: [],        // [{valor, descricao}] vindo de /api/status
    formatos: [],      // [{valor, descricao}] vindo de /api/formatos-decimais
    dias: [],          // [{valor, descricao}] vindo de /api/dias-da-semana
    ordens: [],        // formas de ordenar a lista, vindas de /api/ordens-da-lista
    ordem: lembrado('ordem', 'CADASTRO'), // forma de ordenar escolhida na pagina principal
    ordensDeDescoberta: [], // formas de ordenar a aba Descobrir, vindas de /api/recomendacoes/ordens
    descobrir: {busca: '', tags: [], sem: [], tagsAbertas: false, ordem: 'POPULARIDADE', pagina: 1}, // o que esta escolhido na aba Descobrir
    pagina: 1,         // pagina da grade que esta aberta
    esperaDaBusca: null, // temporizador que espera a pessoa parar de digitar na busca
    recarregar: null,  // recarrega so os cartoes da tela atual, sem pular para o topo
    extensao: false,   // a extensao de navegador esta instalada e liberada para este site
    busca: '',
    filtroStatus: '',
    filtroTags: [],    // tags escolhidas na Biblioteca: so aparecem os mangas que tem todas
    tagsDaBibliotecaAbertas: false, // a lista de tags do quadro da Biblioteca esta aberta
    sorteado: null,    // id do manga que acabou de sair no sorteio
    render: 0,         // descarta respostas de telas que ja foram trocadas
    sessao: null,      // {exigeLogin, logado, usuario, expiraEm} vindo de /api/sessao
    siteAberto: false, // as listas fixas ja foram carregadas e a navegacao ja esta ligada
    listaCompleta: null, // {ordem, itens, quando, pedido, grande}: a lista inteira (resumida) guardada para buscar e paginar sem esperar o servidor
};

// ------------------------------------------------------------------ ajudantes

/** Cria um elemento. O texto sempre entra como texto, nunca como HTML. */
function h(tag, atributos, ...filhos) {
    const el = document.createElement(tag);
    for (const [nome, valor] of Object.entries(atributos || {})) {
        if (valor == null || valor === false) continue;
        if (nome.startsWith('on')) el.addEventListener(nome.slice(2), valor);
        else if (nome === 'class') el.className = valor;
        else if (valor === true) el.setAttribute(nome, '');
        else el.setAttribute(nome, valor);
    }
    for (const filho of filhos.flat()) {
        if (filho == null || filho === false) continue;
        el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
    return el;
}

async function chamar(metodo, caminho, corpo) {
    // depois de qualquer alteracao, a lista guardada pode estar velha: a proxima vez busca de novo
    if (metodo !== 'GET') {
        estado.listaCompleta = null;
        paginasDoServidor.clear();
    }
    const opcoes = {method: metodo, headers: {}};
    if (corpo instanceof FormData) {
        opcoes.body = corpo;
    } else if (corpo !== undefined) {
        opcoes.headers['Content-Type'] = 'application/json';
        opcoes.body = JSON.stringify(corpo);
    }
    let resposta;
    try {
        resposta = await fetch(caminho, opcoes);
    } catch (e) {
        throw new Error('Não foi possível falar com o servidor');
    }
    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
    // o login venceu (30 dias) ou foi desfeito em outro lugar: volta para a tela de entrada
    if (resposta.status === 401 && !['/api/sessao', '/api/inicio', '/api/contas'].includes(caminho) && estado.sessao) {
        estado.sessao.logado = false;
        // varias chamadas podem voltar recusadas juntas: a tela de entrada aparece uma vez so
        if (!document.body.classList.contains('entrando')) telaLogin('Seu login venceu. Entre de novo para continuar.');
        throw new Error('Entre com seu usuário e senha');
    }
    // a hospedagem recusa envios grandes antes de chegarem na API, sem mensagem
    if (resposta.status === 413) throw new Error('A imagem é grande demais. Escolha uma menor');
    if (!resposta.ok) {
        throw new Error((dados && dados.mensagem) || 'Erro ' + resposta.status);
    }
    return dados;
}

function avisar(texto, ruim) {
    const aviso = h('div', {class: 'aviso' + (ruim ? ' ruim' : '')}, texto);
    avisos.append(aviso);
    setTimeout(() => aviso.remove(), ruim ? 5000 : 2500);
}

function descricaoStatus(valor) {
    const status = estado.status.find(s => s.valor === valor);
    return status ? status.descricao : valor;
}

function etiquetaStatus(valor) {
    return h('span', {class: 'status status-' + valor}, descricaoStatus(valor));
}

/** "48,5" ou "48.5" -> 48.5. Devolve null se nao for um capitulo valido. */
function lerCapitulo(texto) {
    const limpo = String(texto).trim().replace(',', '.');
    return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Descobre o numero do capitulo pelo endereco da pagina dele.
 * ".../6880186-chapter-7" -> 7, ".../capitulo-48-5" -> 48.5. Devolve null se nao achar.
 */
function capituloDoLink(endereco) {
    let caminho;
    try {
        const url = new URL(endereco);
        caminho = decodeURIComponent(url.pathname) + url.search;
    } catch (e) {
        return null;
    }
    const comPalavra = [...caminho.matchAll(/(?:chapter|chap|capitulo|capítulo|cap|episode|episodio|ep|ch)[-_\/ =]?(\d+)(?:[.\-_](\d{1,2})(?![0-9a-z]))?/gi)].pop();
    // sem a palavra "capitulo" no endereco, vale o ultimo numero dele
    const achado = comPalavra || [...caminho.matchAll(/(\d+)(?:\.(\d{1,2}))?(?![0-9a-z])/gi)].pop();
    if (!achado) return null;
    return Number(achado[1] + (achado[2] ? '.' + achado[2] : ''));
}

const TOKEN_DE_CAPITULO = '(?:chapter|chap|ch|cap[ií]tulo|cap|episode|epis[oó]dio|ep)\\.?\\s*#?\\d+(?:[.,]\\d+)?';
const TIPO_DE_OBRA = '(?:mang[aá]s?|manhwas?|manhuas?|webtoons?|comics?|novels?|hq)';

/**
 * Tira de um titulo de pagina tudo o que nao e o nome da obra: etiquetas entre colchetes ("[Manga]"), o numero do
 * capitulo (no comeco ou no fim), palavras como "Read", "Ler", "Manga", "Online", "Free", e o nome do proprio site.
 *   "[Manga] Manga Solo Leveling - Capítulo 12 | Site"                 -> "Solo Leveling"
 *   "Chapter 222 | Pick Me Up, Infinite Gacha | Weeb Central"          -> "Pick Me Up, Infinite Gacha"
 *   "Read The Beginning After the End Manhwa Online - All Chapters Free | Toonily" -> "The Beginning After the End"
 */
function limparTitulo(tituloDaPagina, endereco) {
    let titulo = String(tituloDaPagina || '').replace(/\s+/g, ' ').trim();
    const compacto = texto => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    // nome do site, tirado do endereco: "www.asurascans.com" -> "asurascans"
    let site = '';
    try {
        const partes = new URL(endereco).hostname.replace(/^www\./, '').split('.');
        site = compacto(partes.length > 1 ? partes.slice(0, -1).join('') : partes[0]);
    } catch (e) {
        // sem endereco valido, so nao da para reconhecer o nome do site
    }
    const etiquetas = /^(?:\s*(?:\[[^\]]*\]|【[^】]*】|\([^)]*\))\s*)+/;
    // (o fim da palavra e conferido sem \\b, que nao entende letra acentuada: "Mangá")
    const palavrasDoComeco = new RegExp('^(?:(?:read|ler|leia|' + TIPO_DE_OBRA + ')(?![\\p{L}\\p{N}])\\s*[:\\-–—]?\\s*)+(?=\\S)', 'iu');

    titulo = titulo.replace(etiquetas, '');
    // capitulo no comeco: "Chapter 222 | Nome | Site", "Capítulo 5 - Nome"
    titulo = titulo.replace(new RegExp('^' + TOKEN_DE_CAPITULO + '\\s*[|:\\-–—]\\s*', 'iu'), '');
    // capitulo depois do nome: corta dali em diante ("Nome Chapter 7 - Read Online | Site", "Nome Ch.90 Page 1")
    titulo = titulo.replace(new RegExp('[\\s\\-–—|:,(\\[]*(?:^|[^\\p{L}])' + TOKEN_DE_CAPITULO + '.*$', 'iu'), '');

    // o que sobrou vem em pedacos separados por "|" ou " - ": sai o nome do site e os que sao so propaganda
    const propaganda = new RegExp('^(?:read|ler|leia)?\\s*' + TIPO_DE_OBRA + '?\\s*(?:online|free|gr[aá]tis|english|all chapters|todos os cap[ií]tulos|page \\d+|p[aá]gina \\d+)\\b.*$', 'iu');
    const ehOSite = pedaco => {
        const junto = compacto(pedaco);
        return site.length >= 4 && junto.length >= 4 && (junto === site || site.includes(junto) || junto.includes(site));
    };
    const pedacos = titulo.split(/\s*\|\s*|\s+[-–—]\s+/).map(pedaco => pedaco.trim())
        .filter(pedaco => pedaco && !ehOSite(pedaco) && !propaganda.test(pedaco));
    titulo = pedacos.join(' - ');

    titulo = titulo.replace(etiquetas, '').replace(palavrasDoComeco, '');
    // "... Manhwa Online", "... English Online Free", "... Raw", "... PT-BR" no fim
    titulo = titulo.replace(new RegExp('\\s+(?:' + TIPO_DE_OBRA + '\\s+)?(?:online|free|gr[aá]tis|english|raw|pt[- ]?br)\\b.*$', 'iu'), '');
    // "Nome Manga" (so quando sobra nome antes)
    titulo = titulo.replace(new RegExp('(?<=\\S)\\s+' + TIPO_DE_OBRA + '$', 'iu'), '');
    return titulo.replace(/[\s\-–—|:,]+$/, '').trim();
}

/**
 * Nome do manga a partir dos titulos da pagina do capitulo (o da aba e o "og:title", que muitos sites preenchem
 * de jeitos diferentes). Fica com o mais enxuto dos que sobram depois da limpeza.
 * Sem titulo aproveitavel, usa o endereco: ".../0vx0d-doomsday-wedding/..." -> "Doomsday Wedding".
 */
function tituloDoManga(titulosDaPagina, endereco) {
    const limpos = [].concat(titulosDaPagina || []).map(titulo => limparTitulo(titulo, endereco)).filter(titulo => titulo.length >= 2);
    if (limpos.length > 0) return limpos.sort((a, b) => a.length - b.length)[0];
    try {
        const pedacos = new URL(endereco).pathname.split('/').filter(Boolean).map(decodeURIComponent)
            .filter(pedaco => /[a-z]{3}/i.test(pedaco) && !/(chapter|capitulo|cap[-_]?\d|episode)/i.test(pedaco));
        // o trecho mais comprido com palavras costuma ser o nome da obra; ids misturam letras e numeros
        const nome = pedacos.sort((a, b) => b.length - a.length)[0] || '';
        return nome.split(/[-_]+/).filter(palavra => palavra && !/\d/.test(palavra))
            .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1)).join(' ');
    } catch (e) {
        return '';
    }
}

/** Modelo do link a partir do endereco de um capitulo: troca o numero do capitulo por {cap}. */
function modeloDoLink(endereco, capitulo) {
    if (capitulo == null) return endereco;
    const inicioDoCaminho = endereco.indexOf('/', endereco.indexOf('://') + 3);
    for (const numero of [String(capitulo).replace('.', '-'), String(capitulo)]) {
        for (let posicao = endereco.lastIndexOf(numero); posicao > inicioDoCaminho && inicioDoCaminho > 0; posicao = endereco.lastIndexOf(numero, posicao - 1)) {
            const antes = endereco[posicao - 1];
            const depois = endereco[posicao + numero.length] || '';
            if (!/\d/.test(antes) && !/[\p{L}\p{N}]/u.test(depois)) {
                return endereco.slice(0, posicao) + '{cap}' + endereco.slice(posicao + numero.length);
            }
        }
    }
    return endereco;
}

/**
 * Numero do capitulo dito no titulo da pagina ("Chapter 1121 | One Piece"), para os sites em que o endereco
 * do capitulo e so um codigo. Devolve null se nenhum titulo diz.
 */
function capituloDoTitulo(titulos) {
    for (const titulo of [].concat(titulos || [])) {
        const achado = String(titulo || '').match(/(?:^|[^\p{L}])(?:chapter|chap|ch|cap[ií]tulo|cap|episode|epis[oó]dio|ep)\.?\s*#?(\d+)(?:[.,](\d{1,2}))?(?!\d)/iu);
        if (achado) return Number(achado[1] + (achado[2] ? '.' + achado[2] : ''));
    }
    return null;
}

function ehLinkHttp(texto) {
    try {
        return ['http:', 'https:'].includes(new URL(texto).protocol);
    } catch (e) {
        return false;
    }
}

function mostrarCapitulo(numero) {
    return String(numero).replace('.', ',');
}

/** Em que faixa a nota cai: 0 a 4 ruim, 5 a 7 medio, 8 e 9 bom, 10 muito bom. */
function faixaDaNota(nota) {
    if (nota >= 10) return {classe: 'muito-bom', nome: 'Muito bom'};
    if (nota >= 8) return {classe: 'bom', nome: 'Bom'};
    if (nota >= 5) return {classe: 'medio', nome: 'Médio'};
    return {classe: 'ruim', nome: 'Ruim'};
}

/**
 * Selo da nota: fundo preto, numero branco e, na esquerda, o rostinho da faixa (triste, serio, sorrindo ou
 * com estrelas nos olhos). O nome da faixa nao e escrito: fica so na dica do mouse e para leitores de tela.
 * Sem nota, nao ha selo.
 */
function etiquetaNota(nota, grande) {
    if (nota == null) return null;
    const faixa = faixaDaNota(nota);
    return h('span', {class: 'nota nota-' + faixa.classe + (grande ? ' grande' : ''), title: 'Nota ' + nota + ' de 10 · ' + faixa.nome},
        h('img', {src: '/icones/nota-' + faixa.classe + '.svg', alt: '', width: '22', height: '22'}),
        h('span', {class: 'so-leitor'}, 'Nota '), String(nota), h('span', {class: 'so-leitor'}, ', ' + faixa.nome));
}

/** Opcoes do seletor de nota: sem nota e de 10 a 0. */
function seletorDeNota(nota) {
    const opcoes = [{valor: '', descricao: 'Sem nota'}];
    for (let n = 10; n >= 0; n--) opcoes.push({valor: String(n), descricao: String(n)});
    return seletor(opcoes, nota == null ? '' : String(nota));
}

function capa(manga, comoLink) {
    // favorito: borda roxa (ou a da loja que a pessoa equipou) e estrela no canto, em toda capa do manga
    const atributos = {class: 'capa' + (manga.favorite ? ' favorita' + classesDaLoja(meusEquipados()) : '')};
    if (comoLink) {
        atributos.href = '#/manga/' + manga.id;
        atributos['aria-label'] = manga.title + (manga.favorite ? ' (favorito)' : '');
    }
    // largura e altura reservam o espaco da capa antes de ela chegar, sem a pagina pular
    // nos cartoes, a miniatura (bem mais leve) quando ja existe. Na pagina do manga, a miniatura aparece na hora
    // (ela ja veio com a lista) e da lugar a capa inteira assim que ela chega
    const miniatura = manga.thumbUrl || miniaturaGuardada(manga.id);
    const img = h('img', {src: miniatura || manga.imageUrl, alt: comoLink ? '' : 'Capa de ' + manga.title,
        loading: comoLink ? 'lazy' : 'eager', decoding: 'async', width: '300', height: '450'});
    if (!comoLink && miniatura) {
        const inteira = new Image();
        inteira.onload = () => { img.src = manga.imageUrl; };
        inteira.src = manga.imageUrl;
    }
    img.addEventListener('error', () => {
        img.replaceWith(h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, (manga.title || '?').trim().charAt(0).toUpperCase()));
    });
    return h(comoLink ? 'a' : 'div', atributos, img, comoLink ? etiquetaStatus(manga.readingStatus) : null, etiquetaNota(manga.rating),
        manga.favorite ? h('span', {class: 'estrela-de-favorito', title: 'Favorito', 'aria-hidden': 'true'}, '★') : null,
        manga.favorite ? enfeiteDaBorda() : null);
}

/**
 * Camada dos enfeites que algumas bordas da loja desenham em volta da capa (cristais, vinhas, raios, nevoa...). Fica
 * vazia e escondida nas outras; o CSS de cada borda diz o que aparece nela.
 */
// as camadas de um favorito: a do efeito da loja (cortada no formato da capa, para o efeito andar sem passar para fora,
// doc 100) e a do enfeite da borda (que pode sair da capa)
// doc 100), a da luz que anda na moldura (atras da imagem) e a do enfeite da borda (que pode sair da capa)
const enfeiteDaBorda = () => [h('span', {class: 'camada-do-efeito', 'aria-hidden': 'true'}), h('span', {class: 'luz-da-moldura', 'aria-hidden': 'true'}),
    h('span', {class: 'enfeite-da-borda', 'aria-hidden': 'true'})];

/** Miniatura de um manga que veio na lista guardada (a pagina do manga nao traz a miniatura). */
function miniaturaGuardada(id) {
    const itens = (estado.listaCompleta && estado.listaCompleta.itens) || estado.ultimaPagina || [];
    const manga = itens.find(outro => outro.id === id);
    return manga ? manga.thumbUrl : null;
}

function linkExterno(classe, endereco, titulo, texto) {
    return h('a', {class: classe, href: endereco, target: '_blank', rel: 'noopener noreferrer', title: titulo},
        h('span', null, texto));
}

/**
 * Lendo: um botao que abre o proximo capitulo.
 * Concluido: nao ha proximo, entao a escolha e entre ler de novo (capitulo 1) ou abrir o ultimo capitulo.
 */
function botaoLer(manga, classe) {
    if (manga.readingStatus === 'CONCLUIDO') {
        const ultimo = 'Último capítulo (' + mostrarCapitulo(manga.lastChapter) + ')';
        if (classe === 'pequeno') {
            // no cartao nao cabem dois botoes: um so, que pergunta
            return h('button', {
                type: 'button',
                class: 'botao primario pequeno',
                title: 'Ler novamente ou abrir o último capítulo',
                onclick: () => abrirDialogoReler(manga, ultimo),
            }, h('span', null, 'Ler'));
        }
        return [
            linkExterno('botao primario', manga.firstChapterLink, 'Abrir o capítulo 1 no site', 'Ler novamente'),
            linkExterno('botao', manga.lastChapterLink, 'Abrir o último capítulo no site', ultimo),
        ];
    }
    return h('a', {
        class: 'botao primario ' + (classe || ''),
        href: '/api/mangas/' + manga.id + '/ler',
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Abrir o capítulo ' + mostrarCapitulo(manga.nextChapter) + ' no site',
        // com a extensao, o proprio navegador acha o proximo capitulo quando o servidor e barrado pelo site
        onclick: evento => {
            if (!estado.extensao) return;
            evento.preventDefault();
            lerComExtensao(manga);
        },
    }, h('span', null, 'Ler ' + mostrarCapitulo(manga.nextChapter)));
}

// ------------------------------------------------------------------ extensao de navegador

function extensaoInstalada() {
    return Boolean(document.documentElement.dataset.meusMangasExtensao);
}

/** Manda um pedido para a extensao (pasta extensao/ do projeto) e espera a resposta. Nunca rejeita. */
function pedirExtensao(tipo, dados, tempoLimite) {
    return new Promise(resolver => {
        const id = Date.now() + '-' + Math.random();
        const terminar = resposta => {
            clearTimeout(relogio);
            window.removeEventListener('message', ouvir);
            resolver(resposta || {ok: false, motivo: 'erro'});
        };
        const ouvir = evento => {
            const mensagem = evento.data;
            if (evento.source !== window || evento.origin !== location.origin) return;
            if (mensagem && mensagem.de === 'meus-mangas-extensao' && mensagem.id === id) terminar(mensagem.resposta);
        };
        const relogio = setTimeout(() => terminar({ok: false, motivo: 'tempo'}), tempoLimite || 45000);
        window.addEventListener('message', ouvir);
        window.postMessage({de: 'meus-mangas-site', id, tipo, dados: dados || {}}, location.origin);
    });
}

async function conferirExtensao() {
    const antes = estado.extensao;
    estado.extensao = extensaoInstalada() && (await pedirExtensao('estado', {}, 3000)).autorizado === true;
    if (estado.extensao && !antes) informarSitesAExtensao();
    return estado.extensao;
}

/** Conta a extensao em quais sites de leitura estao os mangas, para o botao "Lido" aparecer neles. */
async function informarSitesAExtensao() {
    if (!estado.extensao) return;
    try {
        // o servidor devolve so os sites (sem repetir), e nao a lista inteira
        await pedirExtensao('sites', {sites: await chamar('GET', '/api/sites')}, 5000);
    } catch (e) {
        // sem a lista o botao so nao aparece; o resto do site nao depende disso
    }
}

function mesmoSite(a, b) {
    try {
        return new URL(a).host === new URL(b).host;
    } catch (e) {
        return false;
    }
}

/**
 * O "Ler" com a extensao instalada. Primeiro o servidor confere o link, como sempre. Se o site de leitura barra o
 * servidor (protecao contra robos), a extensao abre o ultimo capitulo lido no navegador, acha o link do proximo,
 * vai ate ele, e o endereco encontrado fica salvo para o link continuar certo.
 */
async function lerComExtensao(manga) {
    const voltarComAviso = aviso => {
        if (location.hash === '#/manga/' + manga.id + '/' + aviso) rota();
        else location.hash = '#/manga/' + manga.id + '/' + aviso;
    };
    let resultado;
    try {
        resultado = await chamar('POST', '/api/mangas/' + manga.id + '/verificacao-link');
    } catch (e) {
        avisar(e.message, true);
        return;
    }
    const atual = resultado.manga;
    if (resultado.situacao === 'NAO_ENCONTRADO') return voltarComAviso('sem-capitulo');
    if (resultado.situacao === 'LINK_QUEBRADO') return voltarComAviso('link-quebrado');
    if (resultado.situacao === 'DISPONIVEL' || atual.nextChapterLinkExact) {
        const aberto = await pedirExtensao('abrir', {url: atual.nextChapterLink});
        if (!aberto.ok) avisar('A extensão não conseguiu abrir o capítulo', true);
        return;
    }

    avisar('Procurando o capítulo ' + mostrarCapitulo(atual.nextChapter) + ' no site…');
    const achado = await pedirExtensao('proximo', {ultimoUrl: atual.lastChapterLink, proximoCapitulo: atual.nextChapter});
    if (achado.ok && mesmoSite(achado.atualUrl, atual.lastChapterLink) && mesmoSite(achado.proximoUrl, atual.lastChapterLink)) {
        try {
            // nao muda o capitulo lido: so guarda os enderecos exatos do atual e do proximo
            await chamar('POST', '/api/mangas/' + manga.id + '/capitulo-lido',
                {lastChapter: atual.lastChapter, lastChapterUrl: achado.atualUrl, nextChapterUrl: achado.proximoUrl});
        } catch (e) {
            avisar('O capítulo abriu, mas o link não pôde ser salvo: ' + e.message, true);
        }
    } else if (achado.motivo === 'sem-proximo') {
        voltarComAviso('sem-capitulo');
    } else if (achado.motivo === 'nao-autorizado') {
        estado.extensao = false;
        avisar('Libere este site na extensão: clique no ícone dela e em Permitir', true);
    } else if (achado.motivo !== 'aba-fechada') {
        avisar('Não encontrei o botão de próximo capítulo. A página do último capítulo lido ficou aberta.', true);
    }
}

function abrirDialogoReler(manga, ultimo) {
    const dialogo = h('dialog', null,
        h('div', {class: 'opcoes'},
            h('h2', null, manga.title),
            linkExterno('botao primario', manga.firstChapterLink, 'Abrir o capítulo 1 no site', 'Ler novamente (capítulo 1)'),
            linkExterno('botao', manga.lastChapterLink, 'Abrir o último capítulo no site', ultimo),
            h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar')));
    for (const link of dialogo.querySelectorAll('a')) link.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
}

// ------------------------------------------------------------------ grade

/** Dia de hoje no relogio de quem esta usando o site (o servidor pode estar em outro fuso). */
function diaDeHoje() {
    return ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'][new Date().getDay()];
}

function descricaoDia(valor) {
    const dia = estado.dias.find(d => d.valor === valor);
    return dia ? dia.descricao : valor;
}

function abas(atual) {
    const aba = (nome, endereco, texto) => h('a', {
        class: 'aba',
        href: endereco,
        'aria-current': atual === nome ? 'page' : null,
        // clicar na aba que ja esta aberta recarrega o que ela mostra, buscando tudo de novo
        onclick: atual === nome ? evento => {
            evento.preventDefault();
            recarregarAba();
        } : null,
    }, texto);
    return rolagemDasAbas(h('nav', {class: 'abas', 'aria-label': 'Listas'},
        aba('todos', '#/', 'Todos os mangás'),
        aba('hoje', '#/hoje', 'Lançam hoje'),
        aba('descobrir', '#/descobrir', 'Descobrir'),
        aba('atalho', '#/atalho', 'Extensão e atalho')));
}

/**
 * Abas que nao cabem na largura (no celular) rolam para o lado. Um esmaecido na borda mostra que tem mais aba daquele
 * lado, e a aba aberta aparece na tela (centralizada, se a linha for rolada).
 */
function rolagemDasAbas(nav) {
    let primeiraVez = true;
    const marcar = () => {
        nav.classList.toggle('mais-a-direita', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1);
        nav.classList.toggle('mais-a-esquerda', nav.scrollLeft > 1);
    };
    nav.addEventListener('scroll', marcar, {passive: true});
    new ResizeObserver(() => {
        const aberta = nav.querySelector('[aria-current=page]');
        if (primeiraVez && aberta && nav.scrollWidth > nav.clientWidth) {
            const inicio = aberta.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
            nav.scrollLeft = inicio - (nav.clientWidth - aberta.offsetWidth) / 2;
        }
        if (nav.clientWidth > 0) primeiraVez = false;
        marcar();
    }).observe(nav);
    return nav;
}

/** Busca de novo o que a aba aberta mostra. A grade mantem a busca, os filtros e a pagina. */
function recarregarAba() {
    estado.listaCompleta = null;
    paginasDoServidor.clear();
    window.scrollTo(0, 0);
    if (estado.recarregar) {
        estado.recarregar(true);
    } else {
        rota();
    }
}

/** Aba dos mangas que estou lendo e que lancam capitulo no dia de hoje. */
// ------------------------------------------------------------------ lugares de banner (doc 91)

/*
 * Os lugares onde aparecem os banners do Gerenciar. Cada pagina poe os seus: verticais nas laterais (trilhos fixos ao
 * lado do conteudo, so quando sobra espaco) e horizontais (os "so sem trilhos" aparecem no lugar dos verticais quando
 * a tela e estreita). Cada lugar sorteia um banner do formato dele, pelo peso, entre os que estao no ar, e conta uma
 * exibicao quando aparece. Sem nenhum banner no ar daquele formato, entra o banner padrao "Anuncie aqui".
 */
const banners = {lista: null, buscadoEm: 0, buscando: null, trilhos: null, pendentes: [], envio: null};

/** O e-mail para quem quer anunciar (montado em partes, para nao ficar inteiro no codigo para robos de spam). */
const EMAIL_PARA_ANUNCIAR = ['gilvanpedro2006', 'gmail.com'].join('@');

async function bannersNoAr() {
    if (banners.lista && Date.now() - banners.buscadoEm < 120_000) return banners.lista;
    banners.buscando ??= fetch('/api/banners/no-ar').then(resposta => resposta.ok ? resposta.json() : {banners: []})
        .then(dados => dados.banners || []).catch(() => []);
    banners.lista = await banners.buscando;
    banners.buscando = null;
    banners.buscadoEm = Date.now();
    return banners.lista;
}

/** Um lugar de banner. formato: horizontal ou vertical. classe: 'so-sem-trilhos', 'trilho-de-banner esquerda' etc. */
function lugarDeBanner(posicao, formato, classe = '') {
    return h('div', {class: 'lugar-de-banner ' + formato + (classe ? ' ' + classe : ''), 'data-posicao': posicao, 'data-formato': formato});
}

/**
 * Os dois trilhos verticais de uma pagina, ao lado do elemento "referencia" (o conteudo). Ficam fixos na tela; a largura
 * e a posicao sao calculadas em arrumarBanners, pelo espaco que sobra dos dois lados.
 */
function trilhosDeBanner(referencia, pagina) {
    const esquerda = lugarDeBanner(pagina + '-esquerda', 'vertical', 'trilho-de-banner');
    const direita = lugarDeBanner(pagina + '-direita', 'vertical', 'trilho-de-banner');
    banners.trilhos = {referencia, esquerda, direita};
    return [esquerda, direita];
}

function sortearBanner(lista, formato, jaUsados) {
    const doFormato = lista.filter(banner => banner.formato === formato);
    const naoUsados = doFormato.filter(banner => !jaUsados.has(banner.id));
    const opcoes = naoUsados.length ? naoUsados : doFormato;
    const total = opcoes.reduce((soma, banner) => soma + banner.peso, 0);
    let sorteio = Math.random() * total;
    return opcoes.find(banner => (sorteio -= banner.peso) < 0) || opcoes[0] || null;
}

function bannerPadrao(formato) {
    return h('a', {class: 'banner-padrao ' + formato, href: 'mailto:' + EMAIL_PARA_ANUNCIAR + '?subject=' + encodeURIComponent('Anúncio no Viracap')},
        h('span', {class: 'icone-do-banner-padrao', 'aria-hidden': 'true'}, '📣'),
        h('span', {class: 'textos-do-banner-padrao'},
            h('b', null, 'Anuncie aqui'),
            h('span', null, 'Seu banner para quem lê mangá, manhwa e webtoon todo dia.')),
        h('span', {class: 'botao-do-banner-padrao'}, 'Fale comigo'));
}

function contarExibicao(banner, posicao) {
    banners.pendentes.push({banner, posicao});
    clearTimeout(banners.envio);
    // juntas: uma chamada para os lugares que apareceram quase ao mesmo tempo (de 12 em 12)
    banners.envio = setTimeout(() => {
        while (banners.pendentes.length) {
            const itens = banners.pendentes.splice(0, 12);
            fetch('/api/banners/exibicoes', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({itens}), keepalive: true}).catch(() => {});
        }
    }, 800);
}

/** Calcula os trilhos (cabem ou nao) e preenche os lugares que estao aparecendo e ainda estao vazios. */
async function arrumarBanners() {
    const trilhos = banners.trilhos;
    let comTrilhos = false;
    if (trilhos && trilhos.referencia.isConnected) {
        const caixa = trilhos.referencia.getBoundingClientRect();
        const largura = document.documentElement.clientWidth;
        // o espaco do lado mais estreito, menos 14 px de cada lado (do conteudo e da beira da tela); a partir de 90 px cabe
        const sobra = Math.min(caixa.left, largura - caixa.right) - 28;
        const lado = Math.floor(Math.min(200, sobra));
        comTrilhos = lado >= 90;
        if (comTrilhos) {
            trilhos.esquerda.style.width = trilhos.direita.style.width = lado + 'px';
            trilhos.esquerda.style.left = Math.round(caixa.left - 14 - lado) + 'px';
            trilhos.direita.style.left = Math.round(caixa.right + 14) + 'px';
        }
    }
    app.classList.toggle('com-trilhos', comTrilhos);
    const vazios = [...app.querySelectorAll('.lugar-de-banner:not([data-pronto])')].filter(lugar => lugar.getClientRects().length > 0);
    if (!vazios.length) return;
    vazios.forEach(lugar => lugar.dataset.pronto = '1');
    const lista = await bannersNoAr();
    const usados = new Set([...app.querySelectorAll('.lugar-de-banner[data-banner]')].map(lugar => lugar.dataset.banner));
    for (const lugar of vazios) {
        if (!lugar.isConnected) continue;
        const formato = lugar.dataset.formato;
        const banner = sortearBanner(lista, formato, usados);
        if (!banner) {
            lugar.replaceChildren(bannerPadrao(formato));
            continue;
        }
        usados.add(banner.id);
        lugar.dataset.banner = banner.id;
        const imagem = h('img', {src: banner.imagem, alt: banner.texto || 'Anúncio de ' + banner.empresa, width: banner.largura, height: banner.altura, decoding: 'async'});
        const selo = h('span', {class: 'selo-de-anuncio'}, 'Anúncio');
        lugar.replaceChildren(banner.temLink
            ? h('a', {class: 'banner-de-anuncio', href: '/api/banners/' + encodeURIComponent(banner.id) + '/clique?posicao=' + lugar.dataset.posicao,
                target: '_blank', rel: 'sponsored noopener', title: banner.texto || banner.empresa}, imagem, selo)
            : h('div', {class: 'banner-de-anuncio'}, imagem, selo));
        contarExibicao(banner.id, lugar.dataset.posicao);
    }
}

// a pagina muda (troca de tela, lista carregada) ou a janela muda de tamanho: confere os lugares de novo
let esperaDosBanners = null;
const agendarBanners = () => {
    clearTimeout(esperaDosBanners);
    esperaDosBanners = setTimeout(arrumarBanners, 120);
};
// ------------------------------------------------------------------ animacoes so do que esta na tela (doc 100)

/*
 * As capas favoritas (com bordas e efeitos animados) e as previas da loja so animam enquanto aparecem na tela: as que
 * estao fora (mais para baixo na lista, em outra parte da loja) ganham data-fora e o CSS pausa as animacoes delas.
 * Animacao pausada nao custa nada para o navegador. Com 40 favoritos na pagina, so os ~12 visiveis animam.
 */
const vigiaDaTela = 'IntersectionObserver' in window
    ? new IntersectionObserver(entradas => {
        for (const entrada of entradas) {
            // a capa saiu da pagina (trocou de tela): para de vigiar
            if (!entrada.target.isConnected) vigiaDaTela.unobserve(entrada.target);
            else entrada.target.toggleAttribute('data-fora', !entrada.isIntersecting);
        }
    }, {rootMargin: '120px 0px'})
    : null;
// a janela sem foco (outro programa na frente, o site aparecendo do lado): pausa as animacoes (o CSS faz o resto)
window.addEventListener('blur', () => document.documentElement.classList.add('sem-foco'));
window.addEventListener('focus', () => document.documentElement.classList.remove('sem-foco'));

function vigiarAnimacoes() {
    if (!vigiaDaTela) return;
    for (const elemento of app.querySelectorAll('.capa.favorita:not([data-vigiada]), .previa-do-item:not([data-vigiada]), .previa-do-tema:not([data-vigiada])')) {
        elemento.dataset.vigiada = '1';
        elemento.setAttribute('data-fora', '');
        vigiaDaTela.observe(elemento);
    }
}

new MutationObserver(() => {
    if (banners.trilhos && !banners.trilhos.referencia.isConnected) banners.trilhos = null;
    agendarBanners();
    vigiarAnimacoes();
}).observe(app, {childList: true, subtree: true});
window.addEventListener('resize', agendarBanners);

function telaHoje() {
    const lista = h('div', {class: 'grade'});
    const hoje = diaDeHoje();
    document.title = 'Lançam hoje · Viracap';
    app.replaceChildren(
        abas('hoje'),
        h('p', {class: 'subtitulo'}, descricaoDia(hoje), ' · mangás que você está lendo e que lançam capítulo hoje. Ao marcar o capítulo novo, ele sai daqui.'),
        lista,
        lugarDeBanner('hoje-fim', 'horizontal', 'no-fim'));
    estado.recarregar = () => {
        lista.classList.add('recarregando');
        carregarHoje(lista, hoje);
    };
    carregarHoje(lista, hoje);
}

async function carregarHoje(lista, hoje) {
    const vez = ++estado.render;
    let mangas;
    try {
        // a meia-noite de hoje no relogio deste aparelho: quem ja teve capitulo marcado depois disso sai da lista
        const meiaNoite = new Date();
        meiaNoite.setHours(0, 0, 0, 0);
        mangas = await chamar('GET', '/api/mangas/lancamentos?dia=' + hoje + '&desde=' + encodeURIComponent(meiaNoite.toISOString()));
    } catch (e) {
        if (vez === estado.render) lista.replaceChildren(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    lista.classList.remove('recarregando');
    if (mangas.length === 0) {
        lista.className = '';
        lista.replaceChildren(vazio('Nenhum lançamento para ler hoje',
            'Aqui aparecem os mangás com status Lendo que lançam capítulo hoje e que você ainda não leu. '
            + 'O dia de lançamento é escolhido na edição geral de cada um.'));
        return;
    }
    lista.className = 'grade';
    lista.replaceChildren(...mangas.map(cartao));
}

function telaGrade() {
    const lista = h('div', {class: 'grade'});
    const paginacao = h('nav', {class: 'paginacao', 'aria-label': 'Páginas'});
    const busca = h('input', {
        type: 'search',
        placeholder: 'Buscar pelo nome…',
        'aria-label': 'Buscar pelo nome',
        value: estado.busca,
    });
    busca.addEventListener('input', () => {
        estado.busca = busca.value;
        estado.pagina = 1;
        // a busca e feita aqui mesmo, na lista guardada: so espera um instante para nao redesenhar a cada tecla
        clearTimeout(estado.esperaDaBusca);
        const grande = estado.listaCompleta && estado.listaCompleta.grande;
        estado.esperaDaBusca = setTimeout(() => carregarGrade(lista, paginacao), grande ? 250 : 60);
    });

    const ordenar = seletor(estado.ordens, estado.ordem);
    ordenar.setAttribute('aria-label', 'Ordenar por');
    ordenar.className = 'ordenar';
    ordenar.hidden = estado.ordens.length === 0;
    ordenar.addEventListener('change', () => {
        estado.ordem = ordenar.value;
        lembrar('ordem', estado.ordem);
        estado.pagina = 1;
        carregarGrade(lista, paginacao);
    });

    // filtro de tags compacto, ao lado da ordem: um botao "Tags" que abre, flutuando por cima da lista, o quadro do
    // Descobrir (pesquisa e as tags dos mangas da Biblioteca). O manga precisa ter todas as escolhidas. Clicar numa tag
    // na pagina de um manga chega aqui com ela ja escolhida
    const botaoDeTags = h('button', {type: 'button', class: 'botao botao-de-tags', 'aria-haspopup': 'true', 'aria-expanded': 'false'});
    const painelDeTags = h('div', {class: 'painel-de-tags', hidden: true});
    const filtroDeTags = h('div', {class: 'filtro-de-tags'}, botaoDeTags, painelDeTags);
    const mostrarBotaoDeTags = () => {
        const quantas = estado.filtroTags.length;
        botaoDeTags.replaceChildren(...[h('span', {'aria-hidden': 'true'}, '🏷 '), 'Tags', quantas ? h('span', {class: 'quantas-tags'}, String(quantas)) : null].filter(Boolean));
        botaoDeTags.classList.toggle('ativo', quantas > 0);
        botaoDeTags.title = quantas ? 'Tags escolhidas: ' + estado.filtroTags.join(', ') : 'Filtrar por tags';
    };
    const abrirPainel = aberto => {
        painelDeTags.hidden = !aberto;
        botaoDeTags.setAttribute('aria-expanded', String(aberto));
        if (aberto) painelDeTags.querySelector('input')?.focus();
    };
    botaoDeTags.addEventListener('click', () => abrirPainel(painelDeTags.hidden));
    // clicar fora ou Esc fecha o painel
    const fecharDeFora = evento => {
        if (!filtroDeTags.isConnected) return document.removeEventListener('pointerdown', fecharDeFora);
        if (!filtroDeTags.contains(evento.target)) abrirPainel(false);
    };
    document.addEventListener('pointerdown', fecharDeFora);
    filtroDeTags.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && !painelDeTags.hidden) {
            abrirPainel(false);
            botaoDeTags.focus();
        }
    });
    mostrarBotaoDeTags();
    const quandoMudarTags = () => {
        estado.pagina = 1;
        mostrarBotaoDeTags();
        // o endereco acompanha (#/tag/{nome}/{nome}), sem recarregar a tela
        history.replaceState(null, '', estado.filtroTags.length ? '#/tag/' + estado.filtroTags.map(encodeURIComponent).join('/') : '#/');
        carregarGrade(lista, paginacao);
    };
    chamar('GET', '/api/tags').then(tags => {
        const emUso = tags.filter(item => item.quantidade > 0).map(item => item.nome);
        // a mesma tag escrita de outro jeito (no endereco) vira o nome da lista
        estado.filtroTags = estado.filtroTags.map(tag => emUso.find(nome => nome.toLowerCase() === tag.toLowerCase()) || tag);
        mostrarBotaoDeTags();
        const todas = [...emUso, ...estado.filtroTags.filter(tag => !emUso.includes(tag))];
        if (todas.length === 0) {
            painelDeTags.replaceChildren(h('p', {class: 'subtitulo'}, 'Seus mangás ainda não têm tags.'));
            return;
        }
        let quadro;
        quadro = quadroDeTags('Tags que quero ver', 'biblioteca', todas, () => estado.filtroTags, lista => { estado.filtroTags = lista; }, () => [], '',
            () => { quadro.desenhar(); quandoMudarTags(); },
            // no painel a lista de tags fica sempre aberta
            {aberta: () => true, mudar: () => {}});
        painelDeTags.replaceChildren(quadro.elemento);
    }).catch(() => {});

    const filtros = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Filtrar por status'});
    const opcoes = [{valor: '', descricao: 'Todos'}, ...estado.status];
    for (const opcao of opcoes) {
        filtros.append(h('button', {
            type: 'button',
            class: 'filtro',
            'aria-pressed': String(estado.filtroStatus === opcao.valor),
            onclick: evento => {
                estado.filtroStatus = opcao.valor;
                for (const botao of filtros.children) botao.setAttribute('aria-pressed', 'false');
                evento.currentTarget.setAttribute('aria-pressed', 'true');
                estado.pagina = 1;
                carregarGrade(lista, paginacao);
            },
        }, opcao.descricao));
    }

    estado.recarregar = () => {
        lista.classList.add('recarregando');
        carregarGrade(lista, paginacao);
    };
    app.replaceChildren(
        abas('todos'),
        h('div', {class: 'ferramentas'},
            busca,
            h('span', {class: 'espaco'}),
            filtroDeTags,
            ordenar,
            h('button', {type: 'button', class: 'botao', onclick: sortear}, '🎲 Sortear')),
        filtros,
        lista,
        paginacao,
        lugarDeBanner('biblioteca-fim', 'horizontal', 'no-fim'));
    carregarGrade(lista, paginacao);
}

/** Botoes para trocar de pagina: anterior, numeros (com "…" quando sao muitos) e proxima. */
function paginador(pagina, paginas, irPara) {
    const numeros = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])].filter(n => n >= 1 && n <= paginas).sort((x, y) => x - y);
    const botoes = [];
    numeros.forEach((numero, i) => {
        if (i > 0 && numero - numeros[i - 1] > 1) botoes.push(h('span', {class: 'reticencias', 'aria-hidden': 'true'}, '…'));
        botoes.push(h('button', {
            type: 'button',
            class: 'botao pequeno',
            'aria-current': numero === pagina ? 'page' : null,
            'aria-label': 'Página ' + numero,
            onclick: () => irPara(numero),
        }, String(numero)));
    });
    return [
        h('button', {type: 'button', class: 'botao pequeno', disabled: pagina <= 1, onclick: () => irPara(pagina - 1)}, '← Anterior'),
        ...botoes,
        h('button', {type: 'button', class: 'botao pequeno', disabled: pagina >= paginas, onclick: () => irPara(pagina + 1)}, 'Próxima →'),
    ];
}

const TAMANHO_DA_PAGINA = 24; // 4 fileiras de 6 colunas
const LISTA_FRESCA_MS = 20000;
// ate este tanto de mangas, a lista inteira fica guardada no navegador e a busca nao espera o servidor; acima
// disso (contas muito grandes), a busca, os filtros e as paginas sao feitos pelo servidor
const LIMITE_DA_LISTA_GUARDADA = 2000;

/** Lista inteira se couber no limite; senao, a primeira pagina (o servidor decide, numa chamada so). */
function enderecoDaLista(ordem) {
    const parametros = new URLSearchParams({resumo: '1', pagina: '1', tamanho: String(TAMANHO_DA_PAGINA), inteiraAte: String(LIMITE_DA_LISTA_GUARDADA)});
    if (ordem && ordem !== 'CADASTRO') parametros.set('ordem', ordem);
    return '/api/mangas?' + parametros;
}

/** Se a resposta trouxe a lista inteira, ela fica guardada; senao, e uma conta grande, e a primeira pagina ja serve. */
function guardarLista(entrada, resposta) {
    entrada.grande = !resposta.inteira;
    entrada.itens = entrada.grande ? null : resposta.itens;
    entrada.quando = Date.now();
    entrada.pedido = null;
    if (entrada.grande) paginasDoServidor.set(enderecoDaPagina(1, entrada.ordem, {}), {resposta, quando: Date.now()});
}

/**
 * A lista inteira, ja ordenada pelo servidor e sem as descricoes (?resumo=1). Fica guardada enquanto o site esta
 * aberto: buscar, filtrar por status ou tag e trocar de pagina acontecem aqui mesmo, sem esperar o servidor.
 * Qualquer alteracao (cadastrar, editar, marcar capitulo...) descarta a lista guardada.
 */
function pedirLista(ordem) {
    const guardada = estado.listaCompleta;
    if (guardada && guardada.ordem === ordem && guardada.pedido) return guardada.pedido;
    const entrada = {ordem, itens: guardada && guardada.ordem === ordem ? guardada.itens : null, quando: 0, pedido: null, grande: false};
    entrada.pedido = chamar('GET', enderecoDaLista(ordem)).then(resposta => {
        if (estado.listaCompleta === entrada) guardarLista(entrada, resposta);
        return entrada;
    }, erro => {
        if (estado.listaCompleta === entrada) estado.listaCompleta = null;
        throw erro;
    });
    estado.listaCompleta = entrada;
    return entrada.pedido;
}

const semAcentos = texto => String(texto || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Os mesmos filtros que o servidor aplica: nome (sem diferenciar acentos), status e tags. */
function filtrarLista(itens) {
    const busca = semAcentos(estado.busca);
    const tags = estado.filtroTags.map(semAcentos);
    return itens.filter(manga => (!estado.filtroStatus || manga.readingStatus === estado.filtroStatus)
        && semAcentos(manga.title).includes(busca)
        // com varias tags escolhidas, o manga precisa ter todas
        && tags.every(tag => (manga.tags || []).some(outra => semAcentos(outra) === tag)));
}

/**
 * Mostra a pagina atual da grade. Se a lista ja estiver guardada, aparece na hora; se estiver guardada ha mais de
 * 20 segundos, aparece na hora e e conferida no servidor por tras, sendo redesenhada so se algo mudou. Em contas
 * grandes, pede ao servidor so a pagina, ja filtrada.
 */
async function carregarGrade(lista, paginacao) {
    const vez = ++estado.render;
    const ordem = estado.ordem || 'CADASTRO';
    const guardada = estado.listaCompleta && estado.listaCompleta.ordem === ordem ? estado.listaCompleta : null;
    if (guardada && guardada.itens) {
        desenharGrade(lista, paginacao, guardada.itens);
        if (guardada.pedido || Date.now() - guardada.quando < LISTA_FRESCA_MS) return;
        const antes = JSON.stringify(guardada.itens);
        try {
            const nova = await pedirLista(ordem);
            if (vez === estado.render && nova.itens && JSON.stringify(nova.itens) !== antes) desenharGrade(lista, paginacao, nova.itens);
            else if (vez === estado.render && nova.grande) carregarGrade(lista, paginacao);
        } catch (e) {
            // continua mostrando a lista guardada
        }
        return;
    }
    let entrada;
    try {
        entrada = guardada && guardada.grande && !guardada.pedido && Date.now() - guardada.quando < LISTA_FRESCA_MS ? guardada : await pedirLista(ordem);
        if (entrada.grande) {
            await carregarPaginaDoServidor(lista, paginacao, vez);
            return;
        }
    } catch (e) {
        if (vez === estado.render) {
            lista.className = '';
            lista.replaceChildren(vazio('Algo deu errado', e.message));
            paginacao.replaceChildren();
        }
        return;
    }
    if (vez === estado.render) desenharGrade(lista, paginacao, entrada.itens);
}

// paginas ja vistas de contas grandes, pelo endereco: voltar a uma delas e instantaneo. Qualquer alteracao esvazia
const paginasDoServidor = new Map();

function enderecoDaPagina(pagina, ordem, {busca = '', status = '', tags = []} = {}) {
    const parametros = new URLSearchParams({resumo: '1', pagina: String(pagina), tamanho: String(TAMANHO_DA_PAGINA)});
    if (busca.trim()) parametros.set('titulo', busca.trim());
    if (status) parametros.set('status', status);
    for (const tag of tags) parametros.append('tag', tag);
    if (ordem && ordem !== 'CADASTRO') parametros.set('ordem', ordem);
    return '/api/mangas?' + parametros;
}

async function pedirPagina(endereco) {
    const resposta = await chamar('GET', endereco);
    paginasDoServidor.set(endereco, {resposta, quando: Date.now()});
    // so as mais recentes
    if (paginasDoServidor.size > 40) paginasDoServidor.delete(paginasDoServidor.keys().next().value);
    return resposta;
}

/**
 * Conta grande: o servidor busca, filtra, ordena e devolve so a pagina aberta. Uma pagina ja vista aparece na hora
 * (e e conferida por tras se tiver mais de 20 segundos); a proxima pagina e pedida antes, com o navegador parado.
 */
async function carregarPaginaDoServidor(lista, paginacao, vez) {
    const filtros = {busca: estado.busca, status: estado.filtroStatus, tags: estado.filtroTags};
    const endereco = enderecoDaPagina(estado.pagina, estado.ordem, filtros);
    const desenhar = resposta => {
        estado.pagina = resposta.pagina;
        desenharGrade(lista, paginacao, resposta.itens, {total: resposta.total, paginas: resposta.paginas});
        if (resposta.pagina < resposta.paginas) adiantarPagina(enderecoDaPagina(resposta.pagina + 1, estado.ordem, filtros));
    };
    const guardada = paginasDoServidor.get(endereco);
    if (guardada) {
        desenhar(guardada.resposta);
        if (Date.now() - guardada.quando < LISTA_FRESCA_MS) return;
    }
    const resposta = await pedirPagina(endereco);
    if (vez !== estado.render) return;
    if (!guardada || JSON.stringify(guardada.resposta) !== JSON.stringify(resposta)) desenhar(resposta);
}

function adiantarPagina(endereco) {
    if (paginasDoServidor.has(endereco)) return;
    const pedir = () => pedirPagina(endereco).then(resposta => adiantarCapas(resposta.itens)).catch(() => {});
    if ('requestIdleCallback' in window) requestIdleCallback(pedir, {timeout: 3000});
    else setTimeout(pedir, 800);
}

/**
 * @param todos     a lista inteira guardada, ou so a pagina, quando ela veio do servidor
 * @param doServidor {total, paginas} quando a pagina ja veio filtrada e cortada pelo servidor
 */
function desenharGrade(lista, paginacao, todos, doServidor) {
    lista.classList.remove('recarregando');
    const filtrando = Boolean(estado.busca.trim() || estado.filtroStatus || estado.filtroTags.length);
    const encontrados = doServidor ? todos : filtrarLista(todos);
    const total = doServidor ? doServidor.total : encontrados.length;
    const paginas = doServidor ? doServidor.paginas : Math.max(1, Math.ceil(encontrados.length / TAMANHO_DA_PAGINA));
    // pagina alem do fim (um manga foi excluido, ou a busca encolheu a lista) vira a ultima
    estado.pagina = Math.min(Math.max(1, estado.pagina), paginas);
    const inicio = doServidor ? 0 : (estado.pagina - 1) * TAMANHO_DA_PAGINA;
    const itens = encontrados.slice(inicio, inicio + TAMANHO_DA_PAGINA);

    if (total === 0) {
        lista.className = '';
        lista.replaceChildren(filtrando
            ? vazio('Nada encontrado', 'Nenhum mangá combina com a busca ou o filtro.')
            : vazio('Sua lista está vazia', 'Adicione o primeiro mangá que você está lendo.',
                h('a', {class: 'botao primario', href: '#/novo'}, '+ Adicionar mangá')));
        paginacao.replaceChildren();
        return;
    }
    lista.className = 'grade';
    estado.ultimaPagina = itens;
    const cartoes = itens.map(cartao);
    // as capas das duas primeiras fileiras vem primeiro e sem esperar a rolagem; o resto, quando chegar perto
    cartoes.forEach((elemento, i) => {
        const img = elemento.querySelector('.capa img');
        if (img && i < 12) {
            img.loading = 'eager';
            if (i < 6) img.setAttribute('fetchpriority', 'high');
        }
    });
    lista.replaceChildren(...cartoes);
    const irPara = pagina => {
        estado.pagina = pagina;
        if (doServidor) carregarGrade(lista, paginacao).then(() => window.scrollTo(0, 0));
        else {
            desenharGrade(lista, paginacao, todos);
            window.scrollTo(0, 0);
        }
    };
    paginacao.replaceChildren(
        ...(paginas > 1 ? paginador(estado.pagina, paginas, irPara) : []),
        h('span', {class: 'total'}, total === 1 ? '1 mangá' : total + ' mangás'));
    if (!doServidor) adiantarCapas(encontrados.slice(inicio + TAMANHO_DA_PAGINA, inicio + 2 * TAMANHO_DA_PAGINA));
    criarMiniaturas(todos);
}

const MINIATURA = {largura: 400, altura: 600, qualidade: 0.8};
const miniaturasTentadas = new Set(lembrado('miniaturas-tentadas', '').split(',').filter(Boolean));
let criandoMiniaturas = false;

/**
 * Cria, por tras e devagar, a miniatura das capas enviadas que ainda nao tem uma: o navegador le a capa, faz uma
 * versao de 400x600 e manda guardar. A capa original continua igual. Na proxima vez, a lista usa a miniatura, que
 * pesa umas 5 vezes menos. Capas que ja sao pequenas ficam como estao (e nao sao tentadas de novo).
 */
function criarMiniaturas(mangas) {
    if (criandoMiniaturas || !('createImageBitmap' in window)) return;
    const pendentes = mangas.filter(manga => !manga.thumbUrl && !/^https?:/i.test(manga.imagePath || '')
        && !/\.gif$/i.test(manga.imagePath || '') && !miniaturasTentadas.has(manga.imagePath));
    if (pendentes.length === 0) return;
    criandoMiniaturas = true;
    const proxima = async () => {
        const manga = pendentes.shift();
        if (!manga || document.hidden) {
            criandoMiniaturas = false;
            return;
        }
        miniaturasTentadas.add(manga.imagePath);
        try {
            const original = await (await fetch(manga.imageUrl)).blob();
            const pequena = await reduzirImagem(original, MINIATURA);
            if (pequena && pequena.size < original.size * 0.7) {
                // fetch direto (e nao chamar): guardar a miniatura nao muda a lista, entao ela continua guardada
                const resposta = await fetch(manga.imageUrl + '/miniatura', {method: 'PUT', headers: {'Content-Type': pequena.type}, body: pequena});
                if (resposta.ok) manga.thumbUrl = (await resposta.json()).thumbUrl;
                else miniaturasTentadas.delete(manga.imagePath); // tenta de novo outra vez
            }
        } catch (e) {
            miniaturasTentadas.delete(manga.imagePath);
        }
        lembrar('miniaturas-tentadas', [...miniaturasTentadas].slice(-500).join(','));
        if ('requestIdleCallback' in window) requestIdleCallback(proxima, {timeout: 2000});
        else setTimeout(proxima, 200);
    };
    // comeca depois de a pagina ja estar na tela, para nao disputar a rede com as capas visiveis
    setTimeout(proxima, 2500);
}

/** Com o navegador parado, ja baixa as capas da proxima pagina: trocar de pagina mostra tudo na hora. */
function adiantarCapas(mangas) {
    if (mangas.length === 0) return;
    const baixar = () => mangas.forEach(manga => {
        const imagem = new Image();
        imagem.decoding = 'async';
        imagem.src = manga.thumbUrl || manga.imageUrl;
    });
    if ('requestIdleCallback' in window) requestIdleCallback(baixar, {timeout: 3000});
    else setTimeout(baixar, 800);
}

function cartao(manga) {
    return h('article', {class: 'cartao'},
        capa(manga, true),
        h('a', {class: 'cartao-titulo', href: '#/manga/' + manga.id, title: manga.title}, manga.title),
        h('div', {class: 'cartao-acoes'},
            h('button', {
                type: 'button',
                class: 'botao pequeno',
                title: 'Alterar o último capítulo lido',
                onclick: () => abrirDialogoProgresso(manga),
            }, h('span', null, 'Cap. ' + mostrarCapitulo(manga.lastChapter))),
            botaoLer(manga, 'pequeno')));
}

function vazio(titulo, texto, acao) {
    return h('div', {class: 'vazio'}, h('strong', null, titulo), texto, acao ? h('div', null, acao) : null);
}

async function sortear() {
    const parametros = estado.filtroStatus ? '?status=' + encodeURIComponent(estado.filtroStatus) : '';
    const atual = estado.sorteado;
    try {
        let manga = await chamar('GET', '/api/mangas/sorteio' + parametros);
        // evita repetir o mesmo quando ha mais de um para escolher
        for (let i = 0; i < 6 && manga.id === atual; i++) {
            manga = await chamar('GET', '/api/mangas/sorteio' + parametros);
        }
        estado.sorteado = manga.id;
        if (location.hash === '#/manga/' + manga.id) rota();
        else location.hash = '#/manga/' + manga.id;
    } catch (e) {
        avisar(e.message, true);
    }
}

// ------------------------------------------------------------------ detalhes

/** Confere no site o link do proximo capitulo e mostra o que encontrou. */
async function verificarLink(manga, botao) {
    botao.disabled = true;
    botao.textContent = 'Verificando…';
    try {
        const resultado = await chamar('POST', '/api/mangas/' + manga.id + '/verificacao-link');
        const deuCerto = resultado.situacao === 'DISPONIVEL' || (resultado.situacao === 'NAO_ENCONTRADO' && resultado.linkMudou);
        avisar(resultado.mensagem, !deuCerto && resultado.situacao !== 'NAO_ENCONTRADO');
        // o link pode ter sido corrigido: mostra o manga de novo, sem o aviso antigo
        if (location.hash === '#/manga/' + manga.id) rota();
        else location.hash = '#/manga/' + manga.id;
    } catch (e) {
        avisar(e.message, true);
        botao.disabled = false;
        botao.textContent = 'Verificar link';
    }
}

/** Aviso mostrado quando o botao "Ler" nao tinha para onde ir (ver /api/mangas/{id}/ler). */
function avisoDeLeitura(manga, aviso) {
    if (aviso === 'sem-capitulo') {
        return h('div', {class: 'sorteado', role: 'status'},
            h('span', null, 'O capítulo ' + mostrarCapitulo(manga.nextChapter) + ' ainda não foi encontrado no site. Ele pode não ter sido lançado.'),
            linkExterno('botao pequeno', manga.lastChapterLink, 'Abrir o último capítulo lido no site',
                'Abrir o capítulo ' + mostrarCapitulo(manga.lastChapter)));
    }
    if (aviso === 'link-quebrado') {
        return h('div', {class: 'sorteado', role: 'status'},
            h('span', null, 'O link deste mangá não abre mais no site. Atualize o link do capítulo.'),
            h('a', {class: 'botao pequeno', href: '#/editar/' + manga.id}, 'Edição geral'));
    }
    return null;
}

async function telaDetalhes(id, aviso) {
    const vez = ++estado.render;
    let manga;
    try {
        manga = await chamar('GET', '/api/mangas/' + encodeURIComponent(id));
    } catch (e) {
        if (vez === estado.render) {
            app.replaceChildren(vazio('Mangá não encontrado', e.message, h('a', {class: 'botao', href: '#/'}, 'Voltar para a lista')));
        }
        return;
    }
    if (vez !== estado.render) return;
    document.title = manga.title + ' · Viracap';
    const semelhantes = h('section', {class: 'recomendacoes', 'aria-live': 'polite'});
    const recomendacoes = h('section', {class: 'recomendacoes', 'aria-live': 'polite'});

    // a nota muda aqui mesmo, sem abrir a edicao
    const nota = seletorDeNota(manga.rating);
    nota.className = 'seletor-de-nota';
    nota.setAttribute('aria-label', 'Minha nota');
    const faixa = h('span', {class: 'faixa-da-nota'}, etiquetaNota(manga.rating, true));
    nota.addEventListener('change', async () => {
        nota.disabled = true;
        try {
            const salvo = await chamar('PUT', '/api/mangas/' + manga.id + '/nota', {rating: nota.value === '' ? null : Number(nota.value)});
            manga.rating = salvo.rating;
            faixa.replaceChildren(...[etiquetaNota(manga.rating, true)].filter(Boolean));
            const naCapa = app.querySelector('.detalhes > .capa');
            if (naCapa) {
                naCapa.querySelectorAll('.nota').forEach(selo => selo.remove());
                const selo = etiquetaNota(manga.rating);
                if (selo) naCapa.append(selo);
            }
            avisar(manga.rating == null ? 'Nota removida' : 'Nota salva');
        } catch (e) {
            avisar(e.message, true);
        }
        nota.value = manga.rating == null ? '' : String(manga.rating);
        nota.disabled = false;
    });

    // favoritar tambem acontece aqui mesmo, sem abrir a edicao
    const favoritar = h('button', {type: 'button', class: 'botao favoritar'});
    const mostrarFavorito = () => {
        favoritar.setAttribute('aria-pressed', String(manga.favorite));
        favoritar.textContent = manga.favorite ? '★ Favorito' : '☆ Favoritar';
        favoritar.title = manga.favorite ? 'Tirar dos favoritos' : 'Marcar como favorito: ele aparece destacado na lista';
        const naCapa = app.querySelector('.detalhes > .capa');
        if (!naCapa) return;
        naCapa.classList.toggle('favorita', manga.favorite);
        // a borda e o efeito da loja so valem nos favoritos
        for (const classe of classesDaLoja(meusEquipados()).trim().split(' ').filter(Boolean)) naCapa.classList.toggle(classe, manga.favorite);
        naCapa.querySelectorAll('.estrela-de-favorito, .enfeite-da-borda, .camada-do-efeito, .luz-da-moldura').forEach(enfeite => enfeite.remove());
        if (manga.favorite) naCapa.append(h('span', {class: 'estrela-de-favorito', title: 'Favorito', 'aria-hidden': 'true'}, '★'), ...enfeiteDaBorda());
    };
    favoritar.addEventListener('click', async () => {
        favoritar.disabled = true;
        try {
            manga.favorite = (await chamar('PUT', '/api/mangas/' + manga.id + '/favorito', {favorite: !manga.favorite})).favorite;
            avisar(manga.favorite ? 'Marcado como favorito' : 'Tirado dos favoritos');
        } catch (e) {
            avisar(e.message, true);
        }
        mostrarFavorito();
        favoritar.disabled = false;
    });
    mostrarFavorito();

    // a pagina do manga fica no meio da tela (doc 93); os banners: verticais nas laterais ou, sem espaco, horizontais
    // entre as informacoes e as listas e no fim (doc 95)
    const paginaDoManga = h('div', {class: 'pagina-do-manga'});
    app.replaceChildren(paginaDoManga, ...trilhosDeBanner(paginaDoManga, 'manga'));
    // (as partes que nao aparecem vem nulas: o filter tira, para nao virarem o texto "null")
    paginaDoManga.append(...[
        h('a', {class: 'voltar', href: '#/'}, '← Todos os mangás'),
        avisoDeLeitura(manga, aviso),
        estado.sorteado === manga.id
            ? h('div', {class: 'sorteado'},
                h('span', null, '🎲 Este foi o sorteado!'),
                h('button', {type: 'button', class: 'botao pequeno', onclick: sortear}, 'Sortear outro'))
            : null,
        h('div', {class: 'detalhes'},
            capa(manga, false),
            h('div', {class: 'detalhes-info'},
                h('h1', null, manga.title),
                h('div', {class: 'linha'},
                    etiquetaStatus(manga.readingStatus),
                    h('span', {class: 'capitulo-atual'}, 'Último capítulo lido: ', h('b', null, mostrarCapitulo(manga.lastChapter))),
                    manga.releaseDay
                        ? h('span', {class: 'capitulo-atual'}, '· Capítulo novo: ', h('b', null, descricaoDia(manga.releaseDay)))
                        : null),
                h('div', {class: 'linha'}, h('span', {class: 'capitulo-atual'}, 'Minha nota:'), nota, faixa),
                manga.tags.length
                    ? h('div', {class: 'linha'}, manga.tags.map(tag => h('a', {
                        class: 'tag',
                        href: '#/tag/' + encodeURIComponent(tag),
                        title: 'Ver os mangás da sua lista com a tag ' + tag,
                    }, tag)))
                    : null,
                h('div', {class: 'linha'},
                    botaoLer(manga),
                    h('button', {type: 'button', class: 'botao', onclick: () => abrirDialogoProgresso(manga)}, 'Alterar capítulo'),
                    favoritar),
                manga.description
                    ? h('p', {class: 'descricao'}, manga.description)
                    : h('p', {class: 'descricao sem'}, 'Sem descrição.'),
                h('div', {class: 'linha'},
                    h('a', {class: 'botao', href: '#/editar/' + manga.id}, 'Edição geral'),
                    h('button', {
                        type: 'button',
                        class: 'botao',
                        title: 'Abre o site e confere se o link do próximo capítulo está certo',
                        onclick: evento => verificarLink(manga, evento.currentTarget),
                    }, 'Verificar link'),
                    h('button', {type: 'button', class: 'botao perigo', onclick: () => excluir(manga)}, 'Excluir')))),
        lugarDeBanner('manga-meio', 'horizontal', 'so-sem-trilhos'),
        semelhantes,
        recomendacoes,
        lugarDeBanner('manga-fim', 'horizontal', 'so-sem-trilhos no-fim')].filter(Boolean));
    carregarSemelhantes(manga, semelhantes, vez);
    carregarRecomendacoes(manga, recomendacoes, vez);
}

/** Mangas da propria lista que dividem tags com este. Sem tags em comum com ninguem, a secao nao aparece. */
async function carregarSemelhantes(manga, secao, vez) {
    if (manga.tags.length === 0) return;
    let lista;
    try {
        lista = await chamar('GET', '/api/mangas/' + manga.id + '/semelhantes');
    } catch (e) {
        return;
    }
    if (vez !== estado.render || !Array.isArray(lista) || lista.length === 0) return;
    const emComum = outro => outro.tags.filter(tag => manga.tags.some(minha => minha.toLowerCase() === tag.toLowerCase()));
    secao.replaceChildren(
        h('h2', null, 'Na sua lista, com tags em comum'),
        h('p', {class: 'subtitulo'}, 'Os que dividem mais tags com este aparecem primeiro.'),
        h('div', {class: 'grade'}, lista.map(outro => h('article', {class: 'cartao'},
            capa(outro, true),
            h('a', {class: 'cartao-titulo', href: '#/manga/' + outro.id, title: outro.title}, outro.title),
            h('small', {class: 'generos'}, emComum(outro).slice(0, 3).join(' · '))))));
}

// ------------------------------------------------------------------ aba Descobrir

/**
 * Busca geral de mangas para ler, fora da lista: por nome, pelas tags que quero (a obra precisa ter todas as
 * marcadas), sem as tags que nao quero (a obra nao pode ter nenhuma) e em varias ordens. Quem ja esta cadastrado
 * nao aparece.
 */
async function telaDescobrir() {
    const vez = ++estado.render;
    const escolhas = estado.descobrir;
    document.title = 'Descobrir · Viracap';
    let todasAsTags = [];
    try {
        // as que ja uso vem primeiro; as outras tambem entram, porque o que nao quero ler quase nunca esta na lista
        const tags = await chamar('GET', '/api/tags');
        todasAsTags = [...tags.filter(tag => tag.quantidade > 0), ...tags.filter(tag => !(tag.quantidade > 0))].map(tag => tag.nome);
    } catch (e) {
        // sem as tags ainda da para buscar por nome
    }
    if (vez !== estado.render) return;
    escolhas.tags = escolhas.tags.filter(tag => todasAsTags.includes(tag));
    escolhas.sem = escolhas.sem.filter(tag => todasAsTags.includes(tag) && !escolhas.tags.includes(tag));

    const lista = h('div', {class: 'grade'});
    const aviso = h('p', {class: 'subtitulo', 'aria-live': 'polite'});
    const paginacao = h('nav', {class: 'paginacao', 'aria-label': 'Páginas'});
    const carregar = () => carregarDescobertas(lista, aviso, paginacao);

    const busca = h('input', {type: 'search', placeholder: 'Buscar pelo nome…', 'aria-label': 'Buscar pelo nome', value: escolhas.busca});
    busca.addEventListener('input', () => {
        escolhas.busca = busca.value;
        escolhas.pagina = 1;
        // com um nome digitado, o mais util e ver primeiro o que mais combina com ele
        if (busca.value.trim() && escolhas.ordem === 'POPULARIDADE') ordenar.value = escolhas.ordem = 'RELEVANCIA';
        if (!busca.value.trim() && escolhas.ordem === 'RELEVANCIA') ordenar.value = escolhas.ordem = 'POPULARIDADE';
        clearTimeout(estado.esperaDaBusca);
        estado.esperaDaBusca = setTimeout(carregar, 350);
    });
    const ordenar = seletor(estado.ordensDeDescoberta, escolhas.ordem);
    ordenar.setAttribute('aria-label', 'Ordenar por');
    ordenar.className = 'ordenar';
    ordenar.addEventListener('change', () => {
        escolhas.ordem = ordenar.value;
        escolhas.pagina = 1;
        carregar();
    });

    // os dois quadros se redesenham juntos: uma tag marcada em um fica travada no outro
    const quadros = [];
    const mudou = () => {
        quadros.forEach(quadro => quadro.desenhar());
        escolhas.pagina = 1;
        carregar();
    };
    // a lista de tags dos dois quadros abre e fecha junta, para os dois ficarem sempre da mesma altura
    const abertura = {
        aberta: () => escolhas.tagsAbertas,
        mudar: aberta => {
            if (escolhas.tagsAbertas === aberta) return;
            escolhas.tagsAbertas = aberta;
            quadros.forEach(quadro => quadro.desenhar());
        },
    };
    quadros.push(
        quadroDeTags('Quero com estas tags', 'quero', todasAsTags, () => escolhas.tags, lista => escolhas.tags = lista, () => escolhas.sem, 'Já está em “Não quero”', mudou, abertura),
        quadroDeTags('Não quero com estas tags', 'nao-quero', todasAsTags, () => escolhas.sem, lista => escolhas.sem = lista, () => escolhas.tags, 'Já está em “Quero”', mudou, abertura));

    app.replaceChildren(
        abas('descobrir'),
        h('div', {class: 'ferramentas'}, busca, h('span', {class: 'espaco'}), ordenar),
        todasAsTags.length ? h('div', {class: 'quadros-de-tags'}, quadros.map(quadro => quadro.elemento)) : null,
        aviso,
        lugarDeBanner('descobrir-topo', 'horizontal', 'so-sem-trilhos'),
        lista,
        paginacao,
        ...trilhosDeBanner(lista, 'descobrir'));
    carregar();
}

/**
 * Quadro para escolher tags: as marcadas ficam em cima (o × tira), um campo filtra pelo nome e a lista rola para
 * baixo. As tags marcadas no outro quadro aparecem travadas, porque uma tag nao pode ser pedida e excluida ao mesmo tempo.
 * A lista pode ficar recolhida, sobrando so o campo de pesquisa; comecar a digitar abre de novo. "abertura" e
 * dividida entre os quadros, entao abrir ou recolher um faz o mesmo com o outro.
 */
function quadroDeTags(titulo, tipo, todas, ler, gravar, lerDoOutro, motivoDaTrava, aoMudar, abertura) {
    const simples = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const marcadas = h('div', {class: 'tags-marcadas'});
    const opcoes = h('div', {class: 'opcoes-de-tag', id: 'opcoes-' + tipo, role: 'group', 'aria-label': titulo});
    const recolher = h('button', {type: 'button', class: 'recolher-tags', 'aria-controls': 'opcoes-' + tipo, onclick: () => abertura.mudar(!abertura.aberta())});
    const campo = h('input', {type: 'search', placeholder: 'Pesquisar tag…', 'aria-label': 'Pesquisar tag em “' + titulo + '”'});
    const limpar = h('button', {type: 'button', class: 'limpar-tags', onclick: () => { gravar([]); aoMudar(); }}, 'Limpar');
    const alternar = nome => {
        if (lerDoOutro().includes(nome)) return;
        gravar(ler().includes(nome) ? ler().filter(outra => outra !== nome) : [...ler(), nome]);
        aoMudar();
    };
    const visiveis = () => todas.filter(nome => simples(nome).includes(simples(campo.value)));
    const desenhar = () => {
        marcadas.replaceChildren(...ler().map(nome => h('span', {class: 'tag escolhida'}, nome,
            h('button', {type: 'button', 'aria-label': 'Tirar ' + nome, onclick: () => alternar(nome)}, '×'))));
        limpar.hidden = ler().length === 0;
        opcoes.hidden = !abertura.aberta();
        recolher.textContent = abertura.aberta() ? 'Esconder tags ▴' : 'Mostrar tags ▾';
        recolher.setAttribute('aria-expanded', String(abertura.aberta()));
        const lista = visiveis();
        opcoes.replaceChildren(...(lista.length ? lista.map(nome => {
            const travada = lerDoOutro().includes(nome);
            return h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(ler().includes(nome)), disabled: travada,
                title: travada ? motivoDaTrava : null, onclick: () => alternar(nome)}, nome);
        }) : [h('span', {class: 'sem-tag'}, 'Nenhuma tag com esse nome.')]));
    };
    campo.addEventListener('input', () => {
        // pesquisar abre a lista (dos dois quadros); apagar o texto nao fecha, quem fecha e o botao
        if (campo.value.trim() && !abertura.aberta()) abertura.mudar(true); else desenhar();
    });
    // Enter marca a primeira tag que sobrou na pesquisa e deixa o campo pronto para a proxima
    campo.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        const primeira = campo.value.trim() ? visiveis().find(nome => !lerDoOutro().includes(nome)) : null;
        if (!primeira) return;
        campo.value = '';
        if (ler().includes(primeira)) desenhar(); else alternar(primeira);
    });
    desenhar();
    return {
        desenhar,
        elemento: h('section', {class: 'quadro-de-tags ' + tipo}, h('header', null, h('h3', null, titulo), limpar, recolher), marcadas, campo, opcoes),
    };
}

async function carregarDescobertas(lista, aviso, paginacao) {
    const vez = ++estado.render;
    const escolhas = estado.descobrir;
    const parametros = new URLSearchParams({ordem: escolhas.ordem, pagina: escolhas.pagina});
    if (escolhas.busca.trim()) parametros.set('busca', escolhas.busca.trim());
    if (escolhas.tags.length) parametros.set('tags', escolhas.tags.join(','));
    if (escolhas.sem.length) parametros.set('sem', escolhas.sem.join(','));
    aviso.textContent = 'Buscando…';

    let resposta;
    try {
        resposta = await chamar('GET', '/api/recomendacoes?' + parametros);
    } catch (e) {
        if (vez === estado.render) {
            lista.className = '';
            lista.replaceChildren(vazio('Algo deu errado', e.message));
            aviso.textContent = '';
            paginacao.replaceChildren();
        }
        return;
    }
    if (vez !== estado.render) return;

    const avisos = [];
    if (escolhas.tags.length > 1) avisos.push('Mostrando obras que têm todas as tags de “Quero”.');
    if (escolhas.sem.length) avisos.push('Obras com qualquer tag de “Não quero” ficam de fora.');
    if (resposta.tagsIgnoradas.length) {
        avisos.push('A fonte da busca não tem ' + (resposta.tagsIgnoradas.length === 1 ? 'a tag ' : 'as tags ')
            + resposta.tagsIgnoradas.map(tag => '“' + tag + '”').join(', ') + '; a busca foi feita sem ' + (resposta.tagsIgnoradas.length === 1 ? 'ela.' : 'elas.'));
    }
    if (resposta.ocultos) {
        avisos.push(resposta.ocultos === 1 ? '1 obra desta página já está na sua lista e foi escondida.' : resposta.ocultos + ' obras desta página já estão na sua lista e foram escondidas.');
    }
    aviso.textContent = avisos.join(' ');

    if (resposta.itens.length === 0) {
        lista.className = '';
        lista.replaceChildren(resposta.ocultos
            ? vazio('Tudo desta página já está na sua lista', 'Vá para a próxima página ou mude a busca.')
            : vazio('Nada encontrado', 'Tente outro nome ou menos tags.'));
    } else {
        lista.className = 'grade';
        lista.replaceChildren(...resposta.itens.map(obra => cartaoDeObra(obra)));
    }
    const irPara = pagina => {
        escolhas.pagina = pagina;
        carregarDescobertas(lista, aviso, paginacao).then(() => window.scrollTo(0, 0));
    };
    // a fonte nao diz quantas paginas existem, so se ha uma proxima
    paginacao.replaceChildren(...(resposta.pagina > 1 || resposta.temMais ? [
        h('button', {type: 'button', class: 'botao pequeno', disabled: resposta.pagina <= 1, onclick: () => irPara(resposta.pagina - 1)}, '← Anterior'),
        h('span', {class: 'total'}, 'Página ' + resposta.pagina),
        h('button', {type: 'button', class: 'botao pequeno', disabled: !resposta.temMais, onclick: () => irPara(resposta.pagina + 1)}, 'Próxima →'),
    ] : []));
}

/** Cartao de uma obra que ainda nao esta na lista: capa e nome abrem a pagina dela no AniList; "+ Adicionar" abre o cadastro. */
function cartaoDeObra(obra) {
    const imagem = obra.capa
        ? h('img', {src: obra.capa, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer'})
        : h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, obra.titulo.charAt(0).toUpperCase());
    const adicionar = new URLSearchParams({t: obra.titulo, i: obra.capa || '', g: (obra.tags || []).join(',')});
    const detalhes = [obra.nota != null ? '★ ' + (obra.nota / 10).toFixed(1).replace('.', ',') : null, obra.ano, ...obra.generos.slice(0, 2)].filter(Boolean);
    return h('article', {class: 'cartao'},
        h('a', {class: 'capa', href: obra.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': obra.titulo + ' (abre o AniList)'}, imagem),
        h('a', {class: 'cartao-titulo', href: obra.link, target: '_blank', rel: 'noopener noreferrer', title: obra.titulo}, obra.titulo),
        h('small', {class: 'generos'}, detalhes.join(' · ')),
        h('a', {class: 'botao pequeno', href: '#/novo?' + adicionar}, '+ Adicionar'));
}

/**
 * Mangas parecidos com este que ainda nao estao na lista. Chegam da internet depois de a pagina ja estar
 * na tela, para nao atrasar o que importa; se nao houver nenhum, a secao simplesmente nao aparece.
 */
async function carregarRecomendacoes(manga, secao, vez) {
    let lista;
    try {
        lista = await chamar('GET', '/api/mangas/' + manga.id + '/recomendacoes');
    } catch (e) {
        return;
    }
    if (vez !== estado.render || !Array.isArray(lista) || lista.length === 0) return;
    secao.replaceChildren(
        h('h2', null, 'Parecidos com este, para ler depois'),
        h('p', {class: 'subtitulo'}, 'Buscados na internet pelo título e pelas tags deste mangá. Nenhum deles está na sua lista.'),
        h('div', {class: 'grade'}, lista.map(recomendado => {
            const imagem = recomendado.capa
                ? h('img', {src: recomendado.capa, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer'})
                : h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, recomendado.titulo.charAt(0).toUpperCase());
            const adicionar = new URLSearchParams({t: recomendado.titulo, i: recomendado.capa || '', g: (recomendado.tags || []).join(',')});
            return h('article', {class: 'cartao'},
                h('a', {class: 'capa', href: recomendado.link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': recomendado.titulo + ' (abre o AniList)'}, imagem),
                h('a', {class: 'cartao-titulo', href: recomendado.link, target: '_blank', rel: 'noopener noreferrer', title: recomendado.titulo}, recomendado.titulo),
                h('small', {class: 'generos'}, recomendado.generos.slice(0, 3).join(' · ')),
                h('a', {class: 'botao pequeno', href: '#/novo?' + adicionar}, '+ Adicionar'));
        })));
}

async function excluir(manga) {
    if (!confirm('Excluir "' + manga.title + '"? Isso não pode ser desfeito.')) return;
    try {
        await chamar('DELETE', '/api/mangas/' + manga.id);
        avisar('Mangá excluído');
        location.hash = '#/';
    } catch (e) {
        avisar(e.message, true);
    }
}

// ------------------------------------------------------------------ alterar capitulo e status

function abrirDialogoProgresso(manga) {
    const capitulo = h('input', {
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        'aria-label': 'Último capítulo lido',
        value: mostrarCapitulo(manga.lastChapter),
    });
    const status = seletor(estado.status, manga.readingStatus);
    const link = h('input', {type: 'url', autocomplete: 'off', placeholder: 'Cole o endereço da página do capítulo'});
    const erro = h('div', {class: 'erro', role: 'alert', hidden: true});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');
    // colar o link ja preenche o numero do capitulo
    link.addEventListener('input', () => {
        const numero = capituloDoLink(link.value.trim());
        if (numero != null) capitulo.value = mostrarCapitulo(numero);
    });

    const passo = quanto => {
        const atual = lerCapitulo(capitulo.value);
        if (atual == null) return;
        // de 48,5 para 49 (e nao 49,5): o proximo capitulo e sempre o proximo inteiro
        const novo = quanto > 0 ? Math.floor(atual) + 1 : Math.ceil(atual) - 1;
        capitulo.value = mostrarCapitulo(Math.max(0, novo));
    };

    const dialogo = h('dialog', null,
        h('form', {method: 'dialog'},
            h('h2', null, manga.title),
            h('div', {class: 'campo'},
                h('span', null, 'Último capítulo lido'),
                h('div', {class: 'passos'},
                    h('button', {type: 'button', class: 'botao', 'aria-label': 'Um capítulo a menos', onclick: () => passo(-1)}, '−'),
                    capitulo,
                    h('button', {type: 'button', class: 'botao', 'aria-label': 'Um capítulo a mais', onclick: () => passo(1)}, '+'))),
            h('label', {class: 'campo'}, h('span', null, 'Status'), status),
            h('label', {class: 'campo'}, h('span', null, 'Link do capítulo lido (opcional)'), link,
                h('small', null, 'Para sites em que o link muda a cada capítulo.')),
            erro,
            h('div', {class: 'acoes-form'},
                h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'),
                salvar)));

    dialogo.querySelector('form').addEventListener('submit', async evento => {
        evento.preventDefault();
        const numero = lerCapitulo(capitulo.value);
        const endereco = link.value.trim();
        if (numero == null) {
            erro.textContent = 'Digite um capítulo válido, como 48 ou 48,5';
            erro.hidden = false;
            return;
        }
        if (endereco && !ehLinkHttp(endereco)) {
            erro.textContent = 'O link precisa começar com http:// ou https://';
            erro.hidden = false;
            return;
        }
        salvar.disabled = true;
        try {
            if (endereco) {
                await chamar('POST', '/api/mangas/' + manga.id + '/capitulo-lido', {lastChapter: numero, lastChapterUrl: endereco});
                if (status.value !== manga.readingStatus) {
                    await chamar('PATCH', '/api/mangas/' + manga.id + '/progresso', {readingStatus: status.value});
                }
            } else {
                await chamar('PATCH', '/api/mangas/' + manga.id + '/progresso', {lastChapter: numero, readingStatus: status.value});
            }
            dialogo.close();
            avisar('Progresso salvo');
            // nas listas so recarrega os cartoes, para a pagina nao pular para o topo
            if (estado.recarregar) estado.recarregar();
            else rota();
        } catch (e) {
            erro.textContent = e.message;
            erro.hidden = false;
            salvar.disabled = false;
        }
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    capitulo.select();
}

function seletor(opcoes, escolhido) {
    const select = h('select', null, opcoes.map(o => h('option', {value: o.valor}, o.descricao)));
    select.value = escolhido;
    return select;
}

// ------------------------------------------------------------------ cadastro e edicao geral

/**
 * Diminui a capa antes de enviar: no maximo 600x900 (o dobro do tamanho em que ela aparece, para telas de alta
 * resolucao), em WebP ou JPEG. Capas grandes chegam a pesar 10 vezes mais e atrasam a lista inteira. Se o
 * navegador nao conseguir ler a imagem, ou se a versao reduzida nao ficar menor, envia a original. GIFs vao como
 * estao, para nao perder a animacao.
 */
async function reduzirCapa(arquivo) {
    if (!arquivo || arquivo.type === 'image/gif' || !('createImageBitmap' in window)) return arquivo;
    try {
        const reduzida = await reduzirImagem(arquivo, {largura: 600, altura: 900, qualidade: 0.86});
        if (!reduzida || reduzida.size >= arquivo.size) return arquivo;
        return new File([reduzida], 'capa.' + (reduzida.type === 'image/webp' ? 'webp' : 'jpg'), {type: reduzida.type});
    } catch (e) {
        return arquivo;
    }
}

/** A imagem cabendo em largura x altura (sem aumentar), em WebP, ou JPEG se o navegador nao gravar WebP. */
async function reduzirImagem(arquivo, {largura, altura, qualidade}) {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, largura / imagem.width, altura / imagem.height);
    const tela = document.createElement('canvas');
    tela.width = Math.max(1, Math.round(imagem.width * escala));
    tela.height = Math.max(1, Math.round(imagem.height * escala));
    const pincel = tela.getContext('2d');
    pincel.imageSmoothingQuality = 'high';
    pincel.drawImage(imagem, 0, 0, tela.width, tela.height);
    imagem.close();
    const gerar = tipo => new Promise(ok => tela.toBlob(ok, tipo, qualidade));
    const reduzida = await gerar('image/webp');
    // navegadores que nao sabem gravar WebP devolvem PNG: nesse caso, JPEG
    return reduzida && reduzida.type === 'image/webp' ? reduzida : gerar('image/jpeg');
}

/**
 * Campo de tags do cadastro: as escolhidas viram etiquetas com um X, e o campo de texto sugere as tags da
 * lista geral enquanto se digita. Um nome que ainda nao existe pode ser criado na hora (Enter ou virgula).
 * Devolve { elemento, valores(), adicionar(nome), vazio() }.
 */
function seletorDeTags(tagsGerais, iniciais) {
    const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const escolhidas = [];
    let sugestoes = [];
    let ativa = -1;

    const etiquetas = h('span', {class: 'etiquetas'});
    const campo = h('input', {
        type: 'text',
        id: 'campo-tags',
        role: 'combobox',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'Adicionar tag…',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
        'aria-controls': 'campo-tags-sugestoes',
    });
    const lista = h('ul', {id: 'campo-tags-sugestoes', class: 'sugestoes', role: 'listbox', 'aria-label': 'Tags', hidden: true});
    const elemento = h('div', {class: 'seletor-tags busca-manga'}, h('div', {class: 'caixa-tags'}, etiquetas, campo), lista);

    const fechar = () => {
        lista.hidden = true;
        ativa = -1;
        campo.setAttribute('aria-expanded', 'false');
        campo.removeAttribute('aria-activedescendant');
    };
    const desenhar = () => {
        etiquetas.replaceChildren(...escolhidas.map(nome => h('span', {class: 'tag escolhida'}, nome,
            h('button', {
                type: 'button',
                'aria-label': 'Tirar a tag ' + nome,
                onclick: () => {
                    escolhidas.splice(escolhidas.indexOf(nome), 1);
                    desenhar();
                    campo.focus();
                },
            }, '×'))));
    };
    const adicionar = nome => {
        const limpo = String(nome || '').replace(/\s+/g, ' ').trim();
        if (!limpo || escolhidas.some(escolhida => igual(escolhida, limpo))) return;
        // se a tag ja existe na lista geral, vale o nome de la ("action" vira "Action")
        const existente = tagsGerais.find(tag => igual(tag.nome, limpo));
        escolhidas.push(existente ? existente.nome : limpo);
        desenhar();
    };
    const destacar = indice => {
        ativa = indice;
        for (const item of lista.querySelectorAll('[role=option]')) {
            item.setAttribute('aria-selected', String(item.id === 'campo-tags-opcao-' + ativa));
        }
        const destacada = ativa >= 0 ? document.getElementById('campo-tags-opcao-' + ativa) : null;
        if (destacada) {
            campo.setAttribute('aria-activedescendant', destacada.id);
            destacada.scrollIntoView({block: 'nearest'});
        } else {
            campo.removeAttribute('aria-activedescendant');
        }
    };
    const usar = nome => {
        adicionar(nome);
        campo.value = '';
        mostrar();
    };
    const mostrar = () => {
        const digitado = campo.value.replace(/\s+/g, ' ').trim();
        const livres = tagsGerais.filter(tag => !escolhidas.some(escolhida => igual(escolhida, tag.nome)));
        // a lista geral ja vem com as mais usadas primeiro; quem comeca com o texto digitado sobe
        sugestoes = livres
            .filter(tag => tag.nome.toLowerCase().includes(digitado.toLowerCase()))
            .sort((a, b) => b.nome.toLowerCase().startsWith(digitado.toLowerCase()) - a.nome.toLowerCase().startsWith(digitado.toLowerCase()))
            .slice(0, 8)
            .map(tag => ({nome: tag.nome, detalhe: tag.quantidade > 0 ? tag.quantidade + (tag.quantidade === 1 ? ' mangá' : ' mangás') : ''}));
        const jaExiste = [...tagsGerais.map(tag => tag.nome), ...escolhidas].some(nome => igual(nome, digitado));
        if (digitado && !jaExiste) sugestoes.push({nome: digitado, nova: true});
        if (sugestoes.length === 0) return fechar();
        lista.replaceChildren(...sugestoes.map((sugestao, i) => h('li', {
            id: 'campo-tags-opcao-' + i,
            class: sugestao.nova ? 'novo' : null,
            role: 'option',
            'aria-selected': 'false',
            // mousedown, e nao click: acontece antes de o campo perder o foco e fechar a lista
            onmousedown: evento => {
                evento.preventDefault();
                usar(sugestao.nome);
            },
        }, h('span', null, sugestao.nova ? '+ Criar a tag “' + sugestao.nome + '”' : sugestao.nome), h('small', null, sugestao.detalhe || ''))));
        lista.hidden = false;
        campo.setAttribute('aria-expanded', 'true');
        // digitando, Enter pega a primeira opcao (a tag que combina, ou criar a nova)
        destacar(digitado ? 0 : -1);
    };

    campo.addEventListener('input', () => {
        // virgula tambem confirma, para quem esta acostumado a separar assim
        if (campo.value.includes(',')) {
            const partes = campo.value.split(',');
            partes.slice(0, -1).forEach(adicionar);
            campo.value = partes.at(-1);
        }
        mostrar();
    });
    campo.addEventListener('focus', mostrar);
    campo.addEventListener('blur', () => {
        fechar();
    });
    campo.addEventListener('keydown', evento => {
        if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            if (lista.hidden) return mostrar();
            const passo = evento.key === 'ArrowDown' ? 1 : -1;
            destacar(ativa < 0 ? (passo > 0 ? 0 : sugestoes.length - 1) : (ativa + passo + sugestoes.length) % sugestoes.length);
        } else if (evento.key === 'Enter') {
            // nunca envia o formulario de dentro do campo de tags
            evento.preventDefault();
            if (!lista.hidden && ativa >= 0) usar(sugestoes[ativa].nome);
            else if (campo.value.trim()) usar(campo.value);
        } else if (evento.key === 'Escape' && !lista.hidden) {
            evento.preventDefault();
            fechar();
        } else if (evento.key === 'Backspace' && campo.value === '' && escolhidas.length > 0) {
            escolhidas.pop();
            desenhar();
            mostrar();
        }
    });

    (iniciais || []).forEach(adicionar);
    return {
        elemento,
        adicionar,
        vazio: () => escolhidas.length === 0,
        // o que ficou digitado sem confirmar tambem conta, para ninguem perder uma tag por esquecer do Enter
        valores: () => {
            if (campo.value.trim()) {
                adicionar(campo.value);
                campo.value = '';
            }
            return [...escolhidas];
        },
    };
}

/** Busca na internet a descricao pelo titulo e coloca no campo, avisando de onde veio. */
async function preencherDescricao(titulo, descricao, aviso, substituir, aoAcharTags) {
    if (!titulo.trim()) {
        aviso.textContent = 'Preencha o título para buscar a descrição.';
        return;
    }
    aviso.textContent = 'Buscando a descrição na internet…';
    let sinopse;
    try {
        sinopse = await chamar('GET', '/api/sinopse?titulo=' + encodeURIComponent(titulo.trim()));
    } catch (e) {
        aviso.textContent = 'Não encontrei uma descrição para esse título. Escreva a sua, se quiser.';
        return;
    }
    if (aoAcharTags && Array.isArray(sinopse.tags)) aoAcharTags(sinopse.tags);
    // quem ja escreveu algo enquanto a busca corria nao perde o que escreveu
    if (descricao.value.trim() && !substituir) {
        aviso.textContent = '';
        return;
    }
    descricao.value = sinopse.descricao;
    aviso.textContent = 'Descrição de “' + sinopse.tituloEncontrado + '”, do ' + sinopse.fonte
        + (sinopse.traduzida ? ', traduzida automaticamente' : '')
        + (sinopse.idioma === 'en' ? ' (só encontrei em inglês)' : '')
        + '. Confira se é a obra certa.';
}

/**
 * @param consulta dados capturados da pagina de um capitulo (u = endereco, t = titulo da pagina, i = capa,
 *                 p = proximo capitulo), para o cadastro de um manga novo ja vir preenchido
 */
async function telaFormulario(id, consulta) {
    const vez = ++estado.render;
    const capturado = new URLSearchParams(id ? '' : consulta || '');
    const paginaLida = ehLinkHttp(capturado.get('u') || '') ? capturado.get('u').trim() : null;
    const capituloLido = paginaLida ? capituloDoTitulo([capturado.get('t'), capturado.get('o')]) ?? capituloDoLink(paginaLida) : null;
    const imagemInformada = ehLinkHttp(capturado.get('i') || '') ? capturado.get('i').trim() : '';
    let pronto = paginaLida && {
        titulo: tituloDoManga([capturado.get('t'), capturado.get('o')], paginaLida),
        link: modeloDoLink(paginaLida, capituloLido),
        capitulo: capituloLido == null ? '' : mostrarCapitulo(capituloLido),
        imagem: imagemInformada,
        proximo: ehLinkHttp(capturado.get('p') || '') ? capturado.get('p').trim() : null,
    };
    // vindo de uma recomendacao: so o nome e a capa sao conhecidos; o link de leitura e com quem cadastra
    const recomendado = !id && !paginaLida && (capturado.get('t') || '').trim() !== '';
    if (recomendado) {
        pronto = {titulo: capturado.get('t').trim().slice(0, 200), link: '', capitulo: '0', imagem: imagemInformada, proximo: null};
    }
    let manga = null;
    if (id) {
        try {
            manga = await chamar('GET', '/api/mangas/' + encodeURIComponent(id));
        } catch (e) {
            if (vez === estado.render) {
                app.replaceChildren(vazio('Mangá não encontrado', e.message, h('a', {class: 'botao', href: '#/'}, 'Voltar para a lista')));
            }
            return;
        }
        if (vez !== estado.render) return;
    }
    // lista geral de tags, para escolher em vez de digitar de novo (sem ela o campo ainda deixa criar)
    let tagsGerais = [];
    try {
        tagsGerais = await chamar('GET', '/api/tags');
    } catch (e) {
        // segue sem sugestoes
    }
    if (vez !== estado.render) return;
    const voltarPara = manga ? '#/manga/' + manga.id : '#/';
    const imagemDeFora = manga && /^https?:\/\//i.test(manga.imagePath);

    const titulo = h('input', {type: 'text', required: true, maxlength: '200', value: manga ? manga.title : pronto ? pronto.titulo : ''});
    const link = h('input', {
        type: 'url',
        required: true,
        placeholder: 'https://site.com/manga/solo-leveling/capitulo-{cap}',
        value: manga ? manga.chapterLinkModel : pronto ? pronto.link : '',
    });
    const formato = seletor(estado.formatos.map(f => ({valor: f.valor, descricao: f.descricao.replace('X', '48')})),
        manga ? manga.decimalFormat : 'HIFEN');
    const capitulo = h('input', {type: 'text', inputmode: 'decimal', required: true, autocomplete: 'off', value: manga ? mostrarCapitulo(manga.lastChapter) : pronto && pronto.capitulo ? pronto.capitulo : '0'});
    const status = seletor(estado.status, manga ? manga.readingStatus : recomendado ? 'LER' : 'LENDO');
    const dia = seletor([{valor: '', descricao: 'Sem dia definido'}, ...estado.dias], manga && manga.releaseDay ? manga.releaseDay : '');
    const nota = seletorDeNota(manga ? manga.rating : null);
    const avisoDia = h('small');
    // o dia de lancamento so existe para o que estou lendo
    const ajustarDia = () => {
        const lendo = status.value === 'LENDO';
        dia.disabled = !lendo;
        if (!lendo) dia.value = '';
        avisoDia.textContent = lendo ? 'Aparece na aba “Lançam hoje” nesse dia.' : 'Só para mangás com status Lendo.';
    };
    status.addEventListener('change', ajustarDia);
    ajustarDia();
    const tags = seletorDeTags(tagsGerais, manga ? manga.tags : (capturado.get('g') || '').split(','));
    // tags sugeridas pela internet so entram se nenhuma foi escolhida ainda
    const sugerirTags = sugeridas => {
        if (tags.vazio()) sugeridas.forEach(tags.adicionar);
    };
    const descricao = h('textarea', {maxlength: '5000'}, manga ? manga.description : '');
    const avisoDescricao = h('small', {'aria-live': 'polite'});
    const buscarDescricao = h('button', {
        type: 'button',
        class: 'botao pequeno',
        onclick: () => {
            if (descricao.value.trim() && !confirm('Substituir a descrição atual pela encontrada na internet?')) return;
            preencherDescricao(titulo.value, descricao, avisoDescricao, true, sugerirTags);
        },
    }, 'Buscar na internet');
    const arquivo = h('input', {type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', id: 'arquivo-capa'});
    const urlImagem = h('input', {type: 'url', placeholder: 'https://…', value: imagemDeFora ? manga.imagePath : ''});
    const previa = h('div', {class: 'capa'});
    const exemplo = h('small');
    const erro = h('div', {class: 'erro', role: 'alert', hidden: true});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, manga ? 'Salvar alterações' : 'Cadastrar');
    let urlTemporaria = null;
    let enviado = null; // {arquivo, imagePath}: nao reenvia a mesma imagem se o salvar falhar por outro motivo

    const mostrarPrevia = () => {
        if (urlTemporaria) URL.revokeObjectURL(urlTemporaria);
        urlTemporaria = null;
        let origem = null;
        if (arquivo.files[0]) origem = urlTemporaria = URL.createObjectURL(arquivo.files[0]);
        else if (/^https?:\/\//i.test(urlImagem.value.trim())) origem = urlImagem.value.trim();
        else if (manga && !imagemDeFora) origem = manga.imageUrl;

        const semImagem = h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, '?');
        if (!origem) return previa.replaceChildren(semImagem);
        const img = h('img', {src: origem, alt: 'Prévia da capa'});
        img.addEventListener('error', () => previa.replaceChildren(semImagem));
        previa.replaceChildren(img);
    };
    arquivo.addEventListener('change', () => {
        if (arquivo.files[0]) urlImagem.value = '';
        mostrarPrevia();
    });
    urlImagem.addEventListener('input', () => {
        if (urlImagem.value.trim()) arquivo.value = '';
        mostrarPrevia();
    });

    const mostrarExemplo = () => {
        const numero = lerCapitulo(capitulo.value);
        if (!link.value.includes('{cap}')) {
            exemplo.replaceChildren('Troque o número do capítulo no link por ', h('code', null, '{cap}'), '.');
        } else if (numero == null) {
            exemplo.textContent = '';
        } else {
            const proximo = String(Math.floor(numero) + 1);
            const lido = String(numero).replace('.', SEPARADORES[formato.value] || '-');
            exemplo.replaceChildren(
                'Último lido: ', h('code', null, link.value.trim().replace('{cap}', lido)), h('br'),
                'Botão “Ler” abre: ', h('code', null, link.value.trim().replace('{cap}', proximo)));
        }
    };
    for (const campo of [link, capitulo, formato]) campo.addEventListener('input', mostrarExemplo);

    const formulario = h('form', {novalidate: true},
        h('div', {class: 'lado-capa'},
            previa,
            h('label', {class: 'botao', for: 'arquivo-capa'}, arquivo, 'Escolher imagem'),
            h('label', {class: 'campo'}, h('span', null, 'ou link da imagem'), urlImagem)),
        h('div', {class: 'campos'},
            h('label', {class: 'campo'}, h('span', null, 'Título'), titulo),
            h('label', {class: 'campo'}, h('span', null, 'Link do capítulo'), link, exemplo),
            h('div', {class: 'dupla'},
                h('label', {class: 'campo'}, h('span', null, 'Último capítulo lido'), capitulo,
                    h('small', null, 'Use 0 se ainda não começou.')),
                h('label', {class: 'campo'}, h('span', null, 'Capítulos “,5” no link'), formato)),
            h('div', {class: 'dupla'},
                h('label', {class: 'campo'}, h('span', null, 'Status'), status),
                h('label', {class: 'campo'}, h('span', null, 'Dia de lançamento'), dia, avisoDia)),
            h('label', {class: 'campo'}, h('span', null, 'Minha nota'), nota,
                h('small', null, 'De 0 a 10. Aparece na capa do mangá; pode ficar sem nota.')),
            h('div', {class: 'campo'}, h('label', {for: 'campo-tags'}, 'Tags'), tags.elemento,
                h('small', null, 'Escolha das que já existem ou digite uma nova e aperte Enter. Em inglês, para combinar com as sugeridas.')),
            h('div', {class: 'campo'},
                h('div', {class: 'rotulo-com-acao'}, h('label', {for: 'campo-descricao'}, 'Descrição'), buscarDescricao),
                descricao, avisoDescricao),
            erro,
            h('div', {class: 'acoes-form'},
                h('a', {class: 'botao', href: voltarPara}, 'Cancelar'),
                salvar)));

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        const falhar = mensagem => {
            erro.textContent = mensagem;
            erro.hidden = false;
            erro.scrollIntoView({block: 'nearest'});
        };
        const numero = lerCapitulo(capitulo.value);
        if (!titulo.value.trim()) return falhar('O título é obrigatório');
        if (!link.value.trim()) return falhar('O link do capítulo é obrigatório');
        if (numero == null) return falhar('Digite um capítulo válido, como 48 ou 48,5 (não pode ser negativo)');
        if (!arquivo.files[0] && !urlImagem.value.trim() && !manga) return falhar('Escolha a imagem da capa');

        salvar.disabled = true;
        try {
            let imagePath = manga ? manga.imagePath : null;
            if (arquivo.files[0]) {
                if (!enviado || enviado.arquivo !== arquivo.files[0]) {
                    const envio = new FormData();
                    const reduzida = await reduzirCapa(arquivo.files[0]);
                    envio.append('arquivo', reduzida, reduzida.name || 'capa');
                    enviado = {arquivo: arquivo.files[0], imagePath: (await chamar('POST', '/api/imagens', envio)).imagePath};
                }
                imagePath = enviado.imagePath;
            } else if (urlImagem.value.trim()) {
                imagePath = urlImagem.value.trim();
            }
            const dados = {
                title: titulo.value,
                imagePath,
                tags: tags.valores(),
                chapterLinkModel: link.value,
                decimalFormat: formato.value,
                lastChapter: numero,
                readingStatus: status.value,
                releaseDay: dia.value || null,
                rating: nota.value === '' ? null : Number(nota.value),
                description: descricao.value,
            };
            const salvo = manga
                ? await chamar('PUT', '/api/mangas/' + manga.id, dados)
                : await chamar('POST', '/api/mangas', dados);
            if (pronto && paginaLida) {
                // cadastro vindo de uma pagina de capitulo: guarda tambem o endereco exato dela (e do proximo)
                try {
                    await chamar('POST', '/api/mangas/' + salvo.id + '/capitulo-lido',
                        {lastChapter: numero, lastChapterUrl: paginaLida, nextChapterUrl: pronto.proximo});
                } catch (e) {
                    // o manga ja foi cadastrado; sem o endereco exato vale o modelo do link
                }
            }
            avisar(manga ? 'Alterações salvas' : 'Mangá cadastrado');
            informarSitesAExtensao();
            location.hash = '#/manga/' + salvo.id;
        } catch (e) {
            falhar(e.message);
            salvar.disabled = false;
        }
    });

    document.title = (manga ? 'Editar ' + manga.title : 'Novo mangá') + ' · Viracap';
    // os banners (doc 95): verticais nas laterais ou, sem espaco, horizontais em cima e embaixo do formulario
    const paginaDoFormulario = h('div', {class: 'formulario'},
        lugarDeBanner('formulario-topo', 'horizontal', 'so-sem-trilhos'),
        h('a', {class: 'voltar', href: voltarPara}, '← Voltar'),
        h('h1', null, manga ? 'Edição geral' : 'Novo mangá'),
        recomendado
            ? h('div', {class: 'sorteado', role: 'status'},
                h('span', null, 'Preenchi o nome, a capa e a descrição. Falta o link de onde você vai ler: abra um capítulo no site de leitura, copie o endereço e troque o número do capítulo por {cap}.'))
            : pronto
                ? h('div', {class: 'sorteado', role: 'status'},
                    h('span', null, 'Este mangá não estava na sua lista. Preenchi o que deu para descobrir pela página; confira antes de cadastrar.'),
                    h('a', {class: 'botao pequeno', href: '#/capturar?' + capturado + '&escolher=1'}, 'Ele já está na lista'))
                : null,
        formulario,
        lugarDeBanner('formulario-fim', 'horizontal', 'so-sem-trilhos no-fim'));
    app.replaceChildren(paginaDoFormulario, ...trilhosDeBanner(paginaDoFormulario, 'formulario'));
    mostrarPrevia();
    mostrarExemplo();
    descricao.id = 'campo-descricao';
    if (pronto) {
        urlImagem.value = pronto.imagem;
        mostrarPrevia();
        preencherDescricao(titulo.value, descricao, avisoDescricao, false, sugerirTags);
    }
    if (!manga) titulo.focus();
}

// ------------------------------------------------------------------ captura do capitulo pelo navegador

/**
 * Codigo do favorito ("bookmarklet"). Roda na pagina do capitulo, no site de leitura, dentro do navegador
 * de quem esta lendo: pega o endereco da pagina e o link de "proximo capitulo" e abre este site para confirmar.
 * E assim que sites que bloqueiam o servidor (protecao contra robos) continuam funcionando.
 *
 * Alguns sites de leitura trocam ou desligam o window.open (para segurar anuncios) e o favorito parecia "nao
 * fazer nada". Por isso a abertura tenta tres caminhos: um window.open limpo, tirado de um quadro novo, que o
 * site nao teve como alterar; o window.open da pagina; e, se nenhuma aba abrir, vai para este site na propria
 * aba (o botao de voltar do navegador devolve ao capitulo). Qualquer erro aparece em um alerta.
 */
function codigoDoAtalho() {
    // sem "#" e sem acentos no codigo: dentro de um endereco javascript: eles podem ser alterados pelo navegador
    const codigo = function (origem) {
        try {
        var cerquilha = String.fromCharCode(35);
        var atual = location.href.split(cerquilha)[0], proximo = '';
        var dica = /(^|[^a-z])(next|pr[o\u00f3]xim[oa]|siguiente|seguinte)([^a-z]|$)/i;
        var links = document.querySelectorAll('link[href], a[href]');
        var pastas = function (caminho) { return caminho.split('/').filter(Boolean).length; };
        for (var i = 0; i < links.length; i++) {
            var e = links[i], destino = e.href;
            if (!/^https?:/.test(destino) || destino.split(cerquilha)[0] === atual) continue;
            var rel = (' ' + (e.getAttribute('rel') || '') + ' ').toLowerCase().indexOf(' next ') >= 0;
            var classe = typeof e.className === 'string' ? e.className.replace(/[-_]/g, ' ') : '';
            var texto = [e.textContent, e.title, e.getAttribute('aria-label'), classe].join(' ');
            var outroCapitulo = e.tagName === 'A' && e.host === location.host && pastas(e.pathname) >= pastas(location.pathname);
            if (rel || (outroCapitulo && dica.test(texto))) {
                proximo = destino.split(cerquilha)[0];
                break;
            }
        }
        var meta = function (nome) {
            var tag = document.querySelector('meta[property="' + nome + '"], meta[name="' + nome + '"]');
            return tag ? tag.content || '' : '';
        };
        var imagem = meta('og:image') || meta('twitter:image');
        try { imagem = imagem ? new URL(imagem, location.href).href : ''; } catch (erro) { imagem = ''; }
        var destino = origem + '/' + cerquilha + '/capturar?u=' + encodeURIComponent(atual) + '&p=' + encodeURIComponent(proximo)
            + '&t=' + encodeURIComponent((document.title || '').slice(0, 200)) + '&o=' + encodeURIComponent(meta('og:title').slice(0, 200))
            + '&i=' + encodeURIComponent(imagem);
        var aba = null;
        try {
            var quadro = document.createElement('iframe');
            quadro.style.display = 'none';
            document.documentElement.appendChild(quadro);
            aba = quadro.contentWindow.open(destino, '_blank');
            setTimeout(function () { quadro.remove(); }, 2000);
        } catch (erro) { aba = null; }
        if (!aba) { try { aba = window.open(destino, '_blank'); } catch (erro) { aba = null; } }
        if (!aba) location.href = destino;
        } catch (falha) {
            alert('Viracap: nao consegui ler esta pagina. ' + falha);
        }
    };
    return 'javascript:(' + codigo.toString().replace(/\s+/g, ' ') + ')(' + JSON.stringify(location.origin) + ');';
}

/** A pagina da extensao na loja do Firefox (sem a lingua no endereco: a Mozilla abre na lingua de quem visita). */
const EXTENSAO_NO_FIREFOX = 'https://addons.mozilla.org/firefox/addon/viracap-marcar-mangas/';

function situacaoDaExtensao() {
    if (estado.extensao) return h('p', {class: 'situacao boa'}, '✓ Extensão instalada e liberada para este site.');
    if (extensaoInstalada()) {
        return h('p', {class: 'situacao'}, 'Extensão instalada, mas ainda não liberada: clique no ícone dela na barra do navegador e em “Permitir que este site use a extensão”.');
    }
    return h('p', {class: 'situacao'}, 'Extensão não encontrada neste navegador.');
}

async function telaAtalho() {
    const vez = ++estado.render;
    const codigo = codigoDoAtalho();
    await conferirExtensao();
    if (vez !== estado.render) return;
    document.title = 'Extensão e atalho · Viracap';
    app.replaceChildren(
        abas('atalho'),
        // o texto e, ao lado, dois banners verticais (em telas estreitas, um horizontal embaixo do texto)
        h('div', {class: 'atalho-com-banners'}, h('div', {class: 'texto'},
            h('h1', null, 'Extensão: próximo capítulo automático'),
            h('p', null, 'Alguns sites de leitura mudam o link a cada capítulo e só entregam as páginas a um navegador de verdade, então o servidor não consegue descobrir o link do próximo capítulo. '
                + 'Com a extensão, o botão “Ler” faz isso no seu navegador: abre o último capítulo lido, acha o botão de próximo, vai direto para ele e salva o link certo.'),
            situacaoDaExtensao(),
            h('p', null,
                h('a', {class: 'botao primario', href: EXTENSAO_NO_FIREFOX, target: '_blank', rel: 'noopener'}, 'Instalar no Firefox')),
            h('ol', null,
                h('li', null, 'Clique em “Instalar no Firefox” e, na página da Mozilla, em “Adicionar ao Firefox”.'),
                h('li', null, 'Volte para este site, recarregue a página, clique no ícone da extensão e em “Permitir que este site use a extensão”.')),
            h('p', {class: 'subtitulo'}, 'Por enquanto a extensão está só na loja do Firefox (inclusive o Firefox para Android).'),
            h('h1', {class: 'segundo'}, 'Marcar o capítulo como lido direto do site de leitura'),
            h('p', null, 'Com a extensão instalada não precisa de favorito. Há três jeitos, todos abrem este site com o mangá e o capítulo já preenchidos para você confirmar:'),
            h('ul', null,
                h('li', null, h('b', null, 'Botão “✓ Lido”'), ': aparece sozinho na borda direita das páginas dos sites onde você tem mangá cadastrado.'),
                h('li', null, h('b', null, 'Ícone da extensão'), ': clique nele e em “Marcar este capítulo como lido”. Funciona em qualquer site.'),
                h('li', null, h('b', null, 'Teclado'), ': Alt+Shift+L na página do capítulo.')),
            h('h1', {class: 'segundo'}, 'Sem a extensão: favorito'),
            h('p', null, 'Alguns sites mudam o link a cada capítulo e não deixam ninguém além do seu navegador abrir as páginas. '
                + 'Com este favorito, você marca o capítulo como lido estando na página dele, e o endereço exato fica salvo junto.'),
            h('p', null,
                h('a', {
                    class: 'botao primario',
                    href: codigo,
                    title: 'Arraste para a barra de favoritos',
                    onclick: evento => {
                        evento.preventDefault();
                        avisar('Arraste este botão para a barra de favoritos do navegador');
                    },
                }, '📖 Marcar capítulo lido')),
            h('ol', null,
                h('li', null, 'Arraste o botão acima para a barra de favoritos do navegador (Ctrl+Shift+B mostra a barra).'),
                h('li', null, 'Quando terminar de ler um capítulo, ainda na página dele, clique no favorito.'),
                h('li', null, 'Este site abre mostrando o mangá e o capítulo encontrados. Confira e clique em Salvar.')),
            h('p', null, h('b', null, 'O favorito não faz nada em algum site?'), ' O código fica guardado dentro do próprio favorito, então uma correção feita aqui só vale depois de trocá-lo: '
                + 'apague o favorito antigo e arraste o botão de novo. Se o site de leitura não deixar abrir uma aba nova, este site abre na mesma aba; o botão de voltar do navegador devolve ao capítulo.'),
            h('p', null, 'Se a página tiver um botão de próximo capítulo, o link dele também é guardado, e o botão “Ler” passa a abrir direto o capítulo certo.'),
            h('p', null, h('b', null, 'No celular'), ', onde não dá para arrastar: crie um favorito de qualquer página, edite-o e cole o código abaixo no lugar do endereço. '
                + 'Ou então use o campo “Link do capítulo lido” ao alterar o capítulo aqui no site.'),
            h('p', null, h('button', {
                type: 'button',
                class: 'botao',
                onclick: async () => {
                    try {
                        await navigator.clipboard.writeText(codigo);
                        avisar('Código copiado');
                    } catch (e) {
                        avisar('Não foi possível copiar. Selecione o código abaixo e copie.', true);
                    }
                },
            }, 'Copiar código')),
            h('textarea', {class: 'codigo', readonly: true, rows: '4', 'aria-label': 'Código do atalho'}, codigo)),
        h('aside', {class: 'banners-do-atalho', 'aria-label': 'Anúncios'}, lugarDeBanner('atalho-1', 'vertical'), lugarDeBanner('atalho-2', 'vertical'))),
        lugarDeBanner('atalho-fim', 'horizontal', 'so-sem-coluna no-fim'));
}

/** Entre os mangas do mesmo site, o que tem o endereco mais parecido com o da pagina capturada. */
function mangaDoLink(mangas, endereco, titulosDaPagina) {
    const semAcento = texto => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const titulos = [].concat(titulosDaPagina || []).filter(titulo => typeof titulo === 'string' && titulo.trim());
    // todos os nomes de cada manga: o titulo e os outros nomes da obra que o site ja descobriu
    const nomesDe = manga => [manga.title, ...(manga.altTitles || [])].map(semAcento).filter(Boolean);

    // 1) pelo nome: o titulo da pagina, limpo, e o de exatamente um manga da lista
    const limpos = new Set(titulos.map(titulo => semAcento(limparTitulo(titulo, endereco))).filter(Boolean));
    const comONome = mangas.filter(manga => nomesDe(manga).some(nome => limpos.has(nome)));
    if (comONome.length === 1) return comONome[0];

    // 2) pelo endereco: mesmo site e mesma obra. Tudo antes do ultimo trecho (que e o capitulo) precisa bater.
    // Dois trechos batem se forem iguais ou quase iguais ("obra-3ec3b16f" e "obra-bd5bdaf8": so o id do fim mudou).
    const trechos = url => url.pathname.split('/').filter(Boolean).slice(0, -1);
    const quaseIguais = (a, b) => {
        let iguais = 0;
        while (iguais < a.length && iguais < b.length && a[iguais] === b[iguais]) iguais++;
        return iguais >= 8 && iguais >= 0.7 * Math.min(a.length, b.length);
    };
    // "title", "manga", "read"... sao iguais para o site inteiro; so um trecho com cara de nome de obra identifica
    const identifica = trecho => trecho.length >= 8 || /[-_\d]/.test(trecho);
    const pagina = new URL(endereco);
    const daPagina = trechos(pagina);
    const iguais = new Set();
    const parecidos = new Set();
    for (const manga of mangas) {
        for (const conhecido of [manga.lastChapterLink, manga.nextChapterLink, manga.chapterLinkModel]) {
            let url;
            try {
                url = new URL(conhecido.replace('{cap}', '0'));
            } catch (e) {
                continue;
            }
            const doManga = trechos(url);
            if (url.host !== pagina.host || doManga.length !== daPagina.length || !daPagina.some(identifica)) continue;
            if (daPagina.every((trecho, i) => trecho === doManga[i])) iguais.add(manga);
            else if (daPagina.every((trecho, i) => trecho === doManga[i] || quaseIguais(trecho, doManga[i]))) parecidos.add(manga);
        }
    }
    // endereco identico vale mais que parecido; na duvida entre dois, melhor nao sugerir nenhum do que sugerir o errado
    if (iguais.size === 1) return [...iguais][0];
    if (iguais.size === 0 && parecidos.size === 1) return [...parecidos][0];

    // 3) o nome de um manga da lista aparece inteiro dentro do titulo da pagina, por mais coisa que o site ponha em
    // volta ("[Manga] Manga Solo Leveling - Capítulo 12 - Site"). Vale o nome mais comprido que aparecer, para
    // "Solo Leveling: Ragnarok" ganhar de "Solo Leveling"; nomes curtos demais nao contam, para nao bater por acaso.
    const paginas = titulos.map(titulo => ' ' + semAcento(titulo) + ' ');
    let melhorTamanho = 0;
    let melhores = new Set();
    for (const manga of mangas) {
        for (const nome of nomesDe(manga)) {
            if ((nome.length < 6 && !nome.includes(' ')) || nome.length < 4) continue;
            if (paginas.some(pagina => pagina.includes(' ' + nome + ' ')) && nome.length >= melhorTamanho) {
                if (nome.length > melhorTamanho) melhores = new Set();
                melhorTamanho = nome.length;
                melhores.add(manga);
            }
        }
    }
    return melhores.size === 1 ? [...melhores][0] : null;
}

/**
 * Campo de busca dos mangas da lista, com sugestoes enquanto se digita (como a busca do Google).
 * Ja vem com o manga reconhecido escrito; apagar e digitar outro nome mostra os que combinam.
 * A ultima sugestao e sempre "cadastrar como manga novo", que chama cadastrarNovo(nomeDigitado).
 * Devolve { elemento, value }: value e o id do manga escolhido, ou '' enquanto nenhum foi escolhido.
 */
function buscaDeManga(mangas, escolhido, cadastrarNovo) {
    const semAcento = texto => String(texto).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    let escolhidoAgora = escolhido || null;
    let sugestoes = [];
    let opcoes = 0;
    let ativa = -1;

    const campo = h('input', {
        type: 'text',
        id: 'busca-manga',
        role: 'combobox',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'Digite o nome do mangá…',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
        'aria-controls': 'busca-manga-sugestoes',
        value: escolhido ? escolhido.title : '',
    });
    const lista = h('ul', {id: 'busca-manga-sugestoes', class: 'sugestoes', role: 'listbox', 'aria-label': 'Mangás da sua lista', hidden: true});
    const elemento = h('div', {class: 'busca-manga'}, campo, lista);

    const fechar = () => {
        lista.hidden = true;
        ativa = -1;
        campo.setAttribute('aria-expanded', 'false');
        campo.removeAttribute('aria-activedescendant');
    };
    const escolher = manga => {
        escolhidoAgora = manga;
        campo.value = manga.title;
        campo.classList.remove('sem-escolha');
        fechar();
    };
    // o nome digitado so vai para o cadastro se nao for o de um manga que ja esta na lista
    const nomeNovo = () => (escolhidoAgora ? '' : campo.value.trim());
    const destacar = indice => {
        ativa = indice;
        for (const item of lista.querySelectorAll('[role=option]')) {
            item.setAttribute('aria-selected', String(item.id === 'busca-manga-opcao-' + ativa));
        }
        const destacada = ativa >= 0 ? document.getElementById('busca-manga-opcao-' + ativa) : null;
        if (destacada) {
            campo.setAttribute('aria-activedescendant', destacada.id);
            destacada.scrollIntoView({block: 'nearest'});
        } else {
            campo.removeAttribute('aria-activedescendant');
        }
    };
    const mostrar = () => {
        const busca = semAcento(campo.value);
        // quem comeca com o que foi digitado vem antes de quem so contem
        sugestoes = mangas
            .filter(manga => semAcento(manga.title).includes(busca))
            .sort((a, b) => semAcento(b.title).startsWith(busca) - semAcento(a.title).startsWith(busca))
            .slice(0, 8);
        const digitado = nomeNovo();
        lista.replaceChildren(
            ...sugestoes.map((manga, i) => h('li', {
                id: 'busca-manga-opcao-' + i,
                role: 'option',
                'aria-selected': 'false',
                // mousedown, e nao click: acontece antes de o campo perder o foco e fechar a lista
                onmousedown: evento => {
                    evento.preventDefault();
                    escolher(manga);
                },
            }, h('span', null, manga.title), h('small', null, 'cap. ' + mostrarCapitulo(manga.lastChapter)))),
            sugestoes.length ? null : h('li', {class: 'nada', role: 'presentation'}, 'Nenhum mangá da sua lista com esse nome'),
            // sempre a ultima opcao: o manga pode simplesmente ainda nao estar na lista
            h('li', {
                id: 'busca-manga-opcao-' + sugestoes.length,
                class: 'novo',
                role: 'option',
                'aria-selected': 'false',
                onmousedown: evento => {
                    evento.preventDefault();
                    cadastrarNovo(digitado);
                },
            }, h('span', null, digitado ? '+ Cadastrar “' + digitado + '” como mangá novo' : '+ É um mangá novo: cadastrar')));
        lista.hidden = false;
        campo.setAttribute('aria-expanded', 'true');
        destacar(sugestoes.length === 1 ? 0 : -1);
        opcoes = sugestoes.length + 1; // os mangas e a opcao de cadastrar
    };

    campo.addEventListener('input', () => {
        // mudou o texto: a escolha anterior so vale se o nome escrito ainda for exatamente o dela
        const igual = mangas.filter(manga => semAcento(manga.title) === semAcento(campo.value));
        escolhidoAgora = igual.length === 1 ? igual[0] : null;
        campo.classList.toggle('sem-escolha', !escolhidoAgora && campo.value.trim() !== '');
        mostrar();
    });
    campo.addEventListener('focus', () => {
        campo.select();
        mostrar();
    });
    campo.addEventListener('blur', fechar);
    campo.addEventListener('keydown', evento => {
        if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            if (lista.hidden) return mostrar();
            const passo = evento.key === 'ArrowDown' ? 1 : -1;
            destacar(ativa < 0 ? (passo > 0 ? 0 : opcoes - 1) : (ativa + passo + opcoes) % opcoes);
        } else if (evento.key === 'Enter' && !lista.hidden && ativa >= 0) {
            evento.preventDefault(); // escolhe a sugestao em vez de enviar o formulario
            if (ativa < sugestoes.length) escolher(sugestoes[ativa]);
            else cadastrarNovo(nomeNovo());
        } else if (evento.key === 'Escape' && !lista.hidden) {
            evento.preventDefault();
            fechar();
        }
    });

    return {
        elemento,
        get value() {
            return escolhidoAgora ? escolhidoAgora.id : '';
        },
    };
}

/** Tela aberta pelo atalho: confirma o que foi capturado antes de salvar. Nada e gravado sem o clique em Salvar. */
async function telaCapturar(consulta) {
    const vez = ++estado.render;
    const parametros = new URLSearchParams(consulta);
    const endereco = (parametros.get('u') || '').trim();
    const proximo = (parametros.get('p') || '').trim();
    document.title = 'Marcar capítulo lido · Viracap';
    if (!ehLinkHttp(endereco)) {
        app.replaceChildren(vazio('Nada para marcar', 'Use o atalho estando na página de um capítulo.',
            h('a', {class: 'botao', href: '#/atalho'}, 'Ver como funciona')));
        return;
    }
    let mangas;
    try {
        // sem as descricoes: so os nomes e os links importam para reconhecer o manga
        mangas = await chamar('GET', '/api/mangas?resumo=1');
    } catch (e) {
        if (vez === estado.render) app.replaceChildren(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const achado = mangaDoLink(mangas, endereco, [parametros.get('t'), parametros.get('o')]);
    // manga que ainda nao esta na lista: abre o cadastro ja preenchido (a nao ser que tenham pedido para escolher)
    const paraOCadastro = new URLSearchParams(parametros);
    paraOCadastro.delete('escolher');
    if (!achado && (!parametros.has('escolher') || mangas.length === 0)) {
        location.replace('#/novo?' + paraOCadastro);
        return;
    }

    // o cadastro abre com o que a pagina informou; um nome digitado na busca vale mais que o titulo da pagina
    const cadastrarNovo = nomeDigitado => {
        const dados = new URLSearchParams(paraOCadastro);
        if (nomeDigitado) dados.set('t', nomeDigitado);
        location.hash = '#/novo?' + dados;
    };
    const manga = buscaDeManga(mangas, achado, cadastrarNovo);
    // o numero do capitulo vem do titulo da pagina quando ele diz ("Ch.90"); o do endereco as vezes e um codigo
    // interno do site (".../br_chapter-445716/"), entao so vale quando o titulo nao diz nada
    const numero = capituloDoTitulo([parametros.get('t'), parametros.get('o')]) ?? capituloDoLink(endereco);
    const capitulo = h('input', {type: 'text', inputmode: 'decimal', autocomplete: 'off', value: numero == null ? '' : mostrarCapitulo(numero)});
    // so sugere guardar o "proximo" se ele parece mesmo ser um capitulo adiante
    const numeroDoProximo = ehLinkHttp(proximo) ? capituloDoLink(proximo) : null;
    const guardarProximo = h('input', {type: 'checkbox', checked: numero != null && numeroDoProximo != null && numeroDoProximo > numero});
    const erro = h('div', {class: 'erro', role: 'alert', hidden: true});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');

    const formulario = h('form', {class: 'campos', novalidate: true},
        h('div', {class: 'campo'}, h('label', {for: 'busca-manga'}, 'Mangá'), manga.elemento,
            h('small', null,
                achado
                    ? 'Não é este? Apague o nome e digite o do mangá certo, ou '
                    : 'Não reconheci esse endereço em nenhum mangá da sua lista. Digite o nome para procurar, ou ',
                h('a', {href: '#/novo?' + paraOCadastro}, 'cadastre como um mangá novo'), '.')),
        h('label', {class: 'campo'}, h('span', null, 'Capítulo lido'), capitulo),
        h('div', {class: 'campo'}, h('span', null, 'Página do capítulo'), h('small', null, h('code', null, endereco))),
        ehLinkHttp(proximo)
            ? h('label', {class: 'campo marcar'}, guardarProximo,
                h('span', null, 'Guardar também o link do próximo capítulo'), h('small', null, h('code', null, proximo)))
            : h('div', {class: 'campo'}, h('small', null, 'A página não mostrou link para o próximo capítulo. O botão “Ler” vai abrir este capítulo, que tem o botão de próximo do site.')),
        erro,
        h('div', {class: 'acoes-form'},
            h('a', {class: 'botao', href: '#/'}, 'Cancelar'),
            salvar));

    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        const lido = lerCapitulo(capitulo.value);
        const falhar = mensagem => {
            erro.textContent = mensagem;
            erro.hidden = false;
        };
        if (!manga.value) return falhar('Escolha o mangá: digite o nome e clique em uma das sugestões');
        if (lido == null) return falhar('Digite o capítulo lido, como 48 ou 48,5');
        salvar.disabled = true;
        try {
            await chamar('POST', '/api/mangas/' + manga.value + '/capitulo-lido', {
                lastChapter: lido,
                lastChapterUrl: endereco,
                nextChapterUrl: ehLinkHttp(proximo) && guardarProximo.checked ? proximo : null,
            });
            avisar('Capítulo ' + mostrarCapitulo(lido) + ' marcado como lido');
            location.hash = '#/manga/' + manga.value;
        } catch (e) {
            falhar(e.message);
            salvar.disabled = false;
        }
    });

    app.replaceChildren(h('div', {class: 'formulario estreito'},
        h('h1', null, 'Marcar capítulo lido'),
        formulario));
}

// ------------------------------------------------------------------ rotas

/**
 * Marca no topo em qual parte do site a pessoa esta: a Comunidade, ou a Biblioteca (todo o resto, menos a pagina da
 * conta, que nao e de nenhuma das duas). O "+ Adicionar" so faz sentido na Biblioteca.
 */
function marcarSecao(parte) {
    for (const [nome, link] of [['biblioteca', 'secao-biblioteca'], ['comunidade', 'secao-comunidade'], ['loja', 'secao-loja'], ['gerenciar', 'secao-gerenciar']]) {
        const elemento = document.getElementById(link);
        if (nome === parte) elemento.setAttribute('aria-current', 'page');
        else elemento.removeAttribute('aria-current');
    }
    document.getElementById('adicionar').hidden = parte !== 'biblioteca';
}

function rota() {
    const [caminho, consulta] = location.hash.replace(/^#\/?/, '').split('?');
    const partes = caminho.split('/');
    document.title = 'Viracap';
    // fora do perfil de outra pessoa, o tema e o da conta (o perfil poe o da pessoa quando abre)
    if (!(partes[0] === 'comunidade' && partes[1] === 'perfil')) mostrarTemaNaPagina(null);
    marcarSecao(['comunidade', 'loja', 'gerenciar'].includes(partes[0]) ? partes[0] : partes[0] === 'conta' ? null : 'biblioteca');
    clearInterval(estado.vigiaDoFeed);
    // voltando de um post para a tela da Comunidade de onde ele foi aberto: ela volta como estava
    const guardada = estado.comunidadeGuardada;
    if (guardada && !(partes[0] === 'comunidade' && partes[1] === 'post')) {
        if (location.hash === guardada.hash) return restaurarComunidade(guardada);
        estado.comunidadeGuardada = null;
    }
    for (const dialogo of document.querySelectorAll('dialog')) dialogo.close();
    estado.recarregar = null;
    // uma busca digitada logo antes de trocar de tela nao pode disparar depois e atrapalhar a tela nova
    clearTimeout(estado.esperaDaBusca);

    // a pagina do relatorio da empresa esconde o topo do site; qualquer outra tela volta com ele
    document.body.classList.remove('pagina-de-relatorio');
    if (partes[0] === 'relatorio-de-banner' && partes[1] && partes[2]) return telaRelatorioDaEmpresa(partes[1], partes[2]);
    if (partes[0] === 'manga' && partes[1]) return telaDetalhes(partes[1], partes[2]);
    estado.sorteado = null;
    if (partes[0] === 'tag' && partes[1]) {
        estado.filtroTags = partes.slice(1).filter(Boolean).map(decodeURIComponent);
        estado.pagina = 1;
        return telaGrade();
    }
    if (partes[0] === 'hoje') return telaHoje();
    if (partes[0] === 'descobrir') return telaDescobrir();
    if (partes[0] === 'atalho') return telaAtalho();
    if (partes[0] === 'loja') return telaLoja(partes.slice(1), consulta);
    if (partes[0] === 'conta') return telaConta();
    if (partes[0] === 'comunidade') return telaComunidade(partes.slice(1), consulta);
    if (partes[0] === 'gerenciar') return telaGerenciar(partes.slice(1));
    if (partes[0] === 'capturar') return telaCapturar(consulta || '');
    if (partes[0] === 'novo') return telaFormulario(null, consulta);
    if (partes[0] === 'editar' && partes[1]) return telaFormulario(partes[1]);
    return telaGrade();
}

// ------------------------------------------------------------------ login

/** Campo de senha com o botao "Mostrar". */
function campoDeSenha(id, autocomplete, rotulo, dica) {
    const senha = h('input', {type: 'password', id, name: id, autocomplete, required: true, minlength: '6'});
    const mostrar = h('button', {type: 'button', class: 'mostrar-senha', 'aria-pressed': 'false', 'aria-controls': id}, 'Mostrar');
    mostrar.addEventListener('click', () => {
        const visivel = senha.type === 'password';
        senha.type = visivel ? 'text' : 'password';
        mostrar.textContent = visivel ? 'Esconder' : 'Mostrar';
        mostrar.setAttribute('aria-pressed', String(visivel));
        senha.focus();
    });
    return {
        entrada: senha,
        elemento: h('div', {class: 'campo'}, h('label', {for: id}, rotulo), h('div', {class: 'senha-com-botao'}, senha, mostrar),
            dica ? h('small', null, dica) : null),
    };
}

/**
 * Tela de entrada, com duas formas: entrar (e-mail e senha) e criar conta (nick, e-mail e senha). O login vale por
 * 30 dias neste navegador, mesmo fechando o navegador ou desligando o computador. Ao entrar, o site abre na tela
 * que estava no endereco (por exemplo, a de marcar capitulo lido).
 */
function telaLogin(aviso, criando) {
    estado.render++;
    for (const dialogo of document.querySelectorAll('dialog')) dialogo.close();
    document.body.classList.add('entrando');
    mostrarConta(null);
    // a tela de entrar e a pagina inicial que o Google mostra: fica com o titulo completo do site
    document.title = criando ? 'Criar conta · Viracap' : 'Viracap · sua lista de mangás, manhwas e manhuas';

    const email = h('input', {type: 'email', id: 'login-email', name: 'email', autocomplete: 'email', autocapitalize: 'none',
        spellcheck: 'false', required: true, value: lembrado('email', '')});
    const nick = h('input', {type: 'text', id: 'login-nick', name: 'nick', autocomplete: 'nickname', required: true, maxlength: '40'});
    const senha = campoDeSenha('login-senha', criando ? 'new-password' : 'current-password', 'Senha', criando ? 'Pelo menos 6 caracteres.' : null);
    const confirmar = campoDeSenha('login-confirmar', 'new-password', 'Repita a senha');
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const enviar = h('button', {type: 'submit', class: 'botao primario entrar'}, criando ? 'Criar conta' : 'Entrar');
    if (aviso) erro.textContent = aviso;
    const trocar = h('a', {href: '#', class: 'trocar-de-modo', onclick: evento => {
        evento.preventDefault();
        telaLogin(null, !criando);
    }}, criando ? 'Já tenho conta: entrar' : 'Não tem conta? Criar uma');

    const formulario = h('form', {class: 'cartao-de-login', 'aria-labelledby': 'titulo-login'},
        h('img', {class: 'logo-de-login', src: 'favicon.svg', alt: '', width: '56', height: '56'}),
        h('h1', {id: 'titulo-login'}, criando ? 'Criar conta' : 'Viracap'),
        h('p', {class: 'chamada-de-login'}, criando
            ? 'Sua lista é só sua: cada conta vê apenas os mangás que ela mesma cadastrou.'
            : 'Entre para ver sua lista, continuar de onde parou e marcar o que leu.'),
        criando ? h('div', {class: 'campo'}, h('label', {for: 'login-nick'}, 'Nick'), nick, h('small', null, 'Como você quer ser chamado. Dá para mudar depois.')) : null,
        h('div', {class: 'campo'}, h('label', {for: 'login-email'}, 'E-mail'), email),
        senha.elemento,
        criando ? confirmar.elemento : null,
        erro,
        enviar,
        trocar,
        h('p', {class: 'nota-de-login'}, 'Você continua conectado por 30 dias neste navegador, mesmo desligando o computador.'));
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        if (criando && senha.entrada.value !== confirmar.entrada.value) {
            erro.textContent = 'As duas senhas não são iguais';
            confirmar.entrada.select();
            return;
        }
        enviar.disabled = true;
        enviar.textContent = criando ? 'Criando…' : 'Entrando…';
        try {
            const sessao = criando
                ? await chamar('POST', '/api/contas', {nick: nick.value, email: email.value, senha: senha.entrada.value})
                : await chamar('POST', '/api/sessao', {email: email.value, senha: senha.entrada.value});
            lembrar('email', email.value.trim());
            await comecarSessao(sessao);
            if (criando) avisar('Conta criada. Bem-vindo, ' + sessao.conta.nick + '!');
        } catch (e) {
            erro.textContent = e.message;
            enviar.disabled = false;
            enviar.textContent = criando ? 'Criar conta' : 'Entrar';
            if (!criando) senha.entrada.select();
        }
    });

    // embaixo do formulario, o que e o site: para quem chega pela primeira vez e para o Google, que so ve esta tela
    const recurso = (titulo, texto) => h('li', null, h('h3', null, titulo), h('p', null, texto));
    const sobre = criando ? null : h('section', {class: 'sobre-o-site', 'aria-labelledby': 'titulo-sobre-o-site'},
        h('h2', {id: 'titulo-sobre-o-site'}, 'Sua lista de mangás, manhwas e manhuas'),
        h('p', {class: 'chamada-de-login'}, 'O Viracap guarda em que capítulo você parou em cada obra e em qual site você lê, e leva direto ao próximo capítulo.'),
        h('ul', null,
            recurso('Continue de onde parou', 'Cadastre o que você lê com o link do site de leitura e abra o próximo capítulo com um clique.'),
            recurso('Lançamentos do dia', 'Veja quais obras da sua lista lançam capítulo novo hoje.'),
            recurso('Descubra obras novas', 'Recomendações a partir do que você já lê, com sinopse e gêneros.'),
            recurso('Comunidade', 'Poste o que está lendo, compartilhe listas e siga outros leitores.')),
        // capturas da tela (com pessoas e capas de exemplo): quem chega ve como e por dentro, e o Google indexa as imagens
        h('h2', {class: 'titulo-das-capturas'}, 'Como é por dentro'),
        h('div', {class: 'capturas-do-site'}, ...CAPTURAS_DO_SITE.map(([arquivo, titulo, texto]) =>
            h('figure', null,
                h('button', {type: 'button', class: 'abrir-captura', 'aria-label': 'Ver maior: ' + titulo, onclick: () => verImagem('capturas/' + arquivo)},
                    h('img', {src: 'capturas/' + arquivo, alt: titulo + ': ' + texto, loading: 'lazy', decoding: 'async', width: '1600', height: '1000'})),
                h('figcaption', null, h('b', null, titulo), ' ', texto)))));
    app.replaceChildren(h('div', {class: 'fundo-de-login'}, formulario, sobre));
    (criando ? nick : email.value ? senha.entrada : email).focus();
}

/** As capturas da tela de entrar: arquivo em public/capturas, titulo e o que mostram (tambem no index.html e no sitemap). */
const CAPTURAS_DO_SITE = [
    ['biblioteca.webp', 'Biblioteca', 'sua lista de mangás, manhwas e manhuas com capa, status, nota e o próximo capítulo de cada um.'],
    ['comunidade.webp', 'Comunidade', 'posts, listas compartilhadas, #tags e leitores para seguir.'],
    ['manga.webp', 'Página do mangá', 'o capítulo em que você parou, quando sai o próximo, sua nota, as tags e a sinopse.'],
];

/** Esquece tudo o que estava guardado da conta anterior: outra conta nao pode ver a lista dela. */
function esquecerDadosDaConta() {
    estado.listaCompleta = null;
    paginasDoServidor.clear();
    estado.ultimaPagina = null;
    estado.busca = '';
    estado.filtroStatus = '';
    estado.filtroTags = [];
    estado.pagina = 1;
    estado.sorteado = null;
}

async function comecarSessao(sessao) {
    esquecerDadosDaConta();
    estado.sessao = sessao;
    document.body.classList.remove('entrando');
    app.replaceChildren();
    mostrarConta(sessao.conta);
    await abrirSite();
}

/** A foto de perfil, ou a inicial do nick em um circulo quando nao ha foto. */
function avatar(conta, grande) {
    const classe = 'inicial' + (grande ? ' grande' : '');
    if (conta.foto) return h('img', {class: classe + ' foto', src: conta.foto, alt: '', width: grande ? '64' : '26', height: grande ? '64' : '26'});
    return h('span', {class: classe, 'aria-hidden': 'true'}, [...conta.nick][0].toUpperCase());
}

/** Nick e foto no topo (levam ao proprio perfil ou as configuracoes), o botao Sair e as partes do site (so depois de entrar). */
function mostrarConta(conta) {
    const link = document.getElementById('minha-conta');
    const sair = document.getElementById('sair');
    link.hidden = sair.hidden = !conta;
    document.querySelector('.secoes').hidden = !conta;
    document.getElementById('secao-gerenciar').hidden = !conta?.admin;
    aplicarTema(conta?.tema);
    // a loja so existe na versao do Vercel (a mesma que tem a Comunidade)
    document.getElementById('secao-loja').hidden = !conta || estado.temComunidade !== true;
    if (conta) {
        link.replaceChildren(avatar(conta), h('span', {class: 'nick'}, conta.nick));
        // com a Comunidade (versao do Vercel), o nick leva ao proprio perfil; sem ela (versao Java), as configuracoes
        const comPerfil = estado.temComunidade === true;
        link.href = comPerfil ? '#/comunidade/perfil/' + conta.id : '#/conta';
        link.title = (comPerfil ? 'Meu perfil' : 'Configurações') + ' (' + conta.email + ')';
    }
}

/** Recorta o meio da imagem em um quadrado de lado x lado, em WebP (ou JPEG). */
async function recortarQuadrado(arquivo, lado) {
    const imagem = await createImageBitmap(arquivo);
    const menor = Math.min(imagem.width, imagem.height);
    const tela = document.createElement('canvas');
    tela.width = tela.height = Math.min(lado, menor);
    const pincel = tela.getContext('2d');
    pincel.imageSmoothingQuality = 'high';
    pincel.drawImage(imagem, (imagem.width - menor) / 2, (imagem.height - menor) / 2, menor, menor, 0, 0, tela.width, tela.height);
    imagem.close();
    const gerar = tipo => new Promise(ok => tela.toBlob(ok, tipo, 0.88));
    const recortada = await gerar('image/webp');
    return recortada && recortada.type === 'image/webp' ? recortada : gerar('image/jpeg');
}

async function sair() {
    try {
        await chamar('DELETE', '/api/sessao');
    } catch (e) {
        avisar(e.message, true);
        return;
    }
    esquecerDadosDaConta();
    estado.sessao = {...estado.sessao, logado: false, conta: null};
    telaLogin();
}

// ------------------------------------------------------------------ loja

/** A borda e o efeito da loja que a pessoa equipou (nulos: a borda roxa e o brilho de sempre). */
const meusEquipados = () => ({borda: estado.sessao?.conta?.borda || null, efeito: estado.sessao?.conta?.efeito || null});
/** As classes que poem a borda e o efeito numa capa de favorito (o id vem do servidor, mas so letras viram classe). */
const classesDaLoja = ({borda, efeito} = {}) => (borda && /^[a-z]+$/.test(borda) ? ' borda-' + borda : '')
    + (efeito && /^[a-z]+$/.test(efeito) ? ' efeito-' + efeito : '');
const PRECO_EM_REAIS = centavos => (centavos / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
/** Os itens de sempre, que toda conta tem: aparecem na mochila para voltar a eles (os temas de graca vem do servidor). */
const ITENS_DE_SEMPRE = [
    {id: null, tipo: 'borda', nome: 'Roxa', descricao: 'A borda de sempre dos favoritos. Vem com todas as contas.'},
    {id: null, tipo: 'efeito', nome: 'Brilho', descricao: 'O reflexo de sempre que passa pela capa. Vem com todas as contas.'},
    {id: null, tipo: 'tema', nome: 'Automático', descricao: 'Segue o seu aparelho: escuro, ou claro se o sistema estiver no modo claro.'},
];
const NOME_DO_TIPO = {borda: 'Borda', efeito: 'Efeito', tema: 'Tema'};

/**
 * Poe o tema do site (o que a pessoa equipou) na pagina: <html data-tema="...">, que o app.css usa para trocar as
 * cores e o fundo. Sem tema, o site segue o sistema. O tema fica guardado no navegador para a pagina ja abrir com
 * ele, sem piscar com o tema de sempre antes de a conta chegar.
 */
function aplicarTema(tema) {
    const valido = typeof tema === 'string' && /^[a-z]+$/.test(tema) ? tema : null;
    if (valido) document.documentElement.dataset.tema = valido;
    else delete document.documentElement.dataset.tema;
    try {
        if (valido) localStorage.setItem('viracap-tema', valido);
        else localStorage.removeItem('viracap-tema');
    } catch (e) {
        // sem o navegador guardar, o tema chega com a conta
    }
}
// o tema guardado, antes de qualquer coisa
try {
    const guardado = localStorage.getItem('viracap-tema');
    if (guardado && /^[a-z]+$/.test(guardado)) document.documentElement.dataset.tema = guardado;
} catch (e) {
    // sem tema guardado
}

/**
 * O tema para mostrar o que e de outra pessoa (o perfil, os mangas e as listas dela): o que ela equipou, e, se ela usa
 * o Automatico, o tema de sempre do site (escuro, ou claro se o aparelho de quem ve estiver no modo claro). Nunca o
 * tema de quem esta vendo.
 */
function temaParaVer(tema) {
    if (typeof tema === 'string' && /^[a-z]+$/.test(tema)) return tema;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
}

/** Troca o tema da pagina so na tela (sem guardar): usado no perfil de outra pessoa. Nulo volta ao tema da conta. */
function mostrarTemaNaPagina(tema) {
    const valido = tema === undefined || tema === null ? meuTema() : tema;
    if (valido) document.documentElement.dataset.tema = valido;
    else delete document.documentElement.dataset.tema;
}
const meuTema = () => (typeof estado.sessao?.conta?.tema === 'string' ? estado.sessao.conta.tema : null);

/** As camadas do fundo animado de um tema, para uma janela com o tema de outra pessoa. */
const camadasDoTema = () => [1, 2, 3, 4].map(n => h('div', {class: 'fundo-da-previa' + (n > 1 ? '-' + n : ''), 'aria-hidden': 'true'}));

/** Uma janelinha do site com as cores (e o fundo, se for animado) de um tema, para a loja e a mochila. */
function previaDoTema(tema) {
    return h('div', {class: 'previa-do-tema', 'data-tema': tema || null, 'aria-hidden': 'true'},
        h('div', {class: 'fundo-da-previa'}), h('div', {class: 'fundo-da-previa-2'}),
        h('div', {class: 'fundo-da-previa-3'}), h('div', {class: 'fundo-da-previa-4'}),
        h('div', {class: 'janela-da-previa'},
            h('div', {class: 'previa-topo'}, h('span', {class: 'previa-logo'}), h('span', {class: 'previa-aba ativa'}), h('span', {class: 'previa-aba'})),
            h('div', {class: 'previa-capas'}, h('span', {class: 'previa-capa'}), h('span', {class: 'previa-capa'}), h('span', {class: 'previa-capa'}), h('span', {class: 'previa-capa'})),
            h('div', {class: 'previa-cartao'}, h('div', {class: 'previa-linhas'}, h('span', {class: 'previa-linha'}), h('span', {class: 'previa-linha curta'})), h('span', {class: 'previa-botao'}))));
}
/** Na loja, cada pagina mostra ate 6 linhas de 5 itens. */
const ITENS_POR_PAGINA_NA_LOJA = 30;

/**
 * Capa de exemplo para mostrar um item: a capa de um favorito da pessoa, se houver; se nao, uma capa desenhada. Uma
 * borda aparece com o brilho de sempre; um efeito, com a borda roxa.
 */
function previaDoItem(item, exemplo) {
    if (item.tipo === 'tema') return previaDoTema(item.id);
    const imagem = exemplo
        ? h('img', {src: exemplo, alt: '', loading: 'lazy', decoding: 'async', width: '300', height: '450'})
        : h('div', {class: 'capa-de-exemplo', 'aria-hidden': 'true'}, h('span', null, '漫'), h('small', null, 'Seu favorito'));
    const equipados = item.tipo === 'efeito' ? {efeito: item.id} : {borda: item.id};
    return h('div', {class: 'capa favorita previa-do-item' + classesDaLoja(equipados)}, imagem,
        h('span', {class: 'estrela-de-favorito', 'aria-hidden': 'true'}, '★'), enfeiteDaBorda());
}

/**
 * Loja (#/loja/bordas e #/loja/efeitos, com ?pagina=N) e mochila (#/loja/mochila). Na loja, os itens a venda; na
 * mochila, os comprados e os de sempre, para equipar uma borda e um efeito. Ao voltar do Mercado Pago
 * (#/loja?compra=ID), confere o pagamento ate ele ser aprovado.
 */
async function telaLoja(partes, consulta) {
    const vez = ++estado.render;
    const aba = ['efeitos', 'temas', 'mochila'].includes(partes[0]) ? partes[0] : 'bordas';
    const parametros = new URLSearchParams(consulta || '');
    const compraVoltando = parametros.get('compra');
    let pagina = Math.max(1, Number.parseInt(parametros.get('pagina'), 10) || 1);
    // na mochila, o filtro por tipo (todos, bordas, efeitos ou temas) fica no endereco: ?tipo=borda
    const tipoNaMochila = ['borda', 'efeito', 'tema'].includes(parametros.get('tipo')) ? parametros.get('tipo') : '';
    document.title = (aba === 'mochila' ? 'Mochila' : 'Loja') + ' · Viracap';
    const aviso = h('div', {class: 'aviso-da-compra', role: 'status', hidden: true});
    const conteudo = h('div', {class: 'conteudo-da-loja'}, h('p', {class: 'subtitulo'}, 'Carregando…'));
    const link = (nome, endereco, ...texto) => h('a', {class: 'aba', href: endereco, 'aria-current': aba === nome ? 'page' : null}, ...texto);
    const contador = h('span', {class: 'contador-da-mochila'});
    app.replaceChildren(
        h('div', {class: 'pagina-da-loja'},
            h('h1', null, 'Loja'),
            h('p', {class: 'subtitulo'}, 'Bordas (' + PRECO_EM_REAIS(450) + ') e efeitos (' + PRECO_EM_REAIS(250) + ') para as capas dos seus mangás favoritos, '
                + 'e temas para o site todo (' + PRECO_EM_REAIS(500) + ', ou ' + PRECO_EM_REAIS(750) + ' os de fundo animado). '
                + 'Você paga uma vez e o item fica na sua mochila para sempre.'),
            aviso,
            rolagemDasAbas(h('nav', {class: 'abas abas-da-loja', 'aria-label': 'Loja'},
                link('bordas', '#/loja/bordas', 'Bordas'), link('efeitos', '#/loja/efeitos', 'Efeitos'), link('temas', '#/loja/temas', 'Temas'),
                link('mochila', '#/loja/mochila', 'Mochila', contador))),
            lugarDeBanner('loja-topo', 'horizontal', 'so-sem-trilhos'),
            conteudo,
            lugarDeBanner('loja-fim', 'horizontal', 'so-sem-trilhos no-fim')),
        ...trilhosDeBanner(conteudo, 'loja'));
    estado.recarregar = () => telaLoja(partes, consulta);

    let dados;
    let exemplo = null;
    try {
        const [vitrine, favoritos] = await Promise.all([
            chamar('GET', '/api/loja'),
            chamar('GET', '/api/mangas?ordem=FAVORITOS&resumo=1&pagina=1&tamanho=1').catch(() => null),
        ]);
        dados = vitrine;
        const primeiro = favoritos?.itens?.[0];
        if (primeiro?.favorite) exemplo = primeiro.thumbUrl || primeiro.imageUrl;
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Não deu para abrir a loja', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const tenho = id => dados.mochila.some(item => item.item === id);
    const mostrarContador = () => { contador.textContent = dados.mochila.length ? ' ' + dados.mochila.length : ''; };
    mostrarContador();

    const equipar = async (item, botao) => {
        botao.disabled = true;
        try {
            const {equipados} = await chamar('PUT', '/api/loja/equipar', item.id ? {item: item.id} : {tipo: item.tipo, item: null});
            Object.assign(estado.sessao.conta, equipados);
            dados.equipados = equipados;
            aplicarTema(equipados.tema);
            avisar(item.nome + (item.tipo === 'borda' ? ' equipada' : ' equipado'));
            desenhar();
        } catch (e) {
            avisar(e.message, true);
            botao.disabled = false;
        }
    };
    const comprar = async (item, botao) => {
        botao.disabled = true;
        botao.textContent = 'Abrindo o pagamento…';
        try {
            const {endereco} = await chamar('POST', '/api/loja/comprar', {item: item.id});
            // o pagamento acontece na pagina do Mercado Pago; depois ele traz a pessoa de volta para #/loja?compra=
            location.href = endereco;
        } catch (e) {
            avisar(e.message, true);
            botao.disabled = false;
            botao.textContent = 'Comprar por ' + PRECO_EM_REAIS(item.preco);
        }
    };

    const cartaoDoItem = item => {
        const equipado = (dados.equipados[item.tipo] || null) === item.id;
        const meu = item.id === null || item.preco === 0 || tenho(item.id);
        let acao;
        if (aba === 'mochila' || meu) {
            acao = equipado
                ? h('button', {type: 'button', class: 'botao', disabled: true}, '✓ Equipado')
                : h('button', {type: 'button', class: 'botao primario', onclick: evento => equipar(item, evento.currentTarget)}, 'Equipar');
        } else {
            acao = h('button', {type: 'button', class: 'botao primario', disabled: !dados.pagamentoConfigurado,
                onclick: evento => comprar(item, evento.currentTarget)}, 'Comprar por ' + PRECO_EM_REAIS(item.preco));
        }
        return h('article', {class: 'item-da-loja' + (equipado ? ' equipado' : '')},
            previaDoItem(item, exemplo),
            h('div', {class: 'sobre-o-item'},
                h('span', {class: 'tipo-do-item'}, (NOME_DO_TIPO[item.tipo] || 'Item') + (item.animado ? ' animado' : '')),
                h('h2', null, item.nome),
                h('p', null, item.descricao),
                aba !== 'mochila' && meu && !equipado ? h('span', {class: 'selo-na-mochila'}, 'Na mochila') : null,
                acao));
    };

    /** A grade da pagina atual e, com mais de uma pagina, os botoes de anterior e proxima. */
    const gradePaginada = itens => {
        const paginas = Math.max(1, Math.ceil(itens.length / ITENS_POR_PAGINA_NA_LOJA));
        pagina = Math.min(pagina, paginas);
        const desta = itens.slice((pagina - 1) * ITENS_POR_PAGINA_NA_LOJA, pagina * ITENS_POR_PAGINA_NA_LOJA);
        const irPara = numero => {
            const busca = new URLSearchParams();
            if (aba === 'mochila' && tipoNaMochila) busca.set('tipo', tipoNaMochila);
            if (numero > 1) busca.set('pagina', String(numero));
            location.hash = '#/loja/' + aba + (busca.toString() ? '?' + busca : '');
        };
        return [
            h('div', {class: 'grade-da-loja'}, ...desta.map(cartaoDoItem)),
            paginas > 1 ? h('nav', {class: 'paginacao-da-loja', 'aria-label': 'Páginas da loja'},
                h('button', {type: 'button', class: 'botao', disabled: pagina <= 1, onclick: () => irPara(pagina - 1)}, '‹ Anterior'),
                h('span', null, 'Página ' + pagina + ' de ' + paginas),
                h('button', {type: 'button', class: 'botao', disabled: pagina >= paginas, onclick: () => irPara(pagina + 1)}, 'Próxima ›')) : null,
        ];
    };

    const desenhar = () => {
        // replaceChildren escreveria "null" como texto: o que nao vale fica de fora
        if (aba !== 'mochila') {
            const tipo = {efeitos: 'efeito', temas: 'tema'}[aba] || 'borda';
            conteudo.replaceChildren(...[
                dados.pagamentoConfigurado ? null : h('p', {class: 'situacao'}, 'A loja ainda não está recebendo pagamentos. Volte em breve!'),
                ...gradePaginada(dados.itens.filter(item => item.tipo === tipo)),
                h('p', {class: 'nota-da-loja'}, 'O pagamento é feito no Mercado Pago, por Pix ou cartão: o Viracap não vê os dados do seu cartão. '
                    + 'O item entra na mochila assim que o pagamento é aprovado (no Pix, em alguns segundos).')].filter(Boolean));
            return;
        }
        const minhas = dados.itens.filter(item => tenho(item.id));
        const daMochila = [...ITENS_DE_SEMPRE, ...(dados.gratis || []), ...minhas].filter(item => !tipoNaMochila || item.tipo === tipoNaMochila);
        // trocar o filtro volta para a primeira pagina
        const filtroDaMochila = h('div', {class: 'filtros filtro-da-mochila', role: 'group', 'aria-label': 'Mostrar na mochila'},
            ...[['', 'Todos'], ['borda', 'Bordas'], ['efeito', 'Efeitos'], ['tema', 'Temas']].map(([tipo, texto]) => {
                const quantos = [...ITENS_DE_SEMPRE, ...(dados.gratis || []), ...minhas].filter(item => !tipo || item.tipo === tipo).length;
                return h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(tipoNaMochila === tipo),
                    onclick: () => { location.hash = '#/loja/mochila' + (tipo ? '?tipo=' + tipo : ''); }}, texto + ' (' + quantos + ')');
            }));
        conteudo.replaceChildren(...[
            filtroDaMochila,
            ...gradePaginada(daMochila),
            dados.temTudo ? h('p', {class: 'nota-da-loja'}, 'Como dono do site, você tem todos os itens da loja, inclusive os que entrarem depois.') : null,
            minhas.length ? null : h('p', {class: 'nota-da-loja'}, 'Sua mochila só tem a borda roxa e o brilho de sempre por enquanto. ',
                h('a', {href: '#/loja/bordas'}, 'Ver a loja'))].filter(Boolean));
    };
    desenhar();
    if (compraVoltando) acompanharCompra(compraVoltando, aviso, vez, dados, () => { mostrarContador(); desenhar(); });
}

/**
 * Voltando do Mercado Pago: pergunta ao servidor (que confere no Mercado Pago) ate a compra sair de "pendente", por
 * ate 2 minutos. Um Pix pago depois disso tambem vale: o aviso do Mercado Pago poe o item na mochila sozinho.
 */
async function acompanharCompra(id, aviso, vez, dados, redesenhar) {
    aviso.hidden = false;
    aviso.className = 'aviso-da-compra';
    aviso.replaceChildren(h('b', null, 'Confirmando o pagamento…'), h('span', null, 'Isso leva só alguns segundos.'));
    // o endereco perde o ?compra=: recarregar a pagina nao repete o aviso
    history.replaceState(null, '', '#/loja');
    const inicio = Date.now();
    while (vez === estado.render) {
        let compra;
        try {
            compra = await chamar('GET', '/api/loja/compras/' + encodeURIComponent(id));
        } catch (e) {
            aviso.replaceChildren(h('b', null, 'Não deu para conferir a compra'), h('span', null, e.message));
            return;
        }
        if (vez !== estado.render) return;
        const item = dados.itens.find(i => i.id === compra.item);
        const nome = item ? ({efeito: 'O efeito ', tema: 'O tema '}[item.tipo] || 'A borda ') + item.nome : 'O item';
        if (compra.status === 'aprovada') {
            aviso.className = 'aviso-da-compra aprovada';
            if (!dados.mochila.some(m => m.item === compra.item)) dados.mochila.push({item: compra.item});
            redesenhar();
            const botao = h('button', {type: 'button', class: 'botao primario pequeno'}, 'Equipar agora');
            botao.addEventListener('click', async () => {
                botao.disabled = true;
                try {
                    const {equipados} = await chamar('PUT', '/api/loja/equipar', {item: compra.item});
                    Object.assign(estado.sessao.conta, equipados);
                    dados.equipados = equipados;
                    aplicarTema(equipados.tema);
                    redesenhar();
                    botao.replaceWith(h('span', null, '✓ Equipado'));
                } catch (e) {
                    avisar(e.message, true);
                    botao.disabled = false;
                }
            });
            aviso.replaceChildren(h('b', null, 'Pagamento aprovado!'), h('span', null, nome + ' está na sua mochila.'), botao);
            return;
        }
        if (compra.status === 'recusada') {
            aviso.className = 'aviso-da-compra recusada';
            aviso.replaceChildren(h('b', null, 'O pagamento não foi aprovado'), h('span', null, 'Nada foi cobrado. Você pode tentar de novo, com outro cartão ou por Pix.'));
            return;
        }
        if (compra.status !== 'pendente') {
            aviso.className = 'aviso-da-compra recusada';
            aviso.replaceChildren(h('b', null, 'Houve um problema com essa compra'), h('span', null, 'Fale com um administrador do Viracap.'));
            return;
        }
        if (Date.now() - inicio > 120_000) {
            aviso.replaceChildren(h('b', null, 'Aguardando o pagamento'),
                h('span', null, 'Assim que o Mercado Pago confirmar (no Pix, depois de você pagar), o item aparece na sua mochila sozinho.'));
            return;
        }
        await new Promise(pronto => setTimeout(pronto, 3000));
    }
}

// ------------------------------------------------------------------ comunidade

/** Poe um post novo no alto do feed (tirando o aviso de feed vazio, se houver). */
function porNoFeed(feed, post) {
    feed.querySelectorAll(':scope > .vazio').forEach(aviso => aviso.remove());
    feed.prepend(cartaoDePost(post));
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" e, depois de uma semana, a data. */
function quandoFoi(data) {
    const segundos = Math.max(0, (Date.now() - new Date(data).getTime()) / 1000);
    if (segundos < 60) return 'agora';
    if (segundos < 3600) return 'há ' + Math.floor(segundos / 60) + ' min';
    if (segundos < 86400) return 'há ' + Math.floor(segundos / 3600) + ' h';
    if (segundos < 7 * 86400) return 'há ' + Math.floor(segundos / 86400) + ' d';
    return new Date(data).toLocaleDateString('pt-BR', {day: 'numeric', month: 'short', year: 'numeric'});
}

const TEXTO_DO_POST_MAXIMO = 500;
const IMAGENS_DO_POST_MAXIMO = 4;
const MANGAS_DA_LISTA_MAXIMO = 20;

/** A pagina da Comunidade: feeds "Para voce" e "Seguindo", o perfil de cada leitor e um post sozinho. */
async function telaComunidade(partes, consulta) {
    const vez = ++estado.render;
    const [qual, id] = partes;
    const principal = h('div', {class: 'coluna-da-comunidade'});
    const lateral = h('aside', {class: 'lateral-da-comunidade'});
    // os banners: um vertical na coluna da esquerda (vazia) e outro embaixo de "Quem seguir"; sem as colunas (telas
    // menores), um horizontal em cima do feed
    const bannerDaDireita = lugarDeBanner('comunidade-direita', 'vertical', 'na-lateral');
    app.replaceChildren(h('div', {class: 'pagina-da-comunidade'},
        h('div', {class: 'lateral-esquerda-da-comunidade'}, lugarDeBanner('comunidade-esquerda', 'vertical', 'na-lateral')),
        principal, lateral), botaoDeEscrever());
    lateral.append(bannerDaDireita);

    // no perfil, o "Quem seguir" nao aparece: o foco e a pessoa do perfil
    if (qual === 'perfil' && id) return telaPerfil(principal, id, vez);
    carregarSugestoes(lateral, vez);
    if (qual === 'busca') return telaBusca(principal, new URLSearchParams(consulta || '').get('q') || '', vez);
    if (qual === 'post' && id) {
        document.title = 'Post · Comunidade · Viracap';
        principal.append(h('div', {class: 'topo-do-post-aberto'},
            h('button', {type: 'button', class: 'voltar-do-post', onclick: voltarDoPost, 'aria-label': 'Voltar'}, '←'),
            h('h1', null, 'Post')));
        try {
            const post = await chamar('GET', '/api/comunidade/posts/' + encodeURIComponent(id));
            if (vez === estado.render) principal.append(cartaoDePost(post, {maximizado: true}));
        } catch (e) {
            if (vez === estado.render) principal.append(vazio('Post não encontrado', e.message));
        }
        return;
    }
    const feed = qual === 'seguindo' ? 'seguindo' : 'para-voce';
    document.title = 'Comunidade · Viracap';
    const aba = (nome, endereco, texto) => h('a', {class: 'aba', href: endereco, 'aria-current': feed === nome ? 'page' : null,
        onclick: feed === nome ? evento => { evento.preventDefault(); recarregarAba(); } : null}, texto);
    const lista = h('div', {class: 'feed'});
    // aparece quando chegam posts novos suficientes; quem decide atualizar e a pessoa
    const avisoDeNovos = h('button', {type: 'button', class: 'posts-novos', hidden: true, onclick: () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
        // abre de novo: os posts novos sao os mais recentes, entao vem primeiro
        telaComunidade(partes);
    }});
    principal.append(
        h('h1', {class: 'so-leitor'}, 'Comunidade'),
        // as abas dos feeds e a barra de pesquisa na mesma linha (em telas estreitas, a barra desce para baixo das abas)
        h('div', {class: 'topo-do-feed'},
            h('nav', {class: 'abas', 'aria-label': 'Feeds'}, aba('para-voce', '#/comunidade', 'Para você'), aba('seguindo', '#/comunidade/seguindo', 'Seguindo')),
            barraDeBuscaDaComunidade()),
        lugarDeBanner('comunidade-topo', 'horizontal', 'so-sem-laterais'),
        avisarSePunido(editorDePost(post => porNoFeed(lista, post))),
        avisoDeNovos,
        lista);
    estado.recarregar = () => telaComunidade(partes);
    const aberto = await carregarFeed(lista, 'feed=' + feed, vez, feed === 'seguindo'
        ? vazio('Nada por aqui ainda', 'Os posts de quem você segue aparecem aqui. Siga leitores pela aba "Para você" ou pelas sugestões.')
        : vazio('A Comunidade está começando', 'Seja o primeiro a postar: conte o que está lendo ou compartilhe uma lista.'));
    if (aberto) {
        avisoDeNovos.dataset.desde = aberto.geradoEm;
        // ao voltar de um post, a consulta de posts novos recomeca de onde estava
        estado.retomarFeed = () => vigiarPostsNovos(feed, aberto.geradoEm, avisoDeNovos, vez);
        estado.retomarFeed();
    }
}

const POSTS_NOVOS_PARA_AVISAR = 10;
const INTERVALO_DOS_POSTS_NOVOS_MS = 45000;

/**
 * Enquanto o feed esta aberto (e a aba do navegador visivel), pergunta de tempos em tempos quantos posts novos
 * entraram nele. Com 10 ou mais, mostra o aviso "N posts novos": a pessoa atualiza quando quiser, sem o feed pular
 * enquanto ela le.
 */
function vigiarPostsNovos(feed, desde, aviso, vez) {
    clearInterval(estado.vigiaDoFeed);
    const perguntar = async () => {
        if (vez !== estado.render) {
            clearInterval(estado.vigiaDoFeed);
            return;
        }
        if (document.hidden) return;
        try {
            const {novos} = await chamar('GET', '/api/comunidade/novidades?feed=' + feed + '&desde=' + encodeURIComponent(desde));
            if (vez !== estado.render || novos < POSTS_NOVOS_PARA_AVISAR) return;
            aviso.replaceChildren(h('span', {'aria-hidden': 'true'}, '↑ '), (novos >= 99 ? '99+' : String(novos)) + ' posts novos', h('b', null, ' · Atualizar'));
            aviso.hidden = false;
        } catch (e) {
            // sem aviso desta vez
        }
    };
    estado.vigiaDoFeed = setInterval(perguntar, INTERVALO_DOS_POSTS_NOVOS_MS);
}

/**
 * Abre um feed: o servidor devolve a ordem dos posts (so os ids, ate 300) e os 20 primeiros. Os seguintes sao pedidos
 * pelos ids, 20 por vez, ao chegar perto do fim: a ordem nao muda enquanto a pessoa rola, e nada se repete.
 * Devolve {geradoEm} quando abriu.
 */
async function carregarFeed(lista, consulta, vez, seVazio) {
    let resposta;
    try {
        resposta = await chamar('GET', '/api/comunidade/feed?' + consulta);
    } catch (e) {
        if (vez !== estado.render) return null;
        // a versao Java do servidor nao tem a Comunidade
        lista.append(/404|não encontrado/i.test(e.message)
            ? vazio('Comunidade indisponível', 'A Comunidade só existe na versão do site publicada no Vercel.')
            : vazio('Algo deu errado', e.message));
        return null;
    }
    if (vez !== estado.render) return null;
    if (resposta.itens.length === 0) {
        lista.append(seVazio);
        return resposta;
    }
    lista.append(...resposta.itens.map(post => cartaoDePost(post)));
    let proximo = resposta.itens.length;
    const mais = h('button', {type: 'button', class: 'botao carregar-mais'}, 'Carregar mais');
    let carregando = false;
    const carregar = async () => {
        if (carregando || proximo >= resposta.ids.length) return;
        carregando = true;
        mais.textContent = 'Carregando…';
        const ids = resposta.ids.slice(proximo, proximo + 20);
        try {
            const posts = await chamar('GET', '/api/comunidade/posts?ids=' + ids.join(','));
            if (vez !== estado.render) return;
            proximo += ids.length;
            mais.before(...posts.map(post => cartaoDePost(post)));
        } catch (e) {
            avisar(e.message, true);
        }
        carregando = false;
        mais.textContent = 'Carregar mais';
        if (proximo >= resposta.ids.length) {
            observador.disconnect();
            mais.replaceWith(h('p', {class: 'fim-do-feed'}, resposta.ids.length >= 300 ? 'Você viu os 300 posts mais relevantes agora. Atualize para ver outros.' : 'Você chegou ao fim.'));
        }
    };
    mais.addEventListener('click', carregar);
    const observador = new IntersectionObserver(entradas => { if (entradas.some(entrada => entrada.isIntersecting)) carregar(); }, {rootMargin: '800px'});
    if (proximo < resposta.ids.length) {
        lista.append(mais);
        observador.observe(mais);
    }
    return resposta;
}

async function carregarSugestoes(lateral, vez) {
    let contas;
    try {
        contas = await chamar('GET', '/api/comunidade/sugestoes');
    } catch (e) {
        return;
    }
    if (vez !== estado.render || contas.length === 0) return;
    // em cima de tudo na lateral (o banner da direita fica embaixo)
    lateral.prepend(h('section', {class: 'caixa-da-comunidade'},
        h('h2', null, 'Quem seguir'),
        ...contas.map(conta => h('div', {class: 'sugestao'},
            h('a', {class: 'quem', href: '#/comunidade/perfil/' + conta.id}, avatar(conta), h('span', null, h('b', null, conta.nick),
                h('small', null, conta.posts === 1 ? '1 post no último mês' : conta.posts + ' posts no último mês'))),
            botaoDeSeguir(conta.id, false)))));
}

/**
 * Todos os botoes de seguir criados, de qualquer conta (fracos: os que sairam da tela vao embora sozinhos). Seguir
 * alguem por um botao atualiza os outros da mesma pessoa: os outros posts dela, o "Quem seguir", o perfil e tambem o
 * feed guardado ao abrir um post, que volta como estava.
 */
const botoesDeSeguir = new Set();
function avisarBotoesDeSeguir(contaId, sigo) {
    for (const referencia of botoesDeSeguir) {
        const botao = referencia.deref();
        if (!botao) botoesDeSeguir.delete(referencia);
        else if (botao.dataset.conta === contaId) botao.mostrarSigo(sigo);
    }
}

/** Seguir / Seguindo (passar o mouse mostra "Deixar de seguir"). */
function botaoDeSeguir(contaId, sigo, aoMudar) {
    const botao = h('button', {type: 'button', class: 'botao pequeno seguir', 'data-conta': contaId});
    const mostrar = valor => {
        sigo = valor;
        botao.classList.toggle('seguindo', sigo);
        botao.textContent = sigo ? 'Seguindo' : 'Seguir';
        botao.setAttribute('aria-pressed', String(sigo));
    };
    botao.mostrarSigo = mostrar;
    botao.addEventListener('mouseenter', () => { if (sigo) botao.textContent = 'Deixar de seguir'; });
    botao.addEventListener('mouseleave', () => mostrar(sigo));
    botao.addEventListener('click', async () => {
        botao.disabled = true;
        try {
            const perfil = await chamar(sigo ? 'DELETE' : 'POST', '/api/comunidade/contas/' + contaId + '/seguir');
            avisarBotoesDeSeguir(contaId, perfil.sigo);
            if (aoMudar) aoMudar(perfil);
        } catch (e) {
            avisar(e.message, true);
        }
        botao.disabled = false;
    });
    mostrar(sigo);
    botoesDeSeguir.add(new WeakRef(botao));
    return botao;
}

/**
 * A barra de pesquisa em cima do campo de escrever. Enquanto se digita, sugere ate 3 itens (pessoas, depois #tags,
 * depois posts); setas escolhem, Enter abre o escolhido, Esc fecha. Enter sem nada escolhido abre a busca completa.
 */
function barraDeBuscaDaComunidade() {
    const campo = h('input', {type: 'search', class: 'campo-de-busca', placeholder: 'Buscar pessoas, posts ou #tags',
        'aria-label': 'Buscar pessoas, posts ou #tags', autocomplete: 'off', enterkeyhint: 'search',
        role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'sugestoes-da-busca'});
    const lista = h('ul', {class: 'sugestoes-da-busca', id: 'sugestoes-da-busca', role: 'listbox', 'aria-label': 'Sugestões', hidden: true});
    let itens = [];
    let ativo = -1;
    let pedido = 0;
    let espera;

    const destino = item => item.tipo === 'pessoa' ? '#/comunidade/perfil/' + item.id
        : item.tipo === 'hashtag' ? '#/comunidade/busca?q=' + encodeURIComponent('#' + item.tag)
        : '#/comunidade/post/' + item.id;
    const fechar = () => {
        lista.hidden = true;
        campo.setAttribute('aria-expanded', 'false');
        campo.removeAttribute('aria-activedescendant');
        ativo = -1;
    };
    const abrir = item => {
        fechar();
        // o post abre guardando o feed, para voltar ao mesmo ponto
        if (item.tipo === 'post') abrirPost(item.id);
        else location.hash = destino(item);
    };
    const marcar = indice => {
        ativo = indice;
        [...lista.children].forEach((opcao, i) => opcao.setAttribute('aria-selected', String(i === ativo)));
        if (ativo >= 0) campo.setAttribute('aria-activedescendant', 'sugestao-da-busca-' + ativo);
        else campo.removeAttribute('aria-activedescendant');
    };
    const desenhar = () => {
        lista.replaceChildren(...itens.map((item, i) => {
            const conteudo = item.tipo === 'pessoa'
                ? [avatar(item), h('span', {class: 'texto-da-sugestao'}, h('b', null, item.nick), h('small', null, 'Pessoa'))]
                : item.tipo === 'hashtag'
                    ? [h('span', {class: 'icone-da-sugestao', 'aria-hidden': 'true'}, '#'),
                        h('span', {class: 'texto-da-sugestao'}, h('b', null, '#' + item.tag), h('small', null, item.posts === 1 ? '1 post recente' : item.posts + ' posts recentes'))]
                    : [h('span', {class: 'icone-da-sugestao', 'aria-hidden': 'true'}, '“'),
                        h('span', {class: 'texto-da-sugestao'}, h('b', null, item.texto), h('small', null, 'Post de ' + item.autor))];
            // pointerdown (e nao click): o campo nao perde o foco antes de a escolha valer
            return h('li', {class: 'sugestao-da-busca', id: 'sugestao-da-busca-' + i, role: 'option', 'aria-selected': 'false',
                onpointerdown: evento => { evento.preventDefault(); abrir(item); }}, ...conteudo);
        }));
        lista.hidden = itens.length === 0;
        campo.setAttribute('aria-expanded', String(itens.length > 0));
        marcar(-1);
    };
    const sugerir = async () => {
        const meu = ++pedido;
        const texto = campo.value.trim();
        if (!texto.replace(/^[#@]+/, '')) {
            itens = [];
            desenhar();
            return;
        }
        try {
            const achados = await chamar('GET', '/api/comunidade/busca-rapida?q=' + encodeURIComponent(texto));
            if (meu !== pedido || document.activeElement !== campo) return;
            itens = achados;
            desenhar();
        } catch (e) {
            // sem sugestoes: Enter continua fazendo a busca completa
        }
    };
    campo.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(sugerir, 180);
    });
    campo.addEventListener('focus', () => { if (itens.length) desenhar(); });
    campo.addEventListener('blur', fechar);
    campo.addEventListener('keydown', evento => {
        if (lista.hidden) return;
        if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
            evento.preventDefault();
            const passo = evento.key === 'ArrowDown' ? 1 : -1;
            // depois do ultimo (ou antes do primeiro) volta para o campo, sem nada escolhido
            let proximo = ativo + passo;
            if (proximo >= itens.length) proximo = -1;
            else if (proximo < -1) proximo = itens.length - 1;
            marcar(proximo);
        } else if (evento.key === 'Enter' && ativo >= 0) {
            evento.preventDefault();
            abrir(itens[ativo]);
        } else if (evento.key === 'Escape') {
            evento.preventDefault();
            fechar();
        }
    });
    return h('form', {class: 'busca-da-comunidade', role: 'search', onsubmit: evento => {
        evento.preventDefault();
        fechar();
        const texto = campo.value.trim();
        location.hash = '#/comunidade/busca' + (texto ? '?q=' + encodeURIComponent(texto) : '');
    }}, campo, lista);
}

/**
 * Busca da Comunidade: pessoas pelo nick e posts pelo texto, ou so posts com "#tag". O que foi digitado fica no
 * endereco (#/comunidade/busca?q=...), para voltar e compartilhar.
 */
function telaBusca(principal, inicial, vez) {
    document.title = 'Buscar · Comunidade · Viracap';
    const campo = h('input', {type: 'search', class: 'campo-de-busca', value: inicial, placeholder: 'Buscar pessoas, posts ou #tags',
        'aria-label': 'Buscar pessoas, posts ou #tags', autocomplete: 'off', enterkeyhint: 'search'});
    const resultados = h('div', {class: 'resultados-da-busca'});
    principal.append(
        h('a', {class: 'voltar', href: '#/comunidade'}, '← Comunidade'),
        h('h1', null, 'Buscar'),
        h('form', {class: 'barra-de-busca', role: 'search', onsubmit: evento => { evento.preventDefault(); buscar(); }}, campo),
        resultados);

    let pedido = 0;
    const buscar = async () => {
        const meu = ++pedido;
        const texto = campo.value.trim();
        history.replaceState(null, '', '#/comunidade/busca' + (texto ? '?q=' + encodeURIComponent(texto) : ''));
        if (!texto || /^#+$/.test(texto)) {
            resultados.replaceChildren(h('p', {class: 'subtitulo dica-da-busca'},
                'Procure pessoas pelo nick, posts por uma palavra, ou use # para ver os posts de uma tag, como #frieren.'));
            return;
        }
        const soTag = /^#[\p{L}\p{N}_]+$/u.test(texto);
        const secaoDePessoas = h('section', {class: 'secao-da-busca'}, h('h2', null, 'Pessoas'));
        const feed = h('div', {class: 'feed'});
        const secaoDePosts = h('section', {class: 'secao-da-busca'}, h('h2', null, soTag ? 'Posts com ' + texto : 'Posts'), feed);
        resultados.replaceChildren(...(soTag ? [secaoDePosts] : [secaoDePessoas, secaoDePosts]));
        if (!soTag) {
            try {
                const achadas = await chamar('GET', '/api/comunidade/pessoas?q=' + encodeURIComponent(texto));
                if (meu !== pedido || vez !== estado.render) return;
                secaoDePessoas.append(achadas.length === 0
                    ? h('p', {class: 'subtitulo'}, 'Ninguém com esse nick.')
                    : h('div', {class: 'pessoas-encontradas'}, ...achadas.map(pessoa => linhaDePessoa(pessoa))));
            } catch (e) {
                if (meu === pedido) secaoDePessoas.append(h('p', {class: 'subtitulo'}, e.message));
            }
        }
        if (meu !== pedido || vez !== estado.render) return;
        await carregarFeed(feed, 'feed=busca&q=' + encodeURIComponent(texto), vez,
            vazio(soTag ? 'Nenhum post com ' + texto : 'Nenhum post encontrado', soTag ? 'Seja o primeiro a usar essa tag.' : ''));
    };
    let espera;
    campo.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(buscar, 350);
    });
    buscar();
    requestAnimationFrame(() => campo.focus());
}

/** Uma pessoa numa lista (busca, seguidores, seguindo): foto, nick, descricao ou seguidores, e o botao de seguir. */
function linhaDePessoa(pessoa, aoMudar) {
    const linha = h('div', {class: 'pessoa-encontrada'},
        h('a', {class: 'quem', href: '#/comunidade/perfil/' + pessoa.id}, avatar(pessoa),
            h('span', null, h('b', null, pessoa.nick),
                h('small', null, pessoa.descricao || (pessoa.seguidores === 1 ? '1 seguidor' : pessoa.seguidores + ' seguidores')))));
    if (!pessoa.euMesmo) linha.append(botaoDeSeguir(pessoa.id, pessoa.sigo, aoMudar));
    return linha;
}

/**
 * Quem segue a pessoa do perfil (qual 'seguidores') ou quem ela segue (qual 'seguindo'), numa janela por cima do
 * perfil. Clicar numa pessoa abre o perfil dela; ao fechar depois de seguir alguem, os numeros do perfil sao refeitos.
 */
async function janelaDeSeguir(perfil, qual) {
    const titulo = qual === 'seguidores' ? 'Seguidores de ' + perfil.nick : perfil.nick + ' segue';
    const conteudo = h('div', {class: 'lista-de-seguir'}, h('p', {class: 'subtitulo'}, 'Carregando…'));
    const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
    const dialogo = h('dialog', {class: 'janela-de-seguir', 'aria-label': titulo},
        h('div', {class: 'topo-da-janela'}, h('h2', null, titulo), fechar),
        conteudo);
    let mudou = false;
    fechar.addEventListener('click', () => dialogo.close());
    // ir para outro perfil fecha a janela
    dialogo.addEventListener('click', evento => {
        if (evento.target.closest('a.quem')) dialogo.close();
    });
    dialogo.addEventListener('close', () => {
        dialogo.remove();
        if (mudou && location.hash === '#/comunidade/perfil/' + perfil.id) telaComunidade(['perfil', perfil.id]);
    });
    document.body.append(dialogo);
    dialogo.showModal();
    try {
        const pessoas = await chamar('GET', '/api/comunidade/contas/' + encodeURIComponent(perfil.id) + '/' + qual);
        conteudo.replaceChildren(...(pessoas.length === 0
            ? [h('p', {class: 'subtitulo'}, qual === 'seguidores'
                ? (perfil.euMesmo ? 'Ninguém segue você ainda.' : 'Ninguém segue ' + perfil.nick + ' ainda.')
                : (perfil.euMesmo ? 'Você ainda não segue ninguém.' : perfil.nick + ' ainda não segue ninguém.'))]
            : pessoas.map(pessoa => linhaDePessoa(pessoa, () => { mudou = true; }))));
    } catch (e) {
        conteudo.replaceChildren(h('p', {class: 'subtitulo'}, e.message));
    }
}

async function telaPerfil(principal, id, vez) {
    let perfil;
    try {
        perfil = await chamar('GET', '/api/comunidade/contas/' + encodeURIComponent(id));
    } catch (e) {
        if (vez === estado.render) principal.append(vazio('Leitor não encontrado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    document.title = perfil.nick + ' · Comunidade · Viracap';
    // no perfil de outra pessoa, a pagina toda fica com o tema dela; sair do perfil volta o seu (em rota)
    if (!perfil.euMesmo) mostrarTemaNaPagina(temaParaVer(perfil.tema));
    const numeros = h('p', {class: 'numeros-do-perfil'});
    const mostrarNumeros = dados => numeros.replaceChildren(
        h('button', {type: 'button', class: 'numero-clicavel', onclick: () => janelaDosMangasDoPerfil(perfil)},
            h('b', null, String(perfil.mangas)), perfil.mangas === 1 ? ' mangá' : ' mangás'),
        h('span', null, h('b', null, String(dados.posts)), dados.posts === 1 ? ' post' : ' posts'),
        // clicar nos seguidores ou em "seguindo" mostra quem sao
        h('button', {type: 'button', class: 'numero-clicavel', onclick: () => janelaDeSeguir(perfil, 'seguidores')},
            h('b', null, String(dados.seguidores)), dados.seguidores === 1 ? ' seguidor' : ' seguidores'),
        h('button', {type: 'button', class: 'numero-clicavel', onclick: () => janelaDeSeguir(perfil, 'seguindo')},
            h('b', null, String(dados.seguindo)), ' seguindo'));
    mostrarNumeros(perfil);
    const lista = h('div', {class: 'feed'});
    // append escreveria "null" como texto: o que nao vale fica de fora
    principal.append(...[
        h('a', {class: 'voltar', href: '#/comunidade'}, '← Comunidade'),
        h('div', {class: 'cabecalho-do-perfil'},
            avatar(perfil, true),
            h('h1', null, perfil.nick),
            perfil.descricao ? h('p', {class: 'descricao-do-perfil'}, textoComHashtags(perfil.descricao)) : null,
            h('p', {class: 'subtitulo'}, 'Na Comunidade desde ' + new Date(perfil.criadaEm).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})),
            numeros,
            // o proprio perfil fica como os outros veem, com o que da para mudar nele e o caminho para as configuracoes
            perfil.euMesmo
                ? h('div', {class: 'acoes-do-perfil'},
                    h('button', {type: 'button', class: 'botao pequeno primario', onclick: () => editarPerfil(perfil)}, 'Editar perfil'),
                    h('a', {class: 'botao pequeno', href: '#/conta'}, h('span', {'aria-hidden': 'true'}, '⚙ '), 'Configurações'))
                : botaoDeSeguir(perfil.id, perfil.sigo, mostrarNumeros)),
        perfil.moderacao ? caixaDeModeracao(perfil) : null,
        perfil.euMesmo ? avisarSePunido(editorDePost(post => porNoFeed(lista, post))) : null,
        lista].filter(Boolean));
    estado.recarregar = () => telaComunidade(['perfil', id]);
    await carregarFeed(lista, 'feed=perfil&conta=' + perfil.id, vez,
        vazio(perfil.euMesmo ? 'Você ainda não postou' : perfil.nick + ' ainda não postou', perfil.euMesmo ? 'Escreva o primeiro post aqui em cima.' : ''));
}

/**
 * Editar o proprio perfil, numa janela por cima dele: foto, nick e descricao (ate 300 caracteres). A foto e salva
 * na hora em que e escolhida; o nick e a descricao, ao clicar em Salvar. Depois, o perfil e desenhado de novo.
 */
function editarPerfil(perfil) {
    const conta = estado.sessao.conta;
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const previa = h('span', {class: 'previa-da-foto'}, avatar(conta, true));
    const arquivo = h('input', {type: 'file', id: 'perfil-foto', accept: 'image/png,image/jpeg,image/webp,image/gif'});
    const remover = h('button', {type: 'button', class: 'botao pequeno', hidden: !conta.foto}, 'Remover foto');
    const textoDoEscolher = h('span', null, conta.foto ? 'Trocar foto' : 'Escolher foto');
    const nick = h('input', {type: 'text', id: 'perfil-nick', value: conta.nick, maxlength: '40', required: true, autocomplete: 'nickname'});
    const descricao = h('textarea', {id: 'perfil-descricao', maxlength: '300', rows: '4', placeholder: 'Conte o que você gosta de ler…'});
    descricao.value = perfil.descricao || '';
    const contador = h('small', {class: 'contador-da-descricao', 'aria-live': 'polite'});
    const contar = () => { contador.textContent = [...descricao.value].length + '/300'; };
    descricao.addEventListener('input', contar);
    contar();
    let mudou = false;
    const trocarFoto = async foto => {
        const sessao = await chamar('PUT', '/api/conta', {foto});
        estado.sessao = sessao;
        Object.assign(conta, sessao.conta);
        mostrarConta(sessao.conta);
        previa.replaceChildren(avatar(conta, true));
        remover.hidden = !conta.foto;
        textoDoEscolher.textContent = conta.foto ? 'Trocar foto' : 'Escolher foto';
        mudou = true;
    };
    arquivo.addEventListener('change', async () => {
        const escolhido = arquivo.files[0];
        arquivo.value = '';
        if (!escolhido) return;
        erro.textContent = '';
        try {
            const recortada = await recortarQuadrado(escolhido, 256);
            const envio = new FormData();
            envio.append('arquivo', recortada, 'foto.' + (recortada.type === 'image/webp' ? 'webp' : 'jpg'));
            await trocarFoto((await chamar('POST', '/api/imagens', envio)).imagePath);
            avisar('Foto salva');
        } catch (e) {
            erro.textContent = e.message && !/decode|bitmap/i.test(e.message) ? e.message : 'Não foi possível ler essa imagem. Escolha outra.';
        }
    });
    remover.addEventListener('click', async () => {
        erro.textContent = '';
        try {
            await trocarFoto(null);
            avisar('Foto removida');
        } catch (e) {
            erro.textContent = e.message;
        }
    });
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');
    const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
    const formulario = h('form', {class: 'formulario-do-perfil'},
        h('div', {class: 'linha-da-foto'}, previa,
            h('label', {class: 'botao pequeno', for: 'perfil-foto'}, textoDoEscolher, arquivo),
            remover),
        h('div', {class: 'campo'}, h('label', {for: 'perfil-nick'}, 'Nick'), nick),
        h('div', {class: 'campo'}, h('label', {for: 'perfil-descricao'}, 'Descrição'), descricao, contador),
        erro,
        h('div', {class: 'acoes'}, h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'), salvar));
    const dialogo = h('dialog', {class: 'janela-do-perfil'},
        h('div', {class: 'topo-da-janela'}, h('h2', null, 'Editar perfil'), fechar),
        formulario);
    fechar.addEventListener('click', () => dialogo.close());
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        salvar.disabled = true;
        try {
            if (nick.value.trim() !== conta.nick) {
                const sessao = await chamar('PUT', '/api/conta', {nick: nick.value});
                estado.sessao = sessao;
                Object.assign(conta, sessao.conta);
                mostrarConta(sessao.conta);
            }
            if (descricao.value.trim() !== (perfil.descricao || '')) await chamar('PUT', '/api/comunidade/perfil', {descricao: descricao.value});
            mudou = true;
            avisar('Perfil salvo');
            dialogo.close();
        } catch (e) {
            erro.textContent = e.message;
        }
        salvar.disabled = false;
    });
    dialogo.addEventListener('close', () => {
        dialogo.remove();
        if (mudou && location.hash.startsWith('#/comunidade/perfil/')) telaComunidade(['perfil', perfil.id]);
    });
    document.body.append(dialogo);
    dialogo.showModal();
}

// ------------------------------------------------------------------ moderacao

/** "18/10/2026, 14:30", no horario de quem esta vendo. */
function dataEHora(quando) {
    return new Date(quando).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
}

/** "Suspensa até 18/10/2026, 14:30" ou "Banida". */
function descricaoDaPunicao(punicao) {
    return punicao.tipo === 'banida' ? 'Banida' : 'Suspensa até ' + dataEHora(punicao.ate);
}

/**
 * Quem esta suspenso ou banido ve um aviso no lugar do campo de escrever (o servidor recusa de qualquer jeito, mas
 * assim a pessoa sabe antes de tentar).
 */
function avisarSePunido(editor) {
    chamar('GET', '/api/comunidade/situacao').then(({punicao}) => {
        if (!punicao || !editor.isConnected) return;
        const banida = punicao.tipo === 'banida';
        editor.replaceWith(h('div', {class: 'aviso-de-punicao', role: 'status'},
            h('b', null, banida ? 'Sua conta foi banida da Comunidade' : 'Sua conta está suspensa até ' + dataEHora(punicao.ate)),
            h('p', null, banida
                ? 'Você não pode publicar nem comentar até um administrador tirar o banimento. Ainda dá para ler, curtir e seguir.'
                : 'Até lá, você não pode publicar nem comentar. Ainda dá para ler, curtir e seguir.'),
            punicao.motivo ? h('p', null, h('b', null, 'Motivo: '), punicao.motivo) : null));
    }).catch(() => {});
    return editor;
}

const DURACOES_DE_SUSPENSAO = [['1 hora', 1], ['6 horas', 6], ['1 dia', 24], ['3 dias', 72], ['7 dias', 168], ['30 dias', 720], ['90 dias', 2160], ['1 ano', 8760]];

/** "3 dias", "6 horas"... para o registro. */
function descricaoDeHoras(horas) {
    const conhecida = DURACOES_DE_SUSPENSAO.find(([, valor]) => valor === horas);
    if (conhecida) return conhecida[0];
    return horas % 24 === 0 ? horas / 24 + ' dias' : horas + ' horas';
}

/**
 * Janela para suspender (com a duracao) ou banir: devolve {horas, motivo}, ou null se cancelar. O motivo e opcional
 * e aparece para quem foi punido.
 */
function janelaDePunicao(conta, banir) {
    return new Promise(resolver => {
        const duracao = h('select', {id: 'duracao-da-suspensao'},
            ...DURACOES_DE_SUSPENSAO.map(([texto, horas]) => h('option', {value: String(horas), selected: horas === 24}, texto)));
        const motivo = h('textarea', {id: 'motivo-da-punicao', maxlength: '300', rows: '3', placeholder: 'Ex.: imagens impróprias, ofensas nos comentários…'});
        const dialogo = h('dialog', {class: 'confirmacao janela-de-punir'},
            h('form', {method: 'dialog'},
                h('h2', null, (banir ? 'Banir ' : 'Suspender ') + conta.nick + '?'),
                h('p', null, banir
                    ? 'A conta não poderá publicar nem comentar na Comunidade até um administrador tirar o banimento.'
                    : 'A conta não poderá publicar nem comentar na Comunidade até o fim da suspensão.'),
                banir ? null : h('label', {class: 'campo-da-punicao'}, h('span', null, 'Por quanto tempo'), duracao),
                h('label', {class: 'campo-da-punicao'}, h('span', null, 'Motivo (opcional, aparece para a pessoa)'), motivo),
                h('div', {class: 'acoes'},
                    h('button', {value: 'nao', class: 'botao'}, 'Cancelar'),
                    h('button', {value: 'sim', class: 'botao perigo cheio'}, banir ? 'Banir' : 'Suspender'))));
        dialogo.addEventListener('close', () => {
            resolver(dialogo.returnValue === 'sim' ? {horas: Number(duracao.value), motivo: motivo.value.trim()} : null);
            dialogo.remove();
        });
        document.body.append(dialogo);
        dialogo.showModal();
    });
}

/**
 * Os botoes de moderacao de uma conta: suspender e banir, ou tirar a punicao. aoMudar recebe a punicao nova (ou
 * null) depois que o servidor confirma.
 */
function botoesDeModeracao(conta, aoMudar) {
    const base = '/api/comunidade/gerenciamento/contas/' + conta.id;
    const agir = async (fazer, botao) => {
        botao.disabled = true;
        try {
            const resposta = await fazer();
            if (resposta) aoMudar(resposta.punicao);
        } catch (e) {
            avisar(e.message, true);
        }
        botao.disabled = false;
    };
    if (conta.punicao) {
        const banida = conta.punicao.tipo === 'banida';
        const tirar = h('button', {type: 'button', class: 'botao pequeno'}, banida ? 'Desbanir' : 'Tirar suspensão');
        tirar.addEventListener('click', () => agir(async () => {
            if (!(await confirmar(banida ? 'Desbanir ' + conta.nick + '?' : 'Tirar a suspensão de ' + conta.nick + '?',
                'A conta volta a poder publicar e comentar na Comunidade.', banida ? 'Desbanir' : 'Tirar suspensão', false))) return null;
            const resposta = await chamar('DELETE', base + '/punicao');
            avisar(banida ? 'A conta de ' + conta.nick + ' foi desbanida' : 'A suspensão de ' + conta.nick + ' foi tirada');
            return resposta;
        }, tirar));
        // suspensa ainda pode virar banida
        const banirAgora = banida ? null : h('button', {type: 'button', class: 'botao pequeno perigo'}, 'Banir');
        banirAgora?.addEventListener('click', () => agir(async () => {
            const escolha = await janelaDePunicao(conta, true);
            if (!escolha) return null;
            const resposta = await chamar('POST', base + '/banimento', {motivo: escolha.motivo});
            avisar('A conta de ' + conta.nick + ' foi banida');
            return resposta;
        }, banirAgora));
        return [tirar, banirAgora];
    }
    const suspender = h('button', {type: 'button', class: 'botao pequeno'}, 'Suspender');
    suspender.addEventListener('click', () => agir(async () => {
        const escolha = await janelaDePunicao(conta, false);
        if (!escolha) return null;
        const resposta = await chamar('POST', base + '/suspensao', escolha);
        avisar('A conta de ' + conta.nick + ' foi suspensa por ' + descricaoDeHoras(escolha.horas));
        return resposta;
    }, suspender));
    const banir = h('button', {type: 'button', class: 'botao pequeno perigo'}, 'Banir');
    banir.addEventListener('click', () => agir(async () => {
        const escolha = await janelaDePunicao(conta, true);
        if (!escolha) return null;
        const resposta = await chamar('POST', base + '/banimento', {motivo: escolha.motivo});
        avisar('A conta de ' + conta.nick + ' foi banida');
        return resposta;
    }, banir));
    return [suspender, banir];
}

/** No perfil, para admins: a situacao da conta e os botoes de moderacao. */
function caixaDeModeracao(perfil) {
    const caixa = h('section', {class: 'caixa-de-moderacao', 'aria-label': 'Moderação'});
    const desenhar = punicao => {
        const conta = {id: perfil.id, nick: perfil.nick, punicao};
        // replaceChildren escreveria "null" como texto: o que nao vale fica de fora
        caixa.replaceChildren(...[
            h('div', {class: 'situacao-da-moderacao'},
                h('b', null, 'Moderação'),
                h('span', {class: 'selo-de-punicao' + (punicao ? ' ' + punicao.tipo : '')}, punicao ? descricaoDaPunicao(punicao) : 'Sem punição'),
                punicao?.motivo ? h('small', null, 'Motivo: ' + punicao.motivo) : null),
            perfil.moderacao.podePunir
                ? h('div', {class: 'acoes-de-moderacao'}, ...botoesDeModeracao(conta, desenhar))
                : h('small', null, 'Administradores não podem ser suspensos nem banidos.')].filter(Boolean));
    };
    desenhar(perfil.moderacao.punicao);
    return caixa;
}

/** O que cada linha do registro conta, em uma frase. */
function frasesDoRegistro(item) {
    const quem = item.conta ? h('a', {href: '#/comunidade/perfil/' + item.conta.id}, item.conta.nick) : 'uma conta apagada';
    const admin = h('b', null, item.admin || 'Um admin');
    const detalhes = item.detalhes || {};
    switch (item.acao) {
    case 'suspender': return [admin, ' suspendeu ', quem, ' por ' + descricaoDeHoras(detalhes.horas)];
    case 'banir': return [admin, ' baniu ', quem];
    case 'tirar_suspensao': return [admin, ' tirou a suspensão de ', quem];
    case 'desbanir': return [admin, ' tirou o banimento de ', quem];
    case 'apagar_post': return [admin, ' apagou um post de ', quem, detalhes.texto ? ': “' + detalhes.texto + '”' : ''];
    case 'apagar_comentario': return [admin, ' apagou um comentário de ', quem, detalhes.texto ? ': “' + detalhes.texto + '”' : ''];
    case 'imagem_barrada': {
        // com a OpenAI (doc 89), a nota dela; sem, a do modelo local
        const nota = detalhes.fonte === 'openai'
            ? 'conteúdo sexual, pela OpenAI: ' + Math.round((detalhes.openai?.sexual || 0) * 100) + '%'
            : 'foto explícita: ' + Math.round((detalhes.probabilidades?.Porn || 0) * 100) + '%';
        return [h('b', null, 'O robô'), ' barrou uma imagem de ', quem, ' (' + (detalhes.onde === 'foto' ? 'foto de perfil' : 'post') + '; ' + nota + ')'];
    }
    default: return [admin, ' ' + item.acao + ' ', quem];
    }
}

/** Tela de gerenciamento (so admins): as contas, com busca e filtro, e o registro da moderacao. */
async function telaGerenciar(partes) {
    const vez = ++estado.render;
    document.title = 'Gerenciar · Viracap';
    if (!estado.sessao?.conta?.admin) {
        app.replaceChildren(vazio('Só para administradores', 'Esta página é usada pelos administradores para moderar a Comunidade.',
            h('a', {class: 'botao', href: '#/comunidade'}, 'Ir para a Comunidade')));
        return;
    }
    // o painel e as financas sao so do dono do site (e o painel abre primeiro para ele); os outros admins moderam
    const dono = estado.sessao.conta.dono === true;
    const permitidas = dono ? ['painel', 'financas', 'banners', 'imagens', 'contas', 'registro'] : ['contas', 'registro'];
    const aba = permitidas.includes(partes[0]) ? partes[0] : permitidas[0];
    const conteudo = h('div', {class: 'conteudo-do-gerenciamento'});
    const link = (nome, endereco, texto) => h('a', {class: 'aba', href: endereco, 'aria-current': aba === nome ? 'page' : null}, texto);
    app.replaceChildren(h('div', {class: 'pagina-de-gerenciamento'},
        h('h1', null, 'Gerenciar'),
        h('p', {class: 'subtitulo'}, dono
            ? 'Acompanhe os acessos e o dinheiro do site, suspenda ou bana contas da Comunidade e veja o que os administradores e o robô de imagens fizeram.'
            : 'Suspenda ou bana contas da Comunidade e veja o que os administradores e o robô de imagens fizeram.'),
        rolagemDasAbas(h('nav', {class: 'abas', 'aria-label': 'Gerenciamento'},
            dono ? link('painel', '#/gerenciar/painel', 'Painel') : null,
            dono ? link('financas', '#/gerenciar/financas', 'Finanças') : null,
            dono ? link('banners', '#/gerenciar/banners', 'Banners') : null,
            dono ? link('imagens', '#/gerenciar/imagens', 'Imagens da loja') : null,
            link('contas', '#/gerenciar/contas', 'Contas'),
            link('registro', '#/gerenciar/registro', 'Registro'))),
        conteudo));
    estado.recarregar = () => telaGerenciar(partes);
    if (aba === 'registro') return registroDoGerenciamento(conteudo, vez);
    if (aba === 'contas') return contasDoGerenciamento(conteudo, vez);
    if (aba === 'financas') return financasDoGerenciamento(conteudo, vez, partes[1]);
    if (aba === 'imagens') return imagensDaLojaNoGerenciamento(conteudo, vez);
    if (aba === 'banners') return partes[1] ? relatorioDoBannerNoGerenciamento(conteudo, vez, partes[1]) : bannersNoGerenciamento(conteudo, vez);
    return painelDoGerenciamento(conteudo, vez);
}

// ------------------------------------------------------------------ painel (so admins)

const numeroCurto = valor => valor >= 10000 ? (valor / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' mil' : valor.toLocaleString('pt-BR');
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** '2026-10-17' -> '17/10'; '2026-10' -> 'out 2026'. */
const diaCurto = dia => dia.slice(8, 10) + '/' + dia.slice(5, 7);
const mesCurto = mes => MESES_CURTOS[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4);

/** Um numero do painel: o nome, o valor e, se houver, a comparacao com o mes passado. */
function quadroDoPainel(rotulo, valor, comparacoes, principal) {
    return h('div', {class: 'quadro-do-painel' + (principal ? ' principal' : '')},
        h('span', {class: 'rotulo-do-quadro'}, rotulo),
        h('b', {class: 'valor-do-quadro'}, numeroCurto(valor)),
        ...[comparacoes].flat().filter(Boolean).map(texto => h('small', null, texto)));
}

/** Topo arredondado para o eixo (4, 6, 8, 10, 20, 40...), sempre no maior valor ou acima dele. */
function topoDoEixo(maximo) {
    if (maximo <= 4) return 4;
    const potencia = 10 ** Math.floor(Math.log10(maximo));
    // passos com metade redonda: a linha do meio da grade tambem fica com um numero redondo
    for (const passo of [1, 2, 4, 6, 8, 10]) if (passo * potencia >= maximo) return passo * potencia;
    return 10 * potencia;
}

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, atributos, ...filhos) {
    const el = document.createElementNS(SVG, tag);
    for (const [nome, valor] of Object.entries(atributos || {})) if (valor != null) el.setAttribute(nome, valor);
    el.append(...filhos);
    return el;
}

/**
 * Grafico de colunas de uma serie (um valor por dia), desenhado na largura que couber e refeito quando ela muda. A
 * dica (tooltip) segue o ponteiro e mostra o dia mais perto; as setas do teclado andam pelos dias. Os mesmos numeros
 * ficam na tabela embaixo, para quem nao usa o mouse ou o leitor de tela.
 */
function graficoDeColunas(titulo, itens, campo, {detalhe, media} = {}) {
    const area = h('div', {class: 'area-do-grafico'});
    const dica = h('div', {class: 'dica-do-grafico', role: 'status', hidden: true});
    const total = itens.reduce((soma, item) => soma + item[campo], 0);
    // usuarios ativos nao se somam (a mesma pessoa conta em varios dias): para eles, a media por dia
    const resumo = media
        ? 'média de ' + (total / itens.length).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' por dia'
        : numeroCurto(total) + ' no período';
    const caixa = h('section', {class: 'grafico-do-painel', 'aria-label': titulo},
        h('div', {class: 'topo-do-grafico'}, h('h3', null, titulo), h('span', {class: 'total-do-grafico'}, resumo)),
        area, dica,
        h('details', {class: 'tabela-do-grafico'}, h('summary', null, 'Ver em tabela'),
            h('table', null,
                h('thead', null, h('tr', null, h('th', {scope: 'col'}, 'Dia'), h('th', {scope: 'col'}, titulo))),
                h('tbody', null, ...itens.slice().reverse().map(item => h('tr', null, h('td', null, diaCurto(item.dia)), h('td', null, item[campo].toLocaleString('pt-BR'))))))));
    let marcado = -1;
    let medidas = null;
    const desenhar = () => {
        const largura = Math.max(260, area.clientWidth);
        const altura = 180;
        const margem = {topo: 10, direita: 6, baixo: 24, esquerda: 34};
        const util = largura - margem.esquerda - margem.direita;
        const fatia = util / itens.length;
        const coluna = Math.max(2, Math.min(24, fatia - 2));
        const topo = topoDoEixo(Math.max(...itens.map(item => item[campo])));
        const y = valor => margem.topo + (altura - margem.topo - margem.baixo) * (1 - valor / topo);
        const grafico = svg('svg', {width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`, role: 'img',
            'aria-label': titulo + ' nos últimos ' + itens.length + ' dias: ' + resumo});
        // grade: tres linhas recessivas com os valores do eixo
        for (const parte of [0, 0.5, 1]) {
            const valor = topo * parte;
            grafico.append(
                svg('line', {x1: margem.esquerda, x2: largura - margem.direita, y1: y(valor), y2: y(valor), class: parte === 0 ? 'base' : 'grade'}),
                svg('text', {x: margem.esquerda - 6, y: y(valor) + 4, 'text-anchor': 'end', class: 'eixo'}, numeroCurto(valor)));
        }
        const barras = itens.map((item, i) => {
            const centro = margem.esquerda + fatia * (i + 0.5);
            const alto = y(0) - y(item[campo]);
            if (alto <= 0) return null;
            // topo arredondado (4 px, ou menos em colunas finas), base reta
            const r = Math.min(4, coluna / 2, alto);
            const x0 = centro - coluna / 2;
            const base = y(0);
            const caminho = `M${x0},${base} V${base - alto + r} Q${x0},${base - alto} ${x0 + r},${base - alto} H${x0 + coluna - r} Q${x0 + coluna},${base - alto} ${x0 + coluna},${base - alto + r} V${base} Z`;
            const barra = svg('path', {d: caminho, class: 'coluna'});
            grafico.append(barra);
            return barra;
        });
        // rotulos do eixo x: o primeiro, o do meio e o ultimo dia
        for (const i of [...new Set([0, Math.floor((itens.length - 1) / 2), itens.length - 1])]) {
            grafico.append(svg('text', {x: margem.esquerda + fatia * (i + 0.5), y: altura - 6, 'text-anchor': i === 0 ? 'start' : i === itens.length - 1 ? 'end' : 'middle', class: 'eixo'}, diaCurto(itens[i].dia)));
        }
        area.replaceChildren(grafico);
        medidas = {margem, fatia, barras, largura};
        if (marcado >= 0) mostrar(marcado);
    };
    const mostrar = i => {
        marcado = i;
        medidas.barras.forEach((barra, j) => barra?.classList.toggle('marcada', j === i));
        const item = itens[i];
        dica.replaceChildren(h('b', null, item[campo].toLocaleString('pt-BR')), h('span', null, diaCurto(item.dia) + (detalhe ? ' · ' + detalhe(item) : '')));
        dica.hidden = false;
        const centro = medidas.margem.esquerda + medidas.fatia * (i + 0.5);
        dica.style.left = Math.min(Math.max(centro, 70), medidas.largura - 70) + 'px';
    };
    const esconder = () => {
        marcado = -1;
        dica.hidden = true;
        medidas?.barras.forEach(barra => barra?.classList.remove('marcada'));
    };
    area.tabIndex = 0;
    area.setAttribute('aria-label', titulo + '. Use as setas para andar pelos dias.');
    area.addEventListener('pointermove', evento => {
        const x = evento.clientX - area.getBoundingClientRect().left - medidas.margem.esquerda;
        mostrar(Math.max(0, Math.min(itens.length - 1, Math.floor(x / medidas.fatia))));
    });
    area.addEventListener('pointerleave', esconder);
    area.addEventListener('blur', esconder);
    area.addEventListener('keydown', evento => {
        if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
        evento.preventDefault();
        const passo = evento.key === 'ArrowRight' ? 1 : -1;
        mostrar(marcado < 0 ? itens.length - 1 : Math.max(0, Math.min(itens.length - 1, marcado + passo)));
    });
    // so a largura importa: redesenhar muda a altura, e isso nao pode disparar outro desenho
    let larguraDesenhada = 0;
    new ResizeObserver(() => {
        if (area.clientWidth === larguraDesenhada) return;
        larguraDesenhada = area.clientWidth;
        desenhar();
    }).observe(area);
    return caixa;
}

/**
 * Painel: usuarios ativos, acessos e contas criadas. Os numeros do mes no topo (com o mes passado para comparar), um
 * grafico por dia de cada um no periodo escolhido (7, 30 ou 90 dias) e uma tabela com os ultimos 12 meses.
 */
async function painelDoGerenciamento(conteudo, vez, periodo = estado.periodoDoPainel || 30) {
    const filtros = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Período dos gráficos'},
        ...[7, 30, 90].map(dias => h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(periodo === dias), onclick: () => {
            estado.periodoDoPainel = dias;
            painelDoGerenciamento(conteudo, vez, dias);
        }}, dias + ' dias')));
    let dados;
    try {
        dados = await chamar('GET', '/api/comunidade/gerenciamento/painel?periodo=' + periodo);
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Não deu para carregar o painel', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const n = dados.numeros;
    const mesPassado = valor => 'mês passado: ' + valor.toLocaleString('pt-BR');
    const linhaDoMes = item => h('tr', null, h('th', {scope: 'row'}, mesCurto(item.mes)),
        h('td', null, item.ativos.toLocaleString('pt-BR')), h('td', null, item.acessos.toLocaleString('pt-BR')), h('td', null, item.contas.toLocaleString('pt-BR')));
    conteudo.replaceChildren(
        h('div', {class: 'numeros-do-painel'},
            quadroDoPainel('Usuários ativos no mês', n.ativosNoMes, [mesPassado(n.ativosNoMesPassado),
                'hoje: ' + n.ativosHoje.toLocaleString('pt-BR') + ' · últimos 7 dias: ' + n.ativos7Dias.toLocaleString('pt-BR')], true),
            quadroDoPainel('Acessos no mês', n.acessosNoMes, mesPassado(n.acessosNoMesPassado)),
            quadroDoPainel('Acessos hoje', n.acessosHoje),
            quadroDoPainel('Contas criadas no mês', n.contasNoMes, mesPassado(n.contasNoMesPassado)),
            quadroDoPainel('Contas no total', n.contas)),
        h('p', {class: 'subtitulo nota-do-painel'}, dados.contandoDesde
            ? 'Acessos e usuários ativos contados desde ' + new Date(dados.contandoDesde + 'T12:00:00').toLocaleDateString('pt-BR') + '. Um acesso é cada vez que alguém abre o site; um usuário ativo é uma conta que usou o site no período. Robôs de busca não contam.'
            : 'A contagem de acessos e usuários ativos começa agora: os números aparecem conforme as pessoas abrirem o site.'),
        filtros,
        h('div', {class: 'graficos-do-painel'},
            graficoDeColunas('Usuários ativos por dia', dados.porDia, 'ativos', {media: true}),
            graficoDeColunas('Acessos por dia', dados.porDia, 'acessos', {detalhe: item => item.comConta + ' com conta, ' + item.semConta + ' sem conta'}),
            graficoDeColunas('Contas criadas por dia', dados.porDia, 'contas')),
        h('section', {class: 'meses-do-painel'},
            h('h3', null, 'Últimos 12 meses'),
            h('div', {class: 'rolagem-da-tabela'},
                h('table', null,
                    h('thead', null, h('tr', null, h('th', {scope: 'col'}, 'Mês'), h('th', {scope: 'col'}, 'Usuários ativos'),
                        h('th', {scope: 'col'}, 'Acessos'), h('th', {scope: 'col'}, 'Contas criadas'))),
                    h('tbody', null, ...dados.porMes.slice().reverse().map(linhaDoMes))))));
}

// ------------------------------------------------------------------ financas (so admins)

const reais = centavos => (centavos / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesPorExtenso = mes => MESES_POR_EXTENSO[Number(mes.slice(5, 7)) - 1] + ' de ' + mes.slice(0, 4);
const somarMesesNoSite = (mes, quantos) => {
    const data = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + quantos, 1));
    return data.toISOString().slice(0, 7);
};
/** "1.234,56", "1234.56", "R$ 12" -> centavos (ou NaN). */
function lerReais(texto) {
    let limpo = String(texto).replace(/[R$\s]/g, '');
    if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return NaN;
    return Math.round(Number(limpo) * 100);
}

/**
 * Pizza (rosca) das fatias [{ nome, valor }]: as cores seguem a ordem da paleta (a maior fatia leva a primeira), um
 * espaco da cor do fundo separa as fatias, e o total fica no meio. A legenda ao lado tem o nome, o valor e a
 * porcentagem de cada fatia (os numeros nao dependem da cor nem do mouse); passar o mouse numa fatia destaca a linha.
 */
function graficoDePizza(titulo, fatias, vazioTexto, rotuloDoMeio = 'no mês', valorDoMeio = null) {
    const total = fatias.reduce((soma, fatia) => soma + fatia.valor, 0);
    const caixa = h('section', {class: 'pizza-do-painel', 'aria-label': titulo}, h('h3', null, titulo));
    if (!total) {
        caixa.append(h('p', {class: 'subtitulo'}, vazioTexto));
        return caixa;
    }
    const tamanho = 180;
    const raio = 80;
    const espessura = 30;
    const grafico = svg('svg', {width: tamanho, height: tamanho, viewBox: `0 0 ${tamanho} ${tamanho}`, role: 'img',
        'aria-label': titulo + ': ' + fatias.map(fatia => fatia.nome + ' ' + reais(fatia.valor)).join(', ')});
    const legenda = h('ul', {class: 'legenda-da-pizza'});
    const centro = tamanho / 2;
    let angulo = -Math.PI / 2;
    const ponto = (a, r) => `${centro + r * Math.cos(a)},${centro + r * Math.sin(a)}`;
    const marcar = i => {
        grafico.querySelectorAll('.fatia').forEach((fatia, j) => fatia.classList.toggle('apagada', i >= 0 && j !== i));
        legenda.querySelectorAll('li').forEach((linha, j) => linha.classList.toggle('marcada', j === i));
    };
    fatias.forEach((fatia, i) => {
        const parte = fatia.valor / total;
        const fim = angulo + parte * Math.PI * 2;
        // a cor segue quem a fatia e (quando vem), e nao a posicao
        const cor = fatia.cor || 'var(--serie-' + (i + 1) + ')';
        let forma;
        if (fatias.length === 1) {
            forma = svg('circle', {cx: centro, cy: centro, r: raio - espessura / 2, fill: 'none', stroke: cor, 'stroke-width': espessura, class: 'fatia'});
        } else {
            const grande = parte > 0.5 ? 1 : 0;
            const dentro = raio - espessura;
            forma = svg('path', {class: 'fatia', fill: cor, d: `M${ponto(angulo, raio)} A${raio},${raio} 0 ${grande} 1 ${ponto(fim, raio)} L${ponto(fim, dentro)} A${dentro},${dentro} 0 ${grande} 0 ${ponto(angulo, dentro)} Z`});
        }
        forma.addEventListener('pointerenter', () => marcar(i));
        forma.addEventListener('pointerleave', () => marcar(-1));
        grafico.append(forma);
        const porcentagem = (parte * 100).toLocaleString('pt-BR', {maximumFractionDigits: parte < 0.1 ? 1 : 0}) + '%';
        const linha = h('li', {tabindex: '0'},
            h('span', {class: 'amostra', style: 'background:' + cor, 'aria-hidden': 'true'}),
            h('span', {class: 'nome-da-fatia'}, fatia.nome),
            h('b', null, reais(fatia.valor)),
            h('small', null, porcentagem));
        linha.addEventListener('pointerenter', () => marcar(i));
        linha.addEventListener('pointerleave', () => marcar(-1));
        linha.addEventListener('focus', () => marcar(i));
        linha.addEventListener('blur', () => marcar(-1));
        legenda.append(linha);
        angulo = fim;
    });
    grafico.append(
        svg('text', {x: centro, y: centro - 4, 'text-anchor': 'middle', class: 'total-da-pizza'}, valorDoMeio ?? reais(total)),
        svg('text', {x: centro, y: centro + 16, 'text-anchor': 'middle', class: 'rotulo-da-pizza'}, rotuloDoMeio));
    caixa.append(h('div', {class: 'corpo-da-pizza'}, h('div', {class: 'desenho-da-pizza'}, grafico), legenda));
    return caixa;
}

/**
 * Ganho e perda dos 12 meses: duas colunas por mes, receitas e gastos, com legenda. O mes aberto fica destacado e
 * clicar num mes abre ele. A dica mostra as receitas, os gastos e o resultado.
 */
function graficoDeGanhoEPerda(meses, mesAberto, abrirMes) {
    const area = h('div', {class: 'area-do-grafico'});
    const dica = h('div', {class: 'dica-do-grafico', role: 'status', hidden: true});
    const caixa = h('section', {class: 'grafico-do-painel', 'aria-label': 'Receitas e gastos dos últimos 12 meses'},
        h('div', {class: 'topo-do-grafico'}, h('h3', null, 'Ganho e perda nos últimos 12 meses'),
            h('ul', {class: 'legenda-do-grafico'},
                h('li', null, h('span', {class: 'amostra', style: 'background:var(--serie-1)'}), 'Receitas'),
                h('li', null, h('span', {class: 'amostra', style: 'background:var(--serie-2)'}), 'Gastos'))),
        area, dica);
    let medidas = null;
    const desenhar = () => {
        const largura = Math.max(300, area.clientWidth);
        const altura = 200;
        const margem = {topo: 10, direita: 6, baixo: 24, esquerda: 56};
        const fatia = (largura - margem.esquerda - margem.direita) / meses.length;
        const coluna = Math.max(3, Math.min(20, (fatia - 10) / 2));
        const topo = topoDoEixo(Math.max(1, ...meses.flatMap(item => [item.receitas, item.gastos])) / 100) * 100;
        const y = valor => margem.topo + (altura - margem.topo - margem.baixo) * (1 - valor / topo);
        const grafico = svg('svg', {width: largura, height: altura, viewBox: `0 0 ${largura} ${altura}`, role: 'img',
            'aria-label': 'Receitas e gastos por mês. Os valores estão na tabela abaixo.'});
        for (const parte of [0, 0.5, 1]) {
            grafico.append(
                svg('line', {x1: margem.esquerda, x2: largura - margem.direita, y1: y(topo * parte), y2: y(topo * parte), class: parte === 0 ? 'base' : 'grade'}),
                svg('text', {x: margem.esquerda - 6, y: y(topo * parte) + 4, 'text-anchor': 'end', class: 'eixo'}, reais(topo * parte).replace(',00', '')));
        }
        const coluninha = (x, valor, classe) => {
            const alto = y(0) - y(valor);
            if (alto <= 0) return;
            const r = Math.min(4, coluna / 2, alto);
            const base = y(0);
            grafico.append(svg('path', {class: classe, d: `M${x},${base} V${base - alto + r} Q${x},${base - alto} ${x + r},${base - alto} H${x + coluna - r} Q${x + coluna},${base - alto} ${x + coluna},${base - alto + r} V${base} Z`}));
        };
        meses.forEach((item, i) => {
            const meio = margem.esquerda + fatia * (i + 0.5);
            if (item.mes === mesAberto) grafico.append(svg('rect', {x: meio - fatia / 2 + 2, y: margem.topo, width: fatia - 4, height: altura - margem.topo - margem.baixo, rx: 6, class: 'mes-aberto'}));
            // 2 px entre as duas colunas do mes
            coluninha(meio - coluna - 1, item.receitas, 'coluna-receita');
            coluninha(meio + 1, item.gastos, 'coluna-gasto');
            if (meses.length <= 12 && (fatia > 44 || i % 2 === 0 || i === meses.length - 1)) {
                grafico.append(svg('text', {x: meio, y: altura - 6, 'text-anchor': 'middle', class: 'eixo' + (item.mes === mesAberto ? ' forte' : '')}, mesCurto(item.mes).slice(0, 3) + (item.mes.endsWith('-01') ? ' ' + item.mes.slice(2, 4) : '')));
            }
        });
        area.replaceChildren(grafico);
        medidas = {margem, fatia, largura};
    };
    const mostrar = i => {
        const item = meses[i];
        const resultado = item.receitas - item.gastos;
        dica.replaceChildren(h('b', null, mesCurto(item.mes)),
            h('span', null, 'Receitas: ' + reais(item.receitas)), h('span', null, 'Gastos: ' + reais(item.gastos)),
            h('span', null, (resultado >= 0 ? 'Lucro: ' : 'Prejuízo: ') + reais(Math.abs(resultado))));
        dica.hidden = false;
        dica.style.left = Math.min(Math.max(medidas.margem.esquerda + medidas.fatia * (i + 0.5), 80), medidas.largura - 80) + 'px';
    };
    const indice = evento => Math.max(0, Math.min(meses.length - 1, Math.floor((evento.clientX - area.getBoundingClientRect().left - medidas.margem.esquerda) / medidas.fatia)));
    area.addEventListener('pointermove', evento => mostrar(indice(evento)));
    area.addEventListener('pointerleave', () => { dica.hidden = true; });
    area.addEventListener('click', evento => abrirMes(meses[indice(evento)].mes));
    area.style.cursor = 'pointer';
    let larguraDesenhada = 0;
    new ResizeObserver(() => {
        if (area.clientWidth === larguraDesenhada) return;
        larguraDesenhada = area.clientWidth;
        desenhar();
    }).observe(area);
    return caixa;
}

/**
 * Janela para cadastrar (ou mudar o valor de) um gasto ou uma receita. Mensal: a partir de um mes, com um ultimo mes
 * opcional; de uma vez so: o dia.
 */
function janelaDeLancamento(tipo, mesAberto, aoSalvar) {
    const ehGasto = tipo === 'gasto';
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const nome = h('input', {type: 'text', id: 'lancamento-nome', maxlength: '60', required: true, list: 'sugestoes-de-lancamento',
        placeholder: ehGasto ? 'Ex.: Vercel, Claude, Neon' : 'Ex.: Anúncio da loja X'});
    const sugestoes = h('datalist', {id: 'sugestoes-de-lancamento'},
        ...(ehGasto ? ['Claude', 'Vercel', 'Render', 'Neon', 'Domínio', 'Taxas do Mercado Pago'] : ['Anúncio', 'Patrocínio', 'Doação'])
            .map(valor => h('option', {value: valor})));
    const valor = h('input', {type: 'text', id: 'lancamento-valor', inputmode: 'decimal', required: true, placeholder: '0,00', autocomplete: 'off'});
    let recorrencia = 'mensal';
    const hoje = new Date();
    const diaPadrao = mesAberto === hoje.toISOString().slice(0, 7) ? hoje.toISOString().slice(0, 10) : mesAberto + '-01';
    const inicioMes = h('input', {type: 'month', id: 'lancamento-inicio', value: mesAberto, required: true});
    const fimMes = h('input', {type: 'month', id: 'lancamento-fim'});
    const dia = h('input', {type: 'date', id: 'lancamento-dia', value: diaPadrao});
    const camposMensais = h('div', {class: 'campos-mensais'},
        h('div', {class: 'campo'}, h('label', {for: 'lancamento-inicio'}, 'A partir de'), inicioMes),
        h('div', {class: 'campo'}, h('label', {for: 'lancamento-fim'}, 'Último mês (opcional)'), fimMes,
            h('small', null, ehGasto ? 'Deixe vazio se continua pagando.' : 'Deixe vazio se continua recebendo.')));
    const campoUnico = h('div', {class: 'campo', hidden: true}, h('label', {for: 'lancamento-dia'}, ehGasto ? 'Dia do pagamento' : 'Dia em que recebeu'), dia);
    const opcoes = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Frequência'});
    const desenharOpcoes = () => opcoes.replaceChildren(...[['mensal', 'Todo mês'], ['unica', 'Uma vez só']].map(([qual, texto]) =>
        h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(recorrencia === qual), onclick: () => {
            recorrencia = qual;
            camposMensais.hidden = qual !== 'mensal';
            campoUnico.hidden = qual === 'mensal';
            desenharOpcoes();
        }}, texto)));
    desenharOpcoes();
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');
    const formulario = h('form', {class: 'formulario-de-lancamento'},
        h('div', {class: 'campo'}, h('label', {for: 'lancamento-nome'}, 'Nome'), nome, sugestoes),
        h('div', {class: 'campo'}, h('label', {for: 'lancamento-valor'}, 'Valor em reais'), valor),
        h('div', {class: 'campo'}, h('span', {class: 'rotulo'}, 'Frequência'), opcoes),
        camposMensais, campoUnico, erro,
        h('div', {class: 'acoes'}, h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'), salvar));
    const dialogo = h('dialog', {class: 'janela-de-lancamento'},
        h('div', {class: 'topo-da-janela'}, h('h2', null, ehGasto ? 'Novo gasto' : 'Nova receita'),
            h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar', onclick: () => dialogo.close()}, '×')),
        formulario);
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        const centavos = lerReais(valor.value);
        if (Number.isNaN(centavos) || centavos <= 0) {
            erro.textContent = 'Escreva o valor como 12,50';
            valor.focus();
            return;
        }
        salvar.disabled = true;
        try {
            await chamar('POST', '/api/comunidade/gerenciamento/financas', {tipo, nome: nome.value, valor: centavos, recorrencia,
                inicio: recorrencia === 'mensal' ? inicioMes.value : dia.value, fim: recorrencia === 'mensal' ? fimMes.value || null : null});
            dialogo.close();
            avisar(ehGasto ? 'Gasto salvo' : 'Receita salva');
            aoSalvar();
        } catch (e) {
            erro.textContent = e.message;
            salvar.disabled = false;
        }
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    nome.focus();
}

/**
 * Pizza de receita e despesa, com a escolha entre o mes aberto e o geral (tudo desde o comeco ate o mes atual). A
 * escolha fica guardada enquanto a pagina esta aberta. A legenda traz os valores e as porcentagens, e embaixo vai o
 * resultado (lucro ou prejuizo) do que esta sendo mostrado.
 */
function pizzaDeReceitaEDespesa(dados, mes) {
    const caixa = h('section', {class: 'pizza-de-resultado'});
    const desenhar = () => {
        const geral = estado.pizzaDasFinancas === 'geral';
        const numeros = geral ? dados.geral : dados.resumo;
        const resultado = numeros.receitas - numeros.gastos;
        const escolha = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Período da pizza'},
            ...[['mes', 'Do mês'], ['geral', 'Geral']].map(([valor, texto]) => h('button', {type: 'button', class: 'filtro',
                'aria-pressed': String((estado.pizzaDasFinancas || 'mes') === valor), onclick: () => {
                    estado.pizzaDasFinancas = valor;
                    desenhar();
                }}, texto)));
        const pizza = graficoDePizza(geral ? 'Receita e despesa, no geral' : 'Receita e despesa em ' + mesPorExtenso(mes),
            [{nome: 'Receitas', valor: numeros.receitas, cor: 'var(--serie-1)'}, {nome: 'Despesas', valor: numeros.gastos, cor: 'var(--serie-2)'}].filter(fatia => fatia.valor > 0),
            geral ? 'Nada cadastrado ainda.' : 'Nenhuma receita nem despesa neste mês.',
            // no meio, o resultado (somar receita com despesa nao diria nada)
            resultado > 0 ? 'de lucro' : resultado < 0 ? 'de prejuízo' : 'empatou', reais(Math.abs(resultado)));
        pizza.querySelector('h3').after(escolha,
            h('p', {class: 'resultado-da-pizza ' + (resultado >= 0 ? 'lucro' : 'prejuizo')},
                h('span', {'aria-hidden': 'true'}, resultado >= 0 ? '▲ ' : '▼ '),
                (resultado > 0 ? 'Lucro de ' : resultado < 0 ? 'Prejuízo de ' : 'Empatou: ') + reais(Math.abs(resultado)),
                geral ? ' desde o começo' : ' no mês'));
        caixa.replaceChildren(pizza);
    };
    desenhar();
    return caixa;
}

/** Janela pequena com um campo: mudar o valor de um mensal a partir do mes aberto. */
function janelaDeNovoValor(lancamento, mesAberto, aoSalvar) {
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const valor = h('input', {type: 'text', id: 'novo-valor', inputmode: 'decimal', required: true, value: (lancamento.valor / 100).toFixed(2).replace('.', ',')});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');
    const mensal = lancamento.recorrencia === 'mensal';
    const formulario = h('form', {class: 'formulario-de-lancamento'},
        h('div', {class: 'campo'}, h('label', {for: 'novo-valor'}, 'Novo valor em reais'), valor,
            mensal ? h('small', null, 'Vale a partir de ' + mesPorExtenso(mesAberto) + '. Os meses de antes continuam com o valor antigo.') : null),
        erro,
        h('div', {class: 'acoes'}, h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'), salvar));
    const dialogo = h('dialog', {class: 'janela-de-lancamento'},
        h('div', {class: 'topo-da-janela'}, h('h2', null, 'Mudar o valor de ' + lancamento.nome),
            h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar', onclick: () => dialogo.close()}, '×')),
        formulario);
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        const centavos = lerReais(valor.value);
        if (Number.isNaN(centavos) || centavos <= 0) {
            erro.textContent = 'Escreva o valor como 12,50';
            return;
        }
        salvar.disabled = true;
        try {
            await chamar('PUT', '/api/comunidade/gerenciamento/financas/' + lancamento.id + '/valor', {valor: centavos, aPartirDe: mesAberto});
            dialogo.close();
            avisar('Valor atualizado');
            aoSalvar();
        } catch (e) {
            erro.textContent = e.message;
            salvar.disabled = false;
        }
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    valor.select();
}

/**
 * Financas do site, mes a mes (#/gerenciar/financas/AAAA-MM): receitas, gastos e o resultado; as pizzas de onde vem e
 * para onde vai o dinheiro; ganho e perda dos 12 meses; os gastos e as receitas cadastrados (com os botoes para
 * cadastrar, mudar o valor, encerrar e excluir) e o historico das vendas da loja.
 */
async function financasDoGerenciamento(conteudo, vez, mesPedido) {
    let dados;
    try {
        dados = await chamar('GET', '/api/comunidade/gerenciamento/financas' + (/^\d{4}-\d{2}$/.test(mesPedido || '') ? '?mes=' + mesPedido : ''));
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Não deu para carregar as finanças', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const mes = dados.mes;
    const abrirMes = qual => { location.hash = '#/gerenciar/financas/' + qual; };
    const recarregar = () => financasDoGerenciamento(conteudo, vez, mes);
    const r = dados.resumo;
    const resultado = r.receitas - r.gastos;

    const linhaDoLancamento = item => {
        const mensal = item.recorrencia === 'mensal';
        const periodo = mensal
            ? 'Todo mês, desde ' + mesCurto(item.inicio.slice(0, 7)) + (item.fim ? ' até ' + mesCurto(item.fim.slice(0, 7)) : '')
            : 'Uma vez, em ' + new Date(item.inicio + 'T12:00:00').toLocaleDateString('pt-BR');
        const acoes = [
            h('button', {type: 'button', class: 'botao pequeno', onclick: () => janelaDeNovoValor(item, mes, recarregar)}, 'Mudar valor'),
            mensal && !item.fim ? h('button', {type: 'button', class: 'botao pequeno', onclick: async () => {
                const tipo = item.tipo === 'gasto' ? 'pagar' : 'receber';
                if (!await confirmar('Encerrar ' + item.nome + '?', mesPorExtenso(mes) + ' será o último mês em que ' + item.nome + ' conta. Os meses de antes não mudam.', 'Parar de ' + tipo, false)) return;
                try {
                    await chamar('PUT', '/api/comunidade/gerenciamento/financas/' + item.id + '/encerrar', {ultimoMes: mes});
                    avisar(item.nome + ' encerrado');
                    recarregar();
                } catch (e) {
                    avisar(e.message, true);
                }
            }}, 'Encerrar') : null,
            h('button', {type: 'button', class: 'botao pequeno perigo', onclick: async () => {
                if (!await confirmar('Excluir ' + item.nome + '?', mensal ? 'Ele sai de todos os meses, inclusive os anteriores. Para parar de contar só daqui para a frente, use Encerrar.' : 'Ele sai das finanças.', 'Excluir')) return;
                try {
                    await chamar('DELETE', '/api/comunidade/gerenciamento/financas/' + item.id);
                    avisar(item.nome + ' excluído');
                    recarregar();
                } catch (e) {
                    avisar(e.message, true);
                }
            }}, 'Excluir')].filter(Boolean);
        // a receita de um banner e mudada no cadastro do banner (valor, cobranca e termino ficam la)
        if (item.banner) {
            return h('li', {class: 'lancamento'},
                h('div', {class: 'sobre-o-lancamento'}, h('b', null, item.nome),
                    h('small', null, periodo + ' · vem do banner: ', h('a', {href: '#/gerenciar/banners'}, 'mude no cadastro do banner'))),
                h('b', {class: 'valor-do-lancamento'}, reais(item.valor) + (mensal ? '/mês' : '')));
        }
        return h('li', {class: 'lancamento'},
            h('div', {class: 'sobre-o-lancamento'}, h('b', null, item.nome), h('small', null, periodo)),
            h('b', {class: 'valor-do-lancamento'}, reais(item.valor) + (mensal ? '/mês' : '')),
            h('div', {class: 'acoes-do-lancamento'}, ...acoes));
    };
    const listaDeLancamentos = (titulo, tipo, itens, extra) => h('section', {class: 'caixa-de-lancamentos'},
        h('div', {class: 'topo-do-grafico'}, h('h3', null, titulo),
            h('button', {type: 'button', class: 'botao pequeno primario', onclick: () => janelaDeLancamento(tipo, mes, recarregar)}, tipo === 'gasto' ? '+ Gasto' : '+ Receita')),
        ...[extra,
            itens.length || extra ? h('ul', {class: 'lista-de-lancamentos'}, ...itens.map(linhaDoLancamento)) : null,
            itens.length || extra ? null : h('p', {class: 'subtitulo'}, tipo === 'gasto'
                ? 'Nenhum gasto neste mês. Cadastre o que você paga, como Vercel, Claude ou Neon.'
                : 'Nenhuma receita cadastrada neste mês. Anúncios entram aqui; as vendas da loja entram sozinhas.')].filter(Boolean));
    const vendasDaLoja = r.vendas ? h('div', {class: 'lancamento automatico'},
        h('div', {class: 'sobre-o-lancamento'}, h('b', null, 'Vendas da loja'),
            h('small', null, (r.quantidadeDeVendas === 1 ? '1 venda' : r.quantidadeDeVendas + ' vendas') + ' · entra sozinho · valor antes da taxa do Mercado Pago')),
        h('b', {class: 'valor-do-lancamento'}, reais(r.vendas))) : null;

    const STATUS_DA_VENDA = {aprovada: 'Aprovada', reembolsada: 'Reembolsada', divergente: 'Valor errado'};
    const historico = h('section', {class: 'meses-do-painel'},
        h('h3', null, 'Vendas da loja em ' + mesPorExtenso(mes)),
        dados.historico.length === 0
            ? h('p', {class: 'subtitulo'}, 'Nenhuma venda neste mês.')
            : h('div', {class: 'rolagem-da-tabela'}, h('table', {class: 'historico-de-vendas'},
                h('thead', null, h('tr', null, ...['Quando', 'Comprador', 'Item', 'Valor', 'Situação', 'Pagamento no Mercado Pago'].map(texto => h('th', {scope: 'col'}, texto)))),
                h('tbody', null, ...dados.historico.map(venda => h('tr', {class: 'venda-' + venda.status},
                    h('td', null, dataEHora(venda.quando)),
                    h('td', null, h('a', {href: '#/comunidade/perfil/' + venda.comprador.id}, venda.comprador.nick)),
                    h('td', null, venda.nome || venda.item),
                    h('td', null, reais(venda.valor)),
                    h('td', null, STATUS_DA_VENDA[venda.status] || venda.status),
                    h('td', null, venda.pagamento || '—')))))));

    const navegacao = navegacaoDoMes(mes, dados.atual, abrirMes);

    conteudo.replaceChildren(
        navegacao,
        h('div', {class: 'numeros-das-financas'},
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Receitas'), h('b', {class: 'valor-do-quadro'}, reais(r.receitas))),
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Gastos'), h('b', {class: 'valor-do-quadro'}, reais(r.gastos))),
            h('div', {class: 'quadro-do-painel resultado ' + (resultado >= 0 ? 'lucro' : 'prejuizo')},
                h('span', {class: 'rotulo-do-quadro'}, 'Resultado do mês'),
                h('b', {class: 'valor-do-quadro'}, h('span', {'aria-hidden': 'true'}, resultado >= 0 ? '▲ ' : '▼ '), reais(Math.abs(resultado))),
                h('small', null, resultado > 0 ? 'Lucro' : resultado < 0 ? 'Prejuízo' : 'Empatou'))),
        pizzaDeReceitaEDespesa(dados, mes),
        h('div', {class: 'pizzas-das-financas'},
            graficoDePizza('De onde vem o dinheiro', dados.pizzaDasReceitas, 'Nenhuma receita neste mês.'),
            graficoDePizza('Para onde vai o dinheiro', dados.pizzaDosGastos, 'Nenhum gasto neste mês.')),
        graficoDeGanhoEPerda(dados.meses, mes, abrirMes),
        h('div', {class: 'lancamentos-das-financas'},
            listaDeLancamentos('Receitas de ' + mesPorExtenso(mes), 'receita', dados.receitas, vendasDaLoja),
            listaDeLancamentos('Gastos de ' + mesPorExtenso(mes), 'gasto', dados.gastos)),
        historico,
        h('section', {class: 'meses-do-painel'},
            h('h3', null, 'Últimos 12 meses'),
            h('div', {class: 'rolagem-da-tabela'}, h('table', null,
                h('thead', null, h('tr', null, ...['Mês', 'Receitas', 'Gastos', 'Resultado'].map(texto => h('th', {scope: 'col'}, texto)))),
                h('tbody', null, ...dados.meses.slice().reverse().map(item => h('tr', {class: item.mes === mes ? 'mes-aberto' : null},
                    h('th', {scope: 'row'}, h('a', {href: '#/gerenciar/financas/' + item.mes}, mesCurto(item.mes))),
                    h('td', null, reais(item.receitas)), h('td', null, reais(item.gastos)),
                    h('td', {class: item.receitas - item.gastos < 0 ? 'negativo' : null}, (item.receitas - item.gastos < 0 ? '−' : '') + reais(Math.abs(item.receitas - item.gastos))))))))));
}

// ------------------------------------------------------------------ banners de anuncio (so o dono)

const numeroInteiro = valor => (valor || 0).toLocaleString('pt-BR');
const taxaEmTexto = taxa => (taxa == null ? '—' : taxa.toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%');

/**
 * O relatorio de um banner (o que a empresa ve): o banner, o mes (com as setas), exibicoes, cliques e a taxa de
 * cliques, os graficos por dia e os lugares do site. dados: a resposta do relatorio. aoTrocarMes(mes) recarrega.
 */
function relatorioDeUmBanner(dados, aoTrocarMes) {
    const b = dados.banner;
    const t = dados.totais;
    return h('div', {class: 'relatorio-do-banner'},
        h('div', {class: 'cabecalho-do-relatorio'},
            h('img', {class: 'banner-do-relatorio ' + (b.imagens?.horizontal ? 'horizontal' : 'vertical'), src: b.imagem, alt: b.texto || 'Banner de ' + b.empresa}),
            h('div', {class: 'sobre-o-relatorio'},
                h('span', {class: 'tipo-do-item'}, 'Relatório do anúncio'),
                h('h1', null, b.empresa),
                h('p', {class: 'subtitulo'}, descreverImagensDoBanner(b) + ' no Viracap'
                    + (b.desde ? ', desde ' + new Date(b.desde).toLocaleDateString('pt-BR') : '') + (b.pausado ? '. Pausado no momento.' : '.')),
                b.link ? h('p', {class: 'subtitulo'}, 'Leva a: ', h('a', {href: b.link, target: '_blank', rel: 'noopener noreferrer'}, b.link)) : null)),
        navegacaoDoMes(dados.mes, dados.atual, aoTrocarMes),
        h('div', {class: 'numeros-das-financas'},
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Exibições'), h('b', {class: 'valor-do-quadro'}, numeroInteiro(t.exibicoes))),
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Cliques'), h('b', {class: 'valor-do-quadro'}, numeroInteiro(t.cliques))),
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Taxa de cliques'), h('b', {class: 'valor-do-quadro'}, taxaEmTexto(t.taxa)),
                h('small', null, 'cliques a cada 100 exibições'))),
        h('div', {class: 'graficos-do-painel'},
            graficoDeColunas('Exibições por dia', dados.porDia, 'exibicoes'),
            graficoDeColunas('Cliques por dia', dados.porDia, 'cliques')),
        h('section', {class: 'meses-do-painel'},
            h('h3', null, 'Por lugar do site'),
            dados.porPosicao.length === 0 ? h('p', {class: 'subtitulo'}, 'Nenhuma exibição neste mês.')
                : h('div', {class: 'rolagem-da-tabela'}, h('table', null,
                    h('thead', null, h('tr', null, ...['Lugar', 'Exibições', 'Cliques', 'Taxa de cliques'].map(texto => h('th', {scope: 'col'}, texto)))),
                    h('tbody', null, ...dados.porPosicao.map(item => h('tr', null, h('th', {scope: 'row'}, item.posicao),
                        h('td', null, numeroInteiro(item.exibicoes)), h('td', null, numeroInteiro(item.cliques)), h('td', null, taxaEmTexto(item.taxa)))))))),
        h('p', {class: 'nota-do-painel'}, 'Contagens anônimas, por dia: quantas vezes o banner apareceu no site e quantas vezes foi clicado. '
            + 'Nenhuma pessoa é identificada (sem conta, endereço ou aparelho), então os números não medem pessoas diferentes, só exibições e cliques.'));
}

/** As setas do mes (sem passar do mes atual) e o nome do mes. */
function navegacaoDoMes(mes, atual, aoTrocarMes) {
    // o calendario de meses: abre embaixo do nome do mes, com o ano e os 12 meses (os que ainda nao chegaram, apagados)
    let anoDoCalendario = Number(mes.slice(0, 4));
    const calendario = h('div', {class: 'calendario-de-meses', role: 'dialog', 'aria-label': 'Escolher o mês', hidden: true});
    const abrirCalendario = h('button', {type: 'button', class: 'mes-escolhido', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'Escolher outro mês'},
        h('span', {class: 'icone-do-mes', 'aria-hidden': 'true'}, '📅'), h('span', {class: 'nome-do-mes'}, mesPorExtenso(mes)), h('span', {class: 'seta-do-mes', 'aria-hidden': 'true'}, '▾'));
    const fechar = () => {
        calendario.hidden = true;
        abrirCalendario.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', foraDoCalendario, true);
    };
    const foraDoCalendario = evento => { if (!seletor.contains(evento.target)) fechar(); };
    const desenharCalendario = () => {
        const anoAtual = Number(atual.slice(0, 4));
        calendario.replaceChildren(
            h('div', {class: 'ano-do-calendario'},
                h('button', {type: 'button', class: 'seta-do-calendario', 'aria-label': 'Ano anterior', onclick: () => { anoDoCalendario--; desenharCalendario(); }}, '‹'),
                h('b', null, String(anoDoCalendario)),
                h('button', {type: 'button', class: 'seta-do-calendario', 'aria-label': 'Próximo ano', disabled: anoDoCalendario >= anoAtual,
                    onclick: () => { anoDoCalendario++; desenharCalendario(); }}, '›')),
            h('div', {class: 'meses-do-calendario'}, ...MESES_CURTOS.map((nome, i) => {
                const valor = anoDoCalendario + '-' + String(i + 1).padStart(2, '0');
                return h('button', {type: 'button', class: 'mes-do-calendario' + (valor === mes ? ' escolhido' : '') + (valor === atual ? ' atual' : ''),
                    disabled: valor > atual, 'aria-pressed': String(valor === mes), 'aria-label': mesPorExtenso(valor),
                    onclick: () => { fechar(); if (valor !== mes) aoTrocarMes(valor); }}, nome);
            })));
    };
    abrirCalendario.addEventListener('click', () => {
        if (!calendario.hidden) return fechar();
        anoDoCalendario = Number(mes.slice(0, 4));
        desenharCalendario();
        calendario.hidden = false;
        abrirCalendario.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', foraDoCalendario, true);
        calendario.querySelector('.mes-do-calendario.escolhido, .mes-do-calendario:not(:disabled)')?.focus();
    });
    calendario.addEventListener('keydown', evento => {
        if (evento.key !== 'Escape') return;
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
        abrirCalendario.focus();
    });
    const seletor = h('div', {class: 'seletor-de-mes'},
        h('button', {type: 'button', class: 'seta-do-mes-lado', 'aria-label': 'Mês anterior', onclick: () => aoTrocarMes(somarMesesNoSite(mes, -1))}, '‹'),
        abrirCalendario,
        h('button', {type: 'button', class: 'seta-do-mes-lado', 'aria-label': 'Próximo mês', disabled: mes >= atual, onclick: () => aoTrocarMes(somarMesesNoSite(mes, 1))}, '›'),
        calendario);
    return h('div', {class: 'navegacao-do-mes'}, seletor,
        mes !== atual ? h('button', {type: 'button', class: 'voltar-ao-mes-atual', onclick: () => aoTrocarMes(atual)}, '↺ Mês atual') : null);
}

/**
 * O relatorio de um banner para a empresa (#/relatorio-de-banner/{id}/{codigo}), aberto pelo link privado: sem login,
 * so aquele banner. Da para imprimir ou salvar em PDF.
 */
async function telaRelatorioDaEmpresa(id, codigo, mes) {
    const vez = ++estado.render;
    document.title = 'Relatório do anúncio · Viracap';
    document.body.classList.add('pagina-de-relatorio');
    const conteudo = h('div', {class: 'pagina-do-relatorio'}, h('p', {class: 'subtitulo'}, 'Carregando…'));
    app.replaceChildren(conteudo);
    let dados;
    try {
        dados = await chamar('GET', `/api/banners/relatorio-da-empresa/${encodeURIComponent(id)}/${encodeURIComponent(codigo)}` + (mes ? '?mes=' + mes : ''));
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Relatório não encontrado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    document.title = 'Relatório do anúncio de ' + dados.banner.empresa + ' · Viracap';
    conteudo.replaceChildren(
        h('div', {class: 'topo-do-relatorio'},
            h('span', {class: 'marca-do-relatorio'}, h('img', {src: 'favicon.svg', alt: '', width: '24', height: '24'}), 'Viracap'),
            h('button', {type: 'button', class: 'botao pequeno', onclick: () => window.print()}, 'Imprimir ou salvar em PDF')),
        relatorioDeUmBanner(dados, novo => telaRelatorioDaEmpresa(id, codigo, novo)));
}

/** O relatorio de um banner no Gerenciar (#/gerenciar/banners/{id}), com o link para mandar a empresa. */
async function relatorioDoBannerNoGerenciamento(conteudo, vez, id, mes) {
    let dados;
    try {
        dados = await chamar('GET', '/api/banners/' + encodeURIComponent(id) + '/relatorio' + (mes ? '?mes=' + mes : ''));
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Não deu para abrir o relatório', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const endereco = location.origin + '/' + dados.linkDaEmpresa;
    const campo = h('input', {type: 'text', readonly: true, value: endereco, 'aria-label': 'Link do relatório para a empresa'});
    conteudo.replaceChildren(
        h('a', {class: 'voltar', href: '#/gerenciar/banners'}, '← Banners'),
        h('section', {class: 'caixa-de-lancamentos link-da-empresa'},
            h('h3', null, 'Link para a empresa'),
            h('p', {class: 'subtitulo'}, 'Quem tiver este link vê só o relatório deste banner, sem precisar de conta. Gerar um novo link desliga o antigo.'),
            h('div', {class: 'linha-do-link'}, campo,
                h('button', {type: 'button', class: 'botao pequeno primario', onclick: async () => {
                    try {
                        await navigator.clipboard.writeText(endereco);
                        avisar('Link copiado');
                    } catch {
                        campo.select();
                    }
                }}, 'Copiar'),
                h('button', {type: 'button', class: 'botao pequeno', onclick: async () => {
                    if (!await confirmar('Gerar um link novo?', 'O link que a empresa já tem para de funcionar. Mande o novo para ela.', 'Gerar link novo', false)) return;
                    try {
                        await chamar('POST', '/api/banners/' + encodeURIComponent(id) + '/novo-link');
                        avisar('Link novo gerado');
                        relatorioDoBannerNoGerenciamento(conteudo, vez, id, dados.mes);
                    } catch (e) {
                        avisar(e.message, true);
                    }
                }}, 'Gerar link novo'),
                h('a', {class: 'botao pequeno', href: dados.linkDaEmpresa, target: '_blank', rel: 'noopener'}, 'Abrir como a empresa vê'))),
        relatorioDeUmBanner(dados, novo => relatorioDoBannerNoGerenciamento(conteudo, vez, id, novo)));
}

/**
 * A aba Banners do Gerenciar: o relatorio geral do mes (todos os banners), a planilha, e os banners cadastrados, com
 * os botoes de adicionar, editar, pausar, ver o relatorio e apagar.
 */
async function bannersNoGerenciamento(conteudo, vez, mes) {
    let lista;
    let relatorio;
    try {
        [lista, relatorio] = await Promise.all([chamar('GET', '/api/banners'), chamar('GET', '/api/banners/relatorio' + (mes ? '?mes=' + mes : ''))]);
    } catch (e) {
        if (vez === estado.render) conteudo.replaceChildren(vazio('Não deu para carregar os banners', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const recarregar = () => bannersNoGerenciamento(conteudo, vez, relatorio.mes);
    const t = relatorio.totais;

    // a previa mostra as imagens que o banner tem (a horizontal e a vertical lado a lado, quando tem as duas)
    const cartaoDoBanner = banner => h('article', {class: 'cartao-de-banner' + (banner.pausado ? ' pausado' : '')},
        h('a', {class: 'previas-do-banner', href: '#/gerenciar/banners/' + encodeURIComponent(banner.id)},
            ...['horizontal', 'vertical'].filter(formato => banner.imagens?.[formato]).map(formato => h('span', {class: 'previa-do-banner ' + formato},
                h('img', {src: banner.imagens[formato].url, alt: (banner.texto || 'Banner de ' + banner.empresa) + ' (' + formato + ')', loading: 'lazy'})))),
        h('div', {class: 'sobre-o-banner'},
            h('div', {class: 'linha'}, h('b', null, banner.empresa),
                h('span', {class: 'selo-na-mochila'}, banner.formato === 'ambos' ? 'Horizontal + vertical' : banner.formato === 'vertical' ? 'Vertical' : 'Horizontal'),
                banner.encerrado ? h('span', {class: 'selo-de-pausa'}, 'Encerrado')
                    : banner.pausado ? h('span', {class: 'selo-de-pausa'}, 'Pausado')
                        : banner.peso === 0 ? h('span', {class: 'selo-de-pausa'}, 'Peso 0') : h('span', {class: 'selo-ativo'}, 'No ar')),
            h('small', null, descreverImagensDoBanner(banner) + ' · peso ' + banner.peso + (banner.link ? ' · ' + banner.link : ' · sem link')),
            h('small', null, (banner.valor ? 'Rende ' + reais(banner.valor) + (banner.cobranca === 'mensal' ? ' por mês' : ' (uma vez)') : 'Sem valor cadastrado')
                + (banner.terminaEm ? ' · ' + (banner.encerrado ? 'acabou em ' : 'acaba em ') + new Date(banner.terminaEm + 'T12:00:00').toLocaleDateString('pt-BR') : ' · sem data para acabar')),
            h('small', null, 'Este mês: ' + numeroInteiro(banner.exibicoes) + ' exibições, ' + numeroInteiro(banner.cliques) + ' cliques (' + taxaEmTexto(banner.taxa) + ')'),
            h('div', {class: 'acoes-do-lancamento'},
                h('a', {class: 'botao pequeno primario', href: '#/gerenciar/banners/' + encodeURIComponent(banner.id)}, 'Relatório'),
                h('button', {type: 'button', class: 'botao pequeno', onclick: () => janelaDoBanner(lista.formatos, banner, recarregar, lista.banners)}, 'Editar'),
                h('button', {type: 'button', class: 'botao pequeno', onclick: async () => {
                    try {
                        await chamar('PUT', '/api/banners/' + encodeURIComponent(banner.id) + '/pausa', {pausado: !banner.pausado});
                        avisar(banner.empresa + (banner.pausado ? ' de volta ao ar' : ' pausado'));
                        recarregar();
                    } catch (e) {
                        avisar(e.message, true);
                    }
                }}, banner.pausado ? 'Ativar' : 'Pausar'),
                h('button', {type: 'button', class: 'botao pequeno perigo', onclick: async () => {
                    if (!await confirmar('Apagar o banner de ' + banner.empresa + '?', 'O banner sai do cadastro e o link da empresa para de funcionar. Os números dos meses em que ele apareceu continuam no relatório geral.', 'Apagar')) return;
                    try {
                        await chamar('DELETE', '/api/banners/' + encodeURIComponent(banner.id));
                        avisar('Banner apagado');
                        recarregar();
                    } catch (e) {
                        avisar(e.message, true);
                    }
                }}, 'Apagar'))));

    conteudo.replaceChildren(
        h('div', {class: 'topo-do-grafico'},
            h('p', {class: 'subtitulo'}, 'Os banners de anúncio do site, horizontais e verticais, e os relatórios para as empresas. '
                + 'Os horizontais aparecem embaixo das listas e, em telas estreitas, em cima da Loja, da Comunidade e do Descobrir; os verticais, nas laterais. '
                + 'Sem banner no ar de um formato, aparece o “Anuncie aqui”.'),
            h('div', {class: 'acoes-do-lancamento'},
                h('a', {class: 'botao pequeno', href: '/api/banners/planilha?mes=' + relatorio.mes, download: true}, 'Baixar planilha do mês'),
                h('button', {type: 'button', class: 'botao pequeno primario', disabled: lista.banners.length >= lista.maximo,
                    onclick: () => janelaDoBanner(lista.formatos, null, recarregar, lista.banners)}, '+ Banner'))),
        navegacaoDoMes(relatorio.mes, relatorio.atual, novo => bannersNoGerenciamento(conteudo, vez, novo)),
        h('div', {class: 'numeros-do-painel numeros-dos-banners'},
            quadroDoPainel('Exibições no mês', t.exibicoes),
            quadroDoPainel('Cliques no mês', t.cliques),
            h('div', {class: 'quadro-do-painel'}, h('span', {class: 'rotulo-do-quadro'}, 'Taxa de cliques'), h('b', {class: 'valor-do-quadro'}, taxaEmTexto(t.taxa))),
            quadroDoPainel('Banners no ar', relatorio.ativos, 'de ' + relatorio.cadastrados + ' cadastrados (máximo ' + lista.maximo + ')')),
        h('div', {class: 'graficos-do-painel'}, graficoDeColunas('Exibições por dia', relatorio.porDia, 'exibicoes',
            {detalhe: item => item.cliques + (item.cliques === 1 ? ' clique' : ' cliques')})),
        h('section', {class: 'meses-do-painel'},
            h('h3', null, 'Por banner em ' + mesPorExtenso(relatorio.mes)),
            relatorio.porBanner.length === 0 ? h('p', {class: 'subtitulo'}, 'Nenhum banner cadastrado ainda.')
                : h('div', {class: 'rolagem-da-tabela'}, h('table', {class: 'tabela-dos-banners'},
                    h('thead', null, h('tr', null, ...['Banner', 'Formato', 'Exibições', 'Cliques', 'Taxa de cliques', 'Parte das exibições'].map(texto => h('th', {scope: 'col'}, texto)))),
                    h('tbody', null, ...relatorio.porBanner.map(item => h('tr', null,
                        h('th', {scope: 'row'}, item.foraDoCadastro ? item.banner + ' (apagado)' : h('a', {href: '#/gerenciar/banners/' + encodeURIComponent(item.banner)}, item.empresa)),
                        h('td', null, item.formato === 'ambos' ? 'Horizontal + vertical' : item.formato === 'vertical' ? 'Vertical' : item.formato === 'horizontal' ? 'Horizontal' : '—'),
                        h('td', null, numeroInteiro(item.exibicoes)), h('td', null, numeroInteiro(item.cliques)),
                        h('td', null, taxaEmTexto(item.taxa)), h('td', null, item.parte.toLocaleString('pt-BR') + '%'))))))),
        h('section', {class: 'caixa-de-lancamentos'},
            h('h3', null, 'Banners cadastrados (' + lista.banners.length + ')'),
            lista.banners.length === 0 ? h('p', {class: 'subtitulo'}, 'Nenhum banner ainda. Clique em "+ Banner" para cadastrar o primeiro.')
                : h('div', {class: 'lista-de-banners'}, ...lista.banners.map(cartaoDoBanner))));
}

/**
 * Janela para cadastrar ou editar um banner: empresa, descricao (para leitores de tela), link, formato, peso e a imagem,
 * com a previa e as medidas conferidas na hora (o servidor confere de novo). formatos: as regras de cada formato.
 */
/** "Horizontal 1280 × 400 px e vertical 400 × 1280 px": as imagens que um banner tem, com as medidas. */
function descreverImagensDoBanner(banner) {
    const partes = ['horizontal', 'vertical'].filter(formato => banner.imagens?.[formato])
        .map(formato => formato + ' ' + banner.imagens[formato].largura + ' × ' + banner.imagens[formato].altura + ' px');
    const texto = partes.join(' e ') || 'sem imagem';
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function janelaDoBanner(formatos, banner, aoSalvar, todos = []) {
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const empresa = h('input', {type: 'text', id: 'banner-empresa', maxlength: '120', required: true, value: banner?.empresa || '', placeholder: 'Ex.: Loja do Otaku'});
    const texto = h('input', {type: 'text', id: 'banner-texto', maxlength: '200', value: banner?.texto || '', placeholder: 'Ex.: Mangás com 20% de desconto'});
    const link = h('input', {type: 'url', id: 'banner-link', maxlength: '500', value: banner?.link || '', placeholder: 'https://… (ou vazio)'});
    // o peso: uma barra de 0 a 10 (a maioria dos casos) e o numero ao lado, que vai ate 100
    const pesoInicial = banner ? banner.peso : 1;
    const barraDoPeso = h('input', {type: 'range', id: 'banner-peso', min: '0', max: '10', step: '1', value: String(Math.min(pesoInicial, 10)), 'aria-describedby': 'explicacao-do-peso'});
    const numeroDoPeso = h('input', {type: 'number', min: '0', max: '100', step: '1', value: String(pesoInicial), 'aria-label': 'Peso (número)'});
    const explicacaoDoPeso = h('small', {id: 'explicacao-do-peso', class: 'explicacao-do-peso'});
    // os outros banners que estao no ar (sem este): a parte das exibicoes e o peso deste sobre a soma de todos
    const outros = todos.filter(outro => outro.id !== banner?.id && !outro.pausado && !outro.encerrado && outro.peso > 0);
    const explicarPeso = () => {
        const valor = Number(numeroDoPeso.value) || 0;
        if (valor === 0) {
            explicacaoDoPeso.textContent = 'Peso 0: o banner não aparece (fica no cadastro, com os números dele).';
            return;
        }
        const soma = outros.reduce((total, outro) => total + outro.peso, 0) + valor;
        const parte = Math.round((valor / soma) * 100);
        explicacaoDoPeso.textContent = (valor === 1 ? 'Peso 1: o normal. ' : 'Peso ' + valor + ': aparece ' + valor + ' vezes mais que um banner de peso 1. ')
            + (outros.length ? 'Com os ' + (outros.length + 1) + ' banners no ar, fica com cerca de ' + parte + '% das exibições.' : 'É o único banner no ar: fica com todas as exibições.');
    };
    barraDoPeso.addEventListener('input', () => { numeroDoPeso.value = barraDoPeso.value; explicarPeso(); });
    numeroDoPeso.addEventListener('input', () => { barraDoPeso.value = String(Math.min(Number(numeroDoPeso.value) || 0, 10)); explicarPeso(); });
    explicarPeso();
    // quanto o banner rende, por mes ou de uma vez: vira uma receita nas Financas
    const valor = h('input', {type: 'text', id: 'banner-valor', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00 (ou vazio)',
        value: banner?.valor ? (banner.valor / 100).toFixed(2).replace('.', ',') : ''});
    let cobranca = banner?.cobranca || 'mensal';
    const opcoesDeCobranca = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Cobrança'});
    const desenharCobranca = () => opcoesDeCobranca.replaceChildren(...[['mensal', 'Por mês'], ['unica', 'Uma vez só']].map(([qual, nome]) =>
        h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(cobranca === qual), onclick: () => {
            cobranca = qual;
            desenharCobranca();
            if (typeof resumirTermino === 'function') resumirTermino();
        }}, nome)));
    desenharCobranca();
    // quando o banner acaba: sem data, ou uma data (com atalhos e um resumo que muda na hora)
    const terminaEm = h('input', {type: 'date', id: 'banner-termino', value: banner?.terminaEm || ''});
    let comTermino = Boolean(banner?.terminaEm);
    const opcoesDoTermino = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Quando acaba'});
    const atalhosDoTermino = h('div', {class: 'atalhos-do-termino'});
    const resumoDoTermino = h('p', {class: 'resumo-do-termino', 'aria-live': 'polite'});
    const camposDoTermino = h('div', {class: 'campos-do-termino'}, terminaEm, atalhosDoTermino);
    const hojeNoAparelho = () => {
        const agora = new Date();
        return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
    };
    const paraTexto = data => data.toISOString().slice(0, 10);
    // os atalhos contam sempre a partir de hoje, sem passar do ultimo dia do mes (31/01 + 1 mes = 28/02)
    const somarMesesNaData = meses => {
        const base = hojeNoAparelho();
        const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
        const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
        alvo.setUTCDate(Math.min(base.getUTCDate(), ultimoDia));
        return paraTexto(alvo);
    };
    const fimDesteMes = () => {
        const hoje = hojeNoAparelho();
        return paraTexto(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)));
    };
    atalhosDoTermino.append(...[['+1 mês', () => somarMesesNaData(1)], ['+3 meses', () => somarMesesNaData(3)], ['+6 meses', () => somarMesesNaData(6)],
        ['+1 ano', () => somarMesesNaData(12)], ['Fim deste mês', fimDesteMes]].map(([nome, data]) =>
        h('button', {type: 'button', class: 'botao pequeno', onclick: () => { terminaEm.value = data(); resumirTermino(); }}, nome)));
    const resumirTermino = () => {
        camposDoTermino.hidden = !comTermino;
        if (!comTermino) {
            resumoDoTermino.className = 'resumo-do-termino';
            resumoDoTermino.textContent = 'O banner fica no ar até você pausar ou apagar' + (cobranca === 'mensal' && valor.value.trim() ? ', e a receita conta todo mês.' : '.');
            return;
        }
        if (!terminaEm.value) {
            resumoDoTermino.className = 'resumo-do-termino';
            resumoDoTermino.textContent = 'Escolha o dia, ou use um dos atalhos.';
            return;
        }
        const data = new Date(terminaEm.value + 'T00:00:00Z');
        const dias = Math.round((data - hojeNoAparelho()) / 86400000);
        const porExtenso = data.toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
        const quando = dias > 1 ? 'daqui a ' + dias + ' dias' : dias === 1 ? 'amanhã' : dias === 0 ? 'hoje' : 'já passou';
        let texto = porExtenso.charAt(0).toUpperCase() + porExtenso.slice(1) + ', ' + quando + '.';
        if (dias <= 0) texto += ' Ao salvar, o peso vira 0 e o banner sai do ar.';
        else texto += ' Nesse dia o peso vira 0 e o banner sai do ar.';
        if (cobranca === 'mensal' && valor.value.trim()) {
            const agora = hojeNoAparelho();
            const meses = (data.getUTCFullYear() - agora.getUTCFullYear()) * 12 + (data.getUTCMonth() - agora.getUTCMonth()) + 1;
            if (meses > 0) texto += ' A receita por mês conta até ' + mesPorExtenso(terminaEm.value.slice(0, 7)) + ' (' + (meses === 1 ? 'só este mês' : meses + ' meses a partir deste') + ').';
        }
        resumoDoTermino.className = 'resumo-do-termino' + (dias <= 0 ? ' passou' : '');
        resumoDoTermino.textContent = texto;
    };
    const desenharTermino = () => opcoesDoTermino.replaceChildren(...[[false, 'Sem data para acabar'], [true, 'Acaba em…']].map(([qual, nome]) =>
        h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(comTermino === qual), onclick: () => {
            comTermino = qual;
            if (comTermino && !terminaEm.value) terminaEm.value = somarMesesNaData(1);
            desenharTermino();
            resumirTermino();
            if (comTermino) terminaEm.focus();
        }}, nome)));
    desenharTermino();
    terminaEm.addEventListener('input', resumirTermino);
    valor.addEventListener('input', resumirTermino);
    /*
     * As duas imagens (doc 96): a horizontal e a vertical, cada uma opcional, mas o banner precisa de pelo menos uma.
     * Cada quadro tem a previa, o botao de escolher, as medidas conferidas na hora e, se ja havia imagem, "Tirar".
     */
    const quadroDeImagem = formato => {
        const r = formatos[formato];
        const existente = banner?.imagens?.[formato] || null;
        const estado = {formato, arquivo: h('input', {type: 'file', id: 'banner-imagem-' + formato, class: 'escolher-arquivo', accept: 'image/png,image/jpeg,image/webp'}),
            escolhida: null, tirar: false, existente};
        const previa = h('div', {class: 'previa-do-banner ' + formato});
        const medidas = h('small', {class: 'medidas-do-banner'});
        const tirar = h('button', {type: 'button', class: 'botao pequeno perigo', hidden: true});
        const dica = 'Recomendado: ' + r.exemplos + ' px. PNG, JPEG ou WebP, até 1 MB.';
        estado.ok = () => {
            if (!estado.escolhida) return true;
            const {largura, altura} = estado.escolhida;
            const proporcao = formato === 'horizontal' ? largura / altura : altura / largura;
            return largura >= r.largura[0] && largura <= r.largura[1] && altura >= r.altura[0] && altura <= r.altura[1] && proporcao >= r.proporcao[0] && proporcao <= r.proporcao[1];
        };
        estado.tem = () => Boolean(estado.arquivo.files[0] || (estado.existente && !estado.tirar));
        const desenhar = () => {
            const imagem = estado.arquivo.files[0] ? previa.querySelector('img') : null;
            if (!imagem) {
                previa.replaceChildren(estado.existente && !estado.tirar ? h('img', {src: estado.existente.url, alt: ''})
                    : h('span', {class: 'subtitulo'}, estado.tirar ? 'Será tirada ao salvar' : 'Sem imagem ' + r.nome.toLowerCase()));
            }
            if (estado.escolhida) {
                const {largura, altura} = estado.escolhida;
                medidas.textContent = largura + ' × ' + altura + ' px ' + (estado.ok() ? '✓ serve' : '✗ não serve para um banner ' + r.nome.toLowerCase() + '. ' + dica);
            } else {
                medidas.textContent = estado.existente && !estado.tirar ? 'A atual: ' + estado.existente.largura + ' × ' + estado.existente.altura + ' px. Escolha outra só para trocar.' : dica;
            }
            medidas.classList.toggle('erro', !estado.ok());
            tirar.hidden = !(estado.existente || estado.arquivo.files[0]);
            tirar.textContent = estado.tirar ? 'Manter a atual' : 'Tirar';
        };
        tirar.addEventListener('click', () => {
            if (estado.arquivo.files[0]) {
                // tira a escolhida agora (volta para a que ja estava, se tinha)
                estado.arquivo.value = '';
                estado.escolhida = null;
                previa.replaceChildren();
            } else {
                estado.tirar = !estado.tirar;
            }
            desenhar();
        });
        estado.arquivo.addEventListener('change', () => {
            const escolhido = estado.arquivo.files[0];
            estado.escolhida = null;
            estado.tirar = false;
            if (!escolhido) return desenhar();
            const img = h('img', {src: URL.createObjectURL(escolhido), alt: ''});
            img.addEventListener('load', () => {
                estado.escolhida = {largura: img.naturalWidth, altura: img.naturalHeight};
                desenhar();
            });
            img.addEventListener('error', () => {
                medidas.textContent = 'Não deu para ler essa imagem';
                medidas.classList.add('erro');
            });
            previa.replaceChildren(img);
            desenhar();
        });
        desenhar();
        estado.elemento = h('fieldset', {class: 'quadro-da-imagem-do-banner'},
            h('legend', null, 'Imagem ' + r.nome.toLowerCase()),
            previa,
            h('div', {class: 'linha-da-imagem-do-banner'}, estado.arquivo, tirar),
            medidas);
        return estado;
    };
    const imagens = [quadroDeImagem('horizontal'), quadroDeImagem('vertical')];
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, banner ? 'Salvar' : 'Cadastrar');
    const formulario = h('form', {class: 'formulario-de-lancamento'},
        h('div', {class: 'campo'}, h('label', {for: 'banner-empresa'}, 'Empresa'), empresa),
        h('div', {class: 'campo'},
            h('span', {class: 'rotulo'}, 'Imagens'),
            h('small', null, 'Horizontal, vertical ou as duas (pelo menos uma). Com as duas, o banner aparece nos lugares horizontais e nos verticais do site.'),
            h('div', {class: 'imagens-do-banner'}, ...imagens.map(imagem => imagem.elemento))),
        h('div', {class: 'campo'}, h('label', {for: 'banner-texto'}, 'Descrição (para leitores de tela)'), texto),
        h('div', {class: 'campo'}, h('label', {for: 'banner-link'}, 'Link ao clicar'), link,
            h('small', null, 'https:// ou mailto:. Vazio: o banner não é clicável.')),
        h('div', {class: 'campo'}, h('label', {for: 'banner-peso'}, 'Peso: quanto ele aparece'),
            h('div', {class: 'linha-do-peso'}, barraDoPeso, numeroDoPeso), explicacaoDoPeso),
        h('fieldset', {class: 'campo-de-dinheiro'},
            h('legend', null, 'Quanto ele rende'),
            h('div', {class: 'campos-mensais'},
                h('div', {class: 'campo'}, h('label', {for: 'banner-valor'}, 'Valor em reais'), valor),
                h('div', {class: 'campo'}, h('span', {class: 'rotulo'}, 'Cobrança'), opcoesDeCobranca)),
            h('small', null, 'Entra sozinho nas Finanças como receita: por mês, em todo mês desde o começo do anúncio até o término; uma vez só, no dia do cadastro. Vazio: sem receita.')),
        h('fieldset', {class: 'campo-de-dinheiro campo-do-termino'},
            h('legend', null, 'Quando ele acaba'),
            opcoesDoTermino,
            camposDoTermino,
            resumoDoTermino),
        erro,
        h('div', {class: 'acoes'}, h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'), salvar));
    const dialogo = h('dialog', {class: 'janela-de-lancamento janela-do-banner'},
        h('div', {class: 'topo-da-janela'}, h('h2', null, banner ? 'Editar banner' : 'Novo banner'),
            h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar', onclick: () => dialogo.close()}, '×')),
        formulario);
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        if (!imagens.some(imagem => imagem.tem())) {
            erro.textContent = 'O banner precisa de pelo menos uma imagem: a horizontal, a vertical ou as duas';
            return;
        }
        const errada = imagens.find(imagem => !imagem.ok());
        if (errada) {
            erro.textContent = 'A imagem ' + formatos[errada.formato].nome.toLowerCase() + ' não tem as medidas de um banner ' + formatos[errada.formato].nome.toLowerCase();
            return;
        }
        const envio = new FormData();
        envio.append('empresa', empresa.value);
        envio.append('texto', texto.value);
        envio.append('link', link.value);
        envio.append('peso', numeroDoPeso.value);
        envio.append('valor', valor.value);
        envio.append('cobranca', cobranca);
        envio.append('terminaEm', comTermino ? terminaEm.value : '');
        for (const imagem of imagens) {
            const sufixo = imagem.formato === 'horizontal' ? 'Horizontal' : 'Vertical';
            if (imagem.arquivo.files[0]) envio.append('imagem' + sufixo, imagem.arquivo.files[0]);
            else if (imagem.tirar) envio.append('remover' + sufixo, '1');
        }
        salvar.disabled = true;
        try {
            await chamar(banner ? 'PUT' : 'POST', '/api/banners' + (banner ? '/' + encodeURIComponent(banner.id) : ''), envio);
            dialogo.close();
            avisar(banner ? 'Banner salvo' : 'Banner cadastrado');
            aoSalvar();
        } catch (e) {
            erro.textContent = e.message;
            salvar.disabled = false;
        }
    });
    resumirTermino();
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    empresa.focus();
}

// ------------------------------------------------------------------ imagens da loja (so o dono)

/**
 * As imagens das bordas e efeitos que nao sao so CSS ficam no banco: aqui o dono envia, troca e apaga. Cada uma fica
 * em /api/loja/imagens/{nome}, que e o endereco que o CSS da borda usa. Trocar uma imagem leva ate uma hora para
 * aparecer para todo mundo (a CDN guarda por uma hora).
 */
async function imagensDaLojaNoGerenciamento(conteudo, vez) {
    const lista = h('div', {class: 'lista-de-imagens-da-loja'}, h('p', {class: 'subtitulo'}, 'Carregando…'));
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const arquivo = h('input', {type: 'file', id: 'imagem-da-loja-arquivo', accept: 'image/webp,image/png,image/gif', required: true});
    const nome = h('input', {type: 'text', id: 'imagem-da-loja-nome', required: true, placeholder: 'celestial.webp', maxlength: '64',
        pattern: '[a-z0-9][a-z0-9-]*\\.(webp|png|gif)', autocomplete: 'off', spellcheck: 'false'});
    // o nome sai do arquivo: minusculas, sem acento, espacos viram hifen
    arquivo.addEventListener('change', () => {
        const escolhido = arquivo.files[0];
        if (!escolhido || nome.value) return;
        nome.value = escolhido.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+(?=\.)/g, '');
    });
    const enviar = h('button', {type: 'submit', class: 'botao primario'}, 'Enviar');
    const formulario = h('form', {class: 'envio-de-imagem-da-loja'},
        h('div', {class: 'campo'}, h('label', {for: 'imagem-da-loja-arquivo'}, 'Arquivo (WebP, PNG ou GIF, até 3 MB)'), arquivo),
        h('div', {class: 'campo'}, h('label', {for: 'imagem-da-loja-nome'}, 'Nome'), nome,
            h('small', null, 'Letras minúsculas, números e hífen. Enviar com um nome que já existe troca a imagem.')),
        erro, h('div', null, enviar));
    const carregar = async () => {
        try {
            const imagens = await chamar('GET', '/api/loja/imagens');
            if (vez !== estado.render) return;
            lista.replaceChildren(...(imagens.length === 0 ? [h('p', {class: 'subtitulo'}, 'Nenhuma imagem enviada ainda.')] : imagens.map(imagem =>
                h('article', {class: 'imagem-da-loja'},
                    h('a', {href: imagem.endereco, target: '_blank', rel: 'noopener', class: 'miniatura-da-imagem'},
                        h('img', {src: imagem.endereco + '?v=' + encodeURIComponent(imagem.atualizadaEm), alt: imagem.nome, loading: 'lazy'})),
                    h('div', {class: 'sobre-a-imagem'},
                        h('b', null, imagem.nome),
                        h('small', null, imagem.tipo.slice(6).toUpperCase() + ' · ' + (imagem.tamanho / 1024).toLocaleString('pt-BR', {maximumFractionDigits: 1}) + ' KB · ' + dataEHora(imagem.atualizadaEm)),
                        h('code', null, imagem.endereco)),
                    h('button', {type: 'button', class: 'botao pequeno perigo', onclick: async () => {
                        if (!await confirmar('Apagar ' + imagem.nome + '?', 'A borda ou o efeito que usa essa imagem fica sem ela até você enviar de novo.', 'Apagar')) return;
                        try {
                            await chamar('DELETE', '/api/loja/imagens/' + encodeURIComponent(imagem.nome));
                            avisar(imagem.nome + ' apagada');
                            carregar();
                        } catch (e) {
                            avisar(e.message, true);
                        }
                    }}, 'Apagar')))));
        } catch (e) {
            if (vez === estado.render) lista.replaceChildren(vazio('Não deu para carregar as imagens', e.message));
        }
    };
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        const escolhido = arquivo.files[0];
        if (!escolhido) return;
        enviar.disabled = true;
        enviar.textContent = 'Enviando…';
        try {
            // o corpo e o arquivo como veio: o servidor confere o formato pelos primeiros bytes
            const resposta = await fetch('/api/loja/imagens/' + encodeURIComponent(nome.value.trim()), {method: 'PUT', body: escolhido,
                headers: {'Content-Type': escolhido.type || 'application/octet-stream'}});
            const corpo = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(corpo.mensagem || 'Não deu para enviar a imagem');
            avisar(corpo.nome + ' enviada');
            formulario.reset();
            carregar();
        } catch (e) {
            erro.textContent = e.message;
        }
        enviar.disabled = false;
        enviar.textContent = 'Enviar';
    });
    conteudo.replaceChildren(
        h('p', {class: 'subtitulo'}, 'As imagens das bordas e efeitos que não são feitos só com código (molduras desenhadas, animações) ficam guardadas no banco. '
            + 'Cada uma fica em /api/loja/imagens/{nome}, o endereço que a borda usa. Trocar uma imagem leva até uma hora para aparecer para todo mundo.'),
        h('section', {class: 'caixa-de-lancamentos'}, h('h3', null, 'Enviar imagem'), formulario),
        h('section', {class: 'caixa-de-lancamentos'}, h('h3', null, 'Imagens enviadas'), lista));
    await carregar();
}

async function contasDoGerenciamento(conteudo, vez) {
    const busca = h('input', {type: 'search', placeholder: 'Buscar por nick ou e-mail…', 'aria-label': 'Buscar por nick ou e-mail', value: estado.buscaNoGerenciamento || ''});
    let filtro = estado.filtroNoGerenciamento || 'todas';
    const filtros = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Mostrar'});
    const lista = h('div', {class: 'lista-de-contas'});
    const mais = h('button', {type: 'button', class: 'botao', hidden: true}, 'Mais contas');
    const total = h('p', {class: 'subtitulo total-de-contas'});
    conteudo.replaceChildren(h('div', {class: 'ferramentas'}, busca), filtros, total, lista, h('div', {class: 'paginacao'}, mais));

    const linhaDaConta = conta => {
        const linha = h('article', {class: 'linha-de-conta'});
        const desenhar = punicao => {
            conta.punicao = punicao;
            linha.replaceChildren(...[
                h('a', {class: 'quem', href: '#/comunidade/perfil/' + conta.id}, avatar(conta)),
                h('div', {class: 'dados-da-conta'},
                    h('div', {class: 'nome-da-conta'},
                        h('a', {href: '#/comunidade/perfil/' + conta.id}, h('b', null, conta.nick)),
                        conta.admin ? h('span', {class: 'selo-admin'}, 'Admin') : null,
                        punicao ? h('span', {class: 'selo-de-punicao ' + punicao.tipo}, descricaoDaPunicao(punicao)) : null),
                    h('small', null, conta.email + ' · ' + (conta.posts === 1 ? '1 post' : conta.posts + ' posts')
                        + (conta.imagensBarradas ? ' · ' + conta.imagensBarradas + (conta.imagensBarradas === 1 ? ' imagem barrada' : ' imagens barradas') : '')
                        + ' · conta de ' + new Date(conta.criadaEm).toLocaleDateString('pt-BR')),
                    punicao ? h('small', {class: 'detalhe-da-punicao'},
                        (punicao.motivo ? 'Motivo: ' + punicao.motivo + '. ' : 'Sem motivo informado. ')
                        + (conta.punidaPor ? 'Por ' + conta.punidaPor : '') + (conta.punidaEm ? ' em ' + dataEHora(conta.punidaEm) : '')) : null),
                conta.admin ? null : h('div', {class: 'acoes-de-moderacao'}, ...botoesDeModeracao(conta, nova => {
                    conta.punidaPor = estado.sessao.conta.nick;
                    conta.punidaEm = new Date().toISOString();
                    desenhar(nova);
                }))].filter(Boolean));
        };
        desenhar(conta.punicao);
        return linha;
    };

    let pagina = 1;
    let pedido = 0;
    const carregar = async (deNovo) => {
        const meu = ++pedido;
        if (deNovo) pagina = 1;
        mais.disabled = true;
        try {
            const resposta = await chamar('GET', '/api/comunidade/gerenciamento/contas?' + new URLSearchParams({busca: busca.value.trim(), filtro, pagina: String(pagina)}));
            if (meu !== pedido || vez !== estado.render) return;
            const linhas = resposta.contas.map(linhaDaConta);
            if (deNovo) lista.replaceChildren(...linhas);
            else lista.append(...linhas);
            if (deNovo && linhas.length === 0) lista.append(vazio('Nenhuma conta encontrada', busca.value.trim() ? 'Tente outro nick ou e-mail.' : ''));
            total.textContent = resposta.total === 1 ? '1 conta' : resposta.total + ' contas';
            mais.hidden = resposta.pagina >= resposta.paginas;
        } catch (e) {
            if (meu === pedido) lista.replaceChildren(vazio('Não deu para carregar as contas', e.message));
        }
        mais.disabled = false;
    };
    const desenharFiltros = () => filtros.replaceChildren(...[['todas', 'Todas'], ['punidas', 'Punidas'], ['suspensas', 'Suspensas'], ['banidas', 'Banidas']]
        .map(([valor, texto]) => h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(filtro === valor), onclick: () => {
            filtro = estado.filtroNoGerenciamento = valor;
            desenharFiltros();
            carregar(true);
        }}, texto)));
    desenharFiltros();
    let espera;
    busca.addEventListener('input', () => {
        estado.buscaNoGerenciamento = busca.value;
        clearTimeout(espera);
        espera = setTimeout(() => carregar(true), 250);
    });
    mais.addEventListener('click', () => {
        pagina++;
        carregar(false);
    });
    await carregar(true);
}

async function registroDoGerenciamento(conteudo, vez) {
    const lista = h('ol', {class: 'registro-da-moderacao'});
    const mais = h('button', {type: 'button', class: 'botao', hidden: true}, 'Ver mais');
    conteudo.replaceChildren(lista, h('div', {class: 'paginacao'}, mais));
    let pagina = 1;
    const carregar = async () => {
        mais.disabled = true;
        try {
            const resposta = await chamar('GET', '/api/comunidade/gerenciamento/registro?pagina=' + pagina);
            if (vez !== estado.render) return;
            lista.append(...resposta.itens.map(item => h('li', {class: 'item-do-registro acao-' + item.acao},
                h('time', {datetime: item.criadaEm}, dataEHora(item.criadaEm)),
                h('p', null, ...frasesDoRegistro(item)),
                item.motivo ? h('small', null, 'Motivo: ' + item.motivo) : null)));
            if (pagina === 1 && resposta.itens.length === 0) conteudo.replaceChildren(vazio('Nada no registro ainda', 'Suspensões, banimentos, posts apagados por admins e imagens barradas pelo robô aparecem aqui.'));
            mais.hidden = !resposta.temMais;
        } catch (e) {
            conteudo.replaceChildren(vazio('Não deu para carregar o registro', e.message));
        }
        mais.disabled = false;
    };
    mais.addEventListener('click', () => {
        pagina++;
        carregar();
    });
    await carregar();
}

/** Uma imagem grande, por cima da pagina. */
function verImagem(endereco) {
    const dialogo = h('dialog', {class: 'imagem-grande'},
        h('form', {method: 'dialog'}, h('button', {class: 'fechar', 'aria-label': 'Fechar'}, '×')),
        h('img', {src: endereco, alt: ''}));
    dialogo.addEventListener('click', evento => { if (evento.target === dialogo || evento.target.tagName === 'IMG') dialogo.close(); });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
}

/** Capa de um manga da lista anexada (a copia de quando foi publicada), com a nota por cima (o status nao aparece). */
function capaDaLista(item, comNota, autor) {
    return h('div', {class: 'capa' + (item.favorito ? ' favorita' + classesDaLoja(autor) : '')},
        item.capa ? h('img', {src: item.capa, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', width: '300', height: '450'})
            : h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, (item.titulo || '?').charAt(0).toUpperCase()),
        comNota ? etiquetaNota(item.nota) : null,
        item.favorito ? enfeiteDaBorda() : null);
}

/**
 * A lista anexada a um post: no post, so a capa do primeiro manga (com as seguintes empilhadas atras), o titulo e
 * quantos sao. Clicar abre a lista inteira numa janela.
 */
function listaDoPost(lista, autor) {
    const quantos = lista.itens.length === 1 ? '1 mangá' : lista.itens.length + ' mangás';
    // com um manga so, o post mostra ele, e clicar abre direto as informacoes dele
    if (lista.itens.length === 1) {
        const item = lista.itens[0];
        return h('button', {type: 'button', class: 'lista-do-post', 'aria-label': 'Ver o mangá ' + item.titulo, onclick: () => abrirListaDoPost(lista, autor)},
            h('div', {class: 'pilha-de-capas'}, capaDaLista(item, false, autor)),
            h('div', {class: 'sobre-a-lista'},
                h('span', {class: 'tipo-da-lista'}, 'Mangá'),
                h('b', null, item.titulo),
                lista.titulo ? h('small', null, lista.titulo) : null,
                h('span', {class: 'ver-lista'}, 'Ver mangá →')));
    }
    return h('button', {type: 'button', class: 'lista-do-post', 'aria-label': 'Ver a lista ' + (lista.titulo || 'de mangás') + ', ' + quantos,
        onclick: () => abrirListaDoPost(lista, autor)},
    h('div', {class: 'pilha-de-capas' + (lista.itens.length > 1 ? ' com-mais' : '')}, capaDaLista(lista.itens[0], false, autor)),
    h('div', {class: 'sobre-a-lista'},
        h('span', {class: 'tipo-da-lista'}, 'Lista'),
        h('b', null, lista.titulo || 'Lista de mangás'),
        h('small', null, quantos + ': ' + lista.itens.slice(0, 3).map(item => item.titulo).join(', ') + (lista.itens.length > 3 ? '…' : '')),
        h('span', {class: 'ver-lista'}, 'Ver lista →')));
}

/**
 * O que alguem cadastrou de um manga, so para ver: capa, nota, favorito, ultimo capitulo lido, tags e descricao (e o
 * status, quando vem). Usado nas listas dos posts e nos mangas do perfil. item: { titulo, capa, status?, nota,
 * favorito, capitulo, tags, descricao }.
 */
function detalheDoMangaDeOutro(item, autor, observacao) {
    const capitulo = item.capitulo == null ? null : mostrarCapitulo(item.capitulo);
    return h('div', {class: 'manga-da-lista'},
        capaDaLista(item, false, autor),
        h('div', {class: 'sobre-o-manga'},
            h('div', {class: 'linha'},
                item.status ? etiquetaStatus(item.status) : null,
                item.nota != null ? etiquetaNota(item.nota, true) : h('span', {class: 'capitulo-atual'}, 'Sem nota'),
                item.favorito ? h('span', {class: 'selo-favorito'}, '★ Favorito') : null),
            capitulo != null ? h('p', {class: 'capitulo-atual'}, 'Último capítulo lido: ', h('b', null, capitulo)) : null,
            item.tags && item.tags.length ? h('div', {class: 'linha'}, item.tags.map(tag => h('span', {class: 'tag'}, tag))) : null,
            item.descricao ? h('p', {class: 'descricao'}, item.descricao) : h('p', {class: 'descricao sem'}, 'Sem descrição.'),
            observacao ? h('p', {class: 'nota-de-login'}, observacao) : null));
}

/**
 * Janela com todos os mangas da lista; clicar em um mostra o que o autor tinha cadastrado dele. So para ver. Com um
 * manga aberto, fechar (× ou Esc) volta para a lista; com a lista aberta, fecha a janela. Uma lista de um manga so
 * abre direto nele, sem a volta para a lista.
 */
function abrirListaDoPost(lista, autor) {
    const conteudo = h('div', {class: 'conteudo-da-lista'});
    const titulo = h('h2', null);
    const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
    // a lista abre com o tema de quem publicou (e as capas com a borda e o efeito dele)
    const dialogo = h('dialog', {class: 'janela-da-lista-publicada janela-com-tema', 'data-tema': temaParaVer(autor.tema)},
        ...camadasDoTema(), h('div', {class: 'topo-da-janela'}, titulo, fechar), conteudo);
    let vendoManga = false;
    const soUm = lista.itens.length === 1;
    fechar.addEventListener('click', () => {
        if (vendoManga && !soUm) mostrarLista();
        else dialogo.close();
    });
    // o Esc do navegador tambem volta para a lista antes de fechar
    dialogo.addEventListener('cancel', evento => {
        if (!vendoManga || soUm) return;
        evento.preventDefault();
        mostrarLista();
    });

    const mostrarLista = () => {
        vendoManga = false;
        fechar.setAttribute('aria-label', 'Fechar');
        titulo.textContent = lista.titulo || 'Lista de mangás';
        conteudo.replaceChildren(
            h('p', {class: 'subtitulo'}, 'Lista de ', h('b', null, autor.nick), ' · ', lista.itens.length === 1 ? '1 mangá' : lista.itens.length + ' mangás'),
            h('div', {class: 'grade-da-lista'}, lista.itens.map(item => h('button', {type: 'button', class: 'item-da-lista', title: item.titulo,
                onclick: () => mostrarManga(item)}, capaDaLista(item, true, autor), h('span', {class: 'nome-do-item'}, item.titulo)))));
    };
    const mostrarManga = item => {
        vendoManga = true;
        fechar.setAttribute('aria-label', soUm ? 'Fechar' : 'Voltar para a lista');
        titulo.textContent = item.titulo;
        // o status (lendo, hiatus...) e de quem cadastrou: nas listas dos posts nao aparece
        conteudo.replaceChildren(...[
            soUm ? null : h('button', {type: 'button', class: 'voltar-para-a-lista', onclick: mostrarLista}, '← Voltar para a lista'),
            detalheDoMangaDeOutro(item, autor, 'Como estava na Biblioteca de ' + autor.nick + ' quando ' + (soUm ? 'o post foi publicado.' : 'a lista foi publicada.'))].filter(Boolean));
        conteudo.scrollTop = 0;
    };
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    if (soUm) mostrarManga(lista.itens[0]);
    else mostrarLista();
    dialogo.showModal();
}

/**
 * Os mangas da Biblioteca de alguem, abertos pelo numero de mangas do perfil: como a janela de montar lista (busca,
 * status, ordem e as capas vindo aos poucos), mas so para ver. Clicar numa capa mostra o que a pessoa cadastrou dele;
 * fechar (× ou Esc) volta para as capas.
 */
function janelaDosMangasDoPerfil(perfil) {
    const filtro = {busca: '', status: '', ordem: 'CADASTRO'};
    const busca = h('input', {type: 'search', placeholder: 'Buscar pelo nome…', 'aria-label': 'Buscar mangá'});
    const ordenar = seletor(estado.ordens, filtro.ordem);
    ordenar.setAttribute('aria-label', 'Ordenar por');
    ordenar.className = 'ordenar';
    const filtros = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Filtrar por status'});
    for (const opcao of [{valor: '', descricao: 'Todos'}, ...estado.status]) {
        filtros.append(h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(filtro.status === opcao.valor), onclick: evento => {
            filtro.status = opcao.valor;
            for (const botao of filtros.children) botao.setAttribute('aria-pressed', 'false');
            evento.currentTarget.setAttribute('aria-pressed', 'true');
            recomecar();
        }}, opcao.descricao));
    }
    const grade = h('div', {class: 'grade-para-escolher'});
    const fim = h('div', {class: 'fim-da-grade'});
    const titulo = h('h2', null, 'Mangás de ' + perfil.nick);
    const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
    const rolagem = h('div', {class: 'rolagem-da-escolha'}, grade, fim);
    const ferramentas = [h('div', {class: 'ferramentas'}, busca, h('span', {class: 'espaco'}), ordenar), filtros];
    const detalhe = h('div', {class: 'conteudo-da-lista', hidden: true});
    // a janela usa o tema do site da pessoa (cores, fundo e animacao), nunca o de quem esta vendo
    const dialogo = h('dialog', {class: 'janela-da-lista janela-dos-mangas-do-perfil janela-com-tema', 'data-tema': temaParaVer(perfil.tema)},
        ...camadasDoTema(),
        h('div', {class: 'topo-da-janela'}, titulo, fechar), ...ferramentas, rolagem, detalhe);
    let vendoManga = false;
    const mostrarCapas = () => {
        vendoManga = false;
        titulo.textContent = 'Mangás de ' + perfil.nick;
        fechar.setAttribute('aria-label', 'Fechar');
        detalhe.hidden = true;
        for (const parte of [...ferramentas, rolagem]) parte.hidden = false;
    };
    const mostrarManga = item => {
        vendoManga = true;
        titulo.textContent = item.titulo;
        fechar.setAttribute('aria-label', 'Voltar para os mangás');
        for (const parte of [...ferramentas, rolagem]) parte.hidden = true;
        detalhe.replaceChildren(
            h('button', {type: 'button', class: 'voltar-para-a-lista', onclick: mostrarCapas}, '← Voltar para os mangás'),
            detalheDoMangaDeOutro(item, perfil, perfil.euMesmo ? 'Como está na sua Biblioteca.' : 'Como está na Biblioteca de ' + perfil.nick + '.'));
        detalhe.hidden = false;
        detalhe.scrollTop = 0;
    };
    const cartao = item => h('button', {type: 'button', class: 'para-escolher', title: item.titulo, onclick: () => mostrarManga(item)},
        capaDaLista({...item, capa: item.miniatura || item.capa}, true, perfil),
        h('span', {class: 'nome-do-item'}, item.titulo));

    // as capas vem do servidor aos poucos (48 por vez), ja buscadas, filtradas e ordenadas
    let pagina = 0;
    let temMais = true;
    let pedido = 0;
    const carregar = async () => {
        if (!temMais) return;
        const vez = pedido;
        const parametros = new URLSearchParams({pagina: String(pagina + 1)});
        if (filtro.busca.trim()) parametros.set('titulo', filtro.busca.trim());
        if (filtro.status) parametros.set('status', filtro.status);
        if (filtro.ordem && filtro.ordem !== 'CADASTRO') parametros.set('ordem', filtro.ordem);
        fim.textContent = 'Carregando…';
        let resposta;
        try {
            resposta = await chamar('GET', '/api/comunidade/contas/' + encodeURIComponent(perfil.id) + '/mangas?' + parametros);
        } catch (e) {
            if (vez === pedido) fim.textContent = e.message;
            return;
        }
        if (vez !== pedido) return;
        pagina = resposta.pagina;
        temMais = resposta.pagina < resposta.paginas && resposta.total > 0;
        grade.append(...resposta.itens.map(cartao));
        fim.textContent = resposta.total === 0
            ? (filtro.busca || filtro.status ? 'Nenhum mangá encontrado.' : (perfil.euMesmo ? 'Sua Biblioteca está vazia.' : perfil.nick + ' ainda não cadastrou mangás.'))
            : '';
        requestAnimationFrame(talvezCarregar);
    };
    const recomecar = () => {
        pedido++;
        pagina = 0;
        temMais = true;
        grade.replaceChildren();
        carregar();
    };
    let espera;
    busca.addEventListener('input', () => {
        filtro.busca = busca.value;
        clearTimeout(espera);
        espera = setTimeout(recomecar, 220);
    });
    ordenar.addEventListener('change', () => {
        filtro.ordem = ordenar.value;
        recomecar();
    });
    const pertoDoFim = () => fim.getBoundingClientRect().top < Math.min(rolagem.getBoundingClientRect().bottom, dialogo.getBoundingClientRect().bottom) + 400;
    const talvezCarregar = () => {
        if (dialogo.open && !vendoManga && temMais && fim.textContent !== 'Carregando…' && pertoDoFim()) carregar();
    };
    dialogo.addEventListener('scroll', talvezCarregar, {capture: true, passive: true});
    fechar.addEventListener('click', () => {
        if (vendoManga) mostrarCapas();
        else dialogo.close();
    });
    // o Esc volta para as capas antes de fechar
    dialogo.addEventListener('cancel', evento => {
        if (!vendoManga) return;
        evento.preventDefault();
        mostrarCapas();
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    carregar();
}

/**
 * Abre um post em tela propria (maior, com os comentarios embaixo), guardando a tela da Comunidade de onde a pessoa
 * veio do jeito que estava (posts carregados e rolagem). Voltar devolve essa tela, sem recarregar o feed.
 */
function abrirPost(id) {
    estado.comunidadeGuardada = {
        hash: location.hash || '#/comunidade',
        filhos: [...app.childNodes],
        rolagem: window.scrollY,
        vez: estado.render,
        recarregar: estado.recarregar,
        retomar: estado.retomarFeed,
        titulo: document.title,
        // o tema da pagina (no perfil de outra pessoa, o dela) volta junto
        tema: document.documentElement.dataset.tema || null,
    };
    estado.postAberto = id;
    location.hash = '#/comunidade/post/' + id;
}

/** Devolve a tela da Comunidade guardada ao abrir um post, no mesmo ponto da rolagem. */
function restaurarComunidade(guardada) {
    estado.comunidadeGuardada = null;
    app.replaceChildren(...guardada.filhos);
    estado.render = guardada.vez;
    estado.recarregar = guardada.recarregar;
    document.title = guardada.titulo;
    if (guardada.tema) mostrarTemaNaPagina(guardada.tema);
    requestAnimationFrame(() => window.scrollTo(0, guardada.rolagem));
    if (guardada.retomar) guardada.retomar();
    // o post que foi aberto volta atualizado (curtidas e comentarios novos), ou some, se foi apagado
    const id = estado.postAberto;
    estado.postAberto = null;
    const antigo = id ? app.querySelector('.post[data-id="' + id + '"]') : null;
    if (!antigo) return;
    if (estado.postApagado === id) {
        antigo.remove();
        estado.postApagado = null;
        return;
    }
    chamar('GET', '/api/comunidade/posts?ids=' + id).then(([novo]) => {
        if (novo && antigo.isConnected) antigo.replaceWith(cartaoDePost(novo));
    }).catch(() => {});
}

/** Sai do post aberto: volta para onde a pessoa estava na Comunidade (ou para o feed, se entrou direto no post). */
function voltarDoPost() {
    if (estado.comunidadeGuardada) history.back();
    else location.hash = '#/comunidade';
}

/** O texto de um post ou comentario, com cada #hashtag virando um link para a busca dela. */
function textoComHashtags(texto) {
    const partes = [];
    let desde = 0;
    for (const achado of texto.matchAll(/#([\p{L}\p{N}_]{1,50})/gu)) {
        // "a#b" nao e hashtag: o # precisa estar no comeco ou depois de algo que nao seja letra ou numero
        if (achado.index > 0 && /[\p{L}\p{N}_]/u.test(texto[achado.index - 1])) continue;
        partes.push(texto.slice(desde, achado.index),
            h('a', {class: 'hashtag', href: '#/comunidade/busca?q=' + encodeURIComponent(achado[0])}, achado[0]));
        desde = achado.index + achado[0].length;
    }
    partes.push(texto.slice(desde));
    return partes.filter(parte => parte !== '');
}

/**
 * Um post. No feed, clicar nele (fora dos botoes e links) ou no 💬 abre o post em tela propria. Maximizado (a tela do
 * post), o texto fica maior e os comentarios aparecem embaixo, com o campo de comentar no alto deles.
 */
function cartaoDePost(post, {maximizado} = {}) {
    const cartao = h('article', {class: 'post' + (maximizado ? ' maximizado' : ' clicavel'), 'data-id': post.id});
    if (!maximizado) {
        cartao.addEventListener('click', evento => {
            // botoes, links, imagens e texto selecionado continuam fazendo o que fazem. O caminho do clique e o de quando
            // ele comecou: o botao de curtir redesenha o que tem dentro no clique, e o alvo ja nao estaria mais na pagina
            const caminho = evento.composedPath();
            if (caminho.some(no => no instanceof Element && no.matches('a, button, input, textarea, select, label')) || String(window.getSelection()).trim()) return;
            abrirPost(post.id);
        });
    }
    const curtir = h('button', {type: 'button', class: 'acao-do-post curtir', 'aria-pressed': String(post.curti)});
    const mostrarCurtidas = () => {
        curtir.setAttribute('aria-pressed', String(post.curti));
        curtir.replaceChildren(h('span', {'aria-hidden': 'true'}, post.curti ? '♥' : '♡'), ' ', String(post.curtidas), h('span', {class: 'so-leitor'}, ' curtidas'));
        curtir.title = post.curti ? 'Descurtir' : 'Curtir';
    };
    curtir.addEventListener('click', async evento => {
        // curtir nunca abre o post (so o comentario abre)
        evento.stopPropagation();
        // muda na hora e confirma com o servidor
        post.curti = !post.curti;
        post.curtidas += post.curti ? 1 : -1;
        mostrarCurtidas();
        try {
            Object.assign(post, await chamar(post.curti ? 'POST' : 'DELETE', '/api/comunidade/posts/' + post.id + '/curtida'));
        } catch (e) {
            post.curti = !post.curti;
            post.curtidas += post.curti ? 1 : -1;
            avisar(e.message, true);
        }
        mostrarCurtidas();
    });
    mostrarCurtidas();

    const areaDeComentarios = maximizado ? h('section', {class: 'comentarios', 'aria-label': 'Comentários'}) : null;
    const comentar = h('button', {type: 'button', class: 'acao-do-post', title: maximizado ? 'Comentar' : 'Ver os comentários'});
    const mostrarComentarios = () => comentar.replaceChildren(h('span', {'aria-hidden': 'true'}, '💬'), ' ', String(post.comentarios), h('span', {class: 'so-leitor'}, ' comentários'));
    mostrarComentarios();
    comentar.addEventListener('click', () => {
        if (maximizado) areaDeComentarios.querySelector('textarea')?.focus();
        else abrirPost(post.id);
    });

    const apagar = post.podeApagar ? h('button', {type: 'button', class: 'acao-do-post apagar', title: 'Apagar post'}, h('span', {'aria-hidden': 'true'}, '🗑'), h('span', {class: 'so-leitor'}, 'Apagar post')) : null;
    if (apagar) apagar.addEventListener('click', async () => {
        if (!await confirmar('Apagar o post?', 'O post, as curtidas e os comentários dele somem para sempre.', 'Apagar')) return;
        try {
            await chamar('DELETE', '/api/comunidade/posts/' + post.id);
            avisar('Post apagado');
            if (maximizado) {
                estado.postApagado = post.id;
                voltarDoPost();
            } else {
                cartao.remove();
            }
        } catch (e) {
            avisar(e.message, true);
        }
    });

    const perfil = '#/comunidade/perfil/' + post.autor.id;
    cartao.append(
        h('a', {class: 'autor-do-post', href: perfil, 'aria-label': post.autor.nick}, avatar(post.autor)),
        h('div', {class: 'corpo-do-post'},
            h('div', {class: 'cabecalho-do-post'},
                h('a', {class: 'nick', href: perfil}, post.autor.nick),
                h('a', {class: 'quando', href: '#/comunidade/post/' + post.id, title: new Date(post.criadoEm).toLocaleString('pt-BR'),
                    onclick: maximizado ? null : evento => { evento.preventDefault(); abrirPost(post.id); }}, quandoFoi(post.criadoEm)),
                // no feed, so para quem ainda nao segue; no post aberto, sempre (Seguir ou Seguindo)
                !post.meu && (maximizado || !post.sigoOAutor) ? botaoDeSeguir(post.autor.id, post.sigoOAutor) : null),
            post.texto ? h('p', {class: 'texto-do-post'}, textoComHashtags(post.texto)) : null,
            post.imagens.length ? h('div', {class: 'imagens-do-post quantas-' + post.imagens.length},
                post.imagens.map(endereco => h('button', {type: 'button', class: 'imagem-do-post', onclick: () => verImagem(endereco), 'aria-label': 'Ver imagem'},
                    h('img', {src: endereco, alt: '', loading: 'lazy', decoding: 'async'})))) : null,
            post.lista ? listaDoPost(post.lista, post.autor) : null,
            h('div', {class: 'acoes-do-post'}, comentar, curtir, apagar)));
    if (maximizado) {
        carregarComentarios(post, areaDeComentarios, total => { post.comentarios = total; mostrarComentarios(); }, true);
        // os comentarios ficam embaixo do post, ocupando a largura toda
        return h('div', {class: 'post-aberto'}, cartao, areaDeComentarios);
    }
    return cartao;
}

/** @param formularioAntes o campo de comentar vem antes da lista (na tela do post, como no Twitter) */
async function carregarComentarios(post, area, aoContar, formularioAntes) {
    const lista = h('div', {class: 'lista-de-comentarios'});
    const campo = h('textarea', {rows: '1', maxlength: String(TEXTO_DO_POST_MAXIMO), placeholder: 'Escreva um comentário…', 'aria-label': 'Comentário'});
    const enviar = h('button', {type: 'submit', class: 'botao pequeno primario'}, 'Comentar');
    const formulario = h('form', {class: 'novo-comentario'}, avatar(estado.sessao.conta), campo, enviar);
    const desenhar = comentarios => {
        aoContar(comentarios.length);
        lista.replaceChildren(...comentarios.map(comentario => {
            const apagar = comentario.podeApagar ? h('button', {type: 'button', class: 'apagar-comentario', title: 'Apagar comentário'}, '×') : null;
            const item = h('div', {class: 'comentario'},
                h('a', {href: '#/comunidade/perfil/' + comentario.autor.id}, avatar(comentario.autor)),
                h('div', null,
                    h('div', {class: 'cabecalho-do-post'}, h('a', {class: 'nick', href: '#/comunidade/perfil/' + comentario.autor.id}, comentario.autor.nick),
                        h('span', {class: 'quando'}, quandoFoi(comentario.criadoEm)), apagar),
                    h('p', {class: 'texto-do-post'}, textoComHashtags(comentario.texto))));
            if (apagar) apagar.addEventListener('click', async () => {
                if (!await confirmar('Apagar o comentário?', 'Ele some para sempre.', 'Apagar')) return;
                try {
                    await chamar('DELETE', '/api/comunidade/comentarios/' + comentario.id);
                    item.remove();
                    aoContar(lista.children.length);
                } catch (e) {
                    avisar(e.message, true);
                }
            });
            return item;
        }));
    };
    campo.addEventListener('input', () => { campo.style.height = 'auto'; campo.style.height = campo.scrollHeight + 'px'; });
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (!campo.value.trim()) return;
        enviar.disabled = true;
        try {
            desenhar(await chamar('POST', '/api/comunidade/posts/' + post.id + '/comentarios', {texto: campo.value}));
            campo.value = '';
            campo.style.height = 'auto';
        } catch (e) {
            avisar(e.message, true);
        }
        enviar.disabled = false;
    });
    area.replaceChildren(h('p', {class: 'subtitulo'}, 'Carregando…'));
    try {
        desenhar(await chamar('GET', '/api/comunidade/posts/' + post.id + '/comentarios'));
    } catch (e) {
        area.replaceChildren(h('p', {class: 'erro-de-login'}, e.message));
        return;
    }
    area.replaceChildren(...(formularioAntes ? [formulario, lista] : [lista, formulario]));
}

/** O botao redondo no canto, que abre a janela de escrever um post. */
function botaoDeEscrever() {
    const botao = h('button', {type: 'button', class: 'botao-de-escrever', title: 'Escrever um post', 'aria-label': 'Escrever um post'}, '✎');
    botao.addEventListener('click', () => {
        const dialogo = h('dialog', {class: 'janela-de-escrever'});
        const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
        fechar.addEventListener('click', () => dialogo.close());
        dialogo.append(h('div', {class: 'topo-da-janela'}, h('h2', null, 'Novo post'), fechar), editorDePost(post => {
            dialogo.close();
            const feed = app.querySelector('.feed');
            // no proprio feed ou no proprio perfil, o post novo aparece em cima; em outra tela, abre o post
            if (feed && (!location.hash.includes('/perfil/') || location.hash.endsWith(estado.sessao.conta.id))) porNoFeed(feed, post);
            else location.hash = '#/comunidade/post/' + post.id;
            avisar('Post publicado');
        }, true));
        dialogo.addEventListener('close', () => dialogo.remove());
        document.body.append(dialogo);
        dialogo.showModal();
        dialogo.querySelector('textarea').focus();
    });
    return botao;
}

/**
 * Campo de escrever um post: texto (ate 500), ate 4 imagens (escolhidas ou coladas com Ctrl+V) e uma lista de mangas
 * da Biblioteca. As imagens sao diminuidas aqui antes de enviar.
 */
function editorDePost(aoPublicar, naJanela) {
    const imagens = []; // {nome, url} ja enviadas
    let lista = null; // {titulo, mangas: [{id, title, imageUrl, thumbUrl}]}
    const texto = h('textarea', {rows: naJanela ? '5' : '2', maxlength: String(TEXTO_DO_POST_MAXIMO), placeholder: 'O que você está lendo?', 'aria-label': 'Texto do post'});
    const contador = h('span', {class: 'contador'});
    const previas = h('div', {class: 'previas-do-post'});
    const anexo = h('div', {class: 'anexo-da-lista'});
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const publicar = h('button', {type: 'submit', class: 'botao primario'}, 'Publicar');
    const arquivo = h('input', {type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true});
    const botaoImagem = h('button', {type: 'button', class: 'ferramenta-do-post', title: 'Adicionar imagens (ou cole com Ctrl+V)'}, '🖼', h('span', null, ' Imagem'));
    const botaoLista = h('button', {type: 'button', class: 'ferramenta-do-post', title: 'Anexar uma lista de mangás da sua Biblioteca'}, '📚', h('span', null, ' Lista'));
    let enviando = 0;

    const atualizar = () => {
        const tamanho = [...texto.value].length;
        contador.textContent = tamanho > TEXTO_DO_POST_MAXIMO - 80 ? String(TEXTO_DO_POST_MAXIMO - tamanho) : '';
        contador.classList.toggle('perto', tamanho > TEXTO_DO_POST_MAXIMO - 20);
        publicar.disabled = enviando > 0 || (!texto.value.trim() && imagens.length === 0 && !lista);
        botaoImagem.disabled = imagens.length + enviando >= IMAGENS_DO_POST_MAXIMO;
        previas.replaceChildren(...imagens.map(imagem => h('div', {class: 'previa'},
            h('img', {src: imagem.url, alt: ''}),
            h('button', {type: 'button', class: 'tirar', 'aria-label': 'Tirar imagem', onclick: () => { imagens.splice(imagens.indexOf(imagem), 1); atualizar(); }}, '×'))),
            ...Array.from({length: enviando}, () => h('div', {class: 'previa carregando'}, '…')));
        anexo.replaceChildren(...(lista ? [h('div', {class: 'lista-anexada'},
            h('span', null, h('b', null, lista.titulo || 'Lista de mangás'), ' · ', lista.mangas.length === 1 ? '1 mangá' : lista.mangas.length + ' mangás'),
            h('button', {type: 'button', class: 'botao pequeno', onclick: () => escolherLista(lista, nova => { lista = nova; atualizar(); })}, 'Editar'),
            h('button', {type: 'button', class: 'tirar', 'aria-label': 'Tirar a lista', onclick: () => { lista = null; atualizar(); }}, '×'))] : []));
    };

    const adicionarImagens = async arquivos => {
        erro.textContent = '';
        const cabem = arquivos.filter(escolhido => escolhido.type.startsWith('image/')).slice(0, IMAGENS_DO_POST_MAXIMO - imagens.length - enviando);
        enviando += cabem.length;
        atualizar();
        for (const escolhido of cabem) {
            try {
                // GIF vai como esta (para nao perder a animacao); as outras sao diminuidas
                const reduzida = escolhido.type === 'image/gif' ? escolhido : await reduzirImagem(escolhido, {largura: 1600, altura: 1600, qualidade: 0.85});
                const envio = new FormData();
                envio.append('arquivo', reduzida, 'imagem.' + ((reduzida.type || '').split('/')[1] || 'jpg'));
                imagens.push(await chamar('POST', '/api/comunidade/imagens', envio));
            } catch (e) {
                erro.textContent = /decode|bitmap/i.test(e.message) ? 'Não foi possível ler uma das imagens.' : e.message;
            }
            enviando--;
            atualizar();
        }
    };
    arquivo.addEventListener('change', () => {
        adicionarImagens([...arquivo.files]);
        arquivo.value = '';
    });
    botaoImagem.addEventListener('click', () => arquivo.click());
    // colar imagem (print, imagem copiada) direto no campo
    texto.addEventListener('paste', evento => {
        const coladas = [...(evento.clipboardData?.files || [])].filter(colado => colado.type.startsWith('image/'));
        if (coladas.length) {
            evento.preventDefault();
            adicionarImagens(coladas);
        }
    });
    texto.addEventListener('input', () => {
        if (!naJanela) {
            texto.style.height = 'auto';
            texto.style.height = Math.min(texto.scrollHeight, 320) + 'px';
        }
        atualizar();
    });
    botaoLista.addEventListener('click', () => escolherLista(lista, nova => { lista = nova; atualizar(); }));

    const formulario = h('form', {class: 'editor-de-post' + (naJanela ? ' na-janela' : '')},
        avatar(estado.sessao.conta),
        h('div', {class: 'campo-do-post'},
            texto, previas, anexo, erro,
            h('div', {class: 'barra-do-post'}, botaoImagem, botaoLista, arquivo, h('span', {class: 'espaco'}), contador, publicar)));
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        publicar.disabled = true;
        try {
            const post = await chamar('POST', '/api/comunidade/posts', {
                texto: texto.value,
                imagens: imagens.map(imagem => imagem.nome),
                lista: lista ? {titulo: lista.titulo, mangas: lista.mangas.map(manga => manga.id)} : null,
            });
            texto.value = '';
            texto.style.height = '';
            imagens.length = 0;
            lista = null;
            aoPublicar(post);
        } catch (e) {
            erro.textContent = e.message;
        }
        atualizar();
    });
    atualizar();
    return formulario;
}

/**
 * Janela para montar a lista: uma Biblioteca simplificada (capas, nomes, notas e borda de favorito), com busca, filtro
 * de status e ordem. Clicar numa capa poe o manga na lista: ela escurece e mostra a posicao dele; clicar de novo tira.
 * Ate 20 mangas, na ordem em que foram escolhidos.
 */
function escolherLista(atual, aoConfirmar) {
    const POR_PAGINA = 48;
    const escolhidos = atual ? [...atual.mangas] : [];
    const filtro = {busca: '', status: '', ordem: estado.ordem || 'CADASTRO'};
    const titulo = h('input', {type: 'text', maxlength: '80', placeholder: 'Título da lista (opcional): ex. Os que mais recomendo', value: atual ? atual.titulo : '', 'aria-label': 'Título da lista'});
    const busca = h('input', {type: 'search', placeholder: 'Buscar pelo nome…', 'aria-label': 'Buscar mangá'});
    const ordenar = seletor(estado.ordens, filtro.ordem);
    ordenar.setAttribute('aria-label', 'Ordenar por');
    ordenar.className = 'ordenar';
    const filtros = h('div', {class: 'filtros', role: 'group', 'aria-label': 'Filtrar por status'});
    for (const opcao of [{valor: '', descricao: 'Todos'}, ...estado.status]) {
        filtros.append(h('button', {type: 'button', class: 'filtro', 'aria-pressed': String(filtro.status === opcao.valor), onclick: evento => {
            filtro.status = opcao.valor;
            for (const botao of filtros.children) botao.setAttribute('aria-pressed', 'false');
            evento.currentTarget.setAttribute('aria-pressed', 'true');
            recomecar();
        }}, opcao.descricao));
    }
    const grade = h('div', {class: 'grade-para-escolher'});
    const fim = h('div', {class: 'fim-da-grade'});
    const contagem = h('span', {class: 'contagem-da-lista'});
    const limpar = h('button', {type: 'button', class: 'botao'}, 'Limpar');
    const anexar = h('button', {type: 'button', class: 'botao primario'});

    // cada capa sabe redesenhar a propria marca (a posicao na lista)
    const cartoes = new Map();
    const marcar = () => {
        for (const [id, cartao] of cartoes) {
            const posicao = escolhidos.findIndex(manga => manga.id === id);
            cartao.classList.toggle('escolhido', posicao >= 0);
            cartao.setAttribute('aria-pressed', String(posicao >= 0));
            cartao.querySelector('.posicao-na-lista').textContent = posicao >= 0 ? String(posicao + 1) : '';
            cartao.disabled = posicao < 0 && escolhidos.length >= MANGAS_DA_LISTA_MAXIMO;
        }
        contagem.textContent = escolhidos.length ? `${escolhidos.length} de ${MANGAS_DA_LISTA_MAXIMO} na lista` : 'Clique nas capas para montar a lista';
        anexar.textContent = escolhidos.length ? 'Anexar lista' : 'Escolha os mangás';
        anexar.disabled = escolhidos.length === 0;
        limpar.hidden = escolhidos.length === 0;
    };
    const cartaoParaEscolher = manga => {
        const cartao = h('button', {type: 'button', class: 'para-escolher', title: manga.title},
            h('div', {class: 'capa' + (manga.favorite ? ' favorita' : '')},
                h('img', {src: manga.thumbUrl || manga.imageUrl, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', width: '300', height: '450'}),
                etiquetaNota(manga.rating),
                h('span', {class: 'posicao-na-lista', 'aria-hidden': 'true'})),
            h('span', {class: 'nome-do-item'}, manga.title));
        cartao.addEventListener('click', () => {
            const posicao = escolhidos.findIndex(outro => outro.id === manga.id);
            if (posicao >= 0) escolhidos.splice(posicao, 1);
            else if (escolhidos.length < MANGAS_DA_LISTA_MAXIMO) escolhidos.push(manga);
            marcar();
        });
        cartoes.set(manga.id, cartao);
        return cartao;
    };

    // os mangas vem do servidor aos poucos (48 por vez), ja buscados, filtrados e ordenados
    let pagina = 0;
    let temMais = true;
    let pedido = 0;
    const carregar = async () => {
        if (!temMais) return;
        const vez = pedido;
        const parametros = new URLSearchParams({resumo: '1', pagina: String(pagina + 1), tamanho: String(POR_PAGINA)});
        if (filtro.busca.trim()) parametros.set('titulo', filtro.busca.trim());
        if (filtro.status) parametros.set('status', filtro.status);
        if (filtro.ordem && filtro.ordem !== 'CADASTRO') parametros.set('ordem', filtro.ordem);
        fim.textContent = 'Carregando…';
        let resposta;
        try {
            resposta = await chamar('GET', '/api/mangas?' + parametros);
        } catch (e) {
            if (vez === pedido) fim.textContent = e.message;
            return;
        }
        if (vez !== pedido) return;
        pagina = resposta.pagina;
        temMais = resposta.pagina < resposta.paginas && resposta.total > 0;
        grade.append(...resposta.itens.map(cartaoParaEscolher));
        fim.textContent = resposta.total === 0 ? 'Nenhum mangá encontrado na sua Biblioteca.' : '';
        marcar();
        // se a pagina nao encheu a tela, ja vem a proxima
        requestAnimationFrame(talvezCarregar);
    };
    const recomecar = () => {
        pedido++;
        pagina = 0;
        temMais = true;
        cartoes.clear();
        grade.replaceChildren();
        carregar();
    };
    let espera;
    busca.addEventListener('input', () => {
        filtro.busca = busca.value;
        clearTimeout(espera);
        espera = setTimeout(recomecar, 220);
    });
    ordenar.addEventListener('change', () => {
        filtro.ordem = ordenar.value;
        recomecar();
    });
    limpar.addEventListener('click', () => {
        escolhidos.length = 0;
        marcar();
    });

    const fechar = h('button', {type: 'button', class: 'fechar', 'aria-label': 'Fechar'}, '×');
    const rolagem = h('div', {class: 'rolagem-da-escolha'}, grade, fim);
    const dialogo = h('dialog', {class: 'janela-da-lista'},
        h('div', {class: 'topo-da-janela'}, h('h2', null, 'Montar lista'), fechar),
        titulo,
        h('div', {class: 'ferramentas'}, busca, h('span', {class: 'espaco'}), ordenar),
        filtros,
        rolagem,
        h('div', {class: 'rodape-da-escolha'}, contagem, h('span', {class: 'espaco'}), limpar, anexar));
    // a proxima pagina vem quando a grade chega perto do fim. Quem rola e a grade (telas altas) ou a janela inteira
    // (telas baixas, como o celular deitado): o fim e medido ate a borda de baixo do que estiver aparecendo
    const pertoDoFim = () => fim.getBoundingClientRect().top < Math.min(rolagem.getBoundingClientRect().bottom, dialogo.getBoundingClientRect().bottom) + 400;
    const talvezCarregar = () => {
        if (dialogo.open && temMais && fim.textContent !== 'Carregando…' && pertoDoFim()) carregar();
    };
    dialogo.addEventListener('scroll', talvezCarregar, {capture: true, passive: true});
    fechar.addEventListener('click', () => dialogo.close());
    anexar.addEventListener('click', () => {
        aoConfirmar({titulo: titulo.value.trim(), mangas: escolhidos});
        dialogo.close();
    });
    dialogo.addEventListener('close', () => dialogo.remove());
    document.body.append(dialogo);
    dialogo.showModal();
    marcar();
    recomecar();
    busca.focus();
}

// ------------------------------------------------------------------ configuracoes da conta

/** Pergunta de confirmacao em uma janela do site. Resolve true so com o clique em confirmar. */
function confirmar(titulo, texto, botao, perigo = true) {
    return new Promise(resolver => {
        const dialogo = h('dialog', {class: 'confirmacao'},
            h('form', {method: 'dialog'},
                h('h2', null, titulo),
                h('p', null, texto),
                h('div', {class: 'acoes'},
                    h('button', {value: 'nao', class: 'botao'}, 'Cancelar'),
                    h('button', {value: 'sim', class: perigo ? 'botao perigo cheio' : 'botao primario'}, botao))));
        dialogo.addEventListener('close', () => {
            resolver(dialogo.returnValue === 'sim');
            dialogo.remove();
        });
        document.body.append(dialogo);
        dialogo.showModal();
    });
}

/** Formulario de uma secao da conta: mostra o erro embaixo e trava o botao enquanto salva. */
function secaoDaConta(titulo, descricao, campos, textoDoBotao, aoEnviar, perigo) {
    const erro = h('p', {class: 'erro-de-login', role: 'alert'});
    const botao = h('button', {type: 'submit', class: 'botao ' + (perigo ? 'perigo cheio' : 'primario')}, textoDoBotao);
    const formulario = h('form', {class: 'secao-da-conta' + (perigo ? ' perigo' : '')},
        h('h2', null, titulo), descricao ? h('p', {class: 'subtitulo'}, descricao) : null, ...campos, erro, h('div', null, botao));
    formulario.addEventListener('submit', async evento => {
        evento.preventDefault();
        erro.textContent = '';
        botao.disabled = true;
        try {
            await aoEnviar(mensagem => { erro.textContent = mensagem; });
        } catch (e) {
            erro.textContent = e.message;
        }
        botao.disabled = false;
    });
    return formulario;
}

async function telaConta() {
    const vez = ++estado.render;
    document.title = 'Configurações · Viracap';
    // com a Comunidade, foto, nick e descricao ficam no proprio perfil (Editar perfil); aqui, so a conta
    const comPerfil = estado.temComunidade === true;
    let conta;
    try {
        conta = await chamar('GET', '/api/conta');
    } catch (e) {
        if (vez === estado.render) app.replaceChildren(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    // o que mudou passa a valer na pagina toda (o topo e a pergunta antes de excluir usam o nick e o e-mail)
    const atualizar = sessao => {
        estado.sessao = sessao;
        Object.assign(conta, sessao.conta);
        mostrarConta(sessao.conta);
    };

    // foto de perfil: recortada em quadrado e diminuida aqui mesmo, antes de enviar
    const previa = h('span', {class: 'previa-da-foto'}, avatar(conta, true));
    const arquivoDaFoto = h('input', {type: 'file', id: 'conta-foto', accept: 'image/png,image/jpeg,image/webp,image/gif'});
    const removerFoto = h('button', {type: 'button', class: 'botao', hidden: !conta.foto}, 'Remover foto');
    const textoDoEscolher = h('span', null, conta.foto ? 'Trocar foto' : 'Escolher foto');
    const erroDaFoto = h('p', {class: 'erro-de-login', role: 'alert'});
    const trocarFoto = async foto => {
        atualizar(await chamar('PUT', '/api/conta', {foto}));
        previa.replaceChildren(avatar(conta, true));
        cabecalho.querySelector('.inicial').replaceWith(avatar(conta, true));
        removerFoto.hidden = !conta.foto;
        textoDoEscolher.textContent = conta.foto ? 'Trocar foto' : 'Escolher foto';
    };
    arquivoDaFoto.addEventListener('change', async () => {
        const escolhido = arquivoDaFoto.files[0];
        arquivoDaFoto.value = '';
        if (!escolhido) return;
        erroDaFoto.textContent = '';
        try {
            const recortada = await recortarQuadrado(escolhido, 256);
            const envio = new FormData();
            envio.append('arquivo', recortada, 'foto.' + (recortada.type === 'image/webp' ? 'webp' : 'jpg'));
            await trocarFoto((await chamar('POST', '/api/imagens', envio)).imagePath);
            avisar('Foto salva');
        } catch (e) {
            erroDaFoto.textContent = e.message && !/decode|bitmap/i.test(e.message) ? e.message : 'Não foi possível ler essa imagem. Escolha outra.';
        }
    });
    removerFoto.addEventListener('click', async () => {
        erroDaFoto.textContent = '';
        try {
            await trocarFoto(null);
            avisar('Foto removida');
        } catch (e) {
            erroDaFoto.textContent = e.message;
        }
    });
    const secaoFoto = h('section', {class: 'secao-da-conta'},
        h('h2', null, 'Foto de perfil'),
        h('p', {class: 'subtitulo'}, 'Aparece no topo do site. A imagem é cortada em quadrado, pelo meio.'),
        h('div', {class: 'linha'}, previa,
            h('label', {class: 'botao primario', for: 'conta-foto'}, textoDoEscolher, arquivoDaFoto),
            removerFoto),
        erroDaFoto);

    const nick = h('input', {type: 'text', id: 'conta-nick', value: conta.nick, maxlength: '40', required: true});
    const secaoNick = secaoDaConta('Nick', 'Como você aparece no site.', [h('div', {class: 'campo'}, h('label', {for: 'conta-nick'}, 'Nick'), nick)],
        'Salvar nick', async () => {
            atualizar(await chamar('PUT', '/api/conta', {nick: nick.value}));
            avisar('Nick salvo');
        });

    const email = h('input', {type: 'email', id: 'conta-email', value: conta.email, required: true, autocomplete: 'email'});
    const senhaDoEmail = campoDeSenha('conta-senha-email', 'current-password', 'Senha atual');
    const secaoEmail = secaoDaConta('E-mail', 'É com ele que você entra. Cada e-mail só pode ter uma conta.',
        [h('div', {class: 'campo'}, h('label', {for: 'conta-email'}, 'E-mail'), email), senhaDoEmail.elemento], 'Salvar e-mail', async () => {
            atualizar(await chamar('PUT', '/api/conta', {email: email.value, senhaAtual: senhaDoEmail.entrada.value}));
            lembrar('email', email.value.trim());
            senhaDoEmail.entrada.value = '';
            avisar('E-mail salvo');
        });

    const senhaAtual = campoDeSenha('conta-senha-atual', 'current-password', 'Senha atual');
    const senhaNova = campoDeSenha('conta-senha-nova', 'new-password', 'Senha nova', 'Pelo menos 6 caracteres.');
    const senhaRepetida = campoDeSenha('conta-senha-repetida', 'new-password', 'Repita a senha nova');
    const secaoSenha = secaoDaConta('Senha', 'Trocar a senha desconecta a conta dos outros aparelhos.',
        [senhaAtual.elemento, senhaNova.elemento, senhaRepetida.elemento], 'Trocar senha', async mostrarErro => {
            if (senhaNova.entrada.value !== senhaRepetida.entrada.value) {
                mostrarErro('As duas senhas novas não são iguais');
                return;
            }
            atualizar(await chamar('PUT', '/api/conta', {senhaAtual: senhaAtual.entrada.value, senhaNova: senhaNova.entrada.value}));
            for (const campo of [senhaAtual, senhaNova, senhaRepetida]) campo.entrada.value = '';
            avisar('Senha trocada');
        });

    // so para admins: os mangas cadastrados antes de o site ter contas
    const quantosAntigos = conta.mangasAntigos === 1 ? '1 mangá cadastrado' : conta.mangasAntigos + ' mangás cadastrados';
    const secaoAntigos = conta.admin && conta.mangasAntigos > 0 ? secaoDaConta('Mangás de antes das contas',
        `Há ${quantosAntigos} antes de o site ter contas. Como administrador, você pode trazê-los para esta conta, com as capas.`,
        [], 'Trazer para esta conta', async () => {
            const certeza = await confirmar('Trazer os mangás antigos?', `${quantosAntigos[0].toUpperCase() + quantosAntigos.slice(1)} passarão para a conta ${conta.email}.`, 'Trazer', false);
            if (!certeza) return;
            const resposta = await chamar('POST', '/api/conta/mangas-antigos', {});
            avisar(resposta.trazidos === 1 ? '1 mangá trazido para a sua conta' : resposta.trazidos + ' mangás trazidos para a sua conta');
            atualizar(await chamar('GET', '/api/sessao'));
            telaConta();
        }) : null;

    const senhaParaExcluir = campoDeSenha('conta-senha-excluir', 'current-password', 'Senha atual');
    const secaoExcluir = secaoDaConta('Excluir conta',
        'Apaga a conta, todos os mangás dela e as capas enviadas. Não tem volta.', [senhaParaExcluir.elemento], 'Excluir minha conta', async () => {
            const quantos = conta.mangas === 1 ? '1 mangá' : conta.mangas + ' mangás';
            const certeza = await confirmar('Excluir a conta?',
                `A conta ${conta.email} e ${quantos} serão apagados para sempre. Você tem certeza?`, 'Sim, excluir tudo');
            if (!certeza) return;
            await chamar('DELETE', '/api/conta', {senha: senhaParaExcluir.entrada.value});
            esquecerDadosDaConta();
            estado.sessao = {...estado.sessao, logado: false, conta: null};
            lembrar('email', '');
            history.replaceState(null, '', '#/');
            telaLogin('Sua conta foi excluída.');
        }, true);

    const cabecalho = h('div', {class: 'cabecalho-da-conta'},
            avatar(conta, true),
            h('div', null,
                h('h1', null, 'Configurações', conta.admin ? h('span', {class: 'selo-admin'}, 'Admin') : null),
                h('p', {class: 'nick-nas-configuracoes'}, conta.nick),
                h('p', {class: 'subtitulo'}, conta.email, ' · ', conta.mangas === 1 ? '1 mangá' : conta.mangas + ' mangás', ' · conta criada em ',
                    new Date(conta.criadaEm).toLocaleDateString('pt-BR'))));
    const secaoPerfil = comPerfil ? h('section', {class: 'secao-da-conta'},
        h('h2', null, 'Perfil'),
        h('p', {class: 'subtitulo'}, 'Foto, nick e descrição são editados no seu perfil, do jeito que os outros o veem.'),
        h('div', null, h('a', {class: 'botao primario', href: '#/comunidade/perfil/' + conta.id}, 'Ir para o meu perfil'))) : null;
    app.replaceChildren(h('div', {class: 'pagina-da-conta'},
        comPerfil ? h('a', {class: 'voltar', href: '#/comunidade/perfil/' + conta.id}, '← Meu perfil') : h('a', {class: 'voltar', href: '#/'}, '← Todos os mangás'),
        cabecalho,
        secaoAntigos,
        secaoPerfil,
        comPerfil ? null : secaoFoto,
        comPerfil ? null : secaoNick,
        secaoEmail,
        secaoSenha,
        secaoExcluir));
}

async function iniciar() {
    // na pagina principal, a lista ja comeca a vir junto com o inicio, em vez de esperar por ele
    const naGrade = /^#?\/?(\?.*)?$/.test(location.hash);
    let inicio;
    try {
        const [resposta] = await Promise.all([
            chamar('GET', '/api/inicio'),
            naGrade ? adiantarLista() : null,
        ]);
        inicio = resposta;
    } catch (e) {
        app.replaceChildren(vazio('Não foi possível carregar', e.message));
        return;
    }
    estado.sessao = inicio.sessao;
    estado.inicio = inicio;
    // so a versao do Vercel tem a Comunidade (e, com ela, o perfil): a Java nao manda este campo
    estado.temComunidade = inicio.comunidade === true;
    document.getElementById('sair').addEventListener('click', sair);
    document.getElementById('secao-biblioteca').addEventListener('click', evento => {
        if (location.hash === '#/' || location.hash === '') {
            evento.preventDefault();
            recarregarAba();
        }
    });
    // o relatorio de um banner, aberto pela empresa pelo link privado: nao precisa de login (com login, o site abre
    // normalmente e a rota mostra o relatorio)
    if (!estado.sessao.logado && /^#\/relatorio-de-banner\/[^/]+\/[^/?]+/.test(location.hash)) {
        window.addEventListener('hashchange', rota);
        rota();
        return;
    }
    if (!estado.sessao.logado) {
        telaLogin();
        return;
    }
    mostrarConta(estado.sessao.conta);
    await abrirSite();
}

/**
 * Pede a lista da pagina principal antes de saber se o login vale, para ganhar tempo. Usa o fetch direto (e nao
 * chamar) porque, sem login, a resposta e so descartada: quem mostra a tela de entrada e o /api/inicio.
 */
async function adiantarLista() {
    const ordem = estado.ordem || 'CADASTRO';
    try {
        const resposta = await fetch(enderecoDaLista(ordem));
        if (!resposta.ok) return;
        const entrada = {ordem};
        guardarLista(entrada, await resposta.json());
        estado.listaCompleta = entrada;
    } catch (e) {
        // sem problema: a grade pede de novo
    }
}

/** Carrega o que o site inteiro usa e mostra a tela do endereco atual. */
async function abrirSite() {
    try {
        // vem junto do /api/inicio; depois de entrar pela tela de login, pede de novo
        const inicio = estado.inicio || await chamar('GET', '/api/inicio');
        estado.inicio = null;
        estado.temComunidade = inicio.comunidade === true;
        // depois de entrar pela tela de login, o link do topo (perfil ou configuracoes) so agora sabe para onde ir
        if (estado.sessao?.conta) mostrarConta(estado.sessao.conta);
        [estado.status, estado.formatos, estado.dias, estado.ordens, estado.ordensDeDescoberta] =
            [inicio.status, inicio.formatos, inicio.dias, inicio.ordensDaLista || [], inicio.ordensDeRecomendacao || []];
        if (!estado.ordens.some(ordem => ordem.valor === estado.ordem)) estado.ordem = 'CADASTRO';
    } catch (e) {
        if (!document.body.classList.contains('entrando')) app.replaceChildren(vazio('Não foi possível carregar', e.message));
        return;
    }
    if (!estado.siteAberto) {
        estado.siteAberto = true;
        window.addEventListener('hashchange', () => {
            // enquanto a tela de login esta aberta, o endereco pode mudar sem abrir nada
            if (document.body.classList.contains('entrando')) return;
            window.scrollTo(0, 0);
            rota();
        });
        // a extensao se apresenta um instante depois de a pagina carregar
        for (const atraso of [300, 1500]) {
            setTimeout(() => { if (!estado.extensao) conferirExtensao(); }, atraso);
        }
    }
    rota();
}

/**
 * Clicar fora de uma janela flutuante (no fundo escurecido) e o mesmo que fechar: faz o que o Esc faria. Janelas que
 * tratam o Esc de outro jeito (a lista publicada, com um manga aberto, volta para a lista) fazem o mesmo aqui. O clique
 * precisa comecar e terminar fora, para selecionar um texto e soltar fora nao fechar nada.
 */
function foraDaJanela(janela, evento) {
    const caixa = janela.getBoundingClientRect();
    return evento.clientX < caixa.left || evento.clientX > caixa.right || evento.clientY < caixa.top || evento.clientY > caixa.bottom;
}
let janelaClicadaFora = null;
document.addEventListener('pointerdown', evento => {
    janelaClicadaFora = evento.target instanceof HTMLDialogElement && evento.target.open && foraDaJanela(evento.target, evento) ? evento.target : null;
});
document.addEventListener('click', evento => {
    const janela = janelaClicadaFora;
    janelaClicadaFora = null;
    if (!janela || evento.target !== janela || !janela.open || !foraDaJanela(janela, evento)) return;
    if (janela.dispatchEvent(new Event('cancel', {cancelable: true}))) janela.close();
});

// voltar de um post devolve a rolagem do feed pelo proprio site
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
iniciar();
