// Janelinha do icone da extensao: libera (ou remove) o site aberto na aba atual.
const ext = globalThis.browser || globalThis.chrome;
const situacao = document.getElementById('situacao');
const acao = document.getElementById('acao');
const marcar = document.getElementById('marcar');

async function mostrar() {
    const [aba] = await ext.tabs.query({ active: true, currentWindow: true });
    let origem = null;
    try {
        const url = new URL(aba.url);
        if (['http:', 'https:'].includes(url.protocol)) origem = url.origin;
    } catch (erro) {
        // paginas internas do navegador nao tem endereco de site
    }
    let ehOSite = false;
    if (origem) {
        try {
            ehOSite = (await ext.tabs.sendMessage(aba.id, { tipo: 'eh-o-site' })).ehOSite;
        } catch (erro) {
            // a pagina foi aberta antes de a extensao ser instalada: precisa recarregar
        }
    }
    const { origens } = await ext.runtime.sendMessage({ tipo: 'origens' });
    acao.hidden = true;

    // em qualquer pagina que nao seja o proprio site: marcar o capitulo que esta aberto
    marcar.hidden = !(origem && origens.length > 0 && !origens.includes(origem) && !ehOSite);
    marcar.onclick = async () => {
        await ext.runtime.sendMessage({ tipo: 'marcar', dados: { tabId: aba.id } });
        window.close();
    };
    if (!marcar.hidden) {
        situacao.textContent = 'Terminou de ler? Marque o capítulo desta página.';
        return;
    }

    if (origem && origens.includes(origem)) {
        situacao.textContent = 'Liberado para ' + origem + '.';
        acao.textContent = 'Remover a permissão';
        acao.className = 'remover';
        acao.onclick = async () => {
            await ext.runtime.sendMessage({ tipo: 'remover', dados: { origem } });
            await ext.tabs.reload(aba.id);
            mostrar();
        };
        acao.hidden = false;
    } else if (origem && ehOSite) {
        situacao.textContent = 'Este é o seu site Meus Mangás (' + origem + ')?';
        acao.textContent = 'Permitir que este site use a extensão';
        acao.className = '';
        acao.onclick = async () => {
            await ext.runtime.sendMessage({ tipo: 'permitir', dados: { origem } });
            await ext.tabs.reload(aba.id);
            mostrar();
        };
        acao.hidden = false;
    } else {
        situacao.textContent = origens.length
            ? 'Liberado para: ' + origens.join(', ') + '. Abra o seu site Meus Mangás para usar.'
            : 'Abra o seu site Meus Mangás (e recarregue a página) e clique aqui de novo para liberar.';
    }
}

mostrar();
