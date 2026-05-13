const REF_RE = /\{([^}]+)\}/g;

export function resolveRef(value: string, tokens: Record<string, unknown>, depth = 0): string {
  if (depth > 10) return value; // 무한 루프 방지 (circular ref 등)
  return value.replace(REF_RE, (_, path: string) => {
    const resolved = getPath(tokens, path);
    if (resolved === null || resolved === undefined) return `{${path}}`;
    if (typeof resolved === 'string') return resolveRef(resolved, tokens, depth + 1);
    if (typeof resolved === 'number') return String(resolved);
    return `{${path}}`;
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
