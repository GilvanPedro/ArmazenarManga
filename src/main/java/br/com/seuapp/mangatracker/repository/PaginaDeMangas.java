package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;

import java.util.List;

/** Um pedaco da lista e quantos mangas passaram nos filtros ao todo. */
public record PaginaDeMangas(List<Manga> mangas, int total) {
}
