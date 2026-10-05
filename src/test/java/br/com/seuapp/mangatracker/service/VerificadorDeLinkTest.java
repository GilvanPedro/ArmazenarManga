package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.service.VerificadorDeLink.Verificacao;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Usa um site falso em 127.0.0.1 e o mesmo codigo de rede que roda de verdade. */
class VerificadorDeLinkTest {

    SiteFalso site;
    VerificadorDeLink verificador;

    @BeforeEach
    void setUp() throws IOException {
        site = new SiteFalso();
        verificador = new VerificadorDeLink(new BuscadorHttp(true));
    }

    @AfterEach
    void tearDown() {
        site.close();
    }

    private Manga manga(String modelo, String ultimoCapitulo) {
        return new Manga("Teste", "https://site.com/capa.png", new ArrayList<>(), site.url(modelo),
                ChapterDecimalFormat.HIFEN, new BigDecimal(ultimoCapitulo), ReadingStatus.LENDO, "");
    }

    // ------------------------------------------------------------------ link que nao muda

    @Test
    void confirmaOLinkQuandoAPaginaApontaParaOProximoCapitulo() {
        site.pagina("/manga/x/chapter/49", "<a href='/manga/x/chapter/48'>Prev</a> <a href='/manga/x/chapter/50'>Next</a>")
                .pagina("/manga/x/chapter/50", "capitulo 50");
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
        // abriu o ultimo capitulo lido e depois foi ate o proximo
        assertEquals(java.util.List.of("/manga/x/chapter/49", "/manga/x/chapter/50"), site.visitas());
    }

    @Test
    void confirmaPeloModeloQuandoAPaginaNaoTemLinks() {
        // sites que montam a pagina com JavaScript nao trazem os links no HTML
        site.pagina("/manga/x/chapter/49", "<div id='app'></div>").pagina("/manga/x/chapter/50", "<div id='app'></div>");
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
    }

    @Test
    void capituloQuebradoVaiParaOProximoInteiro() {
        site.pagina("/manga/x/chapter/48-5", "<a href='/manga/x/chapter/49'>Next</a>").pagina("/manga/x/chapter/49", "ok");

        assertEquals(SituacaoDoLink.DISPONIVEL, verificador.verificar(manga("/manga/x/chapter/{cap}", "48.5")).situacao());
    }

    @Test
    void barraNoFinalEFragmentoNaoContamComoMudanca() {
        site.pagina("/manga/x/chapter/49", "<a href='/manga/x/chapter/50/#comentarios'>Next</a>").pagina("/manga/x/chapter/50/", "ok")
                .pagina("/manga/x/chapter/50", "ok");
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
    }

    // ------------------------------------------------------------------ id da obra mudou

    @Test
    void corrigeOModeloQuandoOSiteRedirecionaParaUmNovoIdDaObra() {
        // caso real: .../obra-3ec3b16f/chapter/174 passou a ser .../obra-bd5bdaf8/chapter/174
        site.redireciona("/comics/obra-3ec3b16f/chapter/174", "/comics/obra-bd5bdaf8/chapter/174")
                .pagina("/comics/obra-bd5bdaf8/chapter/174", "<link rel='prev' href='/comics/obra-bd5bdaf8/chapter/173'>"
                        + "<a href='/comics/obra-bd5bdaf8/chapter/175'>Next</a>")
                .pagina("/comics/obra-bd5bdaf8/chapter/175", "ok");

        Verificacao resultado = verificador.verificar(manga("/comics/obra-3ec3b16f/chapter/{cap}", "174"));

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/{cap}"), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
    }

