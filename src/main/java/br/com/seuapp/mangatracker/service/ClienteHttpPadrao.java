package br.com.seuapp.mangatracker.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Chamadas de verdade aos servicos publicos usados pelo {@link SinopseService}. */
public class ClienteHttpPadrao implements SinopseService.ClienteHttp {

    // esses servicos pedem que cada programa se identifique
    private static final String IDENTIFICACAO = "MeusMangas/1.0 (rastreador pessoal de leitura; github.com/GilvanPedro/ArmazenarManga)";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Override
    public String get(String endereco) {
        return enviar(pedido(endereco).GET().build());
    }

    @Override
    public String postJson(String endereco, String corpo) {
        return enviar(pedido(endereco).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(corpo)).build());
    }

    private static HttpRequest.Builder pedido(String endereco) {
        return HttpRequest.newBuilder(URI.create(endereco))
                .timeout(Duration.ofSeconds(6))
                .header("User-Agent", IDENTIFICACAO)
                .header("Accept", "application/json");
    }

    private String enviar(HttpRequest pedido) {
        try {
            HttpResponse<String> resposta = http.send(pedido, HttpResponse.BodyHandlers.ofString());
            return resposta.statusCode() == 200 ? resposta.body() : null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
