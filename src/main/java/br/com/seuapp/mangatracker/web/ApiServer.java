package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.OrdemDaLista;
import br.com.seuapp.mangatracker.repository.ConsultaDeMangas;
import br.com.seuapp.mangatracker.repository.PaginaDeMangas;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.WeekDay;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidChapterException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidRatingException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidReleaseDayException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.NullInformationsException;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import br.com.seuapp.mangatracker.service.DadosManga;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.MangaServiceInterface;
import br.com.seuapp.mangatracker.service.RecomendacaoService;
import br.com.seuapp.mangatracker.service.ResultadoVerificacao;
import br.com.seuapp.mangatracker.service.SinopseService;
import br.com.seuapp.mangatracker.service.SituacaoDoLink;
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
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Serve o site e as rotas HTTP usadas por ele. Aqui so se traduz HTTP <-> service, as regras ficam no service. */
public class ApiServer {

    private static final Logger LOG = LoggerFactory.getLogger(ApiServer.class);

    private final MangaServiceInterface mangaService;
    private final ImagemService imagemService;
    private final List<String> origensPermitidas;
    private final Credenciais credenciais;
    private final SinopseService sinopseService;
    private final RecomendacaoService recomendacaoService;
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(StreamWriteFeature.WRITE_BIGDECIMAL_AS_PLAIN)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            // a nota e um numero inteiro: 7.5 e recusado em vez de virar 7 em silencio
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .build();

    /**
     * @param origensPermitidas enderecos do site que podem chamar a API pelo navegador (CORS),
     *                          ex.: http://localhost:5173. "*" libera qualquer um.
     * @param credenciais       usuario e senha da tela de login, ou null para nao pedir login
     */
    public ApiServer(MangaServiceInterface mangaService, ImagemService imagemService, List<String> origensPermitidas, Credenciais credenciais) {
        this(mangaService, imagemService, origensPermitidas, credenciais, new SinopseService(SEM_INTERNET));
    }

    /** @param sinopseService busca na internet a descricao dos mangas para preencher o cadastro */
    public ApiServer(MangaServiceInterface mangaService, ImagemService imagemService, List<String> origensPermitidas, Credenciais credenciais, SinopseService sinopseService) {
        this(mangaService, imagemService, origensPermitidas, credenciais, sinopseService, new RecomendacaoService(SEM_INTERNET));
    }

    /** @param recomendacaoService busca na internet mangas parecidos com os da lista */
    public ApiServer(MangaServiceInterface mangaService, ImagemService imagemService, List<String> origensPermitidas, Credenciais credenciais,
                     SinopseService sinopseService, RecomendacaoService recomendacaoService) {
        this.recomendacaoService = recomendacaoService;
        this.sinopseService = sinopseService;
        this.mangaService = mangaService;
        this.imagemService = imagemService;
        this.origensPermitidas = origensPermitidas;
        this.credenciais = credenciais;
        this.sessoes = credenciais == null ? null : new Sessoes(credenciais.usuario(), credenciais.senha(), credenciais.segredo(), Clock.systemUTC());
    }

    /**
     * @param segredo assina os cookies de login (veja {@link Sessoes}); guardado junto dos dados para os logins
     *                continuarem valendo quando o servidor reinicia
     */
    public record Credenciais(String usuario, String senha, byte[] segredo) {
        /** Com um segredo novo: os logins deixam de valer quando o servidor reinicia. */
        public Credenciais(String usuario, String senha) {
            this(usuario, senha, segredoNovo());
        }

        private static byte[] segredoNovo() {
            byte[] segredo = new byte[32];
            new SecureRandom().nextBytes(segredo);
            return segredo;
        }
    }

    private final Sessoes sessoes;
    private final LimiteDeTentativas tentativas = new LimiteDeTentativas(Clock.systemUTC());

    private record LoginRequest(String usuario, String senha) {
    }

    /** exigeLogin false = site sem senha (uso so neste computador). expiraEm no formato ISO 8601. */
    private record SessaoResponse(boolean exigeLogin, boolean logado, String usuario, String expiraEm) {
    }

