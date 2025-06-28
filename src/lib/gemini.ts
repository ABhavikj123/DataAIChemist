import { createDataCorrectionPrompt, parseAIDataResponse, validateCorrectedData } from "./ai-response-handler"
import type { DataRecord, AIRuleResponse } from "@/types"

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message: string
    code: number
  }
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent"

export async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.warn("Gemini API key not configured")
    return ""
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 8192,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: GeminiResponse = await response.json()

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`)
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  } catch (error) {
    console.error("Gemini API call failed:", error)
    throw error
  }
}

function cleanJsonResponse(response: string): string {
  
  let cleaned = response.replace(/```json\s*\n?/gi, "").replace(/```\s*$/gi, "")

  const jsonStart = Math.min(
    cleaned.indexOf("{") === -1 ? Number.POSITIVE_INFINITY : cleaned.indexOf("{"),
    cleaned.indexOf("[") === -1 ? Number.POSITIVE_INFINITY : cleaned.indexOf("["),
  )

  if (jsonStart !== Number.POSITIVE_INFINITY) {
    cleaned = cleaned.substring(jsonStart)
  }

  const lastBrace = cleaned.lastIndexOf("}")
  const lastBracket = cleaned.lastIndexOf("]")
  const jsonEnd = Math.max(lastBrace, lastBracket)

  if (jsonEnd !== -1) {
    cleaned = cleaned.substring(0, jsonEnd + 1)
  }

  cleaned = cleaned
    .replace(/'/g, '"') 
    .replace(/(\w+):/g, '"$1":')
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]") 

  return cleaned.trim()
}

function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    const cleaned = cleanJsonResponse(jsonString)
    return JSON.parse(cleaned) as T
  } catch (error) {
    console.warn("JSON parsing failed:", error)
    return fallback
  }
}

export async function parseColumnMapping(headers: string[], expectedFields: string[]): Promise<Record<string, string>> {
  const prompt = `
You are a data mapping expert. I have CSV headers that need to be mapped to expected field names.

CSV Headers: ${headers.join(", ")}
Expected Fields: ${expectedFields.join(", ")}

Please map each expected field to the most appropriate CSV header. Consider variations in naming conventions, case differences, spaces, underscores, and common abbreviations.

Return ONLY a JSON object mapping expected fields to actual headers. If no match exists, use the original field name.

Example format:
{
  "ClientID": "Client_ID",
  "ClientName": "Name", 
  "PriorityLevel": "Priority"
}
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      throw new Error("Empty response")
    }

    return safeJsonParse(response, {})
  } catch (error) {
    console.error("Column mapping failed:", error)

    const mapping: Record<string, string> = {}
    expectedFields.forEach((field) => {
      const match = headers.find(
        (header) => header.toLowerCase().replace(/[^a-z0-9]/g, "") === field.toLowerCase().replace(/[^a-z0-9]/g, ""),
      )
      mapping[field] = match || field
    })
    return mapping
  }
}

export async function validateDataWithAI(data: Record<string, unknown>[], entityType: string): Promise<string[]> {
  if (data.length === 0) return []

  const prompt = `
Analyze this ${entityType} data for quality issues and business logic violations:

Data sample (first 3 rows):
${JSON.stringify(data.slice(0, 3), null, 2)}

Look for:
1. Inconsistent naming patterns
2. Data distribution anomalies
3. Business logic violations
4. Referential integrity issues
5. Unusual value patterns

Return ONLY a JSON array of specific validation messages as strings.
Focus on actionable, specific issues.

Example format:
["Task T001 has unusually high duration compared to others", "Worker skills contain inconsistent formatting"]
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return []
    }

    return safeJsonParse(response, [])
  } catch (error) {
    console.error("AI validation failed:", error)
    return []
  }
}

export async function interpretNaturalLanguageQuery(query: string, entityType: string): Promise<string> {
  if (!query.trim()) return "true"

  const prompt = `
Convert this natural language query into a JavaScript filter function for ${entityType} data:

Query: "${query}"

Return ONLY the JavaScript expression that can be used with Array.filter().
The expression should use 'item' as the parameter name.

For ${entityType}, available fields are:
${
  entityType === "clients"
    ? "ClientID, ClientName, PriorityLevel, RequestedTaskIDs, GroupTag, AttributesJSON"
    : entityType === "workers"
      ? "WorkerID, WorkerName, Skills, AvailableSlots, MaxLoadPerPhase, WorkerGroup, QualificationLevel"
      : "TaskID, TaskName, Category, Duration, RequiredSkills, PreferredPhases, MaxConcurrent"
}

Examples:
- "tasks with duration greater than 2" → "item.Duration > 2"
- "workers in TeamA" → "item.WorkerGroup === 'TeamA'"
- "clients with high priority" → "item.PriorityLevel >= 4"

Return only the filter expression without any explanation:
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return "true"
    }

    const cleaned = response.trim().replace(/^`|`$/g, "")

    if (cleaned.includes("item.") && !cleaned.includes("function") && !cleaned.includes("return")) {
      return cleaned
    }

    return "true"
  } catch (error) {
    console.error("Natural language query failed:", error)
    return "true"
  }
}

