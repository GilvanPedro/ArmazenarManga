package br.com.seuapp.mangatracker.web;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Freia quem tenta adivinhar a senha: depois de muitas tentativas erradas, novos logins esperam um pouco.
 * O limite vale para o site inteiro, e nao por endereco de quem tenta, porque o endereco pode ser falsificado
 * atras da hospedagem. Como a conta e uma so, isso nao atrapalha o dono: quem ja entrou continua dentro.
 */
final class LimiteDeTentativas {
    static final int MAXIMO = 10;
    static final Duration JANELA = Duration.ofMinutes(15);

    private final Deque<Instant> erros = new ArrayDeque<>();
    private final Clock relogio;

    LimiteDeTentativas(Clock relogio) {
        this.relogio = relogio;
    }

    /** Quanto falta para poder tentar de novo; zero se pode tentar agora. */
    synchronized Duration espera() {
        Instant agora = relogio.instant();
        while (!erros.isEmpty() && !erros.peekFirst().isAfter(agora.minus(JANELA))) {
            erros.pollFirst();
        }
        return erros.size() < MAXIMO ? Duration.ZERO : Duration.between(agora, erros.peekFirst().plus(JANELA));
    }

    synchronized void registrarErro() {
        erros.addLast(relogio.instant());
    }
}
