# IG Video Controller

Extensão para o Google Chrome (Manifest V3) que adiciona um **controlador de vídeo** aos vídeos do Instagram (feed, Reels e Stories) em `https://www.instagram.com/*`.

A extensão faz **somente** controle de reprodução: velocidade, avançar/voltar e pausar.

## Atalhos

| Ação | Atalho | Botão no overlay |
|---|---|---|
| Velocidade normal (1x) | `R` | `1x` |
| Velocidade 1,5x | `G` | `1,5x` |
| Velocidade 2x | `H` | `2x` |
| Diminuir velocidade (−0,25x) | `S` | — |
| Aumentar velocidade (+0,25x) | `D` | — |
| Voltar 5 segundos | `Z` | — |
| Avançar 5 segundos | `X` | — |
| Pausar / retomar | `V` | — |

- A velocidade fica sempre entre **0,25x e 4x**.
- Um overlay discreto aparece na **borda inferior do vídeo** com o tempo (`0:12 / 0:45`), a velocidade atual, os botões `1x`, `1,5x` e `2x` (todos alinhados à esquerda) e uma **barra de progresso**.
  - O overlay fica oculto e aparece quando você passa o mouse sobre o vídeo, pausa o vídeo ou muda a velocidade. Enquanto o vídeo está pausado ele continua visível; durante a reprodução, some após ~2 s sem interação.
  - A barra é fina. Com o mouse em cima, ela engrossa e mostra uma bolinha. **Clique ou arraste** para ir a outro ponto do vídeo.
- A velocidade escolhida **continua valendo ao trocar de Reel/vídeo** enquanto a aba estiver aberta. Ao recarregar a página, ela volta para 1x (não há persistência entre sessões).
- Os atalhos **não funcionam** enquanto você digita (DMs, comentários, busca) nem quando `Ctrl`, `Alt` ou `Cmd` estão pressionados.

## Privacidade

**A extensão não coleta, armazena nem transmite nenhum dado.**

- Não faz nenhuma requisição de rede.
- Não usa armazenamento (`chrome.storage`, cookies, `localStorage` etc.).
- Não tem service worker em segundo plano, popup nem página de opções.
- Só lê os elementos `<video>` da página. Não lê textos, nomes de usuário, legendas, comentários ou mensagens.
- Nunca registra as teclas digitadas.
- Todo o código está em um único arquivo legível, `content.js`, sem bibliotecas de terceiros.

## Permissões exibidas na instalação

A extensão **não declara nenhuma permissão**. O único acesso é a execução do script em `https://www.instagram.com/*`, então o Chrome deve mostrar apenas algo como:

> **Ler e alterar seus dados em www.instagram.com**

Se aparecer qualquer outro aviso, não instale e verifique os arquivos.

## Instalação (modo desenvolvedor)

1. Extraia `ig-video-controller.zip` para uma pasta (ou use esta pasta diretamente).
2. No Chrome, abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor** (canto superior direito).
4. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
5. Abra ou recarregue `https://www.instagram.com/`.

## Verificação de segurança (para desenvolvedores)

```bash
bash scripts/check-security.sh            # verifica a pasta e o zip, se existir
bash scripts/check-security.sh outro.zip  # verifica um zip específico
```

Requer apenas `bash`, `grep` e Python 3 (biblioteca padrão). Retorna código `0` se tudo estiver aprovado.

## Roteiro de testes

Depois de carregar a extensão, faça estes testes e marque cada item:

- [ ] **1. Aviso de instalação:** em `chrome://extensions` → *Detalhes* da extensão, o Chrome mostra apenas acesso a `www.instagram.com`, sem nenhuma outra permissão.
- [ ] **2. Rede:** com o Instagram aberto, abra DevTools (`F12`) → aba **Network**. Copie o ID da extensão em `chrome://extensions` e cole no filtro (ou filtre por `chrome-extension://`). Navegue e use os atalhos. **Nenhuma requisição** deve aparecer.
- [ ] **3. Predefinições:** em um vídeo, pressione `R`, `G` e `H` e clique nos botões `1x`, `1,5x` e `2x`. A velocidade muda e o overlay mostra o valor correto. Clicar num botão **não** pausa o vídeo.
- [ ] **4. Persistência na sessão:** com 2x ativo, passe por vários Reels. A velocidade continua em 2x.
- [ ] **5. Instância única:** com a aba do Instagram aberta, recarregue a extensão em `chrome://extensions`, volte à aba, recarregue a página e navegue. Existe um único overlay, e cada tecla muda a velocidade uma única vez (por exemplo, `D` a partir de 1x vai para 1,25x, não para 1,5x).
- [ ] **6. Privacidade de digitação:** digite `g`, `h`, `s`, `d` numa DM, num comentário ou na busca. O vídeo **não** muda e as letras aparecem normalmente no campo.
- [ ] **7. Limites:** pressione `D` várias vezes; a velocidade para em **4x**. Pressione `S` várias vezes; ela para em **0,25x**.
- [ ] **8. Barra de progresso:**
  - Com o vídeo tocando, o overlay só aparece ao passar o mouse sobre o vídeo e some ~2 s depois de o mouse parar.
  - Ao pausar (clicando no vídeo ou com `V`), o overlay aparece e **permanece** visível.
  - Com o mouse sobre a barra, ela engrossa e aparece a bolinha.
  - Clicar ou arrastar na barra muda a posição do vídeo sem pausá-lo nem retomá-lo, e o tempo `0:12 / 0:45` acompanha.
  - Durante o arrasto, soltar o mouse fora do vídeo não causa nenhum clique no Instagram.
- [ ] **Extra:** `Z`/`X` voltam/avançam 5 s; `V` pausa e retoma.
