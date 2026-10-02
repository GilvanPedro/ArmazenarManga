package br.com.seuapp.mangatracker.domain;

import java.math.BigDecimal;

/** Como o site escreve os capitulos ".5" no link. */
public enum ChapterDecimalFormat {
    HIFEN("-", "X-5"),
    PONTO(".", "X.5"),
    UNDERLINE("_", "X_5");

    public static final ChapterDecimalFormat PADRAO = HIFEN;

    private String separador;
    private String descricao;

    ChapterDecimalFormat(String separador, String descricao) {
        this.separador = separador;
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }

    /** 48 -> "48", 48.5 -> "48-5" / "48.5" / "48_5". */
    public String formatar(BigDecimal capitulo) {
        BigDecimal semZeros = capitulo.stripTrailingZeros();
        if (semZeros.scale() <= 0) {
            return semZeros.toBigInteger().toString();
        }
        return semZeros.toPlainString().replace(".", separador);
    }
}
