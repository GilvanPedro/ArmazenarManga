package br.com.seuapp.mangatracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sugere mangas com temas parecidos com o de um manga da lista, para ler depois.
 * A fonte e o AniList (servico publico e gratuito): primeiro as recomendacoes que os leitores de la fizeram
 * para a obra; se forem poucas, completa com obras populares dos mesmos generos e temas.
 * Quem ja esta cadastrado nunca e sugerido.
 */
public class RecomendacaoService {

    /**
     * @param generos em portugues, para mostrar
     * @param link    pagina da obra no AniList
     * @param tags    os mesmos generos em ingles, para virar tags se a obra for cadastrada
     */
    public record Recomendacao(String titulo, String capa, List<String> generos, String link, List<String> tags) {
    }

    /** Como ordenar a busca geral de obras ({@link #explorar}). */
    public enum Ordem {
        /** As que mais combinam com o nome buscado (sem nome buscado, vale a popularidade). */
        RELEVANCIA("SEARCH_MATCH", "Mais relevantes"),
        POPULARIDADE("POPULARITY_DESC", "Mais populares"),
        NOTA("SCORE_DESC", "Melhor avaliados"),
        EM_ALTA("TRENDING_DESC", "Em alta agora"),
        RECENTES("START_DATE_DESC", "Mais recentes"),
        TITULO("TITLE_ENGLISH", "Título (A–Z)");

        private final String noAniList;
        private final String descricao;

        Ordem(String noAniList, String descricao) {
            this.noAniList = noAniList;
            this.descricao = descricao;
        }

        public String getDescricao() {
            return descricao;
        }
    }

    /**
     * Uma obra achada na busca geral.
     *
     * @param generos em portugues, para mostrar
     * @param tags    os mesmos generos em ingles, para virar tags se a obra for cadastrada
     * @param nota    media das notas dos leitores, de 0 a 100; null se ainda nao tem
     * @param ano     ano em que comecou a ser publicada; null se desconhecido
     */
    public record ObraEncontrada(String titulo, String capa, List<String> generos, String link, List<String> tags, Integer nota, Integer ano) {
    }

    /**
     * Uma pagina da busca geral.
     *
     * @param temMais       ha mais resultados depois desta pagina
     * @param ocultos       quantas obras desta pagina foram escondidas por ja estarem na lista
     * @param tagsIgnoradas tags pedidas que o AniList nao tem (a busca foi feita sem elas)
     */
    public record Exploracao(List<ObraEncontrada> itens, int pagina, boolean temMais, int ocultos, List<String> tagsIgnoradas) {
    }

    /** Uma obra candidata, com todos os nomes pelos quais ela e conhecida (para comparar com a lista). */
    private record Candidata(long id, Recomendacao recomendacao, Set<String> nomes) {
    }

    private record Guardado(Instant quando, List<Candidata> candidatas) {
    }

    static final int QUANTIDADE = 6;
    private static final Duration VALIDADE = Duration.ofHours(12);
    private static final int MAXIMO_GUARDADO = 300;
    private static final String CAMPOS = "id type isAdult title{romaji english native} synonyms genres siteUrl coverImage{large}";
    private static final Map<String, String> GENEROS = Map.ofEntries(
            Map.entry("Action", "Ação"), Map.entry("Adventure", "Aventura"), Map.entry("Comedy", "Comédia"),
            Map.entry("Drama", "Drama"), Map.entry("Fantasy", "Fantasia"), Map.entry("Horror", "Terror"),
            Map.entry("Mystery", "Mistério"), Map.entry("Psychological", "Psicológico"), Map.entry("Romance", "Romance"),
            Map.entry("Sci-Fi", "Ficção científica"), Map.entry("Slice of Life", "Cotidiano"), Map.entry("Sports", "Esportes"),
            Map.entry("Supernatural", "Sobrenatural"), Map.entry("Thriller", "Suspense"), Map.entry("Music", "Música"),
            Map.entry("Mahou Shoujo", "Garota mágica"), Map.entry("Mecha", "Mecha"), Map.entry("Ecchi", "Ecchi"));

    /** Tags sugeridas no cadastro que o AniList chama por outro nome. */
    private static final Map<String, String> TEMAS_COM_OUTRO_NOME = Map.of(
            "murim", "Wuxia", "regression", "Time Manipulation", "school life", "School", "martial arts", "Martial Arts");

    /**
     * Tags gerais que no AniList sao divididas em varias: uma obra serve se tiver QUALQUER uma delas.
     * "Harem" la e "Female Harem" (varias garotas) ou "Male Harem" (varios rapazes).
     */
    private static final Map<String, List<String>> TEMAS_COM_VARIAS_FORMAS = Map.of("harem", List.of("Female Harem", "Male Harem"));
    private static final int MAXIMO_DE_COMBINACOES = 4;

