// Roda em todas as paginas, mas so faz alguma coisa em dois lugares:
// - no site Meus Mangas (que se identifica com uma tag <meta>): repassa os pedidos do site para a extensao;
// - nos sites de leitura onde estao os seus mangas: mostra o botao "Lido" no canto da pagina.
(() => {
    const ext = globalThis.browser || globalThis.chrome;
    const ehOSite = () => document.querySelector('meta[name="meus-mangas-site"]') !== null;

    // o popup da extensao pergunta se a aba aberta e o site
    ext.runtime.onMessage.addListener((mensagem, remetente, responder) => {
        if (mensagem && mensagem.tipo === 'eh-o-site') responder({ ehOSite: ehOSite() });
    });

    if (ehOSite()) {
        document.documentElement.dataset.meusMangasExtensao = ext.runtime.getManifest().version;
        window.addEventListener('message', async evento => {
            if (evento.source !== window || evento.origin !== location.origin) return;
            const pedido = evento.data;
            if (!pedido || pedido.de !== 'meus-mangas-site' || typeof pedido.id !== 'string') return;
            let resposta;
            try {
                // quem autoriza ou nao e a extensao, olhando o endereco real desta aba.
                // daPagina avisa que o pedido veio do site, e nao do codigo da propria extensao
                resposta = await ext.runtime.sendMessage({ tipo: pedido.tipo, dados: pedido.dados, daPagina: true });
            } catch (erro) {
                resposta = { ok: false, motivo: 'erro' };
            }
            window.postMessage({ de: 'meus-mangas-extensao', id: pedido.id, resposta }, location.origin);
        });
        return;
    }

    // ------------------------------------------------------------------ botao "Lido" nos sites de leitura

    const ESCONDIDO = 'meus-mangas-botao-escondido';

    function mostrarBotao() {
        if (document.getElementById('meus-mangas-lido') || sessionStorage.getItem(ESCONDIDO)) return;
        const caixa = document.createElement('div');
        caixa.id = 'meus-mangas-lido';
        // dentro de um shadow DOM o estilo do site de leitura nao mexe no botao, nem o do botao no site
        const raiz = caixa.attachShadow({ mode: 'closed' });
        const estilo = document.createElement('style');
        estilo.textContent = `
            :host { all: initial; position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; }
            .grupo { display: flex; align-items: stretch; font: 600 13px/1 system-ui, sans-serif; border-radius: 999px; overflow: hidden;
                box-shadow: 0 4px 14px rgba(0, 0, 0, .4); opacity: .55; transition: opacity .15s; }
            .grupo:hover, .grupo:focus-within { opacity: 1; }
            button { all: unset; cursor: pointer; padding: 10px 14px; background: #d9481f; color: #fff; font: inherit; }
            button:hover { background: #b93a15; }
            button:focus-visible { outline: 2px solid #fff; outline-offset: -3px; }
            .fechar { padding: 10px 11px 10px 9px; background: #2b303b; color: #e9ebf0; }
            .fechar:hover { background: #444b5a; }
        `;
        const grupo = document.createElement('div');
        grupo.className = 'grupo';
        const marcar = document.createElement('button');
        marcar.type = 'button';
        marcar.textContent = '✓ Lido';
        marcar.title = 'Meus Mangás: marcar este capítulo como lido';
        marcar.addEventListener('click', async () => {
            marcar.textContent = 'Abrindo…';
            try {
                await ext.runtime.sendMessage({ tipo: 'marcar-esta' });
            } catch (erro) {
                // a extensao foi atualizada ou removida com a pagina aberta
            }
            marcar.textContent = '✓ Lido';
        });
        const fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.className = 'fechar';
        fechar.textContent = '×';
        fechar.title = 'Esconder nesta aba';
        fechar.setAttribute('aria-label', 'Esconder o botão Lido nesta aba');
        fechar.addEventListener('click', () => {
            sessionStorage.setItem(ESCONDIDO, '1');
            caixa.remove();
        });
        grupo.append(marcar, fechar);
        raiz.append(estilo, grupo);
        document.documentElement.append(caixa);
    }

    // so aparece em sites onde ha manga cadastrado (a lista vem do site Meus Mangas) e fora de paginas embutidas
    if (window.top !== window) return;
    ext.storage.local.get({ sites: [], origens: [] }).then(guardado => {
        if (guardado.origens.length > 0 && guardado.sites.includes(location.host)) mostrarBotao();
    }, () => {});
})();
