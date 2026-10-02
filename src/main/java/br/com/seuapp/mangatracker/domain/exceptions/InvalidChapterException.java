package br.com.seuapp.mangatracker.domain.exceptions;

public class InvalidChapterException extends RuntimeException {
    public InvalidChapterException(String message) {
        super(message);
    }
}
