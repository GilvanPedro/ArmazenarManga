// Testes de como o site acha o manga da lista a partir da pagina de um capitulo (o favorito e a extensao, doc 133).
// As funcoes ficam no app.js do site: sao copiadas de la e rodadas aqui.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

const fonte = fs.readFileSync(new URL('../src/main/resources/public/app.js', import.meta.url), 'utf8');
const funcao = nome => {
    const inicio = fonte.indexOf('function ' + nome + '(');
    let nivel = 0;
    let fim = fonte.indexOf('{', inicio);
    for (; fim < fonte.length; fim++) {
        if (fonte[fim] === '{') nivel++;
        else if (fonte[fim] === '}' && --nivel === 0) break;
    }
    return fonte.slice(inicio, fim + 1);
};
const constante = nome => {
    const inicio = fonte.indexOf('const ' + nome + ' ');
    return fonte.slice(inicio, fonte.indexOf(';\n', inicio) + 1);
};
const { limparTitulo, mangaDoLink, nomesNoEndereco } = new Function([
    constante('TOKEN_DE_CAPITULO'), constante('TIPO_DE_OBRA'), constante('PALAVRAS_DE_ENDERECO'),
    funcao('limparTitulo'), funcao('nomesNoEndereco'), funcao('mangaDoLink'),
    'return { limparTitulo, mangaDoLink, nomesNoEndereco };'].join('\n'))();

const NOME = 'The Sword Saint Reincarnated Into a Noble Mage Family';

test('titulo com pontuacao solta, "Manga" e "Read" em volta do nome fica so com o nome', () => {
    for (const titulo of [': Manga ' + NOME + ' Read', 'Chapter 12: Manga ' + NOME + ' Read Online', 'Vol. 2: Manga ' + NOME + ' Read Online - Site',
        ' - : Manga ' + NOME + ' Read', 'Manga ' + NOME + ' Read Online Free']) {
        assert.equal(limparTitulo(titulo, 'https://site.com/x/'), NOME, titulo);
    }
});

test('os titulos que ja eram limpos continuam iguais', () => {
    const casos = [
        ['[Manga] Manga Solo Leveling - Capítulo 12 | Site', 'https://site.com/', 'Solo Leveling'],
        ['Chapter 222 | Pick Me Up, Infinite Gacha | Weeb Central', 'https://weebcentral.com/', 'Pick Me Up, Infinite Gacha'],
        ['Read The Beginning After the End Manhwa Online - All Chapters Free | Toonily', 'https://toonily.com/', 'The Beginning After the End'],
        ['Solo Leveling: Ragnarok Chapter 5 - Asura Scans', 'https://asurascans.com/', 'Solo Leveling: Ragnarok'],
        ['Omniscient Reader’s Viewpoint - Chapter 200 - Read Manhwa Online', 'https://x.com/', 'Omniscient Reader’s Viewpoint'],
        ['Kaiju No. 8 Chapter 100 | MangaPlus', 'https://mangaplus.com/', 'Kaiju No. 8'],
        ['Apocalypse Now Chapter 3', 'https://x.com/', 'Apocalypse Now'],
        ['.hack//Link Chapter 3', 'https://x.com/', '.hack//Link'],
        ['Ler Manga Tomodachi Game Capítulo 30 Online', 'https://x.com/', 'Tomodachi Game'],
        ['Volume 3 Chapter 12 - Kingdom', 'https://x.com/', 'Kingdom'],
    ];
    for (const [titulo, endereco, esperado] of casos) assert.equal(limparTitulo(titulo, endereco), esperado, titulo);
});

test('o manga da lista e reconhecido pelo titulo baguncado, pelo nome seguido de "Read" e pelo nome no endereco', () => {
    const lista = [{ id: 1, title: NOME }, { id: 2, title: 'Solo Leveling' }, { id: 3, title: 'Solo Leveling: Ragnarok' }]
        .map(manga => ({ ...manga, altTitles: [], lastChapterLink: 'https://outro.com/obra/' + manga.id + '/1', chapterLinkModel: 'https://outro.com/obra/' + manga.id + '/{cap}' }));
    assert.equal(mangaDoLink(lista, 'https://novo.com/read/x9/chapter-12', [': Manga ' + NOME + ' Read'])?.id, 1);
    assert.equal(mangaDoLink(lista, 'https://novo.com/read/x9/chapter-12', ['Xyz 12: Manga ' + NOME + ' Read Online'])?.id, 1);
    assert.equal(mangaDoLink(lista, 'https://novo.com/manga/the-sword-saint-reincarnated-into-a-noble-mage-family-a1b2/chapter-12', ['Página'])?.id, 1);
    // o endereco de Ragnarok nao vira Solo Leveling, e o titulo que diz Ragnarok fica com Ragnarok
    assert.equal(mangaDoLink(lista, 'https://novo.com/manga/solo-leveling-ragnarok/chapter-12', ['Página'])?.id, 3);
    assert.equal(mangaDoLink(lista, 'https://novo.com/manga/solo-leveling/chapter-12', ['Solo Leveling Ragnarok Read'])?.id, 3);
    assert.deepEqual(nomesNoEndereco('https://x.com/comics/omniscient-readers-viewpoint-3ec3b16f/chapter/12'), ['omniscient readers viewpoint']);
});
