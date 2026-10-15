package br.com.seuapp.mangatracker.web;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessoesTest {

    private static final Instant AGORA = Instant.parse("2026-10-14T12:00:00Z");
    private static final byte[] SEGREDO = new byte[32];

    private static Sessoes sessoes(Instant agora, String senha, byte[] segredo) {
        return new Sessoes("manga", senha, segredo, Clock.fixed(agora, ZoneOffset.UTC));
    }

    @Test
    void oLoginValeTrintaDiasESoNelesMesmo() {
        String cookie = sessoes(AGORA, "senha", SEGREDO).criar();

        assertEquals(Optional.of(AGORA.plus(Duration.ofDays(30))), sessoes(AGORA, "senha", SEGREDO).validar(cookie));
        // desligar o computador nao importa: o que conta e a data
        assertTrue(sessoes(AGORA.plus(Duration.ofDays(29)), "senha", SEGREDO).validar(cookie).isPresent());
        assertTrue(sessoes(AGORA.plus(Duration.ofDays(30)), "senha", SEGREDO).validar(cookie).isEmpty());
        assertNotEquals(cookie, sessoes(AGORA, "senha", SEGREDO).criar(), "cada login e diferente");
    }

    @Test
    void cookieAlteradoOuDeOutroSegredoOuSenhaNaoVale() {
        String cookie = sessoes(AGORA, "senha", SEGREDO).criar();
        String[] partes = cookie.split("\\.");
        byte[] outroSegredo = new byte[32];
        outroSegredo[31] = 1;

        assertTrue(sessoes(AGORA, "senha", outroSegredo).validar(cookie).isEmpty());
        assertTrue(sessoes(AGORA, "outra senha", SEGREDO).validar(cookie).isEmpty());
        // esticar a validade invalida a assinatura
        String esticado = "v1." + (Long.parseLong(partes[1]) + 86_400) + "." + partes[2] + "." + partes[3];
        assertTrue(sessoes(AGORA, "senha", SEGREDO).validar(esticado).isEmpty());
        for (String falso : new String[]{null, "", "v1", "v2." + partes[1] + "." + partes[2] + "." + partes[3], "v1.abc.x.y", "v1.1.x.y.z", cookie + "x", "x".repeat(300)}) {
            assertTrue(sessoes(AGORA, "senha", SEGREDO).validar(falso).isEmpty(), String.valueOf(falso));
        }
    }

    @Test
    void validadeMaiorQueTrintaDiasNaoValeMesmoAssinada() {
        // um cookie assinado la na frente (relogio adiantado) nao pode durar mais que 30 dias a partir de agora
        String doFuturo = sessoes(AGORA.plus(Duration.ofDays(10)), "senha", SEGREDO).criar();
        assertTrue(sessoes(AGORA, "senha", SEGREDO).validar(doFuturo).isEmpty());
    }

    @Test
    void assinaIgualAVersaoDoVercel() {
        // o mesmo exemplo esta em test-api/sessao.test.mjs: um login feito em uma versao vale na outra
        byte[] segredo = new byte[32];
        java.util.Arrays.fill(segredo, (byte) 1);
        String cookie = "v1.4102444800.AAAAAAAAAAAAAAAAAAAAAA.o-xRWlGWdm-0f59GWX_zwLhpGESpksXB9Hhk7vwO1MQ";
        Instant antes = Instant.ofEpochSecond(4102444800L).minus(Duration.ofDays(1));

        assertEquals(Optional.of(Instant.ofEpochSecond(4102444800L)), new Sessoes("manga", "sênha-de-teste", segredo, Clock.fixed(antes, ZoneOffset.UTC)).validar(cookie));
    }

    @Test
    void limiteFreiaDepoisDeDezErrosEmQuinzeMinutos() {
        Instant[] agora = {AGORA};
        Clock relogio = new Clock() {
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId zona) { return this; }
            public Instant instant() { return agora[0]; }
        };
        LimiteDeTentativas limite = new LimiteDeTentativas(relogio);
        for (int i = 0; i < 9; i++) {
            limite.registrarErro();
            agora[0] = agora[0].plusSeconds(10);
        }
        assertEquals(Duration.ZERO, limite.espera());
        limite.registrarErro();
        assertEquals(Duration.ofMinutes(15).minusSeconds(90), limite.espera());

        agora[0] = AGORA.plus(Duration.ofMinutes(15)).plusSeconds(1); // o primeiro erro saiu da janela
        assertEquals(Duration.ZERO, limite.espera());
    }
}
