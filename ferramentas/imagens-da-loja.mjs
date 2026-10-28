// Guarda, lista e apaga as imagens e videos dos itens da loja (como a moldura da borda Celestial), direto do seu
// computador. O arquivo vai para o Vercel Blob e o banco guarda so o endereco (docs 140 e 141). O site so serve essas imagens (/api/loja/imagens/{nome}); nao ha tela no site para envia-las.
//
//   node ferramentas/imagens-da-loja.mjs listar
//   node ferramentas/imagens-da-loja.mjs enviar caminho/da/imagem.webp [nome.webp]
//   node ferramentas/imagens-da-loja.mjs apagar nome.webp
//
// A outra forma de enviar e a aba Imagens da loja do Gerenciar (so o dono do site). A conferencia da imagem e a mesma
// do servidor (conferirImagemDaLoja, em api/_loja.js).
//
// O endereco do banco vem de DATABASE_URL: da variavel de ambiente ou de um arquivo .env na raiz do projeto (que o
// .gitignore deixa fora do GitHub), com a linha DATABASE_URL=postgres://... (o endereco do Neon, o mesmo do Vercel).
// Enviar com um nome que ja existe troca a imagem; o site mostra a nova em ate uma hora (a CDN guarda por uma hora).
// Precisa da chave do Vercel Blob no .env (BLOB_READ_WRITE_TOKEN): sem ela, enviar e recusado.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { conferirImagemDaLoja } from '../api/_loja.js';
import { apagarDoBlob, exigirBlob, guardarArquivoNoBlob } from '../api/_imagens.js';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arquivoEnv = path.join(raiz, '.env');
// o que ja esta no ambiente vale mais que o .env (o .env so completa: o banco e a chave do Blob)
if (fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

async function principal() {
    const [comando, ...resto] = process.argv.slice(2);
    if (!['listar', 'enviar', 'apagar'].includes(comando)) {
        console.log('Uso:\n  node ferramentas/imagens-da-loja.mjs listar\n  node ferramentas/imagens-da-loja.mjs enviar caminho/da/imagem.webp [nome.webp]\n  node ferramentas/imagens-da-loja.mjs apagar nome.webp');
        process.exit(comando ? 1 : 0);
    }
    if (!process.env.DATABASE_URL) {
        console.error('Falta o endereço do banco: crie o arquivo .env na raiz do projeto com a linha DATABASE_URL=postgres://... (o mesmo do Vercel).');
        process.exit(1);
    }
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
        if (comando === 'listar') {
            const { rows } = await db.query('SELECT nome, tipo, tamanho, atualizada_em FROM imagens_da_loja ORDER BY nome');
            if (!rows.length) console.log('Nenhuma imagem guardada.');
            for (const linha of rows) {
                console.log(`${linha.nome.padEnd(30)} ${linha.tipo.padEnd(11)} ${(linha.tamanho / 1024).toFixed(1).padStart(7)} KB   ${new Date(linha.atualizada_em).toLocaleString('pt-BR')}`);
            }
        } else if (comando === 'enviar') {
            const [caminho, nomeEscolhido] = resto;
            if (!caminho) throw new Error('Diga o arquivo: node ferramentas/imagens-da-loja.mjs enviar caminho/da/imagem.webp');
            const bytes = fs.readFileSync(caminho);
            const nome = nomeEscolhido || path.basename(caminho).toLowerCase();
            const tipo = conferirImagemDaLoja(nome, bytes);
            exigirBlob();
            const url = await guardarArquivoNoBlob('loja', nome, bytes, tipo);
            const { rows: antes } = await db.query('SELECT url FROM imagens_da_loja WHERE nome = $1', [nome]);
            await db.query(`INSERT INTO imagens_da_loja (nome, tipo, tamanho, url) VALUES ($1, $2, $3, $4)
                ON CONFLICT (nome) DO UPDATE SET tipo = $2, tamanho = $3, url = $4, atualizada_em = now()`, [nome, tipo, bytes.length, url]);
            if (antes[0]?.url && antes[0].url !== url) await apagarDoBlob([{ url: antes[0].url }]);
            console.log(`Guardada no Blob: ${nome} (${tipo}, ${(bytes.length / 1024).toFixed(1)} KB). No site: /api/loja/imagens/${nome}`);
        } else {
            const [nome] = resto;
            const { rows: apagada } = await db.query('DELETE FROM imagens_da_loja WHERE nome = $1 RETURNING url', [nome]);
            await apagarDoBlob(apagada);
            console.log(apagada.length ? `Apagada: ${nome}` : `Não existe: ${nome}`);
        }
    } finally {
        await db.end();
    }
}

principal().catch(erro => {
    console.error('Erro:', erro.message);
    process.exit(1);
});
