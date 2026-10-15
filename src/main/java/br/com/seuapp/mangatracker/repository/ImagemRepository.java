package br.com.seuapp.mangatracker.repository;

import java.util.Optional;

/** Onde o conteudo das capas enviadas fica guardado. O nome ja chega validado pelo ImagemService. */
public interface ImagemRepository {
    void salvar(String nome, byte[] conteudo);
    Optional<byte[]> buscar(String nome);
    boolean existe(String nome);
    void excluir(String nome);

    /** Apaga todas as capas da conta atual (ao excluir a conta). */
    void excluirTodas();

    /** Traz para a conta atual todas as capas de outra conta. */
    void trazerDe(String outraConta);

    /** Quais destes nomes estao guardados. */
    default java.util.Set<String> existentes(java.util.Collection<String> nomes) {
        return nomes.stream().filter(this::existe).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
