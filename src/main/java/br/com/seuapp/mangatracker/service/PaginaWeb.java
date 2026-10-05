package br.com.seuapp.mangatracker.service;

/**
 * Resposta de um site ao abrir um endereco.
 *
 * @param status   codigo HTTP final, ou 0 quando nao deu para abrir (sem resposta, endereco recusado...)
 * @param urlFinal endereco em que a pagina realmente abriu, depois dos redirecionamentos
 * @param html     conteudo da pagina (vazio quando nao e HTML ou nao abriu)
 */
public record PaginaWeb(int status, String urlFinal, String html) {

    public static PaginaWeb semResposta(String endereco) {
        return new PaginaWeb(0, endereco, "");
    }

    public boolean abriu() {
        return status >= 200 && status < 300;
    }

    public boolean naoExiste() {
        return status == 404 || status == 410;
    }
}
