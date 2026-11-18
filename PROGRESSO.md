# Progresso — IG Video Controller

Data: 2026-11-17

## Etapa 1 — Manifest e esqueleto ✅
- `manifest.json` criado exatamente com a base especificada. JSON validado.
- Ícones `icons/16.png`, `48.png` e `128.png` gerados localmente com um script Python que usa só a biblioteca padrão (`zlib` + `struct`): quadrado arredondado magenta com triângulo "▶" branco e antialiasing. Nenhuma imagem foi baixada. O gerador ficou fora do projeto, pois não faz parte da estrutura de entrega.

## Etapa 2 — Núcleo do controlador ✅
- IIFE com guarda `globalThis.__igvcLoaded`.
- Constantes congeladas: `PRESETS`, `ACTIONS` e `OVERLAY_BUTTONS` com `Object.freeze`; `STEP`, `SEEK`, `MIN_RATE` e `MAX_RATE` como `const`.
- `setRate` valida com `Number.isFinite`, limita a [0,25; 4] e arredonda para centésimos.
- `getActiveVideo`: prioriza o vídeo em reprodução mais visível; se nenhum estiver tocando, usa o mais visível. Usa **um** `IntersectionObserver`.
- `attach`: `WeakSet` garante listeners uma única vez (`ratechange`, `play`, `playing`, `loadedmetadata`), todos reaplicando `desiredRate` com comparação antes da atribuição, o que evita loop.
- **Um** `MutationObserver` em `document.body` (`childList` + `subtree`) com debounce via `requestAnimationFrame`.

**Decisões:**
- Também aplico `defaultPlaybackRate`, porque um novo `src`/`load()` reseta `playbackRate` para esse valor. Isso ajuda a manter a velocidade entre Reels.
- Além do `WeakSet`, uso um `Set` auxiliar só para tirar do `IntersectionObserver` os vídeos que saíram do DOM e evitar vazamento de memória. Os listeners continuam controlados exclusivamente pelo `WeakSet`.
- Listeners extras `playing` e `loadedmetadata` (além de `play`) cobrem o caso em que o Instagram troca a mídia sem disparar `ratechange`.

## Etapa 3 — Atalhos de teclado ✅
- Um único `keydown` em captura no `document`.
- Ignora o evento se `Ctrl`/`Meta`/`Alt` estiverem pressionados, durante composição IME (`isComposing`) e se o alvo for `input`, `textarea`, `select` ou `contenteditable`. O alvo é checado em `composedPath()[0]`, `event.target` e `document.activeElement`.
- Mapa consultado com `Object.hasOwn`; `preventDefault()` só para teclas tratadas.

## Etapa 4 — Overlay ✅
- Host único (`<igvc-overlay-host>`) anexado ao `document.documentElement`, com Shadow DOM **fechado** e estilos dentro do shadow root.
- Elementos criados só com `createElement` + `textContent`. Os botões têm `stopPropagation()` em `click`, `pointerdown` e `mousedown`, e o botão ativo é destacado com `aria-pressed`.
- `position: fixed`, `z-index: 2147483647`, `pointer-events: none` no host e no contêiner, `auto` só nos botões.
- Aparece ao mudar a velocidade, ao usar atalhos ou ao passar o mouse sobre o vídeo ativo, e some após 2 s. Enquanto visível, acompanha a posição do vídeo a cada frame.

**Decisões:**
- Detecção de hover: o Instagram coloca camadas por cima do `<video>`, então eventos no próprio vídeo não chegam de forma confiável. Uso um `pointermove` passivo no `document`, com throttle por `requestAnimationFrame`, que só compara as coordenadas do mouse com o retângulo do vídeo ativo. Nada da página é lido.
- Na inicialização, o script remove hosts `<igvc-overlay-host>` órfãos de uma injeção anterior. É a única consulta ao DOM que não é por `<video>`, e ela busca apenas o elemento da própria extensão. Serve para garantir no máximo um overlay.

## Etapa 5 — Verificação automatizada ✅
- `scripts/check-security.sh` (bash + grep + Python 3 stdlib). Detecta automaticamente `python3`/`python`, já que no Windows `python3` pode ser só o atalho da Microsoft Store.
- Cobre todos os termos da seção 2.2. Também cobre timers com string, `createElement` de `script`/`img`/`iframe`/`link`/etc., atribuição de `src`/`href`, `Function(`, `importScripts` e qualquer `chrome.*`.
- Manifest: busca textual dos termos proibidos e validação estrutural (chaves proibidas em qualquer nível, valor `"MAIN"`, `matches` exato, `all_frames: false`, `run_at: document_idle`, nenhuma chave de topo extra, CSP).
- Zip: whitelist de nomes (`manifest.json`, `content.js`, `icons/*.png`). Depois o conteúdo é extraído para uma pasta temporária e passa pelas mesmas verificações.
- **Teste negativo:** numa cópia com violações injetadas (`console.log`, `innerHTML`, timer com string, `.src =`, `permissions`, `<all_urls>`, `evil.js` no zip), o script detectou todas e saiu com código 1.
- Resultado na pasta real: **APROVADO (exit 0)**.