export async function interpretNaturalLanguageModification(
  command: string,
  entityType: string,
): Promise<{ field: string; value: unknown; condition?: string }> {
  if (!command.trim()) {
    return { field: "", value: null }
  }

  const prompt = `
Convert this natural language modification command for ${entityType} data:

Command: "${command}"

Return ONLY a JSON object with:
- field: the field name to modify
- value: the new value to set
- condition: optional JavaScript filter condition (using 'item' parameter)

For ${entityType}, available fields are:
${
  entityType === "clients"
    ? "ClientID, ClientName, PriorityLevel, RequestedTaskIDs, GroupTag, AttributesJSON"
    : entityType === "workers"
      ? "WorkerID, WorkerName, Skills, AvailableSlots, MaxLoadPerPhase, WorkerGroup, QualificationLevel"
      : "TaskID, TaskName, Category, Duration, RequiredSkills, PreferredPhases, MaxConcurrent"
}

Examples:
- "set priority to 3 for GroupA clients" → {"field": "PriorityLevel", "value": 3, "condition": "item.GroupTag === 'GroupA'"}
- "change all durations to 2" → {"field": "Duration", "value": 2}

Return only the JSON object:
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return { field: "", value: null }
    }

    return safeJsonParse(response, { field: "", value: null })
  } catch (error) {
    console.error("Natural language modification failed:", error)
    return { field: "", value: null }
  }
}

export async function suggestErrorFixes(errors: string[]): Promise<Array<{ error: string; suggestion: string }>> {
  if (errors.length === 0) return []

  const prompt = `
For each validation error, provide a specific, actionable fix suggestion:

Errors:
${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Return ONLY a JSON array of objects with "error" and "suggestion" fields.
Make suggestions specific and implementable.

Format:
[{"error": "original error", "suggestion": "specific fix action"}]
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return []
    }

    return safeJsonParse(response, [])
  } catch (error) {
    console.error("Error fix suggestions failed:", error)
    return []
  }
}

export async function convertNaturalLanguageToRule(description: string): Promise<AIRuleResponse | null> {
  if (!description.trim()) return null

  const prompt = `
Convert this natural language rule into a structured business rule:

Description: "${description}"

Rule types available:
- coRun: Tasks that must run together
- slotRestriction: Limit slots for groups
- loadLimit: Limit workload per phase
- phaseWindow: Restrict tasks to specific phases
- patternMatch: Pattern-based rules
- precedenceOverride: Priority overrides

Return ONLY a JSON object with this exact structure:
{
  "type": "coRun",
  "name": "short descriptive name",
  "description": "detailed description",
  "parameters": {}
}

Examples:
- "Make T1 and T2 run together" → {"type": "coRun", "name": "T1-T2 Co-run", "description": "Tasks T1 and T2 must run together", "parameters": {"tasks": ["T1", "T2"]}}
- "Limit TeamA to 3 slots" → {"type": "loadLimit", "name": "TeamA Load Limit", "description": "Limit TeamA to maximum 3 slots per phase", "parameters": {"workerGroup": "TeamA", "maxSlotsPerPhase": 3}}

Return only the JSON object:
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return null
    }

    const defaultRule: AIRuleResponse = {
      type: "coRun",
      name: "Generated Rule",
      description: description,
      parameters: {},
    }

    return safeJsonParse(response, defaultRule)
  } catch (error) {
    console.error("Rule conversion failed:", error)
    return null
  }
}

export async function recommendRules(data: {
  clients: Record<string, unknown>[]
  workers: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
}): Promise<string[]> {
  if (data.clients.length === 0 && data.workers.length === 0 && data.tasks.length === 0) {
    return []
  }

  const prompt = `
Based on this dataset, recommend practical business rules for task assignment:

Dataset summary:
- Clients: ${data.clients.length} records
- Workers: ${data.workers.length} records  
- Tasks: ${data.tasks.length} records

Sample data:
${JSON.stringify(
  {
    client: data.clients[0] || {},
    worker: data.workers[0] || {},
    task: data.tasks[0] || {},
  },
  null,
  2,
)}

Return ONLY a JSON array of rule recommendation strings.
Focus on realistic business scenarios like workload balancing, skill matching, and priority handling.

Format:
["Limit TeamA to 3 concurrent tasks", "Ensure high-priority clients get preference in Phase 1"]
`

  try {
    const response = await callGeminiAPI(prompt)
    if (!response.trim()) {
      return []
    }

    return safeJsonParse(response, [])
  } catch (error) {
    console.error("Rule recommendations failed:", error)
    return []
  }
}

export async function correctDataWithAI(
  data: DataRecord[],
  entityType: string,
  userInstruction: string,
): Promise<DataRecord[]> {
  try {
    if (data.length === 0) {
      throw new Error("No data to correct")
    }

    console.log(`Starting AI correction for ${data.length} ${entityType} records`)

    const prompt = createDataCorrectionPrompt(data, entityType, userInstruction)

    const response = await callGeminiAPI(prompt)

    if (!response.trim()) {
      throw new Error("AI returned empty response")
    }

    console.log(`AI response length: ${response.length} characters`)

    const result = parseAIDataResponse(response, data.length)

    if (!result.success) {
      console.error("Parsing failed:", result.error)
      if (result.debugInfo) {
        console.error("Debug info:", result.debugInfo)
      }
      throw new Error(result.error || "Failed to parse AI response")
    }

    if (!result.correctedData) {
      throw new Error("No corrected data returned")
    }

    const validation = validateCorrectedData(data, result.correctedData)
    if (!validation.isValid) {
      console.error("Validation errors:", validation.errors)
      throw new Error(`Data validation failed: ${validation.errors.join(", ")}`)
    }

    console.log(`Successfully corrected ${result.recordsProcessed} records`)
    return result.correctedData
  } catch (error) {
    console.error("AI data correction failed:", error)
    throw new Error(
      error instanceof Error ? `AI correction failed: ${error.message}` : "AI correction failed with unknown error",
    )
  }
}
