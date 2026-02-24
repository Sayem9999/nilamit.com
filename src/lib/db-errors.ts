export function isDatabaseUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown };
  return maybeError.code === 'P1001';
}