    @Test
    void corrigeOModeloMesmoQuandoOProximoCapituloAindaNaoSaiu() {
        site.redireciona("/comics/obra-3ec3b16f/chapter/174", "/comics/obra-bd5bdaf8/chapter/174")
                .pagina("/comics/obra-bd5bdaf8/chapter/174", "<link rel='prev' href='/comics/obra-bd5bdaf8/chapter/173'>");

        Verificacao resultado = verificador.verificar(manga("/comics/obra-3ec3b16f/chapter/{cap}", "174"));

        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, resultado.situacao());
        assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/{cap}"), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
    }

    @Test
    void corrigeOModeloQuandoOLinkDoProximoTrazOutroIdDaObra() {
        // sem redirecionar: a pagina antiga ainda abre, mas ja aponta para o endereco novo
        site.pagina("/comics/obra-aaa/chapter/10", "<a href='/comics/obra-bbb/chapter/11'>Próximo</a>")
                .pagina("/comics/obra-bbb/chapter/10", "ok").pagina("/comics/obra-bbb/chapter/11", "ok");

        Verificacao resultado = verificador.verificar(manga("/comics/obra-aaa/chapter/{cap}", "10"));

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        // o modelo novo nao reproduz a pagina atual (obra-aaa), entao so o endereco exato do proximo e guardado
        assertEquals(site.url("/comics/obra-bbb/chapter/11"), resultado.nextChapterUrl());
    }

    @Test
    void corrigeOModeloQuandoSoOProximoCapituloRedireciona() {
        site.redireciona("/comics/obra-aaa/chapter/1", "/comics/obra-bbb/chapter/1").pagina("/comics/obra-bbb/chapter/1", "ok");

        Verificacao resultado = verificador.verificar(manga("/comics/obra-aaa/chapter/{cap}", "0"));

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(site.url("/comics/obra-bbb/chapter/{cap}"), resultado.chapterLinkModel());
    }

    // ------------------------------------------------------------------ id proprio de cada capitulo

    @Test
    void guardaOEnderecoExatoQuandoCadaCapituloTemUmId() {
        site.pagina("/m/y/chapter-49-a1b2", "<a class='btn prev' href='/m/y/chapter-48-q7w8'>Anterior</a>"
                        + "<a class='btn next-chap' href='/m/y/chapter-50-zz9'>Próximo</a>")
                .pagina("/m/y/chapter-50-zz9", "ok");
        Manga manga = manga("/m/y/chapter-{cap}-a1b2", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertEquals(site.url("/m/y/chapter-50-zz9"), resultado.nextChapterUrl());
        assertFalse(site.visitas().contains("/m/y/chapter-50-a1b2")); // nem tenta o link do modelo, que estaria errado
    }

    @Test
    void achaOEnderecoDentroDosDadosDeUmaPaginaMontadaComJavaScript() {
        // sem <a>: o endereco do proximo capitulo so aparece no JSON embutido, com as barras escapadas
        site.pagina("/title/obra/6880186-chapter-7", "<div id=\"app\"></div><script>window.__DADOS__ = {\"prev\":\"\\/title\\/obra\\/6700000-chapter-6\","
                        + "\"next\":{\"url\":\"\\/title\\/obra\\/6912345-chapter-8\"},\"outra\":\"/title/outra-obra/1-chapter-8\"}</script>")
                .pagina("/title/obra/6912345-chapter-8", "ok");

        Verificacao resultado = verificador.verificar(manga("/title/obra/6880186-chapter-{cap}", "7"));

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(site.url("/title/obra/6912345-chapter-8"), resultado.nextChapterUrl());
    }

    @Test
    void segueOLinkDeProximoMesmoSemNumeroNoEndereco() {
        site.pagina("/read/aaa111", "<a href='/read/000zzz'>Capítulo anterior</a> <a href='/read/bbb222'>Próximo capítulo</a>")
                .pagina("/read/bbb222", "ok");
        Manga manga = manga("/read/{cap}", "49");
        manga.setLastChapterUrl(site.url("/read/aaa111")); // endereco exato guardado na verificacao anterior

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertEquals(site.url("/read/bbb222"), resultado.nextChapterUrl());
    }

    @Test
    void usaOLinkRelNextDoCabecalho() {
        site.pagina("/m/y/chapter-49-a1b2", "<link rel='next' href='chapter-50-zz9'>").pagina("/m/y/chapter-50-zz9", "ok");

        Verificacao resultado = verificador.verificar(manga("/m/y/chapter-{cap}-a1b2", "49"));

        assertEquals(site.url("/m/y/chapter-50-zz9"), resultado.nextChapterUrl());
    }

    @Test
    void enderecoExatoQueNaoAbreNaoEGuardado() {
        site.pagina("/m/y/chapter-49-a1b2", "<a href='/m/y/chapter-50-zz9'>Next</a>");

        Verificacao resultado = verificador.verificar(manga("/m/y/chapter-{cap}-a1b2", "49"));

        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, resultado.situacao());
        assertNull(resultado.nextChapterUrl());
    }

    // ------------------------------------------------------------------ links que nao devem ser seguidos

    @Test
    void ignoraLinksDeOutrasObrasEDeOutrosSites() {
        site.pagina("/manga/minha-obra/chapter/49", "<aside><a href='/manga/outra-obra-qualquer/chapter/50'>Outra obra - cap 50</a></aside>"
                + "<a href='https://outro-site.com/manga/minha-obra/chapter/50'>Next</a>"
                + "<a href='javascript:void(0)'>Next</a> <a href='#'>Próximo</a>"
                + "<a href='/manga/minha-obra/chapter/49#comentarios'>Next page of comments</a>");
        Manga manga = manga("/manga/minha-obra/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, resultado.situacao());
        assertNull(resultado.nextChapterUrl());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertFalse(site.visitas().contains("/manga/outra-obra-qualquer/chapter/50"));
    }

    @Test
    void preferOLinkDaMesmaObraAoDeOutra() {
        site.pagina("/manga/minha-obra/chapter/49", "<a href='/manga/outra-obra-qualquer/chapter/50'>Next</a>"
                        + "<a href='/manga/minha-obra/chapter/50'>&raquo;</a>")
                .pagina("/manga/minha-obra/chapter/50", "ok").pagina("/manga/outra-obra-qualquer/chapter/50", "ok");
        Manga manga = manga("/manga/minha-obra/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        // "Next" de outra obra tem o numero e a dica, mas o da mesma obra bate com o modelo
        assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
        assertTrue(resultado.nextChapterUrl() == null || resultado.nextChapterUrl().contains("minha-obra"), resultado.nextChapterUrl());
    }

    // ------------------------------------------------------------------ capitulo que nao existe

    @Test
    void avisaQuandoOProximoCapituloAindaNaoExiste() {
        site.pagina("/manga/x/chapter/49", "<a href='/manga/x/chapter/48'>Prev</a>");

        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, verificador.verificar(manga("/manga/x/chapter/{cap}", "49")).situacao());
    }

    @Test
    void paginaInicialNoLugarDoCapituloContaComoNaoEncontrado() {
        // muitos sites nao respondem 404: mandam para a pagina inicial ou para a pagina da obra
        site.pagina("/manga/x/chapter/49", "sem links").redireciona("/manga/x/chapter/50", "/manga/x").pagina("/manga/x", "pagina da obra");
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
    }

    @Test
    void linkQuebradoQuandoNemOCapituloAtualAbre() {
        assertEquals(SituacaoDoLink.LINK_QUEBRADO, verificador.verificar(manga("/manga/x/chapter/{cap}", "49")).situacao());
    }

    @Test
    void linkQuebradoQuandoOCapituloAtualCaiNaPaginaInicial() {
        site.redireciona("/manga/x/chapter/49", "/").redireciona("/manga/x/chapter/50", "/").pagina("/", "inicio");
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.LINK_QUEBRADO, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
    }

    @Test
    void mangaNaoComecadoNaoEAcusadoDeLinkQuebrado() {
        // capitulo 0 nao existe; so da para dizer que o 1 nao foi encontrado
        assertEquals(SituacaoDoLink.NAO_ENCONTRADO, verificador.verificar(manga("/manga/x/chapter/{cap}", "0")).situacao());

        site.pagina("/manga/x/chapter/1", "ok");
        assertEquals(SituacaoDoLink.DISPONIVEL, verificador.verificar(manga("/manga/x/chapter/{cap}", "0")).situacao());
    }

    // ------------------------------------------------------------------ site que nao deixa verificar

    @ParameterizedTest
    @ValueSource(ints = {403, 429, 500, 503})
    void siteQueBloqueiaNaoMudaNada(int status) {
        site.restoResponde(status);
        Manga manga = manga("/manga/x/chapter/{cap}", "49");

        Verificacao resultado = verificador.verificar(manga);

        assertEquals(SituacaoDoLink.NAO_VERIFICADO, resultado.situacao());
        assertEquals(manga.getChapterLinkModel(), resultado.chapterLinkModel());
        assertNull(resultado.nextChapterUrl());
    }

    @Test
    void siteForaDoArNaoMudaNada() {
        Manga manga = manga("/manga/x/chapter/{cap}", "49");
        site.close();

        assertEquals(SituacaoDoLink.NAO_VERIFICADO, verificador.verificar(manga).situacao());
    }

    @Test
    void redirecionamentoSemFimNaoTrava() {
        site.redireciona("/manga/x/chapter/49", "/manga/x/chapter/49").redireciona("/manga/x/chapter/50", "/manga/x/chapter/50");

        assertEquals(SituacaoDoLink.NAO_VERIFICADO, verificador.verificar(manga("/manga/x/chapter/{cap}", "49")).situacao());
        assertTrue(site.visitas().size() <= 14, "parou de seguir os redirecionamentos");
    }

    // ------------------------------------------------------------------ modelo a partir do endereco

    @ParameterizedTest
    @CsvSource({
            "https://s.com/comics/obra-bd5bdaf8/chapter/174,   174,  HIFEN,     https://s.com/comics/obra-bd5bdaf8/chapter/{cap}",
            "https://s.com/manga/x/capitulo-48-5/,             48.5, HIFEN,     https://s.com/manga/x/capitulo-{cap}/",
            "https://s.com/manga/x/cap48.5,                    48.5, PONTO,     https://s.com/manga/x/cap{cap}",
            "https://s.com/ler?manga=7&cap=12,                 12,   HIFEN,     https://s.com/ler?manga=7&cap={cap}",
            "https://s.com/m/y/chapter-50-zz9,                 50,   HIFEN,     https://s.com/m/y/chapter-{cap}-zz9",
            "https://s.com/obra-174/chapter/174,               174,  HIFEN,     https://s.com/obra-174/chapter/{cap}",
            "https://174.com/obra/chapter/174.html,            174,  HIFEN,     https://174.com/obra/chapter/{cap}.html",
    })
    void derivaOModeloTrocandoONumeroDoCapitulo(String endereco, BigDecimal capitulo, ChapterDecimalFormat formato, String esperado) {
        assertEquals(esperado, ChapterLink.derivarModelo(endereco, capitulo, formato));
    }

    @ParameterizedTest
    @CsvSource({
            "https://s.com/comics/obra-bd5bdaf8/chapter/1745, 174",  // outro capitulo
            "https://s.com/comics/obra-bd5bdaf8/chapter/2174, 174",
            "https://s.com/comics/obra-a174b/,                174",  // numero dentro de um id
            "https://s.com/,                                  174",
            "https://174.com/obra,                            174",  // numero so no dominio
            "https://s.com,                                   174",
    })
    void naoDerivaModeloDeEnderecoQueNaoEDoCapitulo(String endereco, BigDecimal capitulo) {
        assertNull(ChapterLink.derivarModelo(endereco, capitulo, ChapterDecimalFormat.HIFEN));
    }

    @Test
    void comparaEnderecosIgnorandoDetalhes() {
        assertTrue(ChapterLink.mesmoEndereco("https://Site.com/a/b/", "https://site.com/a/b#topo"));
        assertFalse(ChapterLink.mesmoEndereco("https://site.com/a/B", "https://site.com/a/b"));
        assertFalse(ChapterLink.mesmoEndereco("https://site.com/a", null));
    }

    // ------------------------------------------------------------------ so sites publicos

    @ParameterizedTest
    @ValueSource(strings = {
            "http://127.0.0.1/",
            "http://localhost/",
            "http://[::1]/",
            "http://0.0.0.0/",
            "http://10.0.0.5/admin",
            "http://172.16.0.1/",
            "http://192.168.1.1/",
            "http://169.254.169.254/latest/meta-data/", // metadados da nuvem
            "http://100.64.0.1/",
            "http://[fd00::1]/",
            "http://[fe80::1]/",
            "http://[::ffff:127.0.0.1]/",
            "http://93.184.216.34:22/",                 // porta que nao e de site
            "http://93.184.216.34:8080/",
            "ftp://93.184.216.34/",
            "file:///etc/passwd",
    })
    void recusaEnderecosDaRedeInterna(String endereco) {
        BuscadorHttp buscador = new BuscadorHttp();

        assertFalse(buscador.destinoPermitido(URI.create(endereco)), endereco);
        assertEquals(0, buscador.buscar(endereco).status());
    }

    @Test
    void aceitaEnderecoPublico() {
        assertTrue(new BuscadorHttp().destinoPermitido(URI.create("https://93.184.216.34/manga/x/chapter/1")));
        assertTrue(new BuscadorHttp().destinoPermitido(URI.create("http://[2606:2800:220:1:248:1893:25c8:1946]/")));
    }

    @Test
    void emProducaoNaoAbreOSiteFalsoLocal() {
        site.pagina("/manga/x/chapter/49", "<a href='/manga/x/chapter/50'>Next</a>").pagina("/manga/x/chapter/50", "ok");

        Verificacao resultado = new VerificadorDeLink(new BuscadorHttp()).verificar(manga("/manga/x/chapter/{cap}", "49"));

        assertEquals(SituacaoDoLink.NAO_VERIFICADO, resultado.situacao());
        assertTrue(site.visitas().isEmpty());
    }
}
