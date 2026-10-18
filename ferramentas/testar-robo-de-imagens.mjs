// Passa as imagens de uma pasta pelo robo de imagens da Comunidade (o mesmo do site) e mostra o que ele faria com
// cada uma: se barraria e as notas de cada classe. Serve para conferir o robo com imagens que voce tem.
//
//   node ferramentas/testar-robo-de-imagens.mjs pasta/com/imagens
//
// As imagens so sao lidas aqui no computador: nada e enviado, copiado ou guardado. A saida tem so o nome do
// arquivo, a decisao e as notas. Le PNG, JPG, GIF e WEBP (de animados, o primeiro quadro), ate 2 MB como no site.
import fs from 'node:fs';
import path from 'node:path';
import { LIMITE_DA_OPENAI, LIMITE_DE_FOTO_EXPLICITA } from '../api/_moderacao.js';
import { verificarImagem } from '../api/_robo_de_imagens.js';

// a chave da OpenAI (OPENAI_API_KEY) pode estar no .env da raiz do projeto: com ela, o teste usa a OpenAI como o site
const arquivoEnv = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env');
if (!process.env.OPENAI_API_KEY && fs.existsSync(arquivoEnv)) process.loadEnvFile(arquivoEnv);

const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const pasta = process.argv[2];
if (!pasta || !fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory()) {
    console.error('Uso: node ferramentas/testar-robo-de-imagens.mjs pasta/com/imagens');
    process.exit(1);
}

const arquivos = fs.readdirSync(pasta).filter(nome => /\.(png|jpe?g|gif|webp)$/i.test(nome)).sort();
if (arquivos.length === 0) {
    console.error('Nenhuma imagem PNG, JPG, GIF ou WEBP nessa pasta.');
    process.exit(1);
}

const porcento = valor => String(Math.round((valor || 0) * 100)).padStart(3) + '%';
const comOpenAI = Boolean(process.env.OPENAI_API_KEY);
console.log(comOpenAI
    ? `Com a OpenAI: barra quando ela marca como sexual (ou a nota chega a ${Math.round(LIMITE_DA_OPENAI * 100)}%) e não é desenho.\n`
    : `Sem a chave da OpenAI (OPENAI_API_KEY): só o modelo local, que barra quando "foto explícita" chega a ${Math.round(LIMITE_DE_FOTO_EXPLICITA * 100)}% e passa desenho + desenho explícito.\n`);
console.log('decisão   quem     OpenAI  foto expl.  desenho  des. expl.  insinuante  neutra   arquivo');
const contagem = { barrada: 0, passa: 0, erro: 0 };
for (const nome of arquivos) {
    const bytes = fs.readFileSync(path.join(pasta, nome));
    if (bytes.length > TAMANHO_MAXIMO) {
        console.log(`grande    ${'-'.padStart(10)}  (mais de 2 MB: o site recusa antes do robô)   ${nome}`);
        continue;
    }
    try {
        const { permitida, probabilidades: p, fonte, openai } = await verificarImagem(bytes);
        contagem[permitida ? 'passa' : 'barrada']++;
        console.log(`${(permitida ? 'passa' : 'BARRADA').padEnd(8)}  ${fonte.padEnd(6)}  ${openai ? porcento(openai.sexual) : '   - '}  ${porcento(p.Porn).padStart(10)}  ${porcento(p.Drawing).padStart(7)}  ${porcento(p.Hentai).padStart(10)}  ${porcento(p.Sexy).padStart(10)}  ${porcento(p.Neutral).padStart(6)}   ${nome}`);
    } catch (erro) {
        contagem.erro++;
        console.log(`erro      não deu para ler a imagem (${erro.message.split('\n')[0]})   ${nome}`);
    }
}
console.log(`\n${contagem.barrada} barrada(s), ${contagem.passa} passaria(m), ${contagem.erro} com erro.`);