    /** Cliente que nunca encontra nada: usado quando a API e criada sem acesso a outros sites (testes). */
    private static final SinopseService.ClienteHttp SEM_INTERNET = new SinopseService.ClienteHttp() {
        @Override
        public String get(String endereco) {
            return null;
        }

        @Override
        public String postJson(String endereco, String corpo) {
            return null;
        }
    };

    private record ProgressoRequest(BigDecimal lastChapter, ReadingStatus readingStatus) {
    }

    private record FavoritoRequest(Boolean favorite) {
    }

    /** rating null (ou ausente) tira a nota. */
    private record NotaRequest(Integer rating) {
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

            config.routes.get("/api/inicio", this::inicio);
            config.routes.get("/api/sessao", this::verSessao);
            config.routes.post("/api/sessao", this::entrar);
            config.routes.delete("/api/sessao", this::sair);

            config.routes.get("/api/mangas", this::listar);
            config.routes.post("/api/mangas", this::cadastrar);
            config.routes.get("/api/mangas/sorteio", this::sortear);
            config.routes.get("/api/mangas/lancamentos", this::listarLancamentos);
            config.routes.get("/api/mangas/{id}", this::buscar);
            config.routes.put("/api/mangas/{id}", this::editar);
            config.routes.patch("/api/mangas/{id}/progresso", this::atualizarProgresso);
            config.routes.put("/api/mangas/{id}/nota", this::definirNota);
            config.routes.put("/api/mangas/{id}/favorito", this::definirFavorito);
            config.routes.delete("/api/mangas/{id}", this::excluir);
            config.routes.get("/api/mangas/{id}/ler", this::ler);
            config.routes.post("/api/mangas/{id}/verificacao-link", this::verificarLink);
            config.routes.post("/api/mangas/{id}/capitulo-lido", this::registrarLeitura);
            config.routes.get("/api/mangas/{id}/recomendacoes", this::recomendar);
            config.routes.get("/api/mangas/{id}/semelhantes", this::listarSemelhantes);
            config.routes.get("/api/tags", this::listarTags);
            config.routes.get("/api/sites", this::listarSites);
            config.routes.get("/api/recomendacoes", this::explorarRecomendacoes);
            config.routes.get("/api/recomendacoes/ordens", this::listarOrdensDeRecomendacao);
            config.routes.get("/api/ordens-da-lista", this::listarOrdensDaLista);

            config.routes.post("/api/imagens", this::enviarImagem);
            config.routes.get("/api/imagens/{nome}", this::baixarImagem);
            config.routes.put("/api/imagens/{nome}/miniatura", this::guardarMiniatura);

            // usado pela hospedagem para saber se o programa esta no ar; nao pede login nem mostra dados
            config.routes.get("/healthz", ctx -> ctx.result("ok"));

            config.routes.get("/api/status", this::listarStatus);
            config.routes.get("/api/formatos-decimais", this::listarFormatosDecimais);
            config.routes.get("/api/dias-da-semana", this::listarDiasDaSemana);
            config.routes.get("/api/sinopse", this::buscarSinopse);

