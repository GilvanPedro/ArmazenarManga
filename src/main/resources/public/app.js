'use strict';

const app = document.getElementById('app');
const avisos = document.getElementById('avisos');
const SEPARADORES = {HIFEN: '-', PONTO: '.', UNDERLINE: '_'};

const estado = {
    status: [],        // [{valor, descricao}] vindo de /api/status
    formatos: [],      // [{valor, descricao}] vindo de /api/formatos-decimais
    dias: [],          // [{valor, descricao}] vindo de /api/dias-da-semana
    recarregar: null,  // recarrega so os cartoes da tela atual, sem pular para o topo
    extensao: false,   // a extensao de navegador esta instalada e liberada para este site
    busca: '',
    filtroStatus: '',
    sorteado: null,    // id do manga que acabou de sair no sorteio
    render: 0,         // descarta respostas de telas que ja foram trocadas
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

/**
 * Nome do manga a partir do titulo da pagina do capitulo.
 * "The Novel's Extra Chapter 174 - Read Online | Asura Scans" -> "The Novel's Extra".
 * Sem titulo aproveitavel, usa o endereco: ".../0vx0d-doomsday-wedding/..." -> "Doomsday Wedding".
 */
function tituloDoManga(tituloDaPagina, endereco) {
    let titulo = String(tituloDaPagina || '').replace(/\s+/g, ' ').trim();
    // corta de "Chapter 7", "Capítulo 7", "Cap. 7", "Ch 7", "Ep 7" em diante
    titulo = titulo.replace(/[\s\-–—|:,(\[]*(?:^|[^\p{L}])(chapter|chap|ch|cap[ií]tulo|cap|episode|epis[oó]dio|ep)\.?\s*#?\d.*$/iu, '');
    titulo = titulo.replace(/^(read|ler|leia)\s+/i, '').replace(/\s*\|[^|]*$/, '').replace(/[\s\-–—|:,]+$/, '').trim();
    if (titulo.length >= 2) return titulo;
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

function capa(manga, comoLink) {
    const atributos = {class: 'capa'};
    if (comoLink) {
        atributos.href = '#/manga/' + manga.id;
        atributos['aria-label'] = manga.title;
    }
    const img = h('img', {src: manga.imageUrl, alt: comoLink ? '' : 'Capa de ' + manga.title, loading: 'lazy'});
    img.addEventListener('error', () => {
        img.replaceWith(h('div', {class: 'capa-vazia', 'aria-hidden': 'true'}, (manga.title || '?').trim().charAt(0).toUpperCase()));
    });
    return h(comoLink ? 'a' : 'div', atributos, img, comoLink ? etiquetaStatus(manga.readingStatus) : null);
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
        const sites = new Set();
        for (const manga of await chamar('GET', '/api/mangas')) {
            for (const endereco of [manga.lastChapterLink, manga.nextChapterLink]) {
                try {
                    sites.add(new URL(endereco).host);
                } catch (e) {
                    // link fora do padrao: so nao entra na lista
                }
            }
        }
        await pedirExtensao('sites', {sites: [...sites]}, 5000);
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
    }, texto);
    return h('nav', {class: 'abas', 'aria-label': 'Listas'},
        aba('todos', '#/', 'Todos os mangás'),
        aba('hoje', '#/hoje', 'Lançam hoje'),
        aba('atalho', '#/atalho', 'Extensão e atalho'));
}

/** Aba dos mangas que estou lendo e que lancam capitulo no dia de hoje. */
function telaHoje() {
    const lista = h('div', {class: 'grade'});
    const hoje = diaDeHoje();
    document.title = 'Lançam hoje · Meus Mangás';
    app.replaceChildren(
        abas('hoje'),
        h('p', {class: 'subtitulo'}, descricaoDia(hoje), ' · mangás que você está lendo e que lançam capítulo hoje'),
        lista);
    estado.recarregar = () => carregarHoje(lista, hoje);
    carregarHoje(lista, hoje);
}

async function carregarHoje(lista, hoje) {
    const vez = ++estado.render;
    let mangas;
    try {
        mangas = await chamar('GET', '/api/mangas/lancamentos?dia=' + hoje);
    } catch (e) {
        if (vez === estado.render) lista.replaceChildren(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    if (mangas.length === 0) {
        lista.className = '';
        lista.replaceChildren(vazio('Nenhum lançamento hoje',
            'Para um mangá aparecer aqui, deixe-o com o status Lendo e escolha o dia de lançamento na edição geral.'));
        return;
    }
    lista.className = 'grade';
    lista.replaceChildren(...mangas.map(cartao));
}

function telaGrade() {
    const lista = h('div', {class: 'grade'});
    const busca = h('input', {
        type: 'search',
        placeholder: 'Buscar pelo nome…',
        'aria-label': 'Buscar pelo nome',
        value: estado.busca,
    });
    let espera;
    busca.addEventListener('input', () => {
        estado.busca = busca.value;
        clearTimeout(espera);
        espera = setTimeout(() => carregarGrade(lista), 180);
    });

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
                carregarGrade(lista);
            },
        }, opcao.descricao));
    }

    estado.recarregar = () => carregarGrade(lista);
    app.replaceChildren(
        abas('todos'),
        h('div', {class: 'ferramentas'},
            busca,
            h('span', {class: 'espaco'}),
            h('button', {type: 'button', class: 'botao', onclick: sortear}, '🎲 Sortear')),
        filtros,
        lista);
    carregarGrade(lista);
}

