package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.service.RecomendacaoService.Recomendacao;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** O AniList e trocado por respostas prontas, no formato que ele devolve. */
public class RecomendacaoServiceTest {

    /** AniList de mentira: uma resposta para a pergunta sobre a obra e outra para a busca por generos. */
    public static class AniListFalso implements SinopseService.ClienteHttp {
        public String obra = "{\"data\":{\"Media\":null}}";
        public String porGenero = "{\"data\":{\"Page\":{\"media\":[]}}}";
        /** Resposta para "a que obra corresponde cada titulo da lista" (m0, m1...). null = servico fora do ar. */
        public String obrasDaLista = "{\"data\":{\"m0\":{\"media\":[]}}}";
        /** Resposta do MangaDex a busca pelos nomes de uma obra. null = servico fora do ar. */
        public String mangadex = null;
        /** Resposta da busca geral (pergunta com "pageInfo"). */
        public String exploracao = "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":false},\"media\":[]}}}";
        /** Temas que o AniList diz ter. null = servico fora do ar. */
        public String temas = "{\"data\":{\"MediaTagCollection\":[{\"name\":\"Villainess\",\"isAdult\":false},{\"name\":\"Wuxia\",\"isAdult\":false},{\"name\":\"Tema Adulto\",\"isAdult\":true}]}}";
        public final List<String> perguntasDeExploracao = new ArrayList<>();
        public final List<String> perguntas = new ArrayList<>();
        public final List<String> perguntasSobreALista = new ArrayList<>();

        /** Traducoes do tradutor de mentira (titulo -> ingles). Titulo fora do mapa volta igual. */
        public final Map<String, String> traducoes = new java.util.HashMap<>();
        public boolean tradutorFunciona = true;
        /** Resposta para a busca pelos titulos ja traduzidos. */
        public String obrasPeloIngles = "{\"data\":{\"m0\":{\"media\":[]}}}";

        @Override
        public String get(String endereco) {
            if (endereco.startsWith("https://api.mymemory.translated.net/")) {
                if (!tradutorFunciona) {
                    return null;
                }
                String titulo = java.net.URLDecoder.decode(endereco.substring(endereco.indexOf("&q=") + 3), java.nio.charset.StandardCharsets.UTF_8);
                return "{\"responseStatus\":200,\"responseData\":{\"translatedText\":\"" + traducoes.getOrDefault(titulo, titulo) + "\"}}";
            }
            return endereco.startsWith("https://api.mangadex.org/") ? mangadex : null;
        }

