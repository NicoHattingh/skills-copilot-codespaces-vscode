import {
  DefinitionsIndex,
  MappingExecutionResult,
  MappingRule,
  MappingSet,
  TraceEntry,
} from "./types";
import { validateMappingSet } from "./validator";
import { parseCondition, evaluateCondition } from "./conditions";
import { executeTransform } from "./transformRegistry";

function getFieldDefinition(index: DefinitionsIndex, fieldId: string) {
  return index.fieldsById.get(fieldId);
}

function validateValueAgainstField(
  fieldId: string,
  value: unknown,
  index: DefinitionsIndex
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const field = getFieldDefinition(index, fieldId);
  if (!field) {
    return undefined;
  }

  switch (field.type) {
    case "string":
    case "date":
    case "datetime":
      if (typeof value !== "string") {
        return `Field ${fieldId} expected string-compatible value but received ${typeof value}`;
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `Field ${fieldId} expected integer but received ${typeof value}`;
      }
      break;
    case "decimal":
      if (typeof value !== "number") {
        return `Field ${fieldId} expected decimal number but received ${typeof value}`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return `Field ${fieldId} expected boolean but received ${typeof value}`;
      }
      break;
    default:
      break;
  }

  return undefined;
}

function executeRule(
  rule: MappingRule,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  warnings: string[],
  trace: TraceEntry[]
) {
  if ("choose_from" in rule && rule.choose_from) {
    executeConditionalRule(rule, input, output, warnings, trace);
    return;
  }

  if ("transform" in rule && rule.transform) {
    executeTransformRule(rule, input, output, warnings, trace);
    return;
  }

  if ("const" in rule && rule.const !== undefined) {
    executeConstRule(rule, output, trace);
    return;
  }

  if ("from" in rule && rule.from) {
    executeDirectRule(rule, input, output, warnings, trace);
  }
}

function executeDirectRule(
  rule: MappingRule,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  warnings: string[],
  trace: TraceEntry[]
) {
  if (!("from" in rule) || !rule.from) {
    return;
  }
  const value = input[rule.from.field];
  if (value === undefined) {
    warnings.push(
      `Direct rule ${rule.id ?? "<unnamed>"}: source field ${rule.from.field} is missing in input`
    );
  }
  output[rule.to.field] = value;
  trace.push({
    ruleId: rule.id,
    type: "direct",
    fromField: rule.from.field,
    toField: rule.to.field,
  });
}

function executeTransformRule(
  rule: MappingRule,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  warnings: string[],
  trace: TraceEntry[]
) {
  if (!("from" in rule) || !rule.from || !rule.transform) {
    return;
  }
  const value = input[rule.from.field];
  if (value === undefined) {
    warnings.push(
      `Transform rule ${rule.id ?? "<unnamed>"}: source field ${rule.from.field} is missing in input`
    );
  }
  try {
    const result = executeTransform(rule.transform.fn, value, rule.transform.args);
    if (result === undefined) {
      warnings.push(
        `Transform rule ${rule.id ?? "<unnamed>"}: transform ${rule.transform.fn} returned undefined`
      );
    }
    output[rule.to.field] = result;
  } catch (error) {
    warnings.push(
      `Transform rule ${rule.id ?? "<unnamed>"}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    output[rule.to.field] = undefined;
  }
  trace.push({
    ruleId: rule.id,
    type: "transform",
    fromField: rule.from.field,
    toField: rule.to.field,
    transformFn: rule.transform.fn,
  });
}

function executeConstRule(
  rule: MappingRule,
  output: Record<string, unknown>,
  trace: TraceEntry[]
) {
  if (!("const" in rule)) {
    return;
  }
  output[rule.to.field] = rule.const;
  trace.push({
    ruleId: rule.id,
    type: "const",
    toField: rule.to.field,
  });
}

function executeConditionalRule(
  rule: MappingRule,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  warnings: string[],
  trace: TraceEntry[]
) {
  if (!("choose_from" in rule) || !rule.choose_from) {
    return;
  }

  let matched = false;
  for (const option of rule.choose_from) {
    const parsed = parseCondition(option.when);
    if (!parsed) {
      warnings.push(
        `Conditional rule ${rule.id ?? "<unnamed>"}: unsupported condition '${option.when}'`
      );
      continue;
    }
    if (!evaluateCondition(parsed, input)) {
      continue;
    }
    matched = true;
    if (option.from?.field) {
      const value = input[option.from.field];
      if (value === undefined) {
        warnings.push(
          `Conditional rule ${rule.id ?? "<unnamed>"}: source field ${option.from.field} is missing in input`
        );
      }
      output[rule.to.field] = value;
    } else {
      output[rule.to.field] = option.const;
    }
    break;
  }

  if (!matched) {
    warnings.push(
      `Conditional rule ${rule.id ?? "<unnamed>"}: no conditions matched`
    );
  }

  trace.push({
    ruleId: rule.id,
    type: "conditional",
    toField: rule.to.field,
  });
}

export function executeMappingSet(
  mappingSet: MappingSet,
  input: Record<string, unknown>,
  index: DefinitionsIndex
): MappingExecutionResult {
  const validation = validateMappingSet(mappingSet, index);
  if (validation.errors.length > 0) {
    return {
      valid: false,
      output: {},
      errors: validation.errors,
      warnings: validation.warnings,
      trace: [],
    };
  }

  const warnings: string[] = [...validation.warnings];
  const errors: string[] = [];
  const output: Record<string, unknown> = {};
  const trace: TraceEntry[] = [];

  for (const rule of mappingSet.mappings) {
    executeRule(rule, input, output, warnings, trace);
  }

  for (const [fieldId, value] of Object.entries(output)) {
    const warning = validateValueAgainstField(fieldId, value, index);
    if (warning) {
      warnings.push(warning);
    }
  }

  return {
    valid: errors.length === 0,
    output,
    warnings,
    errors,
    trace,
  };
}

export function executeMappingSetById(
  mappingSetId: string,
  input: Record<string, unknown>,
  index: DefinitionsIndex
): MappingExecutionResult {
  const mappingSet = index.mappingSetsById.get(mappingSetId);
  if (!mappingSet) {
    return {
      valid: false,
      output: {},
      warnings: [],
      errors: [`Mapping set ${mappingSetId} not found`],
      trace: [],
    };
  }

  return executeMappingSet(mappingSet, input, index);
}
