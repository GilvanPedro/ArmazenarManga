package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.service.DadosManga;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.ImagemServiceTest;
import br.com.seuapp.mangatracker.service.MangaService;
import com.zaxxer.hikari.HikariDataSource;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Roda contra um Postgres de verdade, que sobe so para os testes. */
class PostgresRepositoryTest {

    static EmbeddedPostgres postgres;
    static String endereco;
    HikariDataSource banco;

    @BeforeAll
    static void subirBanco() throws IOException {
        postgres = EmbeddedPostgres.start();
        // mesmo formato de endereco que o Neon entrega
        endereco = "postgresql://postgres:postgres@localhost:" + postgres.getPort() + "/postgres?sslmode=disable&channel_binding=disable";
    }

    @AfterAll
    static void pararBanco() throws IOException {
        postgres.close();
    }

    @BeforeEach
    void setUp() throws Exception {
        banco = BancoPostgres.conectar(endereco);
        try (Connection conexao = banco.getConnection(); Statement comando = conexao.createStatement()) {
            comando.execute("DROP TABLE IF EXISTS mangas, imagens, configuracoes, tentativas_de_login");
        }
    }

    @AfterEach
    void tearDown() {
        banco.close();
    }

    private static Manga novoManga(String titulo, String capitulo) {
        return new Manga(titulo, "capa.png", new ArrayList<>(List.of(new Tag("Ação"), new Tag("Fantasia"))),
                "https://site.com/x/{cap}", ChapterDecimalFormat.PONTO,
                new BigDecimal(capitulo), ReadingStatus.LENDO, "Descrição de " + titulo + " com 'aspas' e \"aspas\"");
    }

    @Test
    void oQueFoiSalvoVoltaIgualEmOutraConexao() {
        Manga manga = novoManga("Solo Leveling", "48.5");
        manga.setReleaseDay(WeekDay.TERCA);
        new PostgresMangaRepository(banco).salvar(manga);

        try (HikariDataSource outro = BancoPostgres.conectar(endereco)) {
            Manga lido = new PostgresMangaRepository(outro).buscarPorId(manga.getId()).orElseThrow();

            assertEquals(manga.getId(), lido.getId());
            assertEquals("Solo Leveling", lido.getTitle());
            assertEquals("capa.png", lido.getImagePath());
            assertEquals(List.of("Ação", "Fantasia"), lido.getTags().stream().map(Tag::getNome).toList());
            assertEquals("https://site.com/x/{cap}", lido.getChapterLinkModel());
            assertEquals(ChapterDecimalFormat.PONTO, lido.getDecimalFormat());
            assertEquals(0, new BigDecimal("48.5").compareTo(lido.getLastChapter()));
            assertEquals(ReadingStatus.LENDO, lido.getReadingStatus());
            assertEquals(WeekDay.TERCA, lido.getReleaseDay());
            assertEquals(manga.getDescription(), lido.getDescription());
        }
    }

    @Test
    void comecaVazioEIdDesconhecidoNaoExiste() {
        PostgresMangaRepository repository = new PostgresMangaRepository(banco);

        assertTrue(repository.listarTodos().isEmpty());
        assertTrue(repository.buscarPorId(UUID.randomUUID()).isEmpty());
        assertTrue(repository.buscarPorId(null).isEmpty());
        repository.excluir(UUID.randomUUID()); // nao da erro
    }

    @Test
    void salvarComMesmoIdSubstituiSemMudarAOrdem() {
        PostgresMangaRepository repository = new PostgresMangaRepository(banco);
        Manga primeiro = novoManga("C", "1");
        repository.salvar(primeiro);
        repository.salvar(novoManga("A", "1"));
        repository.salvar(novoManga("B", "1"));

        repository.salvar(new Manga(primeiro.getId(), "C editado", "capa.png", new ArrayList<>(),
                "https://site.com/{cap}", ChapterDecimalFormat.HIFEN, new BigDecimal("2"), ReadingStatus.DROPADO, ""));

        List<Manga> todos = repository.listarTodos();
        assertEquals(List.of("C editado", "A", "B"), todos.stream().map(Manga::getTitle).toList());
        assertEquals(ReadingStatus.DROPADO, todos.get(0).getReadingStatus());
    }

    @Test
    void excluirRemoveSoOMangaPedido() {
        PostgresMangaRepository repository = new PostgresMangaRepository(banco);
        Manga fica = novoManga("Fica", "1");
        Manga sai = novoManga("Sai", "1");
        repository.salvar(fica);
        repository.salvar(sai);

        repository.excluir(sai.getId());

        assertTrue(repository.buscarPorId(sai.getId()).isEmpty());
        assertTrue(repository.buscarPorId(fica.getId()).isPresent());
    }

