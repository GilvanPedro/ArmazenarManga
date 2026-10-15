package br.com.seuapp.mangatracker.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SenhasTest {

    @Test
    void aSenhaEGuardadaSoComoHashComSal() {
        String hash = Senhas.gerar("sênha6", 1000);

        assertTrue(hash.matches("pbkdf2_sha256\\$1000\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+"), hash);
        assertFalse(hash.contains("sênha6"));
        assertNotEquals(hash, Senhas.gerar("sênha6", 1000), "sal diferente a cada vez");
        assertTrue(Senhas.confere("sênha6", hash));
        assertFalse(Senhas.confere("senha6", hash));
        assertFalse(Senhas.confere(null, hash));
        for (String estragado : new String[]{null, "", "texto", "pbkdf2_sha256$0$a$b", "pbkdf2_sha256$x$a$b", "md5$1000$a$b", "pbkdf2_sha256$1000$!!$b"}) {
            assertFalse(Senhas.confere("sênha6", estragado), String.valueOf(estragado));
        }
    }

    @Test
    void confereHashesFeitosPelaVersaoDoVercel() {
        // o mesmo exemplo esta em test-api/contas.test.mjs
        assertTrue(Senhas.confere("sênha6", "pbkdf2_sha256$1000$c2FsLWZpeG8tMTZieXRlcw==$Z/s+59UH7LjjIAIhkZA3KMio0qymOImjmjidPWZdky4="));
    }

    @Test
    void limiteFreiaCadaChaveSeparadaDepoisDeTantosErros() {
        Instant[] agora = {Instant.parse("2026-10-14T12:00:00Z")};
        Instant inicio = agora[0];
        Clock relogio = new Clock() {
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            public Clock withZone(ZoneId zona) { return this; }
            public Instant instant() { return agora[0]; }
        };
        LimiteDeTentativas limite = new LimiteDeTentativas(10, Duration.ofMinutes(15), relogio);
        for (int i = 0; i < 9; i++) {
            limite.registrarErro("a@b.com");
            agora[0] = agora[0].plusSeconds(10);
        }
        assertEquals(Duration.ZERO, limite.espera("a@b.com"));
        limite.registrarErro("a@b.com");
        assertEquals(Duration.ofMinutes(15).minusSeconds(90), limite.espera("a@b.com"));
        assertEquals(Duration.ZERO, limite.espera("outro@b.com"), "cada e-mail tem a sua conta");

        agora[0] = inicio.plus(Duration.ofMinutes(15)).plusSeconds(1); // o primeiro erro saiu da janela
        assertEquals(Duration.ZERO, limite.espera("a@b.com"));
    }
}
