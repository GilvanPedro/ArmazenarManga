package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.repository.JsonMangaRepository;
import br.com.seuapp.mangatracker.service.BuscadorDePaginas;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.ImagemServiceTest;
import br.com.seuapp.mangatracker.service.MangaService;
import br.com.seuapp.mangatracker.service.PaginaWeb;
import br.com.seuapp.mangatracker.service.RecomendacaoService;
import br.com.seuapp.mangatracker.service.RecomendacaoServiceTest;
import br.com.seuapp.mangatracker.service.SinopseService;
import br.com.seuapp.mangatracker.service.SinopseServiceTest;
import br.com.seuapp.mangatracker.service.VerificadorDeLink;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Sobe a API de verdade em uma porta livre e chama por HTTP, como o site vai fazer. */
class ApiServerTest {

    private static final String SITE = "http://localhost:5173";

    @TempDir
    Path pasta;
    Javalin app;
    String base;
    final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(SITE), null).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
    }

    @AfterEach
    void tearDown() {
        app.stop();
    }

    // ------------------------------------------------------------------ ajudantes

    private HttpResponse<String> enviar(String metodo, String caminho, String corpo) throws Exception {
        HttpRequest.Builder requisicao = HttpRequest.newBuilder(URI.create(base + caminho))
                .method(metodo, corpo == null ? BodyPublishers.noBody() : BodyPublishers.ofString(corpo));
        if (corpo != null) {
            requisicao.header("Content-Type", "application/json");
        }
        return http.send(requisicao.build(), BodyHandlers.ofString());
    }

    private JsonNode json(HttpResponse<String> resposta) throws IOException {
        return mapper.readTree(resposta.body());
    }

    private static String manga(String titulo, String capitulo, String status) {
        return """
                {
                  "title": "%s",
                  "imagePath": "https://site.com/capa.png",
                  "tags": ["Ação", "Fantasia"],
                  "chapterLinkModel": "https://site-a.com/manga/solo-leveling/capitulo-{cap}",
                  "lastChapter": %s,
                  "readingStatus": "%s",
                  "description": "Uma descrição"
                }
                """.formatted(titulo, capitulo, status);
    }

    private JsonNode cadastrar(String titulo, String capitulo, String status) throws Exception {
        HttpResponse<String> resposta = enviar("POST", "/api/mangas", manga(titulo, capitulo, status));
        assertEquals(201, resposta.statusCode(), resposta.body());
        return json(resposta);
    }

    private List<String> titulos(String caminho) throws Exception {
        HttpResponse<String> resposta = enviar("GET", caminho, null);
        assertEquals(200, resposta.statusCode(), resposta.body());
        List<String> titulos = new ArrayList<>();
        json(resposta).forEach(item -> titulos.add(item.get("title").asText()));
        return titulos;
    }

    private HttpResponse<String> enviarImagem(String campo, byte[] conteudo) throws Exception {
        String limite = "----limite" + UUID.randomUUID();
        ByteArrayOutputStream corpo = new ByteArrayOutputStream();
        corpo.write(("--" + limite + "\r\n"
                + "Content-Disposition: form-data; name=\"" + campo + "\"; filename=\"capa.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        corpo.write(conteudo);
        corpo.write(("\r\n--" + limite + "--\r\n").getBytes(StandardCharsets.UTF_8));

        return http.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens"))
                .header("Content-Type", "multipart/form-data; boundary=" + limite)
                .POST(BodyPublishers.ofByteArray(corpo.toByteArray()))
                .build(), BodyHandlers.ofString());
    }

    // ------------------------------------------------------------------ cadastro e consulta

    @Test
    void cadastraEDevolveOMangaComOsLinksMontados() throws Exception {
        JsonNode criado = cadastrar("Solo Leveling", "48.5", "LENDO");

        assertFalse(criado.get("id").asText().isEmpty());
        assertEquals("Solo Leveling", criado.get("title").asText());
        assertEquals("https://site.com/capa.png", criado.get("imageUrl").asText());
        assertEquals("Ação", criado.get("tags").get(0).asText());
        assertEquals("HIFEN", criado.get("decimalFormat").asText());
        assertEquals("48.5", criado.get("lastChapter").asText());
        assertEquals("LENDO", criado.get("readingStatus").asText());
        assertEquals("Uma descrição", criado.get("description").asText());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-1", criado.get("firstChapterLink").asText());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-48-5", criado.get("lastChapterLink").asText());
        assertEquals("49", criado.get("nextChapter").asText());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-49", criado.get("nextChapterLink").asText());

        HttpResponse<String> buscado = enviar("GET", "/api/mangas/" + criado.get("id").asText(), null);
        assertEquals(200, buscado.statusCode());
        assertTrue(buscado.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
        assertEquals(criado, json(buscado));
    }

    @Test
    void oCadastroFicaSalvoNoArquivoJson() throws Exception {
        JsonNode criado = cadastrar("Solo Leveling", "48.5", "LENDO");

        JsonNode arquivo = mapper.readTree(Files.readString(pasta.resolve("mangas.json")));
        assertEquals(1, arquivo.size());
        assertEquals(criado.get("id"), arquivo.get(0).get("id"));
        assertEquals("Solo Leveling", arquivo.get(0).get("title").asText());
        assertFalse(arquivo.get(0).has("nextChapterLink")); // links sao calculados, nao salvos
    }

    @Test
    void recusaCadastroInvalidoComMensagem() throws Exception {
        String semTitulo = manga("", "1", "LENDO");
        String capituloNegativo = manga("T", "-1", "LENDO");
        String statusDesconhecido = manga("T", "1", "ABANDONADO");
        String capituloTexto = manga("T", "\"abc\"", "LENDO");
        String semLink = manga("T", "1", "LENDO").replace("https://site-a.com/manga/solo-leveling/capitulo-{cap}", "");
        String linkSemMarcador = manga("T", "1", "LENDO").replace("{cap}", "48");
        String semImagem = manga("T", "1", "LENDO").replace("https://site.com/capa.png", "");
        String semStatus = manga("T", "1", "LENDO").replace("\"LENDO\"", "null");
        String semCapitulo = manga("T", "null", "LENDO");

        for (String corpo : List.of(semTitulo, capituloNegativo, statusDesconhecido, capituloTexto, semLink,
                linkSemMarcador, semImagem, semStatus, semCapitulo, "{", "null", "[]", "")) {
            HttpResponse<String> resposta = enviar("POST", "/api/mangas", corpo);
            assertEquals(400, resposta.statusCode(), corpo + " -> " + resposta.body());
            assertFalse(json(resposta).get("mensagem").asText().isBlank());
        }
        assertEquals("Valor inválido no campo 'readingStatus'",
                json(enviar("POST", "/api/mangas", statusDesconhecido)).get("mensagem").asText());
        assertEquals(List.of(), titulos("/api/mangas"));
    }

    @Test
    void idDesconhecidoOuInvalidoDa404() throws Exception {
        for (String id : List.of(UUID.randomUUID().toString(), "nao-e-um-id")) {
            assertEquals(404, enviar("GET", "/api/mangas/" + id, null).statusCode());
            assertEquals(404, enviar("PUT", "/api/mangas/" + id, manga("T", "1", "LENDO")).statusCode());
            assertEquals(404, enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 1}").statusCode());
            assertEquals(404, enviar("DELETE", "/api/mangas/" + id, null).statusCode());
            assertEquals(404, enviar("GET", "/api/mangas/" + id + "/ler", null).statusCode());
        }
        assertEquals("Mangá não encontrado",
                json(enviar("GET", "/api/mangas/" + UUID.randomUUID(), null)).get("mensagem").asText());
    }

    // ------------------------------------------------------------------ busca e filtro

    @Test
    void buscaPorTituloEFiltraPorStatus() throws Exception {
        cadastrar("Solo Leveling", "1", "LENDO");
        cadastrar("Ação Total", "1", "DROPADO");
        cadastrar("One Piece", "1", "LENDO");

        assertEquals(List.of("Solo Leveling", "Ação Total", "One Piece"), titulos("/api/mangas"));
        assertEquals(List.of("Solo Leveling"), titulos("/api/mangas?titulo=solo"));
        assertEquals(List.of("Ação Total"), titulos("/api/mangas?titulo=acao"));
        assertEquals(List.of("Ação Total"), titulos("/api/mangas?titulo=A%C3%A7%C3%A3o"));
        assertEquals(List.of("Solo Leveling", "One Piece"), titulos("/api/mangas?status=LENDO"));
        assertEquals(List.of("Solo Leveling", "One Piece"), titulos("/api/mangas?status=lendo"));
        assertEquals(List.of("One Piece"), titulos("/api/mangas?status=LENDO&titulo=piece"));
        assertEquals(List.of(), titulos("/api/mangas?status=CONCLUIDO"));
        assertEquals(400, enviar("GET", "/api/mangas?status=ABANDONADO", null).statusCode());
    }

    // ------------------------------------------------------------------ progresso e edicao

    @Test
    void progressoAlteraSoCapituloEStatus() throws Exception {
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> soCapitulo = enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 50.5}");
        assertEquals(200, soCapitulo.statusCode(), soCapitulo.body());
        assertEquals("50.5", json(soCapitulo).get("lastChapter").asText());
        assertEquals("LENDO", json(soCapitulo).get("readingStatus").asText());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-50-5", json(soCapitulo).get("lastChapterLink").asText());

        // title no corpo e ignorado: essa rota so mexe em capitulo e status
        HttpResponse<String> soStatus = enviar("PATCH", "/api/mangas/" + id + "/progresso",
                "{\"readingStatus\": \"CONCLUIDO\", \"title\": \"Outro\"}");
        assertEquals(200, soStatus.statusCode(), soStatus.body());

        JsonNode atual = json(enviar("GET", "/api/mangas/" + id, null));
        assertEquals("50.5", atual.get("lastChapter").asText());
        assertEquals("CONCLUIDO", atual.get("readingStatus").asText());
        assertEquals("Solo Leveling", atual.get("title").asText());

        assertEquals(400, enviar("PATCH", "/api/mangas/" + id + "/progresso", "{}").statusCode());
        assertEquals(400, enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": -2}").statusCode());
        assertEquals(400, enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"readingStatus\": \"X\"}").statusCode());
        assertEquals("50.5", json(enviar("GET", "/api/mangas/" + id, null)).get("lastChapter").asText());
    }

    @Test
    void edicaoGeralSubstituiTudo() throws Exception {
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> resposta = enviar("PUT", "/api/mangas/" + id, """
                {
                  "title": "Solo Leveling: Ragnarok",
                  "imagePath": "https://outro.com/capa.jpg",
                  "tags": [],
                  "chapterLinkModel": "https://site-b.com/slr/{cap}",
                  "decimalFormat": "UNDERLINE",
                  "lastChapter": 3.5,
                  "readingStatus": "HIATUS",
                  "description": "Nova"
                }
                """);

        assertEquals(200, resposta.statusCode(), resposta.body());
        JsonNode atual = json(enviar("GET", "/api/mangas/" + id, null));
        assertEquals(json(resposta), atual);
        assertEquals("Solo Leveling: Ragnarok", atual.get("title").asText());
        assertEquals(0, atual.get("tags").size());
        assertEquals("HIATUS", atual.get("readingStatus").asText());
        assertEquals("https://site-b.com/slr/3_5", atual.get("lastChapterLink").asText());
        assertEquals("https://site-b.com/slr/4", atual.get("nextChapterLink").asText());

        assertEquals(400, enviar("PUT", "/api/mangas/" + id, manga("", "1", "LENDO")).statusCode());
        assertEquals("Solo Leveling: Ragnarok", json(enviar("GET", "/api/mangas/" + id, null)).get("title").asText());
    }

    @Test
    void excluiOManga() throws Exception {
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        assertEquals(204, enviar("DELETE", "/api/mangas/" + id, null).statusCode());
        assertEquals(404, enviar("GET", "/api/mangas/" + id, null).statusCode());
        assertEquals(List.of(), titulos("/api/mangas"));
    }

    // ------------------------------------------------------------------ ler e sorteio

    @Test
    void lerRedirecionaParaOProximoCapitulo() throws Exception {
        String id = cadastrar("Solo Leveling", "48.5", "LENDO").get("id").asText();

        HttpResponse<String> resposta = enviar("GET", "/api/mangas/" + id + "/ler", null);
        assertEquals(302, resposta.statusCode());
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-49", resposta.headers().firstValue("Location").orElseThrow());

        enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 49}");
        assertEquals("https://site-a.com/manga/solo-leveling/capitulo-50",
                enviar("GET", "/api/mangas/" + id + "/ler", null).headers().firstValue("Location").orElseThrow());
    }

    @Test
    void sorteiaUmMangaCadastrado() throws Exception {
        assertEquals(404, enviar("GET", "/api/mangas/sorteio", null).statusCode());

        cadastrar("A", "1", "LENDO");
        cadastrar("B", "1", "LER");

        for (int i = 0; i < 10; i++) {
            assertTrue(List.of("A", "B").contains(json(enviar("GET", "/api/mangas/sorteio", null)).get("title").asText()));
            assertEquals("B", json(enviar("GET", "/api/mangas/sorteio?status=LER", null)).get("title").asText());
        }
        assertEquals(404, enviar("GET", "/api/mangas/sorteio?status=DROPADO", null).statusCode());

        // concluidos e cancelados ficam de fora
        cadastrar("C", "1", "CONCLUIDO");
        cadastrar("D", "1", "CANCELADO");
        for (int i = 0; i < 30; i++) {
            assertTrue(List.of("A", "B").contains(json(enviar("GET", "/api/mangas/sorteio", null)).get("title").asText()));
        }
        assertEquals(404, enviar("GET", "/api/mangas/sorteio?status=CONCLUIDO", null).statusCode());
    }

    // ------------------------------------------------------------------ verificacao de link

    /** Sobe a API com um "site" de mentira: enderecos que abrem e para onde cada pagina aponta. */
    private void reiniciarComSite(Map<String, String> paginas) {
        app.stop();
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        BuscadorDePaginas site = endereco -> paginas.containsKey(endereco)
                ? new PaginaWeb(200, endereco, paginas.get(endereco))
                : new PaginaWeb(404, endereco, "");
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService,
                new VerificadorDeLink(site));
        app = new ApiServer(mangaService, imagemService, List.of(SITE), null).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
    }

    private static final String CAP = "https://site-a.com/manga/solo-leveling/capitulo-";

    @Test
    void verificaOLinkEDevolveOResultado() throws Exception {
        reiniciarComSite(Map.of(CAP + "48", "<a href='" + CAP + "49'>Next</a>", CAP + "49", "ok"));
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> resposta = enviar("POST", "/api/mangas/" + id + "/verificacao-link", null);

        assertEquals(200, resposta.statusCode(), resposta.body());
        JsonNode resultado = json(resposta);
        assertEquals("DISPONIVEL", resultado.get("situacao").asText());
        assertFalse(resultado.get("linkMudou").asBoolean());
        assertEquals("Link confirmado: o capítulo 49 está disponível.", resultado.get("mensagem").asText());
        assertEquals(CAP + "49", resultado.get("manga").get("nextChapterLink").asText());
        assertEquals(404, enviar("POST", "/api/mangas/" + UUID.randomUUID() + "/verificacao-link", null).statusCode());
    }

    @Test
    void verificacaoCorrigeOLinkQueMudouEOLerUsaOLinkNovo() throws Exception {
        String novo = "https://site-a.com/manga/solo-leveling/capitulo-49-zz9";
        reiniciarComSite(Map.of(CAP + "48", "<a href='" + novo + "'>Next</a>", novo, "ok"));
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        // o "Ler" confere antes de abrir e ja manda para o endereco certo
        HttpResponse<String> ler = enviar("GET", "/api/mangas/" + id + "/ler", null);
        assertEquals(302, ler.statusCode());
        assertEquals(novo, ler.headers().firstValue("Location").orElseThrow());

        JsonNode resultado = json(enviar("POST", "/api/mangas/" + id + "/verificacao-link", null));
        assertEquals("DISPONIVEL", resultado.get("situacao").asText());
        JsonNode manga = json(enviar("GET", "/api/mangas/" + id, null));
        assertEquals(novo, manga.get("nextChapterLink").asText());
        assertEquals(CAP + "48", manga.get("lastChapterLink").asText());

        // depois de ler, o endereco exato vira o do ultimo capitulo lido
        JsonNode avancou = json(enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 49}"));
        assertEquals(novo, avancou.get("lastChapterLink").asText());
    }

    @Test
    void lerDeCapituloQueNaoExisteVoltaParaOMangaComAviso() throws Exception {
        reiniciarComSite(Map.of(CAP + "48", "sem link para o proximo"));
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> ler = enviar("GET", "/api/mangas/" + id + "/ler", null);

        assertEquals(302, ler.statusCode());
        assertEquals("/#/manga/" + id + "/sem-capitulo", ler.headers().firstValue("Location").orElseThrow());
        assertEquals("NAO_ENCONTRADO", json(enviar("POST", "/api/mangas/" + id + "/verificacao-link", null)).get("situacao").asText());
    }

    @Test
    void lerComLinkQuebradoVoltaParaOMangaComAviso() throws Exception {
        reiniciarComSite(Map.of());
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> ler = enviar("GET", "/api/mangas/" + id + "/ler", null);

        assertEquals("/#/manga/" + id + "/link-quebrado", ler.headers().firstValue("Location").orElseThrow());
    }

    @Test
    void lerAbreOLinkComoEstaQuandoNaoDaParaVerificar() throws Exception {
        // a API dos outros testes nao tem acesso a sites: equivale a um site que bloqueia a verificacao
        String id = cadastrar("Solo Leveling", "48", "LENDO").get("id").asText();

        HttpResponse<String> ler = enviar("GET", "/api/mangas/" + id + "/ler", null);

        assertEquals(302, ler.statusCode());
        assertEquals(CAP + "49", ler.headers().firstValue("Location").orElseThrow());
        assertEquals("NAO_VERIFICADO", json(enviar("POST", "/api/mangas/" + id + "/verificacao-link", null)).get("situacao").asText());
    }

    // ------------------------------------------------------------------ tags

    private JsonNode cadastrarComTags(String titulo, String tags) throws Exception {
        HttpResponse<String> resposta = enviar("POST", "/api/mangas", manga(titulo, "1", "LENDO").replace("[\"Ação\", \"Fantasia\"]", tags));
        assertEquals(201, resposta.statusCode(), resposta.body());
        return json(resposta);
    }

    @Test
    void listaAsTagsFiltraPorElasEAchaOsSemelhantes() throws Exception {
        String base = cadastrarComTags("Base", "[\"Fantasy\", \"Dungeon\"]").get("id").asText();
        JsonNode outro = cadastrarComTags("Outro", "[\"fantasy\", \"dungeon\", \"Minha Tag\"]");
        cadastrarComTags("So uma", "[\"FANTASY\"]");
        cadastrarComTags("Nada a ver", "[\"Romance\"]");

        // a tag escrita de outro jeito entrou com o nome que ja existia
        assertEquals("Fantasy", outro.get("tags").get(0).asText());
        assertEquals("Dungeon", outro.get("tags").get(1).asText());

        JsonNode tags = json(enviar("GET", "/api/tags", null));
        assertEquals("Fantasy", tags.get(0).get("nome").asText());
        assertEquals(3, tags.get(0).get("quantidade").asInt());
        assertEquals("Dungeon", tags.get(1).get("nome").asText());
        assertEquals(2, tags.get(1).get("quantidade").asInt());
        List<String> nomes = new ArrayList<>();
        tags.forEach(tag -> nomes.add(tag.get("nome").asText()));
        assertTrue(nomes.contains("Minha Tag") && nomes.contains("Isekai"), nomes.toString());

        assertEquals(List.of("Base", "Outro", "So uma"), titulos("/api/mangas?tag=Fantasy"));
        assertEquals(List.of("Base", "Outro"), titulos("/api/mangas?tag=dungeon"));
        assertEquals(List.of("Outro"), titulos("/api/mangas?tag=Minha%20Tag&titulo=out"));
        assertEquals(List.of(), titulos("/api/mangas?tag=Horror"));
        assertEquals(2, json(enviar("GET", "/api/mangas?tag=Dungeon&pagina=1", null)).get("total").asInt());

        assertEquals(List.of("Outro", "So uma"), titulos("/api/mangas/" + base + "/semelhantes"));
        assertEquals(404, enviar("GET", "/api/mangas/" + UUID.randomUUID() + "/semelhantes", null).statusCode());
    }

    // ------------------------------------------------------------------ ordenacao da lista

    @Test
    void ordenaAListaDeVariasFormas() throws Exception {
        cadastrar("Berserk", "364", "LENDO");
        cadastrar("ação total", "5", "LENDO");
        cadastrar("Zetman", "5", "DROPADO");
        cadastrar("Abara", "1120", "LENDO");

        assertEquals(List.of("Berserk", "ação total", "Zetman", "Abara"), titulos("/api/mangas"));
        assertEquals(List.of("Berserk", "ação total", "Zetman", "Abara"), titulos("/api/mangas?ordem=CADASTRO"));
        assertEquals(List.of("Abara", "Zetman", "ação total", "Berserk"), titulos("/api/mangas?ordem=RECENTES"));
        // maiusculas e acentos nao mudam a ordem alfabetica
        assertEquals(List.of("Abara", "ação total", "Berserk", "Zetman"), titulos("/api/mangas?ordem=titulo"));
        assertEquals(List.of("Zetman", "Berserk", "ação total", "Abara"), titulos("/api/mangas?ordem=TITULO_DESC"));
        assertEquals(List.of("Abara", "Berserk", "ação total", "Zetman"), titulos("/api/mangas?ordem=MAIS_CAPITULOS"));
        assertEquals(List.of("ação total", "Zetman", "Berserk", "Abara"), titulos("/api/mangas?ordem=MENOS_CAPITULOS"));
        // junto com filtro e paginacao: ordena antes de cortar a pagina
        assertEquals(List.of("Abara", "ação total", "Berserk"), titulos("/api/mangas?ordem=TITULO&status=LENDO"));
        JsonNode pagina = json(enviar("GET", "/api/mangas?ordem=TITULO&pagina=2&tamanho=3", null));
        assertEquals("Zetman", pagina.get("itens").get(0).get("title").asText());
        assertEquals(400, enviar("GET", "/api/mangas?ordem=ALEATORIA", null).statusCode());

        JsonNode ordens = json(enviar("GET", "/api/ordens-da-lista", null));
        assertEquals(6, ordens.size());
        assertEquals("CADASTRO", ordens.get(0).get("valor").asText());
        assertEquals("Título (A–Z)", ordens.get(2).get("descricao").asText());
    }

    // ------------------------------------------------------------------ busca geral de recomendacoes

    @Test
    void buscaGeralDeRecomendacoes() throws Exception {
        app.stop();
        RecomendacaoServiceTest.AniListFalso anilist = new RecomendacaoServiceTest.AniListFalso();
        anilist.exploracao = "{\"data\":{\"Page\":{\"pageInfo\":{\"hasNextPage\":true},\"media\":["
                + RecomendacaoServiceTest.obra(105398, "Solo Leveling", "Na Honjaman Level Up", "\"Action\"") + ","
                + RecomendacaoServiceTest.obra(30, "Obra Nova", "Obra Nova", "\"Action\",\"Fantasy\"") + "]}}}";
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(), null, new SinopseService(new SinopseServiceTest.InternetFalsa()),
                new RecomendacaoService(anilist)).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
        cadastrar("Solo Leveling", "1", "LENDO");

        HttpResponse<String> resposta = enviar("GET", "/api/recomendacoes?busca=level&tags=Action,%20Fantasy,,Inventada&ordem=nota&pagina=2", null);

        assertEquals(200, resposta.statusCode(), resposta.body());
        JsonNode pagina = json(resposta);
        assertEquals(1, pagina.get("itens").size());
        assertEquals("Obra Nova", pagina.get("itens").get(0).get("titulo").asText());
        assertEquals("Ação", pagina.get("itens").get(0).get("generos").get(0).asText());
        assertEquals("Action", pagina.get("itens").get(0).get("tags").get(0).asText());
        assertEquals(2, pagina.get("pagina").asInt());
        assertTrue(pagina.get("temMais").asBoolean());
        assertEquals(1, pagina.get("ocultos").asInt());
        assertEquals("Inventada", pagina.get("tagsIgnoradas").get(0).asText());
        String pergunta = anilist.perguntasDeExploracao.get(0);
        assertTrue(pergunta.contains("\"s\":\"level\"") && pergunta.contains("\"g\":[\"Action\",\"Fantasy\"]") && pergunta.contains("SCORE_DESC") && pergunta.contains("\"p\":2"), pergunta);

        assertEquals(200, enviar("GET", "/api/recomendacoes", null).statusCode());
        assertEquals(400, enviar("GET", "/api/recomendacoes?ordem=QUALQUER", null).statusCode());
        assertEquals(400, enviar("GET", "/api/recomendacoes?pagina=0", null).statusCode());
        JsonNode ordens = json(enviar("GET", "/api/recomendacoes/ordens", null));
        assertEquals("RELEVANCIA", ordens.get(0).get("valor").asText());
        assertEquals("Melhor avaliados", ordens.get(2).get("descricao").asText());
    }

    // ------------------------------------------------------------------ paginacao

    @Test
    void semPedirPaginaAListaContinuaInteira() throws Exception {
        for (int i = 1; i <= 30; i++) {
            cadastrar("Manga " + i, "1", "LENDO");
        }

        JsonNode tudo = json(enviar("GET", "/api/mangas", null));

        assertTrue(tudo.isArray());
        assertEquals(30, tudo.size());
    }

    @Test
    void devolveUmaPaginaPorVezComOTotal() throws Exception {
        for (int i = 1; i <= 30; i++) {
            cadastrar("Manga " + String.format("%02d", i), "1", i % 2 == 0 ? "LENDO" : "DROPADO");
        }

        JsonNode primeira = json(enviar("GET", "/api/mangas?pagina=1", null));
        assertEquals(24, primeira.get("itens").size());
        assertEquals("Manga 01", primeira.get("itens").get(0).get("title").asText());
        assertEquals(1, primeira.get("pagina").asInt());
        assertEquals(24, primeira.get("tamanho").asInt());
        assertEquals(30, primeira.get("total").asInt());
        assertEquals(2, primeira.get("paginas").asInt());

        JsonNode segunda = json(enviar("GET", "/api/mangas?pagina=2", null));
        assertEquals(6, segunda.get("itens").size());
        assertEquals("Manga 25", segunda.get("itens").get(0).get("title").asText());
        assertEquals("Manga 30", segunda.get("itens").get(5).get("title").asText());

        // pagina alem do fim vira a ultima
        JsonNode alem = json(enviar("GET", "/api/mangas?pagina=99", null));
        assertEquals(2, alem.get("pagina").asInt());
        assertEquals(6, alem.get("itens").size());

        // junto com a busca e o filtro: o total e do que foi encontrado
        JsonNode lendo = json(enviar("GET", "/api/mangas?pagina=1&status=LENDO&tamanho=10", null));
        assertEquals(15, lendo.get("total").asInt());
        assertEquals(2, lendo.get("paginas").asInt());
        assertEquals(10, lendo.get("itens").size());
        assertEquals("Manga 02", lendo.get("itens").get(0).get("title").asText());
        JsonNode busca = json(enviar("GET", "/api/mangas?pagina=1&titulo=manga%203", null));
        assertEquals(1, busca.get("total").asInt());
        assertEquals(1, busca.get("paginas").asInt());

        assertEquals(100, json(enviar("GET", "/api/mangas?pagina=1&tamanho=5000", null)).get("tamanho").asInt());
        for (String invalido : List.of("pagina=0", "pagina=-1", "pagina=abc", "pagina=1&tamanho=0", "pagina=1&tamanho=x")) {
            assertEquals(400, enviar("GET", "/api/mangas?" + invalido, null).statusCode(), invalido);
        }
    }

    @Test
    void listaVaziaTemUmaPaginaSemItens() throws Exception {
        JsonNode pagina = json(enviar("GET", "/api/mangas?pagina=1", null));

        assertEquals(0, pagina.get("itens").size());
        assertEquals(0, pagina.get("total").asInt());
        assertEquals(1, pagina.get("paginas").asInt());
        assertEquals(1, pagina.get("pagina").asInt());
    }

    // ------------------------------------------------------------------ recomendacoes

    @Test
    void recomendaMangasParecidosQueNaoEstaoNaLista() throws Exception {
        app.stop();
        RecomendacaoServiceTest.AniListFalso anilist = new RecomendacaoServiceTest.AniListFalso();
        anilist.obra = RecomendacaoServiceTest.daObra("\"Action\"", "",
                RecomendacaoServiceTest.obra(10, "Tower of God", "Sin-ui Tap", "\"Action\",\"Fantasy\""),
                RecomendacaoServiceTest.obra(11, "Second Life Ranker", "Dubeon Saneun Ranker", "\"Action\""));
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(), null, new SinopseService(new SinopseServiceTest.InternetFalsa()),
                new RecomendacaoService(anilist)).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
        String id = cadastrar("Solo Leveling", "1", "LENDO").get("id").asText();
        cadastrar("Tower of God", "1", "LER"); // ja esta na lista: nao pode ser sugerido

        HttpResponse<String> resposta = enviar("GET", "/api/mangas/" + id + "/recomendacoes", null);

        assertEquals(200, resposta.statusCode(), resposta.body());
        JsonNode recomendacoes = json(resposta);
        assertEquals(1, recomendacoes.size());
        assertEquals("Second Life Ranker", recomendacoes.get(0).get("titulo").asText());
        assertEquals("https://s4.anilist.co/capa11.jpg", recomendacoes.get(0).get("capa").asText());
        assertEquals("Ação", recomendacoes.get(0).get("generos").get(0).asText());
        assertEquals("https://anilist.co/manga/11", recomendacoes.get(0).get("link").asText());
        assertEquals(404, enviar("GET", "/api/mangas/" + UUID.randomUUID() + "/recomendacoes", null).statusCode());
    }

    @Test
    void recomendacoesGuardamOsOutrosNomesDosMangasDaLista() throws Exception {
        app.stop();
        RecomendacaoServiceTest.AniListFalso anilist = new RecomendacaoServiceTest.AniListFalso();
        anilist.obra = RecomendacaoServiceTest.daObra("\"Action\"", "",
                RecomendacaoServiceTest.obra(109957, "Second Life Ranker", "Dubeon Saneun Ranker", ""),
                RecomendacaoServiceTest.obra(11, "Realmente Nova", "Realmente Nova", ""));
        // a lista tem dois mangas: o AniList conhece os dois, e o segundo e a obra 109957 com outro nome
        anilist.obrasDaLista = "{\"data\":{\"m0\":{\"media\":[{\"id\":1,\"title\":{\"romaji\":\"Na Honjaman Level Up\",\"english\":\"Solo Leveling\",\"native\":null},\"synonyms\":[]}]},"
                + "\"m1\":{\"media\":[{\"id\":109957,\"title\":{\"romaji\":\"Dubeon Saneun Ranker\",\"english\":\"Second Life Ranker\",\"native\":null},\"synonyms\":[]}]}}}";
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(), null, new SinopseService(new SinopseServiceTest.InternetFalsa()),
                new RecomendacaoService(anilist)).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
        String id = cadastrar("Solo Leveling", "1", "LENDO").get("id").asText();
        String outro = cadastrar("Ranker que Vive Duas Vezes", "7", "DROPADO").get("id").asText();

        JsonNode recomendacoes = json(enviar("GET", "/api/mangas/" + id + "/recomendacoes", null));

        // o manga cadastrado com um nome que nao aparece em lugar nenhum da candidata fica de fora mesmo assim
        assertEquals(1, recomendacoes.size());
        assertEquals("Realmente Nova", recomendacoes.get(0).get("titulo").asText());
        // os nomes ficaram salvos junto do manga, sem mexer no resto dele
        JsonNode arquivo = mapper.readTree(Files.readString(pasta.resolve("mangas.json")));
        assertEquals("anilist:109957", arquivo.get(1).get("altTitles").get(0).asText());
        assertEquals("Second Life Ranker", arquivo.get(1).get("altTitles").get(2).asText());
        JsonNode salvo = json(enviar("GET", "/api/mangas/" + outro, null));
        assertEquals("Ranker que Vive Duas Vezes", salvo.get("title").asText());
        assertEquals("7", salvo.get("lastChapter").asText());
        assertEquals("DROPADO", salvo.get("readingStatus").asText());
        // da segunda vez nao pergunta de novo pelos nomes, e eles sobrevivem a uma mudanca de capitulo
        enviar("PATCH", "/api/mangas/" + outro + "/progresso", "{\"lastChapter\": 8}");
        json(enviar("GET", "/api/mangas/" + id + "/recomendacoes", null));
        assertEquals(1, anilist.perguntasSobreALista.size());
        // trocar o titulo apaga os nomes guardados, que eram do titulo antigo
        enviar("PUT", "/api/mangas/" + outro, manga("Outro Nome", "8", "DROPADO"));
        assertFalse(mapper.readTree(Files.readString(pasta.resolve("mangas.json"))).get(1).hasNonNull("altTitles"));
    }

    @Test
    void semAcessoAInternetNaoHaRecomendacoes() throws Exception {
        String id = cadastrar("Solo Leveling", "1", "LENDO").get("id").asText();

        HttpResponse<String> resposta = enviar("GET", "/api/mangas/" + id + "/recomendacoes", null);

        assertEquals(200, resposta.statusCode());
        assertEquals("[]", resposta.body());
    }

    // ------------------------------------------------------------------ descricao buscada na internet

    @Test
    void buscaADescricaoDoMangaPeloTitulo() throws Exception {
        app.stop();
        SinopseServiceTest.InternetFalsa internet = new SinopseServiceTest.InternetFalsa();
        internet.mangadex = "{\"data\":[{\"attributes\":{\"title\":{\"en\":\"Solo Leveling\"},\"altTitles\":[],\"description\":{\"pt-br\":\"Dez anos atrás, o Portal se abriu.\"}}}]}";
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(), null, new SinopseService(internet)).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();

        HttpResponse<String> resposta = enviar("GET", "/api/sinopse?titulo=Solo%20Leveling", null);

        assertEquals(200, resposta.statusCode(), resposta.body());
        assertEquals("Dez anos atrás, o Portal se abriu.", json(resposta).get("descricao").asText());
        assertEquals("pt", json(resposta).get("idioma").asText());
        assertEquals("MangaDex", json(resposta).get("fonte").asText());
        assertEquals("Solo Leveling", json(resposta).get("tituloEncontrado").asText());
        assertFalse(json(resposta).get("traduzida").asBoolean());

        internet.mangadex = "{\"data\":[]}";
        assertEquals(404, enviar("GET", "/api/sinopse?titulo=zzzz", null).statusCode());
        assertEquals(400, enviar("GET", "/api/sinopse", null).statusCode());
        assertEquals(400, enviar("GET", "/api/sinopse?titulo=%20", null).statusCode());
    }

    @Test
    void semAcessoAInternetASinopseSoNaoEEncontrada() throws Exception {
        assertEquals(404, enviar("GET", "/api/sinopse?titulo=Solo%20Leveling", null).statusCode());
    }

    // ------------------------------------------------------------------ leitura registrada pelo navegador

    @Test
    void registraALeituraELerUsaOsEnderecosExatos() throws Exception {
        String comix = "https://comix.to/title/0vx0d-doomsday-wedding/";
        HttpResponse<String> criado = enviar("POST", "/api/mangas", manga("Doomsday Wedding", "7", "LENDO")
                .replace("https://site-a.com/manga/solo-leveling/capitulo-{cap}", comix + "6880186-chapter-{cap}"));
        assertEquals(201, criado.statusCode(), criado.body());
        String id = json(criado).get("id").asText();
        // so com o modelo, o proximo sairia com o id errado
        assertEquals(comix + "6880186-chapter-8", json(criado).get("nextChapterLink").asText());

        // li o 8 e a pagina mostrava o link do 9
        HttpResponse<String> leitura = enviar("POST", "/api/mangas/" + id + "/capitulo-lido",
                "{\"lastChapter\": 8, \"lastChapterUrl\": \"" + comix + "6912345-chapter-8\", \"nextChapterUrl\": \"" + comix + "6954321-chapter-9\"}");
        assertEquals(200, leitura.statusCode(), leitura.body());
        assertEquals("8", json(leitura).get("lastChapter").asText());
        assertEquals(comix + "6912345-chapter-8", json(leitura).get("lastChapterLink").asText());
        assertEquals(comix + "6954321-chapter-9", json(leitura).get("nextChapterLink").asText());
        assertEquals(comix + "6954321-chapter-9", enviar("GET", "/api/mangas/" + id + "/ler", null).headers().firstValue("Location").orElseThrow());

        // li o 9 e a pagina nao mostrava o proximo: "Ler" abre o 9, que tem o botao de proximo do site
        enviar("POST", "/api/mangas/" + id + "/capitulo-lido", "{\"lastChapter\": 9, \"lastChapterUrl\": \"" + comix + "6954321-chapter-9\"}");
        assertEquals(comix + "6954321-chapter-9", enviar("GET", "/api/mangas/" + id + "/ler", null).headers().firstValue("Location").orElseThrow());

        for (String corpo : List.of("{}", "{\"lastChapter\": 8}", "{\"lastChapter\": -1, \"lastChapterUrl\": \"" + comix + "x\"}",
                "{\"lastChapter\": 8, \"lastChapterUrl\": \"javascript:alert(1)\"}",
                "{\"lastChapter\": 8, \"lastChapterUrl\": \"" + comix + "x\", \"nextChapterUrl\": \"ftp://x\"}")) {
            assertEquals(400, enviar("POST", "/api/mangas/" + id + "/capitulo-lido", corpo).statusCode(), corpo);
        }
        assertEquals(404, enviar("POST", "/api/mangas/" + UUID.randomUUID() + "/capitulo-lido", "{\"lastChapter\": 8, \"lastChapterUrl\": \"" + comix + "x\"}").statusCode());
        assertEquals("9", json(enviar("GET", "/api/mangas/" + id, null)).get("lastChapter").asText());
    }

    // ------------------------------------------------------------------ dia de lancamento

    private static String mangaComDia(String titulo, String status, String dia) {
        return manga(titulo, "1", status).replace("\"description\"", "\"releaseDay\": " + dia + ", \"description\"");
    }

    @Test
    void lancamentosMostraSoQuemEstaLendoELancaNoDia() throws Exception {
        HttpResponse<String> quarta = enviar("POST", "/api/mangas", mangaComDia("Quarta", "LENDO", "\"QUARTA\""));
        assertEquals(201, quarta.statusCode(), quarta.body());
        assertEquals("QUARTA", json(quarta).get("releaseDay").asText());
        String id = json(quarta).get("id").asText();
        enviar("POST", "/api/mangas", mangaComDia("Sexta", "LENDO", "\"SEXTA\""));
        HttpResponse<String> semDia = enviar("POST", "/api/mangas", mangaComDia("Sem dia", "LENDO", "null"));
        assertTrue(json(semDia).get("releaseDay").isNull());
        cadastrar("Concluído", "1", "CONCLUIDO");

        assertEquals(List.of("Quarta"), titulos("/api/mangas/lancamentos?dia=QUARTA"));
        assertEquals(List.of("Quarta"), titulos("/api/mangas/lancamentos?dia=quarta"));
        assertEquals(List.of("Sexta"), titulos("/api/mangas/lancamentos?dia=SEXTA"));
        assertEquals(List.of(), titulos("/api/mangas/lancamentos?dia=DOMINGO"));
        assertEquals(400, enviar("GET", "/api/mangas/lancamentos", null).statusCode());
        assertEquals(400, enviar("GET", "/api/mangas/lancamentos?dia=FERIADO", null).statusCode());

        // parar de ler tira o manga da lista e apaga o dia
        HttpResponse<String> parou = enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"readingStatus\": \"HIATUS\"}");
        assertEquals(200, parou.statusCode(), parou.body());
        assertTrue(json(parou).get("releaseDay").isNull());
        assertEquals(List.of(), titulos("/api/mangas/lancamentos?dia=QUARTA"));
    }

    @Test
    void recusaDiaDeLancamentoForaDoStatusLendo() throws Exception {
        for (String status : List.of("DROPADO", "CANCELADO", "CONCLUIDO", "HIATUS", "LER")) {
            HttpResponse<String> resposta = enviar("POST", "/api/mangas", mangaComDia("T", status, "\"QUARTA\""));
            assertEquals(400, resposta.statusCode(), status);
            assertEquals("O dia de lançamento só pode ser definido para mangás com status Lendo", json(resposta).get("mensagem").asText());
        }
        HttpResponse<String> diaInvalido = enviar("POST", "/api/mangas", mangaComDia("T", "LENDO", "\"FERIADO\""));
        assertEquals(400, diaInvalido.statusCode());
        assertEquals("Valor inválido no campo 'releaseDay'", json(diaInvalido).get("mensagem").asText());
        assertEquals(List.of(), titulos("/api/mangas"));
    }

    @Test
    void listaOsDiasDaSemanaParaOFormulario() throws Exception {
        JsonNode dias = json(enviar("GET", "/api/dias-da-semana", null));
        List<String> valores = new ArrayList<>();
        dias.forEach(item -> valores.add(item.get("valor").asText()));

        assertEquals(List.of("SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"), valores);
        assertEquals("Terça-feira", dias.get(1).get("descricao").asText());
    }

    // ------------------------------------------------------------------ imagens

    @Test
    void enviaImagemEUsaNoCadastro() throws Exception {
        HttpResponse<String> envio = enviarImagem("arquivo", ImagemServiceTest.PNG);
        assertEquals(201, envio.statusCode(), envio.body());
        String imagePath = json(envio).get("imagePath").asText();
        assertEquals("/api/imagens/" + imagePath, json(envio).get("imageUrl").asText());

        HttpResponse<String> criado = enviar("POST", "/api/mangas",
                manga("Com capa", "1", "LENDO").replace("https://site.com/capa.png", imagePath));
        assertEquals(201, criado.statusCode(), criado.body());
        assertEquals("/api/imagens/" + imagePath, json(criado).get("imageUrl").asText());

        HttpResponse<byte[]> imagem = http.send(
                HttpRequest.newBuilder(URI.create(base + json(criado).get("imageUrl").asText())).build(),
                BodyHandlers.ofByteArray());
        assertEquals(200, imagem.statusCode());
        assertEquals("image/png", imagem.headers().firstValue("Content-Type").orElseThrow());
        assertArrayEquals(ImagemServiceTest.PNG, imagem.body());

        // excluir o manga apaga a capa
        assertEquals(204, enviar("DELETE", "/api/mangas/" + json(criado).get("id").asText(), null).statusCode());
        assertEquals(404, enviar("GET", "/api/imagens/" + imagePath, null).statusCode());
    }

    @Test
    void recusaEnvioQueNaoEImagem() throws Exception {
        assertEquals(400, enviarImagem("arquivo", "<script>alert(1)</script>".getBytes()).statusCode());
        assertEquals(400, enviarImagem("outroCampo", ImagemServiceTest.PNG).statusCode());
        assertEquals(400, enviar("POST", "/api/imagens", "{}").statusCode());
        assertEquals(400, enviar("POST", "/api/imagens", null).statusCode());
        assertFalse(Files.exists(pasta.resolve("imagens")));
    }

    @Test
    void recusaImagemAcimaDoLimite() throws Exception {
        byte[] grande = new byte[ImagemService.TAMANHO_MAXIMO + 1];
        System.arraycopy(ImagemServiceTest.PNG, 0, grande, 0, ImagemServiceTest.PNG.length);

        HttpResponse<String> resposta = enviarImagem("arquivo", grande);

        assertEquals(400, resposta.statusCode(), resposta.body());
        assertFalse(Files.exists(pasta.resolve("imagens")));
    }

    @Test
    void aceitaImagemGrandeDentroDoLimite() throws Exception {
        byte[] grande = new byte[ImagemService.TAMANHO_MAXIMO];
        System.arraycopy(ImagemServiceTest.PNG, 0, grande, 0, ImagemServiceTest.PNG.length);

        HttpResponse<String> resposta = enviarImagem("arquivo", grande);

        assertEquals(201, resposta.statusCode(), resposta.body());
    }

    @Test
    void naoServeArquivosDeForaDaPastaDeImagens() throws Exception {
        cadastrar("Solo Leveling", "1", "LENDO"); // cria o mangas.json ao lado da pasta de imagens

        assertEquals(404, enviar("GET", "/api/imagens/..%2Fmangas.json", null).statusCode());
        assertEquals(404, enviar("GET", "/api/imagens/mangas.json", null).statusCode());
        assertEquals(404, enviar("GET", "/api/imagens/00000000-0000-0000-0000-000000000000.png", null).statusCode());
    }

    // ------------------------------------------------------------------ opcoes e CORS

    @Test
    void listaOsStatusEFormatosParaOsFormularios() throws Exception {
        JsonNode status = json(enviar("GET", "/api/status", null));
        List<String> valores = new ArrayList<>();
        status.forEach(item -> valores.add(item.get("valor").asText()));
        assertEquals(List.of("LENDO", "DROPADO", "CANCELADO", "CONCLUIDO", "HIATUS", "LER"), valores);
        assertEquals("Concluído", status.get(3).get("descricao").asText());

        JsonNode formatos = json(enviar("GET", "/api/formatos-decimais", null));
        assertEquals("HIFEN", formatos.get(0).get("valor").asText());
        assertEquals("X-5", formatos.get(0).get("descricao").asText());
        assertEquals(3, formatos.size());
    }

    @Test
    void corsLiberaSoOSiteConfigurado() throws Exception {
        HttpResponse<String> doSite = http.send(HttpRequest.newBuilder(URI.create(base + "/api/mangas"))
                .header("Origin", SITE).build(), BodyHandlers.ofString());
        assertEquals(200, doSite.statusCode());
        assertEquals(SITE, doSite.headers().firstValue("Access-Control-Allow-Origin").orElse(null));

        HttpResponse<String> deOutroSite = http.send(HttpRequest.newBuilder(URI.create(base + "/api/mangas"))
                .header("Origin", "http://site-malicioso.com").build(), BodyHandlers.ofString());
        assertTrue(deOutroSite.headers().firstValue("Access-Control-Allow-Origin").isEmpty());

        HttpResponse<String> preflight = http.send(HttpRequest.newBuilder(URI.create(base + "/api/mangas/x/progresso"))
                .method("OPTIONS", BodyPublishers.noBody())
                .header("Origin", SITE)
                .header("Access-Control-Request-Method", "PATCH")
                .header("Access-Control-Request-Headers", "content-type")
                .build(), BodyHandlers.ofString());
        assertEquals(SITE, preflight.headers().firstValue("Access-Control-Allow-Origin").orElse(null));
        assertTrue(preflight.headers().firstValue("Access-Control-Allow-Methods").orElse("").contains("PATCH"));
    }

    // ------------------------------------------------------------------ site, login e outros sites

    @Test
    void serveOSiteJuntoComAApi() throws Exception {
        HttpResponse<String> pagina = enviar("GET", "/", null);
        assertEquals(200, pagina.statusCode());
        assertTrue(pagina.headers().firstValue("Content-Type").orElse("").startsWith("text/html"));
        assertTrue(pagina.body().contains("<script src=\"app.js\">"), pagina.body());
        assertTrue(pagina.headers().firstValue("Content-Security-Policy").orElse("").contains("default-src 'self'"));

        assertEquals(200, enviar("GET", "/app.js", null).statusCode());
        assertEquals(200, enviar("GET", "/app.css", null).statusCode());
        assertEquals(200, enviar("GET", "/favicon.svg", null).statusCode());
    }

    @Test
    void comSenhaConfiguradaTudoPedeLogin() throws Exception {
        app.stop();
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(), new ApiServer.Credenciais("manga", "sênha secreta"))
                .criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();

        for (String caminho : List.of("/", "/app.js", "/api/mangas", "/api/status", "/api/imagens/x.png")) {
            HttpResponse<String> semLogin = enviar("GET", caminho, null);
            assertEquals(401, semLogin.statusCode(), caminho);
            assertTrue(semLogin.headers().firstValue("WWW-Authenticate").orElse("").startsWith("Basic"), caminho);
            assertFalse(semLogin.body().contains("<script"), caminho);
        }
        assertEquals(401, enviar("POST", "/api/mangas", manga("T", "1", "LENDO")).statusCode());
        // a hospedagem consulta /healthz sem senha; ele nao mostra nenhum dado
        assertEquals(200, enviar("GET", "/healthz", null).statusCode());
        assertEquals("ok", enviar("GET", "/healthz", null).body());
        assertEquals(401, comLogin("GET", "/api/mangas", "manga", "errada").statusCode());
        assertEquals(401, comLogin("GET", "/api/mangas", "outro", "sênha secreta").statusCode());
        assertEquals(401, comLogin("GET", "/api/mangas", "manga", "").statusCode());
        assertEquals(401, http.send(HttpRequest.newBuilder(URI.create(base + "/api/mangas"))
                .header("Authorization", "Basic !!!nao-e-base64").build(), BodyHandlers.ofString()).statusCode());

        assertEquals(200, comLogin("GET", "/api/mangas", "manga", "sênha secreta").statusCode());
        assertEquals(200, comLogin("GET", "/", "manga", "sênha secreta").statusCode());
        assertEquals("[]", comLogin("GET", "/api/mangas", "manga", "sênha secreta").body()); // o POST sem login nao cadastrou
    }

    private HttpResponse<String> comLogin(String metodo, String caminho, String usuario, String senha) throws Exception {
        String login = java.util.Base64.getEncoder().encodeToString((usuario + ":" + senha).getBytes(StandardCharsets.UTF_8));
        return http.send(HttpRequest.newBuilder(URI.create(base + caminho))
                .method(metodo, BodyPublishers.noBody())
                .header("Authorization", "Basic " + login)
                .build(), BodyHandlers.ofString());
    }

    @Test
    void outroSiteNaoConsegueAlterarOsDados() throws Exception {
        String id = cadastrar("Solo Leveling", "1", "LENDO").get("id").asText();

        for (String origem : List.of("http://site-malicioso.com", "null", "http://127.0.0.1:1")) {
            assertEquals(403, comOrigem("DELETE", "/api/mangas/" + id, origem, null).statusCode(), origem);
            assertEquals(403, comOrigem("POST", "/api/mangas", origem, manga("T", "1", "LENDO")).statusCode(), origem);
            assertEquals(403, comOrigem("PATCH", "/api/mangas/" + id + "/progresso", origem, "{\"lastChapter\": 9}").statusCode(), origem);
            assertEquals(403, comOrigem("POST", "/api/imagens", origem, "x").statusCode(), origem);
        }
        assertEquals(List.of("Solo Leveling"), titulos("/api/mangas"));
        assertEquals("1", json(enviar("GET", "/api/mangas/" + id, null)).get("lastChapter").asText());

        // o proprio site e o endereco liberado no CORS continuam podendo
        assertEquals(200, comOrigem("PATCH", "/api/mangas/" + id + "/progresso", base, "{\"lastChapter\": 2}").statusCode());
        assertEquals(200, comOrigem("PATCH", "/api/mangas/" + id + "/progresso", SITE, "{\"lastChapter\": 3}").statusCode());
    }

    private HttpResponse<String> comOrigem(String metodo, String caminho, String origem, String corpo) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(base + caminho))
                .method(metodo, corpo == null ? BodyPublishers.noBody() : BodyPublishers.ofString(corpo))
                .header("Content-Type", "application/json")
                .header("Origin", origem)
                .build(), BodyHandlers.ofString());
    }
}
