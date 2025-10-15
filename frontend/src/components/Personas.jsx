import React, {useState, useEffect} from 'react'
import { useToast } from '../ToastContext'

export default function Personas({API, API_TYPES, userRole='admin'}){
  const toast = useToast()
  const [persons, setPersons] = useState([])
  const [filteredPersons, setFilteredPersons] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})
  const [editingId, setEditingId] = useState(null)
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
    if(!form.nombres_persona.trim() || !form.ci_persona.trim() || !form.direccion_persona.trim() || !form.id_tipoPersona){
      setError('Nombres, CI, dirección y tipo son requeridos')
      return
    }
    setSubmitting(true)
    try{
      let res
      const payload = {...form, id_tipoPersona: Number(form.id_tipoPersona)}
      if(editingId){
        res = await fetch(`${API}/persons/${editingId}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify(payload)})
      } else {
        res = await fetch(`${API}/persons`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify(payload)})
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
    <div>
      <h2 className="text-xl font-semibold mb-2">Personas</h2>
  <div className="mb-4 bg-panel p-4 rounded shadow text-panel">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <input placeholder="Buscar por nombre, apellidos, CI o teléfono" className="p-2 border w-full" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          <select className="p-2 border" value={filterTipo} onChange={e=>setFilterTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {types.map((t, idx) => (
              <option key={t.id_tipoPersona ?? `tipo-${idx}`} value={t.id_tipoPersona ?? ''}>{t.nombre_tipoPersona ?? t.nombre}</option>
            ))}
          </select>
          <div className="text-right">
            <button onClick={()=>{ setSearchQ(''); setFilterTipo('') }} className="btn btn-secondary">Limpiar</button>
          </div>
        </div>

  {userRole !== 'viewer' ? (
  <form onSubmit={submit} className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
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

          {/* Tipo select populated from types service */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Tipo</label>
            <select
              value={form.id_tipoPersona}
              onChange={e=>setForm({...form, id_tipoPersona: e.target.value})}
              className="p-2 border w-full"
              disabled={loadingTypes}
            >
              <option value="">{loadingTypes ? 'Cargando tipos...' : 'Seleccionar tipo'}</option>
              {types.map((t, idx) => (
                <option key={t.id_tipoPersona ?? `tipo-${idx}`} value={t.id_tipoPersona ?? ''}>{t.nombre_tipoPersona ?? (`Tipo ${t.id_tipoPersona ?? idx}`)}</option>
              ))}
            </select>
            <button disabled={submitting} className="btn btn-primary">{submitting? 'Procesando...' : (editingId? 'Actualizar' : 'Crear')}</button>
            {editingId && <button type="button" onClick={()=>{setEditingId(null); setForm({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})}} className="ml-2 btn btn-secondary">Cancelar</button>}
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </form>
        ) : (
          <div className="p-4 text-sm text-gray-600">Modo visor — sólo visualización. No puede crear ni editar personas.</div>
        )}
      </div>

  <div className="bg-panel rounded shadow text-panel">
        <table className="w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Nombres</th>
              <th className="px-4 py-2 text-left">Apellido Paterno</th>
              <th className="px-4 py-2 text-left">Apellido Materno</th>
              <th className="px-4 py-2 text-left">CI</th>
              <th className="px-4 py-2 text-left">Teléfono</th>
              <th className="px-4 py-2 text-left">Dirección</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4" colSpan={8}>Cargando...</td></tr>}
            {!loading && filteredPersons.length === 0 && <tr><td className="p-4" colSpan={8}>No hay personas</td></tr>}
            {filteredPersons.map((p, idx) => (
              <tr key={p.id_persona ?? `person-${idx}`} className="border-t">
                <td className="px-4 py-2">{p.nombres_persona}</td>
                <td className="px-4 py-2">{p.apellido_paternoPersona}</td>
                <td className="px-4 py-2">{p.apellido_maternoPer}</td>
                <td className="px-4 py-2">{p.ci_persona}</td>
                <td className="px-4 py-2">{p.telefono_persona}</td>
                <td className="px-4 py-2">{p.direccion_persona}</td>
                <td className="px-4 py-2">{getTypeName(p.id_tipoPersona)}</td>
                <td className="px-4 py-2">
                      {userRole !== 'viewer' && <button onClick={()=>edit(p)} className="mr-2 btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828L8.414 14.414 4 16l1.586-4.414L14.586 2.586a2 2 0 012.828 0z"/></svg>
                    Editar
                      </button>}
                      {userRole === 'admin' && <button onClick={()=>remove(p.id_persona)} className="btn btn-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-1 1v1H4a1 1 0 000 2h12a1 1 0 100-2h-4V3a1 1 0 00-1-1H9zM6 7a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm6 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd"/></svg>
                    Eliminar
                      </button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
