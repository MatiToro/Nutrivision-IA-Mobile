const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = (n) => String(n).padStart(2, '0');

/** Clave local yyyy-mm-dd (en la zona horaria del teléfono). */
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "Viernes 25 de septiembre" — armado a mano para no depender de Intl en Android. */
export function longDate(date) {
  const s = `${DAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDay(date) {
  return DAYS_SHORT[date.getDay()];
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Lunes de la semana de `date`. */
export function mondayOf(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}
