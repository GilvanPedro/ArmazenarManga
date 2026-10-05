// Verificacao do link do proximo capitulo para a API do Vercel.
// Faz o mesmo que VerificadorDeLink.java e BuscadorHttp.java; uma mudanca de regra precisa ser feita nos dois.
// (O nome comeca com "_" para o Vercel nao tratar este arquivo como uma rota.)
import dns from 'node:dns/promises';
import net from 'node:net';
import { parse } from 'node-html-parser';

export const MARCADOR = '{cap}';
const SEPARADORES = { HIFEN: '-', PONTO: '.', UNDERLINE: '_' };

// ------------------------------------------------------------------ enderecos

/** 48 -> "48", 48.5 -> "48-5" / "48.5" / "48_5". */
export function formatarCapitulo(capitulo, formato) {
    return String(capitulo).replace('.', SEPARADORES[formato] || '-');
}

export function montar(modelo, formato, capitulo) {
    return modelo.replace(MARCADOR, formatarCapitulo(capitulo, formato));
}

/** Proximo capitulo inteiro ainda nao lido: 48 -> 49, 48.5 -> 49, 0 -> 1. */
export function proximoCapitulo(ultimoLido) {
    return Math.floor(ultimoLido) + 1;
}

export function isUrlHttp(texto) {
    if (typeof texto !== 'string') return false;
    try {
        const url = new URL(texto.trim());
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
    } catch {
        return false;
    }
}

const ehDigito = letra => letra >= '0' && letra <= '9';
const ehLetraOuDigito = letra => /[\p{L}\p{N}]/u.test(letra);

/**
 * Descobre o modelo a partir do endereco real de um capitulo: troca o numero do capitulo por {cap}.
 * Ex.: (".../obra-bd5bdaf8/chapter/174", 174) -> ".../obra-bd5bdaf8/chapter/{cap}".
 * Devolve null se o endereco nao tem o numero desse capitulo (nao e a pagina dele).
 */
export function derivarModelo(endereco, capitulo, formato) {
    if (typeof endereco !== 'string') return null;
    const numero = formatarCapitulo(capitulo, formato);
    const inicioDoCaminho = endereco.indexOf('/', endereco.indexOf('://') + 3);
    if (inicioDoCaminho < 0) return null;
    // o numero do capitulo costuma ser o ultimo do endereco; ids e slugs vem antes
    for (let posicao = endereco.lastIndexOf(numero); posicao >= inicioDoCaminho; posicao = endereco.lastIndexOf(numero, posicao - 1)) {
        const fim = posicao + numero.length;
        const digitoAntes = ehDigito(endereco[posicao - 1]);
        const letraOuDigitoDepois = fim < endereco.length && ehLetraOuDigito(endereco[fim]);
        if (!digitoAntes && !letraOuDigitoDepois) {
            return endereco.slice(0, posicao) + MARCADOR + endereco.slice(fim);
        }
    }
    return null;
}

function normalizar(endereco) {
    let limpo = endereco.trim();
    const fragmento = limpo.indexOf('#');
    if (fragmento >= 0) limpo = limpo.slice(0, fragmento);
    limpo = limpo.replace(/\/+$/, '');
    const inicioDoCaminho = limpo.indexOf('/', limpo.indexOf('://') + 3);
    return inicioDoCaminho < 0
        ? limpo.toLowerCase()
        : limpo.slice(0, inicioDoCaminho).toLowerCase() + limpo.slice(inicioDoCaminho);
}

/** Compara dois enderecos ignorando barra no final, o trecho depois de # e maiusculas no dominio. */
export function mesmoEndereco(a, b) {
    return typeof a === 'string' && typeof b === 'string' && normalizar(a) === normalizar(b);
}

// ------------------------------------------------------------------ abrir paginas de outros sites

const MAXIMO_DE_BYTES = 2 * 1024 * 1024;
const MAXIMO_DE_REDIRECIONAMENTOS = 5;
const TEMPO_LIMITE_MS = 6000;
// alguns sites recusam quem nao se parece com um navegador
const NAVEGADOR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const redeInterna = new net.BlockList();
for (const [rede, prefixo] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
    ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 3]]) {
    redeInterna.addSubnet(rede, prefixo, 'ipv4');
}
for (const [rede, prefixo] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) {
    redeInterna.addSubnet(rede, prefixo, 'ipv6');
}

