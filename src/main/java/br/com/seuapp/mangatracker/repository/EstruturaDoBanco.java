package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Cria e atualiza as tabelas. So acrescenta (colunas, indices), nunca apaga: roda igual em um banco novo e em um
 * que ja tem dados. E a mesma estrutura que a versao do Vercel cria (api/index.js), porque as duas podem usar o
 * mesmo banco.
 *
 * Cada manga e cada capa pertencem a uma conta ("conta"), a de quem esta usando ({@link ContaAtual}). A
 * {@link #CONTA_PRINCIPAL} e a de antes do cadastro de contas: os mangas dela esperam ser trazidos para uma conta.
 */
public final class EstruturaDoBanco {
    public static final String CONTA_PRINCIPAL = "principal";

    private static final String[] COMANDOS = {
            "CREATE TABLE IF NOT EXISTS mangas (id UUID PRIMARY KEY, ordem BIGSERIAL, dados JSONB NOT NULL)",
            "CREATE TABLE IF NOT EXISTS imagens (nome TEXT PRIMARY KEY, conteudo BYTEA NOT NULL)",
            "ALTER TABLE mangas ADD COLUMN IF NOT EXISTS conta TEXT NOT NULL DEFAULT 'principal'",
            "ALTER TABLE mangas ADD COLUMN IF NOT EXISTS titulo_busca TEXT",
            "ALTER TABLE mangas ADD COLUMN IF NOT EXISTS tags_busca TEXT[]",
            "ALTER TABLE imagens ADD COLUMN IF NOT EXISTS conta TEXT NOT NULL DEFAULT 'principal'",
            "CREATE INDEX IF NOT EXISTS mangas_conta_ordem ON mangas (conta, ordem)",
            "CREATE INDEX IF NOT EXISTS mangas_conta_titulo ON mangas (conta, titulo_busca COLLATE \"C\")",
            "CREATE INDEX IF NOT EXISTS mangas_conta_status ON mangas (conta, (dados->>'readingStatus'))",
            "CREATE INDEX IF NOT EXISTS mangas_conta_imagem ON mangas (conta, (dados->>'imagePath'))",
            "CREATE INDEX IF NOT EXISTS mangas_tags_busca ON mangas USING GIN (tags_busca)",
            "CREATE TABLE IF NOT EXISTS contas (id UUID PRIMARY KEY, email TEXT NOT NULL, nick TEXT NOT NULL, senha_hash TEXT NOT NULL, "
                    + "admin BOOLEAN NOT NULL DEFAULT false, criada_em TIMESTAMPTZ NOT NULL DEFAULT now())",
            "CREATE UNIQUE INDEX IF NOT EXISTS contas_email ON contas (email)",
            "ALTER TABLE contas ADD COLUMN IF NOT EXISTS foto TEXT",
            "CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)",
            "CREATE TABLE IF NOT EXISTS tentativas_de_login (quando TIMESTAMPTZ NOT NULL DEFAULT now())",
            "ALTER TABLE tentativas_de_login ADD COLUMN IF NOT EXISTS chave TEXT NOT NULL DEFAULT ''",
            "CREATE INDEX IF NOT EXISTS tentativas_chave ON tentativas_de_login (chave, quando)",
    };

    private EstruturaDoBanco() {
    }

    /** A trava garante que dois servidores nao facam isso ao mesmo tempo. */
    public static void preparar(DataSource banco) {
        try (Connection conexao = banco.getConnection()) {
            boolean automatico = conexao.getAutoCommit();
            conexao.setAutoCommit(false);
            try (Statement comando = conexao.createStatement()) {
                comando.execute("SELECT pg_advisory_xact_lock(7316250)");
                for (String sql : COMANDOS) {
                    comando.execute(sql);
                }
                conexao.commit();
            } catch (SQLException e) {
                conexao.rollback();
                throw e;
            } finally {
                conexao.setAutoCommit(automatico);
            }
            preencherColunasDeBusca(conexao);
        } catch (SQLException e) {
            throw new PersistenciaException("Nao foi possivel preparar as tabelas do banco", e);
        }
    }

    /** Mangas gravados antes das colunas de busca existirem ganham as colunas preenchidas (uma vez, 500 por vez). */
    private static void preencherColunasDeBusca(Connection conexao) throws SQLException {
        ObjectMapper mapper = JsonMapper.builder().build();
        for (;;) {
            List<Map<String, Object>> lote = new ArrayList<>();
            try (Statement comando = conexao.createStatement();
                 ResultSet linhas = comando.executeQuery("SELECT id, dados->>'title' AS titulo, dados->'tags' AS tags FROM mangas WHERE titulo_busca IS NULL LIMIT 500")) {
                while (linhas.next()) {
                    List<String> tags = new ArrayList<>();
                    String json = linhas.getString("tags");
                    if (json != null) {
                        try {
                            for (Object tag : mapper.readValue(json, List.class)) {
                                tags.add(String.valueOf(tag));
                            }
                        } catch (Exception e) {
                            // tags estragadas: o manga fica sem tags de busca
                        }
                    }
                    lote.add(Map.of("id", linhas.getString("id"), "titulo", tituloDeBusca(linhas.getString("titulo")), "tags", tagsDeBusca(tags)));
                }
            }
            if (lote.isEmpty()) {
                return;
            }
            try (PreparedStatement comando = conexao.prepareStatement(
                    "UPDATE mangas SET titulo_busca = v.titulo, tags_busca = ARRAY(SELECT jsonb_array_elements_text(v.tags)) "
                            + "FROM jsonb_to_recordset(?::jsonb) AS v (id uuid, titulo text, tags jsonb) WHERE mangas.id = v.id")) {
                comando.setString(1, mapper.writeValueAsString(lote));
                comando.executeUpdate();
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                throw new SQLException(e);
            }
        }
    }

    static String tituloDeBusca(String titulo) {
        return ConsultaDeMangas.normalizar(titulo);
    }

    static List<String> tagsDeBusca(List<String> tags) {
        LinkedHashSet<String> unicas = new LinkedHashSet<>();
        for (String tag : tags) {
            String normal = ConsultaDeMangas.normalizar(tag);
            if (!normal.isEmpty()) {
                unicas.add(normal);
            }
        }
        return List.copyOf(unicas);
    }
}
