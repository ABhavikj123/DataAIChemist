"use client"

import { useState } from "react"
import DataGrid from "@/components/DataGrid"
import DataUpload from "@/components/DataUpload"
import ExportSection from "@/components/ExportSection"
import NaturalSearch from "@/components/NaturalSearch"
import PrioritySettings from "@/components/PrioritySettings"
import RulesEditor from "@/components/RulesEditor"
import Sidebar from "@/components/Sidebar"
import ValidationSummary from "@/components/ValidationSummary"

export default function Page() {
  const [activeSection, setActiveSection] = useState("upload")

  function renderSection() {
    switch (activeSection) {
      case "data":
        return <DataGrid />
      case "search":
        return <NaturalSearch />
      case "validate":
        return <ValidationSummary onOpenGrid={() => setActiveSection("data")} />
      case "rules":
        return <RulesEditor />
      case "priority":
        return <PrioritySettings />
      case "export":
        return <ExportSection />
      default:
        return <DataUpload />
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-950">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">{renderSection()}</main>
    </div>
  )
}
