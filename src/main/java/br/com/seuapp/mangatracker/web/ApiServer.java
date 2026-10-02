package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidChapterException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.NullInformationsException;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import br.com.seuapp.mangatracker.service.DadosManga;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.MangaServiceInterface;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamWriteFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import io.javalin.Javalin;
import io.javalin.config.SizeUnit;
import io.javalin.http.Context;
import io.javalin.http.HandlerType;
import io.javalin.http.HttpStatus;
import io.javalin.http.UploadedFile;
import io.javalin.http.staticfiles.Location;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Serve o site e as rotas HTTP usadas por ele. Aqui so se traduz HTTP <-> service, as regras ficam no service. */
public class ApiServer {

    private static final Logger LOG = LoggerFactory.getLogger(ApiServer.class);

    private final MangaServiceInterface mangaService;
    private final ImagemService imagemService;
    private final List<String> origensPermitidas;
    private final Credenciais credenciais;
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(StreamWriteFeature.WRITE_BIGDECIMAL_AS_PLAIN)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    /**
     * @param origensPermitidas enderecos do site que podem chamar a API pelo navegador (CORS),
     *                          ex.: http://localhost:5173. "*" libera qualquer um.
     * @param credenciais       usuario e senha pedidos em toda requisicao, ou null para nao pedir login
     */
    public ApiServer(MangaServiceInterface mangaService, ImagemService imagemService, List<String> origensPermitidas, Credenciais credenciais) {
        this.mangaService = mangaService;
        this.imagemService = imagemService;
        this.origensPermitidas = origensPermitidas;
        this.credenciais = credenciais;
    }

    public record Credenciais(String usuario, String senha) {
    }

    private record ProgressoRequest(BigDecimal lastChapter, ReadingStatus readingStatus) {
    }