## Etapa 6 — Empacotamento e README ✅
- `ig-video-controller.zip` gerado com `zipfile` do Python, contendo só `manifest.json`, `content.js` e `icons/{16,48,128}.png`.
- Check reexecutado sobre a pasta e o zip: **APROVADO**.
- `README.md` com funcionalidades, atalhos, privacidade, permissões, instalação e verificação.

Para regenerar o zip após mudanças:
```bash
python -c "import zipfile; z=zipfile.ZipFile('ig-video-controller.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p) for p in ('manifest.json','content.js','icons/16.png','icons/48.png','icons/128.png')]; z.close()"
bash scripts/check-security.sh
```

## Etapa 7 — Roteiro de testes ✅
- Checklist de 7 itens (mais um extra) no README, para o usuário executar no Chrome.

## Testes de lógica feitos pelo agente
Simulação em Node com DOM falso mínimo, sem dependências e fora do projeto. Validou:
- a guarda de instância única (segunda injeção não adiciona listener);
- os presets e o limite de 4x/0,25x;
- teclas não mapeadas e com modificadores ignoradas;
- campos `input`/`contenteditable` ignorados;
- o reset de `playbackRate` pelo site sendo reaplicado sem loop;
- seek com limite em 0;
- pausa e retomada;
- um novo vídeo herdando a velocidade;
- listeners registrados uma única vez após vários scans;
- um único host de overlay.

Não foi feito teste no Instagram real: pela seção 2.4, isso cabe ao usuário.

## Iteração 2 — Barra de progresso interativa (estilo Facebook) ✅
Pedido do usuário: barra interativa, oculta por padrão, visível no hover ou com o vídeo pausado, fina, com bolinha no hover, e overlay movido para a borda inferior do vídeo.

- **Posição:** o overlay ocupa a largura do vídeo e fica alinhado à borda inferior, limitado à área visível da janela. Tem fundo em degradê escuro.
- **Conteúdo:** linha com velocidade, `1x`/`1,5x`/`2x` e o tempo `m:ss / m:ss` (`h:mm:ss` quando passa de 1 h). Abaixo dela, a barra.
- **Barra:** área de clique com 14 px de altura e linha visível de 3 px. No hover ou durante o arrasto, a linha passa a 5 px e a bolinha de 12 px aparece com animação de escala. Tudo é feito só com CSS dentro do Shadow DOM fechado.
- **Arrasto:** usa Pointer Events com `setPointerCapture`. O vídeo fica fixo durante o arrasto (`dragVideo`), mesmo que o "vídeo ativo" mude. A posição é limitada a [0, duração], e `stopPropagation` em `pointerdown`/`pointerup`/`mousedown`/`mouseup`/`click` evita que o Instagram pause ou retome o vídeo.
- **Visibilidade:** o overlay aparece no hover sobre o vídeo, no evento `pause` do vídeo ativo e ao mudar a velocidade. Continua visível enquanto o vídeo está pausado, durante o arrasto ou com o mouse sobre os controles.
- **Duração inválida** (`NaN`/`Infinity`, como em transmissões ao vivo): a barra fica desabilitada e só o tempo atual é exibido.
- Novo listener `pause` por vídeo, também registrado uma única vez (controlado pelo mesmo `WeakSet`).

**Bug corrigido durante os testes:** `getActiveVideo()` dava prioridade a qualquer vídeo tocando, mesmo **fora da tela**. Ao pausar o Reel visível, um vídeo invisível que continuasse tocando "roubava" o overlay e os atalhos (inclusive `V` para retomar). Agora só um vídeo tocando **e visível** tem prioridade. Depois vem o mais visível e, por último, qualquer vídeo tocando.

**Testes:** a simulação em Node foi estendida e passou. Cobre:
- o arrasto em 50% e 80%, com limite no fim;
- outro `pointerId` sendo ignorado;
- a ausência de propagação;
- o preenchimento e o texto do tempo;
- a visibilidade com o vídeo tocando, pausado e depois retomado;
- a duração infinita;
- o listener `pause` registrado uma única vez.

