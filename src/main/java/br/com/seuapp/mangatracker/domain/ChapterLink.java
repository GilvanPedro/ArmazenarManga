package br.com.seuapp.mangatracker.domain;

import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;

/** Modelo do link (https://site.com/manga/capitulo-{cap}) + formato -> URL do capitulo. */
public final class ChapterLink {

    public static final String MARCADOR = "{cap}";

    private ChapterLink() {
    }

    public static void validar(String modelo) {
        if (modelo == null || modelo.isBlank()) {
            throw new InvalidLinkException("Verifique se você preencheu o link corretamente");
        }
        if (!modelo.contains(MARCADOR)) {
            throw new InvalidLinkException("O link precisa ter " + MARCADOR + " no lugar do número do capítulo");
        }
        if (!isUrlHttp(modelo.replace(MARCADOR, "1"))) {
            throw new InvalidLinkException("O link precisa ser um endereço http:// ou https:// válido");
        }
    }

    public static String montar(String modelo, ChapterDecimalFormat formato, BigDecimal capitulo) {
        return modelo.replace(MARCADOR, formato.formatar(capitulo));
    }

    /** Proximo capitulo inteiro ainda nao lido: 48 -> 49, 48.5 -> 49, 0 -> 1. */
    public static BigDecimal proximoCapitulo(BigDecimal ultimoLido) {
        return ultimoLido.setScale(0, RoundingMode.FLOOR).add(BigDecimal.ONE);
    }

    /**
     * Descobre o modelo a partir do endereco real de um capitulo: troca o numero do capitulo por {cap}.
     * Ex.: (".../obra-bd5bdaf8/chapter/174", 174) -> ".../obra-bd5bdaf8/chapter/{cap}".
     *
     * @return null se o endereco nao tem o numero desse capitulo (nao e a pagina dele)
     */
    public static String derivarModelo(String endereco, BigDecimal capitulo, ChapterDecimalFormat formato) {
        if (endereco == null) {
            return null;
        }
        String numero = formato.formatar(capitulo);
        int inicioDoCaminho = endereco.indexOf('/', endereco.indexOf("://") + 3);
        if (inicioDoCaminho < 0) {
            return null;
        }
        // o numero do capitulo costuma ser o ultimo do endereco; ids e slugs vem antes
        for (int posicao = endereco.lastIndexOf(numero); posicao >= inicioDoCaminho; posicao = endereco.lastIndexOf(numero, posicao - 1)) {
            int fim = posicao + numero.length();
            boolean digitoAntes = Character.isDigit(endereco.charAt(posicao - 1));
            boolean letraOuDigitoDepois = fim < endereco.length() && Character.isLetterOrDigit(endereco.charAt(fim));
            if (!digitoAntes && !letraOuDigitoDepois) {
                return endereco.substring(0, posicao) + MARCADOR + endereco.substring(fim);
            }
        }
        return null;
    }

    /** Compara dois enderecos ignorando barra no final, o trecho depois de # e maiusculas no dominio. */
    public static boolean mesmoEndereco(String a, String b) {
        return a != null && b != null && normalizar(a).equals(normalizar(b));
    }

    private static String normalizar(String endereco) {
        String limpo = endereco.trim();
        int fragmento = limpo.indexOf('#');
        if (fragmento >= 0) {
            limpo = limpo.substring(0, fragmento);
        }
        while (limpo.endsWith("/")) {
            limpo = limpo.substring(0, limpo.length() - 1);
        }
        int inicioDoCaminho = limpo.indexOf('/', limpo.indexOf("://") + 3);
        return inicioDoCaminho < 0
                ? limpo.toLowerCase()
                : limpo.substring(0, inicioDoCaminho).toLowerCase() + limpo.substring(inicioDoCaminho);
    }

    public static boolean isUrlHttp(String texto) {
        if (texto == null) {
            return false;
        }
        try {
            URI uri = new URI(texto.trim());
            String esquema = uri.getScheme();
            return uri.getHost() != null
                    && ("http".equalsIgnoreCase(esquema) || "https".equalsIgnoreCase(esquema));
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
