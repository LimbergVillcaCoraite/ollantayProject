import React, {useState, useEffect} from 'react'
import { useToast } from '../ToastContext'

export default function Personas({API, API_TYPES, userRole='admin', permissions=[]}){
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const toast = useToast()
  const [persons, setPersons] = useState([])
  const [filteredPersons, setFilteredPersons] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})
  const [editingId, setEditingId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  

  // debounce helper
  React.useEffect(()=>{
    const t = setTimeout(()=>{
      const q = (searchQ || '').trim().toLowerCase()
      const list = persons.filter(p => {
        const inTipo = filterTipo ? String(p.id_tipoPersona) === String(filterTipo) : true
        if(!inTipo) return false
        const nombres = (p.nombres_persona || '').toLowerCase()
        const paterno = (p.apellido_paternoPersona || '').toLowerCase()
        const materno = (p.apellido_maternoPer || '').toLowerCase()
        const ci = (p.ci_persona || '').toLowerCase()
        const tel = (p.telefono_persona || '').toLowerCase()

        if(!q) return true
        const hay = [nombres, paterno, materno, ci, tel].join(' ')
        return hay.includes(q)
      })
      setFilteredPersons(list)
    }, 180)
    return ()=>clearTimeout(t)
  }, [searchQ, filterTipo, persons])

  const loadPersons = async ()=>{
    setLoading(true)
    setError(null)
    try{
  const res = await fetch(`${API}/persons`, { headers: { 'X-User-Role': userRole } })
      if(!res.ok) throw new Error('Error fetching persons')
  const data = await res.json()
  setPersons(data)
  setFilteredPersons(data)
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  const loadTypes = async ()=>{
    if(!API_TYPES) return setTypes([])
    setLoadingTypes(true)
    try{
  const res = await fetch(`${API_TYPES}/types`, { headers: { 'X-User-Role': userRole } })
      if(!res.ok) throw new Error('Error fetching tipos')
      const data = await res.json()
      // normalize backend shape -> component shape
      // backend may return { id, tipo } while older shape used { id_tipoPersona, nombre_tipoPersona }
      const normalized = Array.isArray(data) ? data.map(t => ({
        id_tipoPersona: t.id ?? t.id_tipoPersona,
        nombre_tipoPersona: t.tipo ?? t.nombre_tipoPersona
      })) : []
  setTypes(normalized)
    }catch(err){ console.error(err); /* types are optional for listing */ }
    finally{ setLoadingTypes(false) }
  }

  useEffect(()=>{ loadTypes(); loadPersons() }, [API, API_TYPES])

  const submit = async (e)=>{
    e.preventDefault()
    setError(null)
    // basic validation
    if(!form.nombres_persona.trim() || !form.ci_persona.trim() || !form.direccion_persona.trim() || !form.id_tipoPersona || !form.apellido_paternoPersona.trim() || !form.apellido_maternoPer.trim() || !form.telefono_persona.trim()){
      setError('Todos los campos son obligatorios')
      return
    }
    setSubmitting(true)
    try{
      let res
      const payload = {...form, id_tipoPersona: Number(form.id_tipoPersona)}
      if(editingId){
        res = await fetch(`${API}/persons/${editingId}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(payload)})
      } else {
        res = await fetch(`${API}/persons`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(payload)})
      }
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
      setForm({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})
      setEditingId(null)
      loadPersons()
      toast.push(editingId ? 'Persona actualizada' : 'Persona creada','success')
    }catch(err){ setError(err.message) }
    finally{ setSubmitting(false) }
  }

  const edit = (p)=>{
    setEditingId(p.id_persona)
    setForm({nombres_persona:p.nombres_persona, apellido_paternoPersona:p.apellido_paternoPersona || '', apellido_maternoPer:p.apellido_maternoPer || '', telefono_persona:p.telefono_persona || '', id_tipoPersona:String(p.id_tipoPersona), ci_persona:p.ci_persona, direccion_persona:p.direccion_persona})
  }

  const remove = async (id)=>{
    if(!confirm('Eliminar persona?')) return
    setError(null)
    try{
      const res = await fetch(`${API}/persons/${id}`, {method:'DELETE', headers: { 'X-User-Role': userRole } })
      if(res.status !== 204){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
      toast.push('Persona eliminada','success')
      loadPersons()
    }catch(err){ setError(err.message) }
  }

  const getTypeName = (id)=>{
    if(!id && id !== 0) return ''
    const t = types.find(x => String(x.id_tipoPersona) === String(id))
    return t ? (t.nombre_tipoPersona ?? '') : String(id || '')
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input 
          placeholder="Buscar por nombre, apellidos, CI o teléfono" 
          className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
        <select 
          className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          value={filterTipo} onChange={e=>setFilterTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {types.map((t, idx) => (
            <option key={t.id_tipoPersona ?? `tipo-${idx}`} value={t.id_tipoPersona ?? ''}>{t.nombre_tipoPersona ?? t.nombre}</option>
          ))}
        </select>
        <button onClick={()=>{ setSearchQ(''); setFilterTipo('') }} className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">Limpiar</button>
        {has('personas','create') && (
          <button onClick={()=>setShowCreate(s=>!s)} className={`px-4 py-3 rounded-lg font-medium transition-colors ${showCreate ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}>
            {showCreate ? 'Cancelar' : '+ Nueva Persona'}
          </button>
        )}
      </div>

  {has('personas','create') && showCreate && (
        <div className="mb-6 p-4 sm:p-6 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Nueva Persona</h3>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Nombres</label>
            <input className="p-2 border w-full" placeholder="Nombres" value={form.nombres_persona} onChange={e=>setForm({...form, nombres_persona:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Tipo</label>
            <select value={form.id_tipoPersona} onChange={e=>setForm({...form, id_tipoPersona: e.target.value})} className="p-2 border w-full" disabled={loadingTypes}>
              <option value="">{loadingTypes ? 'Cargando tipos...' : 'Seleccionar tipo'}</option>
              {types.map((t, idx) => (
                <option key={t.id_tipoPersona ?? `tipo-${idx}`} value={t.id_tipoPersona ?? ''}>{t.nombre_tipoPersona ?? (`Tipo ${t.id_tipoPersona ?? idx}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Apellido paterno</label>
            <input className="p-2 border w-full" placeholder="Apellido paterno" value={form.apellido_paternoPersona} onChange={e=>setForm({...form, apellido_paternoPersona:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Apellido materno</label>
            <input className="p-2 border w-full" placeholder="Apellido materno" value={form.apellido_maternoPer} onChange={e=>setForm({...form, apellido_maternoPer:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Teléfono</label>
            <input className="p-2 border w-full" placeholder="Teléfono" value={form.telefono_persona} onChange={e=>setForm({...form, telefono_persona:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">CI</label>
            <input className="p-2 border w-full" placeholder="CI" value={form.ci_persona} onChange={e=>setForm({...form, ci_persona:e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Dirección</label>
            <input className="p-2 border w-full" placeholder="Dirección" value={form.direccion_persona} onChange={e=>setForm({...form, direccion_persona:e.target.value})} />
          </div>

            <div className="sm:col-span-2 flex justify-end">
              <button disabled={submitting} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">{submitting? 'Procesando...' : (editingId? 'Actualizar' : 'Crear')}</button>
            </div>
            {error && <p className="text-red-600 sm:col-span-2">{error}</p>}
          </form>
        </div>
      )}

  <div className="bg-panel rounded shadow text-panel">
        <table className="min-w-full table-auto text-sm rounded-lg overflow-hidden shadow">
  <thead className="bg-gray-50 dark:bg-gray-800">
    <tr>
      <th className="px-4 py-2">ID</th>
      <th className="px-4 py-2">Nombre</th>
      <th className="px-4 py-2">CI</th>
      <th className="px-4 py-2">Tipo</th>
      <th className="px-4 py-2">Acciones</th>
    </tr>
  </thead>
  <tbody>
    {filteredPersons.map(p => (
      <tr key={p.id_persona} className="border-b dark:border-gray-700">
        <td className="px-4 py-2">{p.id_persona}</td>
        <td className="px-4 py-2">{p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer}</td>
        <td className="px-4 py-2">{p.ci_persona}</td>
        <td className="px-4 py-2">{getTypeName(p.id_tipoPersona)}</td>
        <td className="px-4 py-2">
          {(has('personas','update') || has('personas','delete')) && (
            <div className="flex gap-2">
              {has('personas','update') && <button onClick={()=>edit(p)} className="btn btn-blue"><span className="mr-1">✎</span>Editar</button>}
              {has('personas','delete') && <button onClick={()=>remove(p.id_persona)} className="btn btn-danger"><span className="mr-1">🗑️</span>Borrar</button>}
            </div>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
      </div>
      {/* Botón inferior opcional omitido: panel superior cubre creación */}
    </div>
  )
}
