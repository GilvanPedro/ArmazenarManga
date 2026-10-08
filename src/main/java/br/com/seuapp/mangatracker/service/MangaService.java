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
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.random.RandomGenerator;

public class MangaService implements MangaServiceInterface{

    /** Tags oferecidas no cadastro mesmo antes de serem usadas (generos e temas comuns, em ingles). */
    static final List<String> TAGS_SUGERIDAS = List.of(
            "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Psychological", "Romance",
            "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
            "Dungeon", "Historical", "Isekai", "Magic", "Martial Arts", "Murim", "Regression", "Reincarnation",
            "Revenge", "School Life", "System", "Villainess");
    static final int MAXIMO_DE_SEMELHANTES = 6;

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
    public List<Manga> listarMangas(String titulo, ReadingStatus readingStatus, String tag) {
        String busca = titulo == null ? "" : normalizar(titulo);
        String tagBuscada = tag == null ? "" : normalizar(tag);
        return repository.listarTodos().stream()
                .filter(manga -> readingStatus == null || manga.getReadingStatus() == readingStatus)
                .filter(manga -> normalizar(manga.getTitle()).contains(busca))
                .filter(manga -> tagBuscada.isEmpty() || tagsNormalizadas(manga).contains(tagBuscada))
                .toList();
    }

    @Override
    public List<TagEmUso> listarTags() {
        // conta por nome sem diferenciar maiusculas nem acentos; o nome mostrado e o primeiro que apareceu
        Map<String, String> nomes = new LinkedHashMap<>();
        Map<String, Integer> quantidades = new HashMap<>();
        for (Manga manga : repository.listarTodos()) {
            Set<String> doManga = new HashSet<>();
            for (Tag tag : manga.getTags()) {
                String chave = normalizar(tag.getNome());
                if (!chave.isEmpty() && doManga.add(chave)) {
                    nomes.putIfAbsent(chave, tag.getNome().trim());
                    quantidades.merge(chave, 1, Integer::sum);
                }
            }
        }
        List<TagEmUso> tags = new ArrayList<>();
        nomes.forEach((chave, nome) -> tags.add(new TagEmUso(nome, quantidades.get(chave))));
        tags.sort(Comparator.comparingInt(TagEmUso::quantidade).reversed().thenComparing(TagEmUso::nome, String.CASE_INSENSITIVE_ORDER));
        for (String sugerida : TAGS_SUGERIDAS) {
            if (!nomes.containsKey(normalizar(sugerida))) {
                tags.add(new TagEmUso(sugerida, 0));
            }
        }
        return tags;
    }

    @Override
    public List<Manga> listarSemelhantes(UUID id) {
        Set<String> tagsDoManga = tagsNormalizadas(buscarPorId(id));
        Map<Manga, Integer> emComum = new LinkedHashMap<>();
        for (Manga outro : repository.listarTodos()) {
            if (outro.getId().equals(id)) {
                continue;
            }
            Set<String> iguais = tagsNormalizadas(outro);
            iguais.retainAll(tagsDoManga);
            if (!iguais.isEmpty()) {
                emComum.put(outro, iguais.size());
            }
        }
        return emComum.entrySet().stream()
                .sorted(Map.Entry.<Manga, Integer>comparingByValue().reversed()
                        .thenComparing(entrada -> entrada.getKey().getTitle(), String.CASE_INSENSITIVE_ORDER))
                .limit(MAXIMO_DE_SEMELHANTES)
                .map(Map.Entry::getKey)
                .toList();
    }

    private static Set<String> tagsNormalizadas(Manga manga) {
        Set<String> tags = new HashSet<>();
        if (manga.getTags() != null) {
            manga.getTags().forEach(tag -> tags.add(normalizar(tag.getNome())));
        }
        tags.remove("");
        return tags;
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
        // os outros nomes da obra continuam valendo enquanto o titulo for o mesmo; titulo novo, busca nova
        if (normalizar(atual.getTitle()).equals(normalizar(editado.getTitle()))) {
            editado.setAltTitles(atual.getAltTitles());
        }
        anotarLeitura(atual, editado);
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
        atualizado.setAltTitles(atual.getAltTitles());
        anotarLeitura(atual, atualizado);
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
        // o modelo acompanha o endereco real: se o id do link mudou, o modelo salvo passa a ter o id novo
        String modeloDoEndereco = ChapterLink.derivarModelo(lastChapterUrl.trim(), lastChapter, atual.getDecimalFormat());
        Manga atualizado = new Manga(atual.getId(), atual.getTitle(), atual.getImagePath(), atual.getTags(),
                modeloDoEndereco != null ? modeloDoEndereco : atual.getChapterLinkModel(),
                atual.getDecimalFormat(), lastChapter, atual.getReadingStatus(), atual.getDescription());
        atualizado.setReleaseDay(atual.getReleaseDay());
        atualizado.setAltTitles(atual.getAltTitles());
        anotarLeitura(atual, atualizado);
        atualizado.setLastChapterUrl(lastChapterUrl.trim());
        // um "proximo" igual a pagina atual nao serve para nada
        atualizado.setNextChapterUrl(temProximo && !ChapterLink.mesmoEndereco(nextChapterUrl, lastChapterUrl) ? nextChapterUrl.trim() : null);
        repository.salvar(atualizado);
        return atualizado;
    }

