package br.com.seuapp.mangatracker.repository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class SegredoDaSessaoTest {

    @TempDir
    Path pasta;

    @Test
    void criaUmaVezEDepoisReaproveita() throws Exception {
        Path arquivo = pasta.resolve("dados").resolve("segredo-da-sessao");

        byte[] primeiro = SegredoDaSessao.doArquivo(arquivo);
        assertEquals(32, primeiro.length);
        assertArrayEquals(primeiro, SegredoDaSessao.doArquivo(arquivo));
        assertEquals("rw-------", PosixFilePermissions.toString(Files.getPosixFilePermissions(arquivo)));

        // arquivo estragado: cria outro (os logins antigos deixam de valer)
        Files.writeString(arquivo, "isso nao e base64 !!!");
        byte[] novo = SegredoDaSessao.doArquivo(arquivo);
        assertEquals(32, novo.length);
        assertFalse(java.util.Arrays.equals(primeiro, novo));
    }

    @Test
    void segredoDaVariavelPrecisaSerLongo() {
        assertNull(SegredoDaSessao.doTexto(null));
        assertNull(SegredoDaSessao.doTexto("curto"));
        assertEquals(40, SegredoDaSessao.doTexto("x".repeat(40)).length);
    }
}
