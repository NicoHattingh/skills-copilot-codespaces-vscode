export type FieldType = "string" | "integer" | "decimal" | "boolean" | "date" | "datetime";
export type FieldStructure = "scalar" | "object" | "repeated";

export interface FieldConstraints {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  length?: number;
  pattern?: string;
  enum?: string[];
}

export interface FieldDefinition {
  id: string;
  label?: string;
  description?: string;
  type: FieldType;
  structure?: FieldStructure;
  constraints?: FieldConstraints;
  semantic_tags?: string[];
}

export interface MessageLayoutFieldRef {
  ref: string;
}

export interface MessageLayoutGroup {
  group: string;
  children: MessageLayoutItem[];
}

export type MessageLayoutItem = MessageLayoutFieldRef | MessageLayoutGroup;

export interface MessageDefinition {
  id: string;
  name?: string;
  version: string;
  standard?: string;
  profile?: string;
  layout: MessageLayoutItem[];
  io_binding?: {
    format_kind: string;
    adapter?: string;
    bindings?: Array<{
      layout_ref: string;
      iso8583_mti?: boolean;
      iso8583_de?: number;
      json_path?: string;
      xpath?: string;
    }>;
  };
}

export interface MappingEndpoint {
  field: string;
}

export interface TransformInvocation {
  fn: string;
  args?: Record<string, unknown>;
}

export interface ChooseOption {
  when: string;
  from?: MappingEndpoint;
  const?: unknown;
}

export interface BaseMappingRule {
  id?: string;
  to: MappingEndpoint;
}

export interface DirectMappingRule extends BaseMappingRule {
  from: MappingEndpoint;
  transform?: undefined;
  choose_from?: undefined;
  const?: undefined;
}

export interface TransformMappingRule extends BaseMappingRule {
  from: MappingEndpoint;
  transform: TransformInvocation;
  choose_from?: undefined;
  const?: undefined;
}

export interface ConditionalMappingRule extends BaseMappingRule {
  from?: undefined;
  transform?: undefined;
  choose_from: ChooseOption[];
  const?: undefined;
}

export interface ConstMappingRule extends BaseMappingRule {
  from?: undefined;
  transform?: undefined;
  choose_from?: undefined;
  const: unknown;
}

export type MappingRule =
  | DirectMappingRule
  | TransformMappingRule
  | ConditionalMappingRule
  | ConstMappingRule;

export interface MappingSet {
  id: string;
  description?: string;
  from_message: string;
  to_message: string;
  version: string;
  mappings: MappingRule[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface TraceEntry {
  ruleId?: string;
  type: "direct" | "transform" | "conditional" | "const";
  fromField?: string;
  toField: string;
  transformFn?: string;
  notes?: string;
}

export interface MappingExecutionResult {
  valid: boolean;
  output: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  trace: TraceEntry[];
}

export interface DefinitionsIndex {
  fieldsById: Map<string, FieldDefinition>;
  messagesById: Map<string, MessageDefinition>;
  mappingSetsById: Map<string, MappingSet>;
}
