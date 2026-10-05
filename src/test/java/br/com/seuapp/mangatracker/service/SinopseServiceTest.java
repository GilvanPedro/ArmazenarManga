package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.service.SinopseService.Sinopse;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** As fontes da internet sao trocadas por respostas prontas, no formato que cada servico devolve. */
public class SinopseServiceTest {

    /** Respostas de mentira: o que o MangaDex, o AniList e o tradutor devolveriam. null = servico fora do ar. */
    public static class InternetFalsa implements SinopseService.ClienteHttp {
        public String mangadex = "{\"data\":[]}";
        public String anilist = "{\"data\":{\"Page\":{\"media\":[]}}}";
        public boolean tradutorFunciona = true;
        public final List<String> traduzidos = new ArrayList<>();
        public final List<String> chamadas = new ArrayList<>();

        @Override
        public String get(String endereco) {
            chamadas.add(endereco);
            if (endereco.startsWith("https://api.mangadex.org/")) {
                return mangadex;
            }
            if (endereco.startsWith("https://api.mymemory.translated.net/")) {
                String texto = URLDecoder.decode(endereco.substring(endereco.indexOf("&q=") + 3), StandardCharsets.UTF_8);
                traduzidos.add(texto);
                return tradutorFunciona
                        ? "{\"responseStatus\":200,\"responseData\":{\"translatedText\":\"[pt] " + texto.replace("\"", "'") + "\"}}"
                        : "{\"responseStatus\":429,\"responseData\":{\"translatedText\":\"MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY\"}}";
            }
            return null;
        }

        @Override
        public String postJson(String endereco, String corpo) {
            chamadas.add(endereco + " " + corpo);
            return endereco.equals("https://graphql.anilist.co") ? anilist : null;
        }
    }

    static String mangadex(String tituloEn, String alternativo, String descricoes) {
        return "{\"data\":[{\"attributes\":{\"title\":{\"en\":\"" + tituloEn + "\"},\"altTitles\":[{\"pt-br\":\"" + alternativo + "\"}],\"description\":{" + descricoes + "}}}]}";
    }

    static String anilist(String titulo, String descricao) {
        return "{\"data\":{\"Page\":{\"media\":[{\"title\":{\"romaji\":\"Romaji\",\"english\":\"" + titulo + "\"},\"description\":\"" + descricao + "\"}]}}}";
    }

    final InternetFalsa internet = new InternetFalsa();
    final SinopseService service = new SinopseService(internet);

    @Test
    void usaADescricaoEmPortuguesDoMangaDexSemTraduzir() {
        internet.mangadex = mangadex("Solo Leveling", "Só Eu Subo de Nível", "\"en\":\"Ten years ago...\",\"pt-br\":\"Dez anos atrás, o Portal se abriu.\"");

        Sinopse sinopse = service.buscar("  Solo Leveling ").orElseThrow();

        assertEquals(new Sinopse("Dez anos atrás, o Portal se abriu.", "pt", "MangaDex", "Solo Leveling", false), sinopse);
        assertTrue(internet.traduzidos.isEmpty());
        assertTrue(internet.chamadas.get(0).contains("title=Solo+Leveling"), internet.chamadas.get(0));
    }

    @Test
    void quandoSoHaInglesTraduzADescricaoDoAniList() {
        internet.mangadex = mangadex("Doomsday Wedding", "x", "\"en\":\"English from MangaDex.\"");
        internet.anilist = anilist("Doomsday Wedding!", "Forced onto a team with her rival.<br><br>She would rather fight.<br>(Source: Tapas)");

        Sinopse sinopse = service.buscar("Doomsday Wedding").orElseThrow();

        assertEquals("[pt] Forced onto a team with her rival.\n\n[pt] She would rather fight.", sinopse.descricao());
        assertEquals("pt", sinopse.idioma());
        assertEquals("AniList", sinopse.fonte());
        assertEquals("Doomsday Wedding!", sinopse.tituloEncontrado());
        assertTrue(sinopse.traduzida());
    }

    @Test
    void usaOInglesDoMangaDexQuandoOAniListNaoConhece() {
        internet.mangadex = mangadex("Obra Rara", "x", "\"en\":\"Only here.\"");

        Sinopse sinopse = service.buscar("Obra Rara").orElseThrow();

        assertEquals("[pt] Only here.", sinopse.descricao());
        assertEquals("MangaDex", sinopse.fonte());
    }

    @Test
    void seATraducaoFalharDevolveEmInglesAvisando() {
        internet.anilist = anilist("Obra", "Some story.");
        internet.tradutorFunciona = false;

        Sinopse sinopse = service.buscar("Obra").orElseThrow();

        assertEquals(new Sinopse("Some story.", "en", "AniList", "Obra", false), sinopse);
    }

    @Test
    void naoEncontraQuandoNenhumaFonteConhece() {
        assertEquals(Optional.empty(), service.buscar("zzzz"));
        assertEquals(Optional.empty(), service.buscar("  "));
        assertEquals(Optional.empty(), service.buscar(null));
    }

    @Test
    void servicosForaDoArNaoQuebramNada() {
        internet.mangadex = null;
        internet.anilist = "isso nao e json";

        assertEquals(Optional.empty(), service.buscar("Solo Leveling"));
    }

    @Test
    void entreVariosResultadosPrefereOQueTemExatamenteOTitulo() {
        internet.mangadex = "{\"data\":["
                + "{\"attributes\":{\"title\":{\"en\":\"Solo Leveling: Ragnarok\"},\"altTitles\":[],\"description\":{\"pt-br\":\"Errada.\"}}},"
                + "{\"attributes\":{\"title\":{\"ko-ro\":\"Na Honjaman Level-Up\"},\"altTitles\":[{\"en\":\"Solo Leveling\"}],\"description\":{\"pt-br\":\"Certa.\"}}}]}";

        Sinopse sinopse = service.buscar("solo  leveling").orElseThrow();

        assertEquals("Certa.", sinopse.descricao());
        assertEquals("solo  leveling", sinopse.tituloEncontrado());
    }

    @Test
    void limpaMarcacoesEOQueVemDepoisDaDescricao() {
        assertEquals("Uma história com link.\n\nSegundo parágrafo & fim.",
                SinopseService.limpar("**Uma história** com [link](https://x.com).<br><br><br>\n<i>Segundo parágrafo</i> &amp; fim.\n\n---\n**Links:**\n- [Site](https://y.com)"));
        assertEquals("", SinopseService.limpar(null));
        assertEquals("", SinopseService.limpar("   "));
    }

    @Test
    void descricaoLongaECortadaNoFimDeUmaFraseETraduzidaEmPedacos() {
        String frase = "This sentence has exactly fifty characters in it. ";
        internet.anilist = anilist("Longa", frase.repeat(60).trim());

        Sinopse sinopse = service.buscar("Longa").orElseThrow();

        assertTrue(internet.traduzidos.size() >= 3 && internet.traduzidos.size() <= 8, "pedidos: " + internet.traduzidos.size());
        for (String pedaco : internet.traduzidos) {
            assertTrue(pedaco.length() <= 450, "pedaco com " + pedaco.length());
            assertTrue(pedaco.endsWith("."), pedaco);
        }
        assertTrue(sinopse.descricao().length() <= SinopseService.TAMANHO_MAXIMO + 5 * internet.traduzidos.size());
        assertFalse(sinopse.descricao().contains("  "));
    }
}
