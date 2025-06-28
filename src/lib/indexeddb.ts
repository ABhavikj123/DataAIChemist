import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { Client, Worker, Task, Rule, ValidationError, PriorityWeights } from "@/types"

interface DataAlchemistDB extends DBSchema {
  clients: {
    key: string
    value: Client
  }
  workers: {
    key: string
    value: Worker
  }
  tasks: {
    key: string
    value: Task
  }
  rules: {
    key: string
    value: Rule
  }
  validationErrors: {
    key: string
    value: ValidationError
  }
  priorityWeights: {
    key: string
    value: PriorityWeights
  }
}

let db: IDBPDatabase<DataAlchemistDB>

export async function initDB() {
  if (!db) {
    db = await openDB<DataAlchemistDB>("data-alchemist", 1, {
      upgrade(db) {
        db.createObjectStore("clients", { keyPath: "ClientID" })
        db.createObjectStore("workers", { keyPath: "WorkerID" })
        db.createObjectStore("tasks", { keyPath: "TaskID" })
        db.createObjectStore("rules", { keyPath: "id" })
        db.createObjectStore("validationErrors", { keyPath: "id" })
        db.createObjectStore("priorityWeights")
      },
    })
  }
  return db
}

export async function saveClients(clients: Client[]) {
  const database = await initDB()
  const tx = database.transaction("clients", "readwrite")
  await tx.store.clear()
  for (const client of clients) {
    await tx.store.put(client)
  }
  await tx.done
}

export async function getClients(): Promise<Client[]> {
  const database = await initDB()
  return await database.getAll("clients")
}

export async function saveWorkers(workers: Worker[]) {
  const database = await initDB()
  const tx = database.transaction("workers", "readwrite")
  await tx.store.clear()
  for (const worker of workers) {
    await tx.store.put(worker)
  }
  await tx.done
}

export async function getWorkers(): Promise<Worker[]> {
  const database = await initDB()
  return await database.getAll("workers")
}

export async function saveTasks(tasks: Task[]) {
  const database = await initDB()
  const tx = database.transaction("tasks", "readwrite")
  await tx.store.clear()
  for (const task of tasks) {
    await tx.store.put(task)
  }
  await tx.done
}

export async function getTasks(): Promise<Task[]> {
  const database = await initDB()
  return await database.getAll("tasks")
}

export async function saveRules(rules: Rule[]) {
  const database = await initDB()
  const tx = database.transaction("rules", "readwrite")
  await tx.store.clear()
  for (const rule of rules) {
    await tx.store.put(rule)
  }
  await tx.done
}

export async function getRules(): Promise<Rule[]> {
  const database = await initDB()
  return await database.getAll("rules")
}

export async function saveValidationErrors(errors: ValidationError[]) {
  const database = await initDB()
  const tx = database.transaction("validationErrors", "readwrite")
  await tx.store.clear()
  for (const error of errors) {
    await tx.store.put(error)
  }
  await tx.done
}

export async function getValidationErrors(): Promise<ValidationError[]> {
  const database = await initDB()
  return await database.getAll("validationErrors")
}

export async function savePriorityWeights(weights: PriorityWeights) {
  const database = await initDB()
  await database.put("priorityWeights", weights, "default")
}

export async function getPriorityWeights(): Promise<PriorityWeights | null> {
  const database = await initDB()
  return (await database.get("priorityWeights", "default")) || null
}