async function carregarGrade(lista) {
    const vez = ++estado.render;
    const parametros = new URLSearchParams();
    if (estado.busca.trim()) parametros.set('titulo', estado.busca.trim());
    if (estado.filtroStatus) parametros.set('status', estado.filtroStatus);

    let mangas;
    try {
        mangas = await chamar('GET', '/api/mangas?' + parametros);
    } catch (e) {
        if (vez === estado.render) lista.replaceWith(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;

    if (mangas.length === 0) {
        const filtrando = parametros.toString() !== '';
        lista.className = '';
        lista.replaceChildren(filtrando
            ? vazio('Nada encontrado', 'Nenhum mangá combina com a busca ou o filtro.')
            : vazio('Sua lista está vazia', 'Adicione o primeiro mangá que você está lendo.',
                h('a', {class: 'botao primario', href: '#/novo'}, '+ Adicionar mangá')));
        return;
    }
    lista.className = 'grade';
    lista.replaceChildren(...mangas.map(cartao));
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
    document.title = manga.title + ' · Meus Mangás';

    app.replaceChildren(h('div', null,
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
                manga.tags.length ? h('div', {class: 'linha'}, manga.tags.map(tag => h('span', {class: 'tag'}, tag))) : null,
                h('div', {class: 'linha'},
                    botaoLer(manga),
                    h('button', {type: 'button', class: 'botao', onclick: () => abrirDialogoProgresso(manga)}, 'Alterar capítulo')),
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
                    h('button', {type: 'button', class: 'botao perigo', onclick: () => excluir(manga)}, 'Excluir'))))));
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

