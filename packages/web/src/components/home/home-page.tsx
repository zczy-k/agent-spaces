"use client"

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import AnimatedTabs from '@/components/forgeui/animated-tabs'
import { UsageDashboard } from '@/components/home/usage-dashboard'
import { WorkflowExecutionPanel } from '@/components/home/workflow-execution-panel'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Workspace } from '@agent-spaces/shared'

const TABS = ['Agent', 'Workflow']

export function HomePage({ initialWorkspaces }: { initialWorkspaces: Workspace[] }) {
  const setWorkspaces = useWorkspaceStore((store) => store.setWorkspaces)
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = TABS.includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : TABS[0]

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces, setWorkspaces])

  const handleTabChange = (tab: string) => {
    router.replace(tab === TABS[0] ? '?' : `?tab=${tab.toLowerCase()}`)
  }

  return (
    <div className='flex h-full w-full flex-col overflow-auto'>
      <div className='border-b border-border px-4 pt-4 sm:px-6'>
        <AnimatedTabs tabs={TABS} variant="underline" activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
      <main className='w-full flex-1 px-4 py-6 sm:px-6'>
        {activeTab === 'Agent' && <UsageDashboard />}
        {activeTab === 'Workflow' && <WorkflowExecutionPanel />}
      </main>
    </div>
  )
}
