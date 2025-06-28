const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

export async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return ""

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!res.ok) {
      console.warn(`Gemini API call failed – status ${res.status}. ` + "Continuing without AI response.")
      return ""
    }

    const data: GeminiResponse = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  } catch (err) {
    console.warn("Gemini fetch error:", err)
    return ""
  }
}

export async function parseColumnMapping(
  headers: string[],
  expectedFields: string[],
): Promise<Record<string, string | null>> {
  const prompt = `
    I have CSV headers: ${headers.join(", ")}
    I need to map them to these expected fields: ${expectedFields.join(", ")}

    Please provide a JSON mapping where keys are the expected fields and values are
    the actual headers that match them (case-insensitive).  
    If no match is found, use null as the value.

    Example: {"ClientID": "Client_ID", "ClientName": "Name", "PriorityLevel": null}

    Only return the JSON object – no extra text.
  `

  const heuristicMap = (): Record<string, string | null> => {
    const normalise = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase()
    const map: Record<string, string | null> = {}
    expectedFields.forEach((field) => {
      const found = headers.find((h) => normalise(h) === normalise(field))
      map[field] = found ?? null
    })
    return map
  }

  try {
    const response = await callGeminiAPI(prompt)

    if (!response.trim()) return heuristicMap()

    return JSON.parse(response.trim())
  } catch (error) {
    console.warn("Column mapping failed, using heuristic mapping:", error)
    return heuristicMap()
  }
}

export async function validateDataWithAI(data: Record<string, unknown>[], entityType: string): Promise<string[]> {
  const prompt = `
    Analyze this ${entityType} data for potential issues beyond basic validation:
    ${JSON.stringify(data.slice(0, 5), null, 2)}
    
    Look for:
    - Inconsistent naming patterns
    - Unusual data distributions
    - Potential data quality issues
    - Business logic violations
    
    Return a JSON array of validation messages. Each message should be a string describing the issue.
    Only return the JSON array, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return JSON.parse(response.trim())
  } catch (error) {
    console.error("AI validation failed:", error)
    return []
  }
}

export async function interpretNaturalLanguageQuery(query: string, entityType: string): Promise<string> {
  const prompt = `
    Convert this natural language query into a filter function for ${entityType} data:
    "${query}"
    
    Return JavaScript code that can be used with Array.filter().
    The function should take an item parameter and return true/false.
    
    Example: "item.Duration > 1 && item.PreferredPhases.includes('2')"
    
    Only return the filter expression, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return response.trim()
  } catch (error) {
    console.error("Natural language query interpretation failed:", error)
    return "true"
  }
}

export async function interpretNaturalLanguageModification(
  command: string,
  entityType: string,
): Promise<{ field: string; value: unknown; condition?: string }> {
  const prompt = `
    Convert this natural language modification command for ${entityType} data:
    "${command}"
    
    Return a JSON object with:
    - field: the field to modify
    - value: the new value
    - condition: optional filter condition (JavaScript expression)
    
    Example: {"field": "PriorityLevel", "value": 3, "condition": "item.GroupTag === 'GroupA'"}
    
    Only return the JSON object, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return JSON.parse(response.trim())
  } catch (error) {
    console.error("Natural language modification interpretation failed:", error)
    return { field: "", value: null }
  }
}

export async function suggestErrorFixes(errors: string[]): Promise<Array<{ error: string; suggestion: string }>> {
  const prompt = `
    For these validation errors, suggest specific fixes:
    ${errors.join("\n")}
    
    Return a JSON array of objects with "error" and "suggestion" fields.
    Make suggestions specific and actionable.
    
    Only return the JSON array, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return JSON.parse(response.trim())
  } catch (error) {
    console.error("Error fix suggestions failed:", error)
    return []
  }
}

export async function convertNaturalLanguageToRule(description: string): Promise<Record<string, unknown> | null> {
  const prompt = `
    Convert this natural language rule description into a structured rule object:
    "${description}"
    
    Return a JSON object with:
    - type: one of "coRun", "slotRestriction", "loadLimit", "phaseWindow", "patternMatch", "precedenceOverride"
    - name: a short name for the rule
    - description: the original description
    - parameters: object with rule-specific parameters
    
    Only return the JSON object, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return JSON.parse(response.trim())
  } catch (error) {
    console.error("Natural language to rule conversion failed:", error)
    return null
  }
}

export async function recommendRules(data: {
  clients: Record<string, unknown>[]
  workers: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
}): Promise<string[]> {
  const prompt = `
    Based on this data structure, recommend business rules that might be useful:
    
    Clients: ${data.clients.length} records
    Workers: ${data.workers.length} records  
    Tasks: ${data.tasks.length} records
    
    Sample data:
    ${JSON.stringify(
      {
        client: data.clients[0],
        worker: data.workers[0],
        task: data.tasks[0],
      },
      null,
      2,
    )}
    
    Return a JSON array of rule recommendation strings.
    Focus on practical business rules for task assignment and resource management.
    
    Only return the JSON array, no other text.
  `

  try {
    const response = await callGeminiAPI(prompt)
    return JSON.parse(response.trim())
  } catch (error) {
    console.error("Rule recommendations failed:", error)
    return []
  }
}
