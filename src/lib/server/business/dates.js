/**
 * Small, dependency-free date helpers used by business rules and route loads.
 *
 * mysql2 returns DATE columns as JavaScript Date objects (the pool is pinned to
 * timezone 'Z'), but the stored values are calendar dates without a time
 * component. To avoid off-by-one errors across timezones we always reduce a
 * value to a *local* midnight Date before comparing/formatting.
 */

export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The calendar date (local midnight) of a DATE/DATETIME value, or null. */
export function dateOnly(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** True when the date is strictly in the past (yesterday or earlier). */
export function isPast(value) {
  const d = dateOnly(value);
  if (!d) return false;
  return d < todayDate();
}

/** Whole days from today to `value` (positive = future, negative = past). */
export function daysFromToday(value) {
  const d = dateOnly(value);
  if (!d) return null;
  return Math.round((d - todayDate()) / 86400000);
}

/** Format a DATE/DATETIME value as YYYY-MM-DD (local calendar date). */
export function formatDate(value) {
  const d = dateOnly(value);
  if (!d) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