    public Javalin criar() {
        return Javalin.create(config -> {
            config.startup.showJavalinBanner = false;
            config.jetty.multipartConfig.maxFileSize(ImagemService.TAMANHO_MAXIMO, SizeUnit.BYTES);
            configurarCors(config.bundledPlugins);

            // o site (src/main/resources/public) e servido junto com a API
            config.staticFiles.add("/public", Location.CLASSPATH);
            config.routes.before(this::protegerResposta);
            config.routes.before(this::exigirLogin);
            config.routes.before("/api/*", this::recusarOutrosSites);

            config.routes.get("/api/mangas", this::listar);
            config.routes.post("/api/mangas", this::cadastrar);
            config.routes.get("/api/mangas/sorteio", this::sortear);
            config.routes.get("/api/mangas/{id}", this::buscar);
            config.routes.put("/api/mangas/{id}", this::editar);
            config.routes.patch("/api/mangas/{id}/progresso", this::atualizarProgresso);
            config.routes.delete("/api/mangas/{id}", this::excluir);
            config.routes.get("/api/mangas/{id}/ler", this::ler);

            config.routes.post("/api/imagens", this::enviarImagem);
            config.routes.get("/api/imagens/{nome}", this::baixarImagem);

            // usado pela hospedagem para saber se o programa esta no ar; nao pede login nem mostra dados
            config.routes.get("/healthz", ctx -> ctx.result("ok"));

            config.routes.get("/api/status", this::listarStatus);
            config.routes.get("/api/formatos-decimais", this::listarFormatosDecimais);

            config.routes.exception(NullInformationsException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidLinkException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidChapterException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidImageException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(RequisicaoInvalidaException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(NotFoundException.class, (e, ctx) -> erro(ctx, HttpStatus.NOT_FOUND, e.getMessage()));
            config.routes.exception(PersistenciaException.class, (e, ctx) -> {
                LOG.error("Falha de persistencia", e);
                erro(ctx, HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível salvar os dados");
            });
            config.routes.exception(Exception.class, (e, ctx) -> {
                LOG.error("Erro inesperado em {} {}", ctx.method(), ctx.path(), e);
                erro(ctx, HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado");
            });
        });
    }

    // ------------------------------------------------------------------ seguranca

    private void protegerResposta(Context ctx) {
        // o site so carrega scripts e estilos dele mesmo; capas podem vir de outros enderecos
        ctx.header("Content-Security-Policy",
                "default-src 'self'; img-src 'self' https: http: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        ctx.header("X-Content-Type-Options", "nosniff");
        ctx.header("Referrer-Policy", "no-referrer");
    }

    private void exigirLogin(Context ctx) {
        // o navegador nao manda a senha na consulta previa do CORS (OPTIONS)
        if (credenciais == null || ctx.method() == HandlerType.OPTIONS || ctx.path().equals("/healthz")
                || loginCorreto(ctx.header("Authorization"))) {
            return;
        }
        ctx.header("WWW-Authenticate", "Basic realm=\"Meus Mangas\", charset=\"UTF-8\"");
        erro(ctx, HttpStatus.UNAUTHORIZED, "Informe o usuário e a senha");
        ctx.skipRemainingHandlers();
    }

    private boolean loginCorreto(String cabecalho) {
        if (cabecalho == null || !cabecalho.regionMatches(true, 0, "Basic ", 0, 6)) {
            return false;
        }
        byte[] informado;
        try {
            informado = Base64.getDecoder().decode(cabecalho.substring(6).trim());
        } catch (IllegalArgumentException e) {
            return false;
        }
        byte[] esperado = (credenciais.usuario() + ":" + credenciais.senha()).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(esperado, informado); // comparacao em tempo constante
    }

    /** Impede que outro site aberto no navegador altere os dados usando o login de quem esta visitando. */
    private void recusarOutrosSites(Context ctx) {
        String origem = ctx.header("Origin");
        HandlerType metodo = ctx.method();
        if (origem == null || metodo == HandlerType.GET || metodo == HandlerType.HEAD || metodo == HandlerType.OPTIONS) {
            return;
        }
        boolean doProprioSite = origem.equalsIgnoreCase("http://" + ctx.header("Host"))
                || origem.equalsIgnoreCase("https://" + ctx.header("Host"));
        if (!doProprioSite && !origensPermitidas.contains(origem) && !origensPermitidas.contains("*")) {
            erro(ctx, HttpStatus.FORBIDDEN, "Requisição vinda de outro site");
            ctx.skipRemainingHandlers();
        }
    }

    // ------------------------------------------------------------------ mangas

    private void listar(Context ctx) throws JsonProcessingException {
        List<MangaResponse> mangas = mangaService.listarMangas(ctx.queryParam("titulo"), lerStatus(ctx)).stream()
                .map(MangaResponse::de)
                .toList();
        json(ctx, HttpStatus.OK, mangas);
    }

    private void cadastrar(Context ctx) throws JsonProcessingException {
        DadosManga dados = lerCorpo(ctx, DadosManga.class);
        json(ctx, HttpStatus.CREATED, MangaResponse.de(mangaService.salvarManga(dados)));
    }

    private void sortear(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.sortearManga(lerStatus(ctx))));
    }

    private void buscar(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.buscarPorId(lerId(ctx))));
    }

    private void editar(Context ctx) throws JsonProcessingException {
        UUID id = lerId(ctx);
        DadosManga dados = lerCorpo(ctx, DadosManga.class);
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.editarManga(id, dados)));
    }

    private void atualizarProgresso(Context ctx) throws JsonProcessingException {
        UUID id = lerId(ctx);
        ProgressoRequest progresso = lerCorpo(ctx, ProgressoRequest.class);
        json(ctx, HttpStatus.OK, MangaResponse.de(
                mangaService.atualizarProgresso(id, progresso.lastChapter(), progresso.readingStatus())));
    }

    private void excluir(Context ctx) {
        mangaService.excluirManga(lerId(ctx));
        ctx.status(HttpStatus.NO_CONTENT);
    }

    /** Manda o navegador para o proximo capitulo ainda nao lido, no site salvo. */
    private void ler(Context ctx) {
        ctx.redirect(mangaService.buscarPorId(lerId(ctx)).linkProximoCapitulo(), HttpStatus.FOUND);
    }

    // ------------------------------------------------------------------ imagens

    private void enviarImagem(Context ctx) throws Exception {
        UploadedFile arquivo;
        try {
            arquivo = ctx.isMultipartFormData() ? ctx.uploadedFile("arquivo") : null;
        } catch (Exception e) {
            // o servidor recusa o envio antes de chegar aqui quando passa do limite ou vem quebrado
            throw new RequisicaoInvalidaException("Não foi possível ler a imagem. Ela pode ter no máximo 10 MB");
        }
        if (arquivo == null) {
            throw new RequisicaoInvalidaException("Envie a imagem em multipart/form-data, no campo 'arquivo'");
        }
        String nome;
        try (InputStream conteudo = arquivo.content()) {
            nome = imagemService.salvar(conteudo);
        }
        json(ctx, HttpStatus.CREATED, Map.of("imagePath", nome, "imageUrl", "/api/imagens/" + nome));
    }

    private void baixarImagem(Context ctx) throws Exception {
        String nome = ctx.pathParam("nome");
        byte[] imagem = imagemService.carregar(nome);
        ctx.contentType(imagemService.tipoDeConteudo(nome));
        ctx.header("X-Content-Type-Options", "nosniff");
        // o nome muda a cada envio, entao o navegador pode guardar para sempre
        ctx.header("Cache-Control", "public, max-age=31536000, immutable");
        ctx.result(imagem);
    }

    // ------------------------------------------------------------------ opcoes dos formularios

    private void listarStatus(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, Arrays.stream(ReadingStatus.values())
                .map(status -> Map.of("valor", status.name(), "descricao", status.getDescricao()))
                .toList());
    }

    private void listarFormatosDecimais(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, Arrays.stream(ChapterDecimalFormat.values())
                .map(formato -> Map.of("valor", formato.name(), "descricao", formato.getDescricao()))
                .toList());
    }

    // ------------------------------------------------------------------

    private void configurarCors(io.javalin.config.BundledPluginsConfig plugins) {
        if (origensPermitidas.isEmpty()) {
            return;
        }
        plugins.enableCors(cors -> cors.addRule(regra -> {
            if (origensPermitidas.contains("*")) {
                regra.anyHost();
            } else {
                regra.allowHost(origensPermitidas.get(0),
                        origensPermitidas.subList(1, origensPermitidas.size()).toArray(String[]::new));
            }
        }));
    }

    private UUID lerId(Context ctx) {
        try {
            return UUID.fromString(ctx.pathParam("id"));
        } catch (IllegalArgumentException e) {
            throw new NotFoundException("Mangá não encontrado");
        }
    }

    private ReadingStatus lerStatus(Context ctx) {
        String status = ctx.queryParam("status");
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return ReadingStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RequisicaoInvalidaException("Status inválido. Use um de: " + Arrays.toString(ReadingStatus.values()));
        }
    }

    private <T> T lerCorpo(Context ctx, Class<T> tipo) {
        T corpo;
        try {
            corpo = mapper.readValue(ctx.body(), tipo);
        } catch (JsonMappingException e) {
            String campo = e.getPath().isEmpty() ? null : e.getPath().get(0).getFieldName();
            throw new RequisicaoInvalidaException(campo == null
                    ? "O corpo da requisição não é um JSON válido"
                    : "Valor inválido no campo '" + campo + "'");
        } catch (JsonProcessingException e) {
            throw new RequisicaoInvalidaException("O corpo da requisição não é um JSON válido");
        }
        if (corpo == null) {
            throw new RequisicaoInvalidaException("O corpo da requisição não é um JSON válido");
        }
        return corpo;
    }

    private void json(Context ctx, HttpStatus status, Object corpo) throws JsonProcessingException {
        ctx.status(status);
        ctx.contentType("application/json; charset=utf-8");
        ctx.result(mapper.writeValueAsString(corpo));
    }

    private void erro(Context ctx, HttpStatus status, String mensagem) {
        try {
            json(ctx, status, Map.of("mensagem", mensagem));
        } catch (JsonProcessingException e) {
            ctx.status(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private static class RequisicaoInvalidaException extends RuntimeException {
        RequisicaoInvalidaException(String message) {
            super(message);
        }
    }
}
