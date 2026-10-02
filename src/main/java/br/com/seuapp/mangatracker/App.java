package br.com.seuapp.mangatracker;

import br.com.seuapp.mangatracker.repository.JsonMangaRepository;
import br.com.seuapp.mangatracker.repository.MangaRepository;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.MangaService;
import br.com.seuapp.mangatracker.web.ApiServer;
import br.com.seuapp.mangatracker.web.ApiServer.Credenciais;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

public class App {
    private static final int SENHA_MINIMA = 12;

    static void main(String[] args) {
        // MANGATRACKER_DIR: onde ficam o mangas.json e as imagens (padrao ~/.mangatracker)
        String pastaConfigurada = System.getenv("MANGATRACKER_DIR");
        Path pasta = pastaConfigurada == null || pastaConfigurada.isBlank()
                ? Path.of(System.getProperty("user.home"), ".mangatracker")
                : Path.of(pastaConfigurada);
        // PORT: porta do site (padrao 7070)
        int porta = Integer.parseInt(System.getenv().getOrDefault("PORT", "7070"));
        // MANGATRACKER_HOST: 127.0.0.1 (padrao) atende so este computador; 0.0.0.0 atende outros computadores
        String host = System.getenv().getOrDefault("MANGATRACKER_HOST", "127.0.0.1").trim();
        // MANGATRACKER_USUARIO e MANGATRACKER_SENHA: login pedido pelo navegador
        String usuario = System.getenv().getOrDefault("MANGATRACKER_USUARIO", "manga");
        String senha = System.getenv().getOrDefault("MANGATRACKER_SENHA", "");
        // MANGATRACKER_CORS: enderecos de outros sites que podem chamar a API, separados por virgula
        List<String> origens = Arrays.stream(System.getenv().getOrDefault("MANGATRACKER_CORS", "").split(","))
                .map(String::trim)
                .filter(origem -> !origem.isEmpty())
                .toList();

        boolean soEsteComputador = Set.of("127.0.0.1", "localhost", "::1").contains(host);
        if (!soEsteComputador && senha.length() < SENHA_MINIMA) {
            System.err.println("Para aceitar conexões de outros computadores (MANGATRACKER_HOST=" + host
                    + ") defina em MANGATRACKER_SENHA uma senha com pelo menos " + SENHA_MINIMA + " caracteres."
                    + " Sem uma senha forte, qualquer pessoa poderia apagar seus mangás.");
            System.exit(1);
        }

        MangaRepository repository = new JsonMangaRepository(pasta.resolve("mangas.json"));
        ImagemService imagemService = new ImagemService(pasta.resolve("imagens"));
        MangaService mangaService = new MangaService(repository, imagemService);
        Credenciais credenciais = senha.isBlank() ? null : new Credenciais(usuario, senha);

        new ApiServer(mangaService, imagemService, origens, credenciais).criar().start(host, porta);
        System.out.println("Meus Mangás aberto em http://localhost:" + porta
                + (credenciais == null ? "" : " (usuário: " + usuario + ")"));
        if (!soEsteComputador) {
            enderecosNaRede().forEach(endereco ->
                    System.out.println("Em outros computadores da rede: http://" + endereco + ":" + porta));
        }
    }

    private static List<String> enderecosNaRede() {
        try {
            return NetworkInterface.networkInterfaces()
                    .flatMap(NetworkInterface::inetAddresses)
                    .filter(InetAddress::isSiteLocalAddress)
                    .map(InetAddress::getHostAddress)
                    .toList();
        } catch (SocketException e) {
            return List.of();
        }
    }
}
