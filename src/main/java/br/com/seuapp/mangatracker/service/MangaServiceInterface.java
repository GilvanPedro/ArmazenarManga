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
    default List<Manga> listarMangas(String titulo, ReadingStatus readingStatus) {
        return listarMangas(titulo, readingStatus, null);
    }
    /** Titulo, status e tag sao filtros opcionais (null = sem filtro). */
    List<Manga> listarMangas(String titulo, ReadingStatus readingStatus, String tag);
    /** Lista geral de tags: as que estao em uso (as mais usadas primeiro) e depois as sugeridas ainda sem uso. */
    List<TagEmUso> listarTags();
    /** Mangas da lista que dividem tags com este, comecando pelos que dividem mais. */
    List<Manga> listarSemelhantes(UUID id);
    void excluirManga(UUID id);
    Manga editarManga(UUID id, DadosManga dados);
    /** Altera so o ultimo capitulo lido e/ou o status (null = mantem o atual). Sair de LENDO apaga o dia de lancamento. */
    Manga atualizarProgresso(UUID id, BigDecimal lastChapter, ReadingStatus readingStatus);
    /**
     * Registra o capitulo lido junto com o endereco exato da pagina dele, copiado do site de leitura.
     * E o caminho para sites em que cada capitulo tem um id proprio e que nao deixam o servidor conferir o link.
     *
     * @param nextChapterUrl endereco exato do proximo capitulo, se for conhecido; senao null
     */
    Manga registrarLeitura(UUID id, BigDecimal lastChapter, String lastChapterUrl, String nextChapterUrl);
    /** Confere no site o link do proximo capitulo e salva a correcao se o endereco mudou. */
    ResultadoVerificacao verificarLink(UUID id);
    /** Mangas com status LENDO que lancam capitulo no dia informado. */
    List<Manga> listarLancamentos(WeekDay dia);
    /** Concluidos e cancelados nunca sao sorteados. */
    Manga sortearManga(ReadingStatus readingStatus);
}