            config.routes.exception(NullInformationsException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidLinkException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidChapterException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidReleaseDayException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
            config.routes.exception(InvalidRatingException.class, (e, ctx) -> erro(ctx, HttpStatus.BAD_REQUEST, e.getMessage()));
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

    /**
     * Os dados (tudo em /api) so saem para quem entrou. Os arquivos do site (HTML, CSS, JS, icones) nao tem
     * dado nenhum e ficam abertos, para a tela de login poder aparecer.
     */
    private void exigirLogin(Context ctx) {
        if (credenciais == null || ctx.method() == HandlerType.OPTIONS || !ctx.path().startsWith("/api/")
                || ctx.path().equals("/api/sessao") || ctx.path().equals("/api/inicio") || sessaoValida(ctx).isPresent()) {
            return;
        }
        erro(ctx, HttpStatus.UNAUTHORIZED, "Entre com seu usuário e senha");
        ctx.skipRemainingHandlers();
    }

    private Optional<Instant> sessaoValida(Context ctx) {
        return sessoes == null ? Optional.empty() : sessoes.validar(ctx.cookie(Sessoes.COOKIE));
    }

    private void verSessao(Context ctx) throws JsonProcessingException {
        ctx.header("Cache-Control", "no-store");
        json(ctx, HttpStatus.OK, sessao(ctx));
    }

    private SessaoResponse sessao(Context ctx) {
        if (credenciais == null) {
            return new SessaoResponse(false, true, null, null);
        }
        Optional<Instant> expira = sessaoValida(ctx);
        return new SessaoResponse(true, expira.isPresent(), expira.isPresent() ? credenciais.usuario() : null,
                expira.map(Instant::toString).orElse(null));
    }

    /** Tudo o que o site precisa para abrir, em uma chamada so: a sessao e as listas fixas (nenhuma tem dados da lista). */
    private record InicioResponse(SessaoResponse sessao, List<Map<String, String>> status, List<Map<String, String>> formatos,
                                  List<Map<String, String>> dias, List<OrdemResponse> ordensDaLista, List<OrdemResponse> ordensDeRecomendacao) {
    }

    private void inicio(Context ctx) throws JsonProcessingException {
        ctx.header("Cache-Control", "no-store");
        json(ctx, HttpStatus.OK, new InicioResponse(sessao(ctx), status(), formatos(), dias(), ordensDaLista(), ordensDeRecomendacao()));
    }

    private void entrar(Context ctx) throws JsonProcessingException {
        ctx.header("Cache-Control", "no-store");
        if (credenciais == null) {
            json(ctx, HttpStatus.OK, new SessaoResponse(false, true, null, null));
            return;
        }
        Duration espera = tentativas.espera();
        if (!espera.isZero()) {
            long minutos = Math.max(1, (espera.toSeconds() + 59) / 60);
            erro(ctx, HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas erradas. Tente de novo em " + minutos + (minutos == 1 ? " minuto" : " minutos"));
            return;
        }
        LoginRequest login = lerCorpo(ctx, LoginRequest.class);
        if (login.usuario() == null || login.usuario().isBlank() || login.senha() == null || login.senha().isEmpty()) {
            throw new RequisicaoInvalidaException("Informe o usuário e a senha");
        }
        // compara os resumos, para o tempo da comparacao nao dizer onde os textos diferem
        boolean certo = MessageDigest.isEqual(Sessoes.sha256(login.usuario().trim()), Sessoes.sha256(credenciais.usuario()))
                & MessageDigest.isEqual(Sessoes.sha256(login.senha()), Sessoes.sha256(credenciais.senha()));
        if (!certo) {
            tentativas.registrarErro();
            erro(ctx, HttpStatus.UNAUTHORIZED, "Usuário ou senha incorretos");
            return;
        }
        String cookie = sessoes.criar();
        gravarCookie(ctx, cookie, Sessoes.DURACAO.toSeconds());
        json(ctx, HttpStatus.OK, new SessaoResponse(true, true, credenciais.usuario(), sessoes.validar(cookie).orElseThrow().toString()));
    }

    /** Sai so neste navegador. Para sair de todos os aparelhos, troque a senha. */
    private void sair(Context ctx) {
        ctx.header("Cache-Control", "no-store");
        gravarCookie(ctx, "", 0);
        ctx.status(HttpStatus.NO_CONTENT);
    }

    /** HttpOnly: os scripts da pagina nao leem o cookie. SameSite=Lax: outros sites nao o usam para alterar dados. */
    private static void gravarCookie(Context ctx, String valor, long segundos) {
        boolean https = "https".equalsIgnoreCase(ctx.header("X-Forwarded-Proto")) || "https".equalsIgnoreCase(ctx.scheme());
        ctx.header("Set-Cookie", Sessoes.COOKIE + "=" + valor + "; Path=/; Max-Age=" + segundos + "; HttpOnly; SameSite=Lax" + (https ? "; Secure" : ""));
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

    private OrdemDaLista lerOrdemDaLista(Context ctx) {
        String ordem = ctx.queryParam("ordem");
        if (ordem == null || ordem.isBlank()) {
            return OrdemDaLista.CADASTRO;
        }
        try {
            return OrdemDaLista.valueOf(ordem.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RequisicaoInvalidaException("Ordem inválida. Use uma de: " + Arrays.toString(OrdemDaLista.values()));
        }
    }

    private void listarOrdensDaLista(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, ordensDaLista());
    }

    private static List<OrdemResponse> ordensDaLista() {
        return Arrays.stream(OrdemDaLista.values()).map(ordem -> new OrdemResponse(ordem.name(), ordem.getDescricao())).toList();
    }

    static final int TAMANHO_DA_PAGINA = 24; // 4 fileiras de 6 colunas
    private static final int TAMANHO_MAXIMO_DA_PAGINA = 100;
    /** A lista resumida aceita paginas maiores: o site guarda a lista inteira de quem tem ate esse tanto. */
    private static final int TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA = 2000;

    /** inteira = a resposta traz todos os mangas que passam nos filtros. */
    private record PaginaResponse(List<MangaResponse> itens, int pagina, int tamanho, int total, int paginas, boolean inteira) {
    }

    /**
     * Sem ?pagina devolve a lista inteira (usada por quem precisa de todos, como a busca de mangas).
     * Com ?pagina=N devolve so aquela pagina, junto com o total, para a grade carregar aos poucos.
     */
    private void listar(Context ctx) throws JsonProcessingException {
        // ?resumo=1: sem a descricao, que os cartoes nao usam (a lista fica bem menor)
        boolean resumida = "1".equals(ctx.queryParam("resumo"));
        ConsultaDeMangas consulta = ConsultaDeMangas.todos(ctx.queryParam("titulo"), lerStatus(ctx), ctx.queryParam("tag"), lerOrdemDaLista(ctx));
        if (ctx.queryParam("pagina") == null) {
            json(ctx, HttpStatus.OK, respostas(mangaService.consultar(consulta).mangas(), resumida));
            return;
        }
        // ?inteiraAte=N: se o total couber em N, devolve a lista inteira (inteira: true) em vez da pagina. Assim o site
        // descobre numa chamada so se pode guardar a lista toda ou se a conta e grande demais para isso
        if (ctx.queryParam("inteiraAte") != null) {
            int limite = Math.min(TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA, lerInteiroPositivo(ctx, "inteiraAte", TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA));
            if (mangaService.contar(consulta) <= limite) {
                List<Manga> todos = mangaService.consultar(consulta).mangas();
                json(ctx, HttpStatus.OK, new PaginaResponse(respostas(todos, resumida), 1, Math.max(1, todos.size()), todos.size(), 1, true));
                return;
            }
        }
        int tamanho = Math.min(resumida ? TAMANHO_MAXIMO_DA_PAGINA_RESUMIDA : TAMANHO_MAXIMO_DA_PAGINA, lerInteiroPositivo(ctx, "tamanho", TAMANHO_DA_PAGINA));
        int pedida = lerInteiroPositivo(ctx, "pagina", 1);
        PaginaDeMangas resultado = mangaService.consultar(consulta.pedaco(tamanho, (pedida - 1) * tamanho));
        int paginas = Math.max(1, (resultado.total() + tamanho - 1) / tamanho);
        // pagina alem do fim (um manga foi excluido, por exemplo) vira a ultima
        int pagina = Math.min(paginas, pedida);
        if (pagina != pedida) {
            resultado = mangaService.consultar(consulta.pedaco(tamanho, (pagina - 1) * tamanho));
        }
        json(ctx, HttpStatus.OK, new PaginaResponse(respostas(resultado.mangas(), resumida), pagina, tamanho, resultado.total(), paginas, paginas == 1));
    }

    /** Os mangas com as miniaturas deles (procuradas so para estes). */
    private List<MangaResponse> respostas(List<Manga> mangas, boolean resumida) {
        Map<String, String> miniaturas = imagemService.miniaturas(mangas.stream().map(Manga::getImagePath).toList());
        return mangas.stream().map(manga -> MangaResponse.de(manga, miniaturas)).map(manga -> resumida ? manga.resumo() : manga).toList();
    }

    /** Sites de leitura dos mangas, sem repetir: a extensao mostra o botao "Lido" neles. */
    private void listarSites(Context ctx) throws JsonProcessingException {
        java.util.Set<String> sites = new java.util.TreeSet<>();
        for (Manga manga : mangaService.listarMangas(null, null)) {
            for (String endereco : java.util.Arrays.asList(manga.getChapterLinkModel(), manga.getLastChapterUrl(), manga.getNextChapterUrl())) {
                if (endereco == null) {
                    continue;
                }
                try {
                    String host = java.net.URI.create(endereco.replace("{cap}", "1")).getRawAuthority();
                    if (host != null) {
                        sites.add(host.substring(host.indexOf('@') + 1).toLowerCase(Locale.ROOT));
                    }
                } catch (IllegalArgumentException e) {
                    // link fora do padrao: so nao entra na lista
                }
            }
        }
        json(ctx, HttpStatus.OK, sites);
    }

    private int lerInteiroPositivo(Context ctx, String nome, int padrao) {
        String valor = ctx.queryParam(nome);
        if (valor == null || valor.isBlank()) {
            return padrao;
        }
        try {
            int numero = Integer.parseInt(valor.trim());
            if (numero >= 1) {
                return numero;
            }
        } catch (NumberFormatException e) {
            // cai no erro abaixo
        }
        throw new RequisicaoInvalidaException("O parâmetro '" + nome + "' precisa ser um número a partir de 1");
    }

    /** Mangas da lista que dividem tags com este. */
    private void listarSemelhantes(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, respostas(mangaService.listarSemelhantes(lerId(ctx)), false));
    }

    /** Lista geral de tags, para escolher no cadastro em vez de digitar de novo. */
    private void listarTags(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, mangaService.listarTags());
    }

    /**
     * Todos os nomes pelos quais os mangas da lista sao conhecidos, para nao sugerir o que ja esta cadastrado:
     * o titulo, os outros nomes da obra e o nome que vem no link de leitura.
     */
    private List<String> nomesDosCadastrados() {
        // antes, descobre os outros nomes dos mangas da lista que ainda nao foram consultados
        // (alguns por vez), para nao sugerir uma obra que ja esta cadastrada com um titulo alternativo ou traduzido
        List<Manga> semNomes = mangaService.listarMangas(null, null).stream()
                .filter(cadastrado -> cadastrado.getAltTitles() == null)
                .limit(RecomendacaoService.TITULOS_POR_PEDIDO)
                .toList();
        if (!semNomes.isEmpty()) {
            Map<String, List<String>> nomes = recomendacaoService.nomesAlternativos(semNomes.stream().map(Manga::getTitle).toList());
            for (Manga cadastrado : semNomes) {
                if (nomes.containsKey(cadastrado.getTitle())) {
                    mangaService.definirNomesAlternativos(cadastrado.getId(), cadastrado.getTitle(), nomes.get(cadastrado.getTitle()));
                }
            }
        }
        List<String> cadastrados = new ArrayList<>();
        for (Manga cadastrado : mangaService.listarMangas(null, null)) {
            cadastrados.add(cadastrado.getTitle());
            if (cadastrado.getAltTitles() != null) {
                cadastrados.addAll(cadastrado.getAltTitles());
            }
            // o link de leitura costuma ter o nome da obra em ingles ou no original
            cadastrados.addAll(RecomendacaoService.nomesDoLink(cadastrado.getChapterLinkModel()));
            cadastrados.addAll(RecomendacaoService.nomesDoLink(cadastrado.getLastChapterUrl()));
        }
        return cadastrados;
    }

    private record OrdemResponse(String valor, String descricao) {
    }

    /**
     * Busca geral de obras para ler: por nome, pelas tags escolhidas e na ordem pedida.
     * ?busca=solo&tags=Fantasy,Isekai&sem=Harem&ordem=NOTA&pagina=1
     */
    private void explorarRecomendacoes(Context ctx) throws JsonProcessingException {
        String ordem = ctx.queryParam("ordem");
        RecomendacaoService.Ordem escolhida;
        try {
            escolhida = ordem == null || ordem.isBlank() ? RecomendacaoService.Ordem.POPULARIDADE : RecomendacaoService.Ordem.valueOf(ordem.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RequisicaoInvalidaException("Ordem inválida. Use uma de: " + Arrays.toString(RecomendacaoService.Ordem.values()));
        }
        String tags = ctx.queryParam("tags");
        List<String> escolhidas = tags == null || tags.isBlank() ? List.of() : Arrays.stream(tags.split(",")).map(String::trim).filter(tag -> !tag.isEmpty()).limit(10).toList();
        // ?sem=Harem,Horror: tags que a obra nao pode ter
        String sem = ctx.queryParam("sem");
        List<String> excluidas = sem == null || sem.isBlank() ? List.of() : Arrays.stream(sem.split(",")).map(String::trim).filter(tag -> !tag.isEmpty()).limit(20).toList();
        json(ctx, HttpStatus.OK, recomendacaoService.explorar(ctx.queryParam("busca"), escolhidas, excluidas, escolhida, lerInteiroPositivo(ctx, "pagina", 1), nomesDosCadastrados()));
    }

    private void listarOrdensDeRecomendacao(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, ordensDeRecomendacao());
    }

    private static List<OrdemResponse> ordensDeRecomendacao() {
        return Arrays.stream(RecomendacaoService.Ordem.values()).map(ordem -> new OrdemResponse(ordem.name(), ordem.getDescricao())).toList();
    }

    /** Mangas parecidos com este que ainda nao estao na lista, buscados na internet pelo titulo e pelas tags dele. */
    private void recomendar(Context ctx) throws JsonProcessingException {
        Manga manga = mangaService.buscarPorId(lerId(ctx));
        List<String> cadastrados = nomesDosCadastrados();
        List<String> tags = manga.getTags().stream().map(tag -> tag.getNome()).toList();
        json(ctx, HttpStatus.OK, recomendacaoService.buscar(manga.getTitle(), cadastrados, tags));
    }

    private void cadastrar(Context ctx) throws JsonProcessingException {
        DadosManga dados = lerCorpo(ctx, DadosManga.class);
        json(ctx, HttpStatus.CREATED, MangaResponse.de(mangaService.salvarManga(dados)));
    }

    /** O dia vem do navegador (?dia=QUARTA), porque "hoje" depende do fuso de quem esta usando. */
    private void listarLancamentos(Context ctx) throws JsonProcessingException {
        String dia = ctx.queryParam("dia");
        WeekDay diaDaSemana;
        try {
            diaDaSemana = WeekDay.valueOf(dia == null ? "" : dia.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RequisicaoInvalidaException("Dia inválido. Use um de: " + Arrays.toString(WeekDay.values()));
        }
        // ?desde=2026-10-08T03:00:00Z: a meia-noite de quem esta olhando. Quem ja leu capitulo hoje sai da lista
        String desde = ctx.queryParam("desde");
        Instant inicioDoDia = null;
        if (desde != null && !desde.isBlank()) {
            try {
                inicioDoDia = Instant.parse(desde.trim());
            } catch (DateTimeParseException e) {
                throw new RequisicaoInvalidaException("O parâmetro 'desde' precisa ser uma data e hora como 2026-10-08T03:00:00Z");
            }
        }
        json(ctx, HttpStatus.OK, respostas(mangaService.listarLancamentos(diaDaSemana, inicioDoDia), false));
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

    private void definirNota(Context ctx) throws JsonProcessingException {
        UUID id = lerId(ctx);
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.definirNota(id, lerCorpo(ctx, NotaRequest.class).rating())));
    }

    private void definirFavorito(Context ctx) throws JsonProcessingException {
        UUID id = lerId(ctx);
        Boolean favorite = lerCorpo(ctx, FavoritoRequest.class).favorite();
        if (favorite == null) {
            throw new RequisicaoInvalidaException("Informe 'favorite' como true ou false");
        }
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.definirFavorito(id, favorite)));
    }

