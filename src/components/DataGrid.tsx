"use client"

import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RootState } from "@/store"
import { updateClient, updateWorker, updateTask, setValidationErrors, setClients, setWorkers, setTasks } from "@/store"
import { validateAll } from "@/lib/validation"
import { saveClients, saveWorkers, saveTasks, saveValidationErrors } from "@/lib/indexeddb"
import type { ValidationError, Client, Worker, Task, EntityType } from "@/types"
import { Edit, Save, X } from "lucide-react"
import { correctDataWithAI } from "@/lib/gemini"
import { checkAndCorrectAllData, validateDataCompleteness } from "@/lib/ai-data-checker"
import { exportToCSV } from "@/lib/file-handler"
import { Wand2, Download, Loader2, Shield, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, XCircle } from "lucide-react"
import { CheckCircle } from "lucide-react"

type CellEditState = { entity: string; row: number; field: string } | null
type CorrectionStatus = "idle" | "success" | "error"

export default function DataGrid() {
  const dispatch = useDispatch()
  const { clients, workers, tasks, validationErrors } = useSelector((state: RootState) => state.app)
  const [editingCell, setEditingCell] = useState<CellEditState>(null)
  const [editValue, setEditValue] = useState("")
  const [aiCorrectionDialog, setAiCorrectionDialog] = useState(false)
  const [correctionInstruction, setCorrectionInstruction] = useState("")
  const [isApplyingCorrection, setIsApplyingCorrection] = useState(false)
  const [isRunningComprehensiveCheck, setIsRunningComprehensiveCheck] = useState(false)
  const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>("idle")
  const [correctionMessage, setCorrectionMessage] = useState("")
  const [activeTab, setActiveTab] = useState("clients")

  const dataCompleteness = validateDataCompleteness(clients, workers, tasks)

  const getValidationErrorsForCell = (entity: string, rowIndex: number, field: string): ValidationError[] => {
    return validationErrors.filter(
      (error) => error.entity === entity && error.rowIndex === rowIndex && error.field === field,
    )
  }

  const handleCellEdit = (entity: string, rowIndex: number, field: string, currentValue: string | number) => {
    setEditingCell({ entity, row: rowIndex, field })
    setEditValue(String(currentValue || ""))
  }

  const handleSaveEdit = async () => {
    if (!editingCell) return

    const { entity, row, field } = editingCell
    let updatedValue: string | number = editValue

    if (field === "PriorityLevel" || field === "Duration" || field === "MaxLoadPerPhase" || field === "MaxConcurrent") {
      updatedValue = Number(editValue)
    }

    try {
      if (entity === "clients") {
        const updatedClient = { ...clients[row], [field]: updatedValue }
        dispatch(updateClient({ index: row, client: updatedClient }))
        const updatedClients = [...clients]
        updatedClients[row] = updatedClient
        await saveClients(updatedClients)
      } else if (entity === "workers") {
        const updatedWorker = { ...workers[row], [field]: updatedValue }
        dispatch(updateWorker({ index: row, worker: updatedWorker }))
        const updatedWorkers = [...workers]
        updatedWorkers[row] = updatedWorker
        await saveWorkers(updatedWorkers)
      } else if (entity === "tasks") {
        const updatedTask = { ...tasks[row], [field]: updatedValue }
        dispatch(updateTask({ index: row, task: updatedTask }))
        const updatedTasks = [...tasks]
        updatedTasks[row] = updatedTask
        await saveTasks(updatedTasks)
      }

      const errors = validateAll(clients, workers, tasks)
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))

      setEditingCell(null)
      setEditValue("")
    } catch {
      console.error("Failed to save edit")
    }
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue("")
  }

  const handleComprehensiveDataCheck = async () => {
    if (clients.length === 0 && workers.length === 0 && tasks.length === 0) {
      setCorrectionStatus("error")
      setCorrectionMessage("No data available to check. Please upload data first.")
      return
    }

    setIsRunningComprehensiveCheck(true)
    setCorrectionStatus("idle")
    setCorrectionMessage("")

    try {
      const result = await checkAndCorrectAllData(clients, workers, tasks)

      if (!result.success) {
        throw new Error(result.error || "Comprehensive data check failed")
      }

      if (!result.correctedData) {
        throw new Error("No corrected data returned")
      }

      dispatch(setClients(result.correctedData.clients))
      dispatch(setWorkers(result.correctedData.workers))
      dispatch(setTasks(result.correctedData.tasks))

      await Promise.all([
        saveClients(result.correctedData.clients),
        saveWorkers(result.correctedData.workers),
        saveTasks(result.correctedData.tasks),
      ])

      const errors = validateAll(result.correctedData.clients, result.correctedData.workers, result.correctedData.tasks)
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))

      setCorrectionStatus("success")
      setCorrectionMessage(
        `Comprehensive data check completed! Fixed issues across ${result.correctedData.clients.length} clients, ${result.correctedData.workers.length} workers, and ${result.correctedData.tasks.length} tasks.`,
      )
    } catch (error) {
      console.error("Comprehensive data check failed:", error)
      setCorrectionStatus("error")
      setCorrectionMessage(error instanceof Error ? error.message : "Comprehensive data check failed")
    } finally {
      setIsRunningComprehensiveCheck(false)
    }
  }

  const handleAICorrection = async () => {
    if (!correctionInstruction.trim()) return

    setIsApplyingCorrection(true)
    setCorrectionStatus("idle")
    setCorrectionMessage("")

    try {
      let entityType: EntityType
      let currentData: Client[] | Worker[] | Task[]

      switch (activeTab) {
        case "clients":
          entityType = "clients"
          currentData = clients
          break
        case "workers":
          entityType = "workers"
          currentData = workers
          break
        case "tasks":
          entityType = "tasks"
          currentData = tasks
          break
        default:
          throw new Error("Invalid entity type")
      }

      if (currentData.length === 0) {
        throw new Error(`No ${entityType} data to correct`)
      }

      const correctedData = await correctDataWithAI(currentData, entityType, correctionInstruction)

      if (entityType === "clients") {
        dispatch(setClients(correctedData as Client[]))
        await saveClients(correctedData as Client[])
      } else if (entityType === "workers") {
        dispatch(setWorkers(correctedData as Worker[]))
        await saveWorkers(correctedData as Worker[])
      } else if (entityType === "tasks") {
        dispatch(setTasks(correctedData as Task[]))
        await saveTasks(correctedData as Task[])
      }

      const errors = validateAll(
        entityType === "clients" ? (correctedData as Client[]) : clients,
        entityType === "workers" ? (correctedData as Worker[]) : workers,
        entityType === "tasks" ? (correctedData as Task[]) : tasks,
      )
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))

      setCorrectionStatus("success")
      setCorrectionMessage(`AI corrections applied successfully to ${correctedData.length} ${entityType} records!`)
      setCorrectionInstruction("")
      setAiCorrectionDialog(false)
    } catch (error) {
      console.error("AI correction failed:", error)
      setCorrectionStatus("error")
      setCorrectionMessage(error instanceof Error ? error.message : "AI correction failed")
    } finally {
      setIsApplyingCorrection(false)
    }
  }

  const handleDownloadCorrectedData = () => {
    try {
      let dataToExport: Record<string, unknown>[]
      let filename: string

      switch (activeTab) {
        case "clients":
          dataToExport = clients
          filename = "corrected-clients.csv"
          break
        case "workers":
          dataToExport = workers
          filename = "corrected-workers.csv"
          break
        case "tasks":
          dataToExport = tasks
          filename = "corrected-tasks.csv"
          break
        default:
          throw new Error("Invalid entity type")
      }

      if (dataToExport.length === 0) {
        setCorrectionStatus("error")
        setCorrectionMessage(`No ${activeTab} data to download`)
        return
      }

      exportToCSV(dataToExport, filename)
      setCorrectionStatus("success")
      setCorrectionMessage(`${activeTab} data downloaded successfully!`)
    } catch {
      setCorrectionStatus("error")
      setCorrectionMessage("Download failed")
    }
  }

  const renderEditableCell = (entity: string, rowIndex: number, field: string, value: string | number) => {
    const isEditing = editingCell?.entity === entity && editingCell?.row === rowIndex && editingCell?.field === field
    const errors = getValidationErrorsForCell(entity, rowIndex, field)
    const hasError = errors.length > 0

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit()
              if (e.key === "Escape") handleCancelEdit()
            }}
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={handleSaveEdit}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    return (
      <div
        className={`group cursor-pointer p-2 rounded ${hasError ? "hover:bg-red-50" : "hover:bg-gray-50"}`}
        onClick={() => handleCellEdit(entity, rowIndex, field, value)}
      >
        <div className="flex items-center justify-between">
          <span className={hasError ? "text-red-600 font-medium" : ""}>{String(value || "")}</span>
          <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }

  const ClientsTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Sr No</TableHead>
          <TableHead>Client ID</TableHead>
          <TableHead>Client Name</TableHead>
          <TableHead>Priority Level</TableHead>
          <TableHead>Requested Task IDs</TableHead>
          <TableHead>Group Tag</TableHead>
          <TableHead>Attributes JSON</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client, index) => (
          <TableRow key={client.ClientID}>
            <TableCell className="text-gray-500 font-mono text-sm">{index + 1}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "ClientID", client.ClientID)}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "ClientName", client.ClientName)}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "PriorityLevel", client.PriorityLevel)}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "RequestedTaskIDs", client.RequestedTaskIDs)}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "GroupTag", client.GroupTag)}</TableCell>
            <TableCell>{renderEditableCell("clients", index, "AttributesJSON", client.AttributesJSON)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  const WorkersTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Sr No</TableHead>
          <TableHead>Worker ID</TableHead>
          <TableHead>Worker Name</TableHead>
          <TableHead>Skills</TableHead>
          <TableHead>Available Slots</TableHead>
          <TableHead>Max Load Per Phase</TableHead>
          <TableHead>Worker Group</TableHead>
          <TableHead>Qualification Level</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workers.map((worker, index) => (
          <TableRow key={worker.WorkerID}>
            <TableCell className="text-gray-500 font-mono text-sm">{index + 1}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "WorkerID", worker.WorkerID)}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "WorkerName", worker.WorkerName)}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "Skills", worker.Skills)}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "AvailableSlots", worker.AvailableSlots)}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "MaxLoadPerPhase", worker.MaxLoadPerPhase)}</TableCell>
            <TableCell>{renderEditableCell("workers", index, "WorkerGroup", worker.WorkerGroup)}</TableCell>
            <TableCell>
              {renderEditableCell("workers", index, "QualificationLevel", worker.QualificationLevel)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  const TasksTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Sr No</TableHead>
          <TableHead>Task ID</TableHead>
          <TableHead>Task Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Required Skills</TableHead>
          <TableHead>Preferred Phases</TableHead>
          <TableHead>Max Concurrent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task, index) => (
          <TableRow key={task.TaskID}>
            <TableCell className="text-gray-500 font-mono text-sm">{index + 1}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "TaskID", task.TaskID)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "TaskName", task.TaskName)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "Category", task.Category)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "Duration", task.Duration)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "RequiredSkills", task.RequiredSkills)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "PreferredPhases", task.PreferredPhases)}</TableCell>
            <TableCell>{renderEditableCell("tasks", index, "MaxConcurrent", task.MaxConcurrent)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Data Grid</h2>
          <p className="text-gray-600 mt-2">View, edit, and AI-correct your data with comprehensive validation</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleComprehensiveDataCheck}
            disabled={
              isRunningComprehensiveCheck || (clients.length === 0 && workers.length === 0 && tasks.length === 0)
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {isRunningComprehensiveCheck ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                AI Data Check & Fix
              </>
            )}
          </Button>

          <Dialog open={aiCorrectionDialog} onOpenChange={setAiCorrectionDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Wand2 className="mr-2 h-4 w-4" />
                AI Correct Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>AI Data Correction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Describe what changes you want to make to the <strong>{activeTab}</strong> data. AI will apply your
                    instructions to all records.
                  </p>
                  <Textarea
                    value={correctionInstruction}
                    onChange={(e) => setCorrectionInstruction(e.target.value)}
                    placeholder="Example: 'If AttributesJSON field is not valid JSON, create a JSON object with key 'message' and the original content as value'"
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium mb-2">Example Instructions:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>
                      • &quot;Fix all invalid JSON in AttributesJSON field by wrapping content in {"{"}
                      &apos;message&apos;: &apos;content&apos;{"}"}
                      &quot;
                    </li>
                    <li>• &quot;Convert all Skills fields to lowercase and remove extra spaces&quot;</li>
                    <li>• &quot;Standardize all GroupTag values to proper case (GroupA, GroupB, etc.)&quot;</li>
                    <li>• &quot;If Duration is 0 or negative, set it to 1&quot;</li>
                  </ul>
                </div>

                {correctionStatus === "error" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{correctionMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => setAiCorrectionDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAICorrection} disabled={!correctionInstruction.trim() || isApplyingCorrection}>
                    {isApplyingCorrection ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Apply AI Correction
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleDownloadCorrectedData}>
            <Download className="mr-2 h-4 w-4" />
            Download {activeTab}
          </Button>
        </div>
      </div>

      {!dataCompleteness.isComplete && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div>
              <p className="font-medium mb-2">Incomplete Dataset Detected:</p>
              <ul className="text-sm space-y-1">
                {dataCompleteness.recommendations.map((rec, index) => (
                  <li key={index}>• {rec}</li>
                ))}
              </ul>
              <p className="text-sm mt-2">
                The AI Data Check & Fix will work with available data, but full validation requires all datasets.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {correctionStatus === "success" && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{correctionMessage}</AlertDescription>
        </Alert>
      )}

      {correctionStatus === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{correctionMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="workers">Workers ({workers.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>Clients Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <ClientsTable />
              </div>
              {validationErrors.filter((error) => error.entity === "clients").length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-3">Validation Errors in Clients Data:</h4>
                  <div className="space-y-2">
                    {validationErrors
                      .filter((error) => error.entity === "clients")
                      .map((error) => (
                        <div key={error.id} className="flex items-start space-x-3 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-red-700">{error.message}</p>
                            {error.field && error.rowIndex !== undefined && (
                              <p className="text-red-600 text-xs mt-1">
                                {"Row " + (error.rowIndex + 1) + ", Field: " + error.field}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers">
          <Card>
            <CardHeader>
              <CardTitle>Workers Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <WorkersTable />
              </div>
              {validationErrors.filter((error) => error.entity === "workers").length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-3">Validation Errors in Workers Data:</h4>
                  <div className="space-y-2">
                    {validationErrors
                      .filter((error) => error.entity === "workers")
                      .map((error) => (
                        <div key={error.id} className="flex items-start space-x-3 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-red-700">{error.message}</p>
                            {error.field && error.rowIndex !== undefined && (
                              <p className="text-red-600 text-xs mt-1">
                                Row {error.rowIndex + 1}, Field: {error.field}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <TasksTable />
              </div>
              {validationErrors.filter((error) => error.entity === "tasks").length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-3">Validation Errors in Tasks Data:</h4>
                  <div className="space-y-2">
                    {validationErrors
                      .filter((error) => error.entity === "tasks")
                      .map((error) => (
                        <div key={error.id} className="flex items-start space-x-3 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-red-700">{error.message}</p>
                            {error.field && error.rowIndex !== undefined && (
                              <p className="text-red-600 text-xs mt-1">
                                Row {error.rowIndex + 1}, Field: {error.field}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
