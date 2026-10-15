package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.Conta;

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
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Login que vale por 30 dias, guardado em um cookie do navegador.
 *
 * O cookie diz de qual conta e o login, ate quando vale, e leva uma assinatura que so o servidor sabe fazer, porque
 * depende de um segredo guardado no servidor. A assinatura tambem depende da senha guardada da conta: trocar a senha
 * desfaz todos os logins daquela conta, em qualquer aparelho.
 *
 * Formato: v2.{id da conta}.{expira em segundos}.{aleatorio}.{assinatura}. A versao do Vercel (api/_sessao.js) usa
 * o mesmo.
 */
final class Sessoes {
    static final String COOKIE = "mangas_sessao";
    static final Duration DURACAO = Duration.ofDays(30);
    private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();
    private static final SecureRandom ALEATORIO = new SecureRandom();
    private static final Pattern ID = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    private final byte[] segredo;
    private final Clock relogio;

    Sessoes(byte[] segredo, Clock relogio) {
        this.segredo = segredo.clone();
        this.relogio = relogio;
    }

    /** Um login novo da conta, que vale de agora ate daqui a 30 dias. */
    String criar(Conta conta) {
        byte[] aleatorio = new byte[16];
        ALEATORIO.nextBytes(aleatorio);
        String corpo = "v2." + conta.id() + "." + relogio.instant().plus(DURACAO).getEpochSecond() + "." + BASE64_URL.encodeToString(aleatorio);
        return corpo + "." + assinar(corpo, conta.senhaHash());
    }

    /** De qual conta e o cookie, sem conferir a assinatura (para buscar a conta e depois validar). */
    static Optional<UUID> contaDoCookie(String cookie) {
        if (cookie == null || cookie.length() > 300) {
            return Optional.empty();
        }
        String[] partes = cookie.split("\\.", -1);
        return partes.length == 5 && partes[0].equals("v2") && ID.matcher(partes[1]).matches() ? Optional.of(UUID.fromString(partes[1])) : Optional.empty();
    }

    /** Ate quando o login vale, se o cookie for verdadeiro, desta conta e ainda nao tiver vencido. */
    Optional<Instant> validar(String cookie, Conta conta) {
        if (conta == null || !contaDoCookie(cookie).map(conta.id()::equals).orElse(false)) {
            return Optional.empty();
        }
        String[] partes = cookie.split("\\.", -1);
        Instant expira;
        try {
            expira = Instant.ofEpochSecond(Long.parseLong(partes[2]));
        } catch (NumberFormatException | java.time.DateTimeException e) {
            return Optional.empty();
        }
        Instant agora = relogio.instant();
        // vencido, ou com uma validade maior do que o servidor daria
        if (!expira.isAfter(agora) || expira.isAfter(agora.plus(DURACAO).plusSeconds(60))) {
            return Optional.empty();
        }
        String corpo = partes[0] + "." + partes[1] + "." + partes[2] + "." + partes[3];
        boolean assinaturaCerta = MessageDigest.isEqual(
                assinar(corpo, conta.senhaHash()).getBytes(StandardCharsets.US_ASCII), partes[4].getBytes(StandardCharsets.US_ASCII));
        return assinaturaCerta ? Optional.of(expira) : Optional.empty();
    }

    private String assinar(String corpo, String senhaGuardada) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(segredo, "HmacSHA256"));
            String resumoDaSenha = BASE64_URL.encodeToString(sha256(senhaGuardada));
            return BASE64_URL.encodeToString(mac.doFinal((corpo + "." + resumoDaSenha).getBytes(StandardCharsets.UTF_8)));
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
