package br.com.seuapp.mangatracker.domain.exceptions;

public class InvalidReleaseDayException extends RuntimeException {
    public InvalidReleaseDayException(String message) {
        super(message);
    }
}
