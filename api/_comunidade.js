// Regras da Comunidade: o que um post e um comentario podem ter, e como o feed "Para voce" e ordenado.
// So a versao do Vercel tem a Comunidade.

export const TEXTO_MAXIMO = 500;
export const IMAGENS_POR_POST = 4;
export const POSTS_POR_PAGINA = 20;
export const TAMANHO_MAXIMO_DA_IMAGEM = 2 * 1024 * 1024;
export const MANGAS_POR_LISTA = 20;
export const TITULO_DA_LISTA_MAXIMO = 80;

/** Recusa de dados da Comunidade: vira uma resposta 400 com a mensagem. */
export class DadoInvalidoNaComunidade extends Error {}

const NOME_DA_IMAGEM = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;

/** Texto como e guardado: sem espacos sobrando nas pontas e com no maximo 3 linhas em branco seguidas. */
export function limparTexto(texto) {
    return typeof texto === 'string' ? texto.replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim() : '';
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lista anexada ao post: titulo opcional (ate 80 caracteres) e de 1 a 20 mangas da biblioteca de quem posta, pelos
 * ids, na ordem escolhida. null = post sem lista.
 */
export function validarLista(lista) {
    if (lista === undefined || lista === null) return null;
    if (typeof lista !== 'object' || Array.isArray(lista)) throw new DadoInvalidoNaComunidade('Lista inválida');
    const titulo = typeof lista.titulo === 'string' ? lista.titulo.trim().replace(/\s+/g, ' ') : '';
    if ([...titulo].length > TITULO_DA_LISTA_MAXIMO) throw new DadoInvalidoNaComunidade(`O título da lista pode ter no máximo ${TITULO_DA_LISTA_MAXIMO} caracteres`);
    const mangas = lista.mangas;
    if (!Array.isArray(mangas) || mangas.some(id => typeof id !== 'string' || !ID.test(id))) throw new DadoInvalidoNaComunidade('Lista inválida');
    const unicos = [...new Set(mangas.map(id => id.toLowerCase()))];
    if (unicos.length === 0) throw new DadoInvalidoNaComunidade('Escolha pelo menos um mangá para a lista');
    if (unicos.length > MANGAS_POR_LISTA) throw new DadoInvalidoNaComunidade(`Uma lista pode ter no máximo ${MANGAS_POR_LISTA} mangás`);
    return { titulo, mangas: unicos };
}

/** Post: texto de ate 500 caracteres, ate 4 imagens e, se quiser, uma lista; precisa ter pelo menos um dos tres. */
export function validarPost(dados) {
    const texto = limparTexto(dados?.texto);
    const imagens = dados?.imagens ?? [];
    if (!Array.isArray(imagens) || imagens.some(nome => typeof nome !== 'string' || !NOME_DA_IMAGEM.test(nome))) {
        throw new DadoInvalidoNaComunidade('Imagem inválida no post');
    }
    const unicas = [...new Set(imagens)];
    if (unicas.length > IMAGENS_POR_POST) throw new DadoInvalidoNaComunidade(`Um post pode ter no máximo ${IMAGENS_POR_POST} imagens`);
    const lista = validarLista(dados?.lista);
    if (!texto && unicas.length === 0 && !lista) throw new DadoInvalidoNaComunidade('Escreva algo, adicione uma imagem ou anexe uma lista');
    if ([...texto].length > TEXTO_MAXIMO) throw new DadoInvalidoNaComunidade(`O post pode ter no máximo ${TEXTO_MAXIMO} caracteres`);
    return { texto, imagens: unicas, lista };
}

export function validarComentario(dados) {
    const texto = limparTexto(dados?.texto);
    if (!texto) throw new DadoInvalidoNaComunidade('Escreva o comentário');
    if ([...texto].length > TEXTO_MAXIMO) throw new DadoInvalidoNaComunidade(`O comentário pode ter no máximo ${TEXTO_MAXIMO} caracteres`);
    return texto;
}

/**
 * Pesos do feed "Para voce". Cada post ganha pontos pela proximidade de quem le com o autor e pelo interesse que o
 * post despertou, e perde com o tempo:
 *
 *   pontos = (1 + proximidade + 2 * ln(1 + curtidas + 2 * comentarios)) / (horas desde o post + 2) ^ 1.2
 *
 * A proximidade com um autor soma: 10 se voce o segue, 2 por post dele que voce curtiu e 3 por post dele que voce
 * comentou nos ultimos 60 dias, ate 40. Os proprios posts entram com proximidade 5, para voce ver o que publicou.
 */
export const PESOS = { seguir: 10, curtida: 2, comentario: 3, maximo: 40, proprio: 5, dias: 60, expoente: 1.2 };

/** A mesma conta que o banco faz, para os testes e para quem quiser conferir. */
export function pontosDoPost({ proximidade = 0, curtidas = 0, comentarios = 0, horas = 0 }) {
    const interesse = 2 * Math.log(1 + curtidas + 2 * comentarios);
    return (1 + Math.min(proximidade, PESOS.maximo) + interesse) / Math.pow(horas + 2, PESOS.expoente);
}
