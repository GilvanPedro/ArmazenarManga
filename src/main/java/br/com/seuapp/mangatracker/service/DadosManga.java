package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.WeekDay;

import java.math.BigDecimal;
import java.util.List;

/** Informacoes preenchidas no cadastro e na edicao geral de um manga. */
public record DadosManga(
        String title,
        String imagePath,
        List<String> tags,
        String chapterLinkModel,
        ChapterDecimalFormat decimalFormat,
        BigDecimal lastChapter,
        ReadingStatus readingStatus,
        String description,
        WeekDay releaseDay,
        /** Nota de 0 a 10; null = sem nota. */
        Integer rating
) {
    /** Sem nota. */
    public DadosManga(String title, String imagePath, List<String> tags, String chapterLinkModel, ChapterDecimalFormat decimalFormat, BigDecimal lastChapter, ReadingStatus readingStatus, String description, WeekDay releaseDay) {
        this(title, imagePath, tags, chapterLinkModel, decimalFormat, lastChapter, readingStatus, description, releaseDay, null);
    }

    /** Sem dia de lancamento e sem nota. */
    public DadosManga(String title, String imagePath, List<String> tags, String chapterLinkModel, ChapterDecimalFormat decimalFormat, BigDecimal lastChapter, ReadingStatus readingStatus, String description) {
        this(title, imagePath, tags, chapterLinkModel, decimalFormat, lastChapter, readingStatus, description, null, null);
    }
}
