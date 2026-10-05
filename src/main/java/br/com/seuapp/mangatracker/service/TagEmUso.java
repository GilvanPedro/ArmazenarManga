package br.com.seuapp.mangatracker.service;

/**
 * Uma tag da lista geral.
 *
 * @param quantidade em quantos mangas ela esta; 0 para as tags sugeridas que ainda nao foram usadas
 */
public record TagEmUso(String nome, int quantidade) {
}
