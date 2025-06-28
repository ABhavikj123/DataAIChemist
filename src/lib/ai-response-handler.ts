import { jsonrepair } from "jsonrepair"
import type { DataRecord } from "@/types"

interface AIDataCorrectionResponse {
  success: boolean
  correctedData?: DataRecord[]
  recordsProcessed?: number
  error?: string
  debugInfo?: string
}

function validate(data: unknown, debugInfo?: string): AIDataCorrectionResponse {
  let corrected: DataRecord[]

  if (Array.isArray(data)) {
    corrected = data as DataRecord[]
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>
    const possibleArrays = [obj.correctedData, obj.data, obj.records, obj.result]
    const foundArray = possibleArrays.find((item) => Array.isArray(item))

    if (!foundArray) {
      return {
        success: false,
        error: "Parsed JSON but no array payload found in object",
        debugInfo: `Object keys: ${Object.keys(obj).join(", ")}`,
      }
    }

    corrected = foundArray as DataRecord[]
  } else {
    return {
      success: false,
      error: "Parsed JSON but result is neither array nor object",
      debugInfo: `Type: ${typeof data}`,
    }
  }

  const invalidRecords = corrected.filter((record) => typeof record !== "object" || record === null)

  if (invalidRecords.length > 0) {
    return {
      success: false,
      error: `Found ${invalidRecords.length} invalid records (not objects)`,
      debugInfo: `First invalid record at index: ${corrected.findIndex((r) => typeof r !== "object" || r === null)}`,
    }
  }

  return {
    success: true,
    correctedData: corrected,
    recordsProcessed: corrected.length,
    debugInfo,
  }
}

export function parseAIDataResponse(rawResponse: string, originalDataLength: number): AIDataCorrectionResponse {
  try {
    let text = rawResponse.trim()
    let debugInfo = `Original response length: ${text.length} chars`

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) {
      text = fenceMatch[1].trim()
      debugInfo += " | Found fenced code block"
    }

    if (!text.includes("[") && !text.includes("{")) {
      debugInfo += " | No JSON brackets found, attempting full repair"
      try {
        const repaired = jsonrepair(text)
        const result = validate(JSON.parse(repaired), debugInfo)

        if (result.success && result.correctedData && result.correctedData.length !== originalDataLength) {
          return {
            success: false,
            error: `Record count mismatch: expected ${originalDataLength}, got ${result.correctedData.length}`,
            debugInfo: debugInfo || "No debug info available",
          }
        }

        return result
      } catch (err) {
        return {
          success: false,
          error: "No JSON structure found in response",
          debugInfo: `${debugInfo} | Repair failed: ${err}`,
        }
      }
    }

    const arrayStart = text.indexOf("[")
    const arrayEnd = text.lastIndexOf("]")

    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      const arrayText = text.slice(arrayStart, arrayEnd + 1)
      debugInfo += ` | Extracted array: ${arrayText.length} chars`

      try {
        const repaired = jsonrepair(arrayText)
        const result = validate(JSON.parse(repaired), debugInfo)

        if (result.success && result.correctedData && result.correctedData.length !== originalDataLength) {
          return {
            success: false,
            error: `Record count mismatch: expected ${originalDataLength}, got ${result.correctedData.length}`,
            debugInfo: debugInfo || "No debug info available",
          }
        }

        return result
      } catch (err) {
        debugInfo += ` | Array parse failed: ${err}`
      }
    }

    const objectStart = text.indexOf("{")
    const objectEnd = text.lastIndexOf("}")

    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      const objectText = text.slice(objectStart, objectEnd + 1)
      debugInfo += ` | Extracted object: ${objectText.length} chars`

      try {
        const repaired = jsonrepair(objectText)
        const result = validate(JSON.parse(repaired), debugInfo)

        if (result.success && result.correctedData && result.correctedData.length !== originalDataLength) {
          return {
            success: false,
            error: `Record count mismatch: expected ${originalDataLength}, got ${result.correctedData.length}`,
            debugInfo: debugInfo || "No debug info available",
          }
        }

        return result
      } catch (err) {
        debugInfo += ` | Object parse failed: ${err}`
      }
    }

    try {
      const repaired = jsonrepair(text)
      const result = validate(JSON.parse(repaired), debugInfo + " | Full text repair")

      if (result.success && result.correctedData && result.correctedData.length !== originalDataLength) {
        return {
          success: false,
          error: `Record count mismatch: expected ${originalDataLength}, got ${result.correctedData.length}`,
          debugInfo: debugInfo || "No debug info available",
        }
      }

      return result
    } catch (err) {
      return {
        success: false,
        error: "All parsing attempts failed",
        debugInfo: `${debugInfo} | Final error: ${err}`,
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown parsing error",
      debugInfo: `Outer catch: ${err}`,
    }
  }
}

