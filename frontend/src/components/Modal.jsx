import React from 'react'

export default function Modal({ title = '', children, onClose = () => {}, size = 'lg' }) {
  const sizeClass = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizeClass} my-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-300">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
