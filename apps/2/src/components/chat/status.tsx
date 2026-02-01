'use client'

import type { ThreadStatus } from 'convex-durable-agents/react'

import { CheckCircleIcon, LoaderIcon, PauseCircleIcon, PlayIcon, XCircleIcon } from 'lucide-react'

interface StatusBadgeProps {
  isFailed?: boolean
  isRunning?: boolean
  isStopped?: boolean
  onResume?: () => void
  status?: ThreadStatus
}

const statusConfig: Record<ThreadStatus, { color: string; icon: typeof LoaderIcon; label: string }> = {
    awaiting_tool_results: { color: 'text-amber-500', icon: LoaderIcon, label: 'Running tools...' },
    completed: { color: 'text-green-500', icon: CheckCircleIcon, label: 'Completed' },
    failed: { color: 'text-destructive', icon: XCircleIcon, label: 'Failed' },
    stopped: { color: 'text-muted-foreground', icon: PauseCircleIcon, label: 'Stopped' },
    streaming: { color: 'text-blue-500', icon: LoaderIcon, label: 'Generating...' }
  },
  StatusBadge = ({ isFailed, isRunning, isStopped, onResume, status }: StatusBadgeProps) => {
    const showResumeBar = isFailed === true || isStopped === true,
      currentStatus = status ?? (isRunning === true ? 'streaming' : 'completed'),
      config = statusConfig[currentStatus],
      Icon = config.icon

    return (
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <div className='flex items-center gap-2'>
          <Icon className={`size-4 ${config.color} ${currentStatus === 'streaming' ? 'animate-spin' : ''}`} />
          <span className={`text-sm ${config.color}`}>{config.label}</span>
        </div>
        {showResumeBar && onResume ? (
          <button
            className='flex items-center gap-1 rounded-sm bg-primary px-3 py-1 text-xs text-primary-foreground'
            onClick={onResume}
            type='button'>
            <PlayIcon className='size-3' /> Resume
          </button>
        ) : null}
      </div>
    )
  }

export default StatusBadge
