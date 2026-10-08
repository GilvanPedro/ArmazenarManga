package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidChapterException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidReleaseDayException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.NullInformationsException;
import br.com.seuapp.mangatracker.repository.JsonMangaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MangaServiceTest {

    private static final String CAPA = "https://site.com/capa.png";
    private static final String LINK = "https://site-a.com/manga/solo-leveling/capitulo-{cap}";

    @TempDir
    Path pasta;
    JsonMangaRepository repository;
    ImagemService imagemService;
    MangaService service;

    @BeforeEach
    void setUp() {
        repository = new JsonMangaRepository(pasta.resolve("mangas.json"));
        imagemService = new ImagemService(pasta.resolve("imagens"));
        service = new MangaService(repository, imagemService, new Random(42));
    }

    private static DadosManga dados(String titulo, String capitulo, ReadingStatus status) {
        return new DadosManga(titulo, CAPA, List.of("Ação"), LINK, ChapterDecimalFormat.HIFEN,
                new BigDecimal(capitulo), status, "Uma descrição");
    }

    private String enviarImagem() {
        return imagemService.salvar(new ByteArrayInputStream(ImagemServiceTest.PNG));
    }

    private static List<String> titulos(List<Manga> mangas) {
        return mangas.stream().map(Manga::getTitle).toList();
    }

    // ------------------------------------------------------------------ cadastro

    @Test
    void cadastraEPersisteOManga() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48.5", ReadingStatus.LENDO));

        Manga lido = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow();
        assertEquals("Solo Leveling", lido.getTitle());
        assertEquals(new BigDecimal("48.5"), lido.getLastChapter());
        assertEquals(ReadingStatus.LENDO, lido.getReadingStatus());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-48-5", lido.linkUltimoCapitulo());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-49", lido.linkProximoCapitulo());
    }

    @Test
    void cadaCadastroGanhaUmIdDiferente() {
        Manga a = service.salvarManga(dados("A", "1", ReadingStatus.LENDO));
        Manga b = service.salvarManga(dados("A", "1", ReadingStatus.LENDO));

        assertNotEquals(a.getId(), b.getId());
        assertEquals(2, service.listarMangas(null, null).size());
    }

    @Test
    void aceitaCapituloZero() {
        Manga salvo = service.salvarManga(dados("Novo", "0", ReadingStatus.LER));

        assertEquals(0, salvo.getLastChapter().signum());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-1", salvo.linkProximoCapitulo());
    }

    @Test
    void tagsDescricaoEFormatoSaoOpcionais() {
        Manga salvo = service.salvarManga(new DadosManga("Simples", CAPA, null, LINK, null,
                BigDecimal.ONE, ReadingStatus.LENDO, null));

        assertTrue(salvo.getTags().isEmpty());
        assertEquals("", salvo.getDescription());
        assertEquals(ChapterDecimalFormat.HIFEN, salvo.getDecimalFormat());
    }

    @Test
    void limpaEspacosETagsRepetidas() {
        Manga salvo = service.salvarManga(new DadosManga("  Solo Leveling ", CAPA,
                Arrays.asList(" Ação ", "ação", "", null, "Fantasia"), " " + LINK + " ", null,
                BigDecimal.ONE, ReadingStatus.LENDO, "  texto  "));

        assertEquals("Solo Leveling", salvo.getTitle());
        assertEquals(List.of("Ação", "Fantasia"), salvo.getTags().stream().map(Tag::getNome).toList());
        assertEquals(LINK, salvo.getChapterLinkModel());
        assertEquals("texto", salvo.getDescription());
    }

    @Test
    void naoCadastraSemCamposObrigatorios() {
        BigDecimal cap = BigDecimal.ONE;
        ReadingStatus status = ReadingStatus.LENDO;

        assertThrows(NullInformationsException.class, () -> service.salvarManga(null));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga(null, CAPA, null, LINK, null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga("   ", CAPA, null, LINK, null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga("T", null, null, LINK, null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga("T", " ", null, LINK, null, cap, status, "")));
        assertThrows(InvalidLinkException.class, () -> service.salvarManga(new DadosManga("T", CAPA, null, null, null, cap, status, "")));
        assertThrows(InvalidLinkException.class, () -> service.salvarManga(new DadosManga("T", CAPA, null, "", null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga("T", CAPA, null, LINK, null, null, status, "")));
        assertThrows(NullInformationsException.class, () -> service.salvarManga(new DadosManga("T", CAPA, null, LINK, null, cap, null, "")));

        assertTrue(repository.listarTodos().isEmpty());
    }

    @Test
    void naoCadastraCapituloNegativo() {
        assertThrows(InvalidChapterException.class, () -> service.salvarManga(dados("T", "-1", ReadingStatus.LENDO)));
        assertThrows(InvalidChapterException.class, () -> service.salvarManga(dados("T", "-0.5", ReadingStatus.LENDO)));
        assertTrue(repository.listarTodos().isEmpty());
    }

    @Test
    void naoCadastraLinkSemMarcadorDoCapitulo() {
        DadosManga semMarcador = new DadosManga("T", CAPA, null, "https://site.com/capitulo-48", null,
                BigDecimal.ONE, ReadingStatus.LENDO, "");

        assertThrows(InvalidLinkException.class, () -> service.salvarManga(semMarcador));
    }

    @Test
    void naoCadastraComImagemQueNaoFoiEnviada() {
        DadosManga semImagem = new DadosManga("T", "capa-que-nao-existe.png", null, LINK, null,
                BigDecimal.ONE, ReadingStatus.LENDO, "");

        assertThrows(InvalidImageException.class, () -> service.salvarManga(semImagem));
    }

    @Test
    void cadastraComImagemEnviada() {
        String imagem = enviarImagem();

        Manga salvo = service.salvarManga(new DadosManga("T", imagem, null, LINK, null,
                BigDecimal.ONE, ReadingStatus.LENDO, ""));

        assertEquals(imagem, salvo.getImagePath());
    }

    // ------------------------------------------------------------------ busca

    @Test
    void buscarPorIdDesconhecidoLancaNaoEncontrado() {
        assertThrows(NotFoundException.class, () -> service.buscarPorId(UUID.randomUUID()));
    }

    @Test
    void buscaPorParteDoTituloSemDiferenciarMaiusculasNemAcentos() {
        service.salvarManga(dados("Solo Leveling", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("Ação Total", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("One Piece", "1", ReadingStatus.LENDO));

        assertEquals(List.of("Solo Leveling"), titulos(service.listarMangas("solo", null)));
        assertEquals(List.of("Solo Leveling"), titulos(service.listarMangas("  LEVEL ", null)));
        assertEquals(List.of("Ação Total"), titulos(service.listarMangas("acao", null)));
        assertEquals(List.of("Ação Total"), titulos(service.listarMangas("AÇÃO", null)));
        assertEquals(List.of(), titulos(service.listarMangas("naruto", null)));
        assertEquals(3, service.listarMangas("", null).size());
        assertEquals(3, service.listarMangas(null, null).size());
    }

    @Test
    void filtraPorStatus() {
        service.salvarManga(dados("Lendo 1", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("Dropado", "1", ReadingStatus.DROPADO));
        service.salvarManga(dados("Lendo 2", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("Em hiato", "1", ReadingStatus.HIATUS));

        assertEquals(List.of("Lendo 1", "Lendo 2"), titulos(service.listarMangas(null, ReadingStatus.LENDO)));
        assertEquals(List.of("Dropado"), titulos(service.listarMangas(null, ReadingStatus.DROPADO)));
        assertEquals(List.of("Em hiato"), titulos(service.listarMangas(null, ReadingStatus.HIATUS)));
        assertEquals(List.of(), titulos(service.listarMangas(null, ReadingStatus.CONCLUIDO)));
        assertEquals(List.of("Lendo 2"), titulos(service.listarMangas("2", ReadingStatus.LENDO)));
    }

    // ------------------------------------------------------------------ progresso

    @Test
    void atualizaSoOCapituloEOLinkAcompanha() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        Manga atualizado = service.atualizarProgresso(salvo.getId(), new BigDecimal("50.5"), null);

        assertEquals(new BigDecimal("50.5"), atualizado.getLastChapter());
        assertEquals(ReadingStatus.LENDO, atualizado.getReadingStatus());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-50-5", atualizado.linkUltimoCapitulo());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-51", atualizado.linkProximoCapitulo());
        assertEquals(new BigDecimal("50.5"), service.buscarPorId(salvo.getId()).getLastChapter());
    }

    @Test
    void atualizaSoOStatus() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        Manga atualizado = service.atualizarProgresso(salvo.getId(), null, ReadingStatus.DROPADO);

        assertEquals(new BigDecimal("48"), atualizado.getLastChapter());
        assertEquals(ReadingStatus.DROPADO, atualizado.getReadingStatus());
    }

    @Test
    void progressoNaoMexeNoRestoDoManga() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        Manga atualizado = service.atualizarProgresso(salvo.getId(), new BigDecimal("49"), ReadingStatus.CONCLUIDO);

        assertEquals("Solo Leveling", atualizado.getTitle());
        assertEquals(CAPA, atualizado.getImagePath());
        assertEquals(LINK, atualizado.getChapterLinkModel());
        assertEquals("Uma descrição", atualizado.getDescription());
        assertEquals(List.of("Ação"), atualizado.getTags().stream().map(Tag::getNome).toList());
    }

    @Test
    void progressoInvalidoNaoAlteraOManga() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        assertThrows(InvalidChapterException.class, () -> service.atualizarProgresso(salvo.getId(), new BigDecimal("-1"), ReadingStatus.DROPADO));
        assertThrows(NullInformationsException.class, () -> service.atualizarProgresso(salvo.getId(), null, null));
        assertThrows(NotFoundException.class, () -> service.atualizarProgresso(UUID.randomUUID(), BigDecimal.ONE, null));

        Manga atual = service.buscarPorId(salvo.getId());
        assertEquals(new BigDecimal("48"), atual.getLastChapter());
        assertEquals(ReadingStatus.LENDO, atual.getReadingStatus());
    }

    // ------------------------------------------------------------------ edicao geral

    @Test
    void edicaoGeralTrocaTodasAsInformacoes() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        Manga editado = service.editarManga(salvo.getId(), new DadosManga("Solo Leveling: Ragnarok",
                "https://outro.com/capa.jpg", List.of("Sequência"), "https://site-b.com/slr/{cap}",
                ChapterDecimalFormat.UNDERLINE, new BigDecimal("3.5"), ReadingStatus.HIATUS, "Nova descrição"));

        assertEquals(salvo.getId(), editado.getId());
        Manga lido = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow();
        assertEquals("Solo Leveling: Ragnarok", lido.getTitle());
        assertEquals("https://outro.com/capa.jpg", lido.getImagePath());
        assertEquals(List.of("Sequência"), lido.getTags().stream().map(Tag::getNome).toList());
        assertEquals(ReadingStatus.HIATUS, lido.getReadingStatus());
        assertEquals("Nova descrição", lido.getDescription());
        assertEquals("https://site-b.com/slr/3_5", lido.linkUltimoCapitulo());
        assertEquals(1, service.listarMangas(null, null).size());
    }

    @Test
    void edicaoInvalidaNaoAlteraOManga() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));
        UUID id = salvo.getId();
        BigDecimal cap = BigDecimal.ONE;
        ReadingStatus status = ReadingStatus.DROPADO;

        assertThrows(NullInformationsException.class, () -> service.editarManga(id, new DadosManga("", CAPA, null, LINK, null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.editarManga(id, new DadosManga("T", "", null, LINK, null, cap, status, "")));
        assertThrows(InvalidLinkException.class, () -> service.editarManga(id, new DadosManga("T", CAPA, null, "", null, cap, status, "")));
        assertThrows(NullInformationsException.class, () -> service.editarManga(id, new DadosManga("T", CAPA, null, LINK, null, null, status, "")));
        assertThrows(InvalidChapterException.class, () -> service.editarManga(id, new DadosManga("T", CAPA, null, LINK, null, new BigDecimal("-3"), status, "")));
        assertThrows(NullInformationsException.class, () -> service.editarManga(id, new DadosManga("T", CAPA, null, LINK, null, cap, null, "")));
        assertThrows(NotFoundException.class, () -> service.editarManga(UUID.randomUUID(), dados("T", "1", status)));

        Manga atual = service.buscarPorId(id);
        assertEquals("Solo Leveling", atual.getTitle());
        assertEquals(new BigDecimal("48"), atual.getLastChapter());
        assertEquals(ReadingStatus.LENDO, atual.getReadingStatus());
    }

    @Test
    void trocarAImagemApagaAAntiga() {
        String antiga = enviarImagem();
        String nova = enviarImagem();
        Manga salvo = service.salvarManga(new DadosManga("T", antiga, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));

        service.editarManga(salvo.getId(), new DadosManga("T", nova, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));

        assertFalse(imagemService.existe(antiga));
        assertTrue(imagemService.existe(nova));
    }

    @Test
    void editarSemTrocarAImagemMantemOArquivo() {
        String imagem = enviarImagem();
        Manga salvo = service.salvarManga(new DadosManga("T", imagem, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));

        service.editarManga(salvo.getId(), new DadosManga("Novo título", imagem, null, LINK, null, BigDecimal.TEN, ReadingStatus.LENDO, ""));
        service.atualizarProgresso(salvo.getId(), new BigDecimal("11"), null);

        assertTrue(imagemService.existe(imagem));
    }

    // ------------------------------------------------------------------ exclusao

    @Test
    void excluiOMangaEASuaImagem() {
        String imagem = enviarImagem();
        Manga salvo = service.salvarManga(new DadosManga("T", imagem, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));

        service.excluirManga(salvo.getId());

        assertThrows(NotFoundException.class, () -> service.buscarPorId(salvo.getId()));
        assertFalse(imagemService.existe(imagem));
        assertThrows(NotFoundException.class, () -> service.excluirManga(salvo.getId()));
    }

    @Test
    void naoApagaImagemUsadaPorOutroManga() {
        String imagem = enviarImagem();
        Manga a = service.salvarManga(new DadosManga("A", imagem, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));
        service.salvarManga(new DadosManga("B", imagem, null, LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));

        service.excluirManga(a.getId());

        assertTrue(imagemService.existe(imagem));
    }

    // ------------------------------------------------------------------ tags

    private Manga comTags(String titulo, String... tags) {
        return service.salvarManga(new DadosManga(titulo, CAPA, List.of(tags), LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""));
    }

    private static List<String> nomes(Manga manga) {
        return manga.getTags().stream().map(Tag::getNome).toList();
    }

    @Test
    void listaGeralTrazAsTagsEmUsoPrimeiroEDepoisAsSugeridas() {
        comTags("A", "Fantasy", "Tower Climbing");
        comTags("B", "Fantasy", "Action");
        comTags("C", "Fantasy", "Action", "Zebra");

        List<TagEmUso> tags = service.listarTags();

        // as mais usadas primeiro; empate em ordem alfabetica
        assertEquals(List.of(new TagEmUso("Fantasy", 3), new TagEmUso("Action", 2), new TagEmUso("Tower Climbing", 1), new TagEmUso("Zebra", 1)),
                tags.subList(0, 4));
        // depois as sugeridas que ainda nao foram usadas, sem repetir as que ja estao em uso
        assertEquals(new TagEmUso("Adventure", 0), tags.get(4));
        assertTrue(tags.contains(new TagEmUso("Isekai", 0)));
        assertEquals(1, tags.stream().filter(tag -> tag.nome().equalsIgnoreCase("fantasy")).count());
        assertEquals(tags.size(), tags.stream().map(tag -> tag.nome().toLowerCase()).distinct().count());
    }

    @Test
    void semMangasAListaGeralSoTemAsSugeridas() {
        List<TagEmUso> tags = service.listarTags();

        assertFalse(tags.isEmpty());
        assertTrue(tags.stream().allMatch(tag -> tag.quantidade() == 0));
        assertEquals("Action", tags.get(0).nome());
    }

    @Test
    void tagQueJaExisteEntraComONomeDaListaGeral() {
        comTags("A", "Tower Climbing", "Fantasy");

        // escrita de outro jeito, e a mesma tag: nao cria uma segunda
        Manga b = comTags("B", "  tower   climbing ", "FANTASY", "isekai", "Minha Tag Nova", "minha tag nova");

        assertEquals(List.of("Tower Climbing", "Fantasy", "Isekai", "Minha Tag Nova"), nomes(b));
        assertEquals(new TagEmUso("Tower Climbing", 2), service.listarTags().stream().filter(tag -> tag.nome().equals("Tower Climbing")).findFirst().orElseThrow());
        // a tag nova passa a fazer parte da lista geral e vale para os proximos
        assertEquals(List.of("Minha Tag Nova"), nomes(comTags("C", "MINHA TAG NOVA")));
        // na edicao geral tambem
        assertEquals(List.of("Fantasy"), nomes(service.editarManga(b.getId(),
                new DadosManga("B", CAPA, List.of("fantasy"), LINK, null, BigDecimal.ONE, ReadingStatus.LENDO, ""))));
    }

    @Test
    void filtraOsMangasPorTag() {
        comTags("A", "Fantasy", "Action");
        comTags("B", "Romance");
        comTags("C", "fantasy");

        assertEquals(List.of("A", "C"), titulos(service.listarMangas(null, null, "Fantasy")));
        assertEquals(List.of("A", "C"), titulos(service.listarMangas(null, null, " FANTASY ")));
        assertEquals(List.of("B"), titulos(service.listarMangas(null, null, "romance")));
        assertEquals(List.of(), titulos(service.listarMangas(null, null, "Horror")));
        assertEquals(List.of(), titulos(service.listarMangas(null, null, "Fant")), "so a tag inteira vale");
        assertEquals(3, service.listarMangas(null, null, null).size());
        assertEquals(3, service.listarMangas(null, null, " ").size());
        // junto com os outros filtros
        assertEquals(List.of("C"), titulos(service.listarMangas("c", ReadingStatus.LENDO, "Fantasy")));
        assertEquals(List.of(), titulos(service.listarMangas(null, ReadingStatus.DROPADO, "Fantasy")));
    }

    @Test
    void semelhantesSaoOsQueDividemMaisTags() {
        Manga base = comTags("Base", "Fantasy", "Action", "Dungeon");
        comTags("Uma em comum", "Fantasy", "Romance");
        comTags("Tres em comum", "dungeon", "ACTION", "Fantasy", "Comedy");
        comTags("Nenhuma", "Romance", "Drama");
        comTags("Duas em comum B", "Action", "Dungeon");
        comTags("Duas em comum A", "Fantasy", "Action");
        comTags("Sem tags");

        assertEquals(List.of("Tres em comum", "Duas em comum A", "Duas em comum B", "Uma em comum"),
                titulos(service.listarSemelhantes(base.getId())));
        assertEquals(List.of(), titulos(service.listarSemelhantes(comTags("Outro sem tags").getId())));
        assertThrows(NotFoundException.class, () -> service.listarSemelhantes(UUID.randomUUID()));
    }

    @Test
    void semelhantesTrazNoMaximoSeis() {
        Manga base = comTags("Base", "Fantasy");
        for (int i = 0; i < 10; i++) {
            comTags("Outro " + i, "Fantasy");
        }

        assertEquals(6, service.listarSemelhantes(base.getId()).size());
    }

    // ------------------------------------------------------------------ verificacao de link

    private MangaService comSite(SiteFalso site) {
        return new MangaService(repository, imagemService, new VerificadorDeLink(new BuscadorHttp(true)));
    }

    private static DadosManga noSite(SiteFalso site, String modelo, String capitulo) {
        return new DadosManga("Teste", CAPA, null, site.url(modelo), null, new BigDecimal(capitulo), ReadingStatus.LENDO, "");
    }

    @Test
    void verificacaoConfirmaSemAlterarOManga() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/manga/x/chapter/49", "<a href='/manga/x/chapter/50'>Next</a>").pagina("/manga/x/chapter/50", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/manga/x/chapter/{cap}", "49"));

            ResultadoVerificacao resultado = comSite.verificarLink(salvo.getId());

            assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
            assertFalse(resultado.linkMudou());
            assertEquals("Link confirmado: o capítulo 50 está disponível.", resultado.mensagem());
            assertEquals(site.url("/manga/x/chapter/50"), resultado.manga().linkProximoCapitulo());
            assertEquals(site.url("/manga/x/chapter/{cap}"), comSite.buscarPorId(salvo.getId()).getChapterLinkModel());
        }
    }

    @Test
    void verificacaoSalvaOModeloNovoQuandoOIdDaObraMuda() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.redireciona("/comics/obra-3ec3b16f/chapter/174", "/comics/obra-bd5bdaf8/chapter/174")
                    .pagina("/comics/obra-bd5bdaf8/chapter/174", "<a href='/comics/obra-bd5bdaf8/chapter/175'>Next</a>")
                    .pagina("/comics/obra-bd5bdaf8/chapter/175", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/comics/obra-3ec3b16f/chapter/{cap}", "174"));

            ResultadoVerificacao resultado = comSite.verificarLink(salvo.getId());

            assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
            assertTrue(resultado.linkMudou());
            assertEquals(site.url("/comics/obra-3ec3b16f/chapter/175"), resultado.linkAnterior());
            assertEquals("O site mudou o endereço e o link foi atualizado. O capítulo 175 está disponível.", resultado.mensagem());
            // ficou salvo, e continua valendo depois de avancar o capitulo
            Manga lido = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow();
            assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/{cap}"), lido.getChapterLinkModel());
            Manga avancou = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("175"), null);
            assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/175"), avancou.linkUltimoCapitulo());
            assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/176"), avancou.linkProximoCapitulo());
            // o resto do manga nao foi mexido
            assertEquals("Teste", lido.getTitle());
            assertEquals(new BigDecimal("174"), lido.getLastChapter());
            assertEquals(ReadingStatus.LENDO, lido.getReadingStatus());
        }
    }

    @Test
    void verificacaoAcompanhaSitesComIdEmCadaCapitulo() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/m/y/chapter-49-a1b2", "<a href='/m/y/chapter-50-zz9'>Next</a>")
                    .pagina("/m/y/chapter-50-zz9", "<a href='/m/y/chapter-51-k3k3'>Next</a>")
                    .pagina("/m/y/chapter-51-k3k3", "ultimo");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/m/y/chapter-{cap}-a1b2", "49"));

            ResultadoVerificacao primeira = comSite.verificarLink(salvo.getId());
            assertTrue(primeira.linkMudou());
            assertEquals(site.url("/m/y/chapter-50-zz9"), primeira.manga().linkProximoCapitulo());
            assertEquals(site.url("/m/y/chapter-50-zz9"), new JsonMangaRepository(pasta.resolve("mangas.json"))
                    .buscarPorId(salvo.getId()).orElseThrow().getNextChapterUrl());

            // li o capitulo 50: o endereco exato dele vira o ponto de partida da proxima verificacao
            Manga avancou = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("50"), null);
            assertEquals(site.url("/m/y/chapter-50-zz9"), avancou.linkUltimoCapitulo());
            assertNull(avancou.getNextChapterUrl());

            ResultadoVerificacao segunda = comSite.verificarLink(salvo.getId());
            assertEquals(SituacaoDoLink.DISPONIVEL, segunda.situacao());
            assertEquals(site.url("/m/y/chapter-51-k3k3"), segunda.manga().linkProximoCapitulo());

            // e no fim da obra avisa que o proximo ainda nao existe, sem inventar link
            comSite.atualizarProgresso(salvo.getId(), new BigDecimal("51"), null);
            ResultadoVerificacao terceira = comSite.verificarLink(salvo.getId());
            assertEquals(SituacaoDoLink.NAO_ENCONTRADO, terceira.situacao());
            assertEquals("O capítulo 52 não foi encontrado no site; ele pode ainda não ter sido lançado.", terceira.mensagem());
            assertNull(terceira.manga().getNextChapterUrl());
        }
    }

    @Test
    void avancarOCapituloJaDescobreESalvaOIdNovo() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/title/obra/6880186-chapter-7", "<a href='/title/obra/6912345-chapter-8'>Next</a>")
                    .pagina("/title/obra/6912345-chapter-8", "<a href='/title/obra/6954321-chapter-9'>Next</a>")
                    .pagina("/title/obra/6954321-chapter-9", "ultimo lancado");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/title/obra/6880186-chapter-{cap}", "7"));

            // so apertei "+1": sem verificar nada antes, o capitulo 8 ja fica com o id certo
            Manga oito = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("8"), null);
            assertEquals(site.url("/title/obra/6912345-chapter-8"), oito.linkUltimoCapitulo());

            Manga nove = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("9"), null);
            assertEquals(site.url("/title/obra/6954321-chapter-9"), nove.linkUltimoCapitulo());
            assertEquals(site.url("/title/obra/6954321-chapter-9"),
                    new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow().getLastChapterUrl());
        }
    }

    @Test
    void avancarOCapituloCorrigeOIdDaObraQueMudou() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.redireciona("/comics/obra-3ec3b16f/chapter/174", "/comics/obra-bd5bdaf8/chapter/174")
                    .pagina("/comics/obra-bd5bdaf8/chapter/174", "<a href='/comics/obra-bd5bdaf8/chapter/175'>Next</a>")
                    .pagina("/comics/obra-bd5bdaf8/chapter/175", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/comics/obra-3ec3b16f/chapter/{cap}", "174"));

            Manga avancou = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("175"), null);

            assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/{cap}"), avancou.getChapterLinkModel());
            assertEquals(site.url("/comics/obra-bd5bdaf8/chapter/175"), avancou.linkUltimoCapitulo());
        }
    }

    @Test
    void avancarOCapituloFuncionaMesmoComOSiteBloqueado() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.restoResponde(403);
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/manga/x/chapter/{cap}", "7"));

            Manga avancou = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("8"), ReadingStatus.HIATUS);

            assertEquals(new BigDecimal("8"), avancou.getLastChapter());
            assertEquals(ReadingStatus.HIATUS, avancou.getReadingStatus());
            assertEquals(site.url("/manga/x/chapter/8"), avancou.linkUltimoCapitulo());
        }
    }

    @Test
    void mudarSoOStatusOuVoltarCapituloNaoConsultaOSite() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/manga/x/chapter/{cap}", "7"));

            comSite.atualizarProgresso(salvo.getId(), null, ReadingStatus.HIATUS);
            comSite.atualizarProgresso(salvo.getId(), new BigDecimal("3"), null);
            comSite.atualizarProgresso(salvo.getId(), new BigDecimal("50"), null);

            assertEquals(List.of(), site.visitas());
        }
    }

    @Test
    void pularCapitulosDescartaOsEnderecosExatos() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/m/y/chapter-49-a1b2", "<a href='/m/y/chapter-50-zz9'>Next</a>").pagina("/m/y/chapter-50-zz9", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/m/y/chapter-{cap}-a1b2", "49"));
            comSite.verificarLink(salvo.getId());

            // mudar so o status mantem o que foi conferido
            assertEquals(site.url("/m/y/chapter-50-zz9"), comSite.atualizarProgresso(salvo.getId(), null, ReadingStatus.HIATUS).getNextChapterUrl());
            // editar sem mexer no link nem no capitulo tambem
            assertEquals(site.url("/m/y/chapter-50-zz9"), comSite.editarManga(salvo.getId(),
                    new DadosManga("Outro título", CAPA, null, site.url("/m/y/chapter-{cap}-a1b2"), null, new BigDecimal("49"), ReadingStatus.LENDO, "")).getNextChapterUrl());

            Manga pulou = comSite.atualizarProgresso(salvo.getId(), new BigDecimal("80"), null);
            assertNull(pulou.getLastChapterUrl());
            assertNull(pulou.getNextChapterUrl());
            assertEquals(site.url("/m/y/chapter-81-a1b2"), pulou.linkProximoCapitulo());
        }
    }

    @Test
    void trocarOLinkNaEdicaoGeralDescartaOsEnderecosExatos() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/m/y/chapter-49-a1b2", "<a href='/m/y/chapter-50-zz9'>Next</a>").pagina("/m/y/chapter-50-zz9", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/m/y/chapter-{cap}-a1b2", "49"));
            comSite.verificarLink(salvo.getId());

            Manga editado = comSite.editarManga(salvo.getId(), noSite(site, "/outro/caminho/{cap}", "49"));

            assertNull(editado.getNextChapterUrl());
            assertEquals(site.url("/outro/caminho/50"), editado.linkProximoCapitulo());
        }
    }

    @Test
    void verificacaoQueFalhaNaoAlteraNada() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            MangaService comSite = comSite(site);
            Manga quebrado = comSite.salvarManga(noSite(site, "/nao/existe/{cap}", "49"));
            site.restoResponde(404);
            ResultadoVerificacao naoAbre = comSite.verificarLink(quebrado.getId());
            assertEquals(SituacaoDoLink.LINK_QUEBRADO, naoAbre.situacao());
            assertEquals("Nem o capítulo 49 nem o 50 abrem com esse link. Confira o link na edição geral.", naoAbre.mensagem());

            site.restoResponde(403);
            ResultadoVerificacao bloqueado = comSite.verificarLink(quebrado.getId());
            assertEquals(SituacaoDoLink.NAO_VERIFICADO, bloqueado.situacao());
            assertFalse(bloqueado.linkMudou());

            assertEquals(site.url("/nao/existe/{cap}"), comSite.buscarPorId(quebrado.getId()).getChapterLinkModel());
            assertThrows(NotFoundException.class, () -> comSite.verificarLink(UUID.randomUUID()));
        }
    }

    @Test
    void semAcessoAOutrosSitesAVerificacaoNaoMudaNada() {
        Manga salvo = service.salvarManga(dados("Solo Leveling", "48", ReadingStatus.LENDO));

        ResultadoVerificacao resultado = service.verificarLink(salvo.getId());

        assertEquals(SituacaoDoLink.NAO_VERIFICADO, resultado.situacao());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-49", resultado.manga().linkProximoCapitulo());
    }

    // ------------------------------------------------------------------ leitura registrada pelo navegador

    private static final String COMIX = "https://comix.to/title/0vx0d-doomsday-wedding/";

    private Manga mangaDoComix() {
        return service.salvarManga(new DadosManga("Doomsday Wedding", CAPA, null, COMIX + "6880186-chapter-{cap}", null,
                new BigDecimal("7"), ReadingStatus.LENDO, "", WeekDay.SEXTA));
    }

    @Test
    void registraOCapituloLidoComOsEnderecosExatos() {
        Manga salvo = mangaDoComix();

        Manga lido = service.registrarLeitura(salvo.getId(), new BigDecimal("8"), " " + COMIX + "6912345-chapter-8 ", COMIX + "6954321-chapter-9");

        assertEquals(new BigDecimal("8"), lido.getLastChapter());
        assertEquals(COMIX + "6912345-chapter-8", lido.linkUltimoCapitulo());
        assertEquals(COMIX + "6954321-chapter-9", lido.linkProximoCapitulo());
        // status, dia e o resto continuam iguais
        assertEquals(ReadingStatus.LENDO, lido.getReadingStatus());
        assertEquals(WeekDay.SEXTA, lido.getReleaseDay());
        assertEquals("Doomsday Wedding", lido.getTitle());
        Manga doArquivo = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow();
        assertEquals(COMIX + "6954321-chapter-9", doArquivo.getNextChapterUrl());

        // ao avancar para o 9, o endereco do 9 vira o do ultimo lido e o proximo fica desconhecido
        Manga avancou = service.atualizarProgresso(salvo.getId(), new BigDecimal("9"), null);
        assertEquals(COMIX + "6954321-chapter-9", avancou.linkUltimoCapitulo());
        assertNull(avancou.getNextChapterUrl());
    }

    @Test
    void marcarComoLidoAtualizaOModeloQuandoOIdDoLinkMudou() {
        // id proprio em cada capitulo: o modelo passa a ter o id do capitulo marcado
        Manga comix = mangaDoComix();
        Manga lido = service.registrarLeitura(comix.getId(), new BigDecimal("8"), COMIX + "6912345-chapter-8", null);
        assertEquals(COMIX + "6912345-chapter-{cap}", lido.getChapterLinkModel());

        // id da obra mudou: o modelo novo vale para todos os capitulos
        Manga asura = service.salvarManga(new DadosManga("Extra", CAPA, null, "https://asurascans.com/comics/extra-3ec3b16f/chapter/{cap}", null,
                new BigDecimal("174"), ReadingStatus.LENDO, ""));
        Manga atualizado = service.registrarLeitura(asura.getId(), new BigDecimal("175"), "https://asurascans.com/comics/extra-bd5bdaf8/chapter/175", null);
        assertEquals("https://asurascans.com/comics/extra-bd5bdaf8/chapter/{cap}", atualizado.getChapterLinkModel());
        assertEquals("https://asurascans.com/comics/extra-bd5bdaf8/chapter/176",
                service.atualizarProgresso(asura.getId(), new BigDecimal("300"), null).getChapterLinkModel().replace("{cap}", "176"));

        // endereco sem o numero do capitulo: nao da para tirar um modelo dele, entao o antigo fica
        Manga semNumero = service.registrarLeitura(comix.getId(), new BigDecimal("9"), "https://comix.to/read/8f3a9c", null);
        assertEquals(COMIX + "6912345-chapter-{cap}", semNumero.getChapterLinkModel());
        assertEquals("https://comix.to/read/8f3a9c", semNumero.linkUltimoCapitulo());
    }

    @Test
    void registraSoOCapituloLidoQuandoOProximoNaoEConhecido() {
        Manga salvo = mangaDoComix();
        String oito = COMIX + "6912345-chapter-8";

        assertNull(service.registrarLeitura(salvo.getId(), new BigDecimal("8"), oito, null).getNextChapterUrl());
        assertNull(service.registrarLeitura(salvo.getId(), new BigDecimal("8"), oito, "  ").getNextChapterUrl());
        // "proximo" igual a pagina atual e descartado
        assertNull(service.registrarLeitura(salvo.getId(), new BigDecimal("8"), oito, oito + "/#topo").getNextChapterUrl());
        assertEquals(oito, service.buscarPorId(salvo.getId()).getLastChapterUrl());
    }

    @Test
    void recusaLeituraComDadosInvalidos() {
        Manga salvo = mangaDoComix();
        UUID id = salvo.getId();
        String oito = COMIX + "6912345-chapter-8";

        assertThrows(NullInformationsException.class, () -> service.registrarLeitura(id, null, oito, null));
        assertThrows(InvalidChapterException.class, () -> service.registrarLeitura(id, new BigDecimal("-1"), oito, null));
        assertThrows(InvalidLinkException.class, () -> service.registrarLeitura(id, BigDecimal.ONE, null, null));
        assertThrows(InvalidLinkException.class, () -> service.registrarLeitura(id, BigDecimal.ONE, "javascript:alert(1)", null));
        assertThrows(InvalidLinkException.class, () -> service.registrarLeitura(id, BigDecimal.ONE, oito, "javascript:alert(1)"));
        assertThrows(NotFoundException.class, () -> service.registrarLeitura(UUID.randomUUID(), BigDecimal.ONE, oito, null));

        Manga atual = service.buscarPorId(id);
        assertEquals(new BigDecimal("7"), atual.getLastChapter());
        assertNull(atual.getLastChapterUrl());
    }

    @Test
    void verificacaoBloqueadaNaoApagaOsEnderecosRegistrados() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.restoResponde(403); // como um site com protecao contra robos
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/title/obra/111-chapter-{cap}", "7"));
            comSite.registrarLeitura(salvo.getId(), new BigDecimal("8"), site.url("/title/obra/222-chapter-8"), site.url("/title/obra/333-chapter-9"));

            ResultadoVerificacao resultado = comSite.verificarLink(salvo.getId());

            assertEquals(SituacaoDoLink.NAO_VERIFICADO, resultado.situacao());
            assertEquals(site.url("/title/obra/333-chapter-9"), comSite.buscarPorId(salvo.getId()).linkProximoCapitulo());
        }
    }

    @Test
    void verificacaoConfereOEnderecoRegistradoQuandoAPaginaNaoMostraOLink() throws Exception {
        try (SiteFalso site = new SiteFalso()) {
            site.pagina("/title/obra/222-chapter-8", "<div id='app'></div>").pagina("/title/obra/333-chapter-9", "ok");
            MangaService comSite = comSite(site);
            Manga salvo = comSite.salvarManga(noSite(site, "/title/obra/111-chapter-{cap}", "7"));
            comSite.registrarLeitura(salvo.getId(), new BigDecimal("8"), site.url("/title/obra/222-chapter-8"), site.url("/title/obra/333-chapter-9"));

            ResultadoVerificacao resultado = comSite.verificarLink(salvo.getId());

            assertEquals(SituacaoDoLink.DISPONIVEL, resultado.situacao());
            assertFalse(resultado.linkMudou());
            assertEquals(site.url("/title/obra/333-chapter-9"), comSite.buscarPorId(salvo.getId()).getNextChapterUrl());
        }
    }

    // ------------------------------------------------------------------ dia de lancamento

    private static DadosManga comDia(String titulo, ReadingStatus status, WeekDay dia) {
        return new DadosManga(titulo, CAPA, null, LINK, null, BigDecimal.ONE, status, "", dia);
    }

    @Test
    void guardaODiaDeLancamentoDeQuemEstaLendo() {
        Manga salvo = service.salvarManga(comDia("Solo Leveling", ReadingStatus.LENDO, WeekDay.QUARTA));

        assertEquals(WeekDay.QUARTA, salvo.getReleaseDay());
        Manga lido = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(salvo.getId()).orElseThrow();
        assertEquals(WeekDay.QUARTA, lido.getReleaseDay());
    }

    @Test
    void oDiaDeLancamentoEOpcional() {
        Manga salvo = service.salvarManga(comDia("Solo Leveling", ReadingStatus.LENDO, null));

        assertEquals(null, salvo.getReleaseDay());
    }

    @Test
    void soQuemEstaLendoPodeTerDiaDeLancamento() {
        for (ReadingStatus status : ReadingStatus.values()) {
            if (status == ReadingStatus.LENDO) {
                continue;
            }
            assertThrows(InvalidReleaseDayException.class, () -> service.salvarManga(comDia("T", status, WeekDay.SEGUNDA)), status.name());
        }
        assertTrue(repository.listarTodos().isEmpty());

        Manga lendo = service.salvarManga(comDia("T", ReadingStatus.LENDO, WeekDay.SEGUNDA));
        assertThrows(InvalidReleaseDayException.class,
                () -> service.editarManga(lendo.getId(), comDia("T", ReadingStatus.HIATUS, WeekDay.SEGUNDA)));
        assertEquals(ReadingStatus.LENDO, service.buscarPorId(lendo.getId()).getReadingStatus());
    }

    @Test
    void edicaoGeralTrocaOuTiraODia() {
        Manga salvo = service.salvarManga(comDia("T", ReadingStatus.LENDO, WeekDay.SEGUNDA));

        assertEquals(WeekDay.SEXTA, service.editarManga(salvo.getId(), comDia("T", ReadingStatus.LENDO, WeekDay.SEXTA)).getReleaseDay());
        assertEquals(null, service.editarManga(salvo.getId(), comDia("T", ReadingStatus.LENDO, null)).getReleaseDay());
        assertEquals(null, service.buscarPorId(salvo.getId()).getReleaseDay());
    }

    @Test
    void sairDeLendoApagaODiaDeLancamento() {
        Manga salvo = service.salvarManga(comDia("T", ReadingStatus.LENDO, WeekDay.QUARTA));

        // mudar so o capitulo, ou repetir o status Lendo, mantem o dia
        assertEquals(WeekDay.QUARTA, service.atualizarProgresso(salvo.getId(), BigDecimal.TEN, null).getReleaseDay());
        assertEquals(WeekDay.QUARTA, service.atualizarProgresso(salvo.getId(), null, ReadingStatus.LENDO).getReleaseDay());

        assertEquals(null, service.atualizarProgresso(salvo.getId(), null, ReadingStatus.HIATUS).getReleaseDay());
        assertEquals(null, service.buscarPorId(salvo.getId()).getReleaseDay());
        // voltar a ler nao traz o dia antigo de volta
        assertEquals(null, service.atualizarProgresso(salvo.getId(), null, ReadingStatus.LENDO).getReleaseDay());
    }

    @Test
    void listaOsLancamentosDoDia() {
        service.salvarManga(comDia("Quarta 1", ReadingStatus.LENDO, WeekDay.QUARTA));
        service.salvarManga(comDia("Sexta", ReadingStatus.LENDO, WeekDay.SEXTA));
        service.salvarManga(comDia("Sem dia", ReadingStatus.LENDO, null));
        service.salvarManga(comDia("Em hiato", ReadingStatus.HIATUS, null));
        Manga parou = service.salvarManga(comDia("Parou", ReadingStatus.LENDO, WeekDay.QUARTA));
        service.salvarManga(comDia("Quarta 2", ReadingStatus.LENDO, WeekDay.QUARTA));
        service.atualizarProgresso(parou.getId(), null, ReadingStatus.DROPADO);

        assertEquals(List.of("Quarta 1", "Quarta 2"), titulos(service.listarLancamentos(WeekDay.QUARTA)));
        assertEquals(List.of("Sexta"), titulos(service.listarLancamentos(WeekDay.SEXTA)));
        assertEquals(List.of(), titulos(service.listarLancamentos(WeekDay.DOMINGO)));
        assertThrows(NullInformationsException.class, () -> service.listarLancamentos(null));
    }

    @Test
    void quemJaLeuOCapituloDeHojeSaiDosLancamentos() {
        Manga lido = service.salvarManga(comDia("Ja li hoje", ReadingStatus.LENDO, WeekDay.QUARTA));
        Manga naoLido = service.salvarManga(comDia("Ainda nao li", ReadingStatus.LENDO, WeekDay.QUARTA));
        Manga soStatus = service.salvarManga(comDia("So mexi no status", ReadingStatus.LENDO, WeekDay.QUARTA));
        Manga voltei = service.salvarManga(comDia("Voltei um capitulo", ReadingStatus.LENDO, WeekDay.QUARTA));
        Instant inicioDoDia = Instant.now().minusSeconds(60);
        assertNull(lido.getLastChapterAt(), "cadastrar nao conta como ler o capitulo do dia");

        service.atualizarProgresso(lido.getId(), new BigDecimal("2"), null);
        service.atualizarProgresso(soStatus.getId(), null, ReadingStatus.LENDO);
        service.editarManga(voltei.getId(), new DadosManga("Voltei um capitulo", CAPA, null, LINK, null, BigDecimal.ZERO, ReadingStatus.LENDO, "", WeekDay.QUARTA));

        // so quem avancou o capitulo sai; mexer no status ou voltar capitulo nao e ter lido o lancamento
        assertEquals(List.of("Ainda nao li", "So mexi no status", "Voltei um capitulo"), titulos(service.listarLancamentos(WeekDay.QUARTA, inicioDoDia)));
        // sem informar o inicio do dia, ninguem e escondido
        assertEquals(4, service.listarLancamentos(WeekDay.QUARTA).size());
        // na semana que vem (o dia comeca depois da leitura) ele volta a aparecer
        assertEquals(4, service.listarLancamentos(WeekDay.QUARTA, Instant.now().plusSeconds(60)).size());

        // a hora da leitura fica salva e sobrevive a outras mudancas que nao avancam o capitulo
        Manga doArquivo = new JsonMangaRepository(pasta.resolve("mangas.json")).buscarPorId(lido.getId()).orElseThrow();
        assertTrue(doArquivo.getLastChapterAt().isAfter(inicioDoDia));
        Instant quando = doArquivo.getLastChapterAt();
        service.atualizarProgresso(lido.getId(), null, ReadingStatus.LENDO);
        service.editarManga(lido.getId(), new DadosManga("Ja li hoje", CAPA, List.of("Action"), LINK, null, new BigDecimal("2"), ReadingStatus.LENDO, "x", WeekDay.QUARTA));
        assertEquals(quando, service.buscarPorId(lido.getId()).getLastChapterAt());
        // marcar pelo botao (com o endereco do capitulo) e a edicao geral tambem contam quando o capitulo avanca
        service.registrarLeitura(naoLido.getId(), new BigDecimal("2"), "https://site.com/x/2", null);
        service.editarManga(soStatus.getId(), new DadosManga("So mexi no status", CAPA, null, LINK, null, new BigDecimal("5"), ReadingStatus.LENDO, "", WeekDay.QUARTA));
        assertEquals(List.of("Voltei um capitulo"), titulos(service.listarLancamentos(WeekDay.QUARTA, inicioDoDia)));
    }

    @Test
    void mangaAntigoComDiaMasSemEstarLendoNaoApareceNosLancamentos() {
        // dado gravado direto no repositorio, como um arquivo editado a mao
        Manga manga = new Manga("Antigo", CAPA, new java.util.ArrayList<>(), LINK, null, BigDecimal.ONE, ReadingStatus.CONCLUIDO, "");
        manga.setReleaseDay(WeekDay.QUARTA);
        repository.salvar(manga);

        assertEquals(List.of(), titulos(service.listarLancamentos(WeekDay.QUARTA)));
    }

    // ------------------------------------------------------------------ sorteio

    @Test
    void sorteioSemMangasLancaNaoEncontrado() {
        assertThrows(NotFoundException.class, () -> service.sortearManga(null));

        service.salvarManga(dados("A", "1", ReadingStatus.LENDO));
        assertThrows(NotFoundException.class, () -> service.sortearManga(ReadingStatus.DROPADO));
    }

    @Test
    void sorteioPassaPorTodosOsMangas() {
        service.salvarManga(dados("A", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("B", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("C", "1", ReadingStatus.LER));

        Set<String> sorteados = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            sorteados.add(service.sortearManga(null).getTitle());
        }

        assertEquals(Set.of("A", "B", "C"), sorteados);
    }

    @Test
    void sorteioPodeCairEmMangaDeQualquerStatus() {
        for (ReadingStatus status : ReadingStatus.values()) {
            service.salvarManga(dados(status.name(), "1", status));
        }

        Set<String> sorteados = new HashSet<>();
        for (int i = 0; i < 400; i++) {
            sorteados.add(service.sortearManga(null).getTitle());
        }

        // lendo, dropado, cancelado, concluido, hiato e para ler: todos participam
        assertEquals(Set.of("LENDO", "DROPADO", "CANCELADO", "CONCLUIDO", "HIATUS", "LER"), sorteados);
        assertEquals("CONCLUIDO", service.sortearManga(ReadingStatus.CONCLUIDO).getTitle());
        assertEquals("CANCELADO", service.sortearManga(ReadingStatus.CANCELADO).getTitle());
    }

    @Test
    void sorteioSoComConcluidosSorteiaEntreEles() {
        service.salvarManga(dados("Concluído", "1", ReadingStatus.CONCLUIDO));

        assertEquals("Concluído", service.sortearManga(null).getTitle());
    }

    @Test
    void sorteioRespeitaOFiltroDeStatus() {
        service.salvarManga(dados("A", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("B", "1", ReadingStatus.LENDO));
        service.salvarManga(dados("C", "1", ReadingStatus.LER));

        for (int i = 0; i < 50; i++) {
            assertEquals("C", service.sortearManga(ReadingStatus.LER).getTitle());
        }
    }
}
