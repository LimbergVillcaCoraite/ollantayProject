import React, {useState, useEffect} from 'react'
import Modal from './Modal'
import { useToast } from '../ToastContext'

export default function Personas({API, API_TYPES, userRole='admin', permissions=[], companyFilter=null, onClearCompanyFilter}){
  console.log('DEBUG: Personas component - userRole received:', userRole)
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const toast = useToast()
  const [persons, setPersons] = useState([])
  const [filteredPersons, setFilteredPersons] = useState([])
  const [types, setTypes] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:'', id_empresa:'', tipo_cliente:'minorista', idRuta:''})
  const [foto, setFoto] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingLoading, setEditingLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  
  // Normaliza la URL de foto almacenada en BD a una URL accesible vía proxy
  const resolvePhotoUrl = (fp) => {
    if (!fp) return ''
    try{
      // Si ya es absoluta (http/https), retornarla
      if (/^https?:\/\//i.test(fp)) return fp
      // Si comienza con /uploads, prefijar /api/personas
      if (fp.startsWith('/uploads')) return `/api/personas${fp}`
      // Si es un nombre simple, asumir /uploads/<nombre>
      if (!fp.startsWith('/')) return `/api/personas/uploads/${fp}`
      return fp
    }catch{ return '' }
  }
  

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
      const url = new URL(`${API}/persons`)
      if(companyFilter?.id) url.searchParams.set('company_id', companyFilter.id)
  const res = await fetch(url.toString(), { headers: { 'X-User-Role': userRole }, credentials: 'include' })
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

  const loadEmpresas = async () => {
    if (userRole !== 'superadmin') {
      return setEmpresas([])
    }
    try {
      const res = await fetch(`${API}/empresas`, { headers: { 'X-User-Role': userRole }, credentials:'include' })
      if (!res.ok) throw new Error('Error fetching empresas')
      const data = await res.json()
      // Backend returns a paginated shape { items: [...], total, offset, limit }
      const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : []
      setEmpresas(items)
    } catch (err) {
      console.error('Error loading empresas:', err)
      setEmpresas([])
    }
  }

  const loadRutas = async () => {
    try {
      const res = await fetch(`/api/rutas/rutas`, { credentials: 'include' })
      if (!res.ok) throw new Error('Error fetching rutas')
      const data = await res.json()
      setRutas(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading rutas:', err)
      setRutas([])
    }
  }

  useEffect(()=>{ loadTypes(); loadEmpresas(); loadRutas(); loadPersons() }, [API, API_TYPES, companyFilter, userRole])

  const submit = async (e)=>{
    e.preventDefault()
    setError(null)
    // basic validation
    if(!form.nombres_persona.trim() || !form.ci_persona.trim() || !form.direccion_persona.trim() || !form.id_tipoPersona || !form.apellido_paternoPersona.trim() || !form.apellido_maternoPer.trim() || !form.telefono_persona.trim()){
      setError('Todos los campos son obligatorios')
      return
    }
    
    // For superadmin, empresa is required
    if (userRole === 'superadmin' && !form.id_empresa) {
      setError('Debe seleccionar una empresa')
      return
    }
  setSubmitting(true)
  setError(null)
    try{
      let res
      
      // Prepare clean payload
      const cleanPayload = {
        ...form,
        id_tipoPersona: Number(form.id_tipoPersona),
        idRuta: (form.idRuta && form.idRuta !== '') ? Number(form.idRuta) : null,
        id_empresa: (form.id_empresa && form.id_empresa !== '') ? Number(form.id_empresa) : null
      }
      
      // Debug: log what we're sending
      console.log('DEBUG submit cleanPayload:', cleanPayload)
      
      if(foto) {
        // Use multipart/form-data when there's a photo
        const formData = new FormData()
        
        // Append only non-null values
        formData.append('nombres_persona', cleanPayload.nombres_persona)
        formData.append('apellido_paternoPersona', cleanPayload.apellido_paternoPersona)
        formData.append('apellido_maternoPer', cleanPayload.apellido_maternoPer)
        formData.append('telefono_persona', cleanPayload.telefono_persona)
        formData.append('id_tipoPersona', cleanPayload.id_tipoPersona)
        formData.append('ci_persona', cleanPayload.ci_persona)
        formData.append('direccion_persona', cleanPayload.direccion_persona)
        formData.append('tipo_cliente', cleanPayload.tipo_cliente)
        
        // Only append optional fields if they have a value
        if (cleanPayload.idRuta !== null) {
          formData.append('idRuta', cleanPayload.idRuta)
        }
        if (cleanPayload.id_empresa !== null) {
          formData.append('id_empresa', cleanPayload.id_empresa)
        }
        
        formData.append('foto', foto)
        
        // Debug: log FormData contents
        console.log('DEBUG FormData contents:')
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}: ${value} (${typeof value})`)
        }
        
        if(editingId){
          res = await fetch(`${API}/persons/${editingId}`, {method:'PUT', headers:{'X-User-Role': userRole}, credentials: 'include', body: formData})
        } else {
          res = await fetch(`${API}/persons`, {method:'POST', headers:{'X-User-Role': userRole}, credentials: 'include', body: formData})
        }
      } else {
        // Use JSON when no photo
        if(editingId){
          res = await fetch(`${API}/persons-json/${editingId}`, {method:'PUT', headers:{'Content-Type': 'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(cleanPayload)})
        } else {
          res = await fetch(`${API}/persons-json`, {method:'POST', headers:{'Content-Type': 'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(cleanPayload)})
        }
      }
      if(!res.ok){
        let j = null
        try { j = await res.json() } catch {}
        throw new Error(j?.detail || res.statusText || 'Error de red')
      }
      setForm({nombres_persona:'', apellido_paternoPersona:'', apellido_maternoPer:'', telefono_persona:'', id_tipoPersona:'', ci_persona:'', direccion_persona:'', id_empresa:'', tipo_cliente:'minorista', idRuta:''})
      setFoto(null)
      setEditingId(null)
      loadPersons()
      toast.push(editingId ? 'Persona actualizada' : 'Persona creada','success')
    }catch(err){
      if(err.message === 'Failed to fetch') setError('No se pudo conectar con el servidor. Verifique la red o el backend.')
      else setError(err.message)
    }
    finally{ setSubmitting(false) }
  }

  const edit = (p)=>{
    setEditingLoading(true)
    setTimeout(()=>{
      setEditingId(p.id_persona)
      setForm({
        nombres_persona:p.nombres_persona, 
        apellido_paternoPersona:p.apellido_paternoPersona || '', 
        apellido_maternoPer:p.apellido_maternoPer || '', 
        telefono_persona:p.telefono_persona || '', 
        id_tipoPersona:String(p.id_tipoPersona), 
        ci_persona:p.ci_persona, 
        direccion_persona:p.direccion_persona, 
        id_empresa: String(p.id_empresa || ''),
        tipo_cliente: p.tipo_cliente || 'minorista',
        idRuta: p.idRuta || ''
      })
      setFoto(null)
      setShowCreate(true)
      setEditingLoading(false)
    }, 350)
  }

  const remove = async (id)=>{
    if(!confirm('Eliminar persona?')) return
    setError(null)
    try{
  const res = await fetch(`${API}/persons/${id}`, {method:'DELETE', headers: { 'X-User-Role': userRole }, credentials: 'include' })
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
      {companyFilter && (
        <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 rounded flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
              Filtrando personas de: <span className="font-bold">{companyFilter.name}</span>
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Mostrando solo personas asociadas a esta empresa
            </p>
          </div>
          {onClearCompanyFilter && (
            <button 
              onClick={onClearCompanyFilter}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors"
            >
              ✕ Limpiar filtro
            </button>
          )}
        </div>
      )}
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
        <Modal title={editingId ? 'Editar Persona' : 'Nueva Persona'} onClose={()=>setShowCreate(false)} size="xl">
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" encType="multipart/form-data">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombres</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="Nombres" value={form.nombres_persona} onChange={e=>setForm({...form, nombres_persona:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
              <select value={form.id_tipoPersona} onChange={e=>setForm({...form, id_tipoPersona: e.target.value})} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" disabled={loadingTypes}>
                <option value="">{loadingTypes ? 'Cargando tipos...' : 'Seleccionar tipo'}</option>
                {types.map((t, idx) => (
                  <option key={t.id_tipoPersona ?? `tipo-${idx}`} value={t.id_tipoPersona ?? ''}>{t.nombre_tipoPersona ?? (`Tipo ${t.id_tipoPersona ?? idx}`)}</option>
                ))}
              </select>
            </div>
            {(() => {
              console.log('DEBUG: Checking selector visibility - userRole:', userRole, 'empresas:', empresas)
              return userRole === 'superadmin'
            })() && (
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Empresa ({empresas.length} disponibles)</label>
                <select value={form.id_empresa} onChange={e=>setForm({...form, id_empresa: e.target.value})} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full">
                  <option value="">Seleccionar empresa</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id_empresa} value={empresa.id_empresa}>
                      {empresa.nombre_empresa}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Apellido paterno</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="Apellido paterno" value={form.apellido_paternoPersona} onChange={e=>setForm({...form, apellido_paternoPersona:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Apellido materno</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="Apellido materno" value={form.apellido_maternoPer} onChange={e=>setForm({...form, apellido_maternoPer:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="Teléfono" value={form.telefono_persona} onChange={e=>setForm({...form, telefono_persona:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">CI</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="CI" value={form.ci_persona} onChange={e=>setForm({...form, ci_persona:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
              <input className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" placeholder="Dirección" value={form.direccion_persona} onChange={e=>setForm({...form, direccion_persona:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Cliente</label>
              <select value={form.tipo_cliente} onChange={e=>setForm({...form, tipo_cliente: e.target.value})} className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full">
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
                <option value="especial">Especial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ruta (Opcional)</label>
              <select 
                value={form.idRuta || ''} 
                onChange={e => setForm({...form, idRuta: e.target.value ? e.target.value : ''})} 
                className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full"
              >
                <option value="">Sin ruta asignada</option>
                {rutas.map((ruta) => (
                  <option key={ruta.idRuta} value={ruta.idRuta}>
                    {ruta.nombreRuta}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Foto de perfil</label>
              <input type="file" accept="image/*" className="p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-full" onChange={e=>setFoto(e.target.files[0])} />
              {/* Mostrar foto actual si está editando y existe fotoPersona */}
              {editingId && persons.length > 0 && (()=>{
                const persona = persons.find(p=>p.id_persona===editingId)
                if(persona && persona.fotoPersona){
                  return <img src={resolvePhotoUrl(persona.fotoPersona)} alt="Foto actual" className="mt-2 w-16 h-16 rounded-full object-cover border" />
                }
                return null
              })()}
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={()=>{ setShowCreate(false); setEditingId(null); }} className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">Cancelar</button>
              <button disabled={submitting} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">{submitting? 'Procesando...' : (editingId? 'Actualizar' : 'Crear')}</button>
            </div>
            {error && <p className="text-red-600 sm:col-span-2">{error}</p>}
          </form>
        </Modal>
      )}

      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden md:block bg-panel rounded shadow text-panel overflow-x-auto">
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
                <td className="px-4 py-2 flex items-center gap-2">
                  {p.fotoPersona ? (
                    <img 
                      src={resolvePhotoUrl(p.fotoPersona)} 
                      alt="Foto" 
                      className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
                      onError={(e)=>{
                        console.warn('Fallo imagen, usando placeholder:', p.fotoPersona)
                        e.currentTarget.onerror = null
                        e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="%23e5e7eb"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>`)
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border flex items-center justify-center text-gray-500">?
                    </div>
                  )}
                  {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer}
                </td>
                <td className="px-4 py-2">{p.ci_persona}</td>
                <td className="px-4 py-2">{getTypeName(p.id_tipoPersona)}</td>
                <td className="px-4 py-2">
                  {(has('personas','update') || has('personas','delete')) && (
                    <div className="flex gap-2">
                      {has('personas','update') && <button onClick={()=>edit(p)} className={`btn btn-blue ${editingLoading && editingId === p.id_persona ? 'opacity-50 pointer-events-none animate-pulse' : ''}`}><span className="mr-1">✎</span>{editingLoading && editingId === p.id_persona ? 'Cargando...' : 'Editar'}</button>}
                      {has('personas','delete') && <button onClick={()=>remove(p.id_persona)} className="btn btn-danger"><span className="mr-1">🗑️</span>Borrar</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible only on mobile */}
      <div className="md:hidden space-y-4">
        {filteredPersons.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay personas</div>
        ) : filteredPersons.map(p => (
          <div key={p.id_persona} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-3">
              {p.fotoPersona ? (
                <img 
                  src={resolvePhotoUrl(p.fotoPersona)} 
                  alt="Foto" 
                  className="w-16 h-16 rounded-full object-cover border-2 flex-shrink-0"
                  onError={(e)=>{
                    e.currentTarget.onerror = null
                    e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="%23e5e7eb"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>`)
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 border-2 flex items-center justify-center text-2xl text-gray-500">?</div>
              )}
              <div className="flex-1">
                <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                  {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">ID: {p.id_persona}</div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm mb-3">
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">CI:</span>
                <span className="text-gray-900 dark:text-gray-100">{p.ci_persona || 'N/A'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">Tipo:</span>
                <span className="text-gray-900 dark:text-gray-100">{getTypeName(p.id_tipoPersona)}</span>
              </div>
              {p.telefono_persona && (
                <div className="flex items-start">
                  <span className="font-semibold text-gray-600 dark:text-gray-400 w-20 flex-shrink-0">Teléfono:</span>
                  <span className="text-gray-900 dark:text-gray-100">{p.telefono_persona}</span>
                </div>
              )}
            </div>

            {(has('personas','update') || has('personas','delete')) && (
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                {has('personas','update') && (
                  <button 
                    onClick={()=>edit(p)} 
                    className={`flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 ${editingLoading && editingId === p.id_persona ? 'opacity-50 pointer-events-none animate-pulse' : ''}`}
                  >
                    ✎ {editingLoading && editingId === p.id_persona ? 'Cargando...' : 'Editar'}
                  </button>
                )}
                {has('personas','delete') && (
                  <button onClick={()=>remove(p.id_persona)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">
                    🗑️ Borrar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Botón inferior opcional omitido: panel superior cubre creación */}
    </div>
  )
}
