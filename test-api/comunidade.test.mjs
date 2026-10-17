// Testes das regras da Comunidade (posts, comentarios e a ordem do feed "Para voce").
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DadoInvalidoNaComunidade, escaparLike, hashtagsDo, hashtagsQueComecamCom, doMaisNovoParaOMaisAntigo, lerBusca, limparTexto, pontosDoPost, validarComentario, validarDescricao, validarLista, validarPost } from '../api/_comunidade.js';

const IMAGEM = '0a1b2c3d-1111-4222-8333-444455556666.webp';

test('post precisa de texto ou imagem, com no maximo 500 caracteres e 4 imagens', () => {
    assert.deepEqual(validarPost({ texto: '  Terminei Frieren!  \r\n' }), { texto: 'Terminei Frieren!', imagens: [], lista: null });
    assert.deepEqual(validarPost({ imagens: [IMAGEM, IMAGEM] }), { texto: '', imagens: [IMAGEM], lista: null }, 'imagem repetida conta uma vez');
    assert.equal(validarPost({ texto: 'ñ'.repeat(500) }).texto.length, 500);
    assert.throws(() => validarPost({ texto: '   ' }), /Escreva algo/);
    assert.throws(() => validarPost({}), DadoInvalidoNaComunidade);
    assert.throws(() => validarPost({ texto: 'x'.repeat(501) }), /no máximo 500/);
    const cinco = [1, 2, 3, 4, 5].map(n => `0a1b2c3d-1111-4222-8333-44445555666${n}.png`);
    assert.throws(() => validarPost({ texto: 'oi', imagens: cinco }), /no máximo 4 imagens/);
    for (const ruim of [['../segredo.png'], ['x.exe'], [42], 'nao-e-lista']) {
        assert.throws(() => validarPost({ texto: 'oi', imagens: ruim }), /Imagem inválida/, String(ruim));
    }
});

test('texto guardado sem espacos sobrando e sem pilhas de linhas em branco', () => {
    assert.equal(limparTexto('a\n\n\n\n\n\nb'), 'a\n\n\nb');
    assert.equal(limparTexto(null), '');
    assert.equal(validarComentario({ texto: ' Concordo ' }), 'Concordo');
    assert.throws(() => validarComentario({ texto: '' }), /Escreva o comentário/);
    assert.throws(() => validarComentario({ texto: 'x'.repeat(501) }), /no máximo 500/);
});

test('feed para voce: quem voce segue e o que voce curte sobe, e o tempo derruba', () => {
    const base = { curtidas: 0, comentarios: 0, horas: 3 };
    const desconhecido = pontosDoPost({ ...base });
    const seguido = pontosDoPost({ ...base, proximidade: 10 });
    const curtido = pontosDoPost({ ...base, proximidade: 2 * 3 });
    assert.ok(seguido > curtido && curtido > desconhecido);
    // post muito curtido de um desconhecido passa um post sem interesse de quem voce segue... se for bem mais recente
    assert.ok(pontosDoPost({ curtidas: 50, comentarios: 10, horas: 1 }) > pontosDoPost({ proximidade: 10, horas: 48 }));
    // o mesmo post vale menos com o tempo
    assert.ok(pontosDoPost({ proximidade: 10, horas: 1 }) > pontosDoPost({ proximidade: 10, horas: 24 }));
    // a proximidade tem teto: seguir e curtir tudo de alguem nao enterra o resto do feed
    assert.equal(pontosDoPost({ proximidade: 400, horas: 1 }), pontosDoPost({ proximidade: 40, horas: 1 }));
});

test('lista anexada: titulo opcional e de 1 a 20 mangas, sem repetir', () => {
    const id = n => `0a1b2c3d-1111-4222-8333-${String(n).padStart(12, '0')}`;
    assert.deepEqual(validarPost({ lista: { titulo: '  Os que   recomendo ', mangas: [id(1), id(2), id(1).toUpperCase()] } }),
        { texto: '', imagens: [], lista: { titulo: 'Os que recomendo', mangas: [id(1), id(2)] } }, 'post so com a lista vale');
    assert.equal(validarLista(undefined), null);
    assert.equal(validarLista({ mangas: [id(1)] }).titulo, '');
    assert.throws(() => validarLista({ mangas: [] }), /pelo menos um mangá/);
    assert.throws(() => validarLista({ mangas: Array.from({ length: 21 }, (_, n) => id(n)) }), /no máximo 20/);
    assert.throws(() => validarLista({ titulo: 'x'.repeat(81), mangas: [id(1)] }), /no máximo 80/);
    for (const ruim of [{ mangas: ['nao-e-id'] }, { mangas: 'x' }, [id(1)], 'lista']) {
        assert.throws(() => validarLista(ruim), DadoInvalidoNaComunidade, JSON.stringify(ruim));
    }
});

