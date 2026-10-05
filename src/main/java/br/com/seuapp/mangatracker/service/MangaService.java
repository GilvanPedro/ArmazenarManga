package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterDecimalFormat;
import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
import br.com.seuapp.mangatracker.domain.WeekDay;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidLinkException;
import br.com.seuapp.mangatracker.domain.exceptions.InvalidReleaseDayException;
import br.com.seuapp.mangatracker.domain.exceptions.NotFoundException;
import br.com.seuapp.mangatracker.domain.exceptions.NullInformationsException;
import br.com.seuapp.mangatracker.repository.MangaRepository;
import br.com.seuapp.mangatracker.util.VerificarInformacoesNulas;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.random.RandomGenerator;

public class MangaService implements MangaServiceInterface{

    /** Nao ha mais o que ler nesses, entao nao entram no sorteio. */
    private static final Set<ReadingStatus> FORA_DO_SORTEIO = Set.of(ReadingStatus.CONCLUIDO, ReadingStatus.CANCELADO);

    private final MangaRepository repository;
    private final ImagemService imagemService;
    private final RandomGenerator random;
    private final VerificadorDeLink verificador;

    /** Sem acesso a outros sites: a verificacao de link sempre responde "nao verificado". */
    public MangaService(MangaRepository repository, ImagemService imagemService) {
        this(repository, imagemService, RandomGenerator.getDefault());
    }

    public MangaService(MangaRepository repository, ImagemService imagemService, RandomGenerator random) {
        this(repository, imagemService, random, new VerificadorDeLink(PaginaWeb::semResposta));
    }

    public MangaService(MangaRepository repository, ImagemService imagemService, VerificadorDeLink verificador) {
        this(repository, imagemService, RandomGenerator.getDefault(), verificador);
    }

    public MangaService(MangaRepository repository, ImagemService imagemService, RandomGenerator random, VerificadorDeLink verificador) {
        this.repository = repository;
        this.imagemService = imagemService;
        this.random = random;
        this.verificador = verificador;
    }

    @Override
    public synchronized Manga salvarManga(DadosManga dados) {
        Manga manga = montar(UUID.randomUUID(), dados);
        repository.salvar(manga);
        return manga;
    }

    @Override
    public Manga buscarPorId(UUID id) {
        return repository.buscarPorId(id)
                .orElseThrow(() -> new NotFoundException("Mangá não encontrado"));
    }

    @Override
    public List<Manga> listarMangas(String titulo, ReadingStatus readingStatus) {
        String busca = titulo == null ? "" : normalizar(titulo);
        return repository.listarTodos().stream()
                .filter(manga -> readingStatus == null || manga.getReadingStatus() == readingStatus)
                .filter(manga -> normalizar(manga.getTitle()).contains(busca))
                .toList();
    }

    @Override
    public synchronized void excluirManga(UUID id) {
        Manga manga = buscarPorId(id);
        repository.excluir(id);
        excluirImagemSemUso(manga.getImagePath());
    }

    @Override
    public synchronized Manga editarManga(UUID id, DadosManga dados) {
        Manga atual = buscarPorId(id);
        Manga editado = montar(id, dados);
        // os enderecos exatos conferidos no site continuam valendo se o link e o capitulo nao mudaram
        if (atual.getChapterLinkModel().equals(editado.getChapterLinkModel())
                && atual.getDecimalFormat() == editado.getDecimalFormat()
                && atual.getLastChapter().compareTo(editado.getLastChapter()) == 0) {
            editado.setLastChapterUrl(atual.getLastChapterUrl());
            editado.setNextChapterUrl(atual.getNextChapterUrl());
        }
        repository.salvar(editado);
        if (!atual.getImagePath().equals(editado.getImagePath())) {
            excluirImagemSemUso(atual.getImagePath());
        }
        return editado;
    }

    @Override
    public Manga atualizarProgresso(UUID id, BigDecimal lastChapter, ReadingStatus readingStatus) {
        Manga antes = buscarPorId(id);
        if (lastChapter != null && lastChapter.compareTo(antes.proximoCapitulo()) == 0 && antes.getNextChapterUrl() == null) {
            // avancando para o proximo capitulo: antes descobre no site o endereco certo dele
            // (o id da obra ou do capitulo pode ter mudado), para ja salvar o link com o id novo
            verificarLink(id);
        }
        return gravarProgresso(id, lastChapter, readingStatus);
    }

