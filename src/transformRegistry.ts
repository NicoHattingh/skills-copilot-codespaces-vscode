export type TransformFn = (
  value: unknown,
  args?: Record<string, unknown>
) => unknown;

const registry: Record<string, TransformFn> = {
  minor_to_major: (value, args) => {
    if (typeof value !== "number") {
      return undefined;
    }
    const scale = typeof args?.scale === "number" ? args.scale : 2;
    const divisor = Math.pow(10, scale);
    return value / divisor;
  },
  iso4217_numeric_to_alpha: (value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const lookup: Record<string, string> = {
      "840": "USD",
      "826": "GBP",
      "978": "EUR",
      "036": "AUD",
    };
    return lookup[value] ?? undefined;
  },
  derive_bin: (value, args) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const length = typeof args?.length === "number" ? args.length : 6;
    return value.slice(0, length);
  },
};

export function hasTransform(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, name);
}

export function executeTransform(
  name: string,
  value: unknown,
  args?: Record<string, unknown>
): unknown {
  const fn = registry[name];
  if (!fn) {
    throw new Error(`Transform function not found: ${name}`);
  }
  return fn(value, args);
}

export function listTransforms(): string[] {
  return Object.keys(registry);
}
