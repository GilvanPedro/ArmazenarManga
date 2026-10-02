package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.repository.JsonMangaRepository;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.ImagemServiceTest;
import br.com.seuapp.mangatracker.service.MangaService;
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
