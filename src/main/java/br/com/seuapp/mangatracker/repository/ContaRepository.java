package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Conta;

import java.util.Optional;
import java.util.UUID;

/** Onde as contas ficam guardadas. O e-mail chega ja em minusculas e e unico. */
public interface ContaRepository {
    Optional<Conta> buscarPorId(UUID id);

    Optional<Conta> buscarPorEmail(String email);

    /** @return false se ja existir uma conta com esse e-mail */
    boolean inserir(Conta conta);

    /** @return false se o e-mail novo ja for de outra conta */
    boolean atualizar(Conta conta);

    void excluir(UUID id);
}
