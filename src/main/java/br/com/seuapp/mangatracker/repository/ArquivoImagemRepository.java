package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Optional;

/** Guarda cada capa como um arquivo dentro de uma pasta. */
public class ArquivoImagemRepository implements ImagemRepository {

    private final Path pasta;

    public ArquivoImagemRepository(Path pasta) {
        this.pasta = Objects.requireNonNull(pasta);
    }

    @Override
    public void salvar(String nome, byte[] conteudo) {
        try {
            Files.createDirectories(pasta);
            Files.write(pasta.resolve(nome), conteudo);
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel salvar a imagem em " + pasta, e);
        }
    }

    @Override
    public Optional<byte[]> buscar(String nome) {
        if (!existe(nome)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(pasta.resolve(nome)));
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel ler a imagem " + nome, e);
        }
    }

    @Override
    public boolean existe(String nome) {
        return Files.isRegularFile(pasta.resolve(nome));
    }

    @Override
    public void excluir(String nome) {
        try {
            Files.deleteIfExists(pasta.resolve(nome));
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel excluir a imagem " + nome, e);
        }
    }
}
