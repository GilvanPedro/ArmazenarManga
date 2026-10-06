package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Formato do manga dentro do arquivo JSON.
 * Existe so para o domínio nao precisar de anotacoes do Jackson.
 */
@JsonPropertyOrder({
        "id", "title", "imagePath", "tags", "chapterLinkModel", "decimalFormat",
        "lastChapter", "readingStatus", "releaseDay", "description", "lastChapterUrl", "nextChapterUrl", "altTitles"
})
record MangaJson(
        UUID id,
        String title,
        String imagePath,
        List<String> tags,
        String chapterLinkModel,
        ChapterDecimalFormat decimalFormat,
        BigDecimal lastChapter,
        ReadingStatus readingStatus,
        WeekDay releaseDay,
        String description,
        String lastChapterUrl,
        String nextChapterUrl,
        List<String> altTitles
) {

    static MangaJson de(Manga manga) {
        return new MangaJson(
                manga.getId(),
                manga.getTitle(),
                manga.getImagePath(),
                manga.getTags() == null ? List.of() : manga.getTags().stream().map(Tag::getNome).toList(),
                manga.getChapterLinkModel(),
                manga.getDecimalFormat(),
                manga.getLastChapter(),
                manga.getReadingStatus(),
                manga.getReleaseDay(),
                manga.getDescription(),
                manga.getLastChapterUrl(),
                manga.getNextChapterUrl(),
                manga.getAltTitles() == null ? null : List.copyOf(manga.getAltTitles())
        );
    }

    Manga paraManga() {
        List<Tag> tagsDoManga = new ArrayList<>();
        if (tags != null) {
            tags.forEach(nome -> tagsDoManga.add(new Tag(nome)));
        }
        Manga manga = new Manga(
                id,
                title,
                imagePath,
                tagsDoManga,
                chapterLinkModel,
                decimalFormat,
                lastChapter,
                readingStatus,
                description
        );
        manga.setReleaseDay(releaseDay);
        manga.setLastChapterUrl(lastChapterUrl);
        manga.setNextChapterUrl(nextChapterUrl);
        manga.setAltTitles(altTitles == null ? null : List.copyOf(altTitles));
        return manga;
    }
}
