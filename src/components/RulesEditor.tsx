"use client"

import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Edit, Trash2, Wand2, Download, Lightbulb, Settings, CheckCircle, AlertCircle } from "lucide-react"
import type { RootState } from "@/store"
import { addRule, updateRule, deleteRule } from "@/store"
import { convertNaturalLanguageToRule, recommendRules } from "@/lib/gemini"
import { saveRules } from "@/lib/indexeddb"
import type { Rule } from "@/types"

export default function RulesEditor() {
  const dispatch = useDispatch()
  const { rules, clients, workers, tasks } = useSelector((state: RootState) => state.app)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("")
  const [isProcessingNL, setIsProcessingNL] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [conversionMessage, setConversionMessage] = useState("")
  const [conversionStatus, setConversionStatus] = useState<"idle" | "success" | "error">("idle")

  const [formData, setFormData] = useState<Partial<Rule>>({
    type: "coRun",
    name: "",
    description: "",
    parameters: {},
    priority: 1,
    active: true,
  })

  const resetForm = () => {
    setFormData({
      type: "coRun",
      name: "",
      description: "",
      parameters: {},
      priority: 1,
      active: true,
    })
    setEditingRule(null)
    setNaturalLanguageInput("")
    setConversionMessage("")
    setConversionStatus("idle")
  }

  const handleSaveRule = async () => {
    if (!formData.name || !formData.description) return

    const rule: Rule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      type: formData.type!,
      name: formData.name,
      description: formData.description,
      parameters: formData.parameters || {},
      priority: formData.priority || 1,
      active: formData.active !== false,
    }

    try {
      if (editingRule) {
        dispatch(updateRule({ id: rule.id, updates: rule }))
      } else {
        dispatch(addRule(rule))
      }

      const updatedRules = editingRule ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]

      await saveRules(updatedRules)

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Failed to save rule:", error)
    }
  }

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule)
    setFormData(rule)
    setIsDialogOpen(true)
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      dispatch(deleteRule(ruleId))
      const updatedRules = rules.filter((r) => r.id !== ruleId)
      await saveRules(updatedRules)
    } catch (error) {
      console.error("Failed to delete rule:", error)
    }
  }

  const handleNaturalLanguageConversion = async () => {
    if (!naturalLanguageInput.trim()) return

    setIsProcessingNL(true)
    setConversionMessage("")
    setConversionStatus("idle")

    try {
      const ruleData = await convertNaturalLanguageToRule(naturalLanguageInput)
      if (ruleData) {
        setFormData({
          ...formData,
          type: ruleData.type as Rule["type"],
          name: ruleData.name as string,
          description: ruleData.description as string,
          parameters: ruleData.parameters as Record<string, unknown>,
        })
        setConversionStatus("success")
        setConversionMessage("Successfully converted to rule! Review and adjust the fields below.")
      } else {
        setConversionStatus("error")
        setConversionMessage(
          "Failed to convert the description to a rule. Please try rephrasing or create the rule manually.",
        )
      }
    } catch (error) {
      console.error("Failed to convert natural language to rule:", error)
      setConversionStatus("error")
      setConversionMessage("Failed to convert the description. Please check your internet connection and try again.")
    } finally {
      setIsProcessingNL(false)

      setTimeout(() => {
        setConversionMessage("")
        setConversionStatus("idle")
      }, 5000)
    }
  }

  const loadRecommendations = async () => {
    setIsLoadingRecommendations(true)
    try {
      const recs = await recommendRules({
        clients: clients as unknown as Record<string, unknown>[],
        workers: workers as unknown as Record<string, unknown>[],
        tasks: tasks as unknown as Record<string, unknown>[],
      })
      setRecommendations(recs)
    } catch (error) {
      console.error("Failed to load recommendations:", error)
      setRecommendations([])
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  const exportRulesConfig = () => {
    const config = {
      rules: rules.filter((rule) => rule.active),
      metadata: {
        exportDate: new Date().toISOString(),
        totalRules: rules.length,
        activeRules: rules.filter((rule) => rule.active).length,
      },
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "rules-config.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderRuleParameters = () => {
    const updateParameters = (updates: Record<string, unknown>) => {
      setFormData({
        ...formData,
        parameters: { ...formData.parameters, ...updates },
      })
    }

    switch (formData.type) {
      case "coRun":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Task IDs (comma-separated)</label>
              <Input
                value={formData.parameters?.tasks?.toString() || ""}
                onChange={(e) =>
                  updateParameters({
                    tasks: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="T001,T002,T003"
              />
              <p className="text-xs text-gray-500 mt-1">Enter task IDs that must run together</p>
            </div>
          </div>
        )

      case "slotRestriction":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Group Type</label>
              <Select
                value={(formData.parameters?.groupType as string) || ""}
                onValueChange={(value) => updateParameters({ groupType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select group type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client Group</SelectItem>
                  <SelectItem value="worker">Worker Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Group Name</label>
              <Input
                value={(formData.parameters?.groupName as string) || ""}
                onChange={(e) => updateParameters({ groupName: e.target.value })}
                placeholder="GroupA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Min Common Slots</label>
              <Input
                type="number"
                value={(formData.parameters?.minCommonSlots as number) || ""}
                onChange={(e) => updateParameters({ minCommonSlots: Number.parseInt(e.target.value) || 0 })}
                placeholder="2"
                min="0"
              />
            </div>
          </div>
        )

      case "loadLimit":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Worker Group</label>
              <Input
                value={(formData.parameters?.workerGroup as string) || ""}
                onChange={(e) => updateParameters({ workerGroup: e.target.value })}
                placeholder="TeamA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Slots Per Phase</label>
              <Input
                type="number"
                value={(formData.parameters?.maxSlotsPerPhase as number) || ""}
                onChange={(e) => updateParameters({ maxSlotsPerPhase: Number.parseInt(e.target.value) || 0 })}
                placeholder="3"
                min="1"
              />
            </div>
          </div>
        )

      case "phaseWindow":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Task ID</label>
              <Input
                value={(formData.parameters?.taskId as string) || ""}
                onChange={(e) => updateParameters({ taskId: e.target.value })}
                placeholder="T001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Allowed Phases (comma-separated)</label>
              <Input
                value={formData.parameters?.allowedPhases?.toString() || ""}
                onChange={(e) =>
                  updateParameters({
                    allowedPhases: e.target.value
                      .split(",")
                      .map((p) => Number.parseInt(p.trim()))
                      .filter((p) => !isNaN(p)),
                  })
                }
                placeholder="1,2,3"
              />
            </div>
          </div>
        )

      default:
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Parameters (JSON)</label>
            <Textarea
              value={JSON.stringify(formData.parameters || {}, null, 2)}
              onChange={(e) => {
                try {
                  const params = JSON.parse(e.target.value)
                  setFormData({ ...formData, parameters: params })
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder="{}"
              rows={4}
            />
          </div>
        )
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Business Rules</h2>
          <p className="text-gray-600 mt-2">
            Define and manage business rules for task assignment and resource allocation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadRecommendations} disabled={isLoadingRecommendations}>
            <Lightbulb className={`mr-2 h-4 w-4 ${isLoadingRecommendations ? "animate-spin" : ""}`} />
            Get AI Recommendations
          </Button>
          <Button variant="outline" size="sm" onClick={exportRulesConfig}>
            <Download className="mr-2 h-4 w-4" />
            Export Config
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  resetForm()
                  setIsDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit Rule" : "Create New Rule"}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[80vh] pr-4">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Wand2 className="mr-2 h-5 w-5" />
                        Natural Language Input
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={naturalLanguageInput}
                        onChange={(e) => setNaturalLanguageInput(e.target.value)}
                        placeholder="e.g., 'Make T12 and T14 co-run' or 'Limit TeamA to 3 slots per phase'"
                        rows={3}
                        className="resize-none"
                      />
                      <Button
                        onClick={handleNaturalLanguageConversion}
                        disabled={isProcessingNL || !naturalLanguageInput.trim()}
                        variant="outline"
                        size="sm"
                      >
                        <Wand2 className={`mr-2 h-4 w-4 ${isProcessingNL ? "animate-spin" : ""}`} />
                        Convert to Rule
                      </Button>

                      {conversionMessage && (
                        <Alert variant={conversionStatus === "error" ? "destructive" : "default"}>
                          {conversionStatus === "success" ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <AlertDescription>{conversionMessage}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Rule Type</label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: Rule["type"]) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coRun">Co-run Tasks</SelectItem>
                          <SelectItem value="slotRestriction">Slot Restriction</SelectItem>
                          <SelectItem value="loadLimit">Load Limit</SelectItem>
                          <SelectItem value="phaseWindow">Phase Window</SelectItem>
                          <SelectItem value="patternMatch">Pattern Match</SelectItem>
                          <SelectItem value="precedenceOverride">Precedence Override</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Priority</label>
                      <Input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: Number.parseInt(e.target.value) || 1 })}
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Rule Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter rule name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this rule does"
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {renderRuleParameters()}

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                    <label className="text-sm font-medium">Active</label>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveRule} disabled={!formData.name || !formData.description}>
                      {editingRule ? "Update Rule" : "Create Rule"}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lightbulb className="mr-2 h-5 w-5" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <Alert key={index}>
                    <AlertDescription>{recommendation}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg mb-2">No rules defined yet</p>
              <p className="text-gray-400 text-sm">
                Create your first rule to get started with business logic automation
              </p>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-lg font-semibold truncate">{rule.name}</h3>
                      <Badge variant={rule.active ? "default" : "secondary"}>
                        {rule.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{rule.type}</Badge>
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                    </div>
                    <p className="text-gray-600 mb-3 line-clamp-2">{rule.description}</p>
                    <div className="text-sm text-gray-500">
                      <strong>Parameters:</strong>
                      <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
                        {JSON.stringify(rule.parameters)}
                      </code>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
