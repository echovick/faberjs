export function env(key: string): string | undefined;
export function env(key: string, fallback: string): string;
export function env(key: string, fallback: number): number;
export function env(key: string, fallback: boolean): boolean;
export function env<T extends string | number | boolean>(
  key: string,
  fallback?: T,
): string | T | undefined {
  const raw = process.env[key];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  if (typeof fallback === 'number') return Number(raw) as T;
  if (typeof fallback === 'boolean') return (raw === 'true' || raw === '1') as T;

  return raw;
}
