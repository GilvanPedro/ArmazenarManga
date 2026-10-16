// Robo que confere as imagens enviadas para a Comunidade antes de irem ao ar. Usa o NSFWJS (um classificador aberto,
// modelo MobileNetV2Mid, que vem dentro do pacote) rodando aqui mesmo, sem servico externo: o sharp transforma a
// imagem em pixels e o TensorFlow.js da a nota de cada classe (Drawing, Hentai, Neutral, Porn, Sexy). Quem decide se
// barra e api/_moderacao.js (so foto explicita de pessoa de verdade).
import { createRequire } from 'node:module';
import path from 'node:path';
import { avaliarImagem } from './_moderacao.js';

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
        const { MobileNetV2MidModel } = await import('nsfwjs/models/mobilenet_v2_mid');
        const modelo = await load('MobileNetV2Mid', { modelDefinitions: [MobileNetV2MidModel] });
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
        .resize(LADO, LADO, { fit: 'fill' })
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

/** { permitida, probabilidades, foto } para estes bytes. Erro ao ler ou classificar sobe para quem chamou. */
export async function verificarImagem(bytes) {
    const probabilidades = await classificarImagem(bytes);
    const { barrar, foto } = avaliarImagem(probabilidades);
    return { permitida: !barrar, probabilidades, foto };
}
