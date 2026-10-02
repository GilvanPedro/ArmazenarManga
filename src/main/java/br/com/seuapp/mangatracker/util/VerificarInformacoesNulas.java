package br.com.seuapp.mangatracker.util;

import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidChapterException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import br.com.seuapp.mangatracker.domain.exceptions.NullInformationsException;

import java.math.BigDecimal;

public class VerificarInformacoesNulas {

    /** Lanca excecao se faltar algum dos campos obrigatorios do manga. */
    public static void verificar(String title, String imagePath, String chapterLinkModel, BigDecimal lastChapter, ReadingStatus readingStatus){
        if(title == null || title.isBlank()){
            throw new NullInformationsException("O título é obrigatório");
        }
        if(imagePath == null || imagePath.isBlank()){
            throw new NullInformationsException("A imagem é obrigatória");
        }
        if(chapterLinkModel == null || chapterLinkModel.isBlank()){
            throw new InvalidLinkException("Verifique se você preencheu o link corretamente");
        }
        if(lastChapter == null){
            throw new NullInformationsException("O último capítulo lido é obrigatório");
        }
        verificarCapitulo(lastChapter);
        if(readingStatus == null){
            throw new NullInformationsException("O status é obrigatório");
        }
    }

    public static void verificarCapitulo(BigDecimal lastChapter){
        if(lastChapter.compareTo(BigDecimal.ZERO) < 0){
            throw new InvalidChapterException("O capítulo não pode ser negativo");
        }
    }
}