    private void excluir(Context ctx) {
        mangaService.excluirManga(lerId(ctx));
        ctx.status(HttpStatus.NO_CONTENT);
    }

    private record LeituraRequest(BigDecimal lastChapter, String lastChapterUrl, String nextChapterUrl) {
    }

    /** Recebe do navegador o endereco exato do capitulo lido (e do proximo, se a pagina mostrava). */
    private void registrarLeitura(Context ctx) throws JsonProcessingException {
        UUID id = lerId(ctx);
        LeituraRequest leitura = lerCorpo(ctx, LeituraRequest.class);
        json(ctx, HttpStatus.OK, MangaResponse.de(mangaService.registrarLeitura(
                id, leitura.lastChapter(), leitura.lastChapterUrl(), leitura.nextChapterUrl())));
    }

    private record VerificacaoResponse(SituacaoDoLink situacao, boolean linkMudou, String linkAnterior, String mensagem, MangaResponse manga) {
    }

    private void verificarLink(Context ctx) throws JsonProcessingException {
        ResultadoVerificacao resultado = mangaService.verificarLink(lerId(ctx));
        json(ctx, HttpStatus.OK, new VerificacaoResponse(resultado.situacao(), resultado.linkMudou(),
                resultado.linkAnterior(), resultado.mensagem(), MangaResponse.de(resultado.manga())));
    }

