package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;
import br.com.seuapp.mangatracker.repository.ArquivoImagemRepository;
import br.com.seuapp.mangatracker.repository.ImagemRepository;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Recebe as capas enviadas pelo site, confere se sao imagens e guarda no {@link ImagemRepository}.
 * O imagePath do manga e o nome do arquivo devolvido por {@link #salvar}, ou uma URL http(s) de fora.
 */
public class ImagemService {

    public static final int TAMANHO_MAXIMO = 10 * 1024 * 1024;

    private static final Map<String, String> TIPOS = Map.of(
            "png", "image/png",
            "jpg", "image/jpeg",
            "gif", "image/gif",
            "webp", "image/webp"
    );
    // so nomes gerados aqui sao aceitos: impede "../" e afins. "-mini" e a miniatura de uma capa
    private static final Pattern NOME_VALIDO = Pattern.compile("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(-mini)?\\.(png|jpg|gif|webp)");
    private static final Pattern NOME_DE_CAPA = Pattern.compile("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.(png|jpg|gif|webp)");
    /** Miniaturas sao pequenas: a ideia e a lista carregar rapido. */
    public static final int TAMANHO_MAXIMO_DA_MINIATURA = 300 * 1024;
    private static final String FINAL_DA_MINIATURA = "-mini.webp";
    private static final String FINAL_DA_MINIATURA_JPG = "-mini.jpg";

    private final ImagemRepository repository;

    public ImagemService(ImagemRepository repository) {
        this.repository = Objects.requireNonNull(repository);
    }

    /** Guarda as imagens como arquivos na pasta informada. */
    public ImagemService(Path pasta) {
        this(new ArquivoImagemRepository(pasta));
    }

    /** Salva a imagem e devolve o nome que deve ser usado como imagePath do manga. */
    public String salvar(InputStream conteudo) {
        byte[] bytes;
        try {
            bytes = conteudo.readNBytes(TAMANHO_MAXIMO + 1);
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel receber a imagem", e);
        }
        if (bytes.length == 0) {
            throw new InvalidImageException("A imagem está vazia");
        }
        if (bytes.length > TAMANHO_MAXIMO) {
            throw new InvalidImageException("A imagem pode ter no máximo 10 MB");
        }
        String nome = UUID.randomUUID() + "." + descobrirExtensao(bytes);
        repository.salvar(nome, bytes);
        return nome;
    }

    /**
     * Guarda uma versao pequena da capa enviada, feita pelo navegador, para a lista mostrar no lugar da original.
     * A capa original nao muda. So vale para capas ja enviadas; a miniatura tem que ser WebP ou JPEG.
     *
     * @return o nome da miniatura
     */
    public String salvarMiniatura(String nomeDaCapa, byte[] bytes) {
        if (nomeDaCapa == null || !NOME_DE_CAPA.matcher(nomeDaCapa).matches() || !repository.existe(nomeDaCapa)) {
            throw new NotFoundException("Imagem não encontrada");
        }
        if (bytes == null || bytes.length == 0) {
            throw new InvalidImageException("A miniatura está vazia");
        }
        if (bytes.length > TAMANHO_MAXIMO_DA_MINIATURA) {
            throw new InvalidImageException("A miniatura pode ter no máximo 300 KB");
        }
        String extensao = descobrirExtensao(bytes);
        if (!extensao.equals("webp") && !extensao.equals("jpg")) {
            throw new InvalidImageException("A miniatura precisa ser WEBP ou JPG");
        }
        String base = nomeDaCapa.substring(0, nomeDaCapa.lastIndexOf('.'));
        // uma miniatura so por capa
        repository.excluir(base + (extensao.equals("webp") ? FINAL_DA_MINIATURA_JPG : FINAL_DA_MINIATURA));
        String nome = base + "-mini." + extensao;
        repository.salvar(nome, bytes);
        return nome;
    }

    /**
     * Miniaturas que existem para estas capas: nome da capa (sem extensao) -> nome da miniatura. Procura so pelos
     * nomes possiveis, entao o custo depende de quantas capas foram pedidas, e nao do total guardado.
     */
    public Map<String, String> miniaturas(java.util.Collection<String> imagePaths) {
        List<String> candidatas = new java.util.ArrayList<>();
        for (String capa : imagePaths) {
            if (capa != null && NOME_DE_CAPA.matcher(capa).matches()) {
                String base = capa.substring(0, capa.lastIndexOf('.'));
                candidatas.add(base + FINAL_DA_MINIATURA);
                candidatas.add(base + FINAL_DA_MINIATURA_JPG);
            }
        }
        Map<String, String> porCapa = new java.util.HashMap<>();
        for (String nome : repository.existentes(candidatas)) {
            porCapa.put(nome.substring(0, nome.lastIndexOf("-mini.")), nome);
        }
        return porCapa;
    }

    /** Endereco da miniatura de uma capa enviada, ou null se ainda nao houver (ou se a capa for um link de fora). */
    public static String enderecoDaMiniatura(String imagePath, Map<String, String> miniaturas) {
        if (imagePath == null || !NOME_DE_CAPA.matcher(imagePath).matches()) {
            return null;
        }
        String nome = miniaturas.get(imagePath.substring(0, imagePath.lastIndexOf('.')));
        return nome == null ? null : "/api/imagens/" + nome;
    }

    /** Apaga todas as capas da conta atual (ao excluir a conta). */
    public void excluirTodas() {
        repository.excluirTodas();
    }

    /** Traz para a conta atual as capas de outra conta. */
    public void trazerDe(String outraConta) {
        repository.trazerDe(outraConta);
    }

    public byte[] carregar(String nome) {
        if (!nomeValido(nome)) {
            throw new NotFoundException("Imagem não encontrada");
        }
        return repository.buscar(nome).orElseThrow(() -> new NotFoundException("Imagem não encontrada"));
    }

    public boolean existe(String nome) {
        return nomeValido(nome) && repository.existe(nome);
    }

    private static boolean nomeValido(String nome) {
        return nome != null && NOME_VALIDO.matcher(nome).matches();
    }

    public String tipoDeConteudo(String nome) {
        return TIPOS.get(nome.substring(nome.lastIndexOf('.') + 1));
    }

    /** O imagePath precisa ser uma URL http(s) ou uma imagem ja enviada. */
    public void verificarReferencia(String imagePath) {
        if (!ChapterLink.isUrlHttp(imagePath) && !existe(imagePath)) {
            throw new InvalidImageException("A imagem informada não existe. Envie a imagem antes de salvar o mangá");
        }
    }

    /** Apaga a imagem enviada. URLs de fora e nomes desconhecidos sao ignorados. */
    public void excluir(String imagePath) {
        if (nomeValido(imagePath)) {
            repository.excluir(imagePath);
            String base = imagePath.substring(0, imagePath.lastIndexOf('.'));
            repository.excluir(base + FINAL_DA_MINIATURA);
            repository.excluir(base + FINAL_DA_MINIATURA_JPG);
        }
    }

    private static String descobrirExtensao(byte[] bytes) {
        if (comecaCom(bytes, 0, new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})) {
            return "png";
        }
        if (comecaCom(bytes, 0, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})) {
            return "jpg";
        }
        if (comecaCom(bytes, 0, "GIF87a".getBytes(StandardCharsets.US_ASCII))
                || comecaCom(bytes, 0, "GIF89a".getBytes(StandardCharsets.US_ASCII))) {
            return "gif";
        }
        if (comecaCom(bytes, 0, "RIFF".getBytes(StandardCharsets.US_ASCII))
                && comecaCom(bytes, 8, "WEBP".getBytes(StandardCharsets.US_ASCII))) {
            return "webp";
        }
        throw new InvalidImageException("Formato de imagem não suportado. Use PNG, JPG, GIF ou WEBP");
    }

    private static boolean comecaCom(byte[] bytes, int posicao, byte[] assinatura) {
        if (bytes.length < posicao + assinatura.length) {
            return false;
        }
        for (int i = 0; i < assinatura.length; i++) {
            if (bytes[posicao + i] != assinatura[i]) {
                return false;
            }
        }
        return true;
    }
}