export function createDataCorrectionPrompt(data: DataRecord[], entityType: string, userInstruction: string): string {
  const fieldInfo = {
    clients: "ClientID, ClientName, PriorityLevel, RequestedTaskIDs, GroupTag, AttributesJSON",
    workers: "WorkerID, WorkerName, Skills, AvailableSlots, MaxLoadPerPhase, WorkerGroup, QualificationLevel",
    tasks: "TaskID, TaskName, Category, Duration, RequiredSkills, PreferredPhases, MaxConcurrent",
  }

  const sampleRecord = data[0] || {}
  const fieldNames = Object.keys(sampleRecord)

  return `You are a data correction specialist. You must return ALL records with corrections applied.

CRITICAL REQUIREMENTS:
- You MUST return exactly ${data.length} records
- You MUST include ALL original records, whether corrected or not
- You MUST preserve all field names and data types
- You MUST return ONLY the JSON array, no explanations

TASK: Apply this correction to ${entityType} data
USER INSTRUCTION: "${userInstruction}"

AVAILABLE FIELDS: ${fieldInfo[entityType as keyof typeof fieldInfo]}

RECORD STRUCTURE (each record must have these fields):
${fieldNames.map((field) => `"${field}": <value>`).join(", ")}

CORRECTION PROCESS:
1. Go through each of the ${data.length} records below
2. Apply the user instruction where applicable
3. Keep records unchanged if they don't need correction
4. Maintain exact same data types and structure
5. Return ALL ${data.length} records in the same order

INPUT DATA (${data.length} records):
${JSON.stringify(data, null, 2)}

RESPONSE FORMAT:
Return ONLY a JSON array starting with [ and ending with ]. No markdown, no explanations, no additional text.

Example structure:
[
  {"${fieldNames[0]}": "value1", "${fieldNames[1]}": "value2"},
  {"${fieldNames[0]}": "value3", "${fieldNames[1]}": "value4"}
]

IMPORTANT: Your response must contain exactly ${data.length} records. Count them before responding.

JSON Array:`
}

export function validateCorrectedData(
  originalData: DataRecord[],
  correctedData: DataRecord[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (correctedData.length !== originalData.length) {
    errors.push(`Record count mismatch: expected ${originalData.length}, got ${correctedData.length}`)
  }

  if (originalData.length > 0 && correctedData.length > 0) {
    const originalFields = Object.keys(originalData[0]).sort()
    const correctedFields = Object.keys(correctedData[0]).sort()

    if (JSON.stringify(originalFields) !== JSON.stringify(correctedFields)) {
      errors.push(
        `Field structure changed: original [${originalFields.join(", ")}] vs corrected [${correctedFields.join(", ")}]`,
      )
    }

    correctedData.forEach((record, index) => {
      if (typeof record !== "object" || record === null) {
        errors.push(`Record ${index} is not an object`)
        return
      }

      originalFields.forEach((field) => {
        if (!(field in record)) {
          errors.push(`Record ${index} missing field: ${field}`)
        }
      })
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
