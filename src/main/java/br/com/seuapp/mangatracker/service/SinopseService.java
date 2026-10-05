package br.com.seuapp.mangatracker.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Busca na internet a descricao de um manga pelo titulo, em portugues, para preencher o cadastro.
 * Fontes, nesta ordem: MangaDex (tem descricoes em portugues escritas por pessoas), depois AniList
 * (so em ingles, mas conhece mais obras). Quando so existe em ingles, o texto e traduzido pelo MyMemory.
 * Sao tres servicos publicos e gratuitos; se algum falhar, o resultado e so "nao encontrei".
 */
public class SinopseService {

    /** Chamadas a outros sites. Devolvem null quando nao da certo. */
    public interface ClienteHttp {
        String get(String endereco);

        String postJson(String endereco, String corpo);
    }

    /**
     * @param idioma           "pt" ou, se a traducao falhou, "en"
     * @param tituloEncontrado nome da obra na fonte, para conferir se e a mesma
     * @param traduzida        true quando o texto veio em ingles e foi traduzido automaticamente
     */
    public record Sinopse(String descricao, String idioma, String fonte, String tituloEncontrado, boolean traduzida) {
    }

    static final int TAMANHO_MAXIMO = 1500;
    private static final int MAXIMO_POR_TRADUCAO = 450; // o MyMemory aceita ate 500 bytes por pedido
    private static final int MAXIMO_DE_TRADUCOES = 8;

    private final ClienteHttp http;
    private final ObjectMapper mapper = new ObjectMapper();

    public SinopseService(ClienteHttp http) {
        this.http = http;
    }

    public Optional<Sinopse> buscar(String titulo) {
        if (titulo == null || titulo.isBlank()) {
            return Optional.empty();
        }
        String busca = titulo.trim();

        JsonNode mangadex = buscarNoMangaDex(busca);
        // quando o titulo bate exatamente, o nome a mostrar e o pesquisado (o principal de la pode estar em outra lingua)
        String nomeNoMangaDex = mangadex == null ? null : temOTitulo(mangadex, busca) ? busca : nomeNoMangaDex(mangadex);
        if (mangadex != null) {
            for (String idioma : List.of("pt-br", "pt")) {
                String emPortugues = limpar(mangadex.path("description").path(idioma).asText(""));
                if (!emPortugues.isBlank()) {
                    return Optional.of(new Sinopse(emPortugues, "pt", "MangaDex", nomeNoMangaDex, false));
                }
            }
        }

        // so em ingles: AniList primeiro (conhece mais obras), depois o ingles do MangaDex
        String emIngles = "";
        String fonte = null;
        String nome = null;
        JsonNode anilist = buscarNoAniList(busca);
        if (anilist != null) {
            emIngles = limpar(anilist.path("description").asText(""));
            fonte = "AniList";
            nome = anilist.path("title").path("english").asText(anilist.path("title").path("romaji").asText(busca));
        }
        if (emIngles.isBlank() && mangadex != null) {
            emIngles = limpar(mangadex.path("description").path("en").asText(""));
            fonte = "MangaDex";
            nome = nomeNoMangaDex;
        }
        if (emIngles.isBlank()) {
            return Optional.empty();
        }
        String traduzida = traduzir(emIngles);
        return Optional.of(traduzida != null
                ? new Sinopse(traduzida, "pt", fonte, nome, true)
                : new Sinopse(emIngles, "en", fonte, nome, false));
    }

    // ------------------------------------------------------------------ fontes

    private JsonNode buscarNoMangaDex(String titulo) {
        JsonNode resposta = ler(http.get("https://api.mangadex.org/manga?limit=5&order%5Brelevance%5D=desc"
                + "&contentRating%5B%5D=safe&contentRating%5B%5D=suggestive&contentRating%5B%5D=erotica&title=" + codificar(titulo)));
        JsonNode primeiro = null;
        for (JsonNode manga : resposta.path("data")) {
            JsonNode atributos = manga.path("attributes");
            if (primeiro == null) {
                primeiro = atributos;
            }
            // a busca de la e aproximada: se algum resultado tem exatamente este titulo, e ele
            if (temOTitulo(atributos, titulo)) {
                return atributos;
            }
        }
        return primeiro;
    }

    private static boolean temOTitulo(JsonNode atributos, String titulo) {
        List<String> nomes = new ArrayList<>();
        atributos.path("title").forEach(nome -> nomes.add(nome.asText()));
        atributos.path("altTitles").forEach(alternativo -> alternativo.forEach(nome -> nomes.add(nome.asText())));
        return nomes.stream().anyMatch(nome -> normalizar(nome).equals(normalizar(titulo)));
    }

