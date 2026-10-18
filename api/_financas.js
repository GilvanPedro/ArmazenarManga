// Financas do site (aba Financas do Gerenciar, so admins): os gastos (Claude, Vercel, Neon...) e as receitas cadastrados
// a mao, mensais ou de uma vez so (como um anuncio), mais as vendas da loja, que entram sozinhas. Tudo em centavos de
// real; os meses sao 'AAAA-MM' no horario de Brasilia.
import { randomUUID } from 'node:crypto';
import { itemDaLoja } from './_loja.js';

/** Tabela dos lancamentos, criada junto com as outras (so acrescenta). */
export const ESTRUTURA_DAS_FINANCAS = `
    -- tipo: gasto ou receita. recorrencia: mensal (vale de inicio ate fim, inclusive; fim nulo = sem data para acabar)
    -- ou unica (vale so no mes de inicio). inicio e fim sao o primeiro dia do mes; na unica, inicio e o dia exato
    CREATE TABLE IF NOT EXISTS financas (id UUID PRIMARY KEY, tipo TEXT NOT NULL, nome TEXT NOT NULL, valor INT NOT NULL,
        recorrencia TEXT NOT NULL, inicio DATE NOT NULL, fim DATE, criado_em TIMESTAMPTZ NOT NULL DEFAULT now());
    -- a receita que vem de um banner de anuncio (o id dele): e mexida pelo cadastro do banner, e nao aqui
    ALTER TABLE financas ADD COLUMN IF NOT EXISTS banner TEXT;
`;

export class DadoInvalidoNasFinancas extends Error {}

export const VALOR_MAXIMO = 100_000_000; // R$ 1 milhao, em centavos
export const NOME_MAXIMO = 60;

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DIA = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** 'AAAA-MM' valido (de 2020 a 2100), ou erro. */
export function lerMes(valor, campo = 'mês') {
    const texto = String(valor ?? '');
    const achado = MES.exec(texto);
    if (!achado || Number(achado[1]) < 2020 || Number(achado[1]) > 2100) throw new DadoInvalidoNasFinancas(`Escolha um ${campo} válido`);
    return texto;
}

/** O mes seguinte ou anterior: somarMeses('2026-12', 1) = '2027-01'. */
export function somarMeses(mes, quantos) {
    const [ano, numero] = mes.split('-').map(Number);
    const data = new Date(Date.UTC(ano, numero - 1 + quantos, 1));
    return data.toISOString().slice(0, 7);
}

/** Valor em centavos: inteiro de 1 centavo a R$ 1 milhao. */
export function lerValor(valor) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 1 || numero > VALOR_MAXIMO) throw new DadoInvalidoNasFinancas('Informe um valor entre R$ 0,01 e R$ 1.000.000,00');
    return numero;
}

/**
 * Um lancamento novo, conferido: { tipo, nome, valor, recorrencia, inicio, fim }. Mensal: inicio e o mes ('AAAA-MM')
 * e fim e opcional; unica: inicio e o dia ('AAAA-MM-DD') ou o mes (vira o dia 1).
 */
export function validarLancamento(dados) {
    if (!dados || typeof dados !== 'object') throw new DadoInvalidoNasFinancas('Dados inválidos');
    if (!['gasto', 'receita'].includes(dados.tipo)) throw new DadoInvalidoNasFinancas('Escolha se é um gasto ou uma receita');
    if (!['mensal', 'unica'].includes(dados.recorrencia)) throw new DadoInvalidoNasFinancas('Escolha se é mensal ou de uma vez só');
    const nome = typeof dados.nome === 'string' ? dados.nome.trim().replace(/\s+/g, ' ') : '';
    if (!nome) throw new DadoInvalidoNasFinancas('Dê um nome, como "Vercel" ou "Anúncio da loja X"');
    if ([...nome].length > NOME_MAXIMO) throw new DadoInvalidoNasFinancas(`O nome pode ter no máximo ${NOME_MAXIMO} caracteres`);
    const valor = lerValor(dados.valor);
    let inicio;
    let fim = null;
    if (dados.recorrencia === 'mensal') {
        inicio = lerMes(dados.inicio, 'mês de início') + '-01';
        if (dados.fim != null && dados.fim !== '') {
            fim = lerMes(dados.fim, 'último mês') + '-01';
            if (fim < inicio) throw new DadoInvalidoNasFinancas('O último mês não pode ser antes do primeiro');
        }
    } else {
        const texto = String(dados.inicio ?? '');
        if (DIA.test(texto) && !Number.isNaN(Date.parse(texto + 'T12:00:00Z')) && new Date(texto + 'T12:00:00Z').toISOString().startsWith(texto)) inicio = texto;
        else inicio = lerMes(texto, 'mês') + '-01';
    }
    return { tipo: dados.tipo, nome, valor, recorrencia: dados.recorrencia, inicio, fim };
}

