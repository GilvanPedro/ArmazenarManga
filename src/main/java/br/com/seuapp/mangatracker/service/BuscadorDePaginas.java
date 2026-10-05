package br.com.seuapp.mangatracker.service;

/** Abre uma pagina de outro site. Nunca lanca excecao: falha vira {@link PaginaWeb#semResposta}. */
public interface BuscadorDePaginas {
    PaginaWeb buscar(String endereco);
}
