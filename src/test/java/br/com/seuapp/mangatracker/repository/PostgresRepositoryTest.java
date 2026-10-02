package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
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
            comando.execute("DROP TABLE IF EXISTS mangas, imagens");
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
    void recusaEnderecoDeBancoInvalido() {
        assertThrows(IllegalArgumentException.class, () -> BancoPostgres.conectar("isso nao e um endereco"));
        assertThrows(IllegalArgumentException.class, () -> BancoPostgres.conectar("postgresql:///banco"));
    }
}
