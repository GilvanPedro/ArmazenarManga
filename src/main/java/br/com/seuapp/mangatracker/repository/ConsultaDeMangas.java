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
 * @param tag          nome exato de uma tag, sem diferenciar maiusculas nem acentos
 * @param limite       quantos mangas no maximo; null = todos
 * @param deslocamento quantos pular do comeco
 */
public record ConsultaDeMangas(String titulo, ReadingStatus status, String tag, OrdemDaLista ordem, Integer limite, int deslocamento) {

    public ConsultaDeMangas {
        ordem = ordem == null ? OrdemDaLista.CADASTRO : ordem;
        deslocamento = Math.max(0, deslocamento);
    }

    public static ConsultaDeMangas todos(String titulo, ReadingStatus status, String tag, OrdemDaLista ordem) {
        return new ConsultaDeMangas(titulo, status, tag, ordem, null, 0);
    }

    /** A mesma consulta, so com outro pedaco da lista. */
    public ConsultaDeMangas pedaco(Integer limite, int deslocamento) {
        return new ConsultaDeMangas(titulo, status, tag, ordem, limite, deslocamento);
    }

    /** O manga passa nos filtros? (usado quando a lista e filtrada em memoria) */
    public boolean aceita(Manga manga) {
        String busca = normalizar(titulo);
        String tagBuscada = normalizar(tag);
        return (status == null || manga.getReadingStatus() == status)
                && normalizar(manga.getTitle()).contains(busca)
                && (tagBuscada.isEmpty() || (manga.getTags() != null && manga.getTags().stream().anyMatch(outra -> normalizar(outra.getNome()).equals(tagBuscada))));
    }

    /** Minusculas e sem acentos, igual a coluna titulo_busca do banco e ao servidor do Vercel. */
    public static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }
}
