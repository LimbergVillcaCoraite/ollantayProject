import React, {useState, useEffect} from 'react'
import { useToast } from '../ToastContext'

export default function Prestamos({API, API_PERSONAS, API_TYPES, userRole='admin'}){
  const [loans, setLoans] = useState([])
  const [filteredLoans, setFilteredLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [persons, setPersons] = useState([])
  const [types, setTypes] = useState([])
  const [choferTypeId, setChoferTypeId] = useState(null)
  const [selectedFilterTipo, setSelectedFilterTipo] = useState('')
  const [loadingPersons, setLoadingPersons] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [form, setForm] = useState({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:''})
  const [multiplier, setMultiplier] = useState(1)
  const [bottlesEdited, setBottlesEdited] = useState(false)
  const [createdLoan, setCreatedLoan] = useState(null)
  const [editingLoanId, setEditingLoanId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const isEditing = Boolean(editingLoanId)
  const [loanSearchQ, setLoanSearchQ] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  React.useEffect(()=>{
    const t = setTimeout(()=>{
      const q = (loanSearchQ||'').trim().toLowerCase()
      const list = loans.filter(l => {
        // filter by estado
        if(filterEstado !== ''){
          if(String(l.estado_prestamo) !== String(filterEstado)) return false
        }
        // date range
        if(filterFrom){ const d = l.fecha_prestamo ? new Date(l.fecha_prestamo) : null; if(!d || d < new Date(filterFrom)) return false }
        if(filterTo){ const d = l.fecha_prestamo ? new Date(l.fecha_prestamo) : null; if(!d || d > new Date(filterTo)) return false }
        if(!q) return true
        // search in client/chofer names and description
        const clientName = getPersonName(l.id_persona).toLowerCase()
        const choferName = getPersonName(l.chofer).toLowerCase()
        const hay = ((l.descripcion_envase||'') + ' ' + clientName + ' ' + choferName).toLowerCase()
        return hay.includes(q)
      })
      setFilteredLoans(list)
    }, 180)
    return ()=>clearTimeout(t)
  }, [loanSearchQ, filterEstado, filterFrom, filterTo, loans])

  const loadLoans = async ()=>{
    setLoading(true)
    try{
  const res = await fetch(`${API}/loans`, { headers: { 'X-User-Role': userRole } })
      const data = await res.json()
      // normalize loan objects: ensure keys like id_persona and chofer exist even if backend returned odd keys
      const norm = (item) => {
        const out = {...item}
        const keys = Object.keys(item)
        const findKey = (candidates) => {
          for(const k of keys){
            const normk = k.replace(/\W/g,'').toLowerCase()
            if(candidates.includes(normk)) return k
          }
          return undefined
        }
        // possible forms that resolve to id_persona
        const kIdPersona = findKey(['idpersona','id_persona','idpersona'])
        if(kIdPersona && out[kIdPersona] !== undefined) out.id_persona = out[kIdPersona]
        // chofer key
        const kChofer = findKey(['chofer','idchofer'])
        if(kChofer && out[kChofer] !== undefined) out.chofer = out[kChofer]
        // id_prestamo
        const kIdPrest = findKey(['idprestamo','id_prestamo'])
        if(kIdPrest && out[kIdPrest] !== undefined) out.id_prestamo = out[kIdPrest]
        return out
      }
      setLoans(Array.isArray(data) ? data.map(norm) : [])
    }catch(err){ toast.push('Error cargando prestamos','error') }
    finally{ setLoading(false) }
  }

  const loadPersons = async ()=>{
    setLoadingPersons(true)
    try{
  const res = await fetch(`${API_PERSONAS}/persons`, { headers: { 'X-User-Role': userRole } })
      const data = await res.json()
      setPersons(data)
    }catch(err){ /* ignore */ }
    finally{ setLoadingPersons(false) }
  }

  const loadTypes = async ()=>{
    if(!API_TYPES) return
    try{
  const res = await fetch(`${API_TYPES}/types`, { headers: { 'X-User-Role': userRole } })
    if(!res.ok) throw new Error('Error fetching tipos')
      const data = await res.json()
      // normalize shape if needed
      const normalized = Array.isArray(data) ? data.map(t=>({ id: t.id ?? t.id_tipoPersona, nombre: t.tipo ?? t.nombre_tipoPersona })) : []
      setTypes(normalized)
      // find chofer type by name (case-insensitive 'chofer')
      const ch = normalized.find(x => (x.nombre || '').toLowerCase().includes('chofer'))
      if(ch) setChoferTypeId(ch.id)
    }catch(err){ console.error(err); toast.push('Error cargando tipos','error') }
    finally{ setLoadingTypes(false) }
  }

  const toast = useToast()

  useEffect(()=>{ loadLoans(); loadPersons(); loadTypes() }, [])

  // when selectedFilterTipo changes, fetch persons filtered by tipo from server
  useEffect(()=>{
    const loadByTipo = async ()=>{
      if(!selectedFilterTipo){
        // if no filter, we keep full list (already loaded)
        return
      }
      setLoadingPersons(true)
      try{
  const res = await fetch(`${API_PERSONAS}/persons?tipo=${selectedFilterTipo}`, { headers: { 'X-User-Role': userRole } })
        if(!res.ok) throw new Error('Error fetching persons by tipo')
        const data = await res.json()
        setPersons(data)
      }catch(err){ console.error(err) }
      finally{ setLoadingPersons(false) }
    }
    loadByTipo()
  }, [selectedFilterTipo])

  // helper: today's date in YYYY-MM-DD for max attribute
  const todayISO = new Date().toISOString().slice(0,10)

  const getPersonName = (id) => {
    if(!id && id !== 0) return '-'
    const p = persons.find(p => String(p.id_persona) === String(id))
    if(!p) return String(id)
    const names = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer].filter(Boolean).join(' ')
    return names || String(id)
  }

  const submit = async (e)=>{
    e.preventDefault()
    if(isEditing){
      // go to update path
      return await submitUpdate(e)
    }
    // create path
    // basic validation: chofer required
  if(!form.chofer){ toast.push('El campo chofer es requerido','error'); return }
    // fecha_prestamo cannot be greater than today
    if(form.fecha_prestamo){
      const today = new Date()
      const fp = new Date(form.fecha_prestamo)
      // zero time part for comparison
      fp.setHours(0,0,0,0)
      today.setHours(0,0,0,0)
  if(fp > today){ toast.push('La fecha de prestamo no puede ser mayor a la fecha actual','error'); return }
    }
    setSubmitting(true)
    try{
      const payload = {
        cantidad_envaseCaja: form.cantidad_envaseCaja ? Number(form.cantidad_envaseCaja) : null,
        cantidad_prestamoBotellas: form.cantidad_prestamoBotellas ? Number(form.cantidad_prestamoBotellas) : null,
        descripcion_envase: form.descripcion_envase || null,
        fecha_prestamo: form.fecha_prestamo || null,
        id_persona: form.id_persona ? Number(form.id_persona) : null,
        estado_prestamo: Number(form.estado_prestamo),
        fecha_devolucion: form.fecha_devolucion || null,
        chofer: Number(form.chofer)
      }
  const res = await fetch(`${API}/loans`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify(payload)})
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
  const out = await res.json()
  toast.push('Prestamo creado','success')
      // switch to editing mode for the newly created loan: lock fields except date/status
      setCreatedLoan(out)
      setEditingLoanId(out.id_prestamo)
      loadLoans()
    }catch(err){ toast.push(err.message || 'Error','error') }
    finally{ setSubmitting(false) }
  }

  const submitUpdate = async (e)=>{
    e.preventDefault()
  if(!editingLoanId){ toast.push('No hay préstamo seleccionado para actualizar','error'); return }
    setSubmitting(true)
    try{
      // Only send editable fields (estado_prestamo and fecha_devolucion)
      const payload = {
        estado_prestamo: Number(form.estado_prestamo),
        fecha_devolucion: form.fecha_devolucion || null
      }
  const res = await fetch(`${API}/loans/${editingLoanId}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify(payload)})
  if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
  toast.push('Prestamo actualizado','success')
      // refresh
      setCreatedLoan(null)
      setEditingLoanId(null)
      setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:''})
      setBottlesEdited(false)
      loadLoans()
    }catch(err){ toast.push(err.message || 'Error','error') }
    finally{ setSubmitting(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Prestamos</h2>
  <div className="bg-panel p-4 rounded shadow mb-4 text-panel">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <input className="p-2 border" placeholder="Buscar por cliente, chofer, descripción" value={loanSearchQ} onChange={e=>setLoanSearchQ(e.target.value)} />
          <select className="p-2 border" value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="0">Activo</option>
            <option value="1">Devuelto</option>
          </select>
          <input type="date" className="p-2 border" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
          <input type="date" className="p-2 border" value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
        </div>

  {userRole !== 'viewer' ? (
  <form onSubmit={isEditing ? submitUpdate : submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input disabled={isEditing || userRole === 'viewer'} className="p-2 border" placeholder="Cantidad cajas" value={form.cantidad_envaseCaja} inputMode="numeric" onChange={e=>{
            const val = e.target.value
            setForm(prev => ({...prev, cantidad_envaseCaja: val}))
            // auto-calc bottles if user hasn't manually edited bottles
            if(!bottlesEdited){
              const nCajas = Number(val) || 0
              setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * (Number(multiplier) || 0))}))
            }
          }} />
          <div>
            <input disabled={isEditing || userRole === 'viewer'} className="p-2 border w-full" placeholder="Cantidad botellas" value={form.cantidad_prestamoBotellas} inputMode="numeric" onChange={e=>{ setBottlesEdited(true); setForm({...form, cantidad_prestamoBotellas: e.target.value}) }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Botellas por caja</label>
            <input disabled={isEditing || userRole === 'viewer'} type="number" min="0" step="1" className="p-2 border w-24" value={multiplier} onChange={e=>{
              const m = Number(e.target.value) || 0
              setMultiplier(m)
              if(!bottlesEdited){
                const nCajas = Number(form.cantidad_envaseCaja) || 0
                setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * m)}))
              }
            }} />
            <button disabled={isEditing} type="button" className="ml-2 px-2 py-1 border rounded text-sm" onClick={()=>{ setMultiplier(1); if(!bottlesEdited){ const nCajas = Number(form.cantidad_envaseCaja)||0; setForm(prev=>({...prev, cantidad_prestamoBotellas: String(nCajas*1)})) } }}>Reset</button>
          </div>
          <input className="p-2 border col-span-1 md:col-span-2" placeholder="Descripción envase" value={form.descripcion_envase} onChange={e=>setForm({...form, descripcion_envase:e.target.value})} />
          <div>
            <label className="block text-sm text-gray-700 mb-1">Fecha de préstamo</label>
            <input disabled={isEditing || userRole === 'viewer'} type="date" max={todayISO} className="p-2 border w-full" value={form.fecha_prestamo} onChange={e=>setForm({...form, fecha_prestamo:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Filtrar clientes por Tipo</label>
            <div className="relative">
              <select className="p-2 border w-full" value={selectedFilterTipo} onChange={e=>setSelectedFilterTipo(e.target.value)} disabled={loadingTypes || isEditing || userRole === 'viewer'}>
                <option value="">{loadingTypes ? 'Cargando tipos...' : 'Seleccionar tipo'}</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {loadingTypes && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>

          {/* client select: only visible after selecting a tipo */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Cliente</label>
            <div className="relative">
              {/* Build the options: filtered by selectedFilterTipo, but always include the currently selected client so it shows when editing */}
              {loadingPersons && <div className="p-2">Cargando personas...</div>}
              <select disabled={isEditing || loadingPersons || userRole === 'viewer'} className="p-2 border w-full" value={form.id_persona} onChange={e=>setForm({...form, id_persona:e.target.value})}>
                <option value="">{loadingPersons ? 'Cargando personas...' : (selectedFilterTipo ? 'Seleccionar persona (cliente)' : 'Seleccione un tipo para cargar clientes')}</option>
                {
                  (()=>{
                    const list = selectedFilterTipo ? persons.filter(p => String(p.id_tipoPersona) === String(selectedFilterTipo)) : []
                    // ensure selected client is present
                    if(form.id_persona){
                      const present = list.find(p => String(p.id_persona) === String(form.id_persona)) || persons.find(p => String(p.id_persona) === String(form.id_persona))
                      if(present && !list.find(p => String(p.id_persona) === String(present.id_persona))){
                        list.unshift(present)
                      }
                    }
                    return list.map(p => (
                      <option key={p.id_persona} value={p.id_persona}>{p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}</option>
                    ))
                  })()
                }
              </select>
              {loadingPersons && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>

          {/* chofer select: only persons whose tipo equals choferTypeId */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Chofer</label>
              <div className="relative">
              <select className="p-2 border w-full" value={form.chofer} onChange={e=>setForm({...form, chofer:e.target.value})} disabled={loadingPersons || !choferTypeId || isEditing || userRole === 'viewer'}>
                <option value="">{loadingPersons ? 'Cargando choferes...' : (!choferTypeId ? 'No hay tipo chofer detectado' : 'Seleccionar chofer')}</option>
                {persons.filter(p => String(p.id_tipoPersona) === String(choferTypeId)).map(p => (
                  <option key={`chofer-${p.id_persona}`} value={p.id_persona}>{p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}</option>
                ))}
              </select>
              {loadingPersons && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>
          <select className="p-2 border" value={form.estado_prestamo} onChange={e=>setForm({...form, estado_prestamo:e.target.value})} disabled={userRole === 'viewer'}>
            <option value={0}>Activo</option>
            <option value={1}>Devuelto</option>
          </select>
          <input type="datetime-local" className="p-2 border" value={form.fecha_devolucion} onChange={e=>setForm({...form, fecha_devolucion:e.target.value})} />
            <div className="col-span-1 md:col-span-2">
            {userRole !== 'viewer' && <button disabled={submitting || (!isEditing && !form.chofer)} className="btn btn-primary disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V8.414A2 2 0 0016.586 7L12 2.414A2 2 0 0010.586 2H5z"/></svg>
              {submitting ? 'Procesando...' : (isEditing ? 'Actualizar Prestamo' : 'Crear Prestamo')}
            </button>}
            {isEditing && userRole !== 'viewer' && <button type="button" onClick={()=>{ setEditingLoanId(null); setCreatedLoan(null); setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:''}); setBottlesEdited(false) }} className="ml-2 btn btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293A1 1 0 006.293 7.707L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z" clipRule="evenodd"/></svg>
              Cancelar
            </button>}
          </div>
        </form>
        ) : (
          <div className="p-4 text-sm text-gray-600">Modo visor — sólo visualización. No puede crear ni editar préstamos.</div>
        )}
      </div>

  <div className="bg-panel rounded shadow overflow-x-auto text-panel">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Chofer</th>
              <th className="px-4 py-2 text-left">Cantidad cajas</th>
              <th className="px-4 py-2 text-left">Botellas</th>
              <th className="px-4 py-2 text-left">Descripción</th>
              <th className="px-4 py-2 text-left">Fecha préstamo</th>
              <th className="px-4 py-2 text-left">Fecha devolución</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4" colSpan={10}>Cargando...</td></tr>}
            {!loading && filteredLoans.length === 0 && <tr><td className="p-4" colSpan={10}>No hay prestamos</td></tr>}
            {filteredLoans.map(l => (
              <tr key={l.id_prestamo} className="border-t">
                <td className="px-4 py-2">{l.id_prestamo}</td>
                <td className="px-4 py-2">{getPersonName(l.id_persona)}</td>
                <td className="px-4 py-2">{getPersonName(l.chofer)}</td>
                <td className="px-4 py-2">{l.cantidad_envaseCaja}</td>
                <td className="px-4 py-2">{l.cantidad_prestamoBotellas}</td>
                <td className="px-4 py-2">{l.descripcion_envase}</td>
                <td className="px-4 py-2">{l.fecha_prestamo}</td>
                <td className="px-4 py-2">{l.fecha_devolucion ?? '-'}</td>
                <td className="px-4 py-2">{l.estado_prestamo ? 'Devuelto' : 'Activo'}</td>
                <td className="px-4 py-2">
                  {userRole !== 'viewer' && !isEditing && <button onClick={async ()=>{
                    // load loan into form for editing fecha_devolucion and estado
                    setCreatedLoan(l)
                    setEditingLoanId(l.id_prestamo)
                    setForm(prev => ({...prev, cantidad_envaseCaja: l.cantidad_envaseCaja, cantidad_prestamoBotellas: l.cantidad_prestamoBotellas, descripcion_envase: l.descripcion_envase || '', fecha_prestamo: l.fecha_prestamo || '', id_persona: l.id_persona || '', estado_prestamo: l.estado_prestamo || 0, fecha_devolucion: l.fecha_devolucion || '', chofer: l.chofer || ''}))
                    setBottlesEdited(true)
                    // ensure client select is visible by setting selectedFilterTipo from the client's record
                    const clientId = l.id_persona
                    if(clientId){
                      const p = persons.find(pp => String(pp.id_persona) === String(clientId))
                      if(p && p.id_tipoPersona){
                        setSelectedFilterTipo(String(p.id_tipoPersona))
                      } else {
                        // fetch single person as fallback
                        try{
                          const r = await fetch(`${API_PERSONAS}/persons/${clientId}`, { headers: { 'X-User-Role': userRole } })
                          if(r.ok){ const data = await r.json(); if(data?.id_tipoPersona) setSelectedFilterTipo(String(data.id_tipoPersona)) }
                        }catch(e){ /* ignore */ }
                      }
                    }
                  }} className="mr-2 btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828L8.414 14.414 4 16l1.586-4.414L14.586 2.586a2 2 0 012.828 0z"/></svg>
                    Editar
                  </button>}
                  {userRole !== 'viewer' && isEditing && editingLoanId === l.id_prestamo && (
                    <button onClick={()=>{ setEditingLoanId(null); setCreatedLoan(null); setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:''}); setBottlesEdited(false) }} className="btn btn-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293A1 1 0 006.293 7.707L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z" clipRule="evenodd"/></svg>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