        @Override
        public String postJson(String endereco, String corpo) {
            if (corpo.contains("MediaTagCollection")) {
                return temas;
            }
            if (corpo.contains("pageInfo")) {
                perguntasDeExploracao.add(corpo);
                return exploracao;
            }
            if (corpo.contains("m0:Page(perPage:2)")) {
                perguntasSobreALista.add(corpo);
                return obrasPeloIngles;
            }
            if (corpo.contains("m0:Page")) {
                perguntasSobreALista.add(corpo);
                return obrasDaLista;
            }
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
                List.of("Ação", "Fantasia", "Ficção científica", "Gênero Novo"), "https://anilist.co/manga/10",
                List.of("Action", "Fantasy", "Sci-Fi", "Gênero Novo")), recomendacoes.get(0));
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
    void descobreOsOutrosNomesDosMangasDaLista() {
        // o AniList conhece os dois primeiros titulos; o terceiro (em portugues) so o MangaDex conhece; o quarto, ninguem
        anilist.obrasDaLista = "{\"data\":{"
                + "\"m0\":{\"media\":[{\"id\":109957,\"title\":{\"romaji\":\"Dubeon Saneun Ranker\",\"english\":\"Second Life Ranker\",\"native\":\"두 번 사는 랭커\"},\"synonyms\":[\"Ranker Who Lives a Second Time\"]}]},"
                + "\"m1\":{\"media\":[{\"id\":119257,\"title\":{\"romaji\":\"Jeonjijeok Dokja Sijeom\",\"english\":\"Omniscient Reader\",\"native\":null},\"synonyms\":[]}]},"
                + "\"m2\":{\"media\":[]},\"m3\":{\"media\":[]}}}";
        anilist.mangadex = "{\"data\":["
                + "{\"attributes\":{\"title\":{\"en\":\"Outra Obra Parecida\"},\"altTitles\":[{\"pt-br\":\"O Começo de Tudo\"}]}},"
                + "{\"attributes\":{\"title\":{\"en\":\"The Beginning After the End\"},\"altTitles\":[{\"pt-br\":\"O Começo Depois do Fim\"},{\"ja\":\"最強の王様\"}]}}]}";

        Map<String, List<String>> nomes = service.nomesAlternativos(
                List.of("Ranker Who Lives a Second Time", "Ponto de Vista do Leitor (relendo)", "o começo depois do fim", "Titulo Que Ninguem Conhece"));

        assertEquals(List.of("anilist:109957", "Dubeon Saneun Ranker", "Second Life Ranker", "두 번 사는 랭커", "Ranker Who Lives a Second Time"),
                nomes.get("Ranker Who Lives a Second Time"));
        assertEquals(List.of("anilist:119257", "Jeonjijeok Dokja Sijeom", "Omniscient Reader"), nomes.get("Ponto de Vista do Leitor (relendo)"));
        // no MangaDex a busca e aproximada: vale a obra que tem exatamente esse nome, nao a primeira da lista
        assertEquals(List.of("The Beginning After the End", "O Começo Depois do Fim", "最強の王様"), nomes.get("o começo depois do fim"));
        assertEquals(List.of(), nomes.get("Titulo Que Ninguem Conhece"));
        // a observacao entre parenteses nao vai na busca
        assertTrue(anilist.perguntasSobreALista.get(0).contains("\"t1\":\"Ponto de Vista do Leitor\""), anilist.perguntasSobreALista.get(0));
    }

    @Test
    void tituloEmPortuguesQueNinguemConheceETraduzidoEProcuradoDeNovo() {
        anilist.obrasDaLista = "{\"data\":{\"m0\":{\"media\":[]},\"m1\":{\"media\":[]},\"m2\":{\"media\":[]}}}";
        anilist.mangadex = "{\"data\":[]}";
        anilist.traducoes.put("Ponto de Vista do Leitor Onisciente", "Omniscient Reader's Viewpoint");
        anilist.traducoes.put("Titulo Sem Obra", "Title Without Work");
        // pelo nome em ingles o AniList acha a primeira (duas edicoes da mesma obra) e nao acha a segunda
        anilist.obrasPeloIngles = "{\"data\":{"
                + "\"m0\":{\"media\":[{\"id\":119257,\"title\":{\"romaji\":\"Jeonjijeok Dokja Sijeom\",\"english\":\"Omniscient Reader\",\"native\":null},\"synonyms\":[]},"
                + "{\"id\":900,\"title\":{\"romaji\":\"ORV Novel\",\"english\":null,\"native\":null},\"synonyms\":[]}]},"
                + "\"m1\":{\"media\":[]}}}";

        Map<String, List<String>> nomes = service.nomesAlternativos(List.of("Ponto de Vista do Leitor Onisciente (relendo)", "Titulo Sem Obra", "Already In English"));

        assertEquals(List.of("anilist:119257", "anilist:900", "Jeonjijeok Dokja Sijeom", "Omniscient Reader", "ORV Novel", "Omniscient Reader's Viewpoint"),
                nomes.get("Ponto de Vista do Leitor Onisciente (relendo)"));
        assertEquals(List.of(), nomes.get("Titulo Sem Obra"));
        assertEquals(List.of(), nomes.get("Already In English"), "traducao igual ao titulo: nao ha mais o que tentar");
        String pergunta = anilist.perguntasSobreALista.get(anilist.perguntasSobreALista.size() - 1);
        assertTrue(pergunta.contains("\"t0\":\"Omniscient Reader's Viewpoint\"") && pergunta.contains("\"t1\":\"Title Without Work\""), pergunta);

        // com o tradutor fora do ar, o titulo fica para tentar de novo, sem ser marcado como "nao existe"
        anilist.tradutorFunciona = false;
        assertEquals(Map.of(), service.nomesAlternativos(List.of("Outro Titulo em Portugues")));
    }

    @Test
    void tiraNomesDoLinkDeLeitura() {
        assertEquals(List.of("omniscient readers viewpoint"),
                RecomendacaoService.nomesDoLink("https://asurascans.com/comics/omniscient-readers-viewpoint-3ec3b16f/chapter/{cap}"));
        assertEquals(List.of("doomsday wedding"), RecomendacaoService.nomesDoLink("https://comix.to/title/0vx0d-doomsday-wedding/6880186-chapter-{cap}"));
        assertEquals(List.of("solo leveling"), RecomendacaoService.nomesDoLink("https://site.com/manga/solo_leveling/capitulo-{cap}?x=outra-coisa-aqui"));
        assertEquals(List.of(), RecomendacaoService.nomesDoLink("https://site.com/read/8f3a9c"));
        assertEquals(List.of(), RecomendacaoService.nomesDoLink("https://site.com/manga/berserk/chapter-{cap}"), "uma palavra so e pouco para identificar");
        assertEquals(List.of(), RecomendacaoService.nomesDoLink(null));

        // o nome tirado do link bate com o nome da candidata mesmo sem apostrofo
        anilist.obra = daObra("\"Action\"", "", obra(119257, "Omniscient Reader", "Jeonjijeok Dokja Sijeom", "", "MANGA", false, "\"Omniscient Reader's Viewpoint\""),
                obra(11, "Outro", "Outro", ""));
        assertEquals(List.of("Outro"), titulos(service.buscar("Solo Leveling", List.of("Ponto de Vista do Leitor", "omniscient readers viewpoint"))));
    }

    @Test
    void mesmasPalavrasComLigacoesDiferentesSaoOMesmoNome() {
        anilist.obra = daObra("\"Action\"", "", obra(10, "Ponto de Vista de um Leitor Onisciente", "x", ""), obra(11, "The Return of the Hero", "y", ""),
                obra(12, "Solo Leveling: Ragnarok", "z", ""));

        assertEquals(List.of("Solo Leveling: Ragnarok"),
                titulos(service.buscar("Solo Leveling", List.of("Ponto de Vista do Leitor Onisciente", "Return of Hero", "Solo Leveling"))));
    }

    @Test
    void servicoForaDoArNaoMarcaNenhumTituloComoResolvido() {
        anilist.obrasDaLista = null;
        assertEquals(Map.of(), service.nomesAlternativos(List.of("Solo Leveling")));

        // AniList respondeu que nao conhece, mas o MangaDex falhou: fica para tentar de novo, sem guardar "nao existe"
        anilist.obrasDaLista = "{\"data\":{\"m0\":{\"media\":[]}}}";
        anilist.mangadex = null;
        assertEquals(Map.of(), service.nomesAlternativos(List.of("Solo Leveling")));
        assertEquals(Map.of(), service.nomesAlternativos(List.of()));
    }

    @Test
    void naoSugereObraCadastradaComOutroNomeOuEmOutraLingua() {
        anilist.obra = daObra("\"Action\"", "",
                obra(109957, "Second Life Ranker", "Dubeon Saneun Ranker", ""),
                obra(119257, "Omniscient Reader", "Jeonjijeok Dokja Sijeom", ""),
                obra(300, "The Beginning After the End", "TBATE", ""),
                obra(301, "Re:ZERO -Starting Life in Another World-", "Re:Zero kara Hajimeru Isekai Seikatsu", ""),
                obra(302, "The Legend of the Northern Blade", "Bukgeom Jeongi", ""),
                obra(555, "Realmente Nova", "Realmente Nova", ""));

        // titulos da lista + os outros nomes guardados de cada um
        List<String> cadastrados = List.of(
                "Ranker que Vive Duas Vezes", "anilist:109957",                    // mesma obra no AniList, nome totalmente diferente
                "Ponto de Vista do Leitor", "Omniscient Reader",                   // um dos nomes guardados bate
                "O Começo Depois do Fim", "The Beginning After The End",           // nome em portugues, guardado o nome em ingles
                "ReZero Starting Life in Another World",                           // escrito sem os sinais
                "Legend of the Northern Blade");                                   // sem o artigo

        assertEquals(List.of("Realmente Nova"), titulos(service.buscar("Solo Leveling", cadastrados)));
    }

    @Test
    void nomeCadastradoComObservacaoEntreParentesesTambemBate() {
        anilist.obra = daObra("\"Action\"", "", obra(10, "Tower of God", "Sin-ui Tap", ""), obra(11, "Outro", "Outro", ""));

        assertEquals(List.of("Outro"), titulos(service.buscar("Solo Leveling", List.of("Tower of God (parei no 300) [PT]"))));
    }

    @Test
    void nomesParecidosDeObrasDiferentesNaoSeConfundem() {
        anilist.obra = daObra("\"Action\"", "", obra(10, "Solo Leveling: Ragnarok", "x", ""), obra(11, "Tower of God: Urek Mazino", "y", ""));

        // ter "Solo Leveling" e "Tower of God" na lista nao esconde as continuacoes
        assertEquals(List.of("Solo Leveling: Ragnarok", "Tower of God: Urek Mazino"),
                titulos(service.buscar("Solo Leveling", List.of("Solo Leveling", "Tower of God", "anilist:999"))));
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
    void tituloComSubtituloOuObservacaoETentadoEmVersoesMaisCurtas() {
        assertEquals(List.of("Solo Leveling: Ragnarok (Novel) [PT-BR]", "Solo Leveling: Ragnarok", "Solo Leveling"),
                RecomendacaoService.variacoesDoTitulo("Solo Leveling: Ragnarok (Novel) [PT-BR]"));
        assertEquals(List.of("One Piece"), RecomendacaoService.variacoesDoTitulo(" One Piece "));

        // o AniList so conhece a versao curta do nome
        SinopseService.ClienteHttp soONomeCurto = new SinopseService.ClienteHttp() {
            @Override
            public String get(String endereco) {
                return null;
            }

            @Override
            public String postJson(String endereco, String corpo) {
                return corpo.contains("\"s\":\"Solo Leveling\"")
                        ? daObra("\"Action\"", "", obra(10, "Tower of God", "Sin-ui Tap", ""))
                        : "{\"data\":{\"Media\":null}}";
            }
        };

        assertEquals(List.of("Tower of God"), titulos(new RecomendacaoService(soONomeCurto).buscar("Solo Leveling (meu preferido)", List.of())));
    }

    @Test
    void quandoOTituloNaoEConhecidoProcuraPelasTagsDoManga() {
        anilist.porGenero = porGenero(obra(20, "Pela Tag", "x", "\"Fantasy\""), obra(21, "Pelas Duas", "y", "\"Fantasy\",\"Romance\""));

        List<Recomendacao> recomendacoes = service.buscar("Titulo Que Ninguem Conhece", List.of(),
                List.of("fantasy", "Romance", "Villainess", "Murim", "  "));

        assertEquals(List.of("Pelas Duas", "Pela Tag"), titulos(recomendacoes));
        String pergunta = anilist.perguntas.get(anilist.perguntas.size() - 1);
        // tags que sao generos do AniList viram generos; as outras viram temas (com o nome que o AniList usa)
        assertTrue(pergunta.contains("\"g\":[\"Fantasy\",\"Romance\"]"), pergunta);
        assertTrue(pergunta.contains("\"t\":[\"Villainess\",\"Wuxia\"]"), pergunta);
        // sem titulo conhecido e sem tags, nao ha o que sugerir
        assertEquals(List.of(), service.buscar("Outro Que Ninguem Conhece", List.of(), List.of()));
    }

    @Test
    void asTagsCompletamOQueVeioDoTitulo() {
        anilist.obra = daObra("", "", obra(10, "Dos Leitores", "Dos Leitores", ""));
        anilist.porGenero = porGenero(obra(20, "Pela Tag", "x", "\"Action\""), obra(10, "Dos Leitores", "Dos Leitores", ""));

        // primeiro o que veio do titulo, depois o que veio das tags, sem repetir
        assertEquals(List.of("Dos Leitores", "Pela Tag"), titulos(service.buscar("Solo Leveling", List.of(), List.of("Action"))));
        // tags diferentes sao outra consulta; as mesmas (em qualquer ordem ou grafia) reaproveitam a guardada
        int antes = anilist.perguntas.size();
        service.buscar("Solo Leveling", List.of(), List.of("action"));
        assertEquals(antes, anilist.perguntas.size());
        service.buscar("Solo Leveling", List.of(), List.of("Romance"));
        assertTrue(anilist.perguntas.size() > antes);
    }

    @Test
    void temaQueOAniListNaoTemNaoImpedeABuscaPelosGeneros() {
        SinopseService.ClienteHttp semOTema = new SinopseService.ClienteHttp() {
            @Override
            public String get(String endereco) {
                return null;
            }

            @Override
            public String postJson(String endereco, String corpo) {
                if (corpo.contains("Media(search")) {
                    return "{\"data\":{\"Media\":null}}";
                }
                return corpo.contains("tag_in") ? porGenero() : porGenero(obra(20, "So Pelo Genero", "x", "\"Action\""));
            }
        };

        assertEquals(List.of("So Pelo Genero"),
                titulos(new RecomendacaoService(semOTema).buscar("Desconhecido", List.of(), List.of("Action", "Tag Inventada"))));
    }

    // ------------------------------------------------------------------ busca geral

    static String comNotaEAno(String obra, Integer nota, Integer ano) {
        return obra.substring(0, obra.length() - 1) + ",\"averageScore\":" + nota + ",\"startDate\":{\"year\":" + ano + "}}";
    }

    @Test
    void buscaGeralFiltraPorNomeETagsNaOrdemPedida() {
        anilist.exploracao = "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":true},\"media\":["
                + comNotaEAno(obra(20, "Villains Are Destined to Die", "Akyeogui Ending", "\"Fantasy\",\"Romance\""), 84, 2020) + ","
                + comNotaEAno(obra(21, null, "Sem Nota", "\"Fantasy\""), null, null) + "]}}}";

        RecomendacaoService.Exploracao pagina = service.explorar(" vilã ", List.of("fantasy", "Romance", "Villainess", "Murim", "Minha Tag Inventada", " "),
                RecomendacaoService.Ordem.NOTA, 3, List.of());

        assertEquals(new RecomendacaoService.ObraEncontrada("Villains Are Destined to Die", "https://s4.anilist.co/capa20.jpg",
                List.of("Fantasia", "Romance"), "https://anilist.co/manga/20", List.of("Fantasy", "Romance"), 84, 2020), pagina.itens().get(0));
        assertEquals(new RecomendacaoService.ObraEncontrada("Sem Nota", "https://s4.anilist.co/capa21.jpg",
                List.of("Fantasia"), "https://anilist.co/manga/21", List.of("Fantasy"), null, null), pagina.itens().get(1));
        assertEquals(3, pagina.pagina());
        assertTrue(pagina.temMais());
        assertEquals(0, pagina.ocultos());
        // a tag que o AniList nao tem fica de fora da busca e e avisada
        assertEquals(List.of("Minha Tag Inventada"), pagina.tagsIgnoradas());
        String pergunta = anilist.perguntasDeExploracao.get(0);
        assertTrue(pergunta.contains("\"s\":\"vilã\""), pergunta);
        assertTrue(pergunta.contains("\"g\":[\"Fantasy\",\"Romance\"]"), pergunta);
        assertTrue(pergunta.contains("\"t\":[\"Villainess\",\"Wuxia\"]"), "Murim e Wuxia no AniList: " + pergunta);
        assertTrue(pergunta.contains("\"o\":[\"SCORE_DESC\"]") && pergunta.contains("\"p\":3") && pergunta.contains("isAdult:false"), pergunta);
    }

    @Test
    void buscaGeralSemFiltrosMostraAsMaisPopulares() {
        service.explorar(null, null, null, 1, List.of());
        service.explorar("", List.of(), RecomendacaoService.Ordem.RELEVANCIA, 0, List.of());
        service.explorar("solo", List.of(), RecomendacaoService.Ordem.RELEVANCIA, 1, List.of());

        // sem nome buscado, "mais relevantes" vira "mais populares"; sem filtros, nenhum filtro vai na pergunta
        assertTrue(anilist.perguntasDeExploracao.get(0).contains("\"o\":[\"POPULARITY_DESC\"]"));
        assertFalse(anilist.perguntasDeExploracao.get(0).contains("search:") || anilist.perguntasDeExploracao.get(0).contains("genre_in") || anilist.perguntasDeExploracao.get(0).contains("tag_in"));
        assertTrue(anilist.perguntasDeExploracao.get(1).contains("\"o\":[\"POPULARITY_DESC\"]") && anilist.perguntasDeExploracao.get(1).contains("\"p\":1"));
        assertTrue(anilist.perguntasDeExploracao.get(2).contains("\"o\":[\"SEARCH_MATCH\"]"));
    }

    @Test
    void buscaGeralEscondeOQueJaEstaNaLista() {
        anilist.exploracao = "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":false},\"media\":["
                + obra(105398, "Solo Leveling", "Na Honjaman Level Up", "") + "," + obra(119257, "Omniscient Reader", "Jeonjijeok Dokja Sijeom", "") + ","
                + obra(85143, "Tower of God", "Sin-ui Tap", "") + "," + obra(30, "Nova", "Nova", "") + ","
                + obra(31, "Anime", "Anime", "", "ANIME", false, "") + "]}}}";

        RecomendacaoService.Exploracao pagina = service.explorar("", List.of(), RecomendacaoService.Ordem.POPULARIDADE, 1,
                List.of("Solo Leveling", "Ponto de Vista do Leitor", "anilist:119257", "Torre de Deus", "tower of god"));

        assertEquals(List.of("Nova"), pagina.itens().stream().map(RecomendacaoService.ObraEncontrada::titulo).toList());
        assertEquals(3, pagina.ocultos());
        assertFalse(pagina.temMais());
    }

    @Test
    void buscaGeralComServicoForaDoArVoltaVazia() {
        anilist.exploracao = null;
        anilist.temas = null;

        RecomendacaoService.Exploracao pagina = service.explorar("solo", List.of("Fantasy", "Tema Que Nao Deu Para Conferir"), RecomendacaoService.Ordem.NOTA, 1, List.of());

        assertEquals(List.of(), pagina.itens());
        assertFalse(pagina.temMais());
        // sem a lista de temas nao da para dizer que a tag nao existe: ela vai na busca como esta
        assertEquals(List.of(), pagina.tagsIgnoradas());
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
