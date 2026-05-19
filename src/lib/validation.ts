import type { AuditRule, DataRow, DataValue, DatasetType, FinancialDataset, RuleFormula, ValidationIssue } from "@/types"

const LEDGER_HINTS = ["amount", "transaction", "account", "debit", "credit", "gl", "journal"]
const BUDGET_HINTS = ["budget", "forecast", "plan", "scenario", "variance"]
const VENDOR_HINTS = ["vendor", "supplier", "invoice", "bill", "payable"]
const DATE_HINTS = ["date", "period", "month", "quarter"]
const MONEY_HINTS = ["amount", "revenue", "expense", "cost", "price", "budget", "actual", "forecast", "debit", "credit"]
const JSON_HINTS = ["json", "attributes", "metadata", "payload"]
const ID_HINTS = ["id", "code", "number"]

function includesAny(value: string, hints: string[]): boolean {
  const normalized = value.toLowerCase()
  return hints.some((hint) => normalized.includes(hint))
}

function isBlank(value: DataValue): boolean {
  return value === null || String(value).trim() === ""
}

function isNumeric(value: DataValue): boolean {
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
}

function isValidDate(value: DataValue): boolean {
  if (isBlank(value)) return true
  if (typeof value === "number") return value > 0
  return !Number.isNaN(Date.parse(String(value)))
}

function issue(
  dataset: FinancialDataset,
  code: string,
  message: string,
  severity: ValidationIssue["severity"],
  rowIndex?: number,
  field?: string,
  rule?: AuditRule,
): ValidationIssue {
  return {
    id: `${dataset.id}-${code}-${rowIndex ?? "dataset"}-${field ?? "record"}`,
    datasetId: dataset.id,
    datasetName: dataset.name,
    rowIndex,
    field,
    severity,
    source: rule ? "rule" : "schema",
    code,
    message,
    ruleId: rule?.id,
    ruleName: rule?.name,
  }
}

export function detectDatasetType(headers: string[], fileName = ""): DatasetType {
  const corpus = `${fileName} ${headers.join(" ")}`.toLowerCase()
  if (includesAny(corpus, VENDOR_HINTS)) return "vendor"
  if (includesAny(corpus, BUDGET_HINTS)) return corpus.includes("forecast") ? "forecast" : "budget"
  if (includesAny(corpus, LEDGER_HINTS)) return "ledger"
  return "unmapped"
}

export function classifyField(header: string): "money" | "date" | "json" | "id" | "text" {
  if (includesAny(header, MONEY_HINTS)) return "money"
  if (includesAny(header, DATE_HINTS)) return "date"
  if (includesAny(header, JSON_HINTS)) return "json"
  if (includesAny(header, ID_HINTS)) return "id"
  return "text"
}

export function validateDataset(dataset: FinancialDataset, rules: AuditRule[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (dataset.rows.length === 0) {
    return [issue(dataset, "empty-dataset", "The file parsed successfully but contains no rows.", "error")]
  }

  if (dataset.headers.length === 0) {
    issues.push(issue(dataset, "missing-headers", "No column headers were detected.", "error"))
  }

  const idFields = dataset.headers.filter((header) => classifyField(header) === "id").slice(0, 2)
  const seenByField = new Map<string, Set<string>>()
  idFields.forEach((field) => seenByField.set(field, new Set()))

  dataset.rows.forEach((row, rowIndex) => {
    dataset.headers.forEach((field) => {
      const value = row[field]
      const kind = classifyField(field)

      if (isBlank(value) && (kind === "id" || field.toLowerCase().includes("name"))) {
        issues.push(issue(dataset, "required-value", `${field} is required for row ${rowIndex + 1}.`, "error", rowIndex, field))
      }

      if (kind === "money" && !isBlank(value) && !isNumeric(value)) {
        issues.push(issue(dataset, "invalid-number", `${field} should contain a numeric value.`, "error", rowIndex, field))
      }

      if (kind === "date" && !isValidDate(value)) {
        issues.push(issue(dataset, "invalid-date", `${field} is not a recognizable date or period.`, "warning", rowIndex, field))
      }

      if (kind === "json" && !isBlank(value)) {
        try {
          JSON.parse(String(value))
        } catch {
          issues.push(issue(dataset, "invalid-json", `${field} contains malformed JSON.`, "error", rowIndex, field))
        }
      }
    })

    idFields.forEach((field) => {
      const rawValue = row[field]
      if (isBlank(rawValue)) return

      const value = String(rawValue)
      const seen = seenByField.get(field)
      if (seen?.has(value)) {
        issues.push(issue(dataset, "duplicate-id", `${field} has duplicate value ${value}.`, "error", rowIndex, field))
      }
      seen?.add(value)
    })

    rules
      .filter((rule) => rule.active && dataset.appliedRuleIds.includes(rule.id))
      .forEach((rule) => {
        if (!rule.formulaAvailable || !rule.formula) return
        const value = row[rule.formula.field]
        if (!doesFormulaPass(value, rule.formula)) {
          issues.push(issue(dataset, `rule-${rule.id}`, `${rule.name}: ${rule.description}`, "warning", rowIndex, rule.formula.field, rule))
        }
      })
  })

  return issues
}

export function validateDatasets(datasets: FinancialDataset[], rules: AuditRule[] = []): ValidationIssue[] {
  return datasets.flatMap((dataset) => validateDataset(dataset, rules))
}

export function getQualityScore(datasets: FinancialDataset[], issues: ValidationIssue[]): number {
  const totalRows = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0)
  if (totalRows === 0) return 0

  const errorRows = new Set(
    issues
      .filter((item) => item.severity === "error" && item.rowIndex !== undefined)
      .map((item) => `${item.datasetId}:${item.rowIndex}`),
  )

  return Math.max(0, Math.round((1 - errorRows.size / totalRows) * 100))
}

