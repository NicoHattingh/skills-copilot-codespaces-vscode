import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import YAML from "yaml";
import {
  DefinitionsIndex,
  FieldDefinition,
  MappingSet,
  MessageDefinition,
} from "./types";

async function readDefinitionFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(raw) as T;
  }
  if (ext === ".json") {
    return JSON.parse(raw) as T;
  }
  throw new Error(`Unsupported definition file extension: ${filePath}`);
}

async function loadFields(definitionsDir: string): Promise<FieldDefinition[]> {
  const yamlPath = path.join(definitionsDir, "fields.yaml");
  const ymlPath = path.join(definitionsDir, "fields.yml");
  const jsonPath = path.join(definitionsDir, "fields.json");

  for (const candidate of [yamlPath, ymlPath, jsonPath]) {
    try {
      await fs.access(candidate);
      return readDefinitionFile<FieldDefinition[]>(candidate);
    } catch {
      continue;
    }
  }

  throw new Error("fields definition file not found");
}

async function loadMessages(definitionsDir: string): Promise<MessageDefinition[]> {
  const files = await glob("**/*.@(yaml|yml|json)", {
    cwd: path.join(definitionsDir, "messages"),
    absolute: true,
    nodir: true,
  });

  const results: MessageDefinition[] = [];
  for (const file of files) {
    const message = await readDefinitionFile<MessageDefinition>(file);
    results.push(message);
  }
  return results;
}

async function loadMappingSets(definitionsDir: string): Promise<MappingSet[]> {
  const files = await glob("**/*.@(yaml|yml|json)", {
    cwd: path.join(definitionsDir, "mappings"),
    absolute: true,
    nodir: true,
  });

  const results: MappingSet[] = [];
  for (const file of files) {
    const mappingSet = await readDefinitionFile<MappingSet>(file);
    results.push(mappingSet);
  }
  return results;
}

export async function loadDefinitions(definitionsDir: string): Promise<DefinitionsIndex> {
  const [fields, messages, mappingSets] = await Promise.all([
    loadFields(definitionsDir),
    loadMessages(definitionsDir),
    loadMappingSets(definitionsDir),
  ]);

  const fieldsById = new Map<string, FieldDefinition>();
  for (const field of fields) {
    fieldsById.set(field.id, field);
  }

  const messagesById = new Map<string, MessageDefinition>();
  for (const message of messages) {
    messagesById.set(message.id, message);
  }

  const mappingSetsById = new Map<string, MappingSet>();
  for (const mappingSet of mappingSets) {
    mappingSetsById.set(mappingSet.id, mappingSet);
  }

  return {
    fieldsById,
    messagesById,
    mappingSetsById,
  };
}
