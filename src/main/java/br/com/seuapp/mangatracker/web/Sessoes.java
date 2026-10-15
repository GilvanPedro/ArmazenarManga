package br.com.seuapp.mangatracker.web;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Login que vale por 30 dias, guardado em um cookie do navegador.
 *
 * O cookie leva ate quando o login vale e uma assinatura que so o servidor sabe fazer, porque depende de um
 * segredo guardado no servidor. Assim nao e preciso guardar as sessoes em lugar nenhum, o que funciona igual no
 * Java e na versao do Vercel. A assinatura tambem depende do usuario e da senha: trocar a senha desfaz todos os
 * logins, em qualquer aparelho.
 *
 * Formato: v1.{expira em segundos}.{aleatorio}.{assinatura}. A versao do Vercel (api/_sessao.js) usa o mesmo.
 */
final class Sessoes {
    static final String COOKIE = "mangas_sessao";
    static final Duration DURACAO = Duration.ofDays(30);
    private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final byte[] segredo;
    private final String resumoDoLogin;
    private final Clock relogio;

    Sessoes(String usuario, String senha, byte[] segredo, Clock relogio) {
        this.segredo = segredo.clone();
        this.resumoDoLogin = BASE64_URL.encodeToString(sha256(usuario + "\n" + senha));
        this.relogio = relogio;
    }

    /** Um login novo, que vale de agora ate daqui a 30 dias. */
    String criar() {
        byte[] aleatorio = new byte[16];
        ALEATORIO.nextBytes(aleatorio);
        String corpo = "v1." + relogio.instant().plus(DURACAO).getEpochSecond() + "." + BASE64_URL.encodeToString(aleatorio);
        return corpo + "." + assinar(corpo);
    }

    /** Ate quando o login vale, se o cookie for verdadeiro e ainda nao tiver vencido. */
    Optional<Instant> validar(String cookie) {
        if (cookie == null || cookie.length() > 200) {
            return Optional.empty();
        }
        String[] partes = cookie.split("\\.", -1);
        if (partes.length != 4 || !partes[0].equals("v1")) {
            return Optional.empty();
        }
        Instant expira;
        try {
            expira = Instant.ofEpochSecond(Long.parseLong(partes[1]));
        } catch (NumberFormatException | java.time.DateTimeException e) {
            return Optional.empty();
        }
        Instant agora = relogio.instant();
        // vencido, ou com uma validade maior do que o servidor daria
        if (!expira.isAfter(agora) || expira.isAfter(agora.plus(DURACAO).plusSeconds(60))) {
            return Optional.empty();
        }
        String corpo = partes[0] + "." + partes[1] + "." + partes[2];
        boolean assinaturaCerta = MessageDigest.isEqual(
                assinar(corpo).getBytes(StandardCharsets.US_ASCII), partes[3].getBytes(StandardCharsets.US_ASCII));
        return assinaturaCerta ? Optional.of(expira) : Optional.empty();
    }

    private String assinar(String corpo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(segredo, "HmacSHA256"));
            return BASE64_URL.encodeToString(mac.doFinal((corpo + "." + resumoDoLogin).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static byte[] sha256(String texto) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
