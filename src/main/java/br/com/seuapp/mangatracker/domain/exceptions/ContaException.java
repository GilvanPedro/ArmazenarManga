package br.com.seuapp.mangatracker.domain.exceptions;

/** Recusa ligada a contas e login. O status e o da resposta HTTP (400, 401, 403, 409 ou 429). */
public class ContaException extends RuntimeException {
    private final int status;

    public ContaException(int status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
