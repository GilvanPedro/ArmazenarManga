package br.com.seuapp.mangatracker.service;

/** O que a verificacao descobriu sobre o proximo capitulo no site. */
public enum SituacaoDoLink {
    /** O link do proximo capitulo abre. */
    DISPONIVEL,
    /** O capitulo atual abre, mas o proximo nao existe no site (provavelmente ainda nao saiu). */
    NAO_ENCONTRADO,
    /** Nem o capitulo atual nem o proximo abrem: o link cadastrado parece errado. */
    LINK_QUEBRADO,
    /** O site nao respondeu ou bloqueia verificacoes automaticas. */
    NAO_VERIFICADO
}