    private final SinopseService.ClienteHttp http;
    private final ObjectMapper mapper = new ObjectMapper();
    // as recomendacoes de uma obra mudam pouco: guardar evita consultar o AniList a cada visita a pagina do manga
    private final Map<String, Guardado> guardados = new ConcurrentHashMap<>();
    /** Entre os nomes guardados de um manga, o que comeca assim diz qual e a obra no AniList: "anilist:105398". */
    public static final String MARCA_DA_OBRA = "anilist:";
    public static final int TITULOS_POR_PEDIDO = 20;
    public static final int POR_PAGINA = 24;
    private volatile Map<String, String> temasConhecidos = Map.of();
    private volatile Instant temasBuscadosEm = Instant.EPOCH;
    private static final int MAXIMO_NO_MANGADEX = 8;
    private static final int MAXIMO_DE_TRADUCOES = 6;
    private static final Set<String> PALAVRAS_DE_LIGACAO = Set.of("the", "a", "an", "of", "and", "to", "in", "o", "os", "as", "de", "do", "da",
            "dos", "das", "e", "um", "uma", "no", "na", "em", "el", "la", "los", "las", "le", "les", "du", "des", "s");
    private static final Set<String> PALAVRAS_DE_ENDERECO = Set.of("chapter", "chapters", "chap", "ch", "capitulo", "capitulos", "cap", "episode",
            "episodio", "ep", "manga", "mangas", "manhwa", "manhua", "comic", "comics", "title", "titles", "series", "serie", "obra", "obras",
            "read", "reader", "ler", "leitor", "online", "pt", "br", "en", "raw", "scan", "scans", "html", "php");
    private static final int MAXIMO_DE_NOMES = 60;

    public RecomendacaoService(SinopseService.ClienteHttp http) {
        this.http = http;
    }

    /**
     * Busca geral de obras no AniList: por nome, por tags (a obra precisa ter todas as escolhidas) e em varias ordens.
     * Quem ja esta na lista nao aparece.
     *
     * @param busca            parte do nome, ou null/vazio para nao filtrar por nome
     * @param tags             tags da lista (em ingles); as que o AniList nao tem sao ignoradas e devolvidas no resultado
     * @param nomesCadastrados titulos e outros nomes dos mangas da lista (como em {@link #buscar})
     * @return a pagina pedida; sem itens se o servico falhar
     */
    public Exploracao explorar(String busca, Collection<String> tags, Ordem ordem, int pagina, Collection<String> nomesCadastrados) {
        return explorar(busca, tags, List.of(), ordem, pagina, nomesCadastrados);
    }

