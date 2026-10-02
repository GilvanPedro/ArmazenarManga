package br.com.seuapp.mangatracker.domain;

import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ChapterLinkTest {

    private static final String MODELO = "https://site-a.com/manga/solo-leveling/capitulo-{cap}";

    @ParameterizedTest
    @CsvSource({
            "HIFEN,     48,    48",
            "HIFEN,     48.5,  48-5",
            "PONTO,     48.5,  48.5",
            "UNDERLINE, 48.5,  48_5",
            "HIFEN,     48.50, 48-5",
            "HIFEN,     48.0,  48",
            "PONTO,     100,   100",
            "HIFEN,     0,     0",
            "UNDERLINE, 10.25, 10_25",
    })
    void formataOCapituloConformeOFormatoEscolhido(ChapterDecimalFormat formato, BigDecimal capitulo, String esperado) {
        assertEquals(esperado, formato.formatar(capitulo));
    }

    @Test
    void formatoPadraoEHifen() {
        assertEquals(ChapterDecimalFormat.HIFEN, ChapterDecimalFormat.PADRAO);
    }

    @Test
    void montaOLinkTrocandoOMarcador() {
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-48-5",
                ChapterLink.montar(MODELO, ChapterDecimalFormat.HIFEN, new BigDecimal("48.5")));
    }

    @ParameterizedTest
    @CsvSource({"0, 1", "48, 49", "48.5, 49", "48.9, 49", "100.0, 101"})
    void proximoCapituloEOProximoInteiro(BigDecimal ultimo, BigDecimal esperado) {
        assertEquals(0, esperado.compareTo(ChapterLink.proximoCapitulo(ultimo)));
    }

    @Test
    void aceitaModeloValido() {
        assertDoesNotThrow(() -> ChapterLink.validar(MODELO));
        assertDoesNotThrow(() -> ChapterLink.validar("http://site.com/ler?manga=1&cap={cap}"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "https://site.com/manga/capitulo-48",       // sem {cap}
            "site.com/manga/capitulo-{cap}",            // sem http
            "javascript:alert('{cap}')",
            "ftp://site.com/{cap}",
            "https:///capitulo-{cap}",                  // sem host
    })
    void recusaModeloInvalido(String modelo) {
        assertThrows(InvalidLinkException.class, () -> ChapterLink.validar(modelo));
    }

    @Test
    void recusaModeloNulo() {
        assertThrows(InvalidLinkException.class, () -> ChapterLink.validar(null));
    }

    @Test
    void mangaMontaOsLinksAPartirDoUltimoCapitulo() {
        Manga manga = new Manga("Solo Leveling", "capa.png", new ArrayList<>(), MODELO,
                ChapterDecimalFormat.PONTO, new BigDecimal("10.5"), ReadingStatus.LENDO, "");

        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-1", manga.linkPrimeiroCapitulo());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-10.5", manga.linkUltimoCapitulo());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-11", manga.linkProximoCapitulo());

        manga.setLastChapter(new BigDecimal("20"));
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-20", manga.linkUltimoCapitulo());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-21", manga.linkProximoCapitulo());
    }

    @Test
    void diaDaSemanaAcompanhaOCalendarioDoJava() {
        assertEquals(WeekDay.SEGUNDA, WeekDay.de(java.time.DayOfWeek.MONDAY));
        assertEquals(WeekDay.QUARTA, WeekDay.de(java.time.DayOfWeek.WEDNESDAY));
        assertEquals(WeekDay.SABADO, WeekDay.de(java.time.DayOfWeek.SATURDAY));
        assertEquals(WeekDay.DOMINGO, WeekDay.de(java.time.DayOfWeek.SUNDAY));
    }

    @Test
    void mangaSemFormatoUsaOPadrao() {
        Manga manga = new Manga("Solo Leveling", "capa.png", new ArrayList<>(), MODELO,
                null, new BigDecimal("10.5"), ReadingStatus.LENDO, "");

        assertEquals(ChapterDecimalFormat.HIFEN, manga.getDecimalFormat());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-10-5", manga.linkUltimoCapitulo());
    }
}
