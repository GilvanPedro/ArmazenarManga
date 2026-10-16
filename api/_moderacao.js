// Regras da moderacao da Comunidade: suspensoes, banimentos, o registro do que os admins (e o robo de imagens)
// fizeram, e quando uma imagem e barrada. As rotas ficam em api/_comunidade_rotas.js.
import { randomUUID } from 'node:crypto';

/** Colunas e tabela da moderacao, criadas junto com as da Comunidade. */
export const ESTRUTURA_DA_MODERACAO = `
    -- punicao: 'suspensa' (ate punida_ate) ou 'banida' (ate um admin tirar); nula quando a conta esta livre
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS punicao TEXT;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS punida_ate TIMESTAMPTZ;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS punicao_motivo TEXT;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS punida_por UUID;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS punida_em TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS contas_punidas ON contas (punicao) WHERE punicao IS NOT NULL;
    -- o registro: o que cada admin fez e as imagens que o robo barrou (a imagem barrada nao e guardada)
    CREATE TABLE IF NOT EXISTS moderacao (id UUID PRIMARY KEY, conta UUID REFERENCES contas(id) ON DELETE CASCADE,
        admin UUID REFERENCES contas(id) ON DELETE SET NULL, acao TEXT NOT NULL, motivo TEXT NOT NULL DEFAULT '',
        detalhes JSONB, criada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS moderacao_criada ON moderacao (criada_em DESC);
    CREATE INDEX IF NOT EXISTS moderacao_conta ON moderacao (conta, criada_em DESC);
`;

/**
 * Guarda uma linha no registro. acao: suspender, banir, tirar_suspensao, desbanir, apagar_post, apagar_comentario ou
 * imagem_barrada (feita pelo robo: admin nulo).
 */
export async function registrarNaModeracao(db, { conta, admin = null, acao, motivo = '', detalhes = null }) {
    await db.query('INSERT INTO moderacao (id, conta, admin, acao, motivo, detalhes) VALUES ($1, $2, $3, $4, $5, $6)',
        [randomUUID(), conta, admin, acao, motivo, detalhes ? JSON.stringify(detalhes) : null]);
}

export const MOTIVO_MAXIMO = 300;
/** Suspensao: de 1 hora a 1 ano. */
export const HORAS_MINIMAS = 1;
export const HORAS_MAXIMAS = 24 * 365;

export class DadoInvalidoNaModeracao extends Error {}

/** { horas, motivo } de uma suspensao, conferidos. */
export function validarSuspensao(dados) {
    const horas = Number(dados?.horas);
    if (!Number.isInteger(horas) || horas < HORAS_MINIMAS || horas > HORAS_MAXIMAS) {
        throw new DadoInvalidoNaModeracao('Escolha uma suspensão de 1 hora a 1 ano');
    }
    return { horas, motivo: validarMotivo(dados.motivo) };
}

/** O motivo e opcional, mas ajuda quem foi punido a entender. */
export function validarMotivo(motivo) {
    if (motivo == null) return '';
    if (typeof motivo !== 'string') throw new DadoInvalidoNaModeracao('Motivo inválido');
    const limpo = motivo.trim().replace(/\s+/g, ' ');
    if ([...limpo].length > MOTIVO_MAXIMO) throw new DadoInvalidoNaModeracao(`O motivo pode ter no máximo ${MOTIVO_MAXIMO} caracteres`);
    return limpo;
}

/**
 * A punicao que vale agora para uma linha de "contas" (punicao, punida_ate, punicao_motivo): null, ou
 * { tipo: 'suspensa', ate, motivo } ou { tipo: 'banida', motivo }. Suspensao vencida nao vale mais.
 */
export function situacaoDaConta(linha, agora = new Date()) {
    if (!linha || !linha.punicao) return null;
    if (linha.punicao === 'banida') return { tipo: 'banida', motivo: linha.punicao_motivo || '' };
    if (linha.punicao === 'suspensa' && linha.punida_ate && new Date(linha.punida_ate) > agora) {
        return { tipo: 'suspensa', ate: new Date(linha.punida_ate).toISOString(), motivo: linha.punicao_motivo || '' };
    }
    return null;
}

/** "18/10/2026 às 14:30", no horario de Brasilia. */
export function dataEHora(quando) {
    const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(quando));
    const parte = tipo => partes.find(item => item.type === tipo).value;
    return `${parte('day')}/${parte('month')}/${parte('year')} às ${parte('hour')}:${parte('minute')}`;
}

/** O que quem esta punido le ao tentar publicar ou comentar. */
export function mensagemDaPunicao(situacao) {
    const motivo = situacao.motivo ? ` Motivo: ${situacao.motivo}` : '';
    if (situacao.tipo === 'banida') {
        return `Sua conta foi banida da Comunidade e não pode publicar nem comentar até um administrador tirar o banimento.${motivo}`;
    }
    return `Sua conta está suspensa até ${dataEHora(situacao.ate)} (horário de Brasília) e não pode publicar nem comentar até lá.${motivo}`;
}

// ------------------------------------------------------------------ robo de imagens

/**
 * Quando o robo barra uma imagem. So conta foto explicita de pessoa de verdade (a classe "Porn" do modelo): desenho e
 * arte (inclusive capas de manga, mesmo as mais ousadas, e desenho explicito, classe "Hentai") e foto apenas
 * insinuante ("Sexy") passam. Para nao confundir arte com foto, "Porn" precisa ser alta e maior que as duas classes
 * de desenho somadas.
 */
export const LIMITE_DE_FOTO_EXPLICITA = 0.7;

export function avaliarImagem(probabilidades) {
    const valor = nome => Number(probabilidades?.[nome]) || 0;
    const foto = valor('Porn');
    const desenho = valor('Drawing') + valor('Hentai');
    const barrar = foto >= LIMITE_DE_FOTO_EXPLICITA && foto > desenho;
    return { barrar, foto, desenho };
}

export const MENSAGEM_DE_IMAGEM_BARRADA = 'Essa imagem parece ser uma foto com conteúdo sexual explícito e não pode ser usada na Comunidade. '
    + 'Arte e capas de mangá são permitidas. Se achar que foi um engano, fale com um administrador.';
