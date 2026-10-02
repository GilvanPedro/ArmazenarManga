package br.com.seuapp.mangatracker.repository;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.util.DefaultIndenter;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;

import java.io.IOException;

/**
 * Deixa o JSON com indentacao de 2 espacos, cada item de array em uma linha,
 * "chave": valor (sem espaco antes dos dois-pontos) e [] para listas vazias.
 */
class PrettyPrinterBonito extends DefaultPrettyPrinter {

    PrettyPrinterBonito() {
        DefaultIndenter indentacao = new DefaultIndenter("  ", DefaultIndenter.SYS_LF);
        indentObjectsWith(indentacao);
        indentArraysWith(indentacao);
    }

    private PrettyPrinterBonito(PrettyPrinterBonito base) {
        super(base);
    }

    @Override
    public DefaultPrettyPrinter createInstance() {
        return new PrettyPrinterBonito(this);
    }

    @Override
    public void writeObjectFieldValueSeparator(JsonGenerator g) throws IOException {
        g.writeRaw(": ");
    }

    @Override
    public void writeEndArray(JsonGenerator g, int quantidade) throws IOException {
        if (quantidade == 0) {
            if (!_arrayIndenter.isInline()) {
                _nesting--;
            }
            g.writeRaw(']');
        } else {
            super.writeEndArray(g, quantidade);
        }
    }
}
