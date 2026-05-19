"use client"

import { useState } from "react"
import { AlertTriangle, BarChart3, Database, Download, FileUp, Menu, Search, Settings, SlidersHorizontal, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store"

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

const sections = [
  { id: "upload", label: "Ingestion", icon: FileUp },
  { id: "data", label: "Financial Ledger", icon: Database },
  { id: "search", label: "English Query", icon: Search },
  { id: "validate", label: "Data Validation", icon: BarChart3 },
  { id: "rules", label: "Audit Controls", icon: Settings },
  { id: "priority", label: "Scenario Planner", icon: SlidersHorizontal },
  { id: "export", label: "Accounting Export", icon: Download },
]

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { datasets, validationIssues } = useAppStore((state) => ({
    datasets: state.datasets,
    validationIssues: state.validationIssues,
  }))
  const issueCount = validationIssues.length
  const errorCount = validationIssues.filter((issue) => issue.severity === "error").length

  const content = (
    <aside className="h-full border-r border-slate-200 bg-white px-3 py-4">
      <div className="px-2 pb-6">
        <div className="text-xl font-semibold tracking-tight text-slate-950">Abacum Data Pilot</div>
        <div className="mt-1 text-xs font-medium uppercase text-slate-500">FinOps schema linter</div>
      </div>

      <nav className="space-y-1">
        {sections.map((section) => {
          const Icon = section.icon
          const active = activeSection === section.id
          return (
            <Button
              key={section.id}
              variant={active ? "default" : "ghost"}
              className={`h-10 w-full justify-start rounded-md ${active ? "bg-slate-950 text-white" : "text-slate-700"}`}
              onClick={() => {
                onSectionChange(section.id)
                setIsOpen(false)
              }}
            >
              <Icon className="mr-3 h-4 w-4" />
              <span className="truncate">{section.label}</span>
              {section.id === "validate" && issueCount > 0 && (
                <Badge variant={errorCount > 0 ? "destructive" : "secondary"} className="ml-auto">
                  {issueCount}
                </Badge>
              )}
            </Button>
          )
        })}
      </nav>

      <div className="mt-6 rounded-md border border-slate-200 p-3 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Datasets</span>
          <span className="font-semibold text-slate-950">{datasets.length}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-slate-600">
          <span>Validation</span>
          <span className={errorCount > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>
            {errorCount > 0 ? `${errorCount} errors` : "clean"}
          </span>
        </div>
        {issueCount > 0 && (
          <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
            <span>Open the validation console to jump straight to affected cells.</span>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <>
      <Button variant="outline" size="sm" className="fixed left-3 top-3 z-50 md:hidden" onClick={() => setIsOpen(true)}>
        <Menu className="h-4 w-4" />
      </Button>
      <div className="hidden h-screen w-72 shrink-0 md:block">{content}</div>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-slate-950/40" aria-label="Close navigation" onClick={() => setIsOpen(false)} />
          <div className="relative h-full w-72 bg-white">
            <Button variant="ghost" size="sm" className="absolute right-2 top-2 z-10" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
            {content}
          </div>
        </div>
      )}
    </>
  )
}
