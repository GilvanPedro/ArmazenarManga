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
    private final java.util.function.Supplier<String> conta;

    /** Os dados da conta de quem esta usando ({@link ContaAtual}). */
    public PostgresImagemRepository(DataSource banco) {
        this.banco = Objects.requireNonNull(banco);
        this.conta = ContaAtual::obter;
        EstruturaDoBanco.preparar(banco);
    }

    /** @param conta de quem sao as capas: so as dela sao lidas, gravadas e apagadas */
    public PostgresImagemRepository(DataSource banco, String conta) {
        this.banco = Objects.requireNonNull(banco);
        Objects.requireNonNull(conta);
        this.conta = () -> conta;
        EstruturaDoBanco.preparar(banco);
    }

    @Override
    public void salvar(String nome, byte[] conteudo) {
        String sql = """
                INSERT INTO imagens (nome, conteudo, conta) VALUES (?, ?, ?)
                ON CONFLICT (nome) DO UPDATE SET conteudo = EXCLUDED.conteudo WHERE imagens.conta = EXCLUDED.conta""";
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            comando.setString(1, nome);
            comando.setString(2, conta.get());
            comando.setBytes(2, conteudo);
            comando.setString(3, conta.get());
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel salvar a imagem no banco", e);
        }
    }

    @Override
    public Optional<byte[]> buscar(String nome) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT conteudo FROM imagens WHERE nome = ? AND conta = ?")) {
            comando.setString(1, nome);
            comando.setString(2, conta.get());
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
             PreparedStatement comando = conexao.prepareStatement("SELECT 1 FROM imagens WHERE nome = ? AND conta = ?")) {
            comando.setString(1, nome);
            comando.setString(2, conta.get());
            try (ResultSet linhas = comando.executeQuery()) {
                return linhas.next();
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel consultar a imagem no banco", e);
        }
    }

    @Override
    public void excluirTodas() {
        executar("DELETE FROM imagens WHERE conta = ?", conta.get());
    }

    @Override
    public void trazerDe(String outraConta) {
        executar("UPDATE imagens SET conta = ? WHERE conta = ?", conta.get(), outraConta);
    }

    private void executar(String sql, String... valores) {
        try (Connection conexao = banco.getConnection(); PreparedStatement comando = conexao.prepareStatement(sql)) {
            for (int i = 0; i < valores.length; i++) {
                comando.setString(i + 1, valores[i]);
            }
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel alterar as imagens no banco", e);
        }
    }

    @Override
    public java.util.Set<String> existentes(java.util.Collection<String> nomes) {
        if (nomes.isEmpty()) {
            return java.util.Set.of();
        }
        // so os nomes, pela chave da tabela: o custo depende de quantos foram pedidos, e nao do total guardado
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("SELECT nome FROM imagens WHERE nome = ANY(?) AND conta = ?")) {
            comando.setArray(1, conexao.createArrayOf("text", nomes.toArray()));
            comando.setString(2, conta.get());
            java.util.Set<String> encontrados = new java.util.HashSet<>();
            try (ResultSet linhas = comando.executeQuery()) {
                while (linhas.next()) {
                    encontrados.add(linhas.getString(1));
                }
            }
            return encontrados;
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel consultar as imagens no banco", e);
        }
    }

    @Override
    public void excluir(String nome) {
        try (Connection conexao = banco.getConnection();
             PreparedStatement comando = conexao.prepareStatement("DELETE FROM imagens WHERE nome = ? AND conta = ?")) {
            comando.setString(1, nome);
            comando.setString(2, conta.get());
            comando.executeUpdate();
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel excluir a imagem do banco", e);
        }
    }
}
