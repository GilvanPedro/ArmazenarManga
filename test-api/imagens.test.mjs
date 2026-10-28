// Testes da preparacao das imagens enviadas (doc 139): conferir, limpar os metadados, as larguras e os formatos.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImagemInvalida, LARGURAS, imagemParaOSite, prepararImagem, urlNaLargura } from '../api/_imagens.js';

const { default: sharp } = await import('sharp');
const jpegComExif = (largura, altura) => sharp({ create: { width: largura, height: altura, channels: 3, background: '#3366cc' } })
    .jpeg().withExif({ IFD0: { Artist: 'Quem tirou', Copyright: 'GPS -23.55,-46.63' } }).toBuffer();

test('capa: tres larguras em AVIF e WebP, sem metadados, com a previa e as medidas da original', async () => {
    const preparada = await prepararImagem(await jpegComExif(1000, 1500), 'capa');
    assert.deepEqual(preparada.variantes.map(v => v.largura + '.' + v.formato), ['240.avif', '240.webp', '480.avif', '480.webp', '720.avif', '720.webp']);
    assert.deepEqual([preparada.largura, preparada.altura], [1000, 1500]);
    for (const variante of preparada.variantes) {
        const dados = await sharp(variante.bytes).metadata();
        assert.equal(dados.format === 'heif' ? 'avif' : dados.format, variante.formato);
        assert.equal(dados.width, variante.largura);
        assert.equal(dados.exif, undefined, 'sem EXIF');
    }
    assert.match(preparada.placeholder, /^data:image\/webp;base64,/);
    assert.ok(preparada.placeholder.length < 600);
    assert.match(preparada.hash, /^[0-9a-f]{64}$/);
});

test('imagem menor que as larguras nao e aumentada', async () => {
    const preparada = await prepararImagem(await jpegComExif(300, 450), 'capa');
    assert.deepEqual([...new Set(preparada.variantes.map(v => v.largura))], [240, 300]);
    assert.equal(LARGURAS.post.at(-1), 1440);
});

test('GIF animado continua animado, em WebP (sem AVIF)', async () => {
    const quadro = cor => sharp({ create: { width: 64, height: 64, channels: 4, background: cor } }).png().toBuffer();
    const gif = await sharp([await quadro('#ff0000'), await quadro('#00ff00'), await quadro('#0000ff')], { join: { animated: true } }).gif().toBuffer();
    assert.equal((await sharp(gif, { animated: true }).metadata()).pages, 3);
    const preparada = await prepararImagem(gif, 'post');
    assert.ok(preparada.animada);
    assert.ok(preparada.variantes.every(v => v.formato === 'webp'));
    assert.equal((await sharp(preparada.principal.bytes, { animated: true }).metadata()).pages, 3, 'os 3 quadros continuam');
    assert.deepEqual([preparada.largura, preparada.altura], [64, 64]);
});

test('o que nao e imagem e recusado', async () => {
    await assert.rejects(() => prepararImagem(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'capa'), ImagemInvalida);
    await assert.rejects(() => prepararImagem(Buffer.from('nada aqui'), 'capa'), ImagemInvalida);
});

test('o site recebe as larguras em srcset e a versao mais proxima de uma largura', () => {
    const linha = { url: 'https://b/720.webp', largura: 1000, altura: 1500, placeholder: 'data:x', variantes: [
        { largura: 240, formato: 'avif', url: 'https://b/240.avif' }, { largura: 240, formato: 'webp', url: 'https://b/240.webp' },
        { largura: 720, formato: 'avif', url: 'https://b/720.avif' }, { largura: 720, formato: 'webp', url: 'https://b/720.webp' }] };
    assert.deepEqual(imagemParaOSite(linha), { avif: 'https://b/240.avif 240w, https://b/720.avif 720w', webp: 'https://b/240.webp 240w, https://b/720.webp 720w',
        largura: 1000, altura: 1500, previa: 'data:x' });
    assert.equal(urlNaLargura(linha, 200), 'https://b/240.webp');
    assert.equal(urlNaLargura(linha, 500), 'https://b/720.webp');
    assert.equal(urlNaLargura(linha, 5000), 'https://b/720.webp');
    assert.equal(imagemParaOSite({ conteudo: 'no banco' }), null);
});
