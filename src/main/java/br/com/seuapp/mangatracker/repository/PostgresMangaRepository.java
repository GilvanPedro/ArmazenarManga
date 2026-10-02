package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.StreamWriteFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Guarda os mangas no Postgres. Cada manga continua sendo o mesmo JSON do arquivo
 * ({@link MangaJson}), so que em uma linha da tabela em vez de um item do mangas.json.
 */
public class PostgresMangaRepository implements MangaRepository {

    private final DataSource banco;
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(StreamWriteFeature.WRITE_BIGDECIMAL_AS_PLAIN)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    public PostgresMangaRepository(DataSource banco) {
        this.banco = Objects.requireNonNull(banco);
        try (Connection conexao = banco.getConnection(); Statement comando = conexao.createStatement()) {
            // "ordem" mantem a ordem de cadastro, como no arquivo
            comando.execute("""
                    CREATE TABLE IF NOT EXISTS mangas (
                        id UUID PRIMARY KEY,
                        ordem BIGSERIAL,
                        dados JSONB NOT NULL
                    )""");
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel preparar a tabela de mangas", e);
        }
    }

    @Override
    public void salvar(Manga manga) {
        Objects.requireNonNull(manga, "manga");
        Objects.requireNonNull(manga.getId(), "manga sem id");
        String sql = """
                INSERT INTO mangas (id, dados) VALUES (?, ?::jsonb)
                ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados""";
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            comando.setObject(1, manga.getId());
            comando.setString(2, mapper.writeValueAsString(MangaJson.de(manga)));
            comando.executeUpdate();
        } catch (SQLException | JsonProcessingException e) {
            throw new PersistenciaException("Nao foi possivel salvar o manga no banco", e);
        }
    }

    @Override
    public Optional<Manga> buscarPorId(UUID id) {
        if (id == null) {
            return Optional.empty();
        }
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT dados FROM mangas WHERE id = ?")) {
            comando.setObject(1, id);
            try (ResultSet linhas = comando.executeQuery()) {
                return linhas.next() ? Optional.of(lerManga(linhas)) : Optional.empty();
            }
        } catch (SQLException | JsonProcessingException e) {
            throw new PersistenciaException("Nao foi possivel ler o manga do banco", e);
        }
    }

    @Override
    public List<Manga> listarTodos() {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT dados FROM mangas ORDER BY ordem");
             ResultSet linhas = comando.executeQuery()) {
            List<Manga> mangas = new ArrayList<>();
            while (linhas.next()) {
                mangas.add(lerManga(linhas));
            }
            return List.copyOf(mangas);
        } catch (SQLException | JsonProcessingException e) {
            throw new PersistenciaException("Nao foi possivel ler os mangas do banco", e);
        }
    }

    @Override
    public void excluir(UUID id) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("DELETE FROM mangas WHERE id = ?")) {
            comando.setObject(1, id);
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel excluir o manga do banco", e);
        }
    }

    private Manga lerManga(ResultSet linhas) throws SQLException, JsonProcessingException {
        return mapper.readValue(linhas.getString("dados"), MangaJson.class).paraManga();
    }
}