    /** Guarda a hora em que o capitulo avancou; se nao avancou (ficou igual ou voltou), mantem a que ja havia. */
    private static void anotarLeitura(Manga antes, Manga depois) {
        depois.setLastChapterAt(depois.getLastChapter().compareTo(antes.getLastChapter()) > 0 ? Instant.now() : antes.getLastChapterAt());
    }

    @Override
    public synchronized void definirNomesAlternativos(UUID id, String tituloConsultado, List<String> nomes) {
        Manga manga = repository.buscarPorId(id).orElse(null);
        // excluido ou renomeado enquanto a busca corria: os nomes seriam de outro titulo
        if (manga == null || !normalizar(manga.getTitle()).equals(normalizar(tituloConsultado))) {
            return;
        }
        Manga atualizado = new Manga(manga.getId(), manga.getTitle(), manga.getImagePath(), manga.getTags(), manga.getChapterLinkModel(),
                manga.getDecimalFormat(), manga.getLastChapter(), manga.getReadingStatus(), manga.getDescription());
        atualizado.setReleaseDay(manga.getReleaseDay());
        atualizado.setLastChapterUrl(manga.getLastChapterUrl());
        atualizado.setNextChapterUrl(manga.getNextChapterUrl());
        atualizado.setAltTitles(nomes == null ? List.of() : List.copyOf(nomes));
        atualizado.setLastChapterAt(manga.getLastChapterAt());
        repository.salvar(atualizado);
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
                corrigido.setAltTitles(manga.getAltTitles());
                corrigido.setLastChapterAt(manga.getLastChapterAt());
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
    public List<Manga> listarLancamentos(WeekDay dia, Instant desde) {
        if (dia == null) {
            throw new NullInformationsException("Informe o dia da semana");
        }
        return repository.listarTodos().stream()
                .filter(manga -> manga.getReadingStatus() == ReadingStatus.LENDO)
                .filter(manga -> manga.getReleaseDay() == dia)
                // quem ja avancou o capitulo de "desde" para ca ja leu o lancamento do dia: sai da lista
                .filter(manga -> desde == null || manga.getLastChapterAt() == null || manga.getLastChapterAt().isBefore(desde))
                .toList();
    }

    @Override
    public Manga sortearManga(ReadingStatus readingStatus) {
        List<Manga> candidatos = listarMangas(null, readingStatus);
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
                montarTags(dados.tags(), listarTags()),
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
    /**
     * Tira espacos, vazios e repetidos (sem diferenciar maiusculas).
     * Uma tag que ja existe na lista geral entra com o nome de la ("action" vira "Action"),
     * para a mesma tag nao aparecer escrita de dois jeitos; so nome novo cria tag nova.
     */
    private static List<Tag> montarTags(List<String> nomes, List<TagEmUso> existentes) {
        List<Tag> tags = new ArrayList<>();
        if (nomes == null) {
            return tags;
        }
        Map<String, String> nomeNaListaGeral = new HashMap<>();
        existentes.forEach(existente -> nomeNaListaGeral.putIfAbsent(normalizar(existente.nome()), existente.nome()));
        List<String> vistos = new ArrayList<>();
        for (String nome : nomes) {
            if (nome == null || nome.isBlank()) {
                continue;
            }
            String limpo = nome.trim().replaceAll("\\s+", " ");
            if (!vistos.contains(normalizar(limpo))) {
                vistos.add(normalizar(limpo));
                tags.add(new Tag(nomeNaListaGeral.getOrDefault(normalizar(limpo), limpo)));
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
