// Loja: bordas e efeitos para as capas dos mangas favoritos, pagas com dinheiro de verdade pelo Mercado Pago (Checkout Pro:
// Pix ou cartao, na pagina do proprio Mercado Pago). O site nunca ve os dados do cartao.
//
// Como uma compra anda:
// 1. POST /api/loja/comprar: o servidor cria a compra (pendente), com o preco daqui (nunca o que o navegador manda), e
//    pede ao Mercado Pago uma "preferencia" de pagamento com external_reference = id da compra. Devolve o endereco do
//    pagamento, e o site leva a pessoa ate la.
// 2. O Mercado Pago avisa em POST /api/loja/webhook. O aviso so diz o numero do pagamento: o servidor busca o pagamento
//    na API do Mercado Pago com o token secreto (a unica fonte de verdade) e, aprovado com o valor e a moeda certos,
//    poe a borda na mochila. Reembolso ou estorno tiram a borda de novo.
// 3. Ao voltar do Mercado Pago, o site pergunta GET /api/loja/compras/{id}, que tambem confere no Mercado Pago: a
//    borda aparece mesmo se o aviso atrasar.
//
// Variaveis de ambiente (no Vercel):
// - MERCADOPAGO_ACCESS_TOKEN: o "Access Token" das credenciais (TEST-... para testar, APP_USR-... para valer);
// - MERCADOPAGO_WEBHOOK_SECRET: a "assinatura secreta" dos avisos (Webhooks), para conferir que o aviso veio dele.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/** Precos, em centavos: cada borda e cada efeito. */
export const PRECO_DA_BORDA = 450;
export const PRECO_DO_EFEITO = 250;

/**
 * O que a loja vende. O id vira a classe "borda-{id}" ou "efeito-{id}" das capas (app.css). A pessoa equipa uma borda
 * e um efeito ao mesmo tempo; sem nenhum, a borda roxa e o brilho de sempre.
 */
export const ITENS_DA_LOJA = [
    { id: 'dourada', tipo: 'borda', nome: 'Ouro Lendário', descricao: 'Moldura de ouro polido com um brilho que passa de tempos em tempos.', preco: PRECO_DA_BORDA },
    { id: 'neon', tipo: 'borda', nome: 'Neon', descricao: 'Ciano e rosa elétrico, com um brilho que pulsa em volta da capa.', preco: PRECO_DA_BORDA },
    { id: 'sakura', tipo: 'borda', nome: 'Sakura', descricao: 'Rosa das cerejeiras, com uma flor no lugar da estrela.', preco: PRECO_DA_BORDA },
    { id: 'chamas', tipo: 'borda', nome: 'Chamas', descricao: 'Fogo que corre pela borda, do vermelho ao amarelo.', preco: PRECO_DA_BORDA },
    { id: 'galaxia', tipo: 'borda', nome: 'Galáxia', descricao: 'Azul e roxo do espaço, com estrelas piscando na moldura.', preco: PRECO_DA_BORDA },
    { id: 'cristal', tipo: 'borda', nome: 'Cristal', descricao: 'Cristais de gelo e prismas congelados que reluzem com a luz.', preco: PRECO_DA_BORDA },
    { id: 'cyberpunk', tipo: 'borda', nome: 'Cyberpunk', descricao: 'Moldura de circuitos com luzes em neon verde e roxo que correm pela borda.', preco: PRECO_DA_BORDA },
    { id: 'abissal', tipo: 'borda', nome: 'Abissal', descricao: 'Correntes de água profunda e bolhas bioluminescentes subindo.', preco: PRECO_DA_BORDA },
    { id: 'sombrio', tipo: 'borda', nome: 'Sombrio', descricao: 'Névoa mística e escuridão em volta, com fragmentos de energia.', preco: PRECO_DA_BORDA },
    { id: 'floresta', tipo: 'borda', nome: 'Floresta', descricao: 'Vinhas com folhas balançando e vaga-lumes da mata.', preco: PRECO_DA_BORDA },
    { id: 'eletrico', tipo: 'borda', nome: 'Elétrico', descricao: 'Descargas elétricas e raios de alta voltagem em volta da capa.', preco: PRECO_DA_BORDA },
    { id: 'arcano', tipo: 'borda', nome: 'Arcano', descricao: 'Moldura de prata com cantos dourados e runas antigas que brilham.', preco: PRECO_DA_BORDA },
    { id: 'celestial', tipo: 'borda', nome: 'Celestial', descricao: 'Moldura dourada com arabescos, runas azuis brilhando e uma estrela com a lua no canto.', preco: PRECO_DA_BORDA },
    { id: 'holografico', tipo: 'efeito', nome: 'Holográfico', descricao: 'Um reflexo de arco-íris que atravessa a capa, como uma carta rara.', preco: PRECO_DO_EFEITO },
    { id: 'faiscas', tipo: 'efeito', nome: 'Faíscas', descricao: 'Estrelinhas que acendem e apagam em cima da capa.', preco: PRECO_DO_EFEITO },
    { id: 'neve', tipo: 'efeito', nome: 'Neve', descricao: 'Flocos de neve caindo devagar sobre a capa.', preco: PRECO_DO_EFEITO },
    { id: 'raios', tipo: 'efeito', nome: 'Raios', descricao: 'Clarões elétricos azuis que piscam nas bordas da capa.', preco: PRECO_DO_EFEITO },
    { id: 'aura', tipo: 'efeito', nome: 'Aura', descricao: 'Uma luz que pulsa de dentro da capa, mudando de cor.', preco: PRECO_DO_EFEITO },
];

