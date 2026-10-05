package br.com.seuapp.mangatracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
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
     * @param generos em portugues
     * @param link    pagina da obra no AniList
     */
    public record Recomendacao(String titulo, String capa, List<String> generos, String link) {
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

    private final SinopseService.ClienteHttp http;
    private final ObjectMapper mapper = new ObjectMapper();
    // as recomendacoes de uma obra mudam pouco: guardar evita consultar o AniList a cada visita a pagina do manga
    private final Map<String, Guardado> guardados = new ConcurrentHashMap<>();

    public RecomendacaoService(SinopseService.ClienteHttp http) {
        this.http = http;
    }

    /**
     * @param titulosCadastrados titulos de todos os mangas da lista, que ficam de fora das sugestoes
     * @return ate {@value #QUANTIDADE} sugestoes; lista vazia se a obra nao for encontrada ou o servico falhar
     */
    public List<Recomendacao> buscar(String titulo, Collection<String> titulosCadastrados) {
        if (titulo == null || titulo.isBlank()) {
            return List.of();
        }
        Set<String> cadastrados = new HashSet<>();
        titulosCadastrados.forEach(cadastrado -> cadastrados.add(normalizar(cadastrado)));
        cadastrados.add(normalizar(titulo));

        List<Recomendacao> sugestoes = new ArrayList<>();
        for (Candidata candidata : candidatas(titulo.trim())) {
            if (candidata.nomes().stream().noneMatch(cadastrados::contains)) {
                sugestoes.add(candidata.recomendacao());
                if (sugestoes.size() == QUANTIDADE) {
                    break;
                }
            }
        }
        return sugestoes;
    }

    private List<Candidata> candidatas(String titulo) {
        String chave = normalizar(titulo);
        Guardado guardado = guardados.get(chave);
        if (guardado != null && guardado.quando().plus(VALIDADE).isAfter(Instant.now())) {
            return guardado.candidatas();
        }
        List<Candidata> candidatas = consultar(titulo);
        if (!candidatas.isEmpty()) { // falha ou obra desconhecida nao fica guardada: da para tentar de novo depois
            if (guardados.size() >= MAXIMO_GUARDADO) {
                guardados.clear();
            }
            guardados.put(chave, new Guardado(Instant.now(), candidatas));
        }
        return candidatas;
    }

    private List<Candidata> consultar(String titulo) {
        JsonNode obra = perguntar("query($s:String){Media(search:$s,type:MANGA){id genres tags{name rank} "
                + "recommendations(sort:RATING_DESC,perPage:25){nodes{mediaRecommendation{" + CAMPOS + "}}}}}", Map.of("s", titulo))
                .path("Media");
        if (obra.isMissingNode() || obra.isNull()) {
            return List.of();
        }
        List<Candidata> candidatas = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        vistos.add(obra.path("id").asLong());
        // 1) o que os leitores recomendaram para quem leu esta obra
        for (JsonNode no : obra.path("recommendations").path("nodes")) {
            adicionar(no.path("mediaRecommendation"), candidatas, vistos);
        }
        // 2) poucas recomendacoes: completa com obras populares dos mesmos generos e dos temas mais marcantes
        if (candidatas.size() < QUANTIDADE * 2) {
            List<String> generos = new ArrayList<>();
            obra.path("genres").forEach(genero -> generos.add(genero.asText()));
            List<String> temas = new ArrayList<>();
            for (JsonNode tema : obra.path("tags")) {
                if (tema.path("rank").asInt() >= 60 && temas.size() < 3) {
                    temas.add(tema.path("name").asText());
                }
            }
            if (!generos.isEmpty()) {
                boolean comTemas = !temas.isEmpty();
                JsonNode parecidas = perguntar("query($g:[String]" + (comTemas ? ",$t:[String]" : "") + "){Page(perPage:30){media(type:MANGA,isAdult:false,"
                                + "genre_in:$g," + (comTemas ? "tag_in:$t," : "") + "sort:POPULARITY_DESC){" + CAMPOS + "}}}",
                        comTemas ? Map.of("g", generos, "t", temas) : Map.of("g", generos)).path("Page").path("media");
                // quem divide mais generos com a obra vem primeiro
                List<JsonNode> ordenadas = new ArrayList<>();
                parecidas.forEach(ordenadas::add);
                ordenadas.sort((a, b) -> Integer.compare(generosEmComum(b, generos), generosEmComum(a, generos)));
                ordenadas.forEach(parecida -> adicionar(parecida, candidatas, vistos));
            }
        }
        return List.copyOf(candidatas);
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
        obra.path("genres").forEach(genero -> generos.add(GENEROS.getOrDefault(genero.asText(), genero.asText())));
        String capa = obra.path("coverImage").path("large").asText("");
        candidatas.add(new Candidata(new Recomendacao(titulo, capa.startsWith("https://") ? capa : "", List.copyOf(generos), link), nomes));
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
