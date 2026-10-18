// Painel dos administradores: acessos ao site, usuarios ativos e contas criadas, por dia e por mes. As rotas ficam
// no gerenciamento da Comunidade (api/_comunidade_rotas.js), que ja e so para admins.
//
// O que e guardado (nada de IP, navegador ou pagina visitada):
// - acessos_por_dia: quantas vezes o site foi aberto em cada dia (cada chamada a /api/inicio), com conta e sem conta;
// - atividade: em quais dias cada conta usou o site (uma linha por conta por dia), para contar os usuarios ativos.
// Os dias sao contados no horario de Brasilia.

/** Tabelas do painel, criadas junto com as outras (so acrescenta). */
export const ESTRUTURA_DO_PAINEL = `
    CREATE TABLE IF NOT EXISTS acessos_por_dia (dia DATE PRIMARY KEY, com_conta INT NOT NULL DEFAULT 0,
        sem_conta INT NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS atividade (conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, dia DATE NOT NULL,
        PRIMARY KEY (conta, dia));
    CREATE INDEX IF NOT EXISTS atividade_dia ON atividade (dia);
`;

/** O dia de hoje no horario de Brasilia, como o banco calcula. */
const HOJE = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

// quem ja foi marcado como ativo hoje nesta instancia da funcao: assim cada conta custa uma gravacao por dia, e nao
// uma por requisicao. Quem deixa o site aberto de um dia para o outro tambem conta no dia seguinte.
const marcadas = new Set();

/** Robos (buscadores, previas de link, navegadores automaticos) nao contam como acesso. */
export function ehRobo(userAgent) {
    return !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|curl|wget|python|node-fetch|axios/i.test(userAgent);
}

/** Conta uma abertura do site (e, com conta, marca a conta como ativa hoje). Nunca derruba a abertura do site. */
export async function registrarAcesso(db, contaId, userAgent) {
    if (ehRobo(userAgent)) return;
    // a conta ainda nao marcada hoje nesta instancia e marcada no mesmo comando do acesso: uma ida ao banco, e nao duas
    const chave = contaId ? contaId + '|' + diaDeHoje() : null;
    const marcar = Boolean(chave) && !marcadas.has(chave);
    try {
        await db.query(`
            WITH acesso AS (
                INSERT INTO acessos_por_dia (dia, com_conta, sem_conta) VALUES (${HOJE}, $1, $2)
                ON CONFLICT (dia) DO UPDATE SET com_conta = acessos_por_dia.com_conta + $1, sem_conta = acessos_por_dia.sem_conta + $2
            )
            INSERT INTO atividade (conta, dia) SELECT $3::uuid, ${HOJE} WHERE $3::uuid IS NOT NULL ON CONFLICT DO NOTHING`,
        [contaId ? 1 : 0, contaId ? 0 : 1, marcar ? contaId : null]);
        if (marcar) {
            if (marcadas.size > 5000) marcadas.clear();
            marcadas.add(chave);
        }
    } catch (erro) {
        console.error('Não deu para contar o acesso:', erro.message);
    }
}