/** A coluna de "contas" onde fica o item equipado de cada tipo. */
export const COLUNA_DO_TIPO = { borda: 'borda', efeito: 'efeito' };

export const itemDaLoja = id => ITENS_DA_LOJA.find(item => item.id === id) || null;

/** Tabelas da loja, criadas junto com as outras (so acrescenta). */
export const ESTRUTURA_DA_LOJA = `
    -- status: pendente, aprovada, recusada, reembolsada ou divergente (pago com valor ou moeda errados: nao entrega)
    CREATE TABLE IF NOT EXISTS compras (id UUID PRIMARY KEY, conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
        item TEXT NOT NULL, preco INT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', pagamento TEXT,
        criada_em TIMESTAMPTZ NOT NULL DEFAULT now(), atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS compras_conta ON compras (conta, criada_em DESC);
    CREATE TABLE IF NOT EXISTS mochila (conta UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE, item TEXT NOT NULL,
        compra UUID REFERENCES compras(id) ON DELETE SET NULL, obtido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (conta, item));
    -- a borda e o efeito equipados (nulos: a borda roxa e o brilho de sempre)
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS borda TEXT;
    ALTER TABLE contas ADD COLUMN IF NOT EXISTS efeito TEXT;
`;

export class ErroDaLoja extends Error {
    constructor(status, mensagem) {
        super(mensagem);
        this.status = status;
    }
}

const API = () => (process.env.MERCADOPAGO_API || 'https://api.mercadopago.com').replace(/\/$/, '');
export const pagamentoConfigurado = () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);

/** Uma chamada a API do Mercado Pago com o token secreto. */
async function mercadoPago(caminho, { metodo = 'GET', corpo, idempotencia } = {}) {
    const cabecalhos = { Authorization: 'Bearer ' + process.env.MERCADOPAGO_ACCESS_TOKEN };
    if (corpo) cabecalhos['Content-Type'] = 'application/json';
    // a mesma chave faz o Mercado Pago devolver a mesma resposta se o pedido for repetido
    if (idempotencia) cabecalhos['X-Idempotency-Key'] = idempotencia;
    const resposta = await fetch(API() + caminho, { method: metodo, headers: cabecalhos, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(15_000) });
    const texto = await resposta.text();
    if (!resposta.ok) throw new Error(`Mercado Pago respondeu ${resposta.status} em ${caminho}: ${texto.slice(0, 300)}`);
    return texto ? JSON.parse(texto) : null;
}

/**
 * Confere a assinatura de um aviso (cabecalho x-signature "ts=...,v1=..."): HMAC-SHA256, com a assinatura secreta, de
 * "id:{data.id};request-id:{x-request-id};ts:{ts};". O id vai em minusculas, como o Mercado Pago manda conferir.
 */
export function assinaturaValida({ assinatura, requestId, dataId, segredo }) {
    if (!assinatura || !segredo) return false;
    const partes = Object.fromEntries(String(assinatura).split(',').map(parte => parte.trim().split('=').map(lado => lado.trim())));
    if (!partes.ts || !partes.v1) return false;
    let manifesto = '';
    if (dataId) manifesto += `id:${String(dataId).toLowerCase()};`;
    if (requestId) manifesto += `request-id:${requestId};`;
    manifesto += `ts:${partes.ts};`;
    const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');
    const recebido = String(partes.v1).toLowerCase();
    return esperado.length === recebido.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(recebido));
}