    /**
     * @param tagsExcluidas tags que a obra NAO pode ter: quem tiver qualquer uma delas fica de fora da busca.
     *                      Uma tag que esteja nas duas listas vale como pedida (a exclusao dela e ignorada)
     */
    public Exploracao explorar(String busca, Collection<String> tags, Collection<String> tagsExcluidas, Ordem ordem, int pagina,
                               Collection<String> nomesCadastrados) {
        String nome = busca == null ? "" : busca.trim();
        int numero = Math.max(1, Math.min(pagina, 200));
        List<String> generos = new ArrayList<>();
        List<String> temas = new ArrayList<>();
        List<String> ignoradas = new ArrayList<>();
        List<List<String>> comVariasFormas = new ArrayList<>();
        Map<String, String> conhecidos = generosETemasDoAniList();
        for (String tag : tags == null ? List.<String>of() : tags) {
            if (tag == null || tag.isBlank()) {
                continue;
            }
            if (TEMAS_COM_VARIAS_FORMAS.containsKey(normalizar(tag))) {
                comVariasFormas.add(TEMAS_COM_VARIAS_FORMAS.get(normalizar(tag)));
                continue;
            }
            String procurada = TEMAS_COM_OUTRO_NOME.getOrDefault(normalizar(tag), tag.trim());
            String genero = GENEROS.keySet().stream().filter(conhecido -> normalizar(conhecido).equals(normalizar(procurada))).findFirst().orElse(null);
            if (genero != null) {
                generos.add(genero);
            } else if (conhecidos.containsKey(normalizar(procurada))) {
                temas.add(conhecidos.get(normalizar(procurada)));
            } else if (conhecidos.isEmpty()) {
                temas.add(procurada); // nao deu para conferir a lista de temas: tenta com o nome como esta
            } else {
                ignoradas.add(tag.trim());
            }
        }
        // "mais relevantes" so faz sentido com um nome buscado
        Ordem escolhida = ordem == null || (ordem == Ordem.RELEVANCIA && nome.isEmpty()) ? Ordem.POPULARIDADE : ordem;

        List<String> parametros = new ArrayList<>(List.of("$p:Int", "$o:[MediaSort]"));
        StringBuilder filtros = new StringBuilder();
        Map<String, Object> variaveis = new HashMap<>();
        variaveis.put("p", numero);
        variaveis.put("o", List.of(escolhida.noAniList));
        if (!nome.isEmpty()) {
            parametros.add("$s:String");
            filtros.append("search:$s,");
            variaveis.put("s", nome.substring(0, Math.min(100, nome.length())));
        }
        if (!generos.isEmpty()) {
            parametros.add("$g:[String]");
            filtros.append("genre_in:$g,");
            variaveis.put("g", generos);
        }
        // tags que a obra nao pode ter. Aqui uma tag com varias formas (Harem) tira as duas formas de uma vez
        Set<String> pedidas = new HashSet<>();
        (tags == null ? List.<String>of() : tags).forEach(tag -> pedidas.add(normalizar(tag)));
        List<String> generosFora = new ArrayList<>();
        List<String> temasFora = new ArrayList<>();
        for (String tag : tagsExcluidas == null ? List.<String>of() : tagsExcluidas) {
            if (tag == null || tag.isBlank() || pedidas.contains(normalizar(tag))) {
                continue;
            }
            if (TEMAS_COM_VARIAS_FORMAS.containsKey(normalizar(tag))) {
                temasFora.addAll(TEMAS_COM_VARIAS_FORMAS.get(normalizar(tag)));
                continue;
            }
            String procurada = TEMAS_COM_OUTRO_NOME.getOrDefault(normalizar(tag), tag.trim());
            String genero = GENEROS.keySet().stream().filter(conhecido -> normalizar(conhecido).equals(normalizar(procurada))).findFirst().orElse(null);
            if (genero != null) {
                generosFora.add(genero);
            } else if (conhecidos.containsKey(normalizar(procurada))) {
                temasFora.add(conhecidos.get(normalizar(procurada)));
            } else if (conhecidos.isEmpty()) {
                temasFora.add(procurada);
            } else {
                ignoradas.add(tag.trim()); // o AniList nao tem essa tag: nao ha o que tirar
            }
        }
        if (!generosFora.isEmpty()) {
            parametros.add("$gn:[String]");
            filtros.append("genre_not_in:$gn,");
            variaveis.put("gn", generosFora);
        }
        if (!temasFora.isEmpty()) {
            parametros.add("$tn:[String]");
            filtros.append("tag_not_in:$tn,");
            variaveis.put("tn", temasFora);
        }
        // o AniList so sabe pedir "todas estas tags". Para uma tag com varias formas (qualquer uma serve), faz uma busca
        // para cada forma e junta os resultados
        List<List<String>> buscas = combinar(temas, comVariasFormas);
        boolean variasBuscas = buscas.size() > 1;
        List<JsonNode> achadas = new ArrayList<>();
        Set<Long> jaVistas = new HashSet<>();
        boolean temMais = false;
        for (List<String> temasDaBusca : buscas) {
            List<String> parametrosDaBusca = new ArrayList<>(parametros);
            String filtrosDaBusca = filtros.toString();
            Map<String, Object> variaveisDaBusca = new HashMap<>(variaveis);
            if (!temasDaBusca.isEmpty()) {
                parametrosDaBusca.add("$t:[String]");
                filtrosDaBusca += "tag_in:$t,";
                variaveisDaBusca.put("t", temasDaBusca);
            }
            JsonNode resposta = perguntar("query(" + String.join(",", parametrosDaBusca) + "){Page(page:$p,perPage:" + POR_PAGINA + "){pageInfo{hasNextPage} "
                    + "media(type:MANGA,isAdult:false," + filtrosDaBusca + "sort:$o){" + CAMPOS
                    + " averageScore popularity trending startDate{year month day}}}}", variaveisDaBusca).path("Page");
            temMais |= resposta.path("pageInfo").path("hasNextPage").asBoolean(false);
            for (JsonNode obra : resposta.path("media")) {
                if (jaVistas.add(obra.path("id").asLong())) {
                    achadas.add(obra);
                }
            }
        }
        if (variasBuscas) {
            ordenarJuntas(achadas, escolhida);
        }

        Set<String> nomes = new HashSet<>();
        Set<Long> obras = new HashSet<>();
        separarNomesEObras(nomesCadastrados, nomes, obras);
        List<ObraEncontrada> itens = new ArrayList<>();
        int ocultos = 0;
        for (JsonNode obra : achadas) {
            List<Candidata> lida = new ArrayList<>();
            adicionar(obra, lida, new HashSet<>());
            if (lida.isEmpty()) {
                continue;
            }
            Candidata candidata = lida.get(0);
            if (obras.contains(candidata.id()) || candidata.nomes().stream().anyMatch(nomes::contains)) {
                ocultos++;
                continue;
            }
            Recomendacao dados = candidata.recomendacao();
            itens.add(new ObraEncontrada(dados.titulo(), dados.capa(), dados.generos(), dados.link(), dados.tags(),
                    obra.path("averageScore").isInt() ? obra.path("averageScore").asInt() : null,
                    obra.path("startDate").path("year").isInt() ? obra.path("startDate").path("year").asInt() : null));
        }
        return new Exploracao(List.copyOf(itens), numero, temMais, ocultos, List.copyOf(ignoradas));
    }

