'use strict';

const app = document.getElementById('app');
const avisos = document.getElementById('avisos');
const SEPARADORES = {HIFEN: '-', PONTO: '.', UNDERLINE: '_'};

const estado = {
    status: [],        // [{valor, descricao}] vindo de /api/status
    formatos: [],      // [{valor, descricao}] vindo de /api/formatos-decimais
    dias: [],          // [{valor, descricao}] vindo de /api/dias-da-semana
    recarregar: null,  // recarrega so os cartoes da tela atual, sem pular para o topo
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
    }, h('span', null, 'Ler ' + mostrarCapitulo(manga.nextChapter)));
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
        aba('hoje', '#/hoje', 'Lançam hoje'));
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

async function telaDetalhes(id) {
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
    const erro = h('div', {class: 'erro', role: 'alert', hidden: true});
    const salvar = h('button', {type: 'submit', class: 'botao primario'}, 'Salvar');

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
            erro,
            h('div', {class: 'acoes-form'},
                h('button', {type: 'button', class: 'botao', onclick: () => dialogo.close()}, 'Cancelar'),
                salvar)));

    dialogo.querySelector('form').addEventListener('submit', async evento => {
        evento.preventDefault();
        const numero = lerCapitulo(capitulo.value);
        if (numero == null) {
            erro.textContent = 'Digite um capítulo válido, como 48 ou 48,5';
            erro.hidden = false;
            return;
        }
        salvar.disabled = true;
        try {
            await chamar('PATCH', '/api/mangas/' + manga.id + '/progresso', {lastChapter: numero, readingStatus: status.value});
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

async function telaFormulario(id) {
    const vez = ++estado.render;
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

    const titulo = h('input', {type: 'text', required: true, maxlength: '200', value: manga ? manga.title : ''});
    const link = h('input', {
        type: 'url',
        required: true,
        placeholder: 'https://site.com/manga/solo-leveling/capitulo-{cap}',
        value: manga ? manga.chapterLinkModel : '',
    });
    const formato = seletor(estado.formatos.map(f => ({valor: f.valor, descricao: f.descricao.replace('X', '48')})),
        manga ? manga.decimalFormat : 'HIFEN');
    const capitulo = h('input', {type: 'text', inputmode: 'decimal', required: true, autocomplete: 'off', value: manga ? mostrarCapitulo(manga.lastChapter) : '0'});
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
            h('label', {class: 'campo'}, h('span', null, 'Descrição'), descricao),
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
            avisar(manga ? 'Alterações salvas' : 'Mangá cadastrado');
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
        formulario));
    mostrarPrevia();
    mostrarExemplo();
    if (!manga) titulo.focus();
}

// ------------------------------------------------------------------ rotas

function rota() {
    const partes = location.hash.replace(/^#\/?/, '').split('/');
    document.title = 'Meus Mangás';
    for (const dialogo of document.querySelectorAll('dialog')) dialogo.close();
    estado.recarregar = null;

    if (partes[0] === 'manga' && partes[1]) return telaDetalhes(partes[1]);
    estado.sorteado = null;
    if (partes[0] === 'hoje') return telaHoje();
    if (partes[0] === 'novo') return telaFormulario(null);
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
}

iniciar();
