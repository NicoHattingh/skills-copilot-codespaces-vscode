export type ParsedCondition =
  | { kind: "true" }
  | { kind: "null_check"; field: string; operator: "==" | "!=" };

export function parseCondition(condition: string): ParsedCondition | undefined {
  const trimmed = condition.trim();
  if (trimmed === "true") {
    return { kind: "true" };
  }

  const match = trimmed.match(/^([a-zA-Z0-9_]+)\s*(==|!=)\s*null$/);
  if (match) {
    const [, field, operator] = match;
    return {
      kind: "null_check",
      field,
      operator: operator as "==" | "!=",
    };
  }

  return undefined;
}

export function evaluateCondition(
  parsed: ParsedCondition,
  input: Record<string, unknown>
): boolean {
  switch (parsed.kind) {
    case "true":
      return true;
    case "null_check": {
      const value = input[parsed.field];
      if (parsed.operator === "==") {
        return value == null;
      }
      return value != null;
    }
    default:
      return false;
  }
}
