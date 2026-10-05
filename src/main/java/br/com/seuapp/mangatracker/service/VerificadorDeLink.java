package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.math.BigDecimal;
import java.net.URI;
import java.util.regex.Pattern;

/**
 * Confere no proprio site se o link do proximo capitulo esta certo: abre a pagina do ultimo capitulo
 * lido, procura nela o link para o proximo e confirma que ele abre. Serve para qualquer site, porque
 * nao depende do formato de nenhum deles; so do HTML da pagina e dos redirecionamentos.
 *
 * Cobre os dois jeitos de um site "trocar o id" do link:
 * - o id da obra muda (.../obra-3ec3b16f/chapter/174 passa a ser .../obra-bd5bdaf8/chapter/174):
 *   o modelo do link e corrigido e continua valendo para os proximos capitulos;
 * - cada capitulo tem um id proprio (.../chapter-175-zz9): nao existe modelo que sirva, entao
 *   o endereco exato do proximo capitulo e guardado.
 */
public class VerificadorDeLink {

    private static final Pattern DICA_DE_PROXIMO = Pattern.compile(
            "(?i)\\b(next|pr[oó]xim[oa]|siguiente|seguinte|suivant|avan[cç]ar)\\b");

    private final BuscadorDePaginas buscador;

    public VerificadorDeLink(BuscadorDePaginas buscador) {
        this.buscador = buscador;
    }

    /**
     * @param situacao         o que foi encontrado no site
     * @param chapterLinkModel modelo do link a usar daqui para frente (o mesmo do manga se nada mudou)
     * @param nextChapterUrl   endereco exato do proximo capitulo quando o modelo nao serve para ele; senao null
     */
    public record Verificacao(SituacaoDoLink situacao, String chapterLinkModel, String nextChapterUrl) {
    }

    public Verificacao verificar(Manga manga) {
        ChapterDecimalFormat formato = manga.getDecimalFormat();
        BigDecimal ultimo = manga.getLastChapter();
        BigDecimal proximo = manga.proximoCapitulo();
        String modelo = manga.getChapterLinkModel();
        String proximoExato = null;
        String encontrado = null;

        // 1) abre a pagina do ultimo capitulo lido
        PaginaWeb atual = buscador.buscar(manga.linkUltimoCapitulo());
        boolean atualAbriu = atual.abriu();
        if (atualAbriu && manga.getLastChapterUrl() == null && !ChapterLink.mesmoEndereco(atual.urlFinal(), manga.linkUltimoCapitulo())) {
            // o site redirecionou: ou o id da obra mudou, ou o capitulo nao existe e caiu em outra pagina
            String novoModelo = ChapterLink.derivarModelo(atual.urlFinal(), ultimo, formato);
            if (novoModelo == null) {
                atualAbriu = false;
            } else {
                modelo = novoModelo;
            }
        }

        // 2) procura na pagina o link para o proximo capitulo
        if (atualAbriu) {
            encontrado = acharLinkDoProximo(atual, ChapterLink.montar(modelo, formato, proximo), proximo, formato);
        }
        if (encontrado != null && !ChapterLink.mesmoEndereco(encontrado, ChapterLink.montar(modelo, formato, proximo))) {
            String novoModelo = ChapterLink.derivarModelo(encontrado, proximo, formato);
            boolean valeParaOAtual = novoModelo != null
                    && ChapterLink.mesmoEndereco(ChapterLink.montar(novoModelo, formato, ultimo), atual.urlFinal());
            if (valeParaOAtual) {
                modelo = novoModelo;
            } else {
                proximoExato = encontrado; // id proprio de cada capitulo: so da para guardar o endereco exato
            }
        }

        // 3) confirma que o link do proximo capitulo realmente abre
        String linkDoProximo = proximoExato != null ? proximoExato : ChapterLink.montar(modelo, formato, proximo);
        PaginaWeb pagina = buscador.buscar(linkDoProximo);
        boolean proximoAbriu = pagina.abriu();
        if (proximoAbriu && proximoExato == null && !ChapterLink.mesmoEndereco(pagina.urlFinal(), linkDoProximo)) {
            String novoModelo = ChapterLink.derivarModelo(pagina.urlFinal(), proximo, formato);
            if (novoModelo == null) {
                proximoAbriu = false; // abriu outra coisa (pagina inicial, pagina da obra...): o capitulo nao existe
            } else {
                modelo = novoModelo;
            }
        }

        // "nao existe" inclui o caso em que o site respondeu, mas com outra pagina no lugar do capitulo
        boolean proximoNaoExiste = pagina.naoExiste() || (pagina.abriu() && !proximoAbriu);
        boolean atualNaoExiste = atual.naoExiste() || (atual.abriu() && !atualAbriu);
        SituacaoDoLink situacao;
        if (proximoAbriu) {
            situacao = SituacaoDoLink.DISPONIVEL;
        } else if (!proximoNaoExiste) {
            situacao = SituacaoDoLink.NAO_VERIFICADO; // sem resposta ou bloqueado
        } else if (atualNaoExiste && ultimo.signum() > 0) {
            // (o capitulo 0 normalmente nao existe, entao ele nao prova que o link esta errado)
            situacao = SituacaoDoLink.LINK_QUEBRADO;
        } else {
            situacao = SituacaoDoLink.NAO_ENCONTRADO;
        }
        if (situacao != SituacaoDoLink.DISPONIVEL) {
            proximoExato = null;
        }
        return new Verificacao(situacao, modelo, proximoExato);
    }

