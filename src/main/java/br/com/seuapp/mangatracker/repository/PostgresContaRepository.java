package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Conta;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/** Guarda as contas na tabela "contas", a mesma que a versao do Vercel usa. */
public class PostgresContaRepository implements ContaRepository {
    private final DataSource banco;

    public PostgresContaRepository(DataSource banco) {
        this.banco = Objects.requireNonNull(banco);
        EstruturaDoBanco.preparar(banco);
    }

    private Optional<Conta> buscar(String coluna, Object valor) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement(
                     "SELECT id, email, nick, senha_hash, admin, criada_em, foto FROM contas WHERE " + coluna + " = ?")) {
            comando.setObject(1, valor);
            try (ResultSet linha = comando.executeQuery()) {
                return linha.next() ? Optional.of(new Conta(linha.getObject("id", UUID.class), linha.getString("email"), linha.getString("nick"),
                        linha.getString("senha_hash"), linha.getBoolean("admin"), linha.getTimestamp("criada_em").toInstant(), linha.getString("foto"))) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel ler a conta do banco", e);
        }
    }

    @Override
    public Optional<Conta> buscarPorId(UUID id) {
        return buscar("id", id);
    }

    @Override
    public Optional<Conta> buscarPorEmail(String email) {
        return buscar("email", email);
    }

    @Override
    public boolean inserir(Conta conta) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement(
                     "INSERT INTO contas (id, email, nick, senha_hash, admin, criada_em, foto) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")) {
            comando.setObject(1, conta.id());
            comando.setString(2, conta.email());
            comando.setString(3, conta.nick());
            comando.setString(4, conta.senhaHash());
            comando.setBoolean(5, conta.admin());
            comando.setTimestamp(6, Timestamp.from(conta.criadaEm()));
            comando.setString(7, conta.foto());
            return comando.executeUpdate() == 1;
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel criar a conta no banco", e);
        }
    }

    @Override
    public boolean atualizar(Conta conta) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("UPDATE contas SET email = ?, nick = ?, senha_hash = ?, admin = ?, foto = ? WHERE id = ?")) {
            comando.setString(1, conta.email());
            comando.setString(2, conta.nick());
            comando.setString(3, conta.senhaHash());
            comando.setBoolean(4, conta.admin());
            comando.setString(5, conta.foto());
            comando.setObject(6, conta.id());
            comando.executeUpdate();
            return true;
        } catch (SQLException e) {
            // e-mail que ja e de outra conta (indice unico)
            if ("23505".equals(e.getSQLState())) {
                return false;
            }
            throw new PersistenciaException("Nao foi possivel salvar a conta no banco", e);
        }
    }

    @Override
    public void excluir(UUID id) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("DELETE FROM contas WHERE id = ?")) {
            comando.setObject(1, id);
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel excluir a conta do banco", e);
        }
    }
}
