// Quem nao tem conta (doc 104): so le o que e publico; todo o resto pede conta.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VISITANTE, rotaDeVisitante } from '../api/_visitante.js';

const rota = (metodo, caminho) => {
    const partes = caminho.split('/').filter(Boolean);
    return rotaDeVisitante(partes[0], partes, metodo);
};

test('sem conta, da para ler a Comunidade, a vitrine da loja e o Descobrir', () => {
    for (const caminho of ['comunidade/feed', 'comunidade/novidades', 'comunidade/sugestoes', 'comunidade/busca-rapida', 'comunidade/pessoas',
        'comunidade/posts', 'comunidade/posts/abc', 'comunidade/posts/abc/comentarios', 'comunidade/imagens/x.webp', 'comunidade/contas/abc',
        'comunidade/contas/abc/seguidores', 'comunidade/contas/abc/seguindo', 'comunidade/contas/abc/foto', 'loja', 'recomendacoes',
        'recomendacoes/ordens', 'tags', 'status', 'formatos-decimais', 'dias-da-semana', 'ordens-da-lista']) {
        assert.equal(rota('GET', caminho), true, caminho);
    }
});

test('sem conta, nada de escrever nem de ver o que e de cada um', () => {
    for (const caminho of ['comunidade/contas/abc/mangas', 'comunidade/contas/abc/capas/x.webp', 'comunidade/situacao', 'comunidade/gerenciamento/contas',
        'comunidade/gerenciamento/painel', 'mangas', 'mangas/abc', 'conta', 'imagens/x.webp', 'sinopse', 'banners', 'loja/compras/abc', 'loja/imagens',
        'mangas/lancamentos']) {
        assert.equal(rota('GET', caminho), false, caminho);
    }
    for (const metodo of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        for (const caminho of ['comunidade/posts', 'comunidade/posts/abc/curtida', 'comunidade/posts/abc/comentarios', 'comunidade/contas/abc/seguir',
            'comunidade/imagens', 'comunidade/perfil', 'loja/comprar', 'loja/equipar', 'mangas', 'tags']) {
            assert.equal(rota(metodo, caminho), false, metodo + ' ' + caminho);
        }
    }
});

test('o visitante nao e ninguem', () => {
    assert.equal(VISITANTE.admin, false);
    assert.equal(VISITANTE.email, '');
    assert.ok(Object.isFrozen(VISITANTE));
});
