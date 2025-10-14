import React, {useState, useEffect} from 'react'

export default function Personas({API, API_TYPES}){
  const [persons, setPersons] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadPersons = async ()=>{
    setLoading(true)
    setError(null)
    try{
      const res = await fetch(`${API}/persons`)
      if(!res.ok) throw new Error('Error fetching persons')
      const data = await res.json()
      setPersons(data)
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  const loadTypes = async ()=>{
    if(!API_TYPES) return setTypes([])
    setLoadingTypes(true)
    try{
      const res = await fetch(`${API_TYPES}/types`)
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
        res = await fetch(`${API}/persons/${editingId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      } else {
        res = await fetch(`${API}/persons`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      }
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
      setForm({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})
      setEditingId(null)
      loadPersons()
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
      const res = await fetch(`${API}/persons/${id}`, {method:'DELETE'})
      if(res.status !== 204){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
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
      <div className="mb-4 bg-white p-4 rounded shadow">
        <form onSubmit={submit} className="grid grid-cols-1 gap-2">
          <input className="p-2 border" placeholder="Nombres" value={form.nombres_persona} onChange={e=>setForm({...form, nombres_persona:e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <input className="p-2 border" placeholder="Apellido paterno" value={form.apellido_paternoPersona} onChange={e=>setForm({...form, apellido_paternoPersona:e.target.value})} />
            <input className="p-2 border" placeholder="Apellido materno" value={form.apellido_maternoPer} onChange={e=>setForm({...form, apellido_maternoPer:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="p-2 border" placeholder="Teléfono" value={form.telefono_persona} onChange={e=>setForm({...form, telefono_persona:e.target.value})} />
            <input className="p-2 border" placeholder="CI" value={form.ci_persona} onChange={e=>setForm({...form, ci_persona:e.target.value})} />
          </div>
          <input className="p-2 border" placeholder="Dirección" value={form.direccion_persona} onChange={e=>setForm({...form, direccion_persona:e.target.value})} />

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
          </div>

          <div>
            <button disabled={submitting} className="bg-blue-600 text-white px-3 py-1 rounded">{submitting? 'Procesando...' : (editingId? 'Actualizar' : 'Crear')}</button>
            {editingId && <button type="button" onClick={()=>{setEditingId(null); setForm({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:''})}} className="ml-2 px-3 py-1 border rounded">Cancelar</button>}
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </form>
      </div>

      <div className="bg-white rounded shadow">
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
            {!loading && persons.length === 0 && <tr><td className="p-4" colSpan={8}>No hay personas</td></tr>}
            {persons.map((p, idx) => (
              <tr key={p.id_persona ?? `person-${idx}`} className="border-t">
                <td className="px-4 py-2">{p.nombres_persona}</td>
                <td className="px-4 py-2">{p.apellido_paternoPersona}</td>
                <td className="px-4 py-2">{p.apellido_maternoPer}</td>
                <td className="px-4 py-2">{p.ci_persona}</td>
                <td className="px-4 py-2">{p.telefono_persona}</td>
                <td className="px-4 py-2">{p.direccion_persona}</td>
                <td className="px-4 py-2">{getTypeName(p.id_tipoPersona)}</td>
                <td className="px-4 py-2">
                  <button onClick={()=>edit(p)} className="mr-2 text-sm px-2 py-1 border rounded">Editar</button>
                  <button onClick={()=>remove(p.id_persona)} className="text-sm px-2 py-1 bg-red-500 text-white rounded">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
