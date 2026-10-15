package br.com.seuapp.mangatracker.repository;

import java.nio.file.Path;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Capas em arquivos (uso sem banco), uma pasta por conta: a conta antiga continua em {pasta}/imagens, e cada conta
 * tem a sua em {pasta}/contas/{id}/imagens. Cada operacao vai para a pasta da conta atual.
 */
public class ArquivoImagemRepositoryPorConta implements ImagemRepository {
    private final Path pasta;
    private final Map<String, ArquivoImagemRepository> porConta = new ConcurrentHashMap<>();

    public ArquivoImagemRepositoryPorConta(Path pasta) {
        this.pasta = Objects.requireNonNull(pasta);
    }

    private ArquivoImagemRepository daConta(String conta) {
        // so ids de conta (e a conta antiga) viram pasta: nada de "../"
        String segura = conta.equals(EstruturaDoBanco.CONTA_PRINCIPAL) || conta.matches("[0-9a-f-]{36}") ? conta : "nenhuma";
        return porConta.computeIfAbsent(segura, nome -> new ArquivoImagemRepository(
                nome.equals("nenhuma") ? pasta.resolve("contas").resolve("nenhuma") : JsonMangaRepositoryPorConta.pastaDaConta(pasta, nome).resolve("imagens")));
    }

    private ArquivoImagemRepository atual() {
        return daConta(ContaAtual.obter());
    }

    @Override
    public void salvar(String nome, byte[] conteudo) {
        atual().salvar(nome, conteudo);
    }

    @Override
    public Optional<byte[]> buscar(String nome) {
        return atual().buscar(nome);
    }

    @Override
    public boolean existe(String nome) {
        return atual().existe(nome);
    }

    @Override
    public void excluir(String nome) {
        atual().excluir(nome);
    }

    @Override
    public Set<String> existentes(Collection<String> nomes) {
        return atual().existentes(nomes);
    }

    @Override
    public void excluirTodas() {
        atual().excluirTodas();
    }

    @Override
    public void trazerDe(String outraConta) {
        if (!outraConta.equals(ContaAtual.obter())) {
            daConta(outraConta).moverPara(atual());
        }
    }
}
