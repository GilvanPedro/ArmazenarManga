package br.com.seuapp.mangatracker.repository;

import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.OrdemDaLista;
import br.com.seuapp.mangatracker.domain.ReadingStatus;

import java.text.Normalizer;
import java.util.Locale;

/**
 * O que a lista pede: filtros (todos opcionais), a ordem e o pedaco da lista.
 *
 * @param titulo       parte do titulo, sem diferenciar maiusculas nem acentos
 * @param tags         nomes exatos de tags, sem diferenciar maiusculas nem acentos: o manga precisa ter todas
 * @param limite       quantos mangas no maximo; null = todos
 * @param deslocamento quantos pular do comeco
 */
public record ConsultaDeMangas(String titulo, ReadingStatus status, java.util.List<String> tags, OrdemDaLista ordem, Integer limite, int deslocamento) {

    public ConsultaDeMangas {
        ordem = ordem == null ? OrdemDaLista.CADASTRO : ordem;
        deslocamento = Math.max(0, deslocamento);
        tags = tags == null ? java.util.List.of() : tags.stream().map(ConsultaDeMangas::normalizar).filter(tag -> !tag.isEmpty()).distinct().toList();
    }

    /** Com uma tag so (ou nenhuma, com null). */
    public static ConsultaDeMangas todos(String titulo, ReadingStatus status, String tag, OrdemDaLista ordem) {
        return todos(titulo, status, tag == null ? java.util.List.of() : java.util.List.of(tag), ordem);
    }

    public static ConsultaDeMangas todos(String titulo, ReadingStatus status, java.util.List<String> tags, OrdemDaLista ordem) {
        return new ConsultaDeMangas(titulo, status, tags, ordem, null, 0);
    }

    /** A mesma consulta, so com outro pedaco da lista. */
    public ConsultaDeMangas pedaco(Integer limite, int deslocamento) {
        return new ConsultaDeMangas(titulo, status, tags, ordem, limite, deslocamento);
    }

    /** O manga passa nos filtros? (usado quando a lista e filtrada em memoria) */
    public boolean aceita(Manga manga) {
        String busca = normalizar(titulo);

        return (status == null || manga.getReadingStatus() == status)
                && normalizar(manga.getTitle()).contains(busca)
                && tags.stream().allMatch(tag -> manga.getTags() != null && manga.getTags().stream().anyMatch(outra -> normalizar(outra.getNome()).equals(tag)));
    }

    /** Minusculas e sem acentos, igual a coluna titulo_busca do banco e ao servidor do Vercel. */
    public static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }
}