    private synchronized Manga gravarProgresso(UUID id, BigDecimal lastChapter, ReadingStatus readingStatus) {
        Manga atual = buscarPorId(id);
        if (lastChapter == null && readingStatus == null) {
            throw new NullInformationsException("Informe o último capítulo lido ou o status");
        }
        if (lastChapter != null) {
            VerificarInformacoesNulas.verificarCapitulo(lastChapter);
        }
        ReadingStatus novoStatus = readingStatus == null ? atual.getReadingStatus() : readingStatus;
        // copia em vez de usar os setters: se o salvar falhar, o manga guardado nao fica alterado
        Manga atualizado = new Manga(
                atual.getId(),
                atual.getTitle(),
                atual.getImagePath(),
                atual.getTags(),
                atual.getChapterLinkModel(),
                atual.getDecimalFormat(),
                lastChapter == null ? atual.getLastChapter() : lastChapter,
                novoStatus,
                atual.getDescription()
        );
        // o dia de lancamento so vale enquanto o manga esta sendo lido
        atualizado.setReleaseDay(novoStatus == ReadingStatus.LENDO ? atual.getReleaseDay() : null);
        if (atualizado.getLastChapter().compareTo(atual.getLastChapter()) == 0) {
            atualizado.setLastChapterUrl(atual.getLastChapterUrl());
            atualizado.setNextChapterUrl(atual.getNextChapterUrl());
        } else if (atualizado.getLastChapter().compareTo(atual.proximoCapitulo()) == 0) {
            // avancou para o capitulo que ja tinha sido conferido: o endereco exato dele passa a ser o do ultimo lido
            atualizado.setLastChapterUrl(atual.getNextChapterUrl());
        }
        repository.salvar(atualizado);
        return atualizado;
    }

    @Override
    public synchronized Manga registrarLeitura(UUID id, BigDecimal lastChapter, String lastChapterUrl, String nextChapterUrl) {
        Manga atual = buscarPorId(id);
        if (lastChapter == null) {
            throw new NullInformationsException("O último capítulo lido é obrigatório");
        }
        VerificarInformacoesNulas.verificarCapitulo(lastChapter);
        if (!ChapterLink.isUrlHttp(lastChapterUrl)) {
            throw new InvalidLinkException("O link do capítulo lido precisa ser um endereço http:// ou https:// válido");
        }
        boolean temProximo = nextChapterUrl != null && !nextChapterUrl.isBlank();
        if (temProximo && !ChapterLink.isUrlHttp(nextChapterUrl)) {
            throw new InvalidLinkException("O link do próximo capítulo precisa ser um endereço http:// ou https:// válido");
        }
        Manga atualizado = new Manga(atual.getId(), atual.getTitle(), atual.getImagePath(), atual.getTags(),
                atual.getChapterLinkModel(), atual.getDecimalFormat(), lastChapter, atual.getReadingStatus(), atual.getDescription());
        atualizado.setReleaseDay(atual.getReleaseDay());
        atualizado.setLastChapterUrl(lastChapterUrl.trim());
        // um "proximo" igual a pagina atual nao serve para nada
        atualizado.setNextChapterUrl(temProximo && !ChapterLink.mesmoEndereco(nextChapterUrl, lastChapterUrl) ? nextChapterUrl.trim() : null);
        repository.salvar(atualizado);
        return atualizado;
    }

    @Override
    public ResultadoVerificacao verificarLink(UUID id) {
        Manga consultado = buscarPorId(id);
        String linkAnterior = consultado.linkProximoCapitulo();
        // a consulta ao site demora, entao acontece fora da trava; a gravacao confere se nada mudou no meio tempo
        VerificadorDeLink.Verificacao verificacao = verificador.verificar(consultado);

        Manga manga;
        synchronized (this) {
            manga = buscarPorId(id);
            boolean mesmoDeAntes = manga.getChapterLinkModel().equals(consultado.getChapterLinkModel())
                    && manga.getLastChapter().compareTo(consultado.getLastChapter()) == 0
                    && Objects.equals(manga.getLastChapterUrl(), consultado.getLastChapterUrl());
            boolean haCorrecao = !manga.getChapterLinkModel().equals(verificacao.chapterLinkModel())
                    || !Objects.equals(manga.getNextChapterUrl(), verificacao.nextChapterUrl());
            if (mesmoDeAntes && haCorrecao && verificacao.situacao() != SituacaoDoLink.NAO_VERIFICADO) {
                Manga corrigido = new Manga(manga.getId(), manga.getTitle(), manga.getImagePath(), manga.getTags(),
                        verificacao.chapterLinkModel(), manga.getDecimalFormat(), manga.getLastChapter(),
                        manga.getReadingStatus(), manga.getDescription());
                corrigido.setReleaseDay(manga.getReleaseDay());
                corrigido.setLastChapterUrl(manga.getLastChapterUrl());
                corrigido.setNextChapterUrl(verificacao.nextChapterUrl());
                repository.salvar(corrigido);
                manga = corrigido;
            }
        }
        boolean linkMudou = !ChapterLink.mesmoEndereco(linkAnterior, manga.linkProximoCapitulo());
        return new ResultadoVerificacao(verificacao.situacao(), linkMudou, linkAnterior,
                mensagemDaVerificacao(verificacao.situacao(), linkMudou, manga), manga);
    }

