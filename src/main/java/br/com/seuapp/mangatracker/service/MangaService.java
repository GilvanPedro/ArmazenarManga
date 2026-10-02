package br.com.seuapp.mangatracker.service;

import br.com.seuapp.mangatracker.domain.ChapterLink;
import br.com.seuapp.mangatracker.domain.Manga;
import br.com.seuapp.mangatracker.domain.ReadingStatus;
import br.com.seuapp.mangatracker.domain.Tag;
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

    public MangaService(MangaRepository repository, ImagemService imagemService) {
        this(repository, imagemService, RandomGenerator.getDefault());
    }

    public MangaService(MangaRepository repository, ImagemService imagemService, RandomGenerator random) {
        this.repository = repository;
        this.imagemService = imagemService;
        this.random = random;
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
        repository.salvar(editado);
        if (!atual.getImagePath().equals(editado.getImagePath())) {
            excluirImagemSemUso(atual.getImagePath());
        }
        return editado;
    }

    @Override
    public synchronized Manga atualizarProgresso(UUID id, BigDecimal lastChapter, ReadingStatus readingStatus) {
        Manga atual = buscarPorId(id);
        if (lastChapter == null && readingStatus == null) {
            throw new NullInformationsException("Informe o último capítulo lido ou o status");
        }
        if (lastChapter != null) {
            VerificarInformacoesNulas.verificarCapitulo(lastChapter);
        }
        // copia em vez de usar os setters: se o salvar falhar, o manga guardado nao fica alterado
        Manga atualizado = new Manga(
                atual.getId(),
                atual.getTitle(),
                atual.getImagePath(),
                atual.getTags(),
                atual.getChapterLinkModel(),
                atual.getDecimalFormat(),
                lastChapter == null ? atual.getLastChapter() : lastChapter,
                readingStatus == null ? atual.getReadingStatus() : readingStatus,
                atual.getDescription()
        );
        repository.salvar(atualizado);
        return atualizado;
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

        return new Manga(
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