    /**
     * As listas de temas a buscar: os temas fixos mais uma forma de cada tag que tem varias.
     * Sem tags assim, e uma busca so. O total e limitado para nao fazer pedidos demais.
     */
    private static List<List<String>> combinar(List<String> temas, List<List<String>> comVariasFormas) {
        List<List<String>> buscas = new ArrayList<>();
        buscas.add(new ArrayList<>(temas));
        for (List<String> formasDaTag : comVariasFormas) {
            List<List<String>> ampliadas = new ArrayList<>();
            for (List<String> busca : buscas) {
                for (String forma : formasDaTag) {
                    if (ampliadas.size() < MAXIMO_DE_COMBINACOES) {
                        List<String> nova = new ArrayList<>(busca);
                        nova.add(forma);
                        ampliadas.add(nova);
                    }
                }
            }
            buscas = ampliadas;
        }
        return buscas;
    }

    /** Resultados de varias buscas juntos precisam ser ordenados de novo, pela mesma regra pedida ao AniList. */
    private static void ordenarJuntas(List<JsonNode> obras, Ordem ordem) {
        Comparator<JsonNode> regra = switch (ordem) {
            case NOTA -> Comparator.comparingInt((JsonNode obra) -> obra.path("averageScore").asInt(0)).reversed();
            case EM_ALTA -> Comparator.comparingInt((JsonNode obra) -> obra.path("trending").asInt(0)).reversed();
            case RECENTES -> Comparator.comparingInt((JsonNode obra) -> obra.path("startDate").path("year").asInt(0) * 10000
                    + obra.path("startDate").path("month").asInt(0) * 100 + obra.path("startDate").path("day").asInt(0)).reversed();
            case TITULO -> Comparator.comparing((JsonNode obra) -> normalizar(obra.path("title").path("english").asText(obra.path("title").path("romaji").asText(""))));
            // POPULARIDADE; e RELEVANCIA, que nao tem um numero para comparar: as mais conhecidas primeiro
            default -> Comparator.comparingInt((JsonNode obra) -> obra.path("popularity").asInt(0)).reversed();
        };
        obras.sort(regra);

    }

    /** Nomes dos temas (tags) que o AniList tem, pelo nome normalizado. Guardado por um dia; vazio se nao deu para buscar. */
    private Map<String, String> generosETemasDoAniList() {
        if (temasConhecidos.isEmpty() || temasBuscadosEm.plus(Duration.ofDays(1)).isBefore(Instant.now())) {
            Map<String, String> novos = new HashMap<>();
            perguntar("query{MediaTagCollection{name isAdult}}", Map.of()).path("MediaTagCollection").forEach(tema -> {
                if (!tema.path("isAdult").asBoolean()) {
                    novos.put(normalizar(tema.path("name").asText("")), tema.path("name").asText(""));
                }
            });
            novos.remove("");
            if (!novos.isEmpty()) {
                temasConhecidos = Map.copyOf(novos);
                temasBuscadosEm = Instant.now();
            }
        }
        return temasConhecidos;
    }

    /** Separa a lista de nomes dos cadastrados em nomes (em todas as formas) e marcas de obra ("anilist:123"). */
    private static void separarNomesEObras(Collection<String> nomesCadastrados, Set<String> nomes, Set<Long> obras) {
        for (String nome : nomesCadastrados == null ? List.<String>of() : nomesCadastrados) {
            if (nome == null) {
                continue;
            }
            if (nome.startsWith(MARCA_DA_OBRA)) {
                try {
                    obras.add(Long.parseLong(nome.substring(MARCA_DA_OBRA.length())));
                } catch (NumberFormatException e) {
                    // marca estragada: ignora
                }
                continue;
            }
            nomes.addAll(formas(nome));
            nomes.addAll(formas(semObservacoes(nome)));
        }
    }

    /**
     * @param nomesCadastrados titulos de todos os mangas da lista e os outros nomes guardados de cada um
     *                         (ver {@link #nomesAlternativos}); quem bater com algum deles fica de fora
     * @return ate {@value #QUANTIDADE} sugestoes; lista vazia se nada for encontrado ou o servico falhar
     */
    public List<Recomendacao> buscar(String titulo, Collection<String> nomesCadastrados) {
        return buscar(titulo, nomesCadastrados, List.of());
    }

    /**
     * Procura pelo titulo e tambem pelas tags do manga: o titulo acha a obra e o que os leitores recomendam para
     * ela; as tags trazem obras dos mesmos generos e temas, inclusive quando o AniList nao conhece o titulo.
     *
     * @param tagsDoManga tags do manga na lista (em ingles, como os generos e temas do AniList)
     */
    public List<Recomendacao> buscar(String titulo, Collection<String> nomesCadastrados, Collection<String> tagsDoManga) {
        if (titulo == null || titulo.isBlank()) {
            return List.of();
        }
        // quem ja esta na lista sai pelo nome (em qualquer um dos nomes conhecidos da obra, escrito de varios jeitos)
        // ou por ser exatamente a mesma obra no AniList
        Set<String> nomes = new HashSet<>();
        Set<Long> obras = new HashSet<>();
        List<String> todos = new ArrayList<>(nomesCadastrados);
        todos.add(titulo);
        separarNomesEObras(todos, nomes, obras);

        List<Recomendacao> sugestoes = new ArrayList<>();
        for (Candidata candidata : candidatas(titulo.trim(), tagsDoManga == null ? List.of() : tagsDoManga)) {
            if (!obras.contains(candidata.id()) && candidata.nomes().stream().noneMatch(nomes::contains)) {
                sugestoes.add(candidata.recomendacao());
                if (sugestoes.size() == QUANTIDADE) {
                    break;
                }
            }
        }
        return sugestoes;
    }