    /**
     * Manda o navegador para o proximo capitulo ainda nao lido, no site salvo.
     * Antes confere o link no site, para ja abrir o endereco certo se ele tiver mudado.
     */
    private void ler(Context ctx) {
        UUID id = lerId(ctx);
        ResultadoVerificacao resultado = mangaService.verificarLink(id);
        switch (resultado.situacao()) {
            // o capitulo nao existe no site: em vez de abrir uma pagina de erro de la, volta para o manga com o aviso
            case NAO_ENCONTRADO -> ctx.redirect("/#/manga/" + id + "/sem-capitulo", HttpStatus.FOUND);
            case LINK_QUEBRADO -> ctx.redirect("/#/manga/" + id + "/link-quebrado", HttpStatus.FOUND);
            case DISPONIVEL -> ctx.redirect(resultado.manga().linkProximoCapitulo(), HttpStatus.FOUND);
            // o site nao deixou verificar: abre o melhor endereco conhecido
            case NAO_VERIFICADO -> ctx.redirect(melhorLinkSemVerificar(resultado.manga()), HttpStatus.FOUND);
        }
    }

    /**
     * Quando so se conhece o endereco exato do ultimo capitulo lido (sites com id proprio em cada capitulo),
     * montar o proximo pelo modelo daria um link errado. Melhor abrir o ultimo lido, que tem o botao de proximo do site.
     */
    private static String melhorLinkSemVerificar(Manga manga) {
        return manga.getNextChapterUrl() == null && manga.getLastChapterUrl() != null
                ? manga.getLastChapterUrl()
                : manga.linkProximoCapitulo();
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

    /** Corpo: a imagem pequena (WebP ou JPEG), feita pelo navegador a partir da capa. */
    private void guardarMiniatura(Context ctx) throws Exception {
        byte[] bytes;
        try (InputStream corpo = ctx.bodyInputStream()) {
            bytes = corpo.readNBytes(ImagemService.TAMANHO_MAXIMO_DA_MINIATURA + 1);
        }
        String nome = imagemService.salvarMiniatura(ctx.pathParam("nome"), bytes);
        json(ctx, HttpStatus.OK, Map.of("thumbUrl", "/api/imagens/" + nome));
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
        json(ctx, HttpStatus.OK, status());
    }

    private static List<Map<String, String>> status() {
        return Arrays.stream(ReadingStatus.values()).map(status -> Map.of("valor", status.name(), "descricao", status.getDescricao())).toList();
    }

    private void listarFormatosDecimais(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, formatos());
    }

    private static List<Map<String, String>> formatos() {
        return Arrays.stream(ChapterDecimalFormat.values()).map(formato -> Map.of("valor", formato.name(), "descricao", formato.getDescricao())).toList();
    }

    /** Descricao do manga buscada na internet pelo titulo, para preencher o cadastro. */
    private void buscarSinopse(Context ctx) throws JsonProcessingException {
        String titulo = ctx.queryParam("titulo");
        if (titulo == null || titulo.isBlank()) {
            throw new RequisicaoInvalidaException("Informe o título");
        }
        String busca = titulo.trim();
        SinopseService.Sinopse sinopse = sinopseService.buscar(busca.substring(0, Math.min(200, busca.length())))
                .orElseThrow(() -> new NotFoundException("Não encontrei uma descrição para esse título"));
        json(ctx, HttpStatus.OK, sinopse);
    }

    private void listarDiasDaSemana(Context ctx) throws JsonProcessingException {
        json(ctx, HttpStatus.OK, dias());
    }

    private static List<Map<String, String>> dias() {
        return Arrays.stream(WeekDay.values()).map(dia -> Map.of("valor", dia.name(), "descricao", dia.getDescricao())).toList();
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