    /** Escolhe, entre os links da pagina, o que mais parece ser o do proximo capitulo. */
    private static String acharLinkDoProximo(PaginaWeb atual, String esperado, BigDecimal proximo, ChapterDecimalFormat formato) {
        if (atual.html().isBlank()) {
            return null;
        }
        Document documento = Jsoup.parse(atual.html(), atual.urlFinal());
        URI paginaAtual = URI.create(atual.urlFinal());
        String melhor = null;
        int melhorNota = 0;
        for (Element elemento : documento.select("link[href], a[href]")) {
            String endereco = elemento.absUrl("href");
            int nota = notaDoLink(elemento, endereco, paginaAtual, esperado, proximo, formato);
            if (nota > melhorNota) {
                melhorNota = nota;
                melhor = semFragmento(endereco);
            }
        }
        return melhor;
    }

    /** Quanto maior, mais certeza de que o link leva ao proximo capitulo desta obra. Zero = nao serve. */
    private static int notaDoLink(Element elemento, String endereco, URI paginaAtual, String esperado, BigDecimal proximo, ChapterDecimalFormat formato) {
        if (!ChapterLink.isUrlHttp(endereco) || ChapterLink.mesmoEndereco(endereco, paginaAtual.toString())) {
            return 0;
        }
        URI destino;
        try {
            destino = URI.create(endereco);
        } catch (IllegalArgumentException e) {
            return 0;
        }
        if (destino.getHost() == null || !destino.getHost().equalsIgnoreCase(paginaAtual.getHost())) {
            return 0;
        }
        boolean relNext = (" " + elemento.attr("rel").toLowerCase() + " ").contains(" next ");
        boolean temONumero = ChapterLink.derivarModelo(endereco, proximo, formato) != null;
        boolean ehLink = elemento.tagName().equals("a");
        String rotulo = elemento.text() + " " + elemento.attr("title") + " " + elemento.attr("aria-label")
                + " " + elemento.className().replace('-', ' ').replace('_', ' ') + " " + elemento.id().replace('-', ' ').replace('_', ' ');
        boolean dica = ehLink && DICA_DE_PROXIMO.matcher(rotulo).find();
        boolean mesmaObra = caminhoParecido(paginaAtual.getPath(), destino.getPath());

        boolean dizProximo = ehLink && DICA_DE_PROXIMO.matcher(
                elemento.text() + " " + elemento.attr("title") + " " + elemento.attr("aria-label")).find();

        if (ChapterLink.mesmoEndereco(endereco, esperado)) return 100; // exatamente o que o modelo previa
        if (relNext && temONumero) return 95;
        if (temONumero && dica && mesmaObra) return 90;
        if (temONumero && mesmaObra) return 80;
        if (temONumero && dica) return 70; // o id da obra pode ter mudado no meio do endereco
        if (relNext) return 60;
        // sem o numero no endereco (id proprio por capitulo): so vale um link que diga "proximo"
        if (dizProximo && mesmaObra) return 40;
        return 0;
    }

    /** Os dois caminhos comecam iguais em pelo menos metade do caminho da pagina atual (mesma obra, outro capitulo). */
    private static boolean caminhoParecido(String atual, String outro) {
        if (atual == null || outro == null) {
            return false;
        }
        int iguais = 0;
        while (iguais < atual.length() && iguais < outro.length() && atual.charAt(iguais) == outro.charAt(iguais)) {
            iguais++;
        }
        return iguais > 1 && iguais * 2 >= atual.length();
    }

    private static String semFragmento(String endereco) {
        int posicao = endereco.indexOf('#');
        return posicao < 0 ? endereco : endereco.substring(0, posicao);
    }
}