/** Se o lancamento conta no mes ('AAAA-MM'). inicio e fim chegam como 'AAAA-MM-DD'. */
export function valeNoMes(lancamento, mes) {
    const inicio = lancamento.inicio.slice(0, 7);
    if (lancamento.recorrencia === 'unica') return inicio === mes;
    return inicio <= mes && (!lancamento.fim || lancamento.fim.slice(0, 7) >= mes);
}

/** Em quantos meses, ate o mes 'ate' (inclusive), o lancamento contou: um mensal, de inicio a fim; uma unica, um ou zero. */
export function mesesQueContaram(lancamento, ate) {
    const inicio = lancamento.inicio.slice(0, 7);
    if (inicio > ate) return 0;
    if (lancamento.recorrencia === 'unica') return 1;
    const ultimo = lancamento.fim && lancamento.fim.slice(0, 7) < ate ? lancamento.fim.slice(0, 7) : ate;
    const [a1, m1] = inicio.split('-').map(Number);
    const [a2, m2] = ultimo.split('-').map(Number);
    return Math.max(0, (a2 - a1) * 12 + (m2 - m1) + 1);
}

/** O total de uma lista de lancamentos desde o comeco ate o mes 'ate' (o geral). */
export const totalAte = (lancamentos, ate) => lancamentos.reduce((soma, item) => soma + item.valor * mesesQueContaram(item, ate), 0);

/** Total de uma lista de lancamentos no mes. */
export const totalNoMes = (lancamentos, mes) => lancamentos.filter(item => valeNoMes(item, mes)).reduce((soma, item) => soma + item.valor, 0);

/**
 * As fatias de uma pizza: as maiores primeiro, e a partir da sexta tudo vira "Outros" (mais que isso a pizza nao se
 * le). Itens com o mesmo nome se juntam. [{ nome, valor }] -> [{ nome, valor, outros? }]
 */
export function fatiasDaPizza(itens, maximo = 6) {
    const porNome = new Map();
    for (const item of itens) if (item.valor > 0) porNome.set(item.nome, (porNome.get(item.nome) || 0) + item.valor);
    const ordenadas = [...porNome].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));
    if (ordenadas.length <= maximo) return ordenadas;
    const ficam = ordenadas.slice(0, maximo - 1);
    const resto = ordenadas.slice(maximo - 1);
    return [...ficam, { nome: `Outros (${resto.length})`, valor: resto.reduce((soma, item) => soma + item.valor, 0), outros: true }];
}

/**
 * @param f ferramentas: banco, json, Recusa, lerCorpo, semCache
 */
