package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import java.util.Optional;

/** Guarda as capas dentro do Postgres, para hospedagens que nao tem disco permanente. */
public class PostgresImagemRepository implements ImagemRepository {

    private final DataSource banco;

    public PostgresImagemRepository(DataSource banco) {
        this.banco = Objects.requireNonNull(banco);
        try (Connection conexao = banco.getConnection(); Statement comando = conexao.createStatement()) {
            comando.execute("""
                    CREATE TABLE IF NOT EXISTS imagens (
                        nome TEXT PRIMARY KEY,
                        conteudo BYTEA NOT NULL
                    )""");
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel preparar a tabela de imagens", e);
        }
    }

    @Override
    public void salvar(String nome, byte[] conteudo) {
        String sql = """
                INSERT INTO imagens (nome, conteudo) VALUES (?, ?)
                ON CONFLICT (nome) DO UPDATE SET conteudo = EXCLUDED.conteudo""";
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            comando.setString(1, nome);
            comando.setBytes(2, conteudo);
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel salvar a imagem no banco", e);
        }
    }

    @Override
    public Optional<byte[]> buscar(String nome) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT conteudo FROM imagens WHERE nome = ?")) {
            comando.setString(1, nome);
            try (ResultSet linhas = comando.executeQuery()) {
                return linhas.next() ? Optional.of(linhas.getBytes("conteudo")) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel ler a imagem do banco", e);
        }
    }

    @Override
    public boolean existe(String nome) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT 1 FROM imagens WHERE nome = ?")) {
            comando.setString(1, nome);
            try (ResultSet linhas = comando.executeQuery()) {
                return linhas.next();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel consultar a imagem no banco", e);
        }
    }

    @Override
    public void excluir(String nome) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("DELETE FROM imagens WHERE nome = ?")) {
            comando.setString(1, nome);
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel excluir a imagem do banco", e);
        }
    }
}