    /**
     * Um mesmo nome escrito dos jeitos que costumam variar entre sites: com e sem espacos ("Re Zero", "ReZero")
     * e com e sem o artigo do comeco ("The Beginning...", "Beginning..."; "O Começo...", "Começo...").
     */
    static Set<String> formas(String nome) {
        Set<String> formas = new HashSet<>();
        String normal = normalizar(nome);
        if (normal.isEmpty()) {
            return formas;
        }
        formas.add(normal);
        formas.add(normal.replace(" ", ""));
        String semArtigo = normal.replaceFirst("^(the|a|an|o|os|as|um|uma|el|la|los|las|le|les) ", "");
        if (semArtigo.length() >= 4) {
            formas.add(semArtigo);
            formas.add(semArtigo.replace(" ", ""));
        }
        // as mesmas palavras em qualquer ordem e sem as de ligacao: "Ponto de Vista do Leitor" e "Ponto de Vista de um Leitor"
        List<String> palavras = new ArrayList<>();
        for (String palavra : normal.split(" ")) {
            if (!PALAVRAS_DE_LIGACAO.contains(palavra) && !palavras.contains(palavra)) {
                palavras.add(palavra);
            }
        }
        if (palavras.size() >= 2) {
            palavras.sort(null);
            formas.add("#" + String.join("|", palavras));
        }
        return formas;
    }

    /**
     * Nomes que da para tirar do link de leitura: muitos sites colocam o nome da obra (em ingles ou no original)
     * no endereco, mesmo quando o manga foi cadastrado com o titulo traduzido.
     * ".../comics/omniscient-readers-viewpoint-3ec3b16f/chapter/{cap}" -> "omniscient readers viewpoint".
     */
    public static List<String> nomesDoLink(String link) {
        List<String> nomes = new ArrayList<>();
        if (link == null) {
            return nomes;
        }
        int inicio = link.indexOf('/', link.indexOf("://") + 3);
        String caminho = inicio < 0 ? "" : link.substring(inicio).split("[?#]")[0];
        for (String trecho : caminho.split("/")) {
            List<String> palavras = new ArrayList<>();
            for (String pedaco : trecho.replace("{cap}", " ").toLowerCase(Locale.ROOT).split("[-_ .+]+|%20")) {
                // ids misturam letras e numeros; palavras de pasta e de capitulo nao fazem parte do nome
                boolean temLetra = pedaco.chars().anyMatch(Character::isLetter);
                boolean temDigito = pedaco.chars().anyMatch(Character::isDigit);
                if (temLetra && !temDigito && !PALAVRAS_DE_ENDERECO.contains(pedaco)) {
                    palavras.add(pedaco);
                }
            }
            if (palavras.size() >= 2) {
                nomes.add(String.join(" ", palavras));
            }
        }
        return nomes;
    }

    /**
     * Busca na internet os outros nomes de cada titulo da lista: o original, em outras linguas e apelidos.
     * E o que permite reconhecer um manga cadastrado com um titulo alternativo ou traduzido.
     * Primeiro o AniList, com varios titulos no mesmo pedido; para os que ele nao conhece, o MangaDex, que tem
     * os nomes em muitas linguas; e, se nem ele conhecer, o titulo e traduzido do portugues para o ingles e
     * procurado de novo no AniList (e assim que "Ponto de Vista do Leitor Onisciente" vira "Omniscient Reader").
     *
     * @return para cada titulo resolvido, os nomes encontrados (lista vazia = nenhuma fonte conhece a obra).
     *         Titulos que nao deu para consultar agora ficam de fora do mapa, para tentar de novo depois.
     */
    public Map<String, List<String>> nomesAlternativos(List<String> titulos) {
        List<String> lote = titulos.stream().filter(titulo -> titulo != null && !titulo.isBlank()).distinct().limit(TITULOS_POR_PEDIDO).toList();
        Map<String, List<String>> resultado = new LinkedHashMap<>();
        if (lote.isEmpty()) {
            return resultado;
        }
        JsonNode resposta = consultarEmLote(lote.stream().map(RecomendacaoService::semObservacoes).toList(), 1);
        if (resposta == null) {
            return resultado; // servico fora do ar ou no limite: nada resolvido desta vez
        }
        List<String> semObra = new ArrayList<>();
        for (int i = 0; i < lote.size(); i++) {
            List<String> nomes = nomesDasObras(resposta.path("m" + i).path("media"));
            if (nomes.isEmpty()) {
                semObra.add(lote.get(i));
            } else {
                resultado.put(lote.get(i), nomes);
            }
        }
        // o AniList nao conhece por esse nome: MangaDex
        List<String> paraTraduzir = new ArrayList<>();
        for (String titulo : semObra.stream().limit(MAXIMO_NO_MANGADEX).toList()) {
            List<String> nomes = nomesNoMangaDex(titulo);
            if (nomes != null && !nomes.isEmpty()) {
                resultado.put(titulo, nomes);
            } else if (nomes != null) {
                paraTraduzir.add(titulo);
            }
        }
        // nenhum dos dois conhece: traduz o titulo para o ingles e procura de novo
        List<String> traduzidos = new ArrayList<>();
        List<String> originais = new ArrayList<>();
        for (String titulo : paraTraduzir.stream().limit(MAXIMO_DE_TRADUCOES).toList()) {
            String traducao = traduzir(semObservacoes(titulo));
            if (traducao == null) {
                continue; // tradutor fora do ar: tenta de novo depois
            }
            if (formas(traducao).stream().anyMatch(formas(semObservacoes(titulo))::contains)) {
                resultado.put(titulo, List.of()); // ja estava em ingles (ou nao tem traducao): nao ha mais o que tentar
            } else {
                originais.add(titulo);
                traduzidos.add(traducao);
            }
        }
        if (!traduzidos.isEmpty()) {
            JsonNode peloIngles = consultarEmLote(traduzidos, 2);
            for (int i = 0; peloIngles != null && i < originais.size(); i++) {
                List<String> nomes = new ArrayList<>(nomesDasObras(peloIngles.path("m" + i).path("media")));
                if (!nomes.isEmpty()) {
                    acrescentar(nomes, traduzidos.get(i));
                }
                resultado.put(originais.get(i), List.copyOf(nomes));
            }
        }
        return resultado;
    }

