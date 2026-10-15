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

    /** Filtra, ordena e corta a lista. Esta versao faz tudo em memoria; o Postgres faz no banco. */
    default PaginaDeMangas consultar(ConsultaDeMangas consulta) {
        java.util.List<Manga> encontrados = new java.util.ArrayList<>(listarTodos().stream().filter(consulta::aceita).toList());
        consulta.ordem().aplicar(encontrados);
        int inicio = Math.min(consulta.deslocamento(), encontrados.size());
        int fim = consulta.limite() == null ? encontrados.size() : Math.min(encontrados.size(), inicio + consulta.limite());
        return new PaginaDeMangas(java.util.List.copyOf(encontrados.subList(inicio, fim)), encontrados.size());
    }

    /** Quantos mangas passam nos filtros da consulta. */
    default int contar(ConsultaDeMangas consulta) {
        return (int) listarTodos().stream().filter(consulta::aceita).count();
    }
}
