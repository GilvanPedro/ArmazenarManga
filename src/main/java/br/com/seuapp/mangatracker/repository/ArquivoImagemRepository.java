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
    public void excluirTodas() {
        if (!Files.isDirectory(pasta)) {
            return;
        }
        try (var arquivos = Files.list(pasta)) {
            for (Path arquivo : arquivos.toList()) {
                Files.deleteIfExists(arquivo);
            }
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel apagar as imagens em " + pasta, e);
        }
    }

    /** Uma pasta so: nao ha de onde trazer. */
    @Override
    public void trazerDe(String outraConta) {
    }

    /** Move todas as capas desta pasta para outra (usado ao trazer as capas de uma conta para outra). */
    void moverPara(ArquivoImagemRepository destino) {
        if (!Files.isDirectory(pasta)) {
            return;
        }
        try (var arquivos = Files.list(pasta)) {
            Files.createDirectories(destino.pasta);
            for (Path arquivo : arquivos.toList()) {
                Files.move(arquivo, destino.pasta.resolve(arquivo.getFileName()), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel mover as imagens de " + pasta, e);
        }
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
