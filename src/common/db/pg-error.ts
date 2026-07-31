const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  return extractPgErrorCode(err) === PG_UNIQUE_VIOLATION;
}

function extractPgErrorCode(err: unknown): unknown {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  if ('code' in err) {
    return (err as { code?: unknown }).code;
  }
  if ('cause' in err) {
    return extractPgErrorCode((err as { cause?: unknown }).cause);
  }
  return undefined;
}
