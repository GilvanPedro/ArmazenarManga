package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.WeekDay;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface MangaServiceInterface {
    Manga salvarManga(DadosManga dados);
    Manga buscarPorId(UUID id);
    /** Titulo e status sao filtros opcionais (null = sem filtro). */
    List<Manga> listarMangas(String titulo, ReadingStatus readingStatus);
    void excluirManga(UUID id);
    Manga editarManga(UUID id, DadosManga dados);
    /** Altera so o ultimo capitulo lido e/ou o status (null = mantem o atual). Sair de LENDO apaga o dia de lancamento. */
    Manga atualizarProgresso(UUID id, BigDecimal lastChapter, ReadingStatus readingStatus);
    /** Mangas com status LENDO que lancam capitulo no dia informado. */
    List<Manga> listarLancamentos(WeekDay dia);
    /** Concluidos e cancelados nunca sao sorteados. */
    Manga sortearManga(ReadingStatus readingStatus);
}
