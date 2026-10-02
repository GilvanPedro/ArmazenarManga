package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** Leva para o banco o que ja estava salvo em arquivos (mangas.json e pasta imagens). */
public final class ImportacaoDeArquivos {

    private ImportacaoDeArquivos() {
    }

    /**
     * So importa se o banco ainda nao tem nenhum manga, para nunca sobrescrever o que ja esta la.
     * Os arquivos continuam onde estavam.
     *
     * @return quantos mangas foram importados
     */
    public static int importarSeBancoVazio(Path pasta, MangaRepository mangasDoBanco, ImagemRepository imagensDoBanco) {
        Path arquivo = pasta.resolve("mangas.json");
        if (Files.notExists(arquivo) || !mangasDoBanco.listarTodos().isEmpty()) {
            return 0;
        }
        List<Manga> mangas = new JsonMangaRepository(arquivo).listarTodos();
        ImagemRepository imagensDaPasta = new ArquivoImagemRepository(pasta.resolve("imagens"));
        for (Manga manga : mangas) {
            String imagem = manga.getImagePath();
            // capas que sao links de fora nao tem arquivo para copiar
            if (imagem != null && imagem.matches("[0-9a-f-]{36}\\.[a-z]+")) {
                imagensDaPasta.buscar(imagem).ifPresent(conteudo -> imagensDoBanco.salvar(imagem, conteudo));
            }
            mangasDoBanco.salvar(manga);
        }
        return mangas.size();
    }
}
