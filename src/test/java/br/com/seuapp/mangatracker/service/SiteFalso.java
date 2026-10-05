package br.com.seuapp.mangatracker.service;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Um site de manga de mentira, rodando em 127.0.0.1, para testar a verificacao de link sem internet. */
public class SiteFalso implements AutoCloseable {

    private record Resposta(int status, String corpo, String destino) {
    }

    private final HttpServer servidor;
    private final Map<String, Resposta> paginas = new HashMap<>();
    private final List<String> visitas = new ArrayList<>();
    private int statusPadrao = 404;

    public SiteFalso() throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/", troca -> {
            String caminho = troca.getRequestURI().getRawPath();
            synchronized (this) {
                visitas.add(caminho);
            }
            Resposta resposta = paginas.getOrDefault(caminho, new Resposta(statusPadrao, "<html><title>Page Not Found</title></html>", null));
            byte[] corpo = resposta.corpo().getBytes(StandardCharsets.UTF_8);
            troca.getResponseHeaders().add("Content-Type", "text/html; charset=utf-8");
            if (resposta.destino() != null) {
                troca.getResponseHeaders().add("Location", resposta.destino());
            }
            troca.sendResponseHeaders(resposta.status(), corpo.length == 0 ? -1 : corpo.length);
            if (corpo.length > 0) {
                troca.getResponseBody().write(corpo);
            }
            troca.close();
        });
        servidor.start();
    }

    /** Endereco completo de um caminho do site: url("/a") -> http://127.0.0.1:PORTA/a */
    public String url(String caminho) {
        return "http://127.0.0.1:" + servidor.getAddress().getPort() + caminho;
    }

    public SiteFalso pagina(String caminho, String html) {
        paginas.put(caminho, new Resposta(200, "<html><body>" + html + "</body></html>", null));
        return this;
    }

    public SiteFalso redireciona(String caminho, String destino) {
        paginas.put(caminho, new Resposta(302, "", destino));
        return this;
    }

    public SiteFalso responde(String caminho, int status) {
        paginas.put(caminho, new Resposta(status, "<html>" + status + "</html>", null));
        return this;
    }

    /** Status de tudo que nao foi cadastrado (404 por padrao). */
    public SiteFalso restoResponde(int status) {
        statusPadrao = status;
        return this;
    }

    public synchronized List<String> visitas() {
        return List.copyOf(visitas);
    }

    @Override
    public void close() {
        servidor.stop(0);
    }
}