test('descricao do perfil: ate 300 caracteres, limpa, e vazia apaga', () => {
    assert.equal(validarDescricao({ descricao: '  Leio manhwa\r\n\n\n\nde ação ' }), 'Leio manhwa\n\nde ação');
    assert.equal(validarDescricao({ descricao: '' }), '');
    assert.equal(validarDescricao({}), '');
    assert.equal(validarDescricao({ descricao: 'ñ'.repeat(300) }).length, 300);
    assert.throws(() => validarDescricao({ descricao: 'x'.repeat(301) }), /no máximo 300/);
    assert.throws(() => validarDescricao({ descricao: 42 }), DadoInvalidoNaComunidade);
});

test('hashtags: letras com acento, numeros e _, sem repetir e sem contar "a#b"', () => {
    assert.deepEqual(hashtagsDo('Terminei #Frieren e #frieren, agora #Mangá_2026! (#Parênteses) a#b #'), ['frieren', 'mangá_2026', 'parênteses']);
    assert.deepEqual(hashtagsDo(''), []);
    assert.deepEqual(hashtagsDo(null), []);
});

test('busca: "#tag" procura a hashtag; o resto, pessoas e texto (sem o @)', () => {
    assert.deepEqual(lerBusca('  #Frieren '), { tipo: 'hashtag', tag: 'frieren', texto: '#Frieren' });
    assert.deepEqual(lerBusca('@gil'), { tipo: 'texto', texto: 'gil' });
    assert.deepEqual(lerBusca('solo   leveling'), { tipo: 'texto', texto: 'solo leveling' });
    assert.deepEqual(lerBusca('#frieren e mais'), { tipo: 'texto', texto: '#frieren e mais' }, 'com espaco, e texto');
    for (const vazia of ['', '   ', '#', '##', '@', null, 42]) assert.equal(lerBusca(vazia), null, String(vazia));
    assert.equal(lerBusca('x'.repeat(100)).texto.length, 60);
    assert.equal(escaparLike('50%_a\\'), '50\\%\\_a\\\\');
});

test('sugestao de #tags: as que comecam com o digitado, das mais usadas para as menos usadas', () => {
    const textos = ['#Frieren lindo #fantasia', 'amo #frieren #Frieren', '#frio hoje', 'a#frieren nao conta', '#Fate'];
    assert.deepEqual(hashtagsQueComecamCom(textos, '#fr'), [{ tag: 'frieren', posts: 2 }, { tag: 'frio', posts: 1 }]);
    // a mais usada primeiro; empatadas, em ordem alfabetica; no maximo o pedido
    assert.deepEqual(hashtagsQueComecamCom(textos, 'f', 2), [{ tag: 'frieren', posts: 2 }, { tag: 'fantasia', posts: 1 }]);
    assert.deepEqual(hashtagsQueComecamCom(textos, '#'), []);
    assert.deepEqual(hashtagsQueComecamCom(textos, 'xyz'), []);
});

test('para voce: do mais novo para o mais antigo, sejam meus ou de outra pessoa', () => {
    const p = (id, autor, hora) => ({ id, autor, criado_em: `2026-10-16T${String(hora).padStart(2, '0')}:00:00Z` });
    const ids = linhas => doMaisNovoParaOMaisAntigo(linhas).map(linha => linha.id);
    // na ordem dos pontos: o meu post com mais pontos vinha antes de posts mais novos dos outros
    assert.deepEqual(ids([p('meu', 'eu', 8), p('a', 'bia', 12), p('b', 'caio', 9), p('velho', 'eu', 3)]), ['a', 'b', 'meu', 'velho']);
    // empatados na hora, pelo id
    assert.deepEqual(ids([p('d', 'bia', 10), p('c', 'eu', 10)]), ['c', 'd']);
    const linhas = [p('x', 'eu', 1), p('y', 'bia', 2)];
    ids(linhas);
    assert.deepEqual(linhas.map(linha => linha.id), ['x', 'y'], 'nao muda a lista recebida');
    assert.deepEqual(ids([]), []);
});
