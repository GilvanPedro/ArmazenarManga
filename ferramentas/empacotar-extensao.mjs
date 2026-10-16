// Monta os pacotes da extensao (pasta extensao/) para enviar as lojas:
//
//   node ferramentas/empacotar-extensao.mjs
//
// Gera, na raiz do projeto:
//   extensao-firefox.zip  -> para addons.mozilla.org: o manifesto sem "background.service_worker" (o Firefox usa
//                            "background.scripts" e avisa que ignora o service worker)
//   extensao-chrome.zip   -> para a Chrome Web Store (e Edge, Opera): o manifesto sem "background.scripts" e sem
//                            "browser_specific_settings", que sao so do Firefox
//
// O manifest.json da pasta continua com tudo, para carregar a extensao direto da pasta em qualquer navegador.
// Os arquivos vao como estao (sem minificar nem gerar codigo); so o manifesto muda. Precisa do Node 22 ou mais novo.
import fs from 'node:fs';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pasta = path.join(raiz, 'extensao');
const manifesto = JSON.parse(fs.readFileSync(path.join(pasta, 'manifest.json'), 'utf8'));

/** Um zip simples (cada arquivo comprimido com deflate), com os arquivos na raiz, como as lojas pedem. */
function montarZip(arquivos) {
    const locais = [];
    const centrais = [];
    let posicao = 0;
    // data fixa (1/1/2026): o mesmo conteudo da sempre o mesmo zip
    const hora = 0;
    const data = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const { nome, conteudo } of arquivos) {
        const nomeEmBytes = Buffer.from(nome, 'utf8');
        const comprimido = deflateRawSync(conteudo, { level: 9 });
        const crc = crc32(conteudo);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // versao minima para abrir
        local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
        local.writeUInt16LE(8, 8); // deflate
        local.writeUInt16LE(hora, 10);
        local.writeUInt16LE(data, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comprimido.length, 18);
        local.writeUInt32LE(conteudo.length, 22);
        local.writeUInt16LE(nomeEmBytes.length, 26);
        local.writeUInt16LE(0, 28);
        locais.push(local, nomeEmBytes, comprimido);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(hora, 12);
        central.writeUInt16LE(data, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(comprimido.length, 20);
        central.writeUInt32LE(conteudo.length, 24);
        central.writeUInt16LE(nomeEmBytes.length, 28);
        central.writeUInt32LE(posicao, 42);
        centrais.push(central, nomeEmBytes);
        posicao += local.length + nomeEmBytes.length + comprimido.length;
    }
    const diretorio = Buffer.concat(centrais);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(arquivos.length, 8);
    fim.writeUInt16LE(arquivos.length, 10);
    fim.writeUInt32LE(diretorio.length, 12);
    fim.writeUInt32LE(posicao, 16);
    return Buffer.concat([...locais, diretorio, fim]);
}

/** Os arquivos da pasta (menos o manifesto, que cada pacote monta do seu jeito), em ordem. */
const arquivos = fs.readdirSync(pasta)
    .filter(nome => nome !== 'manifest.json' && fs.statSync(path.join(pasta, nome)).isFile())
    .sort()
    .map(nome => ({ nome, conteudo: fs.readFileSync(path.join(pasta, nome)) }));

function empacotar(destino, ajustar) {
    const proprio = structuredClone(manifesto);
    ajustar(proprio);
    const conteudo = Buffer.from(JSON.stringify(proprio, null, 2) + '\n', 'utf8');
    const zip = montarZip([{ nome: 'manifest.json', conteudo }, ...arquivos]);
    fs.writeFileSync(path.join(raiz, destino), zip);
    console.log(`${destino}: versão ${proprio.version}, ${arquivos.length + 1} arquivos, ${(zip.length / 1024).toFixed(1)} KB`);
}

empacotar('extensao-firefox.zip', proprio => {
    delete proprio.background.service_worker;
});
empacotar('extensao-chrome.zip', proprio => {
    delete proprio.background.scripts;
    delete proprio.browser_specific_settings;
});
