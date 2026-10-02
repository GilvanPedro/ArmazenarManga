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
    private BigDecimal lastChapter;
    private ReadingStatus readingStatus;
    private String description;

    public Manga(UUID id, String title, String imagePath, List<Tag> tags, String chapterLinkModel, BigDecimal lastChapter, ReadingStatus readingStatus, String description) {
        this.id = UUID.randomUUID();
        this.title = title;
        this.imagePath = imagePath;
        this.tags = tags;
        this.chapterLinkModel = chapterLinkModel;
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
}
