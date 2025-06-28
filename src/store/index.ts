import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { AppState, Client, Worker, Task, ValidationError, Rule, PriorityWeights } from "@/types"

const initialState: AppState = {
  clients: [],
  workers: [],
  tasks: [],
  validationErrors: [],
  rules: [],
  priorityWeights: {
    priorityLevel: 0.3,
    fairness: 0.2,
    efficiency: 0.2,
    skillMatch: 0.2,
    phasePreference: 0.1,
  },
  isLoading: false,
  searchQuery: "",
  selectedEntity: "clients",
}

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setClients: (state, action: PayloadAction<Client[]>) => {
      state.clients = action.payload
    },
    setWorkers: (state, action: PayloadAction<Worker[]>) => {
      state.workers = action.payload
    },
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.tasks = action.payload
    },
    setValidationErrors: (state, action: PayloadAction<ValidationError[]>) => {
      state.validationErrors = action.payload
    },
    setRules: (state, action: PayloadAction<Rule[]>) => {
      state.rules = action.payload
    },
    addRule: (state, action: PayloadAction<Rule>) => {
      state.rules.push(action.payload)
    },
    updateRule: (state, action: PayloadAction<{ id: string; updates: Partial<Rule> }>) => {
      const index = state.rules.findIndex((rule) => rule.id === action.payload.id)
      if (index !== -1) {
        state.rules[index] = { ...state.rules[index], ...action.payload.updates }
      }
    },
    deleteRule: (state, action: PayloadAction<string>) => {
      state.rules = state.rules.filter((rule) => rule.id !== action.payload)
    },
    setPriorityWeights: (state, action: PayloadAction<PriorityWeights>) => {
      state.priorityWeights = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    setSelectedEntity: (state, action: PayloadAction<"clients" | "workers" | "tasks">) => {
      state.selectedEntity = action.payload
    },
    updateClient: (state, action: PayloadAction<{ index: number; client: Client }>) => {
      state.clients[action.payload.index] = action.payload.client
    },
    updateWorker: (state, action: PayloadAction<{ index: number; worker: Worker }>) => {
      state.workers[action.payload.index] = action.payload.worker
    },
    updateTask: (state, action: PayloadAction<{ index: number; task: Task }>) => {
      state.tasks[action.payload.index] = action.payload.task
    },
  },
})

export const {
  setClients,
  setWorkers,
  setTasks,
  setValidationErrors,
  setRules,
  addRule,
  updateRule,
  deleteRule,
  setPriorityWeights,
  setLoading,
  setSearchQuery,
  setSelectedEntity,
  updateClient,
  updateWorker,
  updateTask,
} = appSlice.actions

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