/**
 * O que um pagamento do Mercado Pago significa para a compra: 'aprovada' (so com o valor e a moeda certos),
 * 'divergente' (aprovado, mas com valor ou moeda errados), 'reembolsada' (devolvido ou estornado), 'recusada'
 * (recusado ou cancelado) ou 'pendente' (esperando o Pix, em analise...).
 */
export function situacaoDoPagamento(pagamento, compra) {
    switch (pagamento?.status) {
    case 'approved': {
        const valorCerto = Math.round(Number(pagamento.transaction_amount) * 100) === compra.preco;
        return valorCerto && pagamento.currency_id === 'BRL' ? 'aprovada' : 'divergente';
    }
    case 'refunded':
    case 'charged_back':
        return 'reembolsada';
    case 'rejected':
    case 'cancelled':
        return 'recusada';
    default:
        return 'pendente';
    }
}

/** Quais mudancas de status valem: uma compra aprovada so muda para reembolsada; as outras nao voltam a ser pendentes. */
export function podeMudar(de, para) {
    if (de === para || para === 'pendente') return false;
    if (de === 'aprovada') return para === 'reembolsada';
    if (de === 'reembolsada' || de === 'divergente') return false;
    return true;
}

/**
 * @param f ferramentas do api/index.js: banco, json, Recusa, lerCorpo, semCache, ehDono
 */
