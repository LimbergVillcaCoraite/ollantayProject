import React, {useState, useEffect} from 'react'
import Tipos from './components/Tipos'
import Personas from './components/Personas'
import Prestamos from './components/Prestamos'
import { ToastProvider } from './ToastContext'

export default function App(){
  const [view, setView] = useState('tipos')
  const API_TYPES = import.meta.env.VITE_API_TYPES || 'http://localhost:8001'
  const API_PERSONS = import.meta.env.VITE_API_PERSONS || 'http://localhost:8002'
  const API_PRESTAMOS = import.meta.env.VITE_API_PRESTAMOS || 'http://localhost:8003'
  const [dark, setDark] = useState(() => localStorage.getItem('ollantay-dark') === '1')

  useEffect(()=>{
    localStorage.setItem('ollantay-dark', dark ? '1' : '0')
  }, [dark])

  useEffect(()=>{
    if(dark) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [dark])

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
      const res = await fetch(`${API_TYPES}/types/${id}`, {method:'DELETE'})
      if(res.status !== 204) throw new Error('Failed to delete')
      loadTypes()
    }catch(err){ alert('Error: '+err.message) }
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
            <div>
              <button
                onClick={()=>setDark(d => !d)}
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
            <div className="ml-auto text-sm text-gray-500">Usuario: Admin</div>
          </nav>
        </header>

        <main>
          {view === 'tipos' && <Tipos API={API_TYPES} types={types} loading={typesLoading} error={typesError} onEdit={handleEditTipo} onDelete={handleDeleteTipo} onRefresh={loadTypes} dark={dark} />}
          {view === 'personas' && <Personas API={API_PERSONS} API_TYPES={API_TYPES} dark={dark} />}
          {view === 'prestamos' && <Prestamos API={API_PRESTAMOS} API_PERSONAS={API_PERSONS} API_TYPES={API_TYPES} dark={dark} />}
        </main>

        <footer className="mt-8 py-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Sistema Ollantay — desarrollado con ❤️
        </footer>
      </div>
    </div>
    </ToastProvider>
  )
}
