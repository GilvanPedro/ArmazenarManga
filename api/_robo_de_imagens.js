// Robo que confere as imagens enviadas para a Comunidade antes de irem ao ar. Usa o NSFWJS (um classificador aberto,
// modelo MobileNetV2, que vem dentro do pacote) rodando aqui mesmo, sem servico externo: o sharp transforma a imagem
// em pixels e o TensorFlow.js da a nota de cada classe (Drawing, Hentai, Neutral, Porn, Sexy). Quem decide se barra e
// api/_moderacao.js. Ate o doc 88 era o MobileNetV2Mid, que deixava passar 4 de 5 imagens explicitas de teste: veja
// docs/88-robo-de-imagens-mais-rigoroso.md (a comparacao dos modelos, das capas e das fotos comuns).
import { createRequire } from 'node:module';
import path from 'node:path';
import { avaliarComOpenAI, avaliarImagem, lerModeracaoDaOpenAI } from './_moderacao.js';

const require = createRequire(import.meta.url);
const LADO = 224;

let carregando = null;

/** Carrega o TensorFlow e o modelo uma vez por instancia da funcao (a primeira imagem espera ~0,3 s a mais). */
function carregar() {
    carregando ??= (async () => {
        const tf = await import('@tensorflow/tfjs');
        tf.enableProdMode();
        // WebAssembly e ~15x mais rapido que o JavaScript puro (~85 ms por imagem); se falhar, fica o puro
        try {
            const wasm = await import('@tensorflow/tfjs-backend-wasm');
            wasm.setWasmPaths(path.join(path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')), 'dist') + path.sep);
            await tf.setBackend('wasm');
        } catch (erro) {
            console.error('Robo de imagens: sem WebAssembly, usando o processador em JavaScript', erro);
            await tf.setBackend('cpu');
        }
        await tf.ready();
        const { load } = await import('nsfwjs/core');
        const { MobileNetV2Model } = await import('nsfwjs/models/mobilenet_v2');
        const modelo = await load('MobileNetV2', { modelDefinitions: [MobileNetV2Model] });
        const { default: sharp } = await import('sharp');
        return { tf, modelo, sharp };
    })();
    // se o carregamento falhar, a proxima imagem tenta de novo
    carregando.catch(() => { carregando = null; });
    return carregando;
}

/** A nota (0 a 1) de cada classe para estes bytes (PNG, JPG, GIF ou WEBP; de GIF e WEBP animados, o primeiro quadro). */
export async function classificarImagem(bytes) {
    const { tf, modelo, sharp } = await carregar();
    const { data, info } = await sharp(bytes, { animated: false })
        .rotate()
        .removeAlpha()
        // a imagem inteira cabe no quadrado, com faixas pretas (esticar para o quadrado errava mais: doc 88)
        .resize(LADO, LADO, { fit: 'contain', background: '#000' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const imagem = tf.tensor3d(new Int32Array(data), [info.height, info.width, 3], 'int32');
    try {
        const notas = await modelo.classify(imagem, 5);
        return Object.fromEntries(notas.map(nota => [nota.className, Number(nota.probability.toFixed(4))]));
    } finally {
        imagem.dispose();
    }
}

/**
 * Pergunta para a moderacao da OpenAI (gratuita) se a imagem e sexual. A imagem vai diminuida (ate 512 px, JPEG) e
 * dentro do pedido; nada fica guardado aqui. Precisa da chave em OPENAI_API_KEY (no Vercel ou no .env); OPENAI_API
 * troca o endereco (para os testes). Demora demais (8 s) ou falha: sobe o erro, e quem chamou usa so o modelo local.
 */
export async function perguntarParaAOpenAI(bytes, { chave = process.env.OPENAI_API_KEY, fetch: buscar = fetch } = {}) {
    const { sharp } = await carregar();
    const jpeg = await sharp(bytes, { animated: false }).rotate().flatten({ background: '#fff' })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const resposta = await buscar((process.env.OPENAI_API || 'https://api.openai.com') + '/v1/moderations', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + chave, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + jpeg.toString('base64') } }] }),
        signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) throw new Error('Moderação da OpenAI respondeu ' + resposta.status);
    return lerModeracaoDaOpenAI(await resposta.json());
}

/**
 * { permitida, probabilidades, foto, fonte, openai } para estes bytes. O modelo local roda sempre (ele diz se e
 * desenho). Com a chave da OpenAI, quem decide e ela (fonte 'openai', doc 89); sem a chave ou com falha nela, decide
 * o modelo local (fonte 'local'), como antes. Erro ao ler ou classificar a imagem sobe para quem chamou.
 */
export async function verificarImagem(bytes, opcoes = {}) {
    // opcoes.classificar troca o modelo local (nos testes); opcoes.chave e opcoes.fetch, a OpenAI
    const probabilidades = await (opcoes.classificar || classificarImagem)(bytes);
    const chave = opcoes.chave ?? process.env.OPENAI_API_KEY;
    if (chave) {
        try {
            const openai = await perguntarParaAOpenAI(bytes, { ...opcoes, chave });
            const { barrar, sexual } = avaliarComOpenAI(probabilidades, openai);
            return { permitida: !barrar, probabilidades, foto: probabilidades.Porn || 0, fonte: 'openai', openai: { ...openai, sexual } };
        } catch (erro) {
            console.error('Robo de imagens: sem a moderacao da OpenAI agora, decide o modelo local', erro.message);
        }
    }
    const { barrar, foto } = avaliarImagem(probabilidades);
    return { permitida: !barrar, probabilidades, foto, fonte: 'local' };
}