function enderecoPublico(ip) {
    const tipo = net.isIP(ip);
    if (tipo === 4) return !redeInterna.check(ip, 'ipv4');
    if (tipo === 6) {
        // ::ffff:127.0.0.1 e um IPv4 disfarcado
        const disfarcado = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (disfarcado) return enderecoPublico(disfarcado[1]);
        if (/^::ffff:/i.test(ip)) return false;
        return !redeInterna.check(ip, 'ipv6');
    }
    return false;
}

/**
 * Como o endereco vem do cadastro do manga, so sites publicos sao aceitos: um link apontando para a rede
 * interna do servidor (localhost, 10.x, 192.168.x, metadados da nuvem...) e recusado.
 */
export async function destinoPermitido(endereco, permitirRedeLocal = false) {
    if (!isUrlHttp(endereco)) return false;
    if (permitirRedeLocal) return true;
    const url = new URL(endereco);
    if (url.port !== '') return false; // so as portas padrao de site (80 e 443)
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host)) return enderecoPublico(host);
    try {
        const ips = await dns.lookup(host, { all: true });
        return ips.length > 0 && ips.every(ip => enderecoPublico(ip.address));
    } catch {
        return false;
    }
}

const semResposta = endereco => ({ status: 0, urlFinal: endereco, html: '' });

async function lerHtml(resposta) {
    const tipo = (resposta.headers.get('content-type') || '').toLowerCase();
    if (!tipo.includes('html') || !resposta.body) {
        await resposta.body?.cancel().catch(() => {});
        return '';
    }
    const pedacos = [];
    let total = 0;
    const leitor = resposta.body.getReader();
    while (total < MAXIMO_DE_BYTES) {
        const { done, value } = await leitor.read();
        if (done) break;
        pedacos.push(value);
        total += value.length;
    }
    await leitor.cancel().catch(() => {});
    return Buffer.concat(pedacos).subarray(0, MAXIMO_DE_BYTES).toString('utf8');
}

/**
 * Devolve a funcao que abre uma pagina: (endereco) -> { status, urlFinal, html }.
 * Nunca lanca erro: falha vira status 0. Cada redirecionamento e conferido antes de ser seguido.
 * permitirRedeLocal existe so para os testes, que usam um site falso em 127.0.0.1.
 */
export function criarBuscador({ permitirRedeLocal = false } = {}) {
    return async function buscar(endereco) {
        try {
            let destino = new URL(endereco.trim());
            for (let salto = 0; salto <= MAXIMO_DE_REDIRECIONAMENTOS; salto++) {
                if (!(await destinoPermitido(destino.href, permitirRedeLocal))) return semResposta(endereco);
                const resposta = await fetch(destino, {
                    redirect: 'manual',
                    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
                    headers: {
                        'User-Agent': NAVEGADOR,
                        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                    },
                });
                const proximo = resposta.headers.get('location');
                if ([301, 302, 303, 307, 308].includes(resposta.status) && proximo) {
                    await resposta.body?.cancel().catch(() => {});
                    destino = new URL(proximo.trim(), destino);
                    continue;
                }
                return { status: resposta.status, urlFinal: destino.href, html: await lerHtml(resposta) };
            }
            return semResposta(endereco); // redirecionamentos demais
        } catch {
            return semResposta(endereco);
        }
    };
}

// ------------------------------------------------------------------ verificacao

const abriu = pagina => pagina.status >= 200 && pagina.status < 300;
const naoExiste = pagina => pagina.status === 404 || pagina.status === 410;
const DICA_DE_PROXIMO = /(^|[^\p{L}])(next|pr[oó]xim[oa]|siguiente|seguinte|suivant|avan[cç]ar)([^\p{L}]|$)/iu;

/** Os dois caminhos comecam iguais em pelo menos metade do caminho da pagina atual (mesma obra, outro capitulo). */
function caminhoParecido(atual, outro) {
    let iguais = 0;
    while (iguais < atual.length && iguais < outro.length && atual[iguais] === outro[iguais]) iguais++;
    return iguais > 1 && iguais * 2 >= atual.length;
}

