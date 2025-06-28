import { jsonrepair } from "jsonrepair"
import { callGeminiAPI } from "./gemini"
import type { Client, Worker, Task, CorrectedDataResponse } from "@/types"

interface DataCheckResponse {
  success: boolean
  correctedData?: CorrectedDataResponse
  error?: string
  issuesFound?: string[]
  issuesFixed?: string[]
}

function mergeRecords<T extends { [key: string]: unknown }>(original: T[], corrected: T[], idField: string): T[] {
  const correctedMap = new Map<string, T>(corrected.map((r) => [r[idField] as string, r]))
  return original.map((record) => correctedMap.get(record[idField] as string) ?? record)
}

export function createDataCheckPrompt(
  clients: Record<string, unknown>[],
  workers: Record<string, unknown>[],
  tasks: Record<string, unknown>[],
): string {
  return `You are a comprehensive data validation and correction specialist. Your task is to analyze and fix ALL data quality issues across clients, workers, and tasks datasets.

CRITICAL DATA TYPE REQUIREMENTS:
- AvailableSlots field in workers MUST be stored as a STRING containing valid JSON array
- Example: "[[1,2,3]]" or "[1,2,3]" (string format, not actual array)
- DO NOT convert AvailableSlots to actual JavaScript arrays
- Keep it as JSON string representation

AVAILABLE DATASETS:
- Clients: ${clients.length} records
- Workers: ${workers.length} records  
- Tasks: ${tasks.length} records

COMPREHENSIVE VALIDATION & CORRECTION CHECKLIST:

1. STRUCTURAL ISSUES:
   - Missing required columns/fields
   - Duplicate IDs (ClientID/WorkerID/TaskID) - make unique by appending suffix
   - Empty or null required fields - provide reasonable defaults

2. DATA FORMAT ISSUES:
   - Malformed JSON in AttributesJSON - fix syntax or wrap in valid JSON
   - Malformed arrays in AvailableSlots - ensure proper JSON string format like "[[1,2]]"
   - Non-numeric values where numbers expected - convert or set defaults
   - IMPORTANT: AvailableSlots must remain as STRING containing JSON array

3. VALUE RANGE ISSUES:
   - PriorityLevel must be 1-5 - clamp to valid range
   - Duration must be ≥ 1 - set minimum value of 1
   - MaxLoadPerPhase must be ≥ 1 - set minimum value of 1
   - MaxConcurrent must be ≥ 1 - set minimum value of 1

4. REFERENCE INTEGRITY:
   - RequestedTaskIDs must reference existing TaskIDs - remove invalid references
   - Skills formatting consistency - standardize case and spacing
   - Group naming consistency - standardize naming patterns

5. BUSINESS LOGIC VALIDATION:
   - Overloaded workers: ensure AvailableSlots count ≥ MaxLoadPerPhase
   - Skill coverage: ensure all RequiredSkills are available in worker pool
   - Phase feasibility: validate phase assignments are realistic

6. CROSS-DATASET CONSISTENCY:
   - All referenced TaskIDs exist in tasks dataset
   - Worker groups are consistently named
   - Skill names are standardized across datasets

FIELD TYPE SPECIFICATIONS:
Workers schema:
- WorkerID: string
- WorkerName: string  
- Skills: string (comma-separated)
- AvailableSlots: string (JSON array format like "[[1,2]]" or "[1,2,3]")
- MaxLoadPerPhase: number
- WorkerGroup: string
- QualificationLevel: string

CURRENT DATA:

CLIENTS (${clients.length} records):
${JSON.stringify(clients, null, 2)}

WORKERS (${workers.length} records):
${JSON.stringify(workers, null, 2)}

TASKS (${tasks.length} records):
${JSON.stringify(tasks, null, 2)}

CORRECTION REQUIREMENTS:
1. Fix ALL identified issues automatically
2. Preserve original data structure and field names
3. Maintain exact record counts: ${clients.length} clients, ${workers.length} workers, ${tasks.length} tasks
4. Use reasonable defaults for missing/invalid data
5. Ensure all cross-references are valid
6. Standardize formatting and naming conventions
7. CRITICAL: Keep AvailableSlots as STRING containing JSON array (not actual array)

RESPONSE FORMAT:
Return ONLY a JSON object with this exact structure:
{
  "clients": [array of ${clients.length} corrected client records],
  "workers": [array of ${workers.length} corrected worker records with AvailableSlots as STRING],
  "tasks": [array of ${tasks.length} corrected task records]
}

Each record must maintain all original fields with corrected values.
No explanations, no markdown, no additional text - just the JSON object.

CORRECTED DATA:`
}

