// Passa para uma conta todos os mangas (e capas) de antes das contas existirem, e marca essa conta como admin.
// Faz o mesmo que o botao "Trazer para esta conta" da pagina Minha conta, mas sem precisar da senha antiga.
//
//   node ferramentas/passar-mangas-para-conta.mjs email@exemplo.com              -> so mostra o que seria feito
//   node ferramentas/passar-mangas-para-conta.mjs email@exemplo.com --confirmar  -> faz a transferencia
//
// Usa o banco de DATABASE_URL (variavel de ambiente ou arquivo .env na raiz do projeto). A conta precisa existir:
// crie-a no site antes.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const CONTA_ANTIGA = 'principal';
const raiz = path.resolve(import.meta.dirname, '..');
const email = (process.argv.slice(2).find(argumento => !argumento.startsWith('--')) || '').trim().toLowerCase();
const confirmar = process.argv.includes('--confirmar');

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

function parar(mensagem) {
    console.error(mensagem);
    process.exit(1);
}

if (!email.includes('@')) parar('Informe o e-mail da conta: node ferramentas/passar-mangas-para-conta.mjs email@exemplo.com');
const enderecoDoBanco = (process.env.DATABASE_URL || lerEnv().DATABASE_URL || '').trim();
if (!enderecoDoBanco) parar('Falta DATABASE_URL: coloque o endereço do banco no arquivo .env da raiz do projeto.');

const banco = new pg.Client({ connectionString: enderecoDoBanco });
await banco.connect();
try {
    const { rows: tabela } = await banco.query("SELECT to_regclass('contas') AS contas, (SELECT count(*) FROM information_schema.columns WHERE table_name = 'mangas' AND column_name = 'conta') AS coluna");
    if (!tabela[0].contas || Number(tabela[0].coluna) === 0) {
        parar('O banco ainda não tem contas. Publique a versão com contas e abra o site uma vez antes.');
    }
    const { rows: contas } = await banco.query('SELECT id, nick, admin FROM contas WHERE email = $1', [email]);
    if (contas.length === 0) parar(`Não existe conta com o e-mail ${email}. Crie a conta no site antes.`);
    const conta = contas[0];
    const contar = async (tabela, dono) => Number((await banco.query(`SELECT count(*) FROM ${tabela} WHERE conta = $1`, [dono])).rows[0].count);
    const antigos = await contar('mangas', CONTA_ANTIGA);
    const capas = await contar('imagens', CONTA_ANTIGA);
    console.log(`Conta: ${conta.nick} (${email})${conta.admin ? ', já é admin' : ''}`);
    console.log(`Mangás que ela já tem: ${await contar('mangas', conta.id)}`);
    console.log(`Mangás de antes das contas: ${antigos} (com ${capas} imagens enviadas)`);
    if (!confirmar) {
        console.log('\nNada foi alterado. Para fazer a transferência, rode de novo com --confirmar no fim.');
    } else {
        await banco.query('BEGIN');
        const mangas = await banco.query('UPDATE mangas SET conta = $1 WHERE conta = $2', [conta.id, CONTA_ANTIGA]);
        const imagens = await banco.query('UPDATE imagens SET conta = $1 WHERE conta = $2', [conta.id, CONTA_ANTIGA]);
        await banco.query('UPDATE contas SET admin = true WHERE id = $1', [conta.id]);
        await banco.query('COMMIT');
        console.log(`\nFeito: ${mangas.rowCount} mangás e ${imagens.rowCount} imagens passaram para a conta, que agora é admin.`);
        console.log(`Mangás na conta agora: ${await contar('mangas', conta.id)}`);
    }
} catch (erro) {
    await banco.query('ROLLBACK').catch(() => {});
    parar('Erro: ' + erro.message);
} finally {
    await banco.end();
}
