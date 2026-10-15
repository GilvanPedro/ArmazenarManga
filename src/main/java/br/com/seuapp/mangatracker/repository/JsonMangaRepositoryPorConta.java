package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mangas em arquivos JSON (uso sem banco), um arquivo por conta: a conta antiga continua em {pasta}/mangas.json, e
 * cada conta tem o seu em {pasta}/contas/{id}/mangas.json. Cada operacao vai para o arquivo da conta atual.
 */
public class JsonMangaRepositoryPorConta implements MangaRepository {
    private final Path pasta;
    private final Map<String, JsonMangaRepository> porConta = new ConcurrentHashMap<>();

    public JsonMangaRepositoryPorConta(Path pasta) {
        this.pasta = Objects.requireNonNull(pasta);
    }

    /** Pasta dos dados de uma conta (a da conta antiga e a propria pasta de dados). */
    static Path pastaDaConta(Path pasta, String conta) {
        return conta.equals(EstruturaDoBanco.CONTA_PRINCIPAL) ? pasta : pasta.resolve("contas").resolve(conta);
    }

    private JsonMangaRepository atual() {
        String conta = ContaAtual.obter();
        // so ids de conta (e a conta antiga) viram pasta: nada de "../"
        if (!conta.equals(EstruturaDoBanco.CONTA_PRINCIPAL) && !conta.matches("[0-9a-f-]{36}")) {
            return porConta.computeIfAbsent(ContaAtual.NENHUMA, nome -> new JsonMangaRepository(pasta.resolve("contas").resolve("nenhuma.json")) {
                @Override
                public void salvar(Manga manga) {
                    throw new IllegalStateException("Gravacao sem conta");
                }
            });
        }
        return porConta.computeIfAbsent(conta, nome -> new JsonMangaRepository(pastaDaConta(pasta, nome).resolve("mangas.json")));
    }

    @Override
    public void salvar(Manga manga) {
        atual().salvar(manga);
    }

    @Override
    public Optional<Manga> buscarPorId(UUID id) {
        return atual().buscarPorId(id);
    }

    @Override
    public List<Manga> listarTodos() {
        return atual().listarTodos();
    }

    @Override
    public void excluir(UUID id) {
        atual().excluir(id);
    }

    @Override
    public void excluirTodos() {
        String conta = ContaAtual.obter();
        porConta.remove(conta);
        try {
            Files.deleteIfExists(pastaDaConta(pasta, conta).resolve("mangas.json"));
        } catch (IOException e) {
            throw new br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException("Nao foi possivel apagar os mangas da conta", e);
        }
    }
}