    /** Pergunta ao AniList por varios titulos no mesmo pedido (m0, m1...). null se o servico nao respondeu. */
    private JsonNode consultarEmLote(List<String> buscas, int obrasPorTitulo) {
        StringBuilder parametros = new StringBuilder();
        StringBuilder perguntas = new StringBuilder();
        Map<String, Object> variaveis = new HashMap<>();
        for (int i = 0; i < buscas.size(); i++) {
            parametros.append(i == 0 ? "" : ",").append("$t").append(i).append(":String");
            perguntas.append("m").append(i).append(":Page(perPage:").append(obrasPorTitulo).append("){media(search:$t").append(i)
                    .append(",type:MANGA){id title{romaji english native} synonyms}} ");
            variaveis.put("t" + i, buscas.get(i));
        }
        JsonNode resposta = perguntar("query(" + parametros + "){" + perguntas + "}", variaveis);
        return resposta.isMissingNode() || !resposta.has("m0") ? null : resposta;
    }

    /** A marca de cada obra ("anilist:123") seguida de todos os nomes delas; lista vazia se nao veio obra nenhuma. */
    private static List<String> nomesDasObras(JsonNode obras) {
        List<String> nomes = new ArrayList<>();
        for (JsonNode obra : obras) {
            nomes.add(MARCA_DA_OBRA + obra.path("id").asLong());
        }
        for (JsonNode obra : obras) {
            obra.path("title").forEach(nome -> acrescentar(nomes, nome.asText("")));
            obra.path("synonyms").forEach(nome -> acrescentar(nomes, nome.asText("")));
        }
        return List.copyOf(nomes);
    }