    private static String nomeNoMangaDex(JsonNode atributos) {
        JsonNode titulos = atributos.path("title");
        if (titulos.has("en")) {
            return titulos.get("en").asText();
        }
        return titulos.elements().hasNext() ? titulos.elements().next().asText() : "";
    }

    private JsonNode buscarNoAniList(String titulo) {
        String consulta = "query($s:String){Page(perPage:1){media(search:$s,type:MANGA){title{romaji english} description(asHtml:false)}}}";
        try {
            String corpo = mapper.writeValueAsString(Map.of("query", consulta, "variables", Map.of("s", titulo)));
            JsonNode achados = ler(http.postJson("https://graphql.anilist.co", corpo)).path("data").path("Page").path("media");
            return achados.isArray() && !achados.isEmpty() ? achados.get(0) : null;
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Traduz do ingles para o portugues, aos pedacos. Devolve null se qualquer pedaco falhar. */
    private String traduzir(String texto) {
        StringBuilder traducao = new StringBuilder();
        int pedidos = 0;
        for (String paragrafo : texto.split("\n", -1)) {
            if (traducao.length() > 0) {
                traducao.append('\n');
            }
            if (paragrafo.isBlank()) {
                continue;
            }
            List<String> pedacos = emPedacos(paragrafo.trim());
            for (int i = 0; i < pedacos.size(); i++) {
                if (++pedidos > MAXIMO_DE_TRADUCOES) {
                    return null;
                }
                JsonNode resposta = ler(http.get("https://api.mymemory.translated.net/get?langpair=en%7Cpt-br&q=" + codificar(pedacos.get(i))));
                String traduzido = resposta.path("responseData").path("translatedText").asText("");
                // quando a cota gratuita acaba, o servico responde com um aviso no lugar da traducao
                if (resposta.path("responseStatus").asInt(0) != 200 || traduzido.isBlank() || traduzido.toUpperCase(Locale.ROOT).contains("MYMEMORY WARNING")) {
                    return null;
                }
                traducao.append(i == 0 ? "" : " ").append(traduzido.trim());
            }
        }
        return traducao.toString().trim();
    }

    /** Divide em trechos de no maximo MAXIMO_POR_TRADUCAO letras, de preferencia no fim de uma frase. */
    static List<String> emPedacos(String texto) {
        List<String> pedacos = new ArrayList<>();
        String resto = texto;
        while (resto.length() > MAXIMO_POR_TRADUCAO) {
            int corte = Math.max(resto.lastIndexOf(". ", MAXIMO_POR_TRADUCAO), Math.max(resto.lastIndexOf("! ", MAXIMO_POR_TRADUCAO), resto.lastIndexOf("? ", MAXIMO_POR_TRADUCAO)));
            if (corte < 0) {
                corte = resto.lastIndexOf(' ', MAXIMO_POR_TRADUCAO);
            }
            corte = corte < 0 ? MAXIMO_POR_TRADUCAO : corte + 1;
            pedacos.add(resto.substring(0, corte).trim());
            resto = resto.substring(corte).trim();
        }
        if (!resto.isEmpty()) {
            pedacos.add(resto);
        }
        return pedacos;
    }

    // ------------------------------------------------------------------ texto

    /** Tira HTML, marcacoes e os avisos que as fontes colocam depois da descricao, e limita o tamanho. */
    static String limpar(String texto) {
        if (texto == null) {
            return "";
        }
        String limpo = texto.replace("\r", "")
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("<[^>]+>", "")
                .replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ");
        // no MangaDex, depois de uma linha "---" vem links e avisos que nao sao da historia
        int separador = limpo.indexOf("\n---");
        if (separador >= 0) {
            limpo = limpo.substring(0, separador);
        }
        limpo = limpo.replaceAll("(?i)\\(\\s*(source|fonte)\\s*:[^)]*\\)", "")
                .replaceAll("\\[([^\\]]+)\\]\\([^)]*\\)", "$1")   // [texto](link) -> texto
                .replaceAll("(\\*\\*|__|~~)", "")
                .replaceAll("[ \\t]+\n", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .trim();
        if (limpo.length() > TAMANHO_MAXIMO) {
            int fim = limpo.lastIndexOf(". ", TAMANHO_MAXIMO);
            limpo = limpo.substring(0, fim > TAMANHO_MAXIMO / 2 ? fim + 1 : TAMANHO_MAXIMO).trim();
        }
        return limpo;
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private static String codificar(String texto) {
        return URLEncoder.encode(texto, StandardCharsets.UTF_8);
    }

    /** JSON da resposta, ou um no vazio se a chamada falhou ou nao veio JSON. */
    private JsonNode ler(String corpo) {
        if (corpo == null) {
            return mapper.missingNode();
        }
        try {
            return mapper.readTree(corpo);
        } catch (JsonProcessingException e) {
            return mapper.missingNode();
        }
    }
}
