package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidImageException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.PersistenciaException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Guarda as capas enviadas pelo site em uma pasta.
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
    // so nomes gerados aqui sao aceitos: impede "../" e afins
    private static final Pattern NOME_VALIDO = Pattern.compile("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.(png|jpg|gif|webp)");

    private final Path pasta;

    public ImagemService(Path pasta) {
        this.pasta = Objects.requireNonNull(pasta);
    }

    /** Salva a imagem e devolve o nome que deve ser usado como imagePath do manga. */
    public String salvar(InputStream conteudo) {
        try {
            byte[] bytes = conteudo.readNBytes(TAMANHO_MAXIMO + 1);
            if (bytes.length == 0) {
                throw new InvalidImageException("A imagem está vazia");
            }
            if (bytes.length > TAMANHO_MAXIMO) {
                throw new InvalidImageException("A imagem pode ter no máximo 10 MB");
            }
            String nome = UUID.randomUUID() + "." + descobrirExtensao(bytes);
            Files.createDirectories(pasta);
            Files.write(pasta.resolve(nome), bytes);
            return nome;
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel salvar a imagem em " + pasta, e);
        }
    }

    public Path localizar(String nome) {
        if (!existe(nome)) {
            throw new NotFoundException("Imagem não encontrada");
        }
        return pasta.resolve(nome);
    }

    public boolean existe(String nome) {
        return nome != null && NOME_VALIDO.matcher(nome).matches() && Files.isRegularFile(pasta.resolve(nome));
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
        if (!existe(imagePath)) {
            return;
        }
        try {
            Files.deleteIfExists(pasta.resolve(imagePath));
        } catch (IOException e) {
            throw new PersistenciaException("Nao foi possivel excluir a imagem " + imagePath, e);
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
