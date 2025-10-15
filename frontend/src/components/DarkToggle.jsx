import React from 'react'

export default function DarkToggle({dark, setDark, size='5'}){
  return (
    <button onClick={()=> setDark && setDark(!dark)} aria-label="Toggle dark mode" title="Toggle dark mode" className="inline-flex items-center justify-center p-2 rounded-full bg-gray-100 dark:bg-gray-700 top-toggle">
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-${size} w-${size} text-yellow-400`} viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM15.657 4.343a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM15.657 15.657a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM4.343 15.657a1 1 0 010-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 9a1 1 0 110 2H2a1 1 0 110-2h1zM4.343 4.343a1 1 0 011.414 0l.707.707A1 1 0 015.05 6.464L4.343 5.757a1 1 0 010-1.414z"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-${size} w-${size} text-gray-600`} viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 116.707 2.707a7 7 0 0010.586 10.586z"/></svg>
      )}
    </button>
  )
}
