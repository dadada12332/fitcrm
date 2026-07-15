// Санитизация пользовательского ввода перед подстановкой в PostgREST-фильтр .or(...).
// Убирает метасимволы грамматики (,()*\%), которые ломают фильтр или подмешивают
// условия, и ограничивает длину. Использовать для любого ilike-поиска внутри .or().
export function sanitizeSearchTerm(input: string, maxLen = 60): string {
  return (input ?? "")
    .trim()
    .slice(0, maxLen)
    .replace(/[,()*\\%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
