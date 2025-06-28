export interface Client {
  [key: string]: unknown
  ClientID: string
  ClientName: string
  PriorityLevel: number
  RequestedTaskIDs: string
  GroupTag: string
  AttributesJSON: string
}

export interface Worker {
  [key: string]: unknown
  WorkerID: string
  WorkerName: string
  Skills: string
  AvailableSlots: string
  MaxLoadPerPhase: number
  WorkerGroup: string
  QualificationLevel: string
}

export interface Task {
  [key: string]: unknown
  TaskID: string
  TaskName: string
  Category: string
  Duration: number
  RequiredSkills: string
  PreferredPhases: string
  MaxConcurrent: number
}

export interface ValidationError {
  id: string
  type: "error" | "warning"
  message: string
  field?: string
  rowIndex?: number
  entity: "clients" | "workers" | "tasks"
}

export interface Rule {
  id: string
  type: "coRun" | "slotRestriction" | "loadLimit" | "phaseWindow" | "patternMatch" | "precedenceOverride"
  name: string
  description: string
  parameters: Record<string, unknown>
  priority: number
  active: boolean
}

export interface PriorityWeights {
  priorityLevel: number
  fairness: number
  efficiency: number
  skillMatch: number
  phasePreference: number
}

export interface AppState {
  clients: Client[]
  workers: Worker[]
  tasks: Task[]
  validationErrors: ValidationError[]
  rules: Rule[]
  priorityWeights: PriorityWeights
  isLoading: boolean
  searchQuery: string
  selectedEntity: "clients" | "workers" | "tasks"
}

export type DataRecord = Client | Worker | Task
export type EntityType = "clients" | "workers" | "tasks"
export type CorrectedDataResponse = {
  clients: Client[]
  workers: Worker[]
  tasks: Task[]
}

export interface AIRuleResponse {
  type: "coRun" | "slotRestriction" | "loadLimit" | "phaseWindow" | "patternMatch" | "precedenceOverride"
  name: string
  description: string
  parameters: Record<string, unknown>
}
