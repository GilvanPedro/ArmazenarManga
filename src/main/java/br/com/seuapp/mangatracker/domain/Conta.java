package br.com.seuapp.mangatracker.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Uma conta: cada uma ve so os mangas que ela mesma cadastrou.
 *
 * @param email     guardado em minusculas; e unico
 * @param senhaHash a senha so como hash (veja service/Senhas); nunca sai do servidor
 * @param admin     a conta que trouxe os mangas de antes das contas existirem
 */
public record Conta(UUID id, String email, String nick, String senhaHash, boolean admin, Instant criadaEm) {

    public Conta comNick(String novo) {
        return new Conta(id, email, novo, senhaHash, admin, criadaEm);
    }

    public Conta comEmail(String novo) {
        return new Conta(id, novo, nick, senhaHash, admin, criadaEm);
    }

    public Conta comSenhaHash(String novo) {
        return new Conta(id, email, nick, novo, admin, criadaEm);
    }

    public Conta comoAdmin() {
        return new Conta(id, email, nick, senhaHash, true, criadaEm);
    }
}