/** "2026-10-17", no horario de Brasilia (o mesmo dia que o banco usa). */
export function diaDeHoje(agora = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Marca a conta como ativa hoje, se ainda nao foi marcada nesta instancia. Chamada em toda requisicao com login. */
export async function marcarAtividade(db, contaId) {
    const chave = contaId + '|' + diaDeHoje();
    if (marcadas.has(chave)) return;
    // so os de hoje ficam na memoria
    if (marcadas.size > 5000) marcadas.clear();
    marcadas.add(chave);
    try {
        await db.query(`INSERT INTO atividade (conta, dia) VALUES ($1, ${HOJE}) ON CONFLICT DO NOTHING`, [contaId]);
    } catch (erro) {
        marcadas.delete(chave);
        console.error('Não deu para marcar a atividade:', erro.message);
    }
}

/** Periodos que o painel aceita para os graficos por dia. */
export const PERIODOS = [7, 30, 90];

export function lerPeriodo(valor) {
    const dias = Number(valor);
    return PERIODOS.includes(dias) ? dias : 30;
}

/**
 * Preenche os dias sem nada com zero: o banco so devolve os dias que tem linha. dias: do mais antigo para hoje.
 * linhas: [{ dia: 'AAAA-MM-DD', ... }]. Devolve um item por dia, com os campos zerados quando faltam.
 */
export function completarDias(hoje, quantos, linhas, campos) {
    const porDia = new Map(linhas.map(linha => [linha.dia, linha]));
    const resultado = [];
    const base = new Date(hoje + 'T12:00:00Z');
    for (let i = quantos - 1; i >= 0; i--) {
        const dia = new Date(base.getTime() - i * 86_400_000).toISOString().slice(0, 10);
        const linha = porDia.get(dia) || {};
        resultado.push(Object.fromEntries([['dia', dia], ...campos.map(campo => [campo, Number(linha[campo]) || 0])]));
    }
    return resultado;
}

/** Os ultimos 12 meses ('AAAA-MM'), do mais antigo para o atual, com zero nos meses sem nada. */
export function completarMeses(hoje, linhas, campos) {
    const porMes = new Map(linhas.map(linha => [linha.mes, linha]));
    const [ano, mes] = hoje.split('-').map(Number);
    const resultado = [];
    for (let i = 11; i >= 0; i--) {
        const data = new Date(Date.UTC(ano, mes - 1 - i, 1));
        const chave = data.toISOString().slice(0, 7);
        const linha = porMes.get(chave) || {};
        resultado.push(Object.fromEntries([['mes', chave], ...campos.map(campo => [campo, Number(linha[campo]) || 0])]));
    }
    return resultado;
}

/**
 * Tudo o que o painel mostra: os numeros do mes (e do mes passado, para comparar), uma serie por dia do periodo
 * pedido e uma por mes dos ultimos 12 meses.
 */
export async function dadosDoPainel(db, periodo) {
    const { rows: [agora] } = await db.query(`SELECT to_char(${HOJE}, 'YYYY-MM-DD') AS hoje`);
    const hoje = agora.hoje;
    const consulta = (sql, valores = []) => db.query(sql, valores).then(resultado => resultado.rows);
    // inicio do mes atual e do mes passado, no horario de Brasilia
    const MES = `date_trunc('month', ${HOJE})::date`;
    const MES_PASSADO = `(date_trunc('month', ${HOJE}) - interval '1 month')::date`;
    const CRIADA = `(criada_em AT TIME ZONE 'America/Sao_Paulo')::date`;
    const [[numeros], porDia, ativosPorDia, contasPorDia, acessosPorMes, ativosPorMes, contasPorMes] = await Promise.all([
        consulta(`SELECT
            (SELECT count(*) FROM contas)::int AS contas,
            (SELECT count(*) FROM contas WHERE ${CRIADA} >= ${MES})::int AS contas_no_mes,
            (SELECT count(*) FROM contas WHERE ${CRIADA} >= ${MES_PASSADO} AND ${CRIADA} < ${MES})::int AS contas_no_mes_passado,
            (SELECT count(DISTINCT conta) FROM atividade WHERE dia >= ${MES})::int AS ativos_no_mes,
            (SELECT count(DISTINCT conta) FROM atividade WHERE dia >= ${MES_PASSADO} AND dia < ${MES})::int AS ativos_no_mes_passado,
            (SELECT count(DISTINCT conta) FROM atividade WHERE dia > ${HOJE} - 7)::int AS ativos_7_dias,
            (SELECT count(*) FROM atividade WHERE dia = ${HOJE})::int AS ativos_hoje,
            (SELECT coalesce(sum(com_conta + sem_conta), 0) FROM acessos_por_dia WHERE dia >= ${MES})::int AS acessos_no_mes,
            (SELECT coalesce(sum(com_conta + sem_conta), 0) FROM acessos_por_dia WHERE dia >= ${MES_PASSADO} AND dia < ${MES})::int AS acessos_no_mes_passado,
            (SELECT coalesce(sum(com_conta + sem_conta), 0) FROM acessos_por_dia WHERE dia = ${HOJE})::int AS acessos_hoje,
            (SELECT min(dia) FROM acessos_por_dia) AS contando_desde`),
        consulta(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, com_conta, sem_conta FROM acessos_por_dia WHERE dia > ${HOJE} - $1::int`, [periodo]),
        consulta(`SELECT to_char(dia, 'YYYY-MM-DD') AS dia, count(*)::int AS ativos FROM atividade WHERE dia > ${HOJE} - $1::int GROUP BY dia`, [periodo]),
        consulta(`SELECT to_char(${CRIADA}, 'YYYY-MM-DD') AS dia, count(*)::int AS contas FROM contas WHERE ${CRIADA} > ${HOJE} - $1::int GROUP BY 1`, [periodo]),
        consulta(`SELECT to_char(dia, 'YYYY-MM') AS mes, sum(com_conta + sem_conta)::int AS acessos FROM acessos_por_dia
            WHERE dia >= ${MES} - interval '11 months' GROUP BY 1`),
        consulta(`SELECT to_char(dia, 'YYYY-MM') AS mes, count(DISTINCT conta)::int AS ativos FROM atividade
            WHERE dia >= ${MES} - interval '11 months' GROUP BY 1`),
        consulta(`SELECT to_char(${CRIADA}, 'YYYY-MM') AS mes, count(*)::int AS contas FROM contas
            WHERE ${CRIADA} >= ${MES} - interval '11 months' GROUP BY 1`),
    ]);
    const juntarPorChave = (chave, ...listas) => {
        const juntas = new Map();
        for (const lista of listas) for (const linha of lista) juntas.set(linha[chave], { ...juntas.get(linha[chave]), ...linha });
        return [...juntas.values()];
    };
    return {
        hoje,
        periodo,
        contandoDesde: numeros.contando_desde ? new Date(numeros.contando_desde).toISOString().slice(0, 10) : null,
        numeros: {
            contas: numeros.contas,
            contasNoMes: numeros.contas_no_mes,
            contasNoMesPassado: numeros.contas_no_mes_passado,
            ativosNoMes: numeros.ativos_no_mes,
            ativosNoMesPassado: numeros.ativos_no_mes_passado,
            ativos7Dias: numeros.ativos_7_dias,
            ativosHoje: numeros.ativos_hoje,
            acessosNoMes: numeros.acessos_no_mes,
            acessosNoMesPassado: numeros.acessos_no_mes_passado,
            acessosHoje: numeros.acessos_hoje,
        },
        porDia: completarDias(hoje, periodo, juntarPorChave('dia', porDia, ativosPorDia, contasPorDia),
            ['com_conta', 'sem_conta', 'ativos', 'contas'])
            .map(({ dia, com_conta: comConta, sem_conta: semConta, ativos, contas }) => ({ dia, acessos: comConta + semConta, comConta, semConta, ativos, contas })),
        porMes: completarMeses(hoje, juntarPorChave('mes', acessosPorMes, ativosPorMes, contasPorMes), ['acessos', 'ativos', 'contas']),
    };
}
