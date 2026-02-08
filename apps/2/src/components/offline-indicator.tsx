'use client'

import useOnlineStatus from '~/hook/use-online-status'

const OfflineIndicator = () => {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className='fixed bottom-4 left-4 z-50 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-lg'>
      You are offline
    </div>
  )
}

export default OfflineIndicator
