package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterLink;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/**
 * Abre paginas de verdade pela internet.
 * Como o endereco vem do cadastro do manga, so aceita sites publicos: um link apontando para
 * a rede interna do servidor (localhost, 10.x, 192.168.x, metadados da nuvem...) e recusado,
 * inclusive quando o site de fora tenta redirecionar para la.
 */
public class BuscadorHttp implements BuscadorDePaginas {

    private static final int MAXIMO_DE_BYTES = 2 * 1024 * 1024;
    private static final int MAXIMO_DE_REDIRECIONAMENTOS = 5;
    private static final Duration TEMPO_LIMITE = Duration.ofSeconds(8);
    private static final Set<Integer> REDIRECIONAMENTOS = Set.of(301, 302, 303, 307, 308);
    // alguns sites recusam quem nao se parece com um navegador
    private static final String NAVEGADOR = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER) // cada salto e conferido aqui
            .build();
    private final boolean permitirRedeLocal;

    public BuscadorHttp() {
        this(false);
    }

    /** @param permitirRedeLocal so para testes, que usam um site falso em 127.0.0.1 */
    BuscadorHttp(boolean permitirRedeLocal) {
        this.permitirRedeLocal = permitirRedeLocal;
    }

    @Override
    public PaginaWeb buscar(String endereco) {
        try {
            URI destino = URI.create(endereco.trim());
            for (int salto = 0; salto <= MAXIMO_DE_REDIRECIONAMENTOS; salto++) {
                if (!destinoPermitido(destino)) {
                    return PaginaWeb.semResposta(endereco);
                }
                HttpRequest requisicao = HttpRequest.newBuilder(destino)
                        .timeout(TEMPO_LIMITE)
                        .header("User-Agent", NAVEGADOR)
                        .header("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5")
                        .header("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8")
                        .GET()
                        .build();
                HttpResponse<InputStream> resposta = http.send(requisicao, HttpResponse.BodyHandlers.ofInputStream());
                try (InputStream corpo = resposta.body()) {
                    String proximo = resposta.headers().firstValue("Location").orElse(null);
                    if (REDIRECIONAMENTOS.contains(resposta.statusCode()) && proximo != null) {
                        destino = destino.resolve(proximo.trim());
                        continue;
                    }
                    return new PaginaWeb(resposta.statusCode(), destino.toString(), lerHtml(resposta, corpo));
                }
            }
            return PaginaWeb.semResposta(endereco); // redirecionamentos demais
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return PaginaWeb.semResposta(endereco);
        } catch (IOException | RuntimeException e) {
            return PaginaWeb.semResposta(endereco);
        }
    }

    private static String lerHtml(HttpResponse<InputStream> resposta, InputStream corpo) throws IOException {
        String tipo = resposta.headers().firstValue("Content-Type").orElse("").toLowerCase();
        if (!tipo.contains("html")) {
            return "";
        }
        byte[] bytes = corpo.readNBytes(MAXIMO_DE_BYTES);
        return new String(bytes, descobrirCodificacao(tipo));
    }

    private static Charset descobrirCodificacao(String tipo) {
        int posicao = tipo.indexOf("charset=");
        if (posicao >= 0) {
            try {
                return Charset.forName(tipo.substring(posicao + 8).split(";")[0].replace("\"", "").trim());
            } catch (RuntimeException e) {
                // codificacao desconhecida: cai no padrao
            }
        }
        return StandardCharsets.UTF_8;
    }

    boolean destinoPermitido(URI destino) {
        if (!ChapterLink.isUrlHttp(destino.toString())) {
            return false;
        }
        if (permitirRedeLocal) {
            return true;
        }
        int porta = destino.getPort();
        if (porta != -1 && porta != 80 && porta != 443) {
            return false;
        }
        try {
            // o Java guarda esta consulta por alguns segundos, entao a conexao logo abaixo usa o mesmo endereco conferido
            for (InetAddress ip : InetAddress.getAllByName(destino.getHost())) {
                if (!enderecoPublico(ip)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    private static boolean enderecoPublico(InetAddress ip) {
        if (ip.isLoopbackAddress() || ip.isAnyLocalAddress() || ip.isLinkLocalAddress()
                || ip.isSiteLocalAddress() || ip.isMulticastAddress()) {
            return false;
        }
        byte[] b = ip.getAddress();
        if (ip instanceof Inet4Address) {
            int primeiro = b[0] & 0xFF;
            int segundo = b[1] & 0xFF;
            boolean redeDeOperadora = primeiro == 100 && segundo >= 64 && segundo <= 127; // 100.64.0.0/10
            return primeiro != 0 && !redeDeOperadora && primeiro < 224;
        }
        if (ip instanceof Inet6Address) {
            return (b[0] & 0xFE) != 0xFC; // fc00::/7, a faixa privada do IPv6
        }
        return false;
    }
}
