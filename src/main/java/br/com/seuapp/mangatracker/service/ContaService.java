package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.Conta;
import br.com.seuapp.mangatracker.domain.exceptions.ContaException;
import br.com.seuapp.mangatracker.repository.ConsultaDeMangas;
import br.com.seuapp.mangatracker.repository.ContaAtual;
import br.com.seuapp.mangatracker.repository.ContaRepository;
import br.com.seuapp.mangatracker.repository.EstruturaDoBanco;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Contas: criar, entrar, ver, editar, excluir e trazer os mangas de antes das contas. Mesmas regras da versao do
 * Vercel (api/_contas.js e api/index.js): e-mail unico, senha com pelo menos 6 caracteres, nick que pode ser mudado.
 */
public class ContaService {
    public static final int SENHA_MINIMA = 6;
    public static final int SENHA_MAXIMA = 200;
    public static final int NICK_MAXIMO = 40;
    private static final Pattern EMAIL = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");

    /** Quanto a conta tem, para a pagina "Minha conta". mangasAntigos: os de antes das contas que ela pode trazer. */
    public record Dados(Conta conta, int mangas, int mangasAntigos) {
    }

    private final ContaRepository contas;
    private final MangaServiceInterface mangas;
    private final ImagemService imagens;
    private final String senhaAntiga;
    private final int iteracoes;
    private final String hashDeMentira;
    // senha errada de um e-mail: 10 em 15 minutos; no site inteiro: 100 em 15 minutos
    private final LimiteDeTentativas errosPorEmail;
    private final LimiteDeTentativas errosNoSite;
    // contas criadas no site inteiro: 20 por hora; senha antiga errada: 10 em 15 minutos
    private final LimiteDeTentativas cadastros;
    private final LimiteDeTentativas errosDaSenhaAntiga;

    /**
     * @param senhaAntiga a senha do site de antes das contas (MANGATRACKER_SENHA): quem a souber pode trazer os mangas
     *                    antigos para a propria conta. null = nao da para trazer
     * @param iteracoes   do hash das senhas novas ({@link Senhas#ITERACOES}; os testes usam menos, para irem rapido)
     */
    public ContaService(ContaRepository contas, MangaServiceInterface mangas, ImagemService imagens, String senhaAntiga, int iteracoes, Clock relogio) {
        this.contas = Objects.requireNonNull(contas);
        this.mangas = Objects.requireNonNull(mangas);
        this.imagens = Objects.requireNonNull(imagens);
        this.senhaAntiga = senhaAntiga == null || senhaAntiga.isEmpty() ? null : senhaAntiga;
        this.iteracoes = iteracoes;
        this.hashDeMentira = Senhas.gerar("senha que ninguem usa", iteracoes);
        this.errosPorEmail = new LimiteDeTentativas(10, Duration.ofMinutes(15), relogio);
        this.errosNoSite = new LimiteDeTentativas(100, Duration.ofMinutes(15), relogio);
        this.cadastros = new LimiteDeTentativas(20, Duration.ofHours(1), relogio);
        this.errosDaSenhaAntiga = new LimiteDeTentativas(10, Duration.ofMinutes(15), relogio);
    }

    public ContaService(ContaRepository contas, MangaServiceInterface mangas, ImagemService imagens, String senhaAntiga) {
        this(contas, mangas, imagens, senhaAntiga, Senhas.ITERACOES, Clock.systemUTC());
    }

    // ------------------------------------------------------------------ regras dos dados

    public static String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    static String validarEmail(String email) {
        String limpo = normalizarEmail(email);
        if (limpo.isEmpty()) {
            throw new ContaException(400, "Informe o e-mail");
        }
        if (limpo.length() > 254 || !EMAIL.matcher(limpo).matches()) {
            throw new ContaException(400, "E-mail inválido");
        }
        return limpo;
    }

    static String validarNick(String nick) {
        String limpo = nick == null ? "" : nick.trim().replaceAll("\\s+", " ");
        if (limpo.isEmpty()) {
            throw new ContaException(400, "Escolha um nick");
        }
        if (limpo.codePointCount(0, limpo.length()) > NICK_MAXIMO) {
            throw new ContaException(400, "O nick pode ter no máximo " + NICK_MAXIMO + " caracteres");
        }
        return limpo;
    }

    static String validarSenha(String senha) {
        if (senha == null || senha.length() < SENHA_MINIMA) {
            throw new ContaException(400, "A senha precisa ter pelo menos " + SENHA_MINIMA + " caracteres");
        }
        if (senha.length() > SENHA_MAXIMA) {
            throw new ContaException(400, "A senha pode ter no máximo " + SENHA_MAXIMA + " caracteres");
        }
        return senha;
    }

    private static void exigirQueNaoEstejaFreado(LimiteDeTentativas limite, String chave) {
        Duration espera = limite.espera(chave);
        if (!espera.isZero()) {
            long minutos = Math.max(1, (espera.toSeconds() + 59) / 60);
            throw new ContaException(429, "Muitas tentativas. Tente de novo em " + minutos + (minutos == 1 ? " minuto" : " minutos"));
        }
    }

    // ------------------------------------------------------------------ contas

