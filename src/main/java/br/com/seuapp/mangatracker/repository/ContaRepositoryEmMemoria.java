package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Conta;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Contas que somem quando o programa fecha. Para testes. */
public class ContaRepositoryEmMemoria implements ContaRepository {
    private final Map<UUID, Conta> contas = new LinkedHashMap<>();

    @Override
    public synchronized Optional<Conta> buscarPorId(UUID id) {
        return Optional.ofNullable(contas.get(id));
    }

    @Override
    public synchronized Optional<Conta> buscarPorEmail(String email) {
        return contas.values().stream().filter(conta -> conta.email().equals(email)).findFirst();
    }

    @Override
    public synchronized boolean inserir(Conta conta) {
        if (buscarPorEmail(conta.email()).isPresent() || contas.containsKey(conta.id())) {
            return false;
        }
        contas.put(conta.id(), conta);
        return true;
    }

    @Override
    public synchronized boolean atualizar(Conta conta) {
        if (buscarPorEmail(conta.email()).filter(outra -> !outra.id().equals(conta.id())).isPresent()) {
            return false;
        }
        contas.put(conta.id(), conta);
        return true;
    }

    @Override
    public synchronized void excluir(UUID id) {
        contas.remove(id);
    }
}
