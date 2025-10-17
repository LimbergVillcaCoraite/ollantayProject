import React, {useState, useEffect} from 'react'
import Tipos from './components/Tipos'
import Personas from './components/Personas'
import Prestamos from './components/Prestamos'
import Empresas from './components/Empresas'
import Usuarios from './components/Usuarios'
import { ToastProvider } from './ToastContext'
import RoleSelector from './components/RoleSelector'
import Login from './components/Login'

export default function App(){
  const [view, setView] = useState('tipos')
  const [appVersion, setAppVersion] = useState('loading...')
  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
  const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
  const API_TYPES = import.meta.env.VITE_API_TYPES || `${proto}//${host}/api/tipos`
  const API_PERSONS = import.meta.env.VITE_API_PERSONS || `${proto}//${host}/api/personas`
  const API_PRESTAMOS = import.meta.env.VITE_API_PRESTAMOS || `${proto}//${host}/api/prestamos`
  const [dark, setDark] = useState(() => localStorage.getItem('ollantay-dark') === '1')
  const [userRole, setUserRole] = useState('')
  const [loggedUser, setLoggedUser] = useState(null)
  const [profilePhoto, setProfilePhoto] = useState(() => {
    try {
      return localStorage.getItem('ollantay-profile-photo') || ''
    } catch {
      return ''
    }
  })
  const perms = loggedUser?.permissions || []
  const has = (resource, action) => perms.includes(`${resource}:${action}`)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Load version automatically
  useEffect(() => {
    fetch('/version.json')
      .then(res => res.json())
      .then(data => setAppVersion(data.version))
      .catch(() => setAppVersion('1.0.0'))
  }, [])
  
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
        if(data?.profilePhoto){
          setProfilePhoto(data.profilePhoto)
          try{ localStorage.setItem('ollantay-profile-photo', data.profilePhoto) }catch(e){}
        }
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
      const res = await fetch(`${API_TYPES}/types`, { headers: userRole ? { 'X-User-Role': userRole } : {}, credentials: 'include' })
      if(!res.ok) throw new Error(`Server ${res.status}`)
      const data = await res.json()
      setTypes(data)
    }catch(err){ setTypesError(err.message) }
    finally{ setTypesLoading(false) }
  }

  useEffect(()=>{ loadTypes() }, [API_TYPES, userRole])

  // Ensure current view is permitted by permissions; if not, route to first allowed
  useEffect(()=>{
    const viewsOrder = ['prestamos','personas','empresas','tipos']
    const allowed = viewsOrder.filter(v => (
      (v==='prestamos' && has('prestamos','view')) ||
      (v==='personas' && has('personas','view')) ||
      (v==='empresas' && has('empresas','view')) ||
      (v==='tipos' && has('tipos','view'))
    ))
    const adminAllowed = has('roles','manage')
    if((view==='admin' || view==='usuarios') && !adminAllowed){
      setView(allowed[0] || 'tipos')
      return
    }
    if(!allowed.includes(view)){
      setView(allowed[0] || (adminAllowed ? 'admin' : 'tipos'))
    }
  }, [perms])

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
      {/* Header con hamburguesa */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Menu"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              )}
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sistema Ollantay</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gestión de préstamos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateDark(!dark)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM15.657 4.343a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM15.657 15.657a1 1 0 01-1.414 0l-.707-.707a1 1 0 011.414-1.414l.707.707a1 1 0 010 1.414zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM4.343 15.657a1 1 0 010-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zM3 9a1 1 0 110 2H2a1 1 0 110-2h1zM4.343 4.343a1 1 0 011.414 0l.707.707A1 1 0 015.05 6.464L4.343 5.757a1 1 0 010-1.414z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 116.707 2.707a7 7 0 0010.586 10.586z"/></svg>
              )}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
              aria-label="Salir"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className={`fixed md:static z-40 left-0 top-16 h-[calc(100vh-4rem)] w-64 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r shadow-lg flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {has('tipos','view') && (
              <button onClick={()=>{setView('tipos'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='tipos' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8z" fill="currentColor" opacity=".2"/></svg>
                Tipos
              </button>
            )}
            {has('personas','view') && (
              <button onClick={()=>{setView('personas'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='personas' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 014-4h0a4 4 0 014 4v2"/></svg>
                Personas
              </button>
            )}
            {has('empresas','view') && (
              <button onClick={()=>{setView('empresas'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='empresas' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4"/></svg>
                Empresas
              </button>
            )}
            {has('prestamos','view') && (
              <button onClick={()=>{setView('prestamos'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='prestamos' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M12 8v8"/></svg>
                Prestamos
              </button>
            )}
            {has('roles','manage') && (
              <>
                <button onClick={()=>{setView('usuarios'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='usuarios' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-2a6.5 6.5 0 0113 0v2"/></svg>
                  Usuarios
                </button>
                <button onClick={()=>{setView('admin'); setSidebarOpen(false)}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view==='admin' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>
                  Roles & Permisos
                </button>
              </>
            )}
          </nav>
          
          {/* User info y acciones en el sidebar */}
          <div className={`mt-auto px-3 py-4 border-t ${dark ? 'border-gray-700' : 'border-gray-200'} space-y-3`}>
            <div className="flex items-center gap-3 px-2">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Foto de perfil" className="w-8 h-8 rounded-full object-cover border-2 border-blue-500" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {loggedUser?.nombres?.[0] || loggedUser?.username?.[0] || 'U'}
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Usuario activo</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{loggedUser?.username || userRole}</p>
              </div>
            </div>
            <label htmlFor="profile-photo-upload" className="block px-2 cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2">
              📷 Cambiar foto de perfil
            </label>
            <input id="profile-photo-upload" type="file" accept="image/*" className="hidden" onChange={async e => {
              const file = e.target.files?.[0]
              if(!file) return
              // Convert to data URL and upload to backend
              const toDataURL = (f) => new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = reject
                reader.readAsDataURL(f)
              })
              try{
                const dataUrl = await toDataURL(file)
                const res = await fetch(`${API_PERSONS}/users/me/photo`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ photo: dataUrl })
                })
                if(!res.ok){
                  const j = await res.json().catch(async ()=> ({raw: await res.text()}))
                  throw new Error(j?.detail || j?.raw || `Status ${res.status}`)
                }
                const j = await res.json()
                const p = j?.profilePhoto || dataUrl
                setProfilePhoto(p)
                try{ localStorage.setItem('ollantay-profile-photo', p) }catch(e){}
                // Optionally update loggedUser cache
                setLoggedUser(u => (u ? { ...u, profilePhoto: p } : u))
              }catch(err){
                console.error('Error al subir foto:', err)
                alert('No se pudo actualizar la foto de perfil: ' + (err?.message || 'Error desconocido'))
              }
            }} />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 w-full md:ml-0 p-6 max-w-7xl mx-auto">
          {view === 'tipos' && has('tipos','view') && <Tipos API={API_TYPES} types={types} loading={typesLoading} error={typesError} onEdit={handleEditTipo} onDelete={handleDeleteTipo} onRefresh={loadTypes} dark={dark} userRole={userRole} permissions={perms} />}
          {view === 'personas' && has('personas','view') && <Personas API={API_PERSONS} API_TYPES={API_TYPES} dark={dark} userRole={userRole} permissions={perms} />}
          {view === 'empresas' && has('empresas','view') && <Empresas API={API_PERSONS} userRole={userRole} permissions={perms} />}
          {view === 'prestamos' && has('prestamos','view') && <Prestamos API={API_PRESTAMOS} API_PERSONAS={API_PERSONS} API_TYPES={API_TYPES} dark={dark} userRole={userRole} loggedUser={loggedUser} permissions={perms} />}
          {view === 'usuarios' && has('roles','manage') && <Usuarios API={API_PERSONS} userRole={userRole} />}
          {view === 'admin' && has('roles','manage') && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                  Roles y Permisos
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Gestiona roles y permisos del sistema
                </p>
                <RoleSelector 
                  role={loggedUser?.role} 
                  onChange={setUserRole} 
                  API={API_PERSONS}
                  showAdmin={true}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer mejorado */}
      <footer className={`${dark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-600'} border-t py-6 mt-8`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium">
                © {new Date().getFullYear()} Sistema Ollantay
              </p>
              <p className="text-xs mt-1">
                Desarrollado con ❤️ para la gestión eficiente de préstamos
              </p>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/>
                </svg>
                <span>Versión: <span className="font-mono font-semibold">v{window.__OLLANTAY_VERSION__ || appVersion}</span></span>
              </div>
              <div className="hidden sm:block">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                  Sistema Activo
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
      <LogoutConfirm open={showLogoutConfirm} onCancel={handleLogoutConfirm} onConfirm={handleLogoutConfirm} />
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