    @Test
    void abrirDeNovoNaoApagaOsDados() {
        new PostgresMangaRepository(banco).salvar(novoManga("Solo Leveling", "1"));
        new PostgresImagemRepository(banco).salvar("a.png", new byte[]{1});

        assertEquals(1, new PostgresMangaRepository(banco).listarTodos().size());
        assertTrue(new PostgresImagemRepository(banco).existe("a.png"));
    }

    @Test
    void guardaAsImagensNoBanco() {
        PostgresImagemRepository repository = new PostgresImagemRepository(banco);
        byte[] grande = new byte[ImagemService.TAMANHO_MAXIMO];
        grande[grande.length - 1] = 7;

        repository.salvar("a.png", ImagemServiceTest.PNG);
        repository.salvar("grande.png", grande);

        assertTrue(repository.existe("a.png"));
        assertArrayEquals(ImagemServiceTest.PNG, repository.buscar("a.png").orElseThrow());
        assertArrayEquals(grande, repository.buscar("grande.png").orElseThrow());
        assertFalse(repository.existe("b.png"));
        assertTrue(repository.buscar("b.png").isEmpty());

        repository.excluir("a.png");
        repository.excluir("nao-existe.png");
        assertFalse(repository.existe("a.png"));
        assertTrue(repository.existe("grande.png"));
    }

    @Test
    void oServiceFuncionaIgualComOBanco() {
        ImagemService imagemService = new ImagemService(new PostgresImagemRepository(banco));
        MangaService service = new MangaService(new PostgresMangaRepository(banco), imagemService);
        String capa = imagemService.salvar(new ByteArrayInputStream(ImagemServiceTest.PNG));

        Manga salvo = service.salvarManga(new DadosManga("Ação Total", capa, List.of("Ação"),
                "https://site.com/x/capitulo-{cap}", null, new BigDecimal("48.5"), ReadingStatus.LENDO, "Texto"));
        service.salvarManga(new DadosManga("One Piece", "https://site.com/capa.png", null,
                "https://site.com/op/{cap}", null, BigDecimal.ONE, ReadingStatus.LER, null));

        assertEquals(List.of("Ação Total"), service.listarMangas("acao", null).stream().map(Manga::getTitle).toList());
        assertEquals(List.of("One Piece"), service.listarMangas(null, ReadingStatus.LER).stream().map(Manga::getTitle).toList());
        assertArrayEquals(ImagemServiceTest.PNG, imagemService.carregar(capa));

        Manga atualizado = service.atualizarProgresso(salvo.getId(), new BigDecimal("50"), ReadingStatus.CONCLUIDO);
        assertEquals("https://site.com/x/capitulo-51", atualizado.linkProximoCapitulo());
        assertEquals(0, new BigDecimal("50").compareTo(service.buscarPorId(salvo.getId()).getLastChapter()));
        assertEquals(ReadingStatus.CONCLUIDO, service.buscarPorId(salvo.getId()).getReadingStatus());

        service.excluirManga(salvo.getId());
        assertThrows(NotFoundException.class, () -> service.buscarPorId(salvo.getId()));
        assertFalse(imagemService.existe(capa)); // a capa sai do banco junto com o manga
        assertEquals(1, service.listarMangas(null, null).size());
    }

    @Test
    void importaOsArquivosQuandoOBancoEstaVazio(@TempDir Path pasta) {
        ArquivoImagemRepository imagensDaPasta = new ArquivoImagemRepository(pasta.resolve("imagens"));
        String capa = UUID.randomUUID() + ".png";
        imagensDaPasta.salvar(capa, ImagemServiceTest.PNG);
        JsonMangaRepository arquivo = new JsonMangaRepository(pasta.resolve("mangas.json"));
        Manga comCapaEnviada = new Manga("Com capa", capa, new ArrayList<>(List.of(new Tag("Ação"))),
                "https://site.com/x/{cap}", ChapterDecimalFormat.UNDERLINE, new BigDecimal("10.5"), ReadingStatus.HIATUS, "Texto");
        Manga comLink = new Manga("Com link", "https://site.com/capa.png", new ArrayList<>(),
                "https://site.com/y/{cap}", ChapterDecimalFormat.HIFEN, BigDecimal.ONE, ReadingStatus.LENDO, "");
        arquivo.salvar(comCapaEnviada);
        arquivo.salvar(comLink);
        PostgresMangaRepository mangas = new PostgresMangaRepository(banco);
        PostgresImagemRepository imagens = new PostgresImagemRepository(banco);

        assertEquals(2, ImportacaoDeArquivos.importarSeBancoVazio(pasta, mangas, imagens));

        assertEquals(List.of("Com capa", "Com link"), mangas.listarTodos().stream().map(Manga::getTitle).toList());
        Manga importado = mangas.buscarPorId(comCapaEnviada.getId()).orElseThrow();
        assertEquals(ChapterDecimalFormat.UNDERLINE, importado.getDecimalFormat());
        assertEquals("https://site.com/x/10_5", importado.linkUltimoCapitulo());
        assertArrayEquals(ImagemServiceTest.PNG, imagens.buscar(capa).orElseThrow());
        assertTrue(Files.exists(pasta.resolve("mangas.json"))); // os arquivos nao sao apagados

        // segunda vez: o banco ja tem dados, entao nada e importado nem sobrescrito
        mangas.excluir(comLink.getId());
        assertEquals(0, ImportacaoDeArquivos.importarSeBancoVazio(pasta, mangas, imagens));
        assertEquals(1, mangas.listarTodos().size());
    }

