package br.com.seuapp.mangatracker.domain.exceptions;

public class InvalidLinkException extends RuntimeException {
    public InvalidLinkException(String message) {
        super(message);
    }
}
