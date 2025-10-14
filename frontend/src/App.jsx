import React, {useState, useEffect} from 'react'
import Tipos from './components/Tipos'
import Personas from './components/Personas'
import Prestamos from './components/Prestamos'

export default function App(){
  const [view, setView] = useState('tipos')
  const API_TYPES = import.meta.env.VITE_API_TYPES || 'http://localhost:8001'
  const API_PERSONS = import.meta.env.VITE_API_PERSONS || 'http://localhost:8002'
  const API_PRESTAMOS = import.meta.env.VITE_API_PRESTAMOS || 'http://localhost:8003'

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Sistema Ollantay</h1>
          <nav>
            <button onClick={()=>setView('tipos')} className={`mr-2 px-3 py-1 rounded ${view==='tipos' ? 'bg-blue-600 text-white' : 'border'}`}>Tipos</button>
            <button onClick={()=>setView('personas')} className={`${view==='personas' ? 'bg-blue-600 text-white' : 'border'} px-3 py-1 rounded`}>Personas</button>
            <button onClick={()=>setView('prestamos')} className={`${view==='prestamos' ? 'bg-blue-600 text-white' : 'border'} ml-2 px-3 py-1 rounded`}>Prestamos</button>
          </nav>
        </header>

        <main>
          {view === 'tipos' && <Tipos types={types} loading={typesLoading} error={typesError} onEdit={handleEditTipo} onDelete={handleDeleteTipo} />}
          {view === 'personas' && <Personas API={API_PERSONS} API_TYPES={API_TYPES} />}
          {view === 'prestamos' && <Prestamos API={API_PRESTAMOS} API_PERSONAS={API_PERSONS} API_TYPES={API_TYPES} />}
        </main>
      </div>
    </div>
  )
}
