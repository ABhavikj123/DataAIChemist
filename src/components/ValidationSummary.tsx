"use client"

import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertTriangle, XCircle, Wand2, RefreshCw } from "lucide-react"
import type { RootState } from "@/store"
import { setValidationErrors, setLoading } from "@/store"
import { validateAll } from "@/lib/validation"
import { validateDataWithAI, suggestErrorFixes } from "@/lib/ai"
import { saveValidationErrors } from "@/lib/indexeddb"
import type { ValidationError } from "@/types"

export default function ValidationSummary() {
  const dispatch = useDispatch()
  const { clients, workers, tasks, validationErrors, isLoading } = useSelector((state: RootState) => state.app)
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ error: string; suggestion: string }>>([])
  const [isRunningAIValidation, setIsRunningAIValidation] = useState(false)
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)

  const errorCount = validationErrors.filter((error) => error.type === "error").length
  const warningCount = validationErrors.filter((error) => error.type === "warning").length
  const totalIssues = errorCount + warningCount

  const runValidation = async () => {
    dispatch(setLoading(true))
    try {
      const errors = validateAll(clients, workers, tasks)
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))
    } catch (error) {
      console.error("Validation failed:", error)
    } finally {
      dispatch(setLoading(false))
    }
  }

  const runAIValidation = async () => {
    setIsRunningAIValidation(true)
    try {
      const [clientsAIErrors, workersAIErrors, tasksAIErrors] = await Promise.all([
        validateDataWithAI(clients, "clients"),
        validateDataWithAI(workers, "workers"),
        validateDataWithAI(tasks, "tasks"),
      ])

      const aiValidationErrors: ValidationError[] = [
        ...clientsAIErrors.map((message, index) => ({
          id: `ai-clients-${index}`,
          type: "warning" as const,
          message,
          entity: "clients" as const,
        })),
        ...workersAIErrors.map((message, index) => ({
          id: `ai-workers-${index}`,
          type: "warning" as const,
          message,
          entity: "workers" as const,
        })),
        ...tasksAIErrors.map((message, index) => ({
          id: `ai-tasks-${index}`,
          type: "warning" as const,
          message,
          entity: "tasks" as const,
        })),
      ]

      const allErrors = [...validationErrors, ...aiValidationErrors]
      await saveValidationErrors(allErrors)
      dispatch(setValidationErrors(allErrors))
    } catch (error) {
      console.error("AI validation failed:", error)
    } finally {
      setIsRunningAIValidation(false)
    }
  }

  const generateSuggestions = async () => {
    if (validationErrors.length === 0) return

    setIsGeneratingSuggestions(true)
    try {
      const errorMessages = validationErrors.filter((error) => error.type === "error").map((error) => error.message)

      const suggestions = await suggestErrorFixes(errorMessages)
      setAiSuggestions(suggestions)
    } catch (error) {
      console.error("Failed to generate suggestions:", error)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  const getValidationScore = () => {
    const totalRecords = clients.length + workers.length + tasks.length
    if (totalRecords === 0) return 100

    const errorWeight = 2
    const warningWeight = 1
    const totalWeight = errorCount * errorWeight + warningCount * warningWeight
    const maxPossibleWeight = totalRecords * errorWeight

    return Math.max(0, Math.round(((maxPossibleWeight - totalWeight) / maxPossibleWeight) * 100))
  }

  const validationScore = getValidationScore()

  const groupedErrors = validationErrors.reduce(
    (acc, error) => {
      if (!acc[error.entity]) {
        acc[error.entity] = []
      }
      acc[error.entity].push(error)
      return acc
    },
    {} as Record<string, ValidationError[]>,
  )

  const renderErrorList = (errors: ValidationError[]) => (
    <div className="space-y-2">
      {errors.map((error) => (
        <div key={error.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
          {error.type === "error" ? (
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{error.message}</p>
            {error.field && <p className="text-xs text-gray-500 mt-1">Field: {error.field}</p>}
            {error.rowIndex !== undefined && <p className="text-xs text-gray-500">Row: {error.rowIndex + 1}</p>}
          </div>
          <Badge variant={error.type === "error" ? "destructive" : "secondary"}>{error.type}</Badge>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Validation Summary</h2>
        <p className="text-gray-600 mt-2">Review data quality and validation results</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Quality Score</p>
                <p className="text-3xl font-bold text-gray-900">{validationScore}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <Progress value={validationScore} className="mt-4" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-3xl font-bold text-red-600">{errorCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Warnings</p>
                <p className="text-3xl font-bold text-yellow-600">{warningCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex space-x-4">
        <Button onClick={runValidation} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Run Validation
        </Button>
        <Button variant="outline" onClick={runAIValidation} disabled={isRunningAIValidation}>
          <Wand2 className={`mr-2 h-4 w-4 ${isRunningAIValidation ? "animate-spin" : ""}`} />
          AI Validation
        </Button>
        <Button variant="outline" onClick={generateSuggestions} disabled={isGeneratingSuggestions || errorCount === 0}>
          <Wand2 className={`mr-2 h-4 w-4 ${isGeneratingSuggestions ? "animate-spin" : ""}`} />
          Get AI Suggestions
        </Button>
      </div>

      {totalIssues === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>All validations passed! Your data is ready for processing.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Validation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="clients">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="clients">Clients ({groupedErrors.clients?.length || 0})</TabsTrigger>
                <TabsTrigger value="workers">Workers ({groupedErrors.workers?.length || 0})</TabsTrigger>
                <TabsTrigger value="tasks">Tasks ({groupedErrors.tasks?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="clients">
                {groupedErrors.clients?.length > 0 ? (
                  renderErrorList(groupedErrors.clients)
                ) : (
                  <p className="text-gray-500 text-center py-4">No issues found in clients data</p>
                )}
              </TabsContent>

              <TabsContent value="workers">
                {groupedErrors.workers?.length > 0 ? (
                  renderErrorList(groupedErrors.workers)
                ) : (
                  <p className="text-gray-500 text-center py-4">No issues found in workers data</p>
                )}
              </TabsContent>

              <TabsContent value="tasks">
                {groupedErrors.tasks?.length > 0 ? (
                  renderErrorList(groupedErrors.tasks)
                ) : (
                  <p className="text-gray-500 text-center py-4">No issues found in tasks data</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {aiSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wand2 className="mr-2 h-5 w-5" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiSuggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <p className="font-medium text-gray-900 mb-2">Error:</p>
                  <p className="text-sm text-gray-700 mb-3">{suggestion.error}</p>
                  <p className="font-medium text-gray-900 mb-2">Suggestion:</p>
                  <p className="text-sm text-blue-700">{suggestion.suggestion}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
