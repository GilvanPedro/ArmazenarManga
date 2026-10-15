package br.com.seuapp.mangatracker;

import br.com.seuapp.mangatracker.repository.BancoPostgres;
import br.com.seuapp.mangatracker.repository.ImportacaoDeArquivos;
import br.com.seuapp.mangatracker.repository.MangaRepository;
import br.com.seuapp.mangatracker.repository.PostgresImagemRepository;
import br.com.seuapp.mangatracker.repository.PostgresMangaRepository;
import br.com.seuapp.mangatracker.service.BuscadorHttp;
import br.com.seuapp.mangatracker.service.ClienteHttpPadrao;
import br.com.seuapp.mangatracker.service.ImagemService;
import br.com.seuapp.mangatracker.service.MangaService;
import br.com.seuapp.mangatracker.service.RecomendacaoService;
import br.com.seuapp.mangatracker.service.SinopseService;
import br.com.seuapp.mangatracker.service.VerificadorDeLink;
import br.com.seuapp.mangatracker.web.ApiServer;
import br.com.seuapp.mangatracker.repository.ArquivoContaRepository;
import br.com.seuapp.mangatracker.repository.ArquivoImagemRepositoryPorConta;
import br.com.seuapp.mangatracker.repository.ContaRepository;
import br.com.seuapp.mangatracker.repository.JsonMangaRepositoryPorConta;
import br.com.seuapp.mangatracker.repository.PostgresContaRepository;
import br.com.seuapp.mangatracker.repository.SegredoDaSessao;
import br.com.seuapp.mangatracker.service.ContaService;

import javax.sql.DataSource;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

public class App {
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
        // MANGATRACKER_ADMIN_EMAIL (opcional): e-mails das contas de administracao, separados por virgula. So elas veem e
        // trazem, pela pagina "Minha conta", os mangas cadastrados antes das contas existirem
        List<String> emailsAdmin = Arrays.asList(System.getenv().getOrDefault("MANGATRACKER_ADMIN_EMAIL", "").split(","));
        // MANGATRACKER_CORS: enderecos de outros sites que podem chamar a API, separados por virgula
        List<String> origens = Arrays.stream(System.getenv().getOrDefault("MANGATRACKER_CORS", "").split(","))
                .map(String::trim)
                .filter(origem -> !origem.isEmpty())
                .toList();

        boolean soEsteComputador = Set.of("127.0.0.1", "localhost", "::1").contains(host);

        MangaRepository repository;
        DataSource banco = null;
        ImagemService imagemService;
        ContaRepository contas;
        // DATABASE_URL: endereco de um Postgres (postgresql://usuario:senha@servidor/banco).
        // Sem ele, tudo fica em arquivos na pasta acima.
        String enderecoDoBanco = System.getenv().getOrDefault("DATABASE_URL", "").trim();
        if (enderecoDoBanco.isEmpty()) {
            // uma pasta por conta; a conta antiga continua em mangas.json e imagens/
            repository = new JsonMangaRepositoryPorConta(pasta);
            imagemService = new ImagemService(new ArquivoImagemRepositoryPorConta(pasta));
            contas = new ArquivoContaRepository(pasta.resolve("contas.json"));
            System.out.println("Dados salvos em arquivos na pasta " + pasta.toAbsolutePath());
        } else {
            banco = BancoPostgres.conectar(enderecoDoBanco);
            PostgresImagemRepository imagensDoBanco = new PostgresImagemRepository(banco);
            repository = new PostgresMangaRepository(banco);
            imagemService = new ImagemService(imagensDoBanco);
            contas = new PostgresContaRepository(banco);
            System.out.println("Dados salvos no banco Postgres");
            int importados = ImportacaoDeArquivos.importarSeBancoVazio(pasta, repository, imagensDoBanco);
            if (importados > 0) {
                System.out.println(importados + " mangá(s) de " + pasta.toAbsolutePath() + " copiado(s) para o banco");
            }
        }
        MangaService mangaService = new MangaService(repository, imagemService, new VerificadorDeLink(new BuscadorHttp()));
        // MANGATRACKER_SEGREDO (opcional, 32+ caracteres): assina os cookies de login. Sem ele, um segredo e criado
        // sozinho e guardado junto dos dados, para o login continuar valendo depois de reiniciar
        byte[] segredo = SegredoDaSessao.doTexto(System.getenv("MANGATRACKER_SEGREDO"));
        if (segredo == null) {
            segredo = banco != null ? SegredoDaSessao.doBanco(banco) : SegredoDaSessao.doArquivo(pasta.resolve("segredo-da-sessao"));
        }
        ApiServer.Acesso acesso = new ApiServer.Acesso(new ContaService(contas, mangaService, imagemService, emailsAdmin), segredo);

        ClienteHttpPadrao internet = new ClienteHttpPadrao();
        new ApiServer(mangaService, imagemService, origens, acesso, new SinopseService(internet), new RecomendacaoService(internet)).criar().start(host, porta);
        System.out.println("Meus Mangás aberto em http://localhost:" + porta + " (crie uma conta na primeira vez)");
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