    @Test
    void semArquivosNaoImportaNada(@TempDir Path pasta) {
        assertEquals(0, ImportacaoDeArquivos.importarSeBancoVazio(pasta,
                new PostgresMangaRepository(banco), new PostgresImagemRepository(banco)));
    }

    @Test
    void recusaEnderecoDeBancoInvalido() {
        assertThrows(IllegalArgumentException.class, () -> BancoPostgres.conectar("isso nao e um endereco"));
        assertThrows(IllegalArgumentException.class, () -> BancoPostgres.conectar("postgresql:///banco"));
    }

    @Test
    void segredoDoLoginFicaNoBancoEEOMesmoNasProximasVezes() {
        byte[] primeiro = SegredoDaSessao.doBanco(banco);
        assertEquals(32, primeiro.length);
        // outro servidor (ou o mesmo, reiniciado) le o mesmo segredo
        try (HikariDataSource outro = BancoPostgres.conectar(endereco)) {
            org.junit.jupiter.api.Assertions.assertArrayEquals(primeiro, SegredoDaSessao.doBanco(outro));
        }
    }

    @Test
    void imagensExistentesSaoProcuradasSoPelosNomesPedidosENaConta() {
        PostgresImagemRepository imagens = new PostgresImagemRepository(banco);
        imagens.salvar("a.png", new byte[]{1});
        imagens.salvar("a-mini.webp", new byte[]{2});
        new PostgresImagemRepository(banco, "outra").salvar("b-mini.webp", new byte[]{3});

        assertEquals(java.util.Set.of("a-mini.webp"), imagens.existentes(List.of("a-mini.webp", "a-mini.jpg", "b-mini.webp")));
        assertEquals(java.util.Set.of(), imagens.existentes(List.of()));
        // a capa de outra conta nao existe para esta, nem para ler nem para apagar
        assertTrue(imagens.buscar("b-mini.webp").isEmpty());
        imagens.excluir("b-mini.webp");
        assertTrue(new PostgresImagemRepository(banco, "outra").existe("b-mini.webp"));
    }

    @Test
    void cadaContaSoVeEMexeNosPropriosMangas() {
        PostgresMangaRepository minha = new PostgresMangaRepository(banco);
        PostgresMangaRepository outra = new PostgresMangaRepository(banco, "outra");
        Manga meu = novoManga("Meu", "1");
        Manga dela = novoManga("Dela", "1");
        minha.salvar(meu);
        outra.salvar(dela);

        assertEquals(List.of("Meu"), minha.listarTodos().stream().map(Manga::getTitle).toList());
        assertTrue(minha.buscarPorId(dela.getId()).isEmpty());
        assertEquals(1, minha.contar(ConsultaDeMangas.todos(null, null, null, null)));
        minha.excluir(dela.getId());
        assertTrue(outra.buscarPorId(dela.getId()).isPresent());
        // gravar com o mesmo id nao sobrescreve o manga da outra conta
        minha.salvar(new Manga(dela.getId(), "Tomado", "capa.png", new ArrayList<>(), "https://site.com/{cap}", ChapterDecimalFormat.HIFEN,
                BigDecimal.ONE, ReadingStatus.LENDO, ""));
        assertEquals("Dela", outra.buscarPorId(dela.getId()).orElseThrow().getTitle());
    }

