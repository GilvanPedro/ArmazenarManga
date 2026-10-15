package br.com.seuapp.mangatracker.repository;

import java.util.Optional;

/** Onde o conteudo das capas enviadas fica guardado. O nome ja chega validado pelo ImagemService. */
public interface ImagemRepository {
    void salvar(String nome, byte[] conteudo);
    Optional<byte[]> buscar(String nome);
    boolean existe(String nome);
    void excluir(String nome);

    /** Nomes guardados que terminam com o final informado (por exemplo, as miniaturas). */
    java.util.Set<String> listarTerminadosEm(String finalDoNome);
}
