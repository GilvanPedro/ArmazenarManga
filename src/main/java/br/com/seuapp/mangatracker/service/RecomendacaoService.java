package br.com.seuapp.mangatracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
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

    /** Uma obra candidata, com todos os nomes pelos quais ela e conhecida (para comparar com a lista). */
    private record Candidata(Recomendacao recomendacao, Set<String> nomes) {
    }

    private record Guardado(Instant quando, List<Candidata> candidatas) {
    }

    static final int QUANTIDADE = 6;
    private static final Duration VALIDADE = Duration.ofHours(12);
    private static final int MAXIMO_GUARDADO = 300;
    private static final String CAMPOS = "id type isAdult title{romaji english} synonyms genres siteUrl coverImage{large}";
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

    private final SinopseService.ClienteHttp http;
    private final ObjectMapper mapper = new ObjectMapper();
    // as recomendacoes de uma obra mudam pouco: guardar evita consultar o AniList a cada visita a pagina do manga
    private final Map<String, Guardado> guardados = new ConcurrentHashMap<>();

    public RecomendacaoService(SinopseService.ClienteHttp http) {
        this.http = http;
    }

    /**
     * @param titulosCadastrados titulos de todos os mangas da lista, que ficam de fora das sugestoes
     * @return ate {@value #QUANTIDADE} sugestoes; lista vazia se nada for encontrado ou o servico falhar
     */
    public List<Recomendacao> buscar(String titulo, Collection<String> titulosCadastrados) {
        return buscar(titulo, titulosCadastrados, List.of());
    }

    /**
     * Procura pelo titulo e tambem pelas tags do manga: o titulo acha a obra e o que os leitores recomendam para
     * ela; as tags trazem obras dos mesmos generos e temas, inclusive quando o AniList nao conhece o titulo.
     *
     * @param tagsDoManga tags do manga na lista (em ingles, como os generos e temas do AniList)
     */
    public List<Recomendacao> buscar(String titulo, Collection<String> titulosCadastrados, Collection<String> tagsDoManga) {
        if (titulo == null || titulo.isBlank()) {
            return List.of();
        }
        Set<String> cadastrados = new HashSet<>();
        titulosCadastrados.forEach(cadastrado -> cadastrados.add(normalizar(cadastrado)));
        cadastrados.add(normalizar(titulo));

        List<Recomendacao> sugestoes = new ArrayList<>();
        for (Candidata candidata : candidatas(titulo.trim(), tagsDoManga == null ? List.of() : tagsDoManga)) {
            if (candidata.nomes().stream().noneMatch(cadastrados::contains)) {
                sugestoes.add(candidata.recomendacao());
                if (sugestoes.size() == QUANTIDADE) {
                    break;
                }
            }
        }
        return sugestoes;
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
            for (String tag : tagsDoManga) {
                String genero = GENEROS.keySet().stream().filter(conhecido -> normalizar(conhecido).equals(normalizar(tag))).findFirst().orElse(null);
                if (genero != null) {
                    generos.add(genero);
                } else if (tag != null && !tag.isBlank() && temas.size() < 4) {
                    temas.add(TEMAS_COM_OUTRO_NOME.getOrDefault(normalizar(tag), tag.trim()));
                }
            }
            List<JsonNode> parecidas = porGenerosETemas(generos, temas);
            if (parecidas.isEmpty() && !generos.isEmpty() && !temas.isEmpty()) {
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
        nomes.add(normalizar(ingles));
        nomes.add(normalizar(romaji));
        obra.path("synonyms").forEach(sinonimo -> nomes.add(normalizar(sinonimo.asText())));
        nomes.remove("");
        List<String> generos = new ArrayList<>();
        List<String> tags = new ArrayList<>();
        obra.path("genres").forEach(genero -> {
            generos.add(GENEROS.getOrDefault(genero.asText(), genero.asText()));
            tags.add(genero.asText());
        });
        String capa = obra.path("coverImage").path("large").asText("");
        candidatas.add(new Candidata(new Recomendacao(titulo, capa.startsWith("https://") ? capa : "", List.copyOf(generos), link, List.copyOf(tags)), nomes));
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
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}
