package br.com.seuapp.mangatracker.domain.exceptions;

public class NullInformationsException extends RuntimeException {
    public NullInformationsException() {
        super("Verifique se você preencheu todas as informações!");
    }

    public NullInformationsException(String message) {
        super(message);
    }
}
