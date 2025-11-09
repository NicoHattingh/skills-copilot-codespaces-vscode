import {
  DefinitionsIndex,
  MappingRule,
  MappingSet,
  ValidationResult,
} from "./types";
import { getMessageFieldSet } from "./messageUtils";
import { hasTransform } from "./transformRegistry";
import { parseCondition } from "./conditions";

export function validateMappingSet(
  mappingSet: MappingSet,
  index: DefinitionsIndex
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sourceMessage = index.messagesById.get(mappingSet.from_message);
  if (!sourceMessage) {
    errors.push(
      `Mapping set ${mappingSet.id}: source message ${mappingSet.from_message} not found`
    );
  }

  const targetMessage = index.messagesById.get(mappingSet.to_message);
  if (!targetMessage) {
    errors.push(
      `Mapping set ${mappingSet.id}: target message ${mappingSet.to_message} not found`
    );
  }

  const sourceFields = sourceMessage ? getMessageFieldSet(sourceMessage) : undefined;
  const targetFields = targetMessage ? getMessageFieldSet(targetMessage) : undefined;

  for (const rule of mappingSet.mappings) {
    validateRule(rule, {
      mappingSet,
      errors,
      warnings,
      index,
      sourceFields,
      targetFields,
    });
  }

  return { errors, warnings };
}

interface RuleValidationContext {
  mappingSet: MappingSet;
  errors: string[];
  warnings: string[];
  index: DefinitionsIndex;
  sourceFields?: Set<string>;
  targetFields?: Set<string>;
}

function validateRule(rule: MappingRule, ctx: RuleValidationContext) {
  const { mappingSet, errors, index, sourceFields, targetFields } = ctx;
  const toField = rule.to?.field;

  if (!toField) {
    errors.push(
      `Mapping set ${mappingSet.id}: rule ${rule.id ?? "<unnamed>"} is missing a target field`
    );
    return;
  }

  if (targetFields && !targetFields.has(toField)) {
    errors.push(
      `Mapping set ${mappingSet.id}: target field ${toField} not found in message ${mappingSet.to_message}`
    );
  }

  if (!index.fieldsById.has(toField)) {
    errors.push(
      `Mapping set ${mappingSet.id}: target field ${toField} is not defined in fields catalog`
    );
  }

  if ("from" in rule && rule.from) {
    const fromField = rule.from.field;
    if (sourceFields && !sourceFields.has(fromField)) {
      errors.push(
        `Mapping set ${mappingSet.id}: source field ${fromField} not found in message ${mappingSet.from_message}`
      );
    }
    if (!index.fieldsById.has(fromField)) {
      errors.push(
        `Mapping set ${mappingSet.id}: source field ${fromField} is not defined in fields catalog`
      );
    }
  }

  if ("transform" in rule && rule.transform) {
    if (!hasTransform(rule.transform.fn)) {
      errors.push(
        `Mapping set ${mappingSet.id}: transform ${rule.transform.fn} referenced in rule ${rule.id ?? "<unnamed>"} is not registered`
      );
    }
  }

  if ("choose_from" in rule && rule.choose_from) {
    if (rule.choose_from.length === 0) {
      errors.push(
        `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} has no options`
      );
    }

    for (const option of rule.choose_from) {
      const parsed = parseCondition(option.when);
      if (!parsed) {
        errors.push(
          `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} has unsupported condition '${option.when}'`
        );
      } else if (parsed.kind === "null_check") {
        if (ctx.sourceFields && !ctx.sourceFields.has(parsed.field)) {
          errors.push(
            `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} references unknown field ${parsed.field} in condition`
          );
        }
      }

      if (option.from?.field) {
        if (sourceFields && !sourceFields.has(option.from.field)) {
          errors.push(
            `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} references source field ${option.from.field} not present in message ${mappingSet.from_message}`
          );
        }
        if (!index.fieldsById.has(option.from.field)) {
          errors.push(
            `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} references undefined field ${option.from.field}`
          );
        }
      }

      if (option.from === undefined && option.const === undefined) {
        errors.push(
          `Mapping set ${mappingSet.id}: conditional rule ${rule.id ?? "<unnamed>"} option is missing 'from' or 'const'`
        );
      }
    }
  }
}
