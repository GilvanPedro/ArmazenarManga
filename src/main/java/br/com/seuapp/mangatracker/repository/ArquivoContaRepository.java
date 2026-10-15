package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Conta;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Guarda as contas em um arquivo JSON (uso sem banco), legivel so pelo dono do computador. */
public class ArquivoContaRepository implements ContaRepository {

    /** Formato da conta no arquivo. */
    private record ContaJson(UUID id, String email, String nick, String senhaHash, boolean admin, String criadaEm) {
        static ContaJson de(Conta conta) {
            return new ContaJson(conta.id(), conta.email(), conta.nick(), conta.senhaHash(), conta.admin(), conta.criadaEm().toString());
        }

        Conta paraConta() {
            return new Conta(id, email, nick, senhaHash, admin, Instant.parse(criadaEm));
        }
    }

    private final Path arquivo;
    private final ObjectMapper mapper = JsonMapper.builder().enable(SerializationFeature.INDENT_OUTPUT).build();

    public ArquivoContaRepository(Path arquivo) {
        this.arquivo = Objects.requireNonNull(arquivo);
    }

    private List<Conta> ler() {
        if (!Files.exists(arquivo)) {
            return new ArrayList<>();
        }
        try {
            List<ContaJson> lidas = mapper.readValue(arquivo.toFile(), new TypeReference<>() { });
            return new ArrayList<>(lidas.stream().map(ContaJson::paraConta).toList());
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel ler as contas em " + arquivo, e);
        }
    }

    private void gravar(List<Conta> contas) {
        try {
            Files.createDirectories(arquivo.toAbsolutePath().getParent());
            // grava em outro arquivo e troca: se faltar luz no meio, o arquivo antigo continua inteiro
            Path temporario = arquivo.resolveSibling(arquivo.getFileName() + ".tmp");
            mapper.writeValue(temporario.toFile(), contas.stream().map(ContaJson::de).toList());
            try {
                Files.setPosixFilePermissions(temporario, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException e) {
                // Windows: fica com as permissoes da pasta
            }
            Files.move(temporario, arquivo, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel salvar as contas em " + arquivo, e);
        }
    }

    @Override
    public synchronized Optional<Conta> buscarPorId(UUID id) {
        return ler().stream().filter(conta -> conta.id().equals(id)).findFirst();
    }

    @Override
    public synchronized Optional<Conta> buscarPorEmail(String email) {
        return ler().stream().filter(conta -> conta.email().equals(email)).findFirst();
    }

    @Override
    public synchronized boolean inserir(Conta conta) {
        List<Conta> contas = ler();
        if (contas.stream().anyMatch(outra -> outra.email().equals(conta.email()) || outra.id().equals(conta.id()))) {
            return false;
        }
        contas.add(conta);
        gravar(contas);
        return true;
    }

    @Override
    public synchronized boolean atualizar(Conta conta) {
        List<Conta> contas = ler();
        if (contas.stream().anyMatch(outra -> outra.email().equals(conta.email()) && !outra.id().equals(conta.id()))) {
            return false;
        }
        contas.replaceAll(outra -> outra.id().equals(conta.id()) ? conta : outra);
        gravar(contas);
        return true;
    }

    @Override
    public synchronized void excluir(UUID id) {
        List<Conta> contas = ler();
        if (contas.removeIf(conta -> conta.id().equals(id))) {
            gravar(contas);
        }
    }
}
