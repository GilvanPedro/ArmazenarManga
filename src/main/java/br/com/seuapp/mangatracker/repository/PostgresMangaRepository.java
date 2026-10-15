package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.OrdemDaLista;
import br.com.seuapp.mangatracker.domain.Tag;
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
    private final String conta;
    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(StreamWriteFeature.WRITE_BIGDECIMAL_AS_PLAIN)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    public PostgresMangaRepository(DataSource banco) {
        this(banco, EstruturaDoBanco.CONTA_PRINCIPAL);
    }

    /** @param conta de quem sao os mangas: todas as consultas e gravacoes ficam so nela */
    public PostgresMangaRepository(DataSource banco, String conta) {
        this.banco = Objects.requireNonNull(banco);
        this.conta = Objects.requireNonNull(conta);
        EstruturaDoBanco.preparar(banco);
    }

    @Override
    public void salvar(Manga manga) {
        Objects.requireNonNull(manga, "manga");
        Objects.requireNonNull(manga.getId(), "manga sem id");
        // o WHERE impede gravar por cima do manga de outra conta que tenha o mesmo id
        String sql = """
                INSERT INTO mangas (id, dados, conta, titulo_busca, tags_busca) VALUES (?, ?::jsonb, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, titulo_busca = EXCLUDED.titulo_busca, tags_busca = EXCLUDED.tags_busca
                WHERE mangas.conta = EXCLUDED.conta""";
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            List<String> tags = manga.getTags() == null ? List.of() : manga.getTags().stream().map(Tag::getNome).toList();
            comando.setObject(1, manga.getId());
            comando.setString(2, mapper.writeValueAsString(MangaJson.de(manga)));
            comando.setString(3, conta);
            comando.setString(4, EstruturaDoBanco.tituloDeBusca(manga.getTitle()));
            comando.setArray(5, conexao.createArrayOf("text", EstruturaDoBanco.tagsDeBusca(tags).toArray()));
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
             PreparedStatement comando = conexao.prepareStatement("SELECT dados FROM mangas WHERE id = ? AND conta = ?")) {
            comando.setObject(1, id);
            comando.setString(2, conta);
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
             PreparedStatement comando = conexao.prepareStatement("SELECT dados FROM mangas WHERE conta = ? ORDER BY ordem")) {
            comando.setString(1, conta);
            List<Manga> mangas = new ArrayList<>();
            try (ResultSet linhas = comando.executeQuery()) {
                while (linhas.next()) {
                    mangas.add(lerManga(linhas));
                }
            }
            return List.copyOf(mangas);
        } catch (SQLException | JsonProcessingException e) {
            throw new PersistenciaException("Nao foi possivel ler os mangas do banco", e);
        }
    }

    @Override
    public void excluir(UUID id) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("DELETE FROM mangas WHERE id = ? AND conta = ?")) {
            comando.setObject(1, id);
            comando.setString(2, conta);
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel excluir o manga do banco", e);
        }
    }

    // ------------------------------------------------------------------ lista feita pelo banco

    private static final String TITULO = "titulo_busca COLLATE \"C\"";
    private static final String NOTA = "CASE WHEN dados->>'rating' ~ '^(10|[0-9])$' THEN (dados->>'rating')::int END";

    /** A mesma ordem de {@link OrdemDaLista#aplicar}, feita pelo banco. Empates ficam pelo titulo e pela ordem de cadastro. */
    private static String ordemEmSql(OrdemDaLista ordem) {
        return switch (ordem) {
            case CADASTRO -> "ordem";
            case RECENTES -> "ordem DESC";
            case TITULO -> TITULO + ", ordem";
            case TITULO_DESC -> TITULO + " DESC, ordem";
            case MAIS_CAPITULOS -> "(dados->>'lastChapter')::numeric DESC, " + TITULO + ", ordem";
            case MENOS_CAPITULOS -> "(dados->>'lastChapter')::numeric, " + TITULO + ", ordem";
            case MELHORES_NOTAS -> NOTA + " DESC NULLS LAST, " + TITULO + ", ordem";
            case PIORES_NOTAS -> NOTA + " NULLS LAST, " + TITULO + ", ordem";
            case FAVORITOS -> "(dados->>'favorite' = 'true') IS NOT TRUE, ordem";
        };
    }

    /** Condicoes do WHERE e os valores delas, na ordem. */
    private record Filtros(String onde, List<Object> valores) {
    }

    private Filtros filtros(ConsultaDeMangas consulta) {
        List<String> condicoes = new ArrayList<>(List.of("conta = ?"));
        List<Object> valores = new ArrayList<>(List.of(conta));
        if (consulta.status() != null) {
            condicoes.add("dados->>'readingStatus' = ?");
            valores.add(consulta.status().name());
        }
        String busca = ConsultaDeMangas.normalizar(consulta.titulo());
        if (!busca.isEmpty()) {
            condicoes.add("strpos(titulo_busca, ?) > 0");
            valores.add(busca);
        }
        String tag = ConsultaDeMangas.normalizar(consulta.tag());
        if (!tag.isEmpty()) {
            condicoes.add("tags_busca @> ARRAY[?]::text[]");
            valores.add(tag);
        }
        return new Filtros(String.join(" AND ", condicoes), valores);
    }

    /** So o pedaco pedido sai do banco. */
    @Override
    public PaginaDeMangas consultar(ConsultaDeMangas consulta) {
        Filtros filtros = filtros(consulta);
        String sql = "SELECT dados, count(*) OVER () AS total FROM mangas WHERE " + filtros.onde() + " ORDER BY " + ordemEmSql(consulta.ordem())
                + (consulta.limite() == null ? "" : " LIMIT " + consulta.limite() + " OFFSET " + consulta.deslocamento());
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            for (int i = 0; i < filtros.valores().size(); i++) {
                comando.setObject(i + 1, filtros.valores().get(i));
            }
            List<Manga> mangas = new ArrayList<>();
            int total = 0;
            try (ResultSet linhas = comando.executeQuery()) {
                while (linhas.next()) {
                    mangas.add(lerManga(linhas));
                    total = linhas.getInt("total");
                }
            }
            // pedaco alem do fim: so conta, para quem pediu saber quantos existem
            return new PaginaDeMangas(List.copyOf(mangas), mangas.isEmpty() && consulta.deslocamento() > 0 ? contar(consulta) : total);
        } catch (SQLException | JsonProcessingException e) {
            throw new PersistenciaException("Nao foi possivel ler os mangas do banco", e);
        }
    }

    @Override
    public int contar(ConsultaDeMangas consulta) {
        Filtros filtros = filtros(consulta);
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT count(*) FROM mangas WHERE " + filtros.onde())) {
            for (int i = 0; i < filtros.valores().size(); i++) {
                comando.setObject(i + 1, filtros.valores().get(i));
            }
            try (ResultSet linhas = comando.executeQuery()) {
                linhas.next();
                return linhas.getInt(1);
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel contar os mangas do banco", e);
        }
    }

    private Manga lerManga(ResultSet linhas) throws SQLException, JsonProcessingException {
        return mapper.readValue(linhas.getString("dados"), MangaJson.class).paraManga();
    }
}
