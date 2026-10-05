// Parte da extensao que fica em segundo plano.
// O site Meus Mangas nao consegue ler paginas de outros sites, e o servidor dele e barrado por protecoes contra
// robos. O navegador de quem esta lendo consegue. Entao, quando o site pede, a extensao abre a pagina do ultimo
// capitulo lido em uma aba, acha nela o link do proximo capitulo, leva a aba ate ele e conta ao site qual era.
const ext = globalThis.browser || globalThis.chrome;

const TEMPO_LIMITE_MS = 30000;
const espera = ms => new Promise(pronto => setTimeout(pronto, ms));
const ehHttp = endereco => {
    try {
        return ['http:', 'https:'].includes(new URL(endereco).protocol);
    } catch (erro) {
        return false;
    }
};

async function origensPermitidas() {
    const guardado = await ext.storage.local.get({ origens: [] });
    return guardado.origens;
}

/**
 * Roda dentro da pagina do capitulo. Procura o link para o capitulo de numero informado.
 * (Funcao enviada para a aba: nao pode usar nada de fora dela.)
 */
function procurarProximo(numero) {
    const atual = location.href.split('#')[0];
    const desafio = /just a moment|checking your browser|attention required|um momento/i.test(document.title);
    const dica = /(^|[^a-z])(next|pr[oó]xim[oa]|siguiente|seguinte|suivant|avan[cç]ar)([^a-z]|$)/i;
    const doCapitulo = new RegExp('(^|[^0-9])' + numero + '($|[^0-9a-z])', 'i');
    const pastas = caminho => caminho.split('/').filter(Boolean).length;
    const mesmaObra = url => {
        const a = location.pathname, b = url.pathname;
        let iguais = 0;
        while (iguais < a.length && iguais < b.length && a[iguais] === b[iguais]) iguais++;
        return iguais > 1 && iguais * 2 >= a.length;
    };
    let melhor = null;
    let melhorNota = 0;
    for (const elemento of document.querySelectorAll('link[href], a[href]')) {
        let url;
        try {
            url = new URL(elemento.href);
        } catch (erro) {
            continue;
        }
        if (!/^https?:$/.test(url.protocol) || url.host !== location.host || url.href.split('#')[0] === atual) continue;
        const rel = (' ' + (elemento.getAttribute('rel') || '') + ' ').toLowerCase().includes(' next ');
        const ehLink = elemento.tagName === 'A';
        const visivel = [elemento.textContent, elemento.title, elemento.getAttribute('aria-label')].join(' ');
        const nomes = ((typeof elemento.className === 'string' ? elemento.className : '') + ' ' + elemento.id).replace(/[-_]/g, ' ');
        const temONumero = doCapitulo.test(url.pathname + url.search);
        const obra = mesmaObra(url);
        const temDica = ehLink && dica.test(visivel + ' ' + nomes);
        // sem o numero no endereco, so vale um link que diga "proximo" e que seja de outro capitulo, nao da pagina da obra
        const dizProximo = ehLink && dica.test(visivel) && pastas(url.pathname) >= pastas(location.pathname);
        let nota = 0;
        if (rel && temONumero) nota = 95;
        else if (temONumero && temDica && obra) nota = 90;
        else if (temONumero && obra) nota = 80;
        else if (temONumero && temDica) nota = 70;
        else if (rel) nota = 60;
        else if (dizProximo && obra) nota = 40;
        if (nota > melhorNota) {
            melhorNota = nota;
            melhor = url.href.split('#')[0];
        }
    }
    return { atual, pronto: document.readyState === 'complete', desafio, proximo: melhor };
}

/** Abre o ultimo capitulo lido, espera a pagina (e a protecao do site) carregar e segue para o proximo. */
async function irParaOProximo(dados, abaDoSite) {
    const numero = Number(dados.proximoCapitulo);
    if (!ehHttp(dados.ultimoUrl) || !Number.isInteger(numero) || numero < 0) {
        return { ok: false, motivo: 'erro' };
    }
    const aba = await ext.tabs.create({ url: dados.ultimoUrl, index: abaDoSite.index + 1, openerTabId: abaDoSite.id });
    const inicio = Date.now();
    let vezesSemLink = 0;
    let ultimaPagina = null;
    while (Date.now() - inicio < TEMPO_LIMITE_MS) {
        await espera(1000);
        try {
            await ext.tabs.get(aba.id);
        } catch (erro) {
            return { ok: false, motivo: 'aba-fechada' };
        }
        let achado;
        try {
            const [injetado] = await ext.scripting.executeScript({ target: { tabId: aba.id }, func: procurarProximo, args: [numero] });
            achado = injetado && injetado.result;
        } catch (erro) {
            continue; // a pagina ainda esta trocando; tenta de novo
        }
        if (!achado || achado.desafio || !achado.pronto) {
            vezesSemLink = 0;
            continue;
        }
        ultimaPagina = achado.atual;
        if (achado.proximo) {
            await ext.tabs.update(aba.id, { url: achado.proximo });
            return { ok: true, atualUrl: achado.atual, proximoUrl: achado.proximo };
        }
        // paginas montadas com JavaScript demoram a mostrar os botoes: so desiste depois de olhar algumas vezes
        if (++vezesSemLink >= 5) {
            return { ok: false, motivo: 'sem-proximo', atualUrl: ultimaPagina };
        }
    }
    return { ok: false, motivo: 'tempo', atualUrl: ultimaPagina };
}

async function atender(mensagem, remetente) {
    const tipo = mensagem && mensagem.tipo;
    const dados = (mensagem && mensagem.dados) || {};

    // pedidos do popup da propria extensao: liberar ou remover um site
    // (so paginas da propria extensao chegam aqui: uma pagina de site sempre tem aba e endereco http)
    const daExtensao = remetente.id === ext.runtime.id
        && (!remetente.tab || (remetente.url || '').startsWith(ext.runtime.getURL('')));
    if (daExtensao) {
        const origens = await origensPermitidas();
        if (tipo === 'origens') return { origens };
        if (tipo === 'permitir' && ehHttp(dados.origem)) {
            await ext.storage.local.set({ origens: [...new Set([...origens, new URL(dados.origem).origin])] });
            return { ok: true };
        }
        if (tipo === 'remover') {
            await ext.storage.local.set({ origens: origens.filter(origem => origem !== dados.origem) });
            return { ok: true };
        }
        return { ok: false, motivo: 'erro' };
    }

    // pedidos vindos de uma pagina: so do site que o dono da extensao liberou
    if (!remetente.tab || !remetente.url) return { ok: false, motivo: 'erro' };
    const autorizado = (await origensPermitidas()).includes(new URL(remetente.url).origin);
    if (tipo === 'estado') return { ok: true, autorizado, versao: ext.runtime.getManifest().version };
    if (!autorizado) return { ok: false, motivo: 'nao-autorizado' };

    if (tipo === 'abrir' && ehHttp(dados.url)) {
        await ext.tabs.create({ url: dados.url, index: remetente.tab.index + 1, openerTabId: remetente.tab.id });
        return { ok: true };
    }
    if (tipo === 'proximo') return irParaOProximo(dados, remetente.tab);
    return { ok: false, motivo: 'erro' };
}

ext.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (mensagem && mensagem.tipo === 'eh-o-site') return false; // essa e respondida pela pagina, nao aqui
    atender(mensagem, remetente).then(responder, () => responder({ ok: false, motivo: 'erro' }));
    return true; // a resposta vem depois
});
