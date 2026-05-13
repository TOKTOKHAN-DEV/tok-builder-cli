const REF_RE = /\{([^}]+)\}/g;

export function resolveRef(value: string, tokens: Record<string, unknown>): string {
  return value.replace(REF_RE, (_, path: string) => {
    const resolved = getPath(tokens, path);
    return typeof resolved === 'string' ? resolved : `{${path}}`;
  });
}

export function resolveAllRefs<T extends Record<string, unknown>>(
  obj: T,
  tokens: Record<string, unknown>,
): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, val: unknown) =>
      typeof val === 'string' ? resolveRef(val, tokens) : val,
    ),
  ) as T;
}

export function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let node = obj;
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}
