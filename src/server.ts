import express, { Request, Response } from "express";
import path from "path";
import { loadDefinitions } from "./loader";
import { DefinitionsIndex } from "./types";
import { validateMappingSet } from "./validator";
import { executeMappingSetById } from "./executor";

const app = express();
app.use(express.json());

let definitionsIndex: DefinitionsIndex | null = null;

async function bootstrapDefinitions(): Promise<void> {
  const definitionsDir = path.join(__dirname, "..", "definitions");
  definitionsIndex = await loadDefinitions(definitionsDir);
}

function ensureDefinitionsLoaded(res: Response): DefinitionsIndex | null {
  if (!definitionsIndex) {
    res.status(503).json({ error: "Definitions not loaded" });
    return null;
  }
  return definitionsIndex;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/mappings/:id", (req: Request, res: Response) => {
  const index = ensureDefinitionsLoaded(res);
  if (!index) {
    return;
  }
  const mappingSet = index.mappingSetsById.get(req.params.id);
  if (!mappingSet) {
    res.status(404).json({ error: `Mapping set ${req.params.id} not found` });
    return;
  }
  res.json(mappingSet);
});

app.post("/validate/:id", (req: Request, res: Response) => {
  const index = ensureDefinitionsLoaded(res);
  if (!index) {
    return;
  }
  const mappingSet = index.mappingSetsById.get(req.params.id);
  if (!mappingSet) {
    res.status(404).json({ error: `Mapping set ${req.params.id} not found` });
    return;
  }
  const result = validateMappingSet(mappingSet, index);
  res.json(result);
});

app.post("/run", (req: Request, res: Response) => {
  const index = ensureDefinitionsLoaded(res);
  if (!index) {
    return;
  }
  const { mapping_set_id: mappingSetId, input } = req.body ?? {};
  if (!mappingSetId || typeof mappingSetId !== "string") {
    res.status(400).json({ error: "mapping_set_id is required" });
    return;
  }
  if (typeof input !== "object" || input === null) {
    res.status(400).json({ error: "input must be an object" });
    return;
  }

  const result = executeMappingSetById(mappingSetId, input, index);
  res.json(result);
});

async function start() {
  try {
    await bootstrapDefinitions();
  } catch (error) {
    console.error("Failed to load definitions", error);
    process.exit(1);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    console.log(`ISO Mapper prototype listening on port ${port}`);
  });
}

start();
