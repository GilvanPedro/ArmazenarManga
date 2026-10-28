// Leva as imagens que ainda estao no banco para o Vercel Blob (docs 139 e 140), do mesmo jeito que as novas sao guardadas:
// conferidas, sem os metadados, em varias larguras, em AVIF e WebP, com a previa borrada. No banco ficam so os dados
// (o endereco, as medidas e o hash) e o conteudo e apagado. As miniaturas antigas das capas levadas saem tambem: as
// versoes pequenas agora vem do Blob. Os banners e as imagens e videos da loja vao como estao (doc 140).
//
// Uso (na pasta do projeto, com DATABASE_URL e BLOB_READ_WRITE_TOKEN no .env):
//   node ferramentas/migrar-imagens-para-blob.mjs --simular   so conta o que seria levado
//   node ferramentas/migrar-imagens-para-blob.mjs             leva
// Pode rodar de novo quantas vezes quiser: so pega o que ainda nao foi.

import { existsSync } from 'node:fs';

const env = new URL('../.env', import.meta.url);
if (existsSync(env)) process.loadEnvFile(env);
const simular = process.argv.includes('--simular');
const { default: pg } = await import('pg');
const { blobAtivo, guardarArquivoNoBlob, guardarNoBlob, prepararImagem } = await import('../api/_imagens.js');
const { otimizarImagemDoBanner } = await import('../api/_banners.js');
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL no .env');
if (!simular && !blobAtivo()) throw new Error('Falta BLOB_READ_WRITE_TOKEN no .env (o painel da Vercel mostra a chave do Blob Store)');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const mb = bytes => (bytes / 1024 / 1024).toFixed(1) + ' MB';
const tabelas = [
    { tabela: 'imagens', pasta: 'capas', tipo: 'capa', onde: "conteudo IS NOT NULL AND url IS NULL AND nome NOT LIKE '%-mini.%'" },
    { tabela: 'imagens_da_comunidade', pasta: 'comunidade', tipo: 'post', onde: 'conteudo IS NOT NULL AND url IS NULL' },
];
let levadas = 0;
let falhas = 0;
let antes = 0;
let depois = 0;
for (const { tabela, pasta, tipo, onde } of tabelas) {
    const { rows: [{ quantas, total }] } = await db.query(`SELECT count(*)::int AS quantas, coalesce(sum(length(conteudo)), 0)::bigint AS total FROM ${tabela} WHERE ${onde}`);
    console.log(`${tabela}: ${quantas} imagens no banco (${mb(Number(total))})`);
    if (simular || quantas === 0) continue;
    // uma por vez: cada uma vira ate seis arquivos (tres larguras, dois formatos)
    const { rows: nomes } = await db.query(`SELECT nome FROM ${tabela} WHERE ${onde} ORDER BY nome`);
    for (const [i, { nome }] of nomes.entries()) {
        try {
            const { rows: [linha] } = await db.query(`SELECT conteudo FROM ${tabela} WHERE nome = $1`, [nome]);
            const guardada = await guardarNoBlob(pasta, await prepararImagem(linha.conteudo, tipo));
            await db.query(`UPDATE ${tabela} SET url = $2, variantes = $3, placeholder = $4, largura = $5, altura = $6, hash = $7, tamanho = $8, conteudo = NULL
                WHERE nome = $1`, [nome, guardada.url, JSON.stringify(guardada.variantes), guardada.placeholder, guardada.largura, guardada.altura, guardada.hash, guardada.tamanho]);
            antes += linha.conteudo.length;
            depois += guardada.tamanho;
            levadas++;
            console.log(`  ${i + 1}/${nomes.length} ${nome}: ${mb(linha.conteudo.length)} -> ${guardada.variantes.length} arquivos (${mb(guardada.tamanho)} somados)`);
        } catch (erro) {
            falhas++;
            console.log(`  ${i + 1}/${nomes.length} ${nome}: ficou no banco (${erro.message})`);
        }
    }
}
// os banners (doc 140): otimizados (se ainda nao foram) e levados como estao
{
    const { rows: [{ quantas }] } = await db.query('SELECT count(*)::int AS quantas FROM imagens_de_banner WHERE imagem IS NOT NULL AND url IS NULL');
    console.log(`imagens_de_banner: ${quantas} imagens no banco`);
    if (!simular && quantas) {
        const { rows } = await db.query('SELECT banner, formato, imagem, tipo, otimizada FROM imagens_de_banner WHERE imagem IS NOT NULL AND url IS NULL');
        for (const linha of rows) {
            try {
                const { bytes, tipo } = linha.otimizada ? { bytes: linha.imagem, tipo: linha.tipo } : await otimizarImagemDoBanner(linha.imagem, linha.tipo, linha.formato);
                const url = await guardarArquivoNoBlob('banners', linha.formato + '.' + tipo.split('/')[1], bytes, tipo);
                await db.query('UPDATE imagens_de_banner SET url = $3, imagem = NULL, tipo = $4, otimizada = true WHERE banner = $1 AND formato = $2', [linha.banner, linha.formato, url, tipo]);
                antes += linha.imagem.length;
                depois += bytes.length;
                levadas++;
                console.log(`  banner ${linha.banner} (${linha.formato}): levado`);
            } catch (erro) {
                falhas++;
                console.log(`  banner ${linha.banner} (${linha.formato}): ficou no banco (${erro.message})`);
            }
        }
    }
}
// as imagens e videos da loja (doc 140): como o dono enviou, com o mesmo nome
{
    const { rows: [{ quantas, total }] } = await db.query('SELECT count(*)::int AS quantas, coalesce(sum(length(conteudo)), 0)::bigint AS total FROM imagens_da_loja WHERE conteudo IS NOT NULL AND url IS NULL');
    console.log(`imagens_da_loja: ${quantas} arquivos no banco (${mb(Number(total))})`);
    if (!simular && quantas) {
        const { rows: nomes } = await db.query('SELECT nome FROM imagens_da_loja WHERE conteudo IS NOT NULL AND url IS NULL ORDER BY nome');
        for (const { nome } of nomes) {
            try {
                const { rows: [linha] } = await db.query('SELECT conteudo, tipo FROM imagens_da_loja WHERE nome = $1', [nome]);
                const url = await guardarArquivoNoBlob('loja', nome, linha.conteudo, linha.tipo);
                await db.query('UPDATE imagens_da_loja SET url = $2, conteudo = NULL WHERE nome = $1', [nome, url]);
                antes += linha.conteudo.length;
                depois += linha.conteudo.length;
                levadas++;
                console.log(`  loja ${nome}: levado (${mb(linha.conteudo.length)})`);
            } catch (erro) {
                falhas++;
                console.log(`  loja ${nome}: ficou no banco (${erro.message})`);
            }
        }
    }
}
if (!simular) {
    // as miniaturas feitas pelo navegador, das capas que ja estao no Blob
    const { rowCount } = await db.query(`DELETE FROM imagens m WHERE m.nome LIKE '%-mini.%' AND EXISTS (
        SELECT 1 FROM imagens c WHERE c.conta = m.conta AND c.url IS NOT NULL AND c.nome LIKE split_part(m.nome, '-mini.', 1) || '.%')`);
    console.log(`\n${levadas} imagens levadas para o Blob, ${falhas} ficaram no banco; ${rowCount} miniaturas antigas apagadas.`);
    if (levadas) console.log(`Tamanho: ${mb(antes)} no banco -> ${mb(depois)} no Blob, somando todas as larguras e formatos.`);
    console.log('O espaço do banco é liberado aos poucos pelo próprio Postgres (ou na hora, com VACUUM FULL nas duas tabelas).');
}
await db.end();
