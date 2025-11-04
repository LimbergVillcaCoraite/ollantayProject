import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({children}){
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, type='info', timeout=3500)=>{
    const id = Date.now() + Math.random()
    setToasts(t => [...t, {id, message, type}])
    setTimeout(()=>{ setToasts(t => t.filter(x=>x.id !== id)) }, timeout)
  }, [])
  const remove = useCallback((id)=> setToasts(t => t.filter(x=>x.id !== id)), [])
  // Backwards compatibility alias: some components may call toast.showToast
  const showToast = useCallback((message, type='info', timeout=3500)=> push(message, type, timeout), [push])
  const value = { push, showToast }
  const bgFor = (type) => type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-emerald-600' : 'bg-sky-600')
  const iconFor = (type) => {
    if(type === 'error') return (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.68-1.36 3.445 0l6.518 11.588C19.8 16.545 18.53 18 17.02 18H2.98c-1.51 0-2.78-1.455-1.2-3.313L8.257 3.1zM11 9a1 1 0 10-2 0v3a1 1 0 102 0V9zm-1 6a1.25 1.25 0 100-2.5A1.25 1.25 0 0010 15z" clipRule="evenodd"/></svg>)
    if(type === 'success') return (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.707-6.293a1 1 0 011.414-1.414L11 11.586l3.293-3.293a1 1 0 111.414 1.414L11 14l-2.707-2.707z" clipRule="evenodd"/></svg>)
    return (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-6h2v6z"/></svg>)
  }
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-20 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} role="status" className={`max-w-xs w-full flex items-center gap-3 px-3 py-2 rounded-lg shadow-lg text-white transform transition-all duration-200 ease-out ${bgFor(t.type)} `} style={{animation: 'toast-in 220ms ease-out'}}>
            <div className="flex-shrink-0">{iconFor(t.type)}</div>
            <div className="flex-1 text-sm leading-tight">{t.message}</div>
            <button onClick={()=>remove(t.id)} className="ml-3 opacity-90 hover:opacity-100 p-1 rounded" aria-label="Cerrar notificación">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(){
  const ctx = useContext(ToastContext)
  if(!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export default ToastContext
