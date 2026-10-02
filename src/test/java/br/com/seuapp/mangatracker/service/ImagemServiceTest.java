package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ImagemServiceTest {

    public static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 1, 2, 3};
    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3};
    static final byte[] GIF = "GIF89a...".getBytes(StandardCharsets.US_ASCII);
    static final byte[] WEBP = "RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII);

    @TempDir
    Path raiz;
    Path pasta;
    ImagemService service;

    @BeforeEach
    void setUp() {
        pasta = raiz.resolve("imagens");
        service = new ImagemService(pasta);
    }

    private String salvar(byte[] bytes) {
        return service.salvar(new ByteArrayInputStream(bytes));
    }

    @Test
    void salvaEEncontraAImagem() throws IOException {
        String nome = salvar(PNG);

        assertTrue(nome.endsWith(".png"));
        assertTrue(service.existe(nome));
        assertArrayEquals(PNG, Files.readAllBytes(service.localizar(nome)));
        assertEquals("image/png", service.tipoDeConteudo(nome));
    }

    @Test
    void descobreOTipoPeloConteudo() {
        assertEquals("image/jpeg", service.tipoDeConteudo(salvar(JPG)));
        assertEquals("image/gif", service.tipoDeConteudo(salvar(GIF)));
        assertEquals("image/webp", service.tipoDeConteudo(salvar(WEBP)));
    }

    @Test
    void recusaOQueNaoEImagem() {
        assertThrows(InvalidImageException.class, () -> salvar("<html><script>alert(1)</script></html>".getBytes()));
        assertThrows(InvalidImageException.class, () -> salvar(new byte[0]));
        assertFalse(Files.exists(pasta));
    }

    @Test
    void recusaImagemAcimaDoLimite() {
        byte[] grande = new byte[ImagemService.TAMANHO_MAXIMO + 1];
        System.arraycopy(PNG, 0, grande, 0, PNG.length);

        assertThrows(InvalidImageException.class, () -> salvar(grande));
    }

    @Test
    void aceitaImagemNoLimite() {
        byte[] noLimite = new byte[ImagemService.TAMANHO_MAXIMO];
        System.arraycopy(PNG, 0, noLimite, 0, PNG.length);

        assertDoesNotThrow(() -> salvar(noLimite));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "../mangas.json",
            "..%2Fmangas.json",
            "/etc/passwd",
            "segredo.txt",
            "00000000-0000-0000-0000-000000000000.png", // nome valido, mas nao existe
            "",
    })
    void naoEncontraNomesDeForaDaPasta(String nome) throws IOException {
        Files.writeString(raiz.resolve("mangas.json"), "[]");
        Files.createDirectories(pasta);
        Files.writeString(pasta.resolve("segredo.txt"), "x");

        assertFalse(service.existe(nome));
        assertThrows(NotFoundException.class, () -> service.localizar(nome));
    }

    @Test
    void excluirApagaSoImagensEnviadas() throws IOException {
        String nome = salvar(PNG);
        Files.writeString(raiz.resolve("mangas.json"), "[]");

        service.excluir(nome);
        service.excluir("../mangas.json");
        service.excluir("https://site.com/capa.png");
        service.excluir(null);

        assertFalse(service.existe(nome));
        assertTrue(Files.exists(raiz.resolve("mangas.json")));
    }

    @Test
    void referenciaPrecisaSerUrlOuImagemEnviada() {
        String nome = salvar(PNG);

        assertDoesNotThrow(() -> service.verificarReferencia(nome));
        assertDoesNotThrow(() -> service.verificarReferencia("https://site.com/capa.png"));
        assertThrows(InvalidImageException.class, () -> service.verificarReferencia("capa.png"));
        assertThrows(InvalidImageException.class, () -> service.verificarReferencia("javascript:alert(1)"));
        assertThrows(InvalidImageException.class, () -> service.verificarReferencia("../mangas.json"));
    }
}
