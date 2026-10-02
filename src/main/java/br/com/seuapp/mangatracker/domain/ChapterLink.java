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
