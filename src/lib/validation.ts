import type { Client, Worker, Task, ValidationError } from "@/types"
import { z } from "zod"

const ClientSchema = z.object({
  ClientID: z.string().min(1, "ClientID is required"),
  ClientName: z.string().min(1, "ClientName is required"),
  PriorityLevel: z.number().int().min(1).max(5, "PriorityLevel must be between 1 and 5"),
  RequestedTaskIDs: z.string(),
  GroupTag: z.string().min(1, "GroupTag is required"),
  AttributesJSON: z.string().refine((val) => {
    try {
      JSON.parse(val)
      return true
    } catch {
      return false
    }
  }, "AttributesJSON must be valid JSON"),
})

const WorkerSchema = z.object({
  WorkerID: z.string().min(1, "WorkerID is required"),
  WorkerName: z.string().min(1, "WorkerName is required"),
  Skills: z.string().min(1, "Skills are required"),
  AvailableSlots: z.union([
    z.string().refine((val) => {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          if (parsed.every((slot) => typeof slot === "number")) {
            return true
          }
          if (parsed.every((slot) => Array.isArray(slot) && slot.every((s) => typeof s === "number"))) {
            return true
          }
        }
        return false
      } catch {
        return false
      }
    }, "AvailableSlots must be a valid JSON array of numbers or array of number arrays"),
    z.array(z.number()).refine(() => true, "AvailableSlots can be an array of numbers"),
    z.array(z.array(z.number())).refine(() => true, "AvailableSlots can be an array of number arrays"),
  ]),
  MaxLoadPerPhase: z.number().int().min(1, "MaxLoadPerPhase must be at least 1"),
  WorkerGroup: z.string().min(1, "WorkerGroup is required"),
  QualificationLevel: z.string().min(1, "QualificationLevel is required"),
})

const TaskSchema = z.object({
  TaskID: z.string().min(1, "TaskID is required"),
  TaskName: z.string().min(1, "TaskName is required"),
  Category: z.string().min(1, "Category is required"),
  Duration: z.number().int().min(1, "Duration must be at least 1"),
  RequiredSkills: z.string().min(1, "RequiredSkills are required"),
  PreferredPhases: z.string().min(1, "PreferredPhases are required"),
  MaxConcurrent: z.number().int().min(1, "MaxConcurrent must be at least 1"),
})

export function validateClients(clients: Client[]): ValidationError[] {
  const errors: ValidationError[] = []
  const seenIds = new Set<string>()

  clients.forEach((client, index) => {
    const result = ClientSchema.safeParse(client)
    if (!result.success) {
      result.error.errors.forEach((error) => {
        errors.push({
          id: `client-${index}-${error.path.join(".")}`,
          type: "error",
          message: error.message,
          field: error.path.join("."),
          rowIndex: index,
          entity: "clients",
        })
      })
    }

    if (seenIds.has(client.ClientID)) {
      errors.push({
        id: `client-${index}-duplicate`,
        type: "error",
        message: `Duplicate ClientID: ${client.ClientID}`,
        field: "ClientID",
        rowIndex: index,
        entity: "clients",
      })
    }
    seenIds.add(client.ClientID)
  })

  return errors
}

