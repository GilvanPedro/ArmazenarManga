// Monta o site para o Vercel (o "buildCommand" do vercel.json), na pasta .saida-vercel:
//
//   node ferramentas/construir-site.mjs
//
// - copia src/main/resources/public como esta (imagens, capturas, sitemap, o arquivo do Google...);
// - compacta o app.js e o app.css (sem comentarios nem espacos, com o esbuild) e poe no nome um pedaco do hash do
//   conteudo (app-1a2b3c4d.js): o nome muda sempre que o arquivo muda, entao o navegador e a CDN podem guardar esses
//   arquivos por um ano (vercel.json) sem nunca servir uma versao velha;
// - troca no index.html os enderecos de app.js e app.css pelos novos.
//
// O codigo do projeto continua legivel em src/main/resources/public: so o que vai para o ar e compactado. A versao Java
// serve a pasta original, sem passar por aqui.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const origem = path.join(raiz, 'src/main/resources/public');
const saida = path.join(raiz, '.saida-vercel');

fs.rmSync(saida, { recursive: true, force: true });
fs.cpSync(origem, saida, { recursive: true });

const hash = texto => createHash('sha256').update(texto).digest('hex').slice(0, 10);
const relatorio = [];

async function compactar(arquivo, loader) {
    const original = fs.readFileSync(path.join(origem, arquivo), 'utf8');
    // o site roda direto no navegador (sem modulos): o esbuild so tira comentarios e espacos e encurta os nomes de
    // dentro das funcoes; os nomes de fora, que o resto do codigo usa, ficam. Navegadores de 2020 para ca
    const { code } = await transform(original, { loader, minify: true, target: loader === 'css' ? ['chrome90', 'firefox90', 'safari14'] : 'es2020', charset: 'utf8', legalComments: 'none' });
    const nome = arquivo.replace(/\.(js|css)$/, `-${hash(code)}.$1`);
    fs.writeFileSync(path.join(saida, nome), code);
    fs.rmSync(path.join(saida, arquivo));
    relatorio.push(`${arquivo} -> ${nome}: ${(original.length / 1024).toFixed(0)} KB -> ${(code.length / 1024).toFixed(0)} KB`);
    return nome;
}

const js = await compactar('app.js', 'js');
const css = await compactar('app.css', 'css');

const indice = path.join(saida, 'index.html');
let html = fs.readFileSync(indice, 'utf8');
const antes = html;
html = html.replace(/(<link rel="stylesheet" href=")app\.css(">)/, `$1${css}$2`).replace(/(<script src=")app\.js("><\/script>)/, `$1${js}$2`);
if (html === antes || html.includes('href="app.css"') || html.includes('src="app.js"')) {
    throw new Error('Nao achei <link href="app.css"> e <script src="app.js"> no index.html para trocar');
}
fs.writeFileSync(indice, html);

console.log(relatorio.join('\n'));
