import {
  Activity, Apple, Armchair, Dumbbell, Equal, Footprints, TrendingDown, TrendingUp, Zap,
} from 'lucide-react-native';

// Mismos valores que los enums de Prisma y que la versión Web.

export const SEX_OPTIONS = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];

export const ACTIVITY_OPTIONS = [
  { value: 'SEDENTARY', label: 'Sedentario', desc: 'Pasa la mayor parte del tiempo sentado', Icon: Armchair },
  { value: 'LIGHT', label: 'Ligero', desc: 'Camina un poco o hace ejercicio ligero 1–2 veces por semana', Icon: Footprints },
  { value: 'MODERATE', label: 'Moderado', desc: 'Entrena de 3 a 5 veces por semana', Icon: Dumbbell },
  { value: 'ACTIVE', label: 'Activo', desc: 'Entrena de 6 a 7 veces por semana', Icon: Activity },
  { value: 'VERY_ACTIVE', label: 'Muy activo', desc: 'Entrena intensamente casi todos los días', Icon: Zap },
];

export const GOAL_OPTIONS = [
  { value: 'LOSE_WEIGHT', label: 'Perder peso', subtitle: 'Déficit calórico', Icon: TrendingDown },
  { value: 'MAINTAIN', label: 'Mantener el peso', subtitle: 'Equilibrio calórico', Icon: Equal },
  { value: 'GAIN_MUSCLE', label: 'Ganar masa muscular', subtitle: 'Superávit + proteína', Icon: Dumbbell },
  { value: 'GAIN_WEIGHT', label: 'Aumentar de peso', subtitle: 'Superávit calórico', Icon: TrendingUp },
  { value: 'MODIFY_DIET', label: 'Modificar mi dieta', subtitle: 'Cambiar hábitos', Icon: Apple },
];

// Rangos que valida el backend (routes/user.routes.js)
export const LIMITS = {
  age: { min: 13, max: 100 },
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 80, max: 260 },
  dailyCalorieGoal: { min: 500, max: 8000 },
  dailyProteinGoalG: { min: 0, max: 500 },
  dailyCarbsGoalG: { min: 0, max: 900 },
  dailyFatGoalG: { min: 0, max: 400 },
};

export const findOption = (options, value) => options.find((o) => o.value === value) || null;

/** Convierte un texto del teclado a número (acepta coma decimal). */
export const toNumber = (text) => Number(String(text).replace(',', '.').trim());

/** Devuelve un mensaje de error si el valor está fuera de rango, o null. */
export function checkRange(key, label, text, { integer = false } = {}) {
  const { min, max } = LIMITS[key];
  const n = toNumber(text);
  if (text === '' || text === null || text === undefined || Number.isNaN(n)) return `Completá ${label.toLowerCase()}.`;
  if (integer && !Number.isInteger(n)) return `${label} tiene que ser un número entero.`;
  if (n < min || n > max) return `${label} tiene que estar entre ${min} y ${max}.`;
  return null;
}

/**
 * Edad a partir de la fecha de nacimiento (misma lógica que el backend, utils/age.js).
 * La fecha llega como "1998-05-10T00:00:00.000Z": se leen sus componentes en UTC.
 */
export function ageFromBirthDate(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getUTCFullYear();
  const beforeBirthday = today.getMonth() < b.getUTCMonth()
    || (today.getMonth() === b.getUTCMonth() && today.getDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Edad a mostrar: calculada desde la fecha de nacimiento. */
export const displayAge = (profile) => ageFromBirthDate(profile?.birthDate) ?? profile?.age ?? null;

/**
 * Valida día/mes/año escritos a mano y devuelve { iso: 'AAAA-MM-DD', age } o { error }.
 */
export function parseBirthDate(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!day || !month || !year) return { error: 'Completá tu fecha de nacimiento.' };
  if (String(year).length !== 4 || !Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { error: 'Revisá la fecha de nacimiento (día, mes y año de 4 cifras).' };
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { error: 'Esa fecha no existe. Revisá el día y el mes.' };
  }
  const age = ageFromBirthDate(date);
  const { min, max } = LIMITS.age;
  if (age < min || age > max) return { error: `Tenés que tener entre ${min} y ${max} años para usar la app.` };
  const pad = (n) => String(n).padStart(2, '0');
  return { iso: `${y}-${pad(m)}-${pad(d)}`, age };
}