export function validateWorkers(workers: Worker[]): ValidationError[] {
  const errors: ValidationError[] = []
  const seenIds = new Set<string>()

  workers.forEach((worker, index) => {
    const result = WorkerSchema.safeParse(worker)
    if (!result.success) {
      result.error.errors.forEach((error) => {
        errors.push({
          id: `worker-${index}-${error.path.join(".")}`,
          type: "error",
          message: error.message,
          field: error.path.join("."),
          rowIndex: index,
          entity: "workers",
        })
      })
    }

    if (seenIds.has(worker.WorkerID)) {
      errors.push({
        id: `worker-${index}-duplicate`,
        type: "error",
        message: `Duplicate WorkerID: ${worker.WorkerID}`,
        field: "WorkerID",
        rowIndex: index,
        entity: "workers",
      })
    }
    seenIds.add(worker.WorkerID)

    try {
      let availableSlots: number[] | number[][]

      if (typeof worker.AvailableSlots === "string") {
        availableSlots = JSON.parse(worker.AvailableSlots) as number[] | number[][]
      } else {
        availableSlots = worker.AvailableSlots as number[] | number[][]
      }

      let totalSlots = 0

      if (Array.isArray(availableSlots)) {
        if (availableSlots.length > 0 && typeof availableSlots[0] === "number") {
          totalSlots = availableSlots.length
        } else if (availableSlots.length > 0 && Array.isArray(availableSlots[0])) {
          totalSlots = (availableSlots as number[][]).reduce(
            (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
            0,
          )
        }
      }

      if (totalSlots < worker.MaxLoadPerPhase) {
        errors.push({
          id: `worker-${index}-overloaded`,
          type: "warning",
          message: `Worker ${worker.WorkerID} has fewer available slots (${totalSlots}) than MaxLoadPerPhase (${worker.MaxLoadPerPhase})`,
          field: "MaxLoadPerPhase",
          rowIndex: index,
          entity: "workers",
        })
      }
    } catch {
      // Already handled by schema validation
    }
  })

  return errors
}

export function validateTasks(tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = []
  const seenIds = new Set<string>()

  tasks.forEach((task, index) => {
    const result = TaskSchema.safeParse(task)
    if (!result.success) {
      result.error.errors.forEach((error) => {
        errors.push({
          id: `task-${index}-${error.path.join(".")}`,
          type: "error",
          message: error.message,
          field: error.path.join("."),
          rowIndex: index,
          entity: "tasks",
        })
      })
    }

    if (seenIds.has(task.TaskID)) {
      errors.push({
        id: `task-${index}-duplicate`,
        type: "error",
        message: `Duplicate TaskID: ${task.TaskID}`,
        field: "TaskID",
        rowIndex: index,
        entity: "tasks",
      })
    }
    seenIds.add(task.TaskID)
  })

  return errors
}

export function validateCrossReferences(clients: Client[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = []
  const taskIds = new Set(tasks.map((task) => task.TaskID))

  clients.forEach((client, index) => {
    if (client.RequestedTaskIDs) {
      const requestedIds = client.RequestedTaskIDs.split(",").map((id) => id.trim())
      requestedIds.forEach((taskId) => {
        if (taskId && !taskIds.has(taskId)) {
          errors.push({
            id: `client-${index}-unknown-task-${taskId}`,
            type: "error",
            message: `Unknown TaskID referenced: ${taskId}`,
            field: "RequestedTaskIDs",
            rowIndex: index,
            entity: "clients",
          })
        }
      })
    }
  })

  return errors
}

export function validateSkillCoverage(workers: Worker[], tasks: Task[]): ValidationError[] {
  const errors: ValidationError[] = []

  const availableSkills = new Set<string>()
  workers.forEach((worker) => {
    if (worker.Skills) {
      worker.Skills.split(",").forEach((skill) => {
        availableSkills.add(skill.trim().toLowerCase())
      })
    }
  })

  tasks.forEach((task, index) => {
    if (task.RequiredSkills) {
      const requiredSkills = task.RequiredSkills.split(",").map((skill) => skill.trim().toLowerCase())
      requiredSkills.forEach((skill) => {
        if (skill && !availableSkills.has(skill)) {
          errors.push({
            id: `task-${index}-uncovered-skill-${skill}`,
            type: "warning",
            message: `No worker has required skill: ${skill}`,
            field: "RequiredSkills",
            rowIndex: index,
            entity: "tasks",
          })
        }
      })
    }
  })

  return errors
}

export function validateAll(clients: Client[], workers: Worker[], tasks: Task[]): ValidationError[] {
  return [
    ...validateClients(clients),
    ...validateWorkers(workers),
    ...validateTasks(tasks),
    ...validateCrossReferences(clients, tasks),
    ...validateSkillCoverage(workers, tasks),
  ]
}
