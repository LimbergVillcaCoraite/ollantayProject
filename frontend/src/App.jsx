import React, {useState, useEffect} from 'react'
import Tipos from './components/Tipos'
import Personas from './components/Personas'
import Prestamos from './components/Prestamos'
import { ToastProvider } from './ToastContext'
import RoleSelector from './components/RoleSelector'
import Login from './components/Login'
import { version } from '../package.json'

export default function App(){
  const [view, setView] = useState('tipos')
  const API_TYPES = import.meta.env.VITE_API_TYPES || 'http://localhost:8001'
  const API_PERSONS = import.meta.env.VITE_API_PERSONS || 'http://localhost:8002'
  const API_PRESTAMOS = import.meta.env.VITE_API_PRESTAMOS || 'http://localhost:8003'
  const [dark, setDark] = useState(() => localStorage.getItem('ollantay-dark') === '1')
  const [userRole, setUserRole] = useState('')
  const [loggedUser, setLoggedUser] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const handleLogoutConfirm = ()=>{
    // call backend logout to clear cookie and clear session client-side
    (async ()=>{
      try{ await fetch(`${API_PERSONS}/auth/logout`, { method: 'POST', credentials: 'include' }) }catch(e){}
      setShowLogoutConfirm(false)
      setLoggedUser(null)
      setUserRole('')
      // remove any legacy localStorage session entries
      try{ localStorage.removeItem('ollantay-user'); localStorage.removeItem('ollantay-role'); }catch(e){}
    })()
  }
  const handleLogoutCancel = ()=> setShowLogoutConfirm(false)

  // NOTE: session is persisted server-side via httpOnly cookie; frontend refresh uses /auth/me to restore

  // restore session from backend cookie on mount
  useEffect(()=>{
    const restore = async ()=>{
      try{
        const res = await fetch(`${API_PERSONS}/auth/me`, { credentials: 'include' })
        if(!res.ok) return
        const data = await res.json()
        setLoggedUser(data)
        setUserRole(data.role)
      }catch(e){ /* ignore */ }
    }
    restore()
  }, [])

  // central setter that persists the preference immediately and applies class to body
  const updateDark = (value)=>{
    setDark(value)
    try{ localStorage.setItem('ollantay-dark', value ? '1' : '0') }catch(e){}
    if(value) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }

  // ensure initial class is applied on mount
  useEffect(()=>{ if(dark) document.body.classList.add('dark') }, [])

  // small reusable icon to keep logout icon uniform
  const LogoutIcon = ({className='h-5 w-5'}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h6a1 1 0 110 2H5v10h5a1 1 0 110 2H4a1 1 0 01-1-1V4zm11.707 4.293a1 1 0 00-1.414 1.414L15.586 11H9a1 1 0 100 2h6.586l-2.293 1.293a1 1 0 101.414 1.414l4-2.25a1 1 0 000-1.414l-4-2.25z" clipRule="evenodd"/>
    </svg>
  )

  // types state for Tipos component
  const [types, setTypes] = useState([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState(null)

  const loadTypes = async ()=>{
    setTypesLoading(true)
    setTypesError(null)
    try{
      const res = await fetch(`${API_TYPES}/types`)
      if(!res.ok) throw new Error(`Server ${res.status}`)
      const data = await res.json()
      setTypes(data)
    }catch(err){ setTypesError(err.message) }
    finally{ setTypesLoading(false) }
  }

  useEffect(()=>{ loadTypes() }, [])

  // handlers forwarded to Tipos component
  const handleEditTipo = (t)=>{ /* open edit in a modal or implement inline if desired */ }
  const handleDeleteTipo = async (id)=>{
    if(!confirm('Eliminar tipo?')) return
    try{
      const res = await fetch(`${API_TYPES}/types/${id}`, {method:'DELETE', headers: { 'X-User-Role': userRole } })
      if(res.status !== 204) throw new Error('Failed to delete')
      loadTypes()
    }catch(err){ console.error('Error deleting tipo:', err); }
  }

  // If not logged, render only a centered login page
  if(!loggedUser){
    return (
      <ToastProvider>
        <div className={`login-outer ${dark ? 'dark' : ''}`}>
          <div className="login-card bg-panel">
            <div className="mb-4 text-center">
              <h2 className="text-xl font-semibold title">Sistema Ollantay</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gestión de préstamos y personas</p>
            </div>
            <Login API_PERSONA={API_PERSONS} onLogin={(u)=>{ setLoggedUser(u); setUserRole(u.role) }} dark={dark} setDark={updateDark} />
          </div>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto p-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded flex items-center justify-center font-bold">SO</div>
              <div>
                <h1 className="text-2xl font-bold">Sistema Ollantay</h1>
                <p className="text-sm text-gray-600">Gestión de préstamos y personas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {loggedUser?.role === 'admin' ? (
                <RoleSelector role={userRole} onChange={setUserRole} />
              ) : (
                <div className="text-sm text-gray-600">Rol: {userRole}</div>
              )}
              <button
                onClick={()=>{ setShowLogoutConfirm(true) }}
                className="btn btn-secondary p-2"
                aria-label="Salir"
                title="Salir"
              >
                <LogoutIcon />
              </button>
              <button
                onClick={()=> updateDark(!dark)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700"
                role="switch"
                aria-checked={dark}
                aria-label="Toggle dark mode"
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full transition-transform ${dark ? 'translate-x-0' : 'translate-x-0'}`}>
                  {dark ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM15.657 4.343a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM15.657 15.657a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM4.343 15.657a1 1 0 010-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 9a1 1 0 110 2H2a1 1 0 110-2h1zM4.343 4.343a1 1 0 011.414 0l.707.707A1 1 0 015.05 6.464L4.343 5.757a1 1 0 010-1.414z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 116.707 2.707a7 7 0 0010.586 10.586z"/></svg>
                  )}
                </span>
                <span className="sr-only">Modo oscuro</span>
              </button>
            </div>
          </div>

  <nav className="mt-4 flex items-center gap-2">
    <button onClick={()=>setView('tipos')} className={`btn ${view==='tipos' ? 'btn-primary' : 'btn-secondary'}`}>Tipos</button>
            <button onClick={()=>setView('personas')} className={`btn ${view==='personas' ? 'btn-primary' : 'btn-secondary'}`}>Personas</button>
            <button onClick={()=>setView('prestamos')} className={`btn ${view==='prestamos' ? 'btn-primary' : 'btn-secondary'}`}>Prestamos</button>
            <div className="ml-auto text-sm text-gray-500">{loggedUser?.username ? `Usuario: ${loggedUser.username}` : `Rol: ${userRole}`}</div>
          </nav>
        </header>

        <main>
          {view === 'tipos' && <Tipos API={API_TYPES} types={types} loading={typesLoading} error={typesError} onEdit={handleEditTipo} onDelete={handleDeleteTipo} onRefresh={loadTypes} dark={dark} userRole={userRole} />}
          {view === 'personas' && <Personas API={API_PERSONS} API_TYPES={API_TYPES} dark={dark} userRole={userRole} />}
          {view === 'prestamos' && <Prestamos API={API_PRESTAMOS} API_PERSONAS={API_PERSONS} API_TYPES={API_TYPES} dark={dark} userRole={userRole} />}
        </main>

        <footer className="mt-8 py-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Sistema Ollantay — desarrollado con ❤️
          <div className="mt-1 text-xs text-gray-400">Versión: v{version}</div>
        </footer>
      </div>
    </div>
      <LogoutConfirm open={showLogoutConfirm} onCancel={handleLogoutCancel} onConfirm={handleLogoutConfirm} />
    </ToastProvider>
  )
}


// Logout confirmation modal (renders when showLogoutConfirm is true)
function LogoutConfirm({open, onCancel, onConfirm}){
  if(!open) return null
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-2">Confirmar cierre de sesión</h3>
        <p className="text-sm text-gray-600 mb-4">¿Deseas cerrar la sesión actual?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
          <button onClick={onConfirm} className="btn btn-primary">Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

