package br.com.seuapp.mangatracker.repository;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.net.URI;

/** Abre as conexoes com o Postgres a partir do endereco que os servicos de banco entregam (DATABASE_URL). */
public final class BancoPostgres {

    private BancoPostgres() {
    }

    /**
     * @param url postgresql://usuario:senha@servidor/banco?sslmode=require (formato do Neon, Supabase, Render...)
     *            ou jdbc:postgresql://... ja no formato do Java
     */
    public static HikariDataSource conectar(String url) {
        HikariConfig config = new HikariConfig();
        if (url.startsWith("jdbc:")) {
            config.setJdbcUrl(url);
        } else {
            URI uri = URI.create(url.trim());
            if (uri.getHost() == null) {
                throw new IllegalArgumentException("DATABASE_URL inválida: use postgresql://usuario:senha@servidor/banco");
            }
            config.setJdbcUrl("jdbc:postgresql://" + uri.getHost()
                    + (uri.getPort() > 0 ? ":" + uri.getPort() : "")
                    + uri.getRawPath()
                    + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery()));
            String login = uri.getUserInfo();
            if (login != null) {
                int separador = login.indexOf(':');
                config.setUsername(separador < 0 ? login : login.substring(0, separador));
                if (separador >= 0) {
                    config.setPassword(login.substring(separador + 1));
                }
            }
        }
        // poucas conexoes e nenhuma parada: bancos gratuitos limitam conexoes e dormem quando ficam sem uso
        config.setMaximumPoolSize(4);
        config.setMinimumIdle(0);
        config.setIdleTimeout(60_000);
        config.setMaxLifetime(600_000);
        config.setConnectionTimeout(30_000);
        return new HikariDataSource(config);
    }
}
