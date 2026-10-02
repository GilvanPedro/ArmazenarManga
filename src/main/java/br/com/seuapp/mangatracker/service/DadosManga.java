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
        WeekDay releaseDay
) {
    /** Sem dia de lancamento. */
    public DadosManga(String title, String imagePath, List<String> tags, String chapterLinkModel, ChapterDecimalFormat decimalFormat, BigDecimal lastChapter, ReadingStatus readingStatus, String description) {
        this(title, imagePath, tags, chapterLinkModel, decimalFormat, lastChapter, readingStatus, description, null);
    }
}
