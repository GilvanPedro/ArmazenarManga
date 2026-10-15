// Login que vale por 30 dias, guardado em um cookie do navegador. Mesmo formato e mesma assinatura da versao
// Java (web/Sessoes.java), para um login valer nas duas quando elas usam o mesmo banco.
//
// O cookie diz de qual conta e o login, ate quando vale, e leva uma assinatura feita com um segredo que so o
// servidor tem. A assinatura tambem depende da senha guardada da conta: trocar a senha desfaz todos os logins
// daquela conta, em qualquer aparelho.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'mangas_sessao';
export const DURACAO_SEGUNDOS = 30 * 24 * 60 * 60;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sha256 = texto => createHash('sha256').update(texto, 'utf8').digest();

function assinar(segredo, corpo, senhaGuardada) {
    const resumoDaSenha = sha256(senhaGuardada).toString('base64url');
    return createHmac('sha256', segredo).update(corpo + '.' + resumoDaSenha, 'utf8').digest('base64url');
}

/**
 * Um login novo da conta, que vale de agora ate daqui a 30 dias.
 * Formato: v2.{id da conta}.{expira em segundos}.{aleatorio}.{assinatura}
 *
 * @param senhaGuardada o hash da senha guardado na conta (nunca a senha digitada)
 */
export function criarSessao(segredo, contaId, senhaGuardada, agora = Date.now()) {
    const corpo = 'v2.' + contaId + '.' + (Math.floor(agora / 1000) + DURACAO_SEGUNDOS) + '.' + randomBytes(16).toString('base64url');
    return corpo + '.' + assinar(segredo, corpo, senhaGuardada);
}

/** De qual conta e o cookie, sem conferir a assinatura (para buscar a conta e depois validar). */
export function contaDoCookie(cookie) {
    if (typeof cookie !== 'string' || cookie.length > 300) return null;
    const partes = cookie.split('.');
    return partes.length === 5 && partes[0] === 'v2' && ID.test(partes[1]) ? partes[1] : null;
}

/** Ate quando o login vale (Date), se o cookie for verdadeiro, da conta e ainda nao tiver vencido; senao null. */
export function validarSessao(cookie, segredo, contaId, senhaGuardada, agora = Date.now()) {
    if (contaDoCookie(cookie) !== contaId || typeof senhaGuardada !== 'string') return null;
    const partes = cookie.split('.');
    if (!/^\d{1,12}$/.test(partes[2])) return null;
    const expira = Number(partes[2]);
    const segundos = Math.floor(agora / 1000);
    // vencido, ou com uma validade maior do que o servidor daria
    if (expira <= segundos || expira > segundos + DURACAO_SEGUNDOS + 60) return null;
    const esperada = Buffer.from(assinar(segredo, partes.slice(0, 4).join('.'), senhaGuardada));
    const recebida = Buffer.from(partes[4]);
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
    return new Date(expira * 1000);
}

/** Compara textos sem que o tempo diga onde eles diferem. */
export function mesmoTexto(a, b) {
    return timingSafeEqual(sha256(String(a)), sha256(String(b)));
}

export function lerCookie(cabecalho, nome) {
    for (const parte of (cabecalho || '').split(';')) {
        const igual = parte.indexOf('=');
        if (igual > 0 && parte.slice(0, igual).trim() === nome) return parte.slice(igual + 1).trim();
    }
    return null;
}

/** HttpOnly: os scripts da pagina nao leem o cookie. SameSite=Lax: outros sites nao o usam para alterar dados. */
export function textoDoCookie(valor, segundos, https) {
    return `${COOKIE}=${valor}; Path=/; Max-Age=${segundos}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
}

/** Segredo vindo da variavel MANGATRACKER_SEGREDO; null se for curto demais. */
export function segredoDoTexto(texto) {
    return typeof texto === 'string' && texto.trim().length >= 32 ? Buffer.from(texto.trim(), 'utf8') : null;
}
