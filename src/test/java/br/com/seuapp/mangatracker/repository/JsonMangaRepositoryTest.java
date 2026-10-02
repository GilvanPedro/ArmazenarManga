package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JsonMangaRepositoryTest {

    @TempDir
    Path pasta;
    Path arquivo;

    @BeforeEach
    void setUp() {
        arquivo = pasta.resolve("dados").resolve("mangas.json");
    }

    private static Manga novoManga(String titulo, String capitulo) {
        return new Manga(titulo, "capa.png", new ArrayList<>(List.of(new Tag("Ação"), new Tag("Fantasia"))),
                "https://site.com/" + titulo + "/{cap}", ChapterDecimalFormat.PONTO,
                new BigDecimal(capitulo), ReadingStatus.LENDO, "Descrição de " + titulo);
    }

    @Test
    void comecaVazioQuandoOArquivoNaoExiste() {
        assertTrue(new JsonMangaRepository(arquivo).listarTodos().isEmpty());
        assertFalse(Files.exists(arquivo));
    }

    @Test
    void comecaVazioQuandoOArquivoEstaVazio() throws IOException {
        Files.createDirectories(arquivo.getParent());
        Files.createFile(arquivo);
        assertTrue(new JsonMangaRepository(arquivo).listarTodos().isEmpty());
    }

    @Test
    void oQueFoiSalvoVoltaIgualDepoisDeReabrir() {
        Manga manga = novoManga("Solo Leveling", "48.5");
        new JsonMangaRepository(arquivo).salvar(manga);

        Manga lido = new JsonMangaRepository(arquivo).buscarPorId(manga.getId()).orElseThrow();

        assertEquals(manga.getId(), lido.getId());
        assertEquals("Solo Leveling", lido.getTitle());
        assertEquals("capa.png", lido.getImagePath());
        assertEquals(List.of("Ação", "Fantasia"), lido.getTags().stream().map(Tag::getNome).toList());
        assertEquals("https://site.com/Solo Leveling/{cap}", lido.getChapterLinkModel());
        assertEquals(ChapterDecimalFormat.PONTO, lido.getDecimalFormat());
        assertEquals(new BigDecimal("48.5"), lido.getLastChapter());
        assertEquals(ReadingStatus.LENDO, lido.getReadingStatus());
        assertEquals("Descrição de Solo Leveling", lido.getDescription());
    }

    @Test
    void salvarComMesmoIdSubstitui() {
        JsonMangaRepository repository = new JsonMangaRepository(arquivo);
        Manga manga = novoManga("Solo Leveling", "1");
        repository.salvar(manga);

        repository.salvar(new Manga(manga.getId(), "Solo Leveling", "capa.png", new ArrayList<>(),
                "https://site.com/{cap}", ChapterDecimalFormat.HIFEN, new BigDecimal("2"), ReadingStatus.DROPADO, ""));

        List<Manga> todos = new JsonMangaRepository(arquivo).listarTodos();
        assertEquals(1, todos.size());
        assertEquals(new BigDecimal("2"), todos.get(0).getLastChapter());
        assertEquals(ReadingStatus.DROPADO, todos.get(0).getReadingStatus());
    }

    @Test
    void mantemAOrdemDeCadastro() {
        JsonMangaRepository repository = new JsonMangaRepository(arquivo);
        repository.salvar(novoManga("C", "1"));
        repository.salvar(novoManga("A", "1"));
        repository.salvar(novoManga("B", "1"));

        assertEquals(List.of("C", "A", "B"),
                new JsonMangaRepository(arquivo).listarTodos().stream().map(Manga::getTitle).toList());
    }

    @Test
    void excluirRemoveDoArquivo() {
        JsonMangaRepository repository = new JsonMangaRepository(arquivo);
        Manga fica = novoManga("Fica", "1");
        Manga sai = novoManga("Sai", "1");
        repository.salvar(fica);
        repository.salvar(sai);

        repository.excluir(sai.getId());
        repository.excluir(UUID.randomUUID()); // id desconhecido nao da erro

        JsonMangaRepository reaberto = new JsonMangaRepository(arquivo);
        assertTrue(reaberto.buscarPorId(sai.getId()).isEmpty());
        assertTrue(reaberto.buscarPorId(fica.getId()).isPresent());
    }

    @Test
    void capituloGrandeNaoViraNotacaoCientifica() throws IOException {
        new JsonMangaRepository(arquivo).salvar(novoManga("Longo", "1E+3"));

        String json = Files.readString(arquivo);
        assertTrue(json.contains("\"lastChapter\": 1000"), json);
    }

    @Test
    void arquivoAntigoSemFormatoDecimalUsaOPadrao() throws IOException {
        Files.createDirectories(arquivo.getParent());
        Files.writeString(arquivo, """
                [ {
                  "id": "7b1c1a52-58a4-4c0e-9f6a-0d6c6c2c3a11",
                  "title": "Antigo",
                  "imagePath": "capa.png",
                  "tags": ["Ação"],
                  "chapterLinkModel": "https://site.com/{cap}",
                  "lastChapter": 3,
                  "readingStatus": "LENDO",
                  "description": "",
                  "campoQueNaoExisteMais": true
                } ]
                """);

        Manga manga = new JsonMangaRepository(arquivo).listarTodos().get(0);

        assertEquals(ChapterDecimalFormat.HIFEN, manga.getDecimalFormat());
        assertEquals("Ação", manga.getTags().get(0).getNome());
    }

    @Test
    void arquivoCorrompidoNaoEIgnorado() throws IOException {
        Files.createDirectories(arquivo.getParent());
        Files.writeString(arquivo, "[ { \"id\": ");

        assertThrows(PersistenciaException.class, () -> new JsonMangaRepository(arquivo));
        assertEquals("[ { \"id\": ", Files.readString(arquivo)); // o arquivo continua la para ser consertado
    }

    @Test
    void seNaoConseguirGravarOMangaNaoFicaNaMemoria() throws IOException {
        // "dados" e um arquivo, entao a pasta nao pode ser criada
        Files.createFile(pasta.resolve("dados"));
        JsonMangaRepository repository = new JsonMangaRepository(arquivo);

        assertThrows(PersistenciaException.class, () -> repository.salvar(novoManga("Falha", "1")));
        assertTrue(repository.listarTodos().isEmpty());
    }
}
