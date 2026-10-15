package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Base64;

/**
 * Segredo usado para assinar os cookies de login. E criado sozinho na primeira vez e guardado junto dos dados:
 * no banco, quando ha um (o mesmo que a versao do Vercel le, para um login valer nas duas), ou em um arquivo.
 * Apagar o segredo desfaz todos os logins.
 */
public final class SegredoDaSessao {
    static final String CHAVE = "segredo-da-sessao";
    private static final int TAMANHO = 32;

    private SegredoDaSessao() {
    }

    public static byte[] doArquivo(Path arquivo) {
        try {
            if (Files.exists(arquivo)) {
                byte[] lido = decodificar(Files.readString(arquivo));
                if (lido != null) {
                    return lido;
                }
            }
            byte[] novo = gerar();
            Files.createDirectories(arquivo.toAbsolutePath().getParent());
            Files.writeString(arquivo, Base64.getEncoder().encodeToString(novo));
            try {
                Files.setPosixFilePermissions(arquivo, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException e) {
                // Windows: fica com as permissoes da pasta
            }
            return novo;
        } catch (IOException e) {
            throw new PersistenciaException("Não foi possível guardar o segredo do login em " + arquivo, e);
        }
    }

    public static byte[] doBanco(DataSource banco) {
        try (Connection conexao = banco.getConnection()) {
            try (Statement comando = conexao.createStatement()) {
                comando.execute("CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)");
            }
            // se dois servidores criarem ao mesmo tempo, fica o primeiro
            try (PreparedStatement inserir = conexao.prepareStatement(
                    "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO NOTHING")) {
                inserir.setString(1, CHAVE);
                inserir.setString(2, Base64.getEncoder().encodeToString(gerar()));
                inserir.executeUpdate();
            }
            try (PreparedStatement ler = conexao.prepareStatement("SELECT valor FROM configuracoes WHERE chave = ?")) {
                ler.setString(1, CHAVE);
                try (ResultSet linha = ler.executeQuery()) {
                    byte[] segredo = linha.next() ? decodificar(linha.getString(1)) : null;
                    if (segredo == null) {
                        throw new PersistenciaException("O segredo do login guardado no banco está estragado");
                    }
                    return segredo;
                }
            }
        } catch (SQLException e) {
            throw new PersistenciaException("Não foi possível ler o segredo do login no banco", e);
        }
    }

    /** Segredo vindo da variavel MANGATRACKER_SEGREDO, para quem prefere definir um; null se for curto demais. */
    public static byte[] doTexto(String texto) {
        return texto == null || texto.trim().length() < TAMANHO ? null : texto.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static byte[] gerar() {
        byte[] segredo = new byte[TAMANHO];
        new SecureRandom().nextBytes(segredo);
        return segredo;
    }

    private static byte[] decodificar(String texto) {
        try {
            byte[] segredo = Base64.getDecoder().decode(texto.trim());
            return segredo.length >= TAMANHO ? segredo : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
