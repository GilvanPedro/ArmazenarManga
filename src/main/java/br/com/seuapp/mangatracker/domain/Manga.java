package br.com.seuapp.mangatracker.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class Manga {
    private UUID id;
    private String title;
    private String imagePath;
    private List<Tag> tags;
    private String chapterLinkModel;
    private ChapterDecimalFormat decimalFormat;
    private BigDecimal lastChapter;
    private ReadingStatus readingStatus;
    private String description;
    /** So existe enquanto o manga esta com status LENDO; null = sem dia definido. */
    private WeekDay releaseDay;

    public Manga(String title, String imagePath, List<Tag> tags, String chapterLinkModel, ChapterDecimalFormat decimalFormat, BigDecimal lastChapter, ReadingStatus readingStatus, String description) {
        this(UUID.randomUUID(), title, imagePath, tags, chapterLinkModel, decimalFormat, lastChapter, readingStatus, description);
    }

    public Manga(UUID id, String title, String imagePath, List<Tag> tags, String chapterLinkModel, ChapterDecimalFormat decimalFormat, BigDecimal lastChapter, ReadingStatus readingStatus, String description) {
        this.id = id;
        this.title = title;
        this.imagePath = imagePath;
        this.tags = tags;
        this.chapterLinkModel = chapterLinkModel;
        this.decimalFormat = decimalFormat == null ? ChapterDecimalFormat.PADRAO : decimalFormat;
        this.lastChapter = lastChapter;
        this.readingStatus = readingStatus;
        this.description = description;
    }

    public UUID getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getImagePath() {
        return imagePath;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    public List<Tag> getTags() {
        return tags;
    }

    public void adicionarTag(Tag tag) {
        this.tags.add(tag);
    }

    public String getChapterLinkModel() {
        return chapterLinkModel;
    }

    public void setChapterLinkModel(String chapterLinkModel) {
        this.chapterLinkModel = chapterLinkModel;
    }

    public ChapterDecimalFormat getDecimalFormat() {
        return decimalFormat;
    }

    public void setDecimalFormat(ChapterDecimalFormat decimalFormat) {
        this.decimalFormat = decimalFormat;
    }

    public BigDecimal getLastChapter() {
        return lastChapter;
    }

    public void setLastChapter(BigDecimal lastChapter) {
        this.lastChapter = lastChapter;
    }

    public ReadingStatus getReadingStatus() {
        return readingStatus;
    }

    public void setReadingStatus(ReadingStatus readingStatus) {
        this.readingStatus = readingStatus;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public WeekDay getReleaseDay() {
        return releaseDay;
    }

    public void setReleaseDay(WeekDay releaseDay) {
        this.releaseDay = releaseDay;
    }

    /** Link do capitulo 1, para ler de novo desde o comeco. */
    public String linkPrimeiroCapitulo() {
        return ChapterLink.montar(chapterLinkModel, decimalFormat, BigDecimal.ONE);
    }

    /** Link do ultimo capitulo lido, sempre montado a partir do lastChapter atual. */
    public String linkUltimoCapitulo() {
        return ChapterLink.montar(chapterLinkModel, decimalFormat, lastChapter);
    }

    public BigDecimal proximoCapitulo() {
        return ChapterLink.proximoCapitulo(lastChapter);
    }

    /** Link do proximo capitulo que ainda nao foi lido. */
    public String linkProximoCapitulo() {
        return ChapterLink.montar(chapterLinkModel, decimalFormat, proximoCapitulo());
    }
}
