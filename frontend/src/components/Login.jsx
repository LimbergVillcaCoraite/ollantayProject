import React, {useState} from 'react'
import DarkToggle from './DarkToggle'
import { useToast } from '../ToastContext'

export default function Login({API_PERSONA = (import.meta?.env?.VITE_API_PERSONS || 'http://localhost:8002'), onLogin, dark, setDark}){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const toast = useToast()


  const submit = async (e)=>{
    e.preventDefault()
    setError(null)
    setLoading(true)
    try{
      const base = (API_PERSONA || '').replace(/\/+$/,'')
      const url = `${base}/auth/login`
      const res = await fetch(url, {method:'POST', credentials: 'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, password})})
      if(!res.ok){
        // try parse json, otherwise read text for debugging (404 might return HTML)
        const j = await res.json().catch(async ()=> ({raw: await res.text()}))
        const msg = j?.detail || j?.raw || res.statusText || `Status ${res.status}`
        
        // Mostrar mensajes específicos
        let popupMsg = `❌ Error de inicio de sesión: ${msg}`
        if(res.status === 401){
          popupMsg = '❌ Usuario o contraseña incorrectos'
        } else if(res.status === 403){
          // Si el backend indica usuario inactivo, mostrar ese texto
          if(typeof j?.detail === 'string' && j.detail.toLowerCase().includes('inactivo')){
            popupMsg = '🚫 Usuario inactivo. Contacte al administrador.'
          } else {
            popupMsg = '❌ Acceso denegado'
          }
        }
        try { 
          toast.push(popupMsg, 'error', 4000) 
        } catch (e) { 
          try { 
            (await import('../toast')).showToast(popupMsg, 'error', 4000) 
          } catch(_){} 
        }
        
        throw new Error(msg)
      }
      const data = await res.json()
      console.log('Login response:', data) // DEBUG
      console.log('Profile photo received:', data.profilePhoto) // DEBUG
      onLogin(data)
    }catch(err){
      // Normalize some common network/CORS messages for clarity and show popup
      const msg = (err?.message || '').toLowerCase().includes('failed to fetch') ? 'No se pudo conectar con el servidor (CORS/red). Verifique que el servicio de personas esté activo.' : err.message
      try { toast.push(`❌ ${msg}`, 'error', 4000) } catch(_) {}
      setError(null) // no inline error
    }
    finally{ setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col items-center justify-center mb-4 gap-2">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
          ARCH
        </div>
        <div className="top-toggle">
          <DarkToggle dark={dark} setDark={setDark} size='5'/>
        </div>
      </div>
      <div className="space-y-4">
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 mb-2">Versión: v{window.__OLLANTAY_VERSION__ || '2.0.0'}</div>
        <div>
          <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Usuario</label>
          <input id="login-username" aria-label="Usuario" required value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 block w-full p-3 border rounded shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
          <div className="relative">
            <input 
              id="login-password" 
              aria-label="Contraseña" 
              type={showPass ? 'text' : 'password'} 
              required 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              className="mt-1 block w-full p-3 pr-10 border rounded shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300" 
            />
            <button 
              type="button" 
              onClick={()=>setShowPass(s=>!s)} 
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-300"
            >
              {showPass ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4.03 3.97a.75.75 0 011.06 0l11 11a.75.75 0 11-1.06 1.06l-1.49-1.49A9.75 9.75 0 0110 16.5c-4.06 0-7.52-2.5-9.17-6.06a1.27 1.27 0 010-1.09A10.77 10.77 0 014.6 5.1L4.03 4.53a.75.75 0 010-1.06zM10 6.5c-.55 0-1.07.12-1.54.33l4.71 4.71c.21-.47.33-.99.33-1.54A3.5 3.5 0 0010 6.5z"/><path d="M13.41 12.62l-1.2-1.2a3.5 3.5 0 01-4.63-4.63L6.38 5.59A9.7 9.7 0 003.05 8.1C4.6 11.24 7.11 13 10 13c1.24 0 2.41-.29 3.41-.79z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4.5c4.06 0 7.52 2.5 9.17 6.06.2.43.2.92 0 1.35C17.52 15.47 14.06 18 10 18S2.48 15.47.83 11.91a1.27 1.27 0 010-1.09C2.48 7 5.94 4.5 10 4.5zm0 2A3.5 3.5 0 1010 13a3.5 3.5 0 000-7z"/></svg>
              )}
            </button>
          </div>
        </div>

  {/* Mensaje debajo del password deshabilitado: solo popup */}

        <div className="flex items-center justify-between gap-4">
          <button type="submit" disabled={loading} className="w-full btn btn-primary">{loading ? 'Iniciando...' : 'Iniciar sesión'}</button>
        </div>
      </div>
    </form>
  )
}