/** Quanto maior, mais certeza de que o link leva ao proximo capitulo desta obra. Zero = nao serve. */
function notaDoLink(elemento, endereco, paginaAtual, esperado, proximo, formato) {
    if (!isUrlHttp(endereco) || mesmoEndereco(endereco, paginaAtual.href)) return 0;
    const destino = new URL(endereco);
    if (destino.hostname.toLowerCase() !== paginaAtual.hostname.toLowerCase()) return 0;

    const relNext = (' ' + (elemento.getAttribute('rel') || '').toLowerCase() + ' ').includes(' next ');
    const temONumero = derivarModelo(endereco, proximo, formato) !== null;
    const ehLink = elemento.rawTagName.toLowerCase() === 'a';
    const visivel = [elemento.text, elemento.getAttribute('title'), elemento.getAttribute('aria-label')].join(' ');
    const nomes = [elemento.getAttribute('class'), elemento.getAttribute('id')].join(' ').replace(/[-_]/g, ' ');
    const dica = ehLink && DICA_DE_PROXIMO.test(visivel + ' ' + nomes);
    const dizProximo = ehLink && DICA_DE_PROXIMO.test(visivel);
    const mesmaObra = caminhoParecido(paginaAtual.pathname, destino.pathname);

    if (mesmoEndereco(endereco, esperado)) return 100; // exatamente o que o modelo previa
    if (relNext && temONumero) return 95;
    if (temONumero && dica && mesmaObra) return 90;
    if (temONumero && mesmaObra) return 80;
    if (temONumero && dica) return 70; // o id da obra pode ter mudado no meio do endereco
    if (relNext) return 60;
    // sem o numero no endereco (id proprio por capitulo): so vale um link que diga "proximo"
    if (dizProximo && mesmaObra) return 40;
    return 0;
}

/**
 * Sites montados com JavaScript nao trazem os links prontos, mas costumam trazer os enderecos dentro dos dados
 * da pagina. Procura no texto bruto um endereco da mesma pasta da pagina atual que seja do proximo capitulo.
 */
function acharNoTextoDaPagina(html, paginaAtual, proximo, formato) {
    const pasta = paginaAtual.pathname.slice(0, paginaAtual.pathname.lastIndexOf('/') + 1);
    if (pasta.length < 2) return null; // capitulos direto na raiz do site: qualquer endereco "combinaria"
    const texto = html.replaceAll('\\/', '/'); // dentro de JSON as barras vem como \/
    const escapada = pasta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const achado of texto.matchAll(new RegExp(escapada + '[^"\'\\s<>\\\\?#]+', 'g'))) {
        const endereco = paginaAtual.origin + achado[0];
        if (!mesmoEndereco(endereco, paginaAtual.href) && derivarModelo(endereco, proximo, formato) !== null) {
            return endereco;
        }
    }
    return null;
}

/** Escolhe, entre os links da pagina, o que mais parece ser o do proximo capitulo. */
function acharLinkDoProximo(atual, esperado, proximo, formato) {
    if (!atual.html.trim()) return null;
    const paginaAtual = new URL(atual.urlFinal);
    let melhor = null;
    let melhorNota = 0;
    for (const elemento of parse(atual.html).querySelectorAll('link[href], a[href]')) {
        let endereco;
        try {
            endereco = new URL(elemento.getAttribute('href'), paginaAtual).href;
        } catch {
            continue;
        }
        const nota = notaDoLink(elemento, endereco, paginaAtual, esperado, proximo, formato);
        if (nota > melhorNota) {
            melhorNota = nota;
            melhor = endereco.split('#')[0];
        }
    }
    if (melhorNota < 80) {
        const noTexto = acharNoTextoDaPagina(atual.html, paginaAtual, proximo, formato);
        if (noTexto) return noTexto;
    }
    return melhor;
}

/**
 * Confere no proprio site se o link do proximo capitulo esta certo: abre a pagina do ultimo capitulo lido,
 * procura nela o link para o proximo e confirma que ele abre. Nao depende do formato de nenhum site.
 *
 * Cobre os dois jeitos de um site "trocar o id" do link:
 * - o id da obra muda: o modelo do link e corrigido e continua valendo para os proximos capitulos;
 * - cada capitulo tem um id proprio: nao existe modelo que sirva, entao o endereco exato do proximo e guardado.
 *
 * Devolve { situacao, chapterLinkModel, nextChapterUrl }, com situacao DISPONIVEL, NAO_ENCONTRADO,
 * LINK_QUEBRADO ou NAO_VERIFICADO.
 */
