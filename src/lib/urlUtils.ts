export function normalizeExternalUrl(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw) && !/\s/.test(raw)) {
    return `https://${raw}`;
  }

  return null;
}