    @Test
    void aListaFeitaPeloBancoEIgualAFeitaEmMemoria() {
        PostgresMangaRepository repository = new PostgresMangaRepository(banco);
        String[] titulos = {"Ação Total", "abara", "Berserk", "Zetman", "Ação total", "Solo Leveling", "solo", "Água", "Ébano", "Murim Lord"};
        ReadingStatus[] status = ReadingStatus.values();
        for (int i = 0; i < 40; i++) {
            Manga manga = new Manga(titulos[i % titulos.length] + (i < 10 ? "" : " " + i), "capa.png",
                    new ArrayList<>(i % 3 == 0 ? List.of(new Tag("Murim"), new Tag("Ação")) : List.of(new Tag("Romance"))),
                    "https://site.com/{cap}", ChapterDecimalFormat.HIFEN, new BigDecimal((i * 7) % 13), status[i % status.length], "");
            manga.setRating(i % 4 == 0 ? null : i % 11);
            manga.setFavorite(i % 5 == 0);
            repository.salvar(manga);
        }
        // a versao em memoria (a do arquivo JSON) e a referencia
        MangaRepository emMemoria = new MangaRepository() {
            public void salvar(Manga manga) { }
            public java.util.Optional<Manga> buscarPorId(UUID id) { return java.util.Optional.empty(); }
            public List<Manga> listarTodos() { return repository.listarTodos(); }
            public void excluir(UUID id) { }
        };
        for (br.com.seuapp.mangatracker.domain.OrdemDaLista ordem : br.com.seuapp.mangatracker.domain.OrdemDaLista.values()) {
            for (ConsultaDeMangas consulta : List.of(
                    ConsultaDeMangas.todos(null, null, null, ordem),
                    ConsultaDeMangas.todos("ACAO", null, null, ordem),
                    ConsultaDeMangas.todos(null, ReadingStatus.LENDO, null, ordem),
                    ConsultaDeMangas.todos(null, null, "murim", ordem),
                    ConsultaDeMangas.todos("s", ReadingStatus.LER, "romance", ordem),
                    ConsultaDeMangas.todos(null, null, null, ordem).pedaco(7, 14),
                    ConsultaDeMangas.todos(null, null, null, ordem).pedaco(7, 400))) {
                PaginaDeMangas doBanco = repository.consultar(consulta);
                PaginaDeMangas daMemoria = emMemoria.consultar(consulta);
                assertEquals(daMemoria.mangas().stream().map(Manga::getId).toList(), doBanco.mangas().stream().map(Manga::getId).toList(), ordem + " " + consulta);
                assertEquals(daMemoria.total(), doBanco.total(), ordem + " " + consulta);
                assertEquals(emMemoria.contar(consulta), repository.contar(consulta), ordem + " " + consulta);
            }
        }
    }

    @Test
    void bancoAntigoGanhaAsColunasNovasSemPerderNada() throws Exception {
        // como o banco estava antes: sem conta e sem colunas de busca
        try (Connection conexao = banco.getConnection(); Statement comando = conexao.createStatement()) {
            comando.execute("CREATE TABLE mangas (id UUID PRIMARY KEY, ordem BIGSERIAL, dados JSONB NOT NULL)");
            comando.execute("CREATE TABLE imagens (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL)");
            comando.execute("INSERT INTO mangas (id, dados) VALUES ('" + UUID.randomUUID() + "', '{\"title\": \"Ação Antiga\", \"tags\": [\"Murim\", \"murim \", \"Ação\"], "
                    + "\"imagePath\": \"capa.png\", \"chapterLinkModel\": \"https://site.com/{cap}\", \"lastChapter\": 3, \"readingStatus\": \"LENDO\"}')");
            comando.execute("INSERT INTO imagens (nome, conteudo) VALUES ('velha.png', '\\x01')");
        }

        PostgresMangaRepository repository = new PostgresMangaRepository(banco);

        assertEquals(List.of("Ação Antiga"), repository.listarTodos().stream().map(Manga::getTitle).toList());
        assertEquals(1, repository.consultar(ConsultaDeMangas.todos("acao", null, "MURIM", null)).total());
        assertTrue(new PostgresImagemRepository(banco).existe("velha.png"), "as capas antigas ficam na conta principal");
        try (Connection conexao = banco.getConnection(); Statement comando = conexao.createStatement();
             java.sql.ResultSet linha = comando.executeQuery("SELECT conta, titulo_busca, tags_busca FROM mangas")) {
            linha.next();
            assertEquals("principal", linha.getString(1));
            assertEquals("acao antiga", linha.getString(2));
            assertEquals(List.of("murim", "acao"), List.of((String[]) linha.getArray(3).getArray()));
        }
        // preparar de novo nao muda nada
        new PostgresMangaRepository(banco);
        assertEquals(1, repository.listarTodos().size());
    }
}
