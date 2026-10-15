// Regras das contas: e-mail, nick e senha validos, e a senha guardada so como hash. Mesmas regras e mesmo formato
// de hash da versao Java (service/ContaService.java e service/Senhas.java), porque as duas podem usar o mesmo banco.
import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(pbkdf2);

export const SENHA_MINIMA = 6;
export const SENHA_MAXIMA = 200;
export const NICK_MAXIMO = 40;
// recomendacao da OWASP para PBKDF2 com SHA-256
export const ITERACOES = 600000;

/** Recusa de dados da conta: vira uma resposta 400 com a mensagem. */
export class DadoInvalido extends Error {}

/** E-mail como e guardado e comparado: sem espacos nas pontas e em minusculas. */
export function normalizarEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validarEmail(email) {
    const limpo = normalizarEmail(email);
    if (!limpo) throw new DadoInvalido('Informe o e-mail');
    if (limpo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) throw new DadoInvalido('E-mail inválido');
    return limpo;
}

export function validarNick(nick) {
    const limpo = typeof nick === 'string' ? nick.trim().replace(/\s+/g, ' ') : '';
    if (!limpo) throw new DadoInvalido('Escolha um nick');
    if ([...limpo].length > NICK_MAXIMO) throw new DadoInvalido(`O nick pode ter no máximo ${NICK_MAXIMO} caracteres`);
    return limpo;
}

export function validarSenha(senha) {
    if (typeof senha !== 'string' || senha.length < SENHA_MINIMA) throw new DadoInvalido(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
    if (senha.length > SENHA_MAXIMA) throw new DadoInvalido(`A senha pode ter no máximo ${SENHA_MAXIMA} caracteres`);
    return senha;
}

/** Hash para guardar: pbkdf2_sha256${iteracoes}${sal}${hash}, com sal e hash em base64. */
export async function gerarHash(senha, iteracoes = ITERACOES) {
    const sal = randomBytes(16);
    const hash = await derivar(senha, sal, iteracoes, 32, 'sha256');
    return `pbkdf2_sha256$${iteracoes}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

/** A senha digitada confere com o hash guardado? */
export async function senhaConfere(senha, guardado) {
    if (typeof senha !== 'string' || typeof guardado !== 'string') return false;
    const [tipo, iteracoes, sal, hash] = guardado.split('$');
    const vezes = Number(iteracoes);
    if (tipo !== 'pbkdf2_sha256' || !Number.isInteger(vezes) || vezes < 1 || vezes > 10_000_000 || !sal || !hash) return false;
    const esperado = Buffer.from(hash, 'base64');
    const calculado = await derivar(senha, Buffer.from(sal, 'base64'), vezes, esperado.length || 32, 'sha256');
    return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}

// um hash pronto, para gastar o mesmo tempo quando o e-mail nao existe (o tempo nao diz se a conta existe)
let hashDeMentira;
export async function gastarTempoDeUmaSenha(senha) {
    hashDeMentira ??= await gerarHash('senha que ninguem usa');
    await senhaConfere(typeof senha === 'string' ? senha : '', hashDeMentira);
}