A tentativa de verificação visual com Chrome headless foi inconclusiva: no modo headless, `IntersectionObserver` e `requestAnimationFrame` não rodaram de forma consistente. O layout na borda inferior apareceu em uma das capturas, mas o visual final deve ser conferido pelo usuário (item 8 do roteiro).

## Iteração 3 — Tempo à esquerda ✅
- O texto do tempo, que ficava à direita, cobria o controle de volume do Instagram. Agora ele é o primeiro item da linha, antes da velocidade, e os controles ficam todos à esquerda. A margem automática (`margin-left: auto`) foi removida e há um respiro de 4 px entre o tempo e a velocidade.

## Validação no navegador ✅
- 2026-11-17: o usuário executou o roteiro de testes do README no Chrome, com o Instagram real, e todos os itens funcionaram.

## Iteração 4 — Repositório, documentação e inglês ✅
- Repositório git criado e publicado em https://github.com/AlanRedael/IG-Video-Controller (`main`). O `.gitattributes` fixa finais de linha LF, para o `check-security.sh` não quebrar no Windows, e o `.gitignore` exclui o `.zip`.
- Tag `v1.0.0` publicada. A Release no GitHub ainda precisa ser criada pelo usuário, porque o `gh` não está instalado e o uso da credencial do git na API foi bloqueado pela permissão do Claude Code.
- Nova pasta `docs/release-notes/`, com um arquivo por versão (`v1.0.0.md`) e um `README.md` com o passo a passo de release.
- `README.md` passou a ser em inglês. Este arquivo continua em português, e `PROGRESS-EN.md` é a versão em inglês.
- Comentários do `content.js` e do `check-security.sh` traduzidos para inglês. As mensagens de saída do script também, para não misturar idiomas: o resultado agora é `RESULT: PASSED` / `RESULT: FAILED`. Nenhuma lógica foi alterada.
- Ficaram em português, de propósito: os rótulos da interface (`1,5x`, com vírgula, como na especificação) e a `description` do `manifest.json`, que a especificação manda usar exatamente como está.

## Iteração 5 — Regras de trabalho (CLAUDE.md) ✅
- Novo `CLAUDE.md`, com regras para quem desenvolver o projeto com o Claude Code:
  - nunca expor credenciais;
  - commits agrupados por contexto;
  - Conventional Commits 1.0.0;
  - Semantic Versioning 2.0.0.
- Inclui também um resumo das restrições de segurança da especificação original, para que fiquem registradas no repositório.

## Iteração 6 — Versão 1.0.1 ✅
- A `description` do `manifest.json` passou para o inglês, a pedido do usuário. Isso substitui a decisão da iteração 4 de mantê-la em português.
- Mudança visível ao usuário em arquivo distribuído, sem alterar comportamento, então é um PATCH pelo SemVer: versão **1.0.1**, tag `v1.0.1` e notas em `docs/release-notes/v1.0.1.md`.
- O `CLAUDE.md` passou a pedir versionamento proativo: sempre que a mudança justificar uma nova versão, o bump e a release fazem parte da tarefa.

## Iteração 7 — Botão de play/pause (versão 1.1.0) ✅
- No feed principal, clicar no vídeo abre o post, então a única forma de pausar sem sair do feed era o atalho `V`.
- Novo botão redondo **à esquerda da barra de progresso**, na mesma linha; a barra encolhe para dar espaço. Ele chama o mesmo `togglePlay()` do `V` e interrompe a propagação de `pointerdown`/`pointerup`/`mousedown`/`mouseup`/`click`, como os outros controles, para o Instagram não abrir o post.
- O ícone é desenhado com bordas CSS (triângulo para play, duas barras para pause) em vez de caracteres Unicode, que alguns sistemas mostram como emoji. Ele é atualizado no mesmo loop de animação que atualiza a barra, então também acompanha pausas feitas pelo `V` ou pelo próprio Instagram.
- Controle novo no overlay, sem mudar o comportamento existente: MINOR pelo SemVer, versão **1.1.0**. Manifest e permissões inalterados.
- Ainda não testado no Instagram real: item 9 do roteiro do README.

## Limitações conhecidas
- Se a extensão for recarregada sem recarregar a página, o script antigo (órfão) continua ativo na aba até a página ser recarregada. O Chrome não injeta o novo script em abas já abertas, então não há duplicação. Detectar o script órfão exigiria `chrome.runtime`, que é proibido.
- Pausar com `V` chama `video.pause()` diretamente, e o ícone de play/pause do próprio Instagram pode não refletir a mudança na hora.
