package br.com.seuapp.mangatracker.web;

import br.com.seuapp.mangatracker.domain.Conta;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessoesTest {

    private static final Instant AGORA = Instant.parse("2026-10-14T12:00:00Z");
    private static final byte[] SEGREDO = new byte[32];
    private static final Conta CONTA = new Conta(UUID.fromString("0a1b2c3d-1111-4222-8333-444455556666"), "a@b.com", "A",
            "pbkdf2_sha256$1000$abc$def", false, AGORA);

    private static Sessoes sessoes(Instant agora, byte[] segredo) {
        return new Sessoes(segredo, Clock.fixed(agora, ZoneOffset.UTC));
    }

    @Test
    void oLoginValeTrintaDiasESoNelesMesmo() {
        String cookie = sessoes(AGORA, SEGREDO).criar(CONTA);

        assertEquals(Optional.of(CONTA.id()), Sessoes.contaDoCookie(cookie));
        assertEquals(Optional.of(AGORA.plus(Duration.ofDays(30))), sessoes(AGORA, SEGREDO).validar(cookie, CONTA));
        // desligar o computador nao importa: o que conta e a data
        assertTrue(sessoes(AGORA.plus(Duration.ofDays(29)), SEGREDO).validar(cookie, CONTA).isPresent());
        assertTrue(sessoes(AGORA.plus(Duration.ofDays(30)), SEGREDO).validar(cookie, CONTA).isEmpty());
        assertNotEquals(cookie, sessoes(AGORA, SEGREDO).criar(CONTA), "cada login e diferente");
    }

    @Test
    void cookieAlteradoDeOutraContaOuDeSenhaTrocadaNaoVale() {
        String cookie = sessoes(AGORA, SEGREDO).criar(CONTA);
        String[] partes = cookie.split("\\.");
        Conta outra = new Conta(UUID.randomUUID(), "c@d.com", "C", CONTA.senhaHash(), false, AGORA);
        byte[] outroSegredo = new byte[32];
        outroSegredo[31] = 1;

        assertTrue(sessoes(AGORA, outroSegredo).validar(cookie, CONTA).isEmpty());
        assertTrue(sessoes(AGORA, SEGREDO).validar(cookie, CONTA.comSenhaHash("pbkdf2_sha256$1000$abc$outra")).isEmpty(), "senha trocada");
        assertTrue(sessoes(AGORA, SEGREDO).validar(cookie, outra).isEmpty());
        // trocar a conta dentro do cookie invalida a assinatura
        String trocado = "v2." + outra.id() + "." + partes[2] + "." + partes[3] + "." + partes[4];
        assertTrue(sessoes(AGORA, SEGREDO).validar(trocado, outra).isEmpty());
        String esticado = "v2." + partes[1] + "." + (Long.parseLong(partes[2]) + 86_400) + "." + partes[3] + "." + partes[4];
        assertTrue(sessoes(AGORA, SEGREDO).validar(esticado, CONTA).isEmpty());
        for (String falso : new String[]{null, "", "v2", "v1." + partes[2] + "." + partes[3] + "." + partes[4], "v2." + CONTA.id() + ".abc.x.y", cookie + "x", "x".repeat(400)}) {
            assertTrue(sessoes(AGORA, SEGREDO).validar(falso, CONTA).isEmpty(), String.valueOf(falso));
        }
        assertTrue(Sessoes.contaDoCookie("v2.nao-e-id.1.x.y").isEmpty());
        assertTrue(sessoes(AGORA, SEGREDO).validar(sessoes(AGORA.plus(Duration.ofDays(10)), SEGREDO).criar(CONTA), CONTA).isEmpty());
    }

    @Test
    void assinaIgualAVersaoDoVercel() {
        // o mesmo exemplo esta em test-api/sessao.test.mjs: um login feito em uma versao vale na outra
        byte[] segredo = new byte[32];
        java.util.Arrays.fill(segredo, (byte) 1);
        String cookie = "v2.11111111-2222-4333-8444-555555555555.4102444800.AAAAAAAAAAAAAAAAAAAAAA.oQwgN_CtF6RKQTzy0nu1u-UVaASkKgBce3h6tPctVKU";
        Conta conta = new Conta(UUID.fromString("11111111-2222-4333-8444-555555555555"), "a@b.com", "A", "pbkdf2_sha256$1000$c2Fs$aGFzaA==", false, AGORA);
        Instant antes = Instant.ofEpochSecond(4102444800L).minus(Duration.ofDays(1));

        assertEquals(Optional.of(Instant.ofEpochSecond(4102444800L)), sessoes(antes, segredo).validar(cookie, conta));
    }
}
