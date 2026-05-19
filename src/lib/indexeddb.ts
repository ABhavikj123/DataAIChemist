import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import { inferSchemaMapping } from "@/lib/file-handler"
import type { AuditRule, FinancialDataset, ScenarioInputs, ValidationIssue } from "@/types"

interface FinOpsDB extends DBSchema {
  datasets: {
    key: string
    value: FinancialDataset
    indexes: { "by-updated": string; "by-type": string }
  }
  validationIssues: {
    key: string
    value: ValidationIssue
    indexes: { "by-dataset": string; "by-severity": string }
  }
  rules: {
    key: string
    value: AuditRule
  }
  settings: {
    key: string
    value: ScenarioInputs
  }
}

let db: IDBPDatabase<FinOpsDB> | null = null

export async function initDB(): Promise<IDBPDatabase<FinOpsDB>> {
  if (!db) {
    db = await openDB<FinOpsDB>("abacum-finops-linter", 2, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("datasets")) {
          const datasets = database.createObjectStore("datasets", { keyPath: "id" })
          datasets.createIndex("by-updated", "updatedAt")
          datasets.createIndex("by-type", "type")
        }

        if (!database.objectStoreNames.contains("validationIssues")) {
          const issues = database.createObjectStore("validationIssues", { keyPath: "id" })
          issues.createIndex("by-dataset", "datasetId")
          issues.createIndex("by-severity", "severity")
        }

        if (!database.objectStoreNames.contains("rules")) {
          database.createObjectStore("rules", { keyPath: "id" })
        }

        if (!database.objectStoreNames.contains("settings")) {
          database.createObjectStore("settings")
        }
      },
    })
  }

  return db
}

export async function saveDataset(dataset: FinancialDataset): Promise<void> {
  const database = await initDB()
  await database.put("datasets", dataset)
}

export async function saveDatasets(datasets: FinancialDataset[]): Promise<void> {
  const database = await initDB()
  const tx = database.transaction("datasets", "readwrite")
  await tx.store.clear()
  for (const dataset of datasets) {
    await tx.store.put(dataset)
  }
  await tx.done
}

export async function getDatasets(): Promise<FinancialDataset[]> {
  const database = await initDB()
  const datasets = await database.getAllFromIndex("datasets", "by-updated")
  return datasets.map((dataset) => ({
    ...dataset,
    schemaMapping: dataset.schemaMapping ?? inferSchemaMapping(dataset.headers),
    appliedRuleIds: dataset.appliedRuleIds ?? [],
  }))
}

export async function deleteDataset(id: string): Promise<void> {
  const database = await initDB()
  const tx = database.transaction(["datasets", "validationIssues"], "readwrite")
  await tx.objectStore("datasets").delete(id)
  const issues = await tx.objectStore("validationIssues").index("by-dataset").getAllKeys(id)
  await Promise.all(issues.map((key) => tx.objectStore("validationIssues").delete(key)))
  await tx.done
}

export async function saveValidationIssues(issues: ValidationIssue[]): Promise<void> {
  const database = await initDB()
  const tx = database.transaction("validationIssues", "readwrite")
  await tx.store.clear()
  for (const issue of issues) {
    await tx.store.put(issue)
  }
  await tx.done
}

export async function getValidationIssues(): Promise<ValidationIssue[]> {
  const database = await initDB()
  return database.getAll("validationIssues")
}

export async function saveRules(rules: AuditRule[]): Promise<void> {
  const database = await initDB()
  const tx = database.transaction("rules", "readwrite")
  await tx.store.clear()
  for (const rule of rules) {
    await tx.store.put(rule)
  }
  await tx.done
}

export async function getRules(): Promise<AuditRule[]> {
  const database = await initDB()
  const rules = await database.getAll("rules")
  return rules.map((rule) => ({
    ...rule,
    targetDatasetIds: rule.targetDatasetIds ?? [],
    formulaAvailable: rule.formulaAvailable ?? Boolean(rule.formula),
    aiEvaluationRequired: rule.aiEvaluationRequired ?? !Boolean(rule.formula),
  }))
}

export async function saveScenario(scenario: ScenarioInputs): Promise<void> {
  const database = await initDB()
  await database.put("settings", scenario, "scenario")
}

export async function getScenario(): Promise<ScenarioInputs | null> {
  const database = await initDB()
  return (await database.get("settings", "scenario")) ?? null
}
