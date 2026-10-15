package br.com.seuapp.mangatracker.repository;

import java.util.function.Supplier;

/**
 * De qual conta sao os dados lidos e gravados nesta requisicao. O servidor web define no comeco de cada requisicao,
 * depois de conferir o login, e os repositorios leem daqui. Assim nenhuma consulta esquece de filtrar pela conta.
 *
 * Fora de uma requisicao (ao iniciar o programa, nos testes de repositorio) vale a conta antiga ("principal"). Dentro
 * de uma requisicao sem login vale {@link #NENHUMA}, que nao bate com conta nenhuma.
 */
public final class ContaAtual {
    /** Nao e o id de nenhuma conta: consultas com ela nao acham nada. */
    public static final String NENHUMA = "sem-conta";
    private static final ThreadLocal<String> CONTA = new ThreadLocal<>();

    private ContaAtual() {
    }

    public static String obter() {
        String conta = CONTA.get();
        return conta == null ? EstruturaDoBanco.CONTA_PRINCIPAL : conta;
    }

    public static void definir(String conta) {
        CONTA.set(conta);
    }

    public static void limpar() {
        CONTA.remove();
    }

    /** Faz algo como outra conta e depois volta para a de antes. */
    public static <T> T com(String conta, Supplier<T> acao) {
        String antes = CONTA.get();
        CONTA.set(conta);
        try {
            return acao.get();
        } finally {
            if (antes == null) {
                CONTA.remove();
            } else {
                CONTA.set(antes);
            }
        }
    }
}