export function updateCell(rows: DataRow[], rowIndex: number, field: string, value: string): DataRow[] {
  return rows.map((row, index) => (index === rowIndex ? { ...row, [field]: castValueForField(field, value) } : row))
}

export function castValueForField(field: string, value: string): DataValue {
  const normalized = value.trim()
  if (normalized === "") return null
  if (classifyField(field) === "money" && Number.isFinite(Number(normalized))) return Number(normalized)
  if (/^(true|false)$/i.test(normalized)) return normalized.toLowerCase() === "true"
  return normalized
}

export function doesRulePass(value: DataValue, rule: AuditRule): boolean {
  if (rule.formula) return doesFormulaPass(value, rule.formula)

  const stringValue = String(value ?? "");
  const expectedString = String(rule.expectedValue ?? "");

  switch (rule.operator) {
    case "required":
      return !isBlank(value)

    case "equal":
      return stringValue === expectedString

    case "not_equal":
      return stringValue !== expectedString

    case "contains":
      return stringValue.includes(expectedString)

    case "does_not_contain":
      return !stringValue.includes(expectedString)

    case "starts_with":
      return stringValue.startsWith(expectedString)

    case "ends_with":
      return stringValue.endsWith(expectedString)

    case "positive":
      return isNumeric(value) && Number(value) >= 0

    case "negative":
      return isNumeric(value) && Number(value) <= 0

    case "greater_than": {
      const expected = rule.expectedValue ?? "";
      return isNumeric(value) && isNumeric(expected) && Number(value) > Number(expected);
    }

    case "less_than": {
      const expected = rule.expectedValue ?? "";
      return isNumeric(value) && isNumeric(expected) && Number(value) < Number(expected);
    }
    case "json":
      try {
        JSON.parse(stringValue)
        return true
      } catch {
        return false
      }

    case "uppercase":
      return stringValue === stringValue.toUpperCase()

    case "lowercase":
      return stringValue === stringValue.toLowerCase()

    default:
      return true
  }
}

export function doesFormulaPass(value: DataValue, formula: RuleFormula): boolean {
  const text = String(value ?? "")
  const number = parseFloat(text.replace(/[$,%\s,]/g, ""))

  const formulaTextLower = String(formula.value ?? "").toLowerCase()
  const textLower = text.toLowerCase()

  switch (formula.operator) {
    case "required":
      return !isBlank(value)
    case "number_gte":
      return Number.isFinite(number) && number >= Number(formula.value)
    case "number_lte":
      return Number.isFinite(number) && number <= Number(formula.value)
    case "number_gt":
      return Number.isFinite(number) && number > Number(formula.value)
    case "number_lt":
      return Number.isFinite(number) && number < Number(formula.value)
    case "equal":
      return textLower === formulaTextLower
    case "not_equal":
      return textLower !== formulaTextLower
    case "contains":
      return textLower.includes(formulaTextLower)
    case "does_not_contain":
      return !textLower.includes(formulaTextLower)
    case "starts_with":
      return textLower.startsWith(formulaTextLower)
    case "ends_with":
      return textLower.endsWith(formulaTextLower)
    case "valid_json":
      try {
        JSON.parse(text)
        return true
      } catch {
        return false
      }
    case "uppercase":
      return text === text.toUpperCase()
    case "lowercase":
      return text === text.toLowerCase()
    default:
      return true
  }
}