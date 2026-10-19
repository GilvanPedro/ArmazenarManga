// Quem nao tem conta (doc 104): o que pode ver no site sem entrar.

/**
 * Quem nao tem conta (doc 104): um "visitante" que nunca e dono de nada. O id nao existe na tabela de contas, entao
 * as consultas que comparam com ele voltam vazias (nao curtiu, nao segue, nao tem itens, nao tem mangas).
 */
export const VISITANTE = Object.freeze({ id: '00000000-0000-0000-0000-000000000000', nick: '', email: '', admin: false, visitante: true });

/**
 * As rotas que um visitante pode chamar: so leitura (GET) do que e publico. A Comunidade (feed, posts, comentarios,
 * imagens dos posts, perfis, seguidores, busca), a vitrine da loja e o Descobrir. Os mangas de um perfil, as capas
 * deles, o cadastro, postar, curtir, comentar, seguir, comprar, equipar e todo o resto pedem conta.
 */
export function rotaDeVisitante(recurso, partes, metodo) {
    if (metodo !== 'GET') return false;
    const [, a, , c] = partes;
    if (recurso === 'comunidade') {
        if (partes.length === 2) return ['feed', 'novidades', 'sugestoes', 'busca-rapida', 'pessoas', 'posts'].includes(a);
        if (partes.length === 3) return ['posts', 'imagens', 'contas'].includes(a);
        if (partes.length === 4) return (a === 'posts' && c === 'comentarios') || (a === 'contas' && ['seguidores', 'seguindo', 'foto'].includes(c));
        return false;
    }
    if (recurso === 'loja') return partes.length === 1;
    if (recurso === 'recomendacoes') return partes.length === 1 || (partes.length === 2 && a === 'ordens');
    return partes.length === 1 && ['tags', 'status', 'formatos-decimais', 'dias-da-semana', 'ordens-da-lista'].includes(recurso);
}
