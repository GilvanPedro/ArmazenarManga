package br.com.seuapp.mangatracker.domain;

public enum ReadingStatus {
    LENDO("Lendo"),
    DROPADO("Dropado"),
    CANCELADO("Cancelado"),
    CONCLUIDO("Concluído"),
    HIATUS("Hiatus"),
    LER("Para Ler");

    private String descricao;

    ReadingStatus(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }
}
