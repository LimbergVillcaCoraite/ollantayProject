import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({children}){
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, type='info', timeout=3000)=>{
    const id = Date.now() + Math.random()
    setToasts(t => [...t, {id, message, type}])
    setTimeout(()=>{ setToasts(t => t.filter(x=>x.id !== id)) }, timeout)
  }, [])
  const value = { push }
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={{position:'fixed', right:16, top:16, zIndex:9999}}>
        {toasts.map(t => (
          <div key={t.id} style={{marginBottom:8, minWidth:220, padding:'8px 12px', borderRadius:6, color:'#fff', boxShadow:'0 4px 10px rgba(0,0,0,0.2)', background: (t.type==='error'?'#dc2626': t.type==='success'?'#16a34a':'#2563eb')}}>
            {t.message}
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