export function criarLoja(f) {
    // o dono do site tem todos os itens, os de hoje e os que entrarem na loja depois, sem comprar
    const temTudo = eu => Boolean(f.ehDono?.(eu));

    const { banco, json } = f;

    /** Aplica o que o Mercado Pago diz de um pagamento a compra dele (pelo external_reference). Pode repetir. */
    async function aplicarPagamento(pagamento) {
        const compraId = pagamento?.external_reference;
        if (!/^[0-9a-f-]{36}$/i.test(compraId || '')) return null;
        const db = await banco();
        const cliente = await db.connect();
        try {
            await cliente.query('BEGIN');
            const { rows } = await cliente.query('SELECT * FROM compras WHERE id = $1 FOR UPDATE', [compraId]);
            const compra = rows[0];
            if (!compra) {
                await cliente.query('ROLLBACK');
                return null;
            }
            const nova = situacaoDoPagamento(pagamento, compra);
            if (podeMudar(compra.status, nova)) {
                await cliente.query('UPDATE compras SET status = $2, pagamento = $3, atualizada_em = now() WHERE id = $1', [compra.id, nova, String(pagamento.id)]);
                if (nova === 'aprovada') {
                    await cliente.query('INSERT INTO mochila (conta, item, compra) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [compra.conta, compra.item, compra.id]);
                } else if (nova === 'reembolsada') {
                    // devolvido: o item sai da mochila (e de cima das capas, se estava equipado)
                    await cliente.query('DELETE FROM mochila WHERE conta = $1 AND item = $2 AND compra = $3', [compra.conta, compra.item, compra.id]);
                    await cliente.query(`UPDATE contas SET borda = CASE WHEN borda = $2 THEN NULL ELSE borda END,
                        efeito = CASE WHEN efeito = $2 THEN NULL ELSE efeito END WHERE id = $1`, [compra.conta, compra.item]);
                } else if (nova === 'divergente') {
                    console.error(`Compra ${compra.id}: pago ${pagamento.transaction_amount} ${pagamento.currency_id}, esperado ${compra.preco / 100} BRL`);
                }
                compra.status = nova;
            }
            await cliente.query('COMMIT');
            return compra;
        } catch (erro) {
            await cliente.query('ROLLBACK');
            throw erro;
        } finally {
            cliente.release();
        }
    }

    /** O que a pessoa tem e o que a loja vende. */
    async function vitrine(eu) {
        const db = await banco();
        const [{ rows: meus }, { rows: conta }] = await Promise.all([
            db.query('SELECT item, obtido_em FROM mochila WHERE conta = $1 ORDER BY obtido_em', [eu.id]),
            db.query('SELECT borda, efeito FROM contas WHERE id = $1', [eu.id]),
        ]);
        const comprados = meus.filter(linha => itemDaLoja(linha.item)).map(linha => ({ item: linha.item, obtidoEm: linha.obtido_em }));
        return {
            itens: ITENS_DA_LOJA,
            mochila: temTudo(eu) ? ITENS_DA_LOJA.map(item => ({ item: item.id, obtidoEm: null })) : comprados,
            temTudo: temTudo(eu),
            equipados: { borda: conta[0]?.borda || null, efeito: conta[0]?.efeito || null },
            pagamentoConfigurado: pagamentoConfigurado(),
        };
    }

    async function comprar(request, eu) {
        if (!pagamentoConfigurado()) throw new ErroDaLoja(503, 'A loja ainda não está recebendo pagamentos. Tente mais tarde.');
        const { item: id } = await f.lerCorpo(request);
        const item = itemDaLoja(id);
        if (!item) throw new ErroDaLoja(404, 'Item não encontrado na loja');
        if (temTudo(eu)) throw new ErroDaLoja(409, 'Você é o dono do site: todos os itens já estão na sua mochila');
        const db = await banco();
        const { rows: tem } = await db.query('SELECT 1 FROM mochila WHERE conta = $1 AND item = $2', [eu.id, item.id]);
        if (tem.length) throw new ErroDaLoja(409, 'Esse item já está na sua mochila');
        // contra abuso: no maximo 10 compras abertas por hora
        const { rows: [{ abertas }] } = await db.query(
            `SELECT count(*)::int AS abertas FROM compras WHERE conta = $1 AND criada_em > now() - interval '1 hour'`, [eu.id]);
        if (abertas >= 10) throw new ErroDaLoja(429, 'Muitas compras começadas na última hora. Espere um pouco e tente de novo.');
        const compraId = randomUUID();
        await db.query('INSERT INTO compras (id, conta, item, preco) VALUES ($1, $2, $3, $4)', [compraId, eu.id, item.id, item.preco]);
        const site = origemDoSite(request);
        const retorno = `${site}/api/loja/retorno?compra=${compraId}`;
        const preferencia = await mercadoPago('/checkout/preferences', {
            metodo: 'POST',
            idempotencia: compraId,
            corpo: {
                items: [{ id: item.id, title: `${item.tipo === 'efeito' ? 'Efeito' : 'Borda'} ${item.nome} - Viracap`, description: item.descricao, category_id: 'virtual_goods',
                    quantity: 1, currency_id: 'BRL', unit_price: item.preco / 100 }],
                external_reference: compraId,
                back_urls: { success: retorno, pending: retorno, failure: retorno },
                auto_return: 'approved',
                notification_url: `${site}/api/loja/webhook?source_news=webhooks`,
                statement_descriptor: 'VIRACAP',
                // bordas sao digitais: nada de endereco de entrega
                shipments: { mode: 'not_specified' },
                expires: true,
                expiration_date_to: new Date(Date.now() + 24 * 3600_000).toISOString(),
            },
        });
        const endereco = preferencia.init_point || preferencia.sandbox_init_point;
        if (!endereco) throw new Error('O Mercado Pago não devolveu o endereço do pagamento');
        return { compra: compraId, endereco };
    }

    /** A situacao de uma compra da pessoa; se ainda esta pendente, pergunta ao Mercado Pago. */
    async function conferirCompra(id, eu) {
        if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new ErroDaLoja(404, 'Compra não encontrada');
        const db = await banco();
        const { rows } = await db.query('SELECT id, item, status FROM compras WHERE id = $1 AND conta = $2', [id, eu.id]);
        if (!rows.length) throw new ErroDaLoja(404, 'Compra não encontrada');
        let compra = rows[0];
        if (compra.status === 'pendente' && pagamentoConfigurado()) {
            try {
                const busca = await mercadoPago(`/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc`);
                // um pagamento aprovado vale mais que tentativas recusadas da mesma compra
                const pagamentos = busca?.results || [];
                const melhor = pagamentos.find(pagamento => pagamento.status === 'approved') || pagamentos[0];
                if (melhor) compra = (await aplicarPagamento(melhor)) || compra;
            } catch (erro) {
                console.error('Não deu para conferir a compra no Mercado Pago:', erro.message);
            }
        }
        return { compra: compra.id, item: compra.item, status: compra.status };
    }

    /** { item } equipa um item da mochila; { tipo, item: null } volta ao de sempre daquele tipo. */
    async function equipar(request, eu) {
        const { item, tipo } = await f.lerCorpo(request);
        const db = await banco();
        const equipados = async () => {
            const { rows } = await db.query('SELECT borda, efeito FROM contas WHERE id = $1', [eu.id]);
            return { equipados: { borda: rows[0]?.borda || null, efeito: rows[0]?.efeito || null } };
        };
        if (item === null) {
            const coluna = Object.hasOwn(COLUNA_DO_TIPO, tipo) ? COLUNA_DO_TIPO[tipo] : null;
            if (!coluna) throw new ErroDaLoja(400, 'Informe o tipo: borda ou efeito');
            await db.query(`UPDATE contas SET ${coluna} = NULL WHERE id = $1`, [eu.id]);
            return equipados();
        }
        const achado = itemDaLoja(item);
        if (!achado) throw new ErroDaLoja(404, 'Item não encontrado');
        if (!temTudo(eu)) {
            const { rows } = await db.query('SELECT 1 FROM mochila WHERE conta = $1 AND item = $2', [eu.id, item]);
            if (!rows.length) throw new ErroDaLoja(403, 'Esse item não está na sua mochila');
        }
        await db.query(`UPDATE contas SET ${COLUNA_DO_TIPO[achado.tipo]} = $2 WHERE id = $1`, [eu.id, achado.id]);
        return equipados();
    }

    return {
        /**
         * Rotas sem login: o aviso do Mercado Pago e a volta da pagina de pagamento (que so redireciona para o site).
         * Devolve null quando a rota nao e uma delas.
         */
        async semLogin(request, url, partes) {
            const [acao] = partes;
            if (acao === 'retorno' && request.method === 'GET') {
                const compra = url.searchParams.get('compra') || url.searchParams.get('external_reference') || '';
                const destino = '/#/loja' + (/^[0-9a-f-]{36}$/i.test(compra) ? '?compra=' + compra : '');
                return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
            }
            if (acao === 'webhook' && request.method === 'POST') return webhook(request, url);
            return null;
        },
        async comLogin(request, url, partes, eu) {
            const [acao, id] = partes;
            const metodo = request.method;
            try {
                if (!acao && metodo === 'GET') return f.semCache(json(200, await vitrine(eu)));
                if (acao === 'comprar' && !id && metodo === 'POST') return json(201, await comprar(request, eu));
                if (acao === 'compras' && id && metodo === 'GET') return f.semCache(json(200, await conferirCompra(id, eu)));
                if (acao === 'equipar' && !id && metodo === 'PUT') return json(200, await equipar(request, eu));
            } catch (erro) {
                if (erro instanceof ErroDaLoja) throw new f.Recusa(erro.status, erro.message);
                throw erro;
            }
            throw new f.Recusa(404, 'Endereço não encontrado');
        },
    };

    /**
     * O aviso do Mercado Pago. Responde 200 a tudo o que nao e da loja (senao ele fica repetindo o aviso); um pagamento
     * so muda a compra depois de buscado na API com o token. Com MERCADOPAGO_WEBHOOK_SECRET definida, avisos sem a
     * assinatura certa sao recusados.
     */
    async function webhook(request, url) {
        let corpo = {};
        try {
            corpo = await request.json();
        } catch {
            // aviso sem corpo: o id vem no endereco
        }
        const tipo = url.searchParams.get('type') || url.searchParams.get('topic') || corpo.type || corpo.topic;
        const pagamentoId = url.searchParams.get('data.id') || corpo?.data?.id || (tipo === 'payment' ? url.searchParams.get('id') : null);
        const segredo = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (segredo && !assinaturaValida({ assinatura: request.headers.get('x-signature'), requestId: request.headers.get('x-request-id'),
            dataId: url.searchParams.get('data.id') || corpo?.data?.id, segredo })) {
            return json(401, { erro: 'Assinatura inválida' });
        }
        if (tipo !== 'payment' || !/^\d+$/.test(String(pagamentoId || '')) || !pagamentoConfigurado()) return json(200, { ok: true });
        const pagamento = await mercadoPago('/v1/payments/' + pagamentoId);
        await aplicarPagamento(pagamento);
        return json(200, { ok: true });
    }
}

/** https://viracap.vercel.app (ou o endereco local, nos testes): para as voltas e os avisos do Mercado Pago. */
function origemDoSite(request) {
    if (process.env.MANGATRACKER_SITE) return process.env.MANGATRACKER_SITE.replace(/\/$/, '');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocolo = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
    return `${protocolo}://${host}`;
}