    /** Traduz um titulo do portugues para o ingles. null se o tradutor falhou. */
    private String traduzir(String titulo) {
        String corpo = http.get("https://api.mymemory.translated.net/get?langpair=pt-br%7Cen&q=" + URLEncoder.encode(titulo, StandardCharsets.UTF_8));
        try {
            JsonNode resposta = corpo == null ? mapper.missingNode() : mapper.readTree(corpo);
            String traducao = resposta.path("responseData").path("translatedText").asText("").trim();
            boolean valeu = resposta.path("responseStatus").asInt(0) == 200 && !traducao.isEmpty()
                    && !traducao.toUpperCase(Locale.ROOT).contains("MYMEMORY WARNING");
            return valeu ? traducao : null;
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Todos os nomes da obra no MangaDex; lista vazia se ele nao tem obra com exatamente esse nome; null se falhou. */
    private List<String> nomesNoMangaDex(String titulo) {
        String corpo = http.get("https://api.mangadex.org/manga?limit=5&order%5Brelevance%5D=desc"
                + "&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&title="
                + URLEncoder.encode(semObservacoes(titulo), StandardCharsets.UTF_8));
        JsonNode lista;
        try {
            lista = corpo == null ? null : mapper.readTree(corpo).path("data");
        } catch (JsonProcessingException e) {
            lista = null;
        }
        if (lista == null || !lista.isArray()) {
            return null;
        }
        Set<String> procurado = formas(semObservacoes(titulo));
        for (JsonNode manga : lista) {
            List<String> nomes = new ArrayList<>();
            manga.path("attributes").path("title").forEach(nome -> acrescentar(nomes, nome.asText("")));
            manga.path("attributes").path("altTitles").forEach(alternativo -> alternativo.forEach(nome -> acrescentar(nomes, nome.asText(""))));
            // a busca de la e aproximada: so vale a obra que tem exatamente o nome procurado entre os dela
            if (nomes.stream().anyMatch(nome -> formas(nome).stream().anyMatch(procurado::contains))) {
                return List.copyOf(nomes);
            }
        }
        return List.of();
    }

    private static void acrescentar(List<String> nomes, String nome) {
        String limpo = nome == null ? "" : nome.trim();
        if (!limpo.isEmpty() && limpo.length() <= 200 && nomes.size() < MAXIMO_DE_NOMES && !nomes.contains(limpo)) {
            nomes.add(limpo);
        }
    }

    /** O titulo sem o que esta entre (parenteses) e [colchetes], que costuma ser observacao de quem cadastrou. */
    private static String semObservacoes(String titulo) {
        return titulo == null ? "" : titulo.replaceAll("[\\(\\[][^)\\]]*[)\\]]", " ").replaceAll("\\s+", " ").trim();
    }

    private List<Candidata> candidatas(String titulo, Collection<String> tagsDoManga) {
        // as tags fazem parte da chave: mudar as tags do manga muda o que e sugerido
        List<String> tagsOrdenadas = tagsDoManga.stream().map(RecomendacaoService::normalizar).filter(tag -> !tag.isEmpty()).sorted().toList();
        String chave = normalizar(titulo) + "|" + String.join(",", tagsOrdenadas);
        Guardado guardado = guardados.get(chave);
        if (guardado != null && guardado.quando().plus(VALIDADE).isAfter(Instant.now())) {
            return guardado.candidatas();
        }
        List<Candidata> candidatas = consultar(titulo, tagsDoManga);
        if (!candidatas.isEmpty()) { // falha ou obra desconhecida nao fica guardada: da para tentar de novo depois
            if (guardados.size() >= MAXIMO_GUARDADO) {
                guardados.clear();
            }
            guardados.put(chave, new Guardado(Instant.now(), candidatas));
        }
        return candidatas;
    }

    /** O titulo como esta e versoes mais curtas dele, para quando o cadastro tem subtitulo ou observacao a mais. */
    static List<String> variacoesDoTitulo(String titulo) {
        Set<String> variacoes = new LinkedHashSet<>();
        variacoes.add(titulo.trim());
        variacoes.add(titulo.replaceAll("[\\(\\[][^)\\]]*[)\\]]", " ").replaceAll("\\s+", " ").trim()); // sem (parenteses) e [colchetes]
        for (String separador : List.of(":", " - ", " – ")) {
            int posicao = titulo.indexOf(separador);
            if (posicao > 2) {
                variacoes.add(titulo.substring(0, posicao).trim());
            }
        }
        variacoes.removeIf(String::isBlank);
        return variacoes.stream().limit(3).toList();
    }

    private List<Candidata> consultar(String titulo, Collection<String> tagsDoManga) {
        List<Candidata> candidatas = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();

        // 1) pelo titulo: acha a obra no AniList
        JsonNode obra = mapper.missingNode();
        for (String variacao : variacoesDoTitulo(titulo)) {
            obra = perguntar("query($s:String){Media(search:$s,type:MANGA){id genres tags{name rank} "
                    + "recommendations(sort:RATING_DESC,perPage:25){nodes{mediaRecommendation{" + CAMPOS + "}}}}}", Map.of("s", variacao))
                    .path("Media");
            if (!obra.isMissingNode() && !obra.isNull()) {
                break;
            }
        }
        if (!obra.isMissingNode() && !obra.isNull()) {
            vistos.add(obra.path("id").asLong());
            // o que os leitores recomendaram para quem leu esta obra
            for (JsonNode no : obra.path("recommendations").path("nodes")) {
                adicionar(no.path("mediaRecommendation"), candidatas, vistos);
            }
            // poucas recomendacoes: completa com obras populares dos mesmos generos e dos temas mais marcantes dela
            if (candidatas.size() < QUANTIDADE * 2) {
                List<String> generos = new ArrayList<>();
                obra.path("genres").forEach(genero -> generos.add(genero.asText()));
                List<String> temas = new ArrayList<>();
                for (JsonNode tema : obra.path("tags")) {
                    if (tema.path("rank").asInt() >= 60 && temas.size() < 3) {
                        temas.add(tema.path("name").asText());
                    }
                }
                porGenerosETemas(generos, temas).forEach(parecida -> adicionar(parecida, candidatas, vistos));
            }
        }

        // 2) pelas tags do manga na lista: completa o que veio do titulo, ou substitui quando o titulo nao foi encontrado
        if (candidatas.size() < QUANTIDADE * 2 && !tagsDoManga.isEmpty()) {
            List<String> generos = new ArrayList<>();
            List<String> temas = new ArrayList<>();
            List<List<String>> comVariasFormas = new ArrayList<>();
            for (String tag : tagsDoManga) {
                String genero = GENEROS.keySet().stream().filter(conhecido -> normalizar(conhecido).equals(normalizar(tag))).findFirst().orElse(null);
                if (genero != null) {
                    generos.add(genero);
                } else if (tag != null && TEMAS_COM_VARIAS_FORMAS.containsKey(normalizar(tag))) {
                    comVariasFormas.add(TEMAS_COM_VARIAS_FORMAS.get(normalizar(tag)));
                } else if (tag != null && !tag.isBlank() && temas.size() < 4) {
                    temas.add(TEMAS_COM_OUTRO_NOME.getOrDefault(normalizar(tag), tag.trim()));
                }
            }
            List<JsonNode> parecidas = new ArrayList<>();
            for (List<String> temasDaBusca : combinar(temas, comVariasFormas)) {
                parecidas.addAll(porGenerosETemas(generos, temasDaBusca));
            }
            // varias buscas juntas: de novo quem divide mais generos primeiro
            parecidas.sort((a, b) -> Integer.compare(generosEmComum(b, generos), generosEmComum(a, generos)));
            if (parecidas.isEmpty() && !generos.isEmpty() && (!temas.isEmpty() || !comVariasFormas.isEmpty())) {
                // nenhuma obra com esses generos E esses temas (ou o AniList nao tem tema com esse nome): tenta so os generos
                parecidas = porGenerosETemas(generos, List.of());
            }
            parecidas.forEach(parecida -> adicionar(parecida, candidatas, vistos));
        }
        return List.copyOf(candidatas);
    }

    /** Obras populares com algum dos generos e, se informados, algum dos temas; quem divide mais generos vem primeiro. */
    private List<JsonNode> porGenerosETemas(List<String> generos, List<String> temas) {
        if (generos.isEmpty() && temas.isEmpty()) {
            return List.of();
        }
        List<String> parametros = new ArrayList<>();
        List<String> filtros = new ArrayList<>();
        Map<String, Object> variaveis = new HashMap<>();
        if (!generos.isEmpty()) {
            parametros.add("$g:[String]");
            filtros.add("genre_in:$g,");
            variaveis.put("g", generos);
        }
        if (!temas.isEmpty()) {
            parametros.add("$t:[String]");
            filtros.add("tag_in:$t,");
            variaveis.put("t", temas);
        }
        JsonNode parecidas = perguntar("query(" + String.join(",", parametros) + "){Page(perPage:30){media(type:MANGA,isAdult:false,"
                + String.join("", filtros) + "sort:POPULARITY_DESC){" + CAMPOS + "}}}", variaveis).path("Page").path("media");
        List<JsonNode> ordenadas = new ArrayList<>();
        parecidas.forEach(ordenadas::add);
        ordenadas.sort((a, b) -> Integer.compare(generosEmComum(b, generos), generosEmComum(a, generos)));
        return ordenadas;
    }

    private static int generosEmComum(JsonNode obra, List<String> generos) {
        int emComum = 0;
        for (JsonNode genero : obra.path("genres")) {
            if (generos.contains(genero.asText())) {
                emComum++;
            }
        }
        return emComum;
    }

    private static void adicionar(JsonNode obra, List<Candidata> candidatas, Set<Long> vistos) {
        if (obra.isMissingNode() || obra.isNull() || !"MANGA".equals(obra.path("type").asText()) || obra.path("isAdult").asBoolean()) {
            return;
        }
        String ingles = obra.path("title").path("english").asText("");
        String romaji = obra.path("title").path("romaji").asText("");
        String titulo = !ingles.isBlank() ? ingles : romaji;
        String link = obra.path("siteUrl").asText("");
        if (titulo.isBlank() || !link.startsWith("https://") || !vistos.add(obra.path("id").asLong())) {
            return;
        }
        Set<String> nomes = new HashSet<>();
        obra.path("title").forEach(nome -> nomes.addAll(formas(nome.asText(""))));
        obra.path("synonyms").forEach(sinonimo -> nomes.addAll(formas(sinonimo.asText(""))));
        List<String> generos = new ArrayList<>();
        List<String> tags = new ArrayList<>();
        obra.path("genres").forEach(genero -> {
            generos.add(GENEROS.getOrDefault(genero.asText(), genero.asText()));
            tags.add(genero.asText());
        });
        String capa = obra.path("coverImage").path("large").asText("");
        candidatas.add(new Candidata(obra.path("id").asLong(), new Recomendacao(titulo, capa.startsWith("https://") ? capa : "", List.copyOf(generos), link, List.copyOf(tags)), nomes));
    }

    /** Faz a pergunta ao AniList e devolve o "data" da resposta (vazio se falhar). */
    private JsonNode perguntar(String consulta, Map<String, Object> variaveis) {
        try {
            String resposta = http.postJson("https://graphql.anilist.co", mapper.writeValueAsString(Map.of("query", consulta, "variables", variaveis)));
            return resposta == null ? mapper.missingNode() : mapper.readTree(resposta).path("data");
        } catch (JsonProcessingException e) {
            return mapper.missingNode();
        }
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto == null ? "" : texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim(); // letras de qualquer alfabeto
    }
}