    private static String mensagemDaVerificacao(SituacaoDoLink situacao, boolean linkMudou, Manga manga) {
        String proximo = ChapterDecimalFormat.PONTO.formatar(manga.proximoCapitulo());
        String ultimo = ChapterDecimalFormat.PONTO.formatar(manga.getLastChapter()).replace('.', ',');
        String troca = linkMudou ? "O site mudou o endereço e o link foi atualizado. " : "";
        return switch (situacao) {
            case DISPONIVEL -> linkMudou
                    ? troca + "O capítulo " + proximo + " está disponível."
                    : "Link confirmado: o capítulo " + proximo + " está disponível.";
            case NAO_ENCONTRADO -> troca + "O capítulo " + proximo + " não foi encontrado no site; ele pode ainda não ter sido lançado.";
            case LINK_QUEBRADO -> "Nem o capítulo " + ultimo + " nem o " + proximo + " abrem com esse link. Confira o link na edição geral.";
            case NAO_VERIFICADO -> "Não foi possível verificar: o site não respondeu ou bloqueia verificações automáticas. O link foi mantido.";
        };
    }

    @Override
    public List<Manga> listarLancamentos(WeekDay dia) {
        if (dia == null) {
            throw new NullInformationsException("Informe o dia da semana");
        }
        return repository.listarTodos().stream()
                .filter(manga -> manga.getReadingStatus() == ReadingStatus.LENDO)
                .filter(manga -> manga.getReleaseDay() == dia)
                .toList();
    }

    @Override
    public Manga sortearManga(ReadingStatus readingStatus) {
        List<Manga> candidatos = listarMangas(null, readingStatus).stream()
                .filter(manga -> !FORA_DO_SORTEIO.contains(manga.getReadingStatus()))
                .toList();
        if (candidatos.isEmpty()) {
            throw new NotFoundException("Nenhum mangá para sortear");
        }
        return candidatos.get(random.nextInt(candidatos.size()));
    }

    // ------------------------------------------------------------------

    private Manga montar(UUID id, DadosManga dados) {
        if (dados == null) {
            throw new NullInformationsException();
        }
        VerificarInformacoesNulas.verificar(dados.title(), dados.imagePath(), dados.chapterLinkModel(), dados.lastChapter(), dados.readingStatus());
        ChapterLink.validar(dados.chapterLinkModel());
        String imagePath = dados.imagePath().trim();
        imagemService.verificarReferencia(imagePath);
        if (dados.releaseDay() != null && dados.readingStatus() != ReadingStatus.LENDO) {
            throw new InvalidReleaseDayException("O dia de lançamento só pode ser definido para mangás com status Lendo");
        }

        Manga manga = new Manga(
                id,
                dados.title().trim(),
                imagePath,
                montarTags(dados.tags()),
                dados.chapterLinkModel().trim(),
                dados.decimalFormat(),
                dados.lastChapter(),
                dados.readingStatus(),
                dados.description() == null ? "" : dados.description().trim()
        );
        manga.setReleaseDay(dados.releaseDay());
        return manga;
    }

    /** Tira espacos, vazios e repetidos (sem diferenciar maiusculas). */
    private static List<Tag> montarTags(List<String> nomes) {
        List<Tag> tags = new ArrayList<>();
        if (nomes == null) {
            return tags;
        }
        List<String> vistos = new ArrayList<>();
        for (String nome : nomes) {
            if (nome == null || nome.isBlank()) {
                continue;
            }
            String limpo = nome.trim();
            if (!vistos.contains(normalizar(limpo))) {
                vistos.add(normalizar(limpo));
                tags.add(new Tag(limpo));
            }
        }
        return tags;
    }

    private void excluirImagemSemUso(String imagePath) {
        boolean emUso = repository.listarTodos().stream()
                .anyMatch(manga -> Objects.equals(manga.getImagePath(), imagePath));
        if (!emUso) {
            imagemService.excluir(imagePath);
        }
    }

    /** Minusculas e sem acentos, para "acao" encontrar "Ação". */
    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }
}
