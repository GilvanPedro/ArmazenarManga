package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import com.fasterxml.jackson.core.StreamWriteFeature;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static java.nio.file.StandardCopyOption.ATOMIC_MOVE;
import static java.nio.file.StandardCopyOption.REPLACE_EXISTING;

public class JsonMangaRepository implements MangaRepository {

    private static final TypeReference<List<MangaJson>> TIPO_LISTA = new TypeReference<>() {};

    private final Path arquivo;
    private final ObjectMapper mapper;
    private final ObjectWriter writer;
    private final Map<UUID, Manga> mangas = new LinkedHashMap<>();

    public JsonMangaRepository(Path arquivo) {
        this.arquivo = Objects.requireNonNull(arquivo);
        this.mapper = JsonMapper.builder()
                .enable(StreamWriteFeature.WRITE_BIGDECIMAL_AS_PLAIN)        // 48.5 e nunca 4.85E+1
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)  // campo removido no futuro nao quebra a leitura
                .build();
        this.writer = mapper.writer(new PrettyPrinterBonito());
        carregar();
    }

    /** Salva em ~/.mangatracker/mangas.json */
    public static JsonMangaRepository noDiretorioPadrao() {
        Path pasta = Path.of(System.getProperty("user.home"), ".mangatracker");
        return new JsonMangaRepository(pasta.resolve("mangas.json"));
    }

    @Override
    public synchronized void salvar(Manga manga) {
        Objects.requireNonNull(manga, "manga");
        Objects.requireNonNull(manga.getId(), "manga sem id");
        Manga anterior = mangas.put(manga.getId(), manga);
        try {
            persistir();
        } catch (PersistenciaException e) {
            // memoria e arquivo precisam continuar iguais
            if (anterior == null) {
                mangas.remove(manga.getId());
            } else {
                mangas.put(manga.getId(), anterior);
            }
            throw e;
        }
    }

    @Override
    public synchronized Optional<Manga> buscarPorId(UUID id) {
        return Optional.ofNullable(mangas.get(id));
    }

    @Override
    public synchronized List<Manga> listarTodos() {
        return List.copyOf(mangas.values());
    }

    @Override
    public synchronized void excluir(UUID id) {
        if (mangas.remove(id) != null) {
            persistir();
        }
    }

    // ------------------------------------------------------------------

    private void carregar() {
        if (Files.notExists(arquivo)) {
            return; // primeira execucao: comeca vazio, o arquivo nasce no primeiro salvar
        }
        try {
            if (Files.size(arquivo) == 0) {
                return;
            }
            List<MangaJson> lidos = mapper.readValue(arquivo.toFile(), TIPO_LISTA);
            for (MangaJson json : lidos) {
                if (json == null || json.id() == null) {
                    throw new IOException("manga sem id");
                }
                Manga manga = json.paraManga();
                mangas.put(manga.getId(), manga);
            }
        } catch (IOException e) {
            // Nao engole o erro: se seguisse vazio, o proximo salvar apagaria tudo
            throw new PersistenciaException(
                    "Nao foi possivel ler " + arquivo + ". O arquivo pode estar corrompido.", e);
        }
    }

    private void persistir() {
        List<MangaJson> dados = mangas.values().stream()
                .map(MangaJson::de)
                .toList();

        Path temp = arquivo.resolveSibling(arquivo.getFileName() + ".tmp");
        try {
            Path pasta = arquivo.toAbsolutePath().getParent();
            if (pasta != null) {
                Files.createDirectories(pasta);
            }
            writer.writeValue(temp.toFile(), dados);
            moverSubstituindo(temp, arquivo);
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel salvar em " + arquivo, e);
        }
    }

    private static void moverSubstituindo(Path origem, Path destino) throws IOException {
        try {
            Files.move(origem, destino, REPLACE_EXISTING, ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(origem, destino, REPLACE_EXISTING);
        }
    }
}
