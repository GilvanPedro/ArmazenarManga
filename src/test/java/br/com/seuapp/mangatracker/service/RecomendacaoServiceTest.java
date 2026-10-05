package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.service.RecomendacaoService.Recomendacao;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** O AniList e trocado por respostas prontas, no formato que ele devolve. */
public class RecomendacaoServiceTest {

    /** AniList de mentira: uma resposta para a pergunta sobre a obra e outra para a busca por generos. */
    public static class AniListFalso implements SinopseService.ClienteHttp {
        public String obra = "{\"data\":{\"Media\":null}}";
        public String porGenero = "{\"data\":{\"Page\":{\"media\":[]}}}";
        public final List<String> perguntas = new ArrayList<>();

        @Override
        public String get(String endereco) {
            return null;
        }

        @Override
        public String postJson(String endereco, String corpo) {
            perguntas.add(corpo);
            return corpo.contains("Media(search") ? obra : porGenero;
        }
    }

    public static String obra(long id, String ingles, String romaji, String generos) {
        return obra(id, ingles, romaji, generos, "MANGA", false, "");
    }

    static String obra(long id, String ingles, String romaji, String generos, String tipo, boolean adulto, String sinonimos) {
        return "{\"id\":" + id + ",\"type\":\"" + tipo + "\",\"isAdult\":" + adulto
                + ",\"title\":{\"romaji\":\"" + romaji + "\",\"english\":" + (ingles == null ? "null" : "\"" + ingles + "\"") + "}"
                + ",\"synonyms\":[" + sinonimos + "],\"genres\":[" + generos + "]"
                + ",\"siteUrl\":\"https://anilist.co/manga/" + id + "\",\"coverImage\":{\"large\":\"https://s4.anilist.co/capa" + id + ".jpg\"}}";
    }

    public static String daObra(String generos, String temas, String... recomendadas) {
        StringBuilder nos = new StringBuilder();
        for (String recomendada : recomendadas) {
            nos.append(nos.length() == 0 ? "" : ",").append("{\"mediaRecommendation\":").append(recomendada).append("}");
        }
        return "{\"data\":{\"Media\":{\"id\":1,\"genres\":[" + generos + "],\"tags\":[" + temas + "],\"recommendations\":{\"nodes\":[" + nos + "]}}}}";
    }

    static String porGenero(String... obras) {
        return "{\"data\":{\"Page\":{\"media\":[" + String.join(",", obras) + "]}}}";
    }

    final AniListFalso anilist = new AniListFalso();
    final RecomendacaoService service = new RecomendacaoService(anilist);

    private static List<String> titulos(List<Recomendacao> recomendacoes) {
        return recomendacoes.stream().map(Recomendacao::titulo).toList();
    }

    @Test
    void devolveAsRecomendacoesDosLeitoresComGenerosEmPortugues() {
        anilist.obra = daObra("\"Action\"", "",
                obra(10, "Tower of God", "Sin-ui Tap", "\"Action\",\"Fantasy\",\"Sci-Fi\",\"Gênero Novo\""),
                obra(11, null, "Kumo desu ga", "\"Slice of Life\""));
        anilist.porGenero = porGenero();

        List<Recomendacao> recomendacoes = service.buscar("Solo Leveling", List.of("Solo Leveling"));

        assertEquals(new Recomendacao("Tower of God", "https://s4.anilist.co/capa10.jpg",
                List.of("Ação", "Fantasia", "Ficção científica", "Gênero Novo"), "https://anilist.co/manga/10"), recomendacoes.get(0));
        assertEquals("Kumo desu ga", recomendacoes.get(1).titulo()); // sem nome em ingles, usa o original
        assertEquals(List.of("Cotidiano"), recomendacoes.get(1).generos());
        assertTrue(anilist.perguntas.get(0).contains("\"s\":\"Solo Leveling\""), anilist.perguntas.get(0));
    }

