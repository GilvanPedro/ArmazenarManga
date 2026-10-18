// Guarda, lista e apaga as imagens dos itens da loja (como a moldura da borda Celestial) no banco, direto do seu
// computador. O site so serve essas imagens (/api/loja/imagens/{nome}); nao ha tela no site para envia-las.
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
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { conferirImagemDaLoja } from '../api/_loja.js';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arquivoEnv = path.join(raiz, '.env');
if (!process.env.DATABASE_URL && fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

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
            await db.query(`INSERT INTO imagens_da_loja (nome, conteudo, tipo, tamanho) VALUES ($1, $2, $3, $4)
                ON CONFLICT (nome) DO UPDATE SET conteudo = $2, tipo = $3, tamanho = $4, atualizada_em = now()`, [nome, bytes, tipo, bytes.length]);
            console.log(`Guardada: ${nome} (${tipo}, ${(bytes.length / 1024).toFixed(1)} KB). No site: /api/loja/imagens/${nome}`);
        } else {
            const [nome] = resto;
            const { rowCount } = await db.query('DELETE FROM imagens_da_loja WHERE nome = $1', [nome]);
            console.log(rowCount ? `Apagada: ${nome}` : `Não existe: ${nome}`);
        }
    } finally {
        await db.end();
    }
}

principal().catch(erro => {
    console.error('Erro:', erro.message);
    process.exit(1);
});
