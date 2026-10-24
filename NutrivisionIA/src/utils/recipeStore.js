/**
 * Memoria de las recetas que se vieron en esta sesión (lista de sugerencias,
 * guardadas y detalles). Así el detalle abre al instante y, al volver, la
 * lista sigue igual. No se guarda en el teléfono: las sugerencias viven en el servidor.
 */
const recipes = new Map();
let lastSuggestions = null;

export function rememberRecipes(list) {
  for (const r of list || []) {
    const prev = recipes.get(r.key);
    // No pisar un detalle completo con un resumen.
    if (!prev || r.detailed || !prev.detailed) recipes.set(r.key, { ...prev, ...r });
  }
}

export const getRecipe = (key) => recipes.get(key) || null;

export function patchRecipe(key, patch) {
  const prev = recipes.get(key);
  if (prev) recipes.set(key, { ...prev, ...patch });
  if (lastSuggestions) {
    lastSuggestions = { ...lastSuggestions, list: lastSuggestions.list.map((r) => (r.key === key ? { ...r, ...patch } : r)) };
  }
}

export function setLastSuggestions(value) {
  lastSuggestions = value;
  rememberRecipes(value?.list);
}

export const getLastSuggestions = () => lastSuggestions;

let owner = null;

/** Si cambió la cuenta, se olvida todo lo de la anterior. */
export function ensureRecipeOwner(profileId) {
  if (owner === profileId) return;
  owner = profileId;
  recipes.clear();
  lastSuggestions = null;
}
