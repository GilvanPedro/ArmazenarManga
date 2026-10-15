package br.com.seuapp.mangatracker.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * Freia quem tenta adivinhar senhas ou criar contas em massa: depois de um tanto de erros dentro de uma janela de
 * tempo, novas tentativas com a mesma chave (um e-mail, ou "" para o site inteiro) esperam a janela passar.
 * Fica na memoria: vale para este servidor.
 */
public final class LimiteDeTentativas {
    private final int maximo;
    private final Duration janela;
    private final Clock relogio;
    private final Map<String, Deque<Instant>> erros = new HashMap<>();

    public LimiteDeTentativas(int maximo, Duration janela, Clock relogio) {
        this.maximo = maximo;
        this.janela = janela;
        this.relogio = relogio;
    }

    /** Quanto falta para poder tentar de novo; zero se pode tentar agora. */
    public synchronized Duration espera(String chave) {
        Instant agora = relogio.instant();
        Deque<Instant> daChave = erros.get(chave);
        if (daChave == null) {
            return Duration.ZERO;
        }
        while (!daChave.isEmpty() && !daChave.peekFirst().isAfter(agora.minus(janela))) {
            daChave.pollFirst();
        }
        if (daChave.isEmpty()) {
            erros.remove(chave);
            return Duration.ZERO;
        }
        return daChave.size() < maximo ? Duration.ZERO : Duration.between(agora, daChave.peekFirst().plus(janela));
    }

    public synchronized void registrarErro(String chave) {
        erros.computeIfAbsent(chave, nova -> new ArrayDeque<>()).addLast(relogio.instant());
    }
}
