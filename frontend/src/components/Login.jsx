import React, {useState} from 'react'
import { version } from '../../package.json'
import DarkToggle from './DarkToggle'

export default function Login({API_PERSONA = 'http://localhost:8002', onLogin, dark, setDark}){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const submit = async (e)=>{
    e.preventDefault()
    setError(null)
    setLoading(true)
    try{
      const url = `${API_PERSONA.replace(/\/+$/,'')}/auth/login`
      const res = await fetch(url, {method:'POST', credentials: 'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, password})})
      if(!res.ok){
        // try parse json, otherwise read text for debugging (404 might return HTML)
        const j = await res.json().catch(async ()=> ({raw: await res.text()}))
        const msg = j?.detail || j?.raw || res.statusText || `Status ${res.status}`
        throw new Error(msg)
      }
      const data = await res.json()
      onLogin(data)
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center justify-center mb-4">
        <div className="w-16 h-16 mx-auto bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">SO</div>
        <div className="top-toggle">
          <DarkToggle dark={dark} setDark={setDark} size='5'/>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Usuario</label>
          <input id="login-username" aria-label="Usuario" required value={username} onChange={e=>setUsername(e.target.value)} className="mt-1 block w-full p-3 border rounded shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
          <input id="login-password" aria-label="Contraseña" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 block w-full p-3 border rounded shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        {error && <div role="alert" className="text-red-600 bg-red-50 dark:bg-red-900/40 p-2 rounded">{error}</div>}

        <div className="flex items-center justify-between gap-4">
          <button type="submit" disabled={loading} className="w-full btn btn-primary">{loading ? 'Iniciando...' : 'Iniciar sesión'}</button>
        </div>

        <div className="flex items-center justify-between mt-2 text-sm">
          <button type="button" onClick={()=> setShowRegister(s => !s)} className="text-blue-600 hover:underline">{showRegister ? 'Cancelar' : 'Crear cuenta'}</button>
        </div>

        {showRegister && (
          <div className="mt-4 p-3 border rounded bg-gray-50 dark:bg-gray-900">
            <div className="mb-2 text-sm font-medium">Registro rápido</div>
            <input placeholder="Usuario" value={newUserName} onChange={e=>setNewUserName(e.target.value)} className="w-full p-2 mb-2 border rounded" />
            <input placeholder="Contraseña" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full p-2 mb-2 border rounded" />
            <div className="flex justify-end">
              <button onClick={async ()=>{
                // simple create user call; backend endpoint expected: /auth/register (not implemented server-side yet)
                try{
                  await fetch(`${API_PERSONA}/auth/register`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:newUserName,password:newPassword})})
                  setShowRegister(false)
                }catch(e){ console.error(e) }
              }} className="btn btn-secondary">Crear</button>
            </div>
          </div>
        )}

  <div className="text-xs text-gray-400 dark:text-gray-400 text-center">Versión: <span className="font-mono">v{version}</span></div>
      </div>
    </form>
  )
}
