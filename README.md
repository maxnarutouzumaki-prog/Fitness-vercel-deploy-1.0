# Fitness — assistente pessoal (etapa 3: fichas próprias, imagens e alimentação)

App de fitness minimalista, feito para o celular (PWA). Sem conta e sem login: cada pessoa que abrir o link usa **os próprios dados, salvos só no aparelho**.

**Etapa 3 (nova):** fichas de treino próprias (criar, editar, duplicar, reordenar, excluir; semana segunda a domingo; vários treinos no mesmo dia), biblioteca com 78 exercícios e uma ilustração para cada um, fotos próprias para exercícios personalizados (câmera/galeria, guardadas só no aparelho), Refeições completas (manual, foto com Gemini com revisão obrigatória, equilíbrio alimentar e ideias acessíveis). O plano com IA continua existindo ao lado das fichas.

**Imagens dos exercícios:** são ilustrações esquemáticas (figuras de palitos) criadas para o app, **não são fotos**. Ficam dentro do próprio app: não dependem de internet nem de site externo.

**Banco de dados:** versão 3. A migração só acrescenta (`routines`, `customExercises`, `exerciseImages`); perfil, planos, treinos, check-ins e refeições anteriores são preservados.

**Foto da refeição:** usa a mesma função (Vercel) e a mesma `GEMINI_API_KEY` das etapas anteriores (nada novo a configurar). A foto só é enviada quando você toca em “Analisar com IA”; o resultado é sempre uma estimativa aproximada que você revisa antes de salvar. Sem Gemini, o registro manual continua funcionando.

## Publicar na Vercel (só pelo celular)

A Vercel publica a partir de um repositório do GitHub (ela não tem "arrastar e soltar" no site). O jeito mais simples:

1. No Safari do iPhone, abra o seu repositório no **github.com** e use **Aa → Versão para computador** (assim aparece **Add file → Upload files**).
2. Descompacte `fitness-vercel-deploy.zip` e envie **todos os arquivos e as pastas `api` e `lib`** para a raiz do repositório (pode substituir os que já existem). Faça **Commit changes**. Se preferir, crie um repositório novo e vazio só para isso.
3. Entre em **vercel.com** com sua conta do GitHub → **Add New… → Project** → escolha o repositório → **Import**.
4. Na tela de configuração, deixe **Framework Preset: Other** e **não preencha** Build Command nem Output Directory (o `vercel.json` já diz isso). Antes de publicar, abra **Environment Variables** e crie:
   - Nome: `GEMINI_API_KEY`
   - Valor: sua chave do Google AI Studio (aistudio.google.com/apikey; não ative cobrança)
5. Toque em **Deploy**. Quando terminar, abra o link `.vercel.app`.
6. Se você adicionar ou mudar a chave depois, faça **Deployments → ⋯ → Redeploy** (variáveis só valem em novos deploys).

A função fica em `/api/gemini`. Para conferir: abra `https://SEU-APP.vercel.app/api/gemini` no navegador; deve aparecer `{"ok":false,"code":"bad_request"}` (isso significa que a função existe). Se aparecer "404", a pasta `api` (ou `lib`) não foi enviada.

Opcionais (mesmo lugar das variáveis): `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TIMEOUT_MS`, `ALLOWED_ORIGINS`.

## Publicar usando só o celular (GitHub Pages, grátis)

1. No Safari, crie uma conta em github.com.
2. Crie um repositório **público** vazio (botão **+ → New repository**), por exemplo `meu-fitness`.
3. Coloque os arquivos deste projeto no repositório (branch `main`). O arquivo `.github/workflows/deploy.yml` já faz o resto.
4. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Aba **Actions**: aguarde o fluxo "Publicar no GitHub Pages" ficar verde (1–3 minutos).
6. Seu app estará em `https://SEU-USUARIO.github.io/meu-fitness/`. Compartilhe esse link com seu amigo.

### Instalar no iPhone
Abra o link no **Safari → Compartilhar → Adicionar à Tela de Início**. Instalado, o app abre em tela cheia e o iOS mantém os dados com mais segurança.

## Alternativa: testar no navegador com GitHub Codespaces
No repositório, **Code → Codespaces → Create codespace**. Ao abrir, o ambiente roda `npm install` sozinho. No terminal do Codespaces, rode `npm run dev` e abra a porta 5173 que aparecer.

## Comandos (para quem tiver um ambiente de desenvolvimento)
- `npm install` — instala dependências
- `npm run dev` — modo de desenvolvimento
- `npm run build` — gera a versão de produção em `dist/`
- `npm run preview` — serve a versão de produção
- `npm run typecheck` — verifica os tipos
- `npm test` — roda os testes (Vitest)

## Estrutura
```
src/
  domain/      tipos e regras puras (modelos, temas, interpretação da evolução)
  data/        IndexedDB: db.ts (conexão/migrações) e repositories.ts
  services/    resumo da tela Início; esboços de IA e backup (sem implementação)
  state/       estado do app e aplicação imediata de tema/modo noite
  components/  Card, TabBar, Icon, elementos de interface
  screens/     Início, Treino, Refeições, Evolução, Perfil, Onboarding
  styles/      tokens.css (ÚNICA fonte das cores), base.css, components.css
public/        manifest, service worker (sw.js) e ícones
tests/         testes de regras e persistência
```

## Notas
- Cores: somente em `src/styles/tokens.css`. Texto/links usam uma variante mais escura de cada tema (`--accent-ink`) para manter contraste em fundo branco.
- IA futura: exige backend seguro; nenhuma chave de API no frontend (ver `src/services/ai.ts`).
- Service Worker: para forçar atualização do cache, aumente `VERSION` em `public/sw.js`.