export function criarVerificador(buscar) {
    return async function verificar(manga) {
        const formato = manga.decimalFormat || 'HIFEN';
        const ultimo = manga.lastChapter;
        const proximo = proximoCapitulo(ultimo);
        const linkDoUltimo = manga.lastChapterUrl || montar(manga.chapterLinkModel, formato, ultimo);
        let modelo = manga.chapterLinkModel;
        let proximoExato = null;
        let encontrado = null;

        // 1) abre a pagina do ultimo capitulo lido
        const atual = await buscar(linkDoUltimo);
        let atualAbriu = abriu(atual);
        if (atualAbriu && !manga.lastChapterUrl && !mesmoEndereco(atual.urlFinal, linkDoUltimo)) {
            // o site redirecionou: ou o id da obra mudou, ou o capitulo nao existe e caiu em outra pagina
            const novoModelo = derivarModelo(atual.urlFinal, ultimo, formato);
            if (novoModelo === null) atualAbriu = false;
            else modelo = novoModelo;
        }

        // 2) procura na pagina o link para o proximo capitulo
        if (atualAbriu) {
            encontrado = acharLinkDoProximo(atual, montar(modelo, formato, proximo), proximo, formato);
        }
        if (encontrado === null && manga.nextChapterUrl) {
            // a pagina nao mostrou o link, mas ja existe um endereco exato guardado: e ele que precisa ser conferido
            proximoExato = manga.nextChapterUrl;
        } else if (encontrado !== null && !mesmoEndereco(encontrado, montar(modelo, formato, proximo))) {
            const novoModelo = derivarModelo(encontrado, proximo, formato);
            const valeParaOAtual = novoModelo !== null && mesmoEndereco(montar(novoModelo, formato, ultimo), atual.urlFinal);
            if (valeParaOAtual) modelo = novoModelo;
            else proximoExato = encontrado; // id proprio de cada capitulo: so da para guardar o endereco exato
        }

        // 3) confirma que o link do proximo capitulo realmente abre
        const linkDoProximo = proximoExato !== null ? proximoExato : montar(modelo, formato, proximo);
        const pagina = await buscar(linkDoProximo);
        let proximoAbriu = abriu(pagina);
        if (proximoAbriu && proximoExato === null && !mesmoEndereco(pagina.urlFinal, linkDoProximo)) {
            const novoModelo = derivarModelo(pagina.urlFinal, proximo, formato);
            if (novoModelo === null) proximoAbriu = false; // abriu outra coisa (pagina inicial, pagina da obra...)
            else modelo = novoModelo;
        }

        // "nao existe" inclui o caso em que o site respondeu, mas com outra pagina no lugar do capitulo
        const proximoNaoExiste = naoExiste(pagina) || (abriu(pagina) && !proximoAbriu);
        const atualNaoExiste = naoExiste(atual) || (abriu(atual) && !atualAbriu);
        let situacao;
        if (proximoAbriu) situacao = 'DISPONIVEL';
        else if (!proximoNaoExiste) situacao = 'NAO_VERIFICADO'; // sem resposta ou bloqueado
        // (o capitulo 0 normalmente nao existe, entao ele nao prova que o link esta errado)
        else if (atualNaoExiste && ultimo > 0) situacao = 'LINK_QUEBRADO';
        else situacao = 'NAO_ENCONTRADO';

        return { situacao, chapterLinkModel: modelo, nextChapterUrl: situacao === 'DISPONIVEL' ? proximoExato : null };
    };
}

export function mensagemDaVerificacao(situacao, linkMudou, manga) {
    const proximo = String(proximoCapitulo(manga.lastChapter));
    const ultimo = String(manga.lastChapter).replace('.', ',');
    const troca = linkMudou ? 'O site mudou o endereço e o link foi atualizado. ' : '';
    switch (situacao) {
        case 'DISPONIVEL':
            return linkMudou
                ? troca + 'O capítulo ' + proximo + ' está disponível.'
                : 'Link confirmado: o capítulo ' + proximo + ' está disponível.';
        case 'NAO_ENCONTRADO':
            return troca + 'O capítulo ' + proximo + ' não foi encontrado no site; ele pode ainda não ter sido lançado.';
        case 'LINK_QUEBRADO':
            return 'Nem o capítulo ' + ultimo + ' nem o ' + proximo + ' abrem com esse link. Confira o link na edição geral.';
        default:
            return 'Não foi possível verificar: o site não respondeu ou bloqueia verificações automáticas. O link foi mantido.';
    }
}
