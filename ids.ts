/** Identificador único curto. Usa crypto quando disponível. */
export function uid(prefix = ''): string {
  let random: string;
  try {
    random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch {
    random = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-6);
  }
  return prefix ? `${prefix}-${random}` : random;
}

/** Slug estável a partir de um nome (usado como chave de exercício vindo do Gemini). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
