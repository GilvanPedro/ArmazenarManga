package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.repository.ArquivoContaRepository;
import br.com.seuapp.mangatracker.repository.ArquivoImagemRepositoryPorConta;
import br.com.seuapp.mangatracker.repository.JsonMangaRepository;
import br.com.seuapp.mangatracker.repository.JsonMangaRepositoryPorConta;
import br.com.seuapp.mangatracker.service.ContaService;
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
    // guarda o cookie de login, como o navegador: depois de entrar, todas as chamadas vao com ele
    final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
            .cookieHandler(new java.net.CookieManager(null, java.net.CookiePolicy.ACCEPT_ALL)).build();
    // sem cookie nenhum: para conferir o que acontece sem login
    final HttpClient semLogin = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(new JsonMangaRepository(pasta.resolve("mangas.json")), imagemService);
        app = new ApiServer(mangaService, imagemService, List.of(SITE), null).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
        entrarComContaDeTeste();
    }

    @AfterEach
    void tearDown() {
        app.stop();
    }

    // ------------------------------------------------------------------ ajudantes

    /** Cria uma conta e entra nela: o cookie fica guardado no cliente http. */
    private void entrarComContaDeTeste() {
        try {
            HttpResponse<String> criada = enviar("POST", "/api/contas", "{\"email\": \"teste@exemplo.com\", \"nick\": \"Teste\", \"senha\": \"123456\"}");
            assertEquals(201, criada.statusCode(), criada.body());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

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

        // concluidos e cancelados tambem podem ser sorteados
        cadastrar("C", "1", "CONCLUIDO");
        cadastrar("D", "1", "CANCELADO");
        java.util.Set<String> sorteados = new java.util.HashSet<>();
        for (int i = 0; i < 200; i++) {
            sorteados.add(json(enviar("GET", "/api/mangas/sorteio", null)).get("title").asText());
        }
        assertEquals(java.util.Set.of("A", "B", "C", "D"), sorteados);
        assertEquals("C", json(enviar("GET", "/api/mangas/sorteio?status=CONCLUIDO", null)).get("title").asText());
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
        entrarComContaDeTeste();
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
        assertEquals(9, ordens.size());
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
        entrarComContaDeTeste();
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

        // tags que a obra nao pode ter
        assertEquals(200, enviar("GET", "/api/recomendacoes?tags=Fantasy&sem=Horror,%20Romance,,", null).statusCode());
        String comExclusao = anilist.perguntasDeExploracao.get(1);
        assertTrue(comExclusao.contains("\"gn\":[\"Horror\",\"Romance\"]") && comExclusao.contains("\"g\":[\"Fantasy\"]"), comExclusao);

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
        entrarComContaDeTeste();
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
        entrarComContaDeTeste();
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
        entrarComContaDeTeste();

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

    // ------------------------------------------------------------------ nota

    @Test
    void daTrocaETiraANota() throws Exception {
        HttpResponse<String> criado = enviar("POST", "/api/mangas", manga("Com nota", "1", "LENDO").replace("\"description\"", "\"rating\": 8, \"description\""));
        assertEquals(201, criado.statusCode(), criado.body());
        assertEquals(8, json(criado).get("rating").asInt());
        String id = json(criado).get("id").asText();
        assertTrue(json(enviar("POST", "/api/mangas", manga("Sem nota", "1", "LENDO"))).get("rating").isNull());

        HttpResponse<String> dez = enviar("PUT", "/api/mangas/" + id + "/nota", "{\"rating\": 10}");
        assertEquals(200, dez.statusCode(), dez.body());
        assertEquals(10, json(dez).get("rating").asInt());
        assertEquals(0, json(enviar("PUT", "/api/mangas/" + id + "/nota", "{\"rating\": 0}")).get("rating").asInt());
        // avancar o capitulo nao mexe na nota
        assertEquals(0, json(enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 2}")).get("rating").asInt());

        for (String invalida : List.of("11", "-1", "7.5", "\"oito\"")) {
            HttpResponse<String> recusa = enviar("PUT", "/api/mangas/" + id + "/nota", "{\"rating\": " + invalida + "}");
            assertEquals(400, recusa.statusCode(), invalida + " -> " + recusa.body());
        }
        assertEquals("A nota precisa ser um número inteiro de 0 a 10", json(enviar("PUT", "/api/mangas/" + id + "/nota", "{\"rating\": 11}")).get("mensagem").asText());
        assertEquals(400, enviar("POST", "/api/mangas", manga("Nota demais", "1", "LENDO").replace("\"description\"", "\"rating\": 42, \"description\"")).statusCode());
        assertEquals(0, json(enviar("GET", "/api/mangas/" + id, null)).get("rating").asInt());

        assertTrue(json(enviar("PUT", "/api/mangas/" + id + "/nota", "{\"rating\": null}")).get("rating").isNull());
        assertEquals(404, enviar("PUT", "/api/mangas/" + java.util.UUID.randomUUID() + "/nota", "{\"rating\": 5}").statusCode());
    }

    // ------------------------------------------------------------------ favorito e ordem pela nota

    private String cadastrarComNota(String titulo, String nota) throws Exception {
        HttpResponse<String> criado = enviar("POST", "/api/mangas", manga(titulo, "1", "LENDO").replace("\"description\"", "\"rating\": " + nota + ", \"description\""));
        assertEquals(201, criado.statusCode(), criado.body());
        assertFalse(json(criado).get("favorite").asBoolean());
        return json(criado).get("id").asText();
    }

    @Test
    void ordenaPelasNotasEPelosFavoritos() throws Exception {
        cadastrarComNota("Médio", "6");
        String semNota = cadastrarComNota("Sem nota", "null");
        cadastrarComNota("Zero", "0");
        String dez = cadastrarComNota("Dez", "10");
        cadastrarComNota("Também seis", "6");

        // quem nao tem nota fica no fim nas duas ordens; empate em ordem alfabetica
        assertEquals(List.of("Dez", "Médio", "Também seis", "Zero", "Sem nota"), titulos("/api/mangas?ordem=MELHORES_NOTAS"));
        assertEquals(List.of("Zero", "Médio", "Também seis", "Dez", "Sem nota"), titulos("/api/mangas?ordem=PIORES_NOTAS"));

        HttpResponse<String> marcado = enviar("PUT", "/api/mangas/" + dez + "/favorito", "{\"favorite\": true}");
        assertEquals(200, marcado.statusCode(), marcado.body());
        assertTrue(json(marcado).get("favorite").asBoolean());
        assertEquals(10, json(marcado).get("rating").asInt());
        enviar("PUT", "/api/mangas/" + semNota + "/favorito", "{\"favorite\": true}");
        // favoritos primeiro, o resto na ordem de cadastro
        assertEquals(List.of("Sem nota", "Dez", "Médio", "Zero", "Também seis"), titulos("/api/mangas?ordem=FAVORITOS"));

        // a edicao geral nao desmarca
        HttpResponse<String> editado = enviar("PUT", "/api/mangas/" + dez, manga("Dez", "3", "LENDO"));
        assertEquals(200, editado.statusCode(), editado.body());
        assertTrue(json(editado).get("favorite").asBoolean());

        assertFalse(json(enviar("PUT", "/api/mangas/" + dez + "/favorito", "{\"favorite\": false}")).get("favorite").asBoolean());
        assertEquals(400, enviar("PUT", "/api/mangas/" + dez + "/favorito", "{}").statusCode());
        assertEquals(400, enviar("PUT", "/api/mangas/" + dez + "/favorito", "{\"favorite\": \"sim\"}").statusCode());
        assertEquals(404, enviar("PUT", "/api/mangas/" + java.util.UUID.randomUUID() + "/favorito", "{\"favorite\": true}").statusCode());
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
    void lancamentosEscondemQuemJaLeuHoje() throws Exception {
        String id = json(enviar("POST", "/api/mangas", mangaComDia("Leio hoje", "LENDO", "\"QUARTA\""))).get("id").asText();
        enviar("POST", "/api/mangas", mangaComDia("Deixo para depois", "LENDO", "\"QUARTA\""));
        String inicioDoDia = java.time.Instant.now().minusSeconds(3600).toString();
        String amanha = java.time.Instant.now().plusSeconds(3600).toString();

        assertEquals(List.of("Leio hoje", "Deixo para depois"), titulos("/api/mangas/lancamentos?dia=QUARTA&desde=" + inicioDoDia));
        assertEquals(200, enviar("PATCH", "/api/mangas/" + id + "/progresso", "{\"lastChapter\": 2}").statusCode());

        // li o capitulo: some da lista de hoje, mas continua nos lancamentos de quarta para a semana que vem
        assertEquals(List.of("Deixo para depois"), titulos("/api/mangas/lancamentos?dia=QUARTA&desde=" + inicioDoDia));
        assertEquals(List.of("Leio hoje", "Deixo para depois"), titulos("/api/mangas/lancamentos?dia=QUARTA&desde=" + amanha));
        assertEquals(List.of("Leio hoje", "Deixo para depois"), titulos("/api/mangas/lancamentos?dia=QUARTA"));
        assertEquals(400, enviar("GET", "/api/mangas/lancamentos?dia=QUARTA&desde=ontem", null).statusCode());
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

    /** Sobe o servidor com contas guardadas em arquivo e uma pasta de dados por conta, como o programa de verdade. */
    private void subirComContas(byte[] segredo, List<String> emailsAdmin) throws Exception {
        app.stop();
        ImagemService imagemService = new ImagemService(new ArquivoImagemRepositoryPorConta(pasta));
        MangaService mangaService = new MangaService(new JsonMangaRepositoryPorConta(pasta), imagemService);
        ContaService contas = new ContaService(new ArquivoContaRepository(pasta.resolve("contas.json")), mangaService, imagemService, emailsAdmin,
                1_000, java.time.Clock.systemUTC());
        app = new ApiServer(mangaService, imagemService, List.of(), new ApiServer.Acesso(contas, segredo)).criar().start("127.0.0.1", 0);
        base = "http://127.0.0.1:" + app.port();
    }

    /** Chamada com um cookie escolhido (ou nenhum), fora do cliente que guarda o login. */
    private HttpResponse<String> comCookie(String metodo, String caminho, String cookie, String corpo) throws Exception {
        HttpRequest.Builder requisicao = HttpRequest.newBuilder(URI.create(base + caminho))
                .method(metodo, corpo == null ? BodyPublishers.noBody() : BodyPublishers.ofString(corpo));
        if (cookie != null) {
            requisicao.header("Cookie", "outro=1; mangas_sessao=" + cookie);
        }
        if (corpo != null) {
            requisicao.header("Content-Type", "application/json");
        }
        return semLogin.send(requisicao.build(), BodyHandlers.ofString());
    }

    private static String conta(String email, String nick, String senha) {
        return "{\"email\": \"" + email + "\", \"nick\": \"" + nick + "\", \"senha\": \"" + senha + "\"}";
    }

    private static String login(String email, String senha) {
        return "{\"email\": \"" + email + "\", \"senha\": \"" + senha + "\"}";
    }

    /** O valor do cookie de login que a resposta mandou gravar. */
    private static String cookieDe(HttpResponse<String> resposta) {
        String cabecalho = resposta.headers().firstValue("Set-Cookie").orElseThrow();
        return cabecalho.substring(cabecalho.indexOf('=') + 1, cabecalho.indexOf(';'));
    }

    @Test
    void semLoginOsDadosNaoSaem() throws Exception {
        for (String caminho : List.of("/api/mangas", "/api/status", "/api/imagens/x.png", "/api/tags", "/api/conta")) {
            HttpResponse<String> sem = comCookie("GET", caminho, null, null);
            assertEquals(401, sem.statusCode(), caminho);
            // sem a janela de senha do navegador: quem pede o login e a tela do site
            assertTrue(sem.headers().firstValue("WWW-Authenticate").isEmpty(), caminho);
            assertEquals("Entre na sua conta", json(sem).get("mensagem").asText());
        }
        assertEquals(401, comCookie("POST", "/api/mangas", null, manga("T", "1", "LENDO")).statusCode());
        // os arquivos do site nao tem dados: abrem sem login, para a tela de login aparecer
        for (String caminho : List.of("/", "/app.js", "/app.css", "/favicon.svg", "/icones/nota-bom.svg", "/healthz")) {
            assertEquals(200, comCookie("GET", caminho, null, null).statusCode(), caminho);
        }
        JsonNode inicio = json(comCookie("GET", "/api/inicio", null, null));
        assertFalse(inicio.get("sessao").get("logado").asBoolean());
        assertTrue(inicio.get("sessao").get("conta").isNull());
        // cookie inventado ou de outro formato nao entra
        for (String falso : List.of("qualquer-coisa", "v1.9999999999.x.y", "v2." + UUID.randomUUID() + ".9999999999.x.y", "")) {
            assertEquals(401, comCookie("GET", "/api/mangas", falso, null).statusCode(), falso);
        }
    }

    @Test
    void criarContaJaEntraNelaPorTrintaDias() throws Exception {
        HttpResponse<String> criada = comCookie("POST", "/api/contas", null, conta("  Gilvan@Exemplo.COM ", "  Leitor   de Manhwa ", "sênha6"));
        assertEquals(201, criada.statusCode(), criada.body());
        JsonNode sessao = json(criada);
        assertTrue(sessao.get("logado").asBoolean());
        assertEquals("gilvan@exemplo.com", sessao.get("conta").get("email").asText());
        assertEquals("Leitor de Manhwa", sessao.get("conta").get("nick").asText());
        assertFalse(sessao.get("conta").get("admin").asBoolean());
        assertFalse(criada.body().contains("pbkdf2") || criada.body().contains("sênha6"), "a senha nunca sai do servidor");
        String cabecalho = criada.headers().firstValue("Set-Cookie").orElseThrow();
        assertTrue(cabecalho.startsWith("mangas_sessao=v2.") && cabecalho.contains("; Max-Age=2592000;") && cabecalho.contains("HttpOnly")
                && cabecalho.contains("SameSite=Lax") && !cabecalho.contains("Secure"), cabecalho);
        java.time.Instant expira = java.time.Instant.parse(sessao.get("expiraEm").asText());
        assertTrue(Math.abs(java.time.Duration.between(java.time.Instant.now().plus(java.time.Duration.ofDays(30)), expira).toSeconds()) < 60);

        String cookie = cookieDe(criada);
        assertEquals("Leitor de Manhwa", json(comCookie("GET", "/api/sessao", cookie, null)).get("conta").get("nick").asText());
        assertEquals(200, comCookie("GET", "/api/mangas", cookie, null).statusCode());
        // entrar de novo, com o e-mail escrito de outro jeito
        assertEquals(200, comCookie("POST", "/api/sessao", null, login("GILVAN@exemplo.com", "sênha6")).statusCode());
        HttpResponse<String> saiu = comCookie("DELETE", "/api/sessao", cookie, null);
        assertEquals(204, saiu.statusCode());
        assertTrue(saiu.headers().firstValue("Set-Cookie").orElseThrow().startsWith("mangas_sessao=; Path=/; Max-Age=0;"));
    }

    @Test
    void cadastroRecusaDadosInvalidosEEmailRepetido() throws Exception {
        record Caso(String corpo, int status, String mensagem) {
        }
        for (Caso caso : List.of(
                new Caso(conta("sem-arroba", "Nick", "123456"), 400, "E-mail inválido"),
                new Caso(conta("", "Nick", "123456"), 400, "Informe o e-mail"),
                new Caso(conta("a@b.com", "   ", "123456"), 400, "Escolha um nick"),
                new Caso(conta("a@b.com", "x".repeat(41), "123456"), 400, "O nick pode ter no máximo 40 caracteres"),
                new Caso(conta("a@b.com", "Nick", "12345"), 400, "A senha precisa ter pelo menos 6 caracteres"),
                new Caso(conta("TESTE@exemplo.com", "Outro", "123456"), 409, "Já existe uma conta com esse e-mail"))) {
            HttpResponse<String> resposta = comCookie("POST", "/api/contas", null, caso.corpo());
            assertEquals(caso.status(), resposta.statusCode(), caso.corpo());
            assertEquals(caso.mensagem(), json(resposta).get("mensagem").asText());
            assertTrue(resposta.headers().firstValue("Set-Cookie").isEmpty());
        }
        // outro site nao consegue criar conta nem entrar pelo navegador de quem visita
        HttpRequest deFora = HttpRequest.newBuilder(URI.create(base + "/api/contas")).POST(BodyPublishers.ofString(conta("c@d.com", "N", "123456")))
                .header("Content-Type", "application/json").header("Origin", "http://site-malicioso.com").build();
        assertEquals(403, semLogin.send(deFora, BodyHandlers.ofString()).statusCode());
    }

    @Test
    void loginErradoNaoEntraEMuitosErrosFreiamAqueleEmail() throws Exception {
        HttpResponse<String> senhaErrada = comCookie("POST", "/api/sessao", null, login("teste@exemplo.com", "errada"));
        HttpResponse<String> emailQueNaoExiste = comCookie("POST", "/api/sessao", null, login("ninguem@exemplo.com", "123456"));
        // a mesma resposta: nao da para descobrir quais e-mails tem conta
        assertEquals(401, senhaErrada.statusCode());
        assertEquals(senhaErrada.body(), emailQueNaoExiste.body());
        assertEquals("E-mail ou senha incorretos", json(senhaErrada).get("mensagem").asText());
        assertEquals(400, comCookie("POST", "/api/sessao", null, "{\"email\": \"teste@exemplo.com\"}").statusCode());

        for (int i = 0; i < 9; i++) {
            comCookie("POST", "/api/sessao", null, login("teste@exemplo.com", "chute " + i));
        }
        // 10 erros: o e-mail espera, mesmo com a senha certa; os outros e-mails continuam entrando
        HttpResponse<String> freado = comCookie("POST", "/api/sessao", null, login("teste@exemplo.com", "123456"));
        assertEquals(429, freado.statusCode());
        assertTrue(json(freado).get("mensagem").asText().startsWith("Muitas tentativas. Tente de novo em 15 minutos"), freado.body());
        assertEquals(201, comCookie("POST", "/api/contas", null, conta("outra@exemplo.com", "Outra", "abcdef")).statusCode());
        assertEquals(200, comCookie("POST", "/api/sessao", null, login("outra@exemplo.com", "abcdef")).statusCode());
        // quem ja estava dentro continua
        assertEquals(200, enviar("GET", "/api/mangas", null).statusCode());
    }

    @Test
    void cadaContaSoVeOsPropriosMangasECapas() throws Exception {
        subirComContas(new byte[32], null);
        String cookieA = cookieDe(comCookie("POST", "/api/contas", null, conta("a@exemplo.com", "A", "123456")));
        String cookieB = cookieDe(comCookie("POST", "/api/contas", null, conta("b@exemplo.com", "B", "123456")));
        String limite = "----limite";
        String corpoDaCapa = "--" + limite + "\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\"c.png\"\r\nContent-Type: image/png\r\n\r\n";
        byte[] envio = java.util.Arrays.copyOf(corpoDaCapa.getBytes(StandardCharsets.UTF_8), corpoDaCapa.length() + ImagemServiceTest.PNG.length + limite.length() + 8);
        System.arraycopy(ImagemServiceTest.PNG, 0, envio, corpoDaCapa.length(), ImagemServiceTest.PNG.length);
        byte[] fim = ("\r\n--" + limite + "--\r\n").getBytes(StandardCharsets.UTF_8);
        System.arraycopy(fim, 0, envio, corpoDaCapa.length() + ImagemServiceTest.PNG.length, fim.length);
        HttpResponse<String> capa = semLogin.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens"))
                .header("Content-Type", "multipart/form-data; boundary=" + limite).header("Cookie", "mangas_sessao=" + cookieA)
                .POST(BodyPublishers.ofByteArray(envio)).build(), BodyHandlers.ofString());
        assertEquals(201, capa.statusCode(), capa.body());
        String nomeDaCapa = json(capa).get("imagePath").asText();
        HttpResponse<String> criado = comCookie("POST", "/api/mangas", cookieA, manga("Só da A", "1", "LENDO").replace("https://site.com/capa.png", nomeDaCapa));
        assertEquals(201, criado.statusCode(), criado.body());
        String id = json(criado).get("id").asText();

        assertEquals(1, json(comCookie("GET", "/api/mangas?pagina=1", cookieA, null)).get("total").asInt());
        assertEquals(0, json(comCookie("GET", "/api/mangas?pagina=1", cookieB, null)).get("total").asInt());
        assertEquals(404, comCookie("GET", "/api/mangas/" + id, cookieB, null).statusCode());
        assertEquals(404, comCookie("PUT", "/api/mangas/" + id, cookieB, manga("Tomado", "9", "LENDO")).statusCode());
        assertEquals(404, comCookie("PATCH", "/api/mangas/" + id + "/progresso", cookieB, "{\"lastChapter\": 9}").statusCode());
        assertEquals(404, comCookie("DELETE", "/api/mangas/" + id, cookieB, null).statusCode());
        assertEquals(404, comCookie("GET", "/api/imagens/" + nomeDaCapa, cookieB, null).statusCode());
        assertEquals(200, comCookie("GET", "/api/imagens/" + nomeDaCapa, cookieA, null).statusCode());
        // B nao consegue usar a capa da A no manga dele
        assertEquals(400, comCookie("POST", "/api/mangas", cookieB, manga("Capa alheia", "1", "LENDO").replace("https://site.com/capa.png", nomeDaCapa)).statusCode());
        assertEquals("Só da A", json(comCookie("GET", "/api/mangas/" + id, cookieA, null)).get("title").asText());
        assertEquals(1, json(comCookie("GET", "/api/conta", cookieA, null)).get("mangas").asInt());
        assertEquals(0, json(comCookie("GET", "/api/conta", cookieB, null)).get("mangas").asInt());
    }

    @Test
    void editarAContaPedeASenhaSoParaEmailESenha() throws Exception {
        String cookie = cookieDe(comCookie("POST", "/api/sessao", null, login("teste@exemplo.com", "123456")));
        comCookie("POST", "/api/contas", null, conta("ocupado@exemplo.com", "Outro", "123456"));

        JsonNode nick = json(comCookie("PUT", "/api/conta", cookie, "{\"nick\": \"  Nick   Novo \"}"));
        assertEquals("Nick Novo", nick.get("conta").get("nick").asText());
        assertEquals("Nick Novo", json(comCookie("GET", "/api/conta", cookie, null)).get("nick").asText());

        assertEquals(400, comCookie("PUT", "/api/conta", cookie, "{\"email\": \"novo@exemplo.com\"}").statusCode());
        assertEquals(403, comCookie("PUT", "/api/conta", cookie, "{\"email\": \"novo@exemplo.com\", \"senhaAtual\": \"errada\"}").statusCode());
        assertEquals(409, comCookie("PUT", "/api/conta", cookie, "{\"email\": \"OCUPADO@exemplo.com\", \"senhaAtual\": \"123456\"}").statusCode());
        assertEquals(400, comCookie("PUT", "/api/conta", cookie, "{\"email\": \"invalido\", \"senhaAtual\": \"123456\"}").statusCode());
        HttpResponse<String> email = comCookie("PUT", "/api/conta", cookie, "{\"email\": \"Novo@Exemplo.com\", \"senhaAtual\": \"123456\"}");
        assertEquals("novo@exemplo.com", json(email).get("conta").get("email").asText());
        assertEquals(200, comCookie("POST", "/api/sessao", null, login("novo@exemplo.com", "123456")).statusCode());
        assertEquals(401, comCookie("POST", "/api/sessao", null, login("teste@exemplo.com", "123456")).statusCode());

        // senha nova: este aparelho ganha um cookie novo; o cookie antigo (outro aparelho) para de valer
        assertEquals(400, comCookie("PUT", "/api/conta", cookie, "{\"senhaNova\": \"12345\", \"senhaAtual\": \"123456\"}").statusCode());
        HttpResponse<String> senha = comCookie("PUT", "/api/conta", cookie, "{\"senhaNova\": \"senha-nova\", \"senhaAtual\": \"123456\"}");
        assertEquals(200, senha.statusCode(), senha.body());
        String cookieNovo = cookieDe(senha);
        assertEquals(401, comCookie("GET", "/api/conta", cookie, null).statusCode());
        assertEquals(200, comCookie("GET", "/api/conta", cookieNovo, null).statusCode());
        assertEquals(401, comCookie("POST", "/api/sessao", null, login("novo@exemplo.com", "123456")).statusCode());
        assertEquals(200, comCookie("POST", "/api/sessao", null, login("novo@exemplo.com", "senha-nova")).statusCode());
    }

    @Test
    void excluirAContaPedeASenhaEApagaTudoDela() throws Exception {
        subirComContas(new byte[32], null);
        String cookie = cookieDe(comCookie("POST", "/api/contas", null, conta("sai@exemplo.com", "Vai Sair", "123456")));
        String outra = cookieDe(comCookie("POST", "/api/contas", null, conta("fica@exemplo.com", "Fica", "123456")));
        comCookie("POST", "/api/mangas", cookie, manga("Dela", "1", "LENDO"));
        comCookie("POST", "/api/mangas", outra, manga("Da outra", "1", "LENDO"));

        assertEquals(400, comCookie("DELETE", "/api/conta", cookie, "{}").statusCode());
        assertEquals(403, comCookie("DELETE", "/api/conta", cookie, "{\"senha\": \"errada\"}").statusCode());
        assertEquals(1, json(comCookie("GET", "/api/conta", cookie, null)).get("mangas").asInt());

        HttpResponse<String> excluida = comCookie("DELETE", "/api/conta", cookie, "{\"senha\": \"123456\"}");
        assertEquals(204, excluida.statusCode());
        assertTrue(excluida.headers().firstValue("Set-Cookie").orElseThrow().contains("Max-Age=0"));
        assertEquals(401, comCookie("GET", "/api/mangas", cookie, null).statusCode());
        assertEquals(401, comCookie("POST", "/api/sessao", null, login("sai@exemplo.com", "123456")).statusCode());
        // a outra conta nao perdeu nada; o e-mail ficou livre
        assertEquals(1, json(comCookie("GET", "/api/mangas?pagina=1", outra, null)).get("total").asInt());
        String deNovo = cookieDe(comCookie("POST", "/api/contas", null, conta("sai@exemplo.com", "Voltou", "123456")));
        assertEquals(0, json(comCookie("GET", "/api/mangas?pagina=1", deNovo, null)).get("total").asInt());
    }

    @Test
    void soAdminVeETrazOsMangasAntigos() throws Exception {
        // admin pelo e-mail configurado (MANGATRACKER_ADMIN_EMAIL), escrito de outro jeito
        subirComContas(new byte[32], List.of(" Dono@Exemplo.com "));
        // um manga de antes das contas, gravado direto na conta antiga
        new JsonMangaRepositoryPorConta(pasta).salvar(new br.com.seuapp.mangatracker.domain.Manga("Antigo", "https://site.com/c.png",
                new java.util.ArrayList<>(), "https://site.com/{cap}", null, java.math.BigDecimal.ONE, br.com.seuapp.mangatracker.domain.ReadingStatus.LENDO, ""));
        String dono = cookieDe(comCookie("POST", "/api/contas", null, conta("dono@exemplo.com", "Dono", "123456")));
        String visita = cookieDe(comCookie("POST", "/api/contas", null, conta("visita@exemplo.com", "Visita", "123456")));

        // quem nao e admin nem fica sabendo que existem mangas antigos, e nao consegue trazer
        JsonNode daVisita = json(comCookie("GET", "/api/conta", visita, null));
        assertFalse(daVisita.get("admin").asBoolean());
        assertEquals(0, daVisita.get("mangasAntigos").asInt());
        HttpResponse<String> recusado = comCookie("POST", "/api/conta/mangas-antigos", visita, "{}");
        assertEquals(403, recusado.statusCode());
        assertEquals("Só administradores podem trazer os mangás antigos", json(recusado).get("mensagem").asText());

        JsonNode doDono = json(comCookie("GET", "/api/conta", dono, null));
        assertTrue(doDono.get("admin").asBoolean());
        assertEquals(1, doDono.get("mangasAntigos").asInt());
        assertTrue(json(comCookie("GET", "/api/sessao", dono, null)).get("conta").get("admin").asBoolean());
        HttpResponse<String> trazidos = comCookie("POST", "/api/conta/mangas-antigos", dono, "{}");
        assertEquals(200, trazidos.statusCode(), trazidos.body());
        assertEquals(1, json(trazidos).get("trazidos").asInt());
        JsonNode depois = json(comCookie("GET", "/api/conta", dono, null));
        assertEquals(1, depois.get("mangas").asInt());
        assertEquals(0, depois.get("mangasAntigos").asInt());
        assertEquals(List.of("Antigo"), json(comCookie("GET", "/api/mangas", dono, null)).findValuesAsText("title"));
        assertEquals(0, json(comCookie("GET", "/api/mangas?pagina=1", visita, null)).get("total").asInt());

        // quem trouxe fica marcado como admin, mesmo sem o e-mail configurado
        subirComContas(new byte[32], null);
        String semVariavel = cookieDe(comCookie("POST", "/api/sessao", null, login("dono@exemplo.com", "123456")));
        assertTrue(json(comCookie("GET", "/api/conta", semVariavel, null)).get("admin").asBoolean());
        String visitaSemVariavel = cookieDe(comCookie("POST", "/api/sessao", null, login("visita@exemplo.com", "123456")));
        assertEquals(403, comCookie("POST", "/api/conta/mangas-antigos", visitaSemVariavel, "{}").statusCode());
    }

    /** Envia uma imagem com o cookie escolhido e devolve o nome dela. */
    private String enviarImagemComo(String cookie, byte[] conteudo) throws Exception {
        String limite = "----limite";
        java.io.ByteArrayOutputStream corpo = new java.io.ByteArrayOutputStream();
        corpo.write(("--" + limite + "\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\"f.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        corpo.write(conteudo);
        corpo.write(("\r\n--" + limite + "--\r\n").getBytes(StandardCharsets.UTF_8));
        HttpResponse<String> resposta = semLogin.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens"))
                .header("Content-Type", "multipart/form-data; boundary=" + limite).header("Cookie", "mangas_sessao=" + cookie)
                .POST(BodyPublishers.ofByteArray(corpo.toByteArray())).build(), BodyHandlers.ofString());
        assertEquals(201, resposta.statusCode(), resposta.body());
        return json(resposta).get("imagePath").asText();
    }

    @Test
    void fotoDePerfilSoDaPropriaContaETrocarApagaAAntiga() throws Exception {
        subirComContas(new byte[32], null);
        String cookie = cookieDe(comCookie("POST", "/api/contas", null, conta("foto@exemplo.com", "Com Foto", "123456")));
        String outra = cookieDe(comCookie("POST", "/api/contas", null, conta("outra@exemplo.com", "Outra", "123456")));
        assertTrue(json(comCookie("GET", "/api/sessao", cookie, null)).get("conta").get("foto").isNull());

        String primeira = enviarImagemComo(cookie, ImagemServiceTest.PNG);
        HttpResponse<String> comFoto = comCookie("PUT", "/api/conta", cookie, "{\"foto\": \"" + primeira + "\"}");
        assertEquals(200, comFoto.statusCode(), comFoto.body());
        assertEquals("/api/imagens/" + primeira, json(comFoto).get("conta").get("foto").asText());
        assertEquals("/api/imagens/" + primeira, json(comCookie("GET", "/api/conta", cookie, null)).get("foto").asText());
        assertEquals("/api/imagens/" + primeira, json(comCookie("GET", "/api/sessao", cookie, null)).get("conta").get("foto").asText());
        assertEquals(200, comCookie("GET", "/api/imagens/" + primeira, cookie, null).statusCode());
        // a foto e da conta: outra conta nao abre, nem consegue usar como foto dela
        assertEquals(404, comCookie("GET", "/api/imagens/" + primeira, outra, null).statusCode());
        assertEquals(400, comCookie("PUT", "/api/conta", outra, "{\"foto\": \"" + primeira + "\"}").statusCode());
        assertEquals(400, comCookie("PUT", "/api/conta", cookie, "{\"foto\": \"../segredo.png\"}").statusCode());
        assertEquals(400, comCookie("PUT", "/api/conta", cookie, "{\"foto\": 42}").statusCode());
        // editar so o nick nao mexe na foto
        assertEquals("/api/imagens/" + primeira, json(comCookie("PUT", "/api/conta", cookie, "{\"nick\": \"Novo\"}")).get("conta").get("foto").asText());

        // trocar: a foto antiga sai do armazenamento
        String segunda = enviarImagemComo(cookie, ImagemServiceTest.PNG);
        assertEquals("/api/imagens/" + segunda, json(comCookie("PUT", "/api/conta", cookie, "{\"foto\": \"" + segunda + "\"}")).get("conta").get("foto").asText());
        assertEquals(404, comCookie("GET", "/api/imagens/" + primeira, cookie, null).statusCode());
        // tirar
        assertTrue(json(comCookie("PUT", "/api/conta", cookie, "{\"foto\": null}")).get("conta").get("foto").isNull());
        assertEquals(404, comCookie("GET", "/api/imagens/" + segunda, cookie, null).statusCode());
    }

    @Test
    void oLoginContinuaDepoisDeReiniciarComOMesmoSegredo() throws Exception {
        byte[] segredo = new byte[32];
        segredo[0] = 7;
        subirComContas(segredo, null);
        String cookie = cookieDe(comCookie("POST", "/api/contas", null, conta("fica@exemplo.com", "Fica", "123456")));

        subirComContas(segredo, null); // mesmo segredo guardado: o login de antes continua valendo
        assertEquals(200, comCookie("GET", "/api/mangas", cookie, null).statusCode());

        subirComContas(new byte[32], null); // segredo apagado: todos os logins acabam
        assertEquals(401, comCookie("GET", "/api/mangas", cookie, null).statusCode());
    }

    // ------------------------------------------------------------------ desempenho

    @Test
    void inicioTrazASessaoEAsListasFixasEmUmaChamadaSo() throws Exception {
        // abre sem login: a tela de entrada precisa saber que o login falta
        HttpResponse<String> semLogin = comCookie("GET", "/api/inicio", null, null);
        assertEquals(200, semLogin.statusCode());
        JsonNode inicio = json(semLogin);
        assertFalse(inicio.get("sessao").get("logado").asBoolean());
        assertTrue(inicio.get("sessao").get("exigeLogin").asBoolean());
        assertEquals(6, inicio.get("status").size());
        assertEquals("LENDO", inicio.get("status").get(0).get("valor").asText());
        assertEquals(3, inicio.get("formatos").size());
        assertEquals(7, inicio.get("dias").size());
        assertEquals(9, inicio.get("ordensDaLista").size());
        assertTrue(inicio.get("ordensDeRecomendacao").size() > 0);
        assertEquals("no-store", semLogin.headers().firstValue("Cache-Control").orElse(""));

        JsonNode comLogin = json(enviar("GET", "/api/inicio", null));
        assertTrue(comLogin.get("sessao").get("logado").asBoolean());
        assertEquals("Teste", comLogin.get("sessao").get("conta").get("nick").asText());
    }

    @Test
    void listaResumidaDeixaDeForaADescricaoEOsOutrosNomes() throws Exception {
        cadastrar("Solo Leveling", "1", "LENDO");

        JsonNode completa = json(enviar("GET", "/api/mangas", null)).get(0);
        JsonNode resumida = json(enviar("GET", "/api/mangas?resumo=1", null)).get(0);
        assertFalse(completa.get("description").isNull());
        assertTrue(resumida.get("description").isNull());
        assertEquals(0, resumida.get("altTitles").size());
        // o resto, que os cartoes usam, continua igual
        for (String campo : List.of("id", "title", "imageUrl", "readingStatus", "lastChapter", "nextChapterLink", "tags", "rating", "favorite")) {
            assertEquals(completa.get(campo), resumida.get(campo), campo);
        }
        assertEquals(1, json(enviar("GET", "/api/mangas?resumo=1&pagina=1", null)).get("itens").size());
    }

    @Test
    void listaInteiraSoQuandoCabeNoLimite() throws Exception {
        for (int i = 1; i <= 5; i++) {
            cadastrar("Manga " + i, String.valueOf(i), i % 2 == 0 ? "LER" : "LENDO");
        }

        JsonNode cabe = json(enviar("GET", "/api/mangas?resumo=1&pagina=1&tamanho=2&inteiraAte=5", null));
        assertTrue(cabe.get("inteira").asBoolean());
        assertEquals(5, cabe.get("itens").size());
        assertEquals(5, cabe.get("total").asInt());

        JsonNode grande = json(enviar("GET", "/api/mangas?resumo=1&pagina=1&tamanho=2&inteiraAte=4", null));
        assertFalse(grande.get("inteira").asBoolean());
        assertEquals(2, grande.get("itens").size());
        assertEquals(5, grande.get("total").asInt());
        assertEquals(3, grande.get("paginas").asInt());

        // os filtros contam: so 3 estao lendo, entao cabem em 4
        JsonNode filtrada = json(enviar("GET", "/api/mangas?resumo=1&pagina=1&tamanho=2&inteiraAte=4&status=LENDO&ordem=TITULO_DESC", null));
        assertTrue(filtrada.get("inteira").asBoolean());
        assertEquals(List.of("Manga 5", "Manga 3", "Manga 1"), filtrada.get("itens").findValuesAsText("title"));
        // a lista resumida aceita paginas grandes; a completa, nao
        assertEquals(5, json(enviar("GET", "/api/mangas?resumo=1&pagina=1&tamanho=1500", null)).get("itens").size());
        assertEquals(100, json(enviar("GET", "/api/mangas?pagina=1&tamanho=1500", null)).get("tamanho").asInt());
    }

    @Test
    void sitesDosMangasSemRepetir() throws Exception {
        cadastrar("A", "1", "LENDO");
        cadastrar("B", "1", "LENDO");
        assertEquals("[\"site-a.com\"]", enviar("GET", "/api/sites", null).body());
    }

    @Test
    void miniaturaDaCapaApareceNaListaEVaiEmboraComACapa() throws Exception {
        String capa = json(enviarImagem("arquivo", ImagemServiceTest.PNG)).get("imagePath").asText();
        String semExtensao = capa.substring(0, capa.indexOf('.'));
        String id = json(enviar("POST", "/api/mangas", manga("Com capa", "1", "LENDO").replace("https://site.com/capa.png", capa))).get("id").asText();
        assertTrue(json(enviar("GET", "/api/mangas", null)).get(0).get("thumbUrl").isNull());

        byte[] webp = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 1, 2};
        HttpResponse<String> guardada = http.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens/" + capa + "/miniatura"))
                .PUT(BodyPublishers.ofByteArray(webp)).header("Content-Type", "image/webp").build(), BodyHandlers.ofString());
        assertEquals(200, guardada.statusCode(), guardada.body());
        String endereco = "/api/imagens/" + semExtensao + "-mini.webp";
        assertEquals(endereco, json(guardada).get("thumbUrl").asText());

        // aparece na lista, na resumida e nos lancamentos; a pagina do manga continua com a capa inteira
        assertEquals(endereco, json(enviar("GET", "/api/mangas?resumo=1", null)).get(0).get("thumbUrl").asText());
        assertEquals(endereco, json(enviar("GET", "/api/mangas?pagina=1", null)).get("itens").get(0).get("thumbUrl").asText());
        assertEquals("/api/imagens/" + capa, json(enviar("GET", "/api/mangas/" + id, null)).get("imageUrl").asText());
        HttpResponse<byte[]> baixada = http.send(HttpRequest.newBuilder(URI.create(base + endereco)).build(), HttpResponse.BodyHandlers.ofByteArray());
        assertArrayEquals(webp, baixada.body());
        assertEquals("image/webp", baixada.headers().firstValue("Content-Type").orElse(""));

        assertEquals(400, http.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens/" + capa + "/miniatura"))
                .PUT(BodyPublishers.ofByteArray(ImagemServiceTest.PNG)).build(), BodyHandlers.ofString()).statusCode());
        assertEquals(404, http.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens/" + UUID.randomUUID() + ".png/miniatura"))
                .PUT(BodyPublishers.ofByteArray(webp)).build(), BodyHandlers.ofString()).statusCode());
        assertEquals(403, http.send(HttpRequest.newBuilder(URI.create(base + "/api/imagens/" + capa + "/miniatura"))
                .PUT(BodyPublishers.ofByteArray(webp)).header("Origin", "http://site-malicioso.com").build(), BodyHandlers.ofString()).statusCode());

        // excluir o manga apaga a capa e a miniatura
        assertEquals(204, enviar("DELETE", "/api/mangas/" + id, null).statusCode());
        assertEquals(404, enviar("GET", endereco, null).statusCode());
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