/** Busca na internet a descricao pelo titulo e coloca no campo, avisando de onde veio. */
async function preencherDescricao(titulo, descricao, aviso, substituir) {
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
    const capituloLido = paginaLida ? capituloDoLink(paginaLida) : null;
    const pronto = paginaLida && {
        titulo: tituloDoManga(capturado.get('t'), paginaLida),
        link: modeloDoLink(paginaLida, capituloLido),
        capitulo: capituloLido == null ? '' : mostrarCapitulo(capituloLido),
        imagem: ehLinkHttp(capturado.get('i') || '') ? capturado.get('i').trim() : '',
        proximo: ehLinkHttp(capturado.get('p') || '') ? capturado.get('p').trim() : null,
    };
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
    const status = seletor(estado.status, manga ? manga.readingStatus : 'LENDO');
    const dia = seletor([{valor: '', descricao: 'Sem dia definido'}, ...estado.dias], manga && manga.releaseDay ? manga.releaseDay : '');
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
    const tags = h('input', {type: 'text', placeholder: 'Ação, Fantasia', value: manga ? manga.tags.join(', ') : ''});
    const descricao = h('textarea', {maxlength: '5000'}, manga ? manga.description : '');
    const avisoDescricao = h('small', {'aria-live': 'polite'});
    const buscarDescricao = h('button', {
        type: 'button',
        class: 'botao pequeno',
        onclick: () => {
            if (descricao.value.trim() && !confirm('Substituir a descrição atual pela encontrada na internet?')) return;
            preencherDescricao(titulo.value, descricao, avisoDescricao, true);
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
            h('label', {class: 'campo'}, h('span', null, 'Tags'), tags, h('small', null, 'Separadas por vírgula.')),
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
                    envio.append('arquivo', arquivo.files[0]);
                    enviado = {arquivo: arquivo.files[0], imagePath: (await chamar('POST', '/api/imagens', envio)).imagePath};
                }
                imagePath = enviado.imagePath;
            } else if (urlImagem.value.trim()) {
                imagePath = urlImagem.value.trim();
            }
            const dados = {
                title: titulo.value,
                imagePath,
                tags: tags.value.split(','),
                chapterLinkModel: link.value,
                decimalFormat: formato.value,
                lastChapter: numero,
                readingStatus: status.value,
                releaseDay: dia.value || null,
                description: descricao.value,
            };
            const salvo = manga
                ? await chamar('PUT', '/api/mangas/' + manga.id, dados)
                : await chamar('POST', '/api/mangas', dados);
            if (pronto) {
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

    document.title = (manga ? 'Editar ' + manga.title : 'Novo mangá') + ' · Meus Mangás';
    app.replaceChildren(h('div', {class: 'formulario'},
        h('a', {class: 'voltar', href: voltarPara}, '← Voltar'),
        h('h1', null, manga ? 'Edição geral' : 'Novo mangá'),
        pronto
            ? h('div', {class: 'sorteado', role: 'status'},
                h('span', null, 'Este mangá não estava na sua lista. Preenchi o que deu para descobrir pela página; confira antes de cadastrar.'),
                h('a', {class: 'botao pequeno', href: '#/capturar?' + capturado + '&escolher=1'}, 'Ele já está na lista'))
            : null,
        formulario));
    mostrarPrevia();
    mostrarExemplo();
    descricao.id = 'campo-descricao';
    if (pronto) {
        urlImagem.value = pronto.imagem;
        mostrarPrevia();
        preencherDescricao(titulo.value, descricao, avisoDescricao, false);
    }
    if (!manga) titulo.focus();
}

// ------------------------------------------------------------------ captura do capitulo pelo navegador

/**
 * Codigo do favorito ("bookmarklet"). Roda na pagina do capitulo, no site de leitura, dentro do navegador
 * de quem esta lendo: pega o endereco da pagina e o link de "proximo capitulo" e abre este site para confirmar.
 * E assim que sites que bloqueiam o servidor (protecao contra robos) continuam funcionando.
 */
function codigoDoAtalho() {
    // sem "#" e sem acentos no codigo: dentro de um endereco javascript: eles podem ser alterados pelo navegador
    const codigo = function (origem) {
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
        var titulo = (meta('og:title') || document.title || '').slice(0, 200);
        window.open(origem + '/' + cerquilha + '/capturar?u=' + encodeURIComponent(atual) + '&p=' + encodeURIComponent(proximo)
            + '&t=' + encodeURIComponent(titulo) + '&i=' + encodeURIComponent(imagem));
    };
    return 'javascript:(' + codigo.toString().replace(/\s+/g, ' ') + ')(' + JSON.stringify(location.origin) + ');';
}

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
    document.title = 'Extensão e atalho · Meus Mangás';
    app.replaceChildren(
        abas('atalho'),
        h('div', {class: 'texto'},
            h('h1', null, 'Extensão: próximo capítulo automático'),
            h('p', null, 'Alguns sites de leitura mudam o link a cada capítulo e só entregam as páginas a um navegador de verdade, então o servidor não consegue descobrir o link do próximo capítulo. '
                + 'Com a extensão, o botão “Ler” faz isso no seu navegador: abre o último capítulo lido, acha o botão de próximo, vai direto para ele e salva o link certo.'),
            situacaoDaExtensao(),
            h('p', null, h('b', null, 'Chrome, Edge ou Brave')),
            h('ol', null,
                h('li', null, 'Abra ', h('code', null, 'chrome://extensions'), ' e ligue o “Modo do desenvolvedor”.'),
                h('li', null, 'Clique em “Carregar sem compactação” e escolha a pasta ', h('code', null, 'extensao'), ' do projeto.'),
                h('li', null, 'Volte para este site, recarregue a página, clique no ícone da extensão e em “Permitir que este site use a extensão”.')),
            h('p', null, h('b', null, 'Firefox')),
            h('ol', null,
                h('li', null, 'Abra ', h('code', null, 'about:debugging#/runtime/this-firefox'), ' e clique em “Carregar extensão temporária”.'),
                h('li', null, 'Escolha o arquivo ', h('code', null, 'manifest.json'), ' dentro da pasta ', h('code', null, 'extensao'), '.'),
                h('li', null, 'Libere este site pelo ícone da extensão, como no Chrome. No Firefox a extensão carregada assim sai ao fechar o navegador.')),
            h('h1', {class: 'segundo'}, 'Marcar o capítulo como lido direto do site de leitura'),
            h('p', null, 'Com a extensão instalada não precisa de favorito. Há três jeitos, todos abrem este site com o mangá e o capítulo já preenchidos para você confirmar:'),
            h('ul', null,
                h('li', null, h('b', null, 'Botão “✓ Lido”'), ': aparece sozinho no canto de baixo das páginas dos sites onde você tem mangá cadastrado.'),
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
            h('textarea', {class: 'codigo', readonly: true, rows: '4', 'aria-label': 'Código do atalho'}, codigo)));
}

/** Entre os mangas do mesmo site, o que tem o endereco mais parecido com o da pagina capturada. */
function mangaDoLink(mangas, endereco) {
    const pagina = new URL(endereco);
    let melhor = null;
    let melhorIguais = 0;
    for (const manga of mangas) {
        for (const conhecido of [manga.lastChapterLink, manga.nextChapterLink, manga.chapterLinkModel]) {
            let url;
            try {
                url = new URL(conhecido.replace('{cap}', '0'));
            } catch (e) {
                continue;
            }
            if (url.host !== pagina.host) continue;
            let iguais = 0;
            while (iguais < url.pathname.length && url.pathname[iguais] === pagina.pathname[iguais]) iguais++;
            if (iguais > melhorIguais) {
                melhorIguais = iguais;
                melhor = manga;
            }
        }
    }
    // so vale se for alem da primeira pasta do endereco ("/title/", "/manga/"...), que e igual para o site todo
    return melhorIguais > pagina.pathname.indexOf('/', 1) + 1 ? melhor : null;
}

/** Tela aberta pelo atalho: confirma o que foi capturado antes de salvar. Nada e gravado sem o clique em Salvar. */
async function telaCapturar(consulta) {
    const vez = ++estado.render;
    const parametros = new URLSearchParams(consulta);
    const endereco = (parametros.get('u') || '').trim();
    const proximo = (parametros.get('p') || '').trim();
    document.title = 'Marcar capítulo lido · Meus Mangás';
    if (!ehLinkHttp(endereco)) {
        app.replaceChildren(vazio('Nada para marcar', 'Use o atalho estando na página de um capítulo.',
            h('a', {class: 'botao', href: '#/atalho'}, 'Ver como funciona')));
        return;
    }
    let mangas;
    try {
        mangas = await chamar('GET', '/api/mangas');
    } catch (e) {
        if (vez === estado.render) app.replaceChildren(vazio('Algo deu errado', e.message));
        return;
    }
    if (vez !== estado.render) return;
    const achado = mangaDoLink(mangas, endereco);
    // manga que ainda nao esta na lista: abre o cadastro ja preenchido (a nao ser que tenham pedido para escolher)
    const paraOCadastro = new URLSearchParams(parametros);
    paraOCadastro.delete('escolher');
    if (!achado && (!parametros.has('escolher') || mangas.length === 0)) {
        location.replace('#/novo?' + paraOCadastro);
        return;
    }

    const manga = seletor([{valor: '', descricao: 'Escolha o mangá…'}, ...mangas.map(m => ({valor: m.id, descricao: m.title}))],
        achado ? achado.id : '');
    const numero = capituloDoLink(endereco);
    const capitulo = h('input', {type: 'text', inputmode: 'decimal', autocomplete: 'off', value: numero == null ? '' : mostrarCapitulo(numero)});
    // so sugere guardar o "proximo" se ele parece mesmo ser um capitulo adiante
    const numeroDoProximo = ehLinkHttp(proximo) ? capituloDoLink(proximo) : null;
    const guardarProximo = h('input', {type: 'checkbox', checked: numero != null && numeroDoProximo != null && numeroDoProximo > numero});
    const erro = h('div', {class: 'erro', role: 'alert', hidden: true});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');

    const formulario = h('form', {class: 'campos', novalidate: true},
        h('label', {class: 'campo'}, h('span', null, 'Mangá'), manga,
            achado ? null : h('small', null, 'Não reconheci esse endereço em nenhum mangá da sua lista. Escolha qual é, ou ',
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
        if (!manga.value) return falhar('Escolha o mangá');
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

function rota() {
    const [caminho, consulta] = location.hash.replace(/^#\/?/, '').split('?');
    const partes = caminho.split('/');
    document.title = 'Meus Mangás';
    for (const dialogo of document.querySelectorAll('dialog')) dialogo.close();
    estado.recarregar = null;

    if (partes[0] === 'manga' && partes[1]) return telaDetalhes(partes[1], partes[2]);
    estado.sorteado = null;
    if (partes[0] === 'hoje') return telaHoje();
    if (partes[0] === 'atalho') return telaAtalho();
    if (partes[0] === 'capturar') return telaCapturar(consulta || '');
    if (partes[0] === 'novo') return telaFormulario(null, consulta);
    if (partes[0] === 'editar' && partes[1]) return telaFormulario(partes[1]);
    return telaGrade();
}

async function iniciar() {
    try {
        [estado.status, estado.formatos, estado.dias] = await Promise.all([
            chamar('GET', '/api/status'),
            chamar('GET', '/api/formatos-decimais'),
            chamar('GET', '/api/dias-da-semana'),
        ]);
    } catch (e) {
        app.replaceChildren(vazio('Não foi possível carregar', e.message));
        return;
    }
    window.addEventListener('hashchange', () => {
        window.scrollTo(0, 0);
        rota();
    });
    rota();
    // a extensao se apresenta um instante depois de a pagina carregar
    for (const atraso of [300, 1500]) {
        setTimeout(() => { if (!estado.extensao) conferirExtensao(); }, atraso);
    }
}

iniciar();