export async function checkAndCorrectAllData(
  clients: Client[],
  workers: Worker[],
  tasks: Task[],
): Promise<DataCheckResponse> {
  try {
    console.log(
      `Starting comprehensive data check for ${clients.length} clients, ${workers.length} workers, ${tasks.length} tasks`,
    )

    const prompt = createDataCheckPrompt(clients, workers, tasks)

    const response = await callGeminiAPI(prompt)

    if (!response.trim()) {
      throw new Error("AI returned empty response")
    }

    console.log(`AI response length: ${response.length} characters`)

    let parsedData: CorrectedDataResponse
    try {
      let cleaned = response.trim()

      cleaned = cleaned.replace(/```json\s*\n?/gi, "").replace(/```\s*$/gi, "")

      const objectStart = cleaned.indexOf("{")
      const objectEnd = cleaned.lastIndexOf("}")
      if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
        cleaned = cleaned.slice(objectStart, objectEnd + 1)
      }

      parsedData = JSON.parse(cleaned) as CorrectedDataResponse
    } catch (primaryError) {
      console.warn("Primary JSON.parse failed - attempting repair:", primaryError)

      try {
        const repaired = jsonrepair(response)
        parsedData = JSON.parse(repaired) as CorrectedDataResponse
        console.info("jsonrepair succeeded – continuing with repaired data")
      } catch (repairError) {
        console.error("jsonrepair failed:", repairError)
        throw new Error("AI returned invalid JSON that could not be repaired")
      }
    }

    if (!parsedData.clients || !parsedData.workers || !parsedData.tasks) {
      throw new Error("AI response missing required data arrays")
    }

    if (!Array.isArray(parsedData.clients) || !Array.isArray(parsedData.workers) || !Array.isArray(parsedData.tasks)) {
      throw new Error("AI response data is not in array format")
    }

    parsedData.workers = parsedData.workers.map((worker: Worker) => {
      if (worker.AvailableSlots && typeof worker.AvailableSlots !== "string") {
        worker.AvailableSlots = JSON.stringify(worker.AvailableSlots)
      }
      return worker
    })

    const reconciledClients = mergeRecords<Client>(clients, parsedData.clients, "ClientID")
    const reconciledWorkers = mergeRecords<Worker>(workers, parsedData.workers, "WorkerID")
    const reconciledTasks = mergeRecords<Task>(tasks, parsedData.tasks, "TaskID")

    if (
      parsedData.clients.length !== clients.length ||
      parsedData.workers.length !== workers.length ||
      parsedData.tasks.length !== tasks.length
    ) {
      console.warn("Gemini returned a different record count – merged corrected rows but preserved total length.")
    }

    console.log("Data check completed successfully")

    return {
      success: true,
      correctedData: {
        clients: reconciledClients,
        workers: reconciledWorkers,
        tasks: reconciledTasks,
      },
    }
  } catch (error) {
    console.error("Comprehensive data check failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export function validateDataCompleteness(
  clients: Client[],
  workers: Worker[],
  tasks: Task[],
): {
  isComplete: boolean
  missingDatasets: string[]
  recommendations: string[]
} {
  const missingDatasets: string[] = []
  const recommendations: string[] = []

  if (clients.length === 0) {
    missingDatasets.push("clients")
    recommendations.push("Upload clients data to enable full validation")
  }

  if (workers.length === 0) {
    missingDatasets.push("workers")
    recommendations.push("Upload workers data to validate skill coverage and capacity")
  }

  if (tasks.length === 0) {
    missingDatasets.push("tasks")
    recommendations.push("Upload tasks data to validate requirements and references")
  }

  return {
    isComplete: missingDatasets.length === 0,
    missingDatasets,
    recommendations,
  }
}
