import React from 'react'

export default function TableWrapper({ children, className = '' }) {
  // Provides a responsive horizontal scroll container and touch-friendly scrolling
  return (
    <div className={`w-full overflow-x-auto -mx-4 px-4 ${className}`}> 
      <div className="min-w-full">{children}</div>
    </div>
  )
}
