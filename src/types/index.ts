export type DatasetType = "ledger" | "budget" | "vendor" | "forecast" | "unmapped"
export type DatasetStatus = "parsed" | "validating" | "ready" | "error"
export type IssueSeverity = "error" | "warning"
export type IssueSource = "schema" | "rule"
export type DataValue = string | number | boolean | null
export type DataRow = Record<string, DataValue>

export interface SchemaMapping {
  Amount?: string
  Date?: string
  Vendor?: string
  Account?: string
  Description?: string
}

export type RuleFormulaOperator =
  | "required"
  | "number_gte"
  | "number_lte"
  | "number_gt"
  | "number_lt"
  | "equal"
  | "not_equal"
  | "contains"
  | "does_not_contain"
  | "starts_with"
  | "ends_with"
  | "valid_json"
  | "uppercase"
  | "lowercase";

export interface RuleFormula {
  field: string
  operator: RuleFormulaOperator
  value?: string | number
}

export interface DatasetMetadata {
  size: number
  mimeType: string
  source: "upload" | "sample" | "import"
}

export interface FinancialDataset {
  id: string
  name: string
  fileName: string
  type: DatasetType
  status: DatasetStatus
  headers: string[]
  rows: DataRow[]
  schemaMapping: SchemaMapping
  appliedRuleIds: string[]
  createdAt: string
  updatedAt: string
  metadata: DatasetMetadata
}

export interface ValidationIssue {
  id: string
  datasetId: string
  datasetName: string
  rowIndex?: number
  field?: string
  severity: IssueSeverity
  source: IssueSource
  code: string
  message: string
  ruleId?: string
  ruleName?: string
}

export interface AuditRule {
  id: string
  name: string
  description: string
  field: string
  operator: 
  | "required" 
  | "equal" 
  | "not_equal" 
  | "contains" 
  | "does_not_contain" 
  | "starts_with" 
  | "ends_with" 
  | "positive" 
  | "negative" 
  | "greater_than" 
  | "less_than" 
  | "json" 
  | "uppercase" 
  | "lowercase";
  expectedValue?: string
  targetDatasetIds: string[]
  formulaAvailable: boolean
  formula?: RuleFormula
  aiEvaluationRequired: boolean
  compiledAt?: string
  active: boolean
  createdAt: string
}

export interface ScenarioInputs {
  revenueGrowth: number
  expenseCut: number
  headcountBuffer: number
}

export interface GridFocusTarget {
  datasetId: string
  rowIndex: number
  field: string
}

export interface AppState {
  datasets: FinancialDataset[]
  activeDatasetId: string | null
  validationIssues: ValidationIssue[]
  rules: AuditRule[]
  scenario: ScenarioInputs
  isLoading: boolean
  searchQuery: string
  focusTarget: GridFocusTarget | null
}

export interface GeminiCorrectionRequest {
  dataset: FinancialDataset
  instruction: string
  rowIndex?: number
  field?: string
}

export interface GeminiCorrectionResponse {
  rows: DataRow[]
  summary: string
}
