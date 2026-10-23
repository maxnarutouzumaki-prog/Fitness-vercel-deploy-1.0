# Fitness — versão para Vercel

Mesmo aplicativo; só a hospedagem da função de IA mudou.

## Publicar na Vercel (só pelo celular)

A Vercel publica a partir de um repositório do GitHub.

1. No Safari, abra seu repositório no github.com (use **Aa → Versão para computador**).
2. Se já existir o arquivo antigo `fitness-vercel-deploy/api/gemini.mjs`, abra-o, toque em **⋯ → Delete file** e confirme em **Commit changes**. (Ele foi trocado por `gemini.js`.)
3. **Add file → Upload files** e envie a pasta **`fitness-vercel-deploy`** inteira (descompacte o zip no app Arquivos primeiro). Toque em **Commit changes**.
4. Na Vercel, abra o projeto → **Settings → General → Root Directory** → digite `fitness-vercel-deploy` → **Save**.
5. **Settings → Environment Variables** → crie `GEMINI_API_KEY` com a sua chave (aistudio.google.com/apikey; não ative cobrança) → **Save**.
6. **Deployments** → toque nos três pontinhos do último → **Redeploy**.
7. Para conferir a função, abra `https://SEU-APP.vercel.app/api/gemini` no navegador. Se aparecer `{"ok":false,"code":"bad_request"}`, está funcionando.

Opcionais: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_TIMEOUT_MS`, `ALLOWED_ORIGINS`.
