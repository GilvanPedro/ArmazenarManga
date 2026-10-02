package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MangaRepository {

    /** Insere se o ID for novo, substitui se ja existir. */
    void salvar(Manga manga);
    Optional<Manga> buscarPorId(UUID id);
    List<Manga> listarTodos();
    void excluir(UUID id);
}
