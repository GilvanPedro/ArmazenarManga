// Login que vale por 30 dias, guardado em um cookie do navegador. Mesmo formato e mesma assinatura da versao
// Java (web/Sessoes.java), para um login valer nas duas quando elas usam o mesmo banco.
//
// O cookie leva ate quando o login vale e uma assinatura feita com um segredo que so o servidor tem. Assim nao e
// preciso guardar as sessoes. A assinatura tambem depende do usuario e da senha: trocar a senha desfaz todos os
// logins, em qualquer aparelho.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'mangas_sessao';
export const DURACAO_SEGUNDOS = 30 * 24 * 60 * 60;

const sha256 = texto => createHash('sha256').update(texto, 'utf8').digest();

function assinar(segredo, corpo, usuario, senha) {
    const resumoDoLogin = sha256(usuario + '\n' + senha).toString('base64url');
    return createHmac('sha256', segredo).update(corpo + '.' + resumoDoLogin, 'utf8').digest('base64url');
}

/** Um login novo, que vale de agora ate daqui a 30 dias. Formato: v1.{expira em segundos}.{aleatorio}.{assinatura} */
export function criarSessao(segredo, usuario, senha, agora = Date.now()) {
    const corpo = 'v1.' + (Math.floor(agora / 1000) + DURACAO_SEGUNDOS) + '.' + randomBytes(16).toString('base64url');
    return corpo + '.' + assinar(segredo, corpo, usuario, senha);
}

/** Ate quando o login vale (Date), se o cookie for verdadeiro e ainda nao tiver vencido; senao null. */
export function validarSessao(cookie, segredo, usuario, senha, agora = Date.now()) {
    if (typeof cookie !== 'string' || cookie.length > 200) return null;
    const partes = cookie.split('.');
    if (partes.length !== 4 || partes[0] !== 'v1' || !/^\d{1,12}$/.test(partes[1])) return null;
    const expira = Number(partes[1]);
    const segundos = Math.floor(agora / 1000);
    // vencido, ou com uma validade maior do que o servidor daria
    if (expira <= segundos || expira > segundos + DURACAO_SEGUNDOS + 60) return null;
    const esperada = Buffer.from(assinar(segredo, partes.slice(0, 3).join('.'), usuario, senha));
    const recebida = Buffer.from(partes[3]);
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
