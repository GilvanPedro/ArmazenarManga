package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
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
        "lastChapter", "readingStatus", "description"
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
        String description
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
                manga.getDescription()
        );
    }

    Manga paraManga() {
        List<Tag> tagsDoManga = new ArrayList<>();
        if (tags != null) {
            tags.forEach(nome -> tagsDoManga.add(new Tag(nome)));
        }
        return new Manga(
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
    }
}
