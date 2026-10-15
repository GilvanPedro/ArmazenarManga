package br.com.seuapp.mangatracker.service;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Senhas guardadas so como hash: PBKDF2 com SHA-256 e sal aleatorio, no formato
 * pbkdf2_sha256${iteracoes}${sal}${hash} (sal e hash em base64). E o mesmo da versao do Vercel (api/_contas.js).
 */
public final class Senhas {
    /** Recomendacao da OWASP para PBKDF2 com SHA-256. */
    public static final int ITERACOES = 600_000;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private Senhas() {
    }

    public static String gerar(String senha, int iteracoes) {
        byte[] sal = new byte[16];
        ALEATORIO.nextBytes(sal);
        return "pbkdf2_sha256$" + iteracoes + "$" + Base64.getEncoder().encodeToString(sal) + "$"
                + Base64.getEncoder().encodeToString(derivar(senha, sal, iteracoes, 32));
    }

    /** A senha digitada confere com o hash guardado? Hash estragado nunca confere. */
    public static boolean confere(String senha, String guardado) {
        if (senha == null || guardado == null) {
            return false;
        }
        String[] partes = guardado.split("\\$", -1);
        if (partes.length != 4 || !partes[0].equals("pbkdf2_sha256")) {
            return false;
        }
        try {
            int iteracoes = Integer.parseInt(partes[1]);
            byte[] sal = Base64.getDecoder().decode(partes[2]);
            byte[] esperado = Base64.getDecoder().decode(partes[3]);
            if (iteracoes < 1 || iteracoes > 10_000_000 || sal.length == 0 || esperado.length == 0) {
                return false;
            }
            return MessageDigest.isEqual(esperado, derivar(senha, sal, iteracoes, esperado.length));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /** Resumo SHA-256 do texto, para comparar sem que o tempo diga onde os textos diferem. */
    public static byte[] resumo(String texto) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(texto.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] derivar(String senha, byte[] sal, int iteracoes, int bytes) {
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    .generateSecret(new PBEKeySpec(senha.toCharArray(), sal, iteracoes, bytes * 8)).getEncoded();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
