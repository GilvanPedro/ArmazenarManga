package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;

import java.math.BigDecimal;
import br.com.seuapp.mangatracker.service.ImagemService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Manga do jeito que a API devolve: os dados salvos + os links ja montados. */
record MangaResponse(
        UUID id,
        String title,
        String imagePath,
        String imageUrl,
        List<String> tags,
        String chapterLinkModel,
        ChapterDecimalFormat decimalFormat,
        BigDecimal lastChapter,
        ReadingStatus readingStatus,
        WeekDay releaseDay,
        String description,
        String firstChapterLink,
        String lastChapterLink,
        BigDecimal nextChapter,
        String nextChapterLink,
        /** Outros nomes da mesma obra ja descobertos (original, em outras linguas, apelidos); vazio se ainda nao foram buscados. */
        List<String> altTitles,
        /** true quando o link do proximo capitulo e um endereco exato ja encontrado no site, e nao so o modelo preenchido. */
        boolean nextChapterLinkExact,
        /** Nota de 0 a 10 dada pelo dono da lista; null = sem nota. */
        Integer rating,
        /** true quando o manga esta marcado como favorito. */
        boolean favorite,
        /** Versao pequena da capa, para a lista; null quando ainda nao existe (use imageUrl). */
        String thumbUrl
) {

    /** O mesmo manga sem a descricao, para listas grandes. Os outros nomes ficam: servem para reconhecer o manga. */
    MangaResponse resumo() {
        return new MangaResponse(id, title, imagePath, imageUrl, tags, chapterLinkModel, decimalFormat, lastChapter, readingStatus, releaseDay,
                null, firstChapterLink, lastChapterLink, nextChapter, nextChapterLink, altTitles, nextChapterLinkExact, rating, favorite, thumbUrl);
    }

    static MangaResponse de(Manga manga) {
        return de(manga, Map.of());
    }

    /** @param miniaturas as miniaturas destas capas, de {@link ImagemService#miniaturas(java.util.Collection)} */
    static MangaResponse de(Manga manga, Map<String, String> miniaturas) {
        String imagePath = manga.getImagePath();
        return new MangaResponse(
                manga.getId(),
                manga.getTitle(),
                imagePath,
                ChapterLink.isUrlHttp(imagePath) ? imagePath : "/api/imagens/" + imagePath,
                manga.getTags().stream().map(Tag::getNome).toList(),
                manga.getChapterLinkModel(),
                manga.getDecimalFormat(),
                manga.getLastChapter(),
                manga.getReadingStatus(),
                manga.getReleaseDay(),
                manga.getDescription(),
                manga.linkPrimeiroCapitulo(),
                manga.linkUltimoCapitulo(),
                manga.proximoCapitulo(),
                manga.linkProximoCapitulo(),
                // as marcas internas ("anilist:123") nao sao nomes
                manga.getAltTitles() == null ? List.of() : manga.getAltTitles().stream().filter(nome -> !nome.startsWith("anilist:")).toList(),
                manga.getNextChapterUrl() != null,
                manga.getRating(),
                manga.isFavorite(),
                ImagemService.enderecoDaMiniatura(imagePath, miniaturas)
        );
    }
}
