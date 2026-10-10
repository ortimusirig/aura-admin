const BASE_PATH = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '');

/** URL of a file in the public folder, honouring `VITE_BASE_PATH`. */
export function publicUrl(file: string): string {
  return `${BASE_PATH}/${file}`;
}
