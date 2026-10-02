package br.com.seuapp.mangatracker.domain;

import java.time.DayOfWeek;

/** Dia da semana em que o manga costuma lancar capitulo novo. */
public enum WeekDay {
    SEGUNDA("Segunda-feira"),
    TERCA("Terça-feira"),
    QUARTA("Quarta-feira"),
    QUINTA("Quinta-feira"),
    SEXTA("Sexta-feira"),
    SABADO("Sábado"),
    DOMINGO("Domingo");

    private String descricao;

    WeekDay(String descricao) {
        this.descricao = descricao;
    }

    public String getDescricao() {
        return descricao;
    }

    public static WeekDay de(DayOfWeek dia) {
        // os dois comecam na segunda-feira
        return values()[dia.ordinal()];
    }
}
