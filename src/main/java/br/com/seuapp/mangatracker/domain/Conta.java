package br.com.seuapp.mangatracker.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Uma conta: cada uma ve so os mangas que ela mesma cadastrou.
 *
 * @param email     guardado em minusculas; e unico
 * @param senhaHash a senha so como hash (veja service/Senhas); nunca sai do servidor
 * @param admin     a conta que trouxe os mangas de antes das contas existirem
 * @param foto      nome da imagem da foto de perfil (enviada pela propria conta), ou null
 */
public record Conta(UUID id, String email, String nick, String senhaHash, boolean admin, Instant criadaEm, String foto) {

    /** Sem foto. */
    public Conta(UUID id, String email, String nick, String senhaHash, boolean admin, Instant criadaEm) {
        this(id, email, nick, senhaHash, admin, criadaEm, null);
    }

    public Conta comNick(String novo) {
        return new Conta(id, email, novo, senhaHash, admin, criadaEm, foto);
    }

    public Conta comEmail(String novo) {
        return new Conta(id, novo, nick, senhaHash, admin, criadaEm, foto);
    }

    public Conta comSenhaHash(String novo) {
        return new Conta(id, email, nick, novo, admin, criadaEm, foto);
    }

    public Conta comFoto(String nova) {
        return new Conta(id, email, nick, senhaHash, admin, criadaEm, nova);
    }

    public Conta comoAdmin() {
        return new Conta(id, email, nick, senhaHash, true, criadaEm, foto);
    }
}