    @Test
    void naoSugereOQueJaEstaCadastrado() {
        anilist.obra = daObra("\"Action\"", "",
                obra(10, "Tower of God", "Sin-ui Tap", ""),
                obra(11, "Omniscient Reader", "Jeonjijeok Dokja Sijeom", "", "MANGA", false, "\"ORV\",\"Ponto de Vista do Leitor Onisciente\""),
                obra(12, "The Beginning After the End", "TBATE", ""),
                obra(13, "Second Life Ranker", "Dubeon Saneun Ranker", ""));

        List<Recomendacao> recomendacoes = service.buscar("Solo Leveling",
                List.of("Solo Leveling", "tower of god", "Ponto de Vista do Leitor Onisciente", "Tbate!"));

        // fora: pelo nome em ingles sem ligar para maiusculas, por um nome alternativo e pelo nome original
        assertEquals(List.of("Second Life Ranker"), titulos(recomendacoes));
    }

    @Test
    void deixaDeForaAnimesConteudoAdultoERepetidos() {
        anilist.obra = daObra("\"Action\"", "",
                obra(10, "Anime", "Anime", "", "ANIME", false, ""),
                obra(11, "Adulto", "Adulto", "", "MANGA", true, ""),
                obra(12, "Bom", "Bom", ""),
                obra(12, "Bom", "Bom", ""),
                obra(1, "A Propria Obra", "A Propria Obra", ""),
                "null");

        assertEquals(List.of("Bom"), titulos(service.buscar("Solo Leveling", List.of())));
    }

    @Test
    void comPoucasRecomendacoesCompletaComObrasDosMesmosGenerosETemas() {
        anilist.obra = daObra("\"Fantasy\",\"Romance\"",
                "{\"name\":\"Female Protagonist\",\"rank\":90},{\"name\":\"Pouco Marcante\",\"rank\":30},{\"name\":\"Marriage\",\"rank\":70}",
                obra(10, "Dos Leitores", "Dos Leitores", "\"Fantasy\""));
        anilist.porGenero = porGenero(
                obra(20, "So Um Genero", "x", "\"Fantasy\",\"Action\""),
                obra(21, "Os Dois Generos", "y", "\"Romance\",\"Fantasy\""),
                obra(10, "Dos Leitores", "Dos Leitores", "\"Fantasy\""));

        List<Recomendacao> recomendacoes = service.buscar("Doomsday Wedding", List.of());

        // primeiro o que os leitores indicaram; depois, quem divide mais generos com a obra
        assertEquals(List.of("Dos Leitores", "Os Dois Generos", "So Um Genero"), titulos(recomendacoes));
        String segundaPergunta = anilist.perguntas.get(1);
        assertTrue(segundaPergunta.contains("\"g\":[\"Fantasy\",\"Romance\"]"), segundaPergunta);
        assertTrue(segundaPergunta.contains("\"t\":[\"Female Protagonist\",\"Marriage\"]"), segundaPergunta);
        assertTrue(segundaPergunta.contains("isAdult:false"), segundaPergunta);
    }

    @Test
    void devolveNoMaximoSeisEGuardaAConsulta() {
        String[] muitas = new String[20];
        for (int i = 0; i < muitas.length; i++) {
            muitas[i] = obra(100 + i, "Obra " + i, "Obra " + i, "");
        }
        anilist.obra = daObra("\"Action\"", "", muitas);

        assertEquals(6, service.buscar("Solo Leveling", List.of()).size());
        assertEquals(1, anilist.perguntas.size());
        // de novo: nao consulta o AniList outra vez, e passa a esconder o que foi cadastrado nesse meio tempo
        List<Recomendacao> depois = service.buscar(" solo leveling ", List.of("Obra 0", "Obra 1"));
        assertEquals(1, anilist.perguntas.size());
        assertEquals("Obra 2", depois.get(0).titulo());
        assertEquals(6, depois.size());
    }

    @Test
    void obraDesconhecidaOuServicoForaDoArNaoQuebraNada() {
        assertEquals(List.of(), service.buscar("zzzz", List.of()));
        assertEquals(List.of(), service.buscar("  ", List.of()));
        assertEquals(List.of(), service.buscar(null, List.of()));
        anilist.obra = null;
        assertEquals(List.of(), service.buscar("Solo Leveling", List.of()));
        anilist.obra = "nao e json";
        assertEquals(List.of(), service.buscar("Solo Leveling", List.of()));
        // falha nao fica guardada: quando o servico volta, a busca funciona
        anilist.obra = daObra("\"Action\"", "", obra(10, "Voltou", "Voltou", ""));
        assertFalse(service.buscar("Solo Leveling", List.of()).isEmpty());
    }
}