    /** Cria a conta. Quem chama ja entra nela. */
    public Conta criar(String email, String nick, String senha) {
        String emailValido = validarEmail(email);
        String nickValido = validarNick(nick);
        validarSenha(senha);
        exigirQueNaoEstejaFreado(cadastros, "");
        Conta conta = new Conta(UUID.randomUUID(), emailValido, nickValido, Senhas.gerar(senha, iteracoes), false, java.time.Instant.now());
        if (!contas.inserir(conta)) {
            throw new ContaException(409, "Já existe uma conta com esse e-mail");
        }
        cadastros.registrarErro("");
        return conta;
    }

    /** A conta do e-mail, se a senha conferir. E-mail que nao existe e senha errada dao a mesma resposta, no mesmo tempo. */
    public Conta entrar(String email, String senha) {
        if (email == null || email.isBlank() || senha == null || senha.isEmpty()) {
            throw new ContaException(400, "Informe o e-mail e a senha");
        }
        String chave = normalizarEmail(email);
        exigirQueNaoEstejaFreado(errosPorEmail, chave);
        exigirQueNaoEstejaFreado(errosNoSite, "");
        java.util.Optional<Conta> conta = contas.buscarPorEmail(chave);
        boolean certo = Senhas.confere(senha, conta.map(Conta::senhaHash).orElse(hashDeMentira)) && conta.isPresent();
        if (!certo) {
            errosPorEmail.registrarErro(chave);
            errosNoSite.registrarErro("");
            throw new ContaException(401, "E-mail ou senha incorretos");
        }
        return conta.get();
    }

    public java.util.Optional<Conta> buscar(UUID id) {
        return contas.buscarPorId(id);
    }

    private Conta exigir(UUID id) {
        return contas.buscarPorId(id).orElseThrow(() -> new ContaException(401, "Entre na sua conta"));
    }

    /** Confere a senha atual antes de mudancas que pedem ela (trocar e-mail ou senha, excluir a conta). */
    private void exigirSenhaAtual(Conta conta, String senha) {
        exigirQueNaoEstejaFreado(errosPorEmail, conta.email());
        if (senha == null || senha.isEmpty()) {
            throw new ContaException(400, "Confirme com a sua senha atual");
        }
        if (!Senhas.confere(senha, conta.senhaHash())) {
            errosPorEmail.registrarErro(conta.email());
            throw new ContaException(403, "Senha atual incorreta");
        }
    }

    public Dados dados(UUID id) {
        Conta conta = exigir(id);
        int meus = ContaAtual.com(id.toString(), () -> mangas.contar(ConsultaDeMangas.todos(null, null, null, null)));
        int antigos = senhaAntiga == null ? 0
                : ContaAtual.com(EstruturaDoBanco.CONTA_PRINCIPAL, () -> mangas.contar(ConsultaDeMangas.todos(null, null, null, null)));
        return new Dados(conta, meus, antigos);
    }

    /**
     * Edita a conta. null mantem o que estava. Trocar o e-mail ou a senha pede a senha atual; o nick, nao.
     * Trocar a senha desfaz os logins dos outros aparelhos (o cookie depende da senha guardada).
     */
    public Conta atualizar(UUID id, String nick, String email, String senhaNova, String senhaAtual) {
        Conta conta = exigir(id);
        Conta editada = conta.comNick(nick == null ? conta.nick() : validarNick(nick));
        String emailNovo = email == null ? conta.email() : validarEmail(email);
        boolean trocaSenha = senhaNova != null && !senhaNova.isEmpty();
        if (trocaSenha) {
            validarSenha(senhaNova);
        }
        if (!emailNovo.equals(conta.email()) || trocaSenha) {
            exigirSenhaAtual(conta, senhaAtual);
        }
        editada = editada.comEmail(emailNovo);
        if (trocaSenha) {
            editada = editada.comSenhaHash(Senhas.gerar(senhaNova, iteracoes));
        }
        if (!contas.atualizar(editada)) {
            throw new ContaException(409, "Já existe uma conta com esse e-mail");
        }
        return editada;
    }

    /** Exclui a conta, todos os mangas e as capas dela. Pede a senha. */
    public void excluir(UUID id, String senha) {
        Conta conta = exigir(id);
        exigirSenhaAtual(conta, senha);
        ContaAtual.com(id.toString(), () -> {
            mangas.excluirTodos();
            imagens.excluirTodas();
            return null;
        });
        contas.excluir(id);
    }

    /**
     * Traz para a conta os mangas e capas de antes das contas. Pede a senha antiga do site: so o dono sabe. A conta
     * que faz isso vira a de administracao. @return quantos mangas vieram
     */
    public int trazerMangasAntigos(UUID id, String senha) {
        Conta conta = exigir(id);
        if (senhaAntiga == null) {
            throw new ContaException(404, "Não há mangás antigos para trazer");
        }
        exigirQueNaoEstejaFreado(errosDaSenhaAntiga, "");
        boolean certa = senha != null && MessageDigest.isEqual(Senhas.resumo(senha), Senhas.resumo(senhaAntiga));
        if (!certa) {
            errosDaSenhaAntiga.registrarErro("");
            throw new ContaException(403, "Senha antiga do site incorreta");
        }
        int trazidos = ContaAtual.com(id.toString(), () -> {
            imagens.trazerDe(EstruturaDoBanco.CONTA_PRINCIPAL);
            return mangas.trazerDe(EstruturaDoBanco.CONTA_PRINCIPAL);
        });
        contas.atualizar(conta.comoAdmin());
        return trazidos;
    }
}
