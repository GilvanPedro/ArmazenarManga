// O robo de imagens com a moderacao da OpenAI (doc 89), com respostas falsas no lugar da OpenAI. Carrega o modelo
// local de verdade (a primeira imagem leva alguns segundos).
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { verificarImagem } from '../api/_robo_de_imagens.js';

const imagem = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#7a8ba0' } }).jpeg().toBuffer();
const respondendo = (sexual, marcada = sexual >= 0.5) => async (url, pedido) => {
    const corpo = JSON.parse(pedido.body);
    assert.match(url, /\/v1\/moderations$/);
    assert.equal(corpo.model, 'omni-moderation-latest');
    assert.match(corpo.input[0].image_url.url, /^data:image\/jpeg;base64,/);
    assert.equal(pedido.headers.authorization, 'Bearer chave-de-teste');
    return new Response(JSON.stringify({ results: [{ categories: { sexual: marcada }, category_scores: { sexual } }] }), { status: 200 });
};

// o que o modelo local diria de uma foto comum (uma imagem lisa, para ele, parece desenho)
const fotoComum = async () => ({ Neutral: 0.8, Sexy: 0.1, Porn: 0.06, Drawing: 0.03, Hentai: 0.01 });

test('a OpenAI decide quando ha chave', async () => {
    const barrada = await verificarImagem(imagem, { chave: 'chave-de-teste', fetch: respondendo(0.96), classificar: fotoComum });
    assert.equal(barrada.permitida, false);
    assert.equal(barrada.fonte, 'openai');
    assert.equal(barrada.openai.sexual, 0.96);
    const liberada = await verificarImagem(imagem, { chave: 'chave-de-teste', fetch: respondendo(0.01), classificar: async () => ({ Porn: 0.94, Sexy: 0.03, Neutral: 0.03 }) });
    assert.equal(liberada.openai.sexual, 0.01, 'o modelo local achou 94%, mas a OpenAI diz que nao e sexual');
    assert.equal(liberada.permitida, true);
    assert.equal(liberada.fonte, 'openai');
});

test('sem chave, ou com a OpenAI fora do ar, decide o modelo local', async () => {
    // aqui o modelo local de verdade
    const semChave = await verificarImagem(imagem, { chave: '' });
    assert.equal(semChave.fonte, 'local');
    assert.equal(semChave.permitida, true);
    const fora = await verificarImagem(imagem, { chave: 'chave-de-teste', fetch: async () => new Response('erro', { status: 500 }) });
    assert.equal(fora.fonte, 'local');
    const quebrada = await verificarImagem(imagem, { chave: 'chave-de-teste', fetch: async () => { throw new Error('sem rede'); } });
    assert.equal(quebrada.fonte, 'local');
});
