// Roda em todas as paginas, mas so faz alguma coisa no site Meus Mangas (que se identifica com uma tag <meta>).
// La, repassa os pedidos do site para a extensao e devolve a resposta. Em qualquer outra pagina fica parado.
(() => {
    const ext = globalThis.browser || globalThis.chrome;
    const ehOSite = () => document.querySelector('meta[name="meus-mangas-site"]') !== null;

    // o popup da extensao pergunta se a aba aberta e o site
    ext.runtime.onMessage.addListener((mensagem, remetente, responder) => {
        if (mensagem && mensagem.tipo === 'eh-o-site') responder({ ehOSite: ehOSite() });
    });

    if (!ehOSite()) return;
    document.documentElement.dataset.meusMangasExtensao = ext.runtime.getManifest().version;

    window.addEventListener('message', async evento => {
        if (evento.source !== window || evento.origin !== location.origin) return;
        const pedido = evento.data;
        if (!pedido || pedido.de !== 'meus-mangas-site' || typeof pedido.id !== 'string') return;
        let resposta;
        try {
            // quem autoriza ou nao e a extensao, olhando o endereco real desta aba
            resposta = await ext.runtime.sendMessage({ tipo: pedido.tipo, dados: pedido.dados });
        } catch (erro) {
            resposta = { ok: false, motivo: 'erro' };
        }
        window.postMessage({ de: 'meus-mangas-extensao', id: pedido.id, resposta }, location.origin);
    });
})();
