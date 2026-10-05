package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;

import java.math.BigDecimal;
import java.util.List;
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
        /** true quando o link do proximo capitulo e um endereco exato ja encontrado no site, e nao so o modelo preenchido. */
        boolean nextChapterLinkExact
) {

    static MangaResponse de(Manga manga) {
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
                manga.getNextChapterUrl() != null
        );
    }
}
