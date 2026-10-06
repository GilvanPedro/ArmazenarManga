// Salva em um arquivo o nome de cada manga com as tags atuais dele e, se pedido, apaga as tags de todos.
//
//   node ferramentas/salvar-e-limpar-tags.mjs            -> so salva a lista (nao muda nada no banco)
//   node ferramentas/salvar-e-limpar-tags.mjs --apagar   -> salva a lista e depois apaga as tags
//
// Usa o banco de DATABASE_URL (variavel de ambiente ou arquivo .env na raiz do projeto).
// Sem DATABASE_URL, usa o arquivo local ~/.mangatracker/mangas.json.
// A lista vai para a pasta Downloads, em dois arquivos: um .txt para ler e um .json com tudo para restaurar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const apagar = process.argv.includes('--apagar');
const raiz = path.resolve(import.meta.dirname, '..');

function lerEnv() {
    const arquivo = path.join(raiz, '.env');
    if (!fs.existsSync(arquivo)) return {};
    const valores = {};
    for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
        const achado = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (achado) valores[achado[1]] = achado[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return valores;
}

const enderecoDoBanco = (process.env.DATABASE_URL || lerEnv().DATABASE_URL || '').trim();
const pastaLocal = process.env.MANGATRACKER_DIR || lerEnv().MANGATRACKER_DIR || path.join(os.homedir(), '.mangatracker');
const arquivoLocal = path.join(pastaLocal, 'mangas.json');
const downloads = process.env.PASTA_DE_SAIDA || path.join(os.homedir(), 'Downloads');

/** Nome de arquivo que ainda nao existe, para nunca escrever por cima de uma lista salva antes. */
function arquivoNovo(extensao) {
    const agora = new Date();
    const dois = n => String(n).padStart(2, '0');
    const data = `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
    for (let i = 1; ; i++) {
        const nome = path.join(downloads, `tags-dos-mangas-${data}${i === 1 ? '' : '-' + i}.${extensao}`);
        if (!fs.existsSync(nome) && !fs.existsSync(nome.replace(/\.[a-z]+$/, extensao === 'txt' ? '.json' : '.txt'))) return nome;
    }
}

function salvarLista(mangas, origem) {
    const comTags = mangas.filter(manga => (manga.tags || []).length > 0);
    const txt = arquivoNovo('txt');
    const json = txt.replace(/\.txt$/, '.json');
    const linhas = [
        `Tags dos mangás, salvas em ${new Date().toLocaleString('pt-BR')}`,
        `Origem: ${origem}`,
        `${mangas.length} mangás no total, ${comTags.length} com tags`,
        '',
        ...mangas.map(manga => `${manga.title}\n    ${(manga.tags || []).length ? manga.tags.join(', ') : '(sem tags)'}\n`),
    ];
    fs.writeFileSync(txt, linhas.join('\n'), { flag: 'wx' });
    fs.writeFileSync(json, JSON.stringify(mangas.map(manga => ({ id: manga.id, title: manga.title, tags: manga.tags || [] })), null, 2), { flag: 'wx' });
    // confere o que ficou gravado antes de qualquer coisa ser apagada
    const gravado = JSON.parse(fs.readFileSync(json, 'utf8'));
    if (gravado.length !== mangas.length || gravado.some((manga, i) => manga.tags.length !== (mangas[i].tags || []).length)) {
        throw new Error('A lista gravada nao confere com os dados. Nada foi apagado.');
    }
    console.log(`Lista salva:\n  ${txt}\n  ${json}`);
    console.log(`  ${mangas.length} mangás, ${comTags.length} com tags, ${comTags.reduce((soma, manga) => soma + manga.tags.length, 0)} tags no total`);
    return comTags.length;
}

if (enderecoDoBanco) {
    const banco = new pg.Client({ connectionString: enderecoDoBanco });
    await banco.connect();
    try {
        const { rows } = await banco.query('SELECT dados FROM mangas ORDER BY ordem');
        const comTags = salvarLista(rows.map(linha => linha.dados), 'banco de dados (' + new URL(enderecoDoBanco).hostname + ')');
        if (!apagar) {
            console.log('Nada foi alterado no banco. Para apagar as tags, rode de novo com --apagar.');
        } else {
            // tudo ou nada: se falhar no meio, nenhum manga fica alterado
            await banco.query('BEGIN');
            const { rowCount } = await banco.query(`UPDATE mangas SET dados = jsonb_set(dados, '{tags}', '[]'::jsonb) WHERE jsonb_array_length(COALESCE(dados->'tags', '[]'::jsonb)) > 0`);
            if (rowCount !== comTags) {
                await banco.query('ROLLBACK');
                throw new Error(`Esperava alterar ${comTags} mangás, mas seriam ${rowCount}. Nada foi apagado.`);
            }
            await banco.query('COMMIT');
            const { rows: resto } = await banco.query(`SELECT count(*)::int AS n FROM mangas WHERE jsonb_array_length(COALESCE(dados->'tags', '[]'::jsonb)) > 0`);
            console.log(`Tags apagadas de ${rowCount} mangás. Mangás que ainda têm tags: ${resto[0].n}.`);
        }
    } finally {
        await banco.end();
    }
} else if (fs.existsSync(arquivoLocal)) {
    const mangas = JSON.parse(fs.readFileSync(arquivoLocal, 'utf8'));
    const comTags = salvarLista(mangas, arquivoLocal);
    if (!apagar) {
        console.log('Nada foi alterado. Para apagar as tags, rode de novo com --apagar.');
    } else {
        fs.writeFileSync(arquivoLocal + '.tmp', JSON.stringify(mangas.map(manga => ({ ...manga, tags: [] })), null, 2));
        fs.renameSync(arquivoLocal + '.tmp', arquivoLocal);
        console.log(`Tags apagadas de ${comTags} mangás em ${arquivoLocal}. Feche e abra o programa para ele ler o arquivo de novo.`);
    }
} else {
    console.error('Nao encontrei os dados: defina DATABASE_URL (no arquivo .env) ou tenha o arquivo ' + arquivoLocal);
    process.exit(1);
}
