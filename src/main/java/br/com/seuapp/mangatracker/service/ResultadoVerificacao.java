package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.Manga;

/**
 * Resultado de conferir no site o link do proximo capitulo.
 *
 * @param linkMudou      o site trocou o endereco (id do link) e o cadastro foi corrigido
 * @param linkAnterior   link do proximo capitulo antes da verificacao
 * @param manga          o manga ja com as correcoes salvas
 */
public record ResultadoVerificacao(SituacaoDoLink situacao, boolean linkMudou, String linkAnterior, String mensagem, Manga manga) {
}