export function criarFinancas(f) {
    const { banco, json } = f;
    const HOJE = `(now() AT TIME ZONE 'America/Sao_Paulo')`;
    const linha = item => ({
        id: item.id, tipo: item.tipo, nome: item.nome, valor: item.valor, recorrencia: item.recorrencia,
        inicio: item.inicio, fim: item.fim, banner: item.banner || null,
    });
    const datas = `id, tipo, nome, valor, recorrencia, to_char(inicio, 'YYYY-MM-DD') AS inicio, to_char(fim, 'YYYY-MM-DD') AS fim, banner`;

    /** Tudo do mes pedido e o resumo dos 12 meses que terminam nele. */
    async function doMes(url) {
        const db = await banco();
        const { rows: [{ atual }] } = await db.query(`SELECT to_char(${HOJE}, 'YYYY-MM') AS atual`);
        const mes = url.searchParams.get('mes') ? lerMes(url.searchParams.get('mes')) : atual;
        const primeiro = somarMeses(mes, -11);
        const [{ rows: lancamentos }, { rows: vendasPorMes }, { rows: historico }, { rows: [{ vendasAteHoje }] }] = await Promise.all([
            db.query(`SELECT ${datas} FROM financas ORDER BY tipo, nome, inicio`),
            // vendas da loja: as aprovadas, no mes em que foram aprovadas (reembolsadas nao contam)
            db.query(`SELECT to_char(atualizada_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS mes, sum(preco)::int AS total, count(*)::int AS quantidade
                FROM compras WHERE status = 'aprovada' AND atualizada_em AT TIME ZONE 'America/Sao_Paulo' >= $1::date
                GROUP BY 1`, [primeiro + '-01']),
            // o historico do mes: aprovadas, reembolsadas e divergentes (as pendentes e recusadas nao viraram dinheiro)
            db.query(`SELECT k.id, k.item, k.preco, k.status, k.pagamento, k.atualizada_em, c.nick, c.id AS conta
                FROM compras k JOIN contas c ON c.id = k.conta
                WHERE k.status IN ('aprovada', 'reembolsada', 'divergente')
                  AND to_char(k.atualizada_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = $1
                ORDER BY k.atualizada_em DESC LIMIT 500`, [mes]),
            // todas as vendas aprovadas, para o geral
            db.query(`SELECT coalesce(sum(preco), 0)::int AS "vendasAteHoje" FROM compras WHERE status = 'aprovada'`),
        ]);
        const gastos = lancamentos.filter(item => item.tipo === 'gasto');
        const receitas = lancamentos.filter(item => item.tipo === 'receita');
        const vendas = new Map(vendasPorMes.map(item => [item.mes, item]));
        const meses = [];
        for (let i = 0; i < 12; i++) {
            const qual = somarMeses(primeiro, i);
            const daLoja = vendas.get(qual)?.total || 0;
            meses.push({ mes: qual, receitas: totalNoMes(receitas, qual) + daLoja, gastos: totalNoMes(gastos, qual), vendas: daLoja });
        }
        const vendasDoMes = vendas.get(mes) || { total: 0, quantidade: 0 };
        const receitasDoMes = receitas.filter(item => valeNoMes(item, mes));
        const gastosDoMes = gastos.filter(item => valeNoMes(item, mes));
        return {
            mes,
            atual,
            resumo: { receitas: meses.at(-1).receitas, gastos: meses.at(-1).gastos, vendas: vendasDoMes.total, quantidadeDeVendas: vendasDoMes.quantidade },
            // desde o comeco ate o mes atual: para a pizza "Geral" de receita e despesa
            geral: { receitas: totalAte(receitas, atual) + vendasAteHoje, gastos: totalAte(gastos, atual) },
            pizzaDasReceitas: fatiasDaPizza([...(vendasDoMes.total ? [{ nome: 'Vendas da loja', valor: vendasDoMes.total }] : []), ...receitasDoMes]),
            pizzaDosGastos: fatiasDaPizza(gastosDoMes),
            // os lancamentos que valem no mes (para ver e mexer) e todos os mensais, que podem ter acabado antes
            gastos: gastosDoMes.map(linha),
            receitas: receitasDoMes.map(linha),
            meses,
            historico: historico.map(item => ({
                id: item.id, item: item.item, nome: itemDaLoja(item.item) ? `${itemDaLoja(item.item).tipo === 'efeito' ? 'Efeito' : 'Borda'} ${itemDaLoja(item.item).nome}` : item.item, valor: item.preco, status: item.status, pagamento: item.pagamento,
                quando: item.atualizada_em, comprador: { id: item.conta, nick: item.nick },
            })),
        };
    }

    async function exigirLancamento(id) {
        if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new f.Recusa(404, 'Lançamento não encontrado');
        const { rows } = await (await banco()).query(`SELECT ${datas} FROM financas WHERE id = $1`, [id]);
        if (!rows.length) throw new f.Recusa(404, 'Lançamento não encontrado');
        return rows[0];
    }

    /** A receita de um banner e mudada pelo cadastro do banner (o valor, a cobranca e o fim ficam la). */
    function exigirQueNaoSejaDeBanner(lancamento) {
        if (lancamento.banner) throw new DadoInvalidoNasFinancas('Essa receita vem de um banner: mude o valor ou o fim no cadastro do banner (Gerenciar → Banners)');
        return lancamento;
    }

    return async function tratar(request, url, partes) {
        const [id, acao] = partes;
        const metodo = request.method;
        const db = await banco();
        try {
            if (!id && metodo === 'GET') return f.semCache(json(200, await doMes(url)));
            if (!id && metodo === 'POST') {
                const novo = validarLancamento(await f.lerCorpo(request));
                const novoId = randomUUID();
                await db.query('INSERT INTO financas (id, tipo, nome, valor, recorrencia, inicio, fim) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [novoId, novo.tipo, novo.nome, novo.valor, novo.recorrencia, novo.inicio, novo.fim]);
                return json(201, linha(await exigirLancamento(novoId)));
            }
            if (id && !acao && metodo === 'DELETE') {
                exigirQueNaoSejaDeBanner(await exigirLancamento(id));
                await db.query('DELETE FROM financas WHERE id = $1', [id]);
                return new Response(null, { status: 204 });
            }
            // mensal: o valor muda a partir de um mes; os meses de antes continuam com o valor antigo
            if (id && acao === 'valor' && metodo === 'PUT') {
                const atual = exigirQueNaoSejaDeBanner(await exigirLancamento(id));
                const { valor, aPartirDe } = await f.lerCorpo(request);
                const novoValor = lerValor(valor);
                if (atual.recorrencia !== 'mensal') {
                    await db.query('UPDATE financas SET valor = $2 WHERE id = $1', [id, novoValor]);
                    return json(200, { ok: true });
                }
                const mes = lerMes(aPartirDe);
                if (atual.fim && mes > atual.fim.slice(0, 7)) throw new DadoInvalidoNasFinancas('Esse gasto já tinha acabado antes desse mês');
                if (mes <= atual.inicio.slice(0, 7)) {
                    await db.query('UPDATE financas SET valor = $2 WHERE id = $1', [id, novoValor]);
                } else {
                    const cliente = await db.connect();
                    try {
                        await cliente.query('BEGIN');
                        await cliente.query('UPDATE financas SET fim = $2 WHERE id = $1', [id, somarMeses(mes, -1) + '-01']);
                        await cliente.query('INSERT INTO financas (id, tipo, nome, valor, recorrencia, inicio, fim) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                            [randomUUID(), atual.tipo, atual.nome, novoValor, 'mensal', mes + '-01', atual.fim]);
                        await cliente.query('COMMIT');
                    } catch (erro) {
                        await cliente.query('ROLLBACK');
                        throw erro;
                    } finally {
                        cliente.release();
                    }
                }
                return json(200, { ok: true });
            }
            // mensal: o ultimo mes em que conta (parou de pagar ou de receber)
            if (id && acao === 'encerrar' && metodo === 'PUT') {
                const atual = exigirQueNaoSejaDeBanner(await exigirLancamento(id));
                if (atual.recorrencia !== 'mensal') throw new DadoInvalidoNasFinancas('Só lançamentos mensais podem ser encerrados');
                const { ultimoMes } = await f.lerCorpo(request);
                const mes = lerMes(ultimoMes, 'último mês');
                if (mes < atual.inicio.slice(0, 7)) throw new DadoInvalidoNasFinancas('O último mês não pode ser antes do primeiro');
                await db.query('UPDATE financas SET fim = $2 WHERE id = $1', [id, mes + '-01']);
                return json(200, { ok: true });
            }
        } catch (erro) {
            if (erro instanceof DadoInvalidoNasFinancas) throw new f.Recusa(400, erro.message);
            throw erro;
        }
        throw new f.Recusa(404, 'Rota não encontrada');
    };
}
