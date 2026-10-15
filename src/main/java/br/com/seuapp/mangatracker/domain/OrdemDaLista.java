package br.com.seuapp.mangatracker.domain;

import java.text.Normalizer;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Formas de ordenar a lista de mangas cadastrados (?ordem=). No Postgres a ordem e feita pelo banco
 * (PostgresMangaRepository), com as mesmas regras; aqui fica a versao em memoria, usada com o arquivo JSON.
 */
public enum OrdemDaLista {
    CADASTRO("Ordem de cadastro"),
    RECENTES("Adicionados por último"),
    TITULO("Título (A–Z)"),
    TITULO_DESC("Título (Z–A)"),
    MAIS_CAPITULOS("Mais capítulos lidos"),
    MENOS_CAPITULOS("Menos capítulos lidos"),
    MELHORES_NOTAS("Melhores notas"),
    PIORES_NOTAS("Piores notas"),
    FAVORITOS("Favoritos primeiro");

    private final String descricao;

    OrdemDaLista(String descricao) {
        this.descricao = descricao;
    }

    /** A lista chega na ordem de cadastro. */
    public void aplicar(List<Manga> mangas) {
        Comparator<Manga> porTitulo = Comparator.comparing(manga -> semAcentos(manga.getTitle()));
        switch (this) {
            case CADASTRO -> { }
            case RECENTES -> Collections.reverse(mangas);
            case TITULO -> mangas.sort(porTitulo);
            case TITULO_DESC -> mangas.sort(porTitulo.reversed());
            // empate fica em ordem alfabetica
            case MAIS_CAPITULOS -> mangas.sort(Comparator.comparing(Manga::getLastChapter).reversed().thenComparing(porTitulo));
            case MENOS_CAPITULOS -> mangas.sort(Comparator.comparing(Manga::getLastChapter).thenComparing(porTitulo));
            // quem nao tem nota fica sempre no fim, nas duas ordens
            case MELHORES_NOTAS -> mangas.sort(Comparator.comparing(Manga::getRating, Comparator.nullsLast(Comparator.<Integer>reverseOrder())).thenComparing(porTitulo));
            case PIORES_NOTAS -> mangas.sort(Comparator.comparing(Manga::getRating, Comparator.nullsLast(Comparator.<Integer>naturalOrder())).thenComparing(porTitulo));
            // os favoritos sobem e o resto continua na ordem de cadastro (a ordenacao e estavel)
            case FAVORITOS -> mangas.sort(Comparator.comparing(manga -> !manga.isFavorite()));
        }
    }

    private static String semAcentos(String texto) {
        return Normalizer.normalize(texto == null ? "" : texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }

    public String getDescricao() {
        return descricao;
    }
}
