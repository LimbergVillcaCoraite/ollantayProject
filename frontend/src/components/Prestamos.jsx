import React, {useState, useEffect} from 'react'
import { showToast } from '../toast'

export default function Prestamos({API, API_PERSONAS, API_TYPES}){
  const [loans, setLoans] = useState([])
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

  const loadLoans = async ()=>{
    setLoading(true)
    try{
      const res = await fetch(`${API}/loans`)
      const data = await res.json()
      setLoans(data)
    }catch(err){ showToast('Error cargando prestamos','error') }
    finally{ setLoading(false) }
  }

  const loadPersons = async ()=>{
    setLoadingPersons(true)
    try{
      const res = await fetch(`${API_PERSONAS}/persons`)
      const data = await res.json()
      setPersons(data)
    }catch(err){ /* ignore */ }
    finally{ setLoadingPersons(false) }
  }

  const loadTypes = async ()=>{
    if(!API_TYPES) return
    try{
      const res = await fetch(`${API_TYPES}/types`)
    if(!res.ok) throw new Error('Error fetching tipos')
      const data = await res.json()
      // normalize shape if needed
      const normalized = Array.isArray(data) ? data.map(t=>({ id: t.id ?? t.id_tipoPersona, nombre: t.tipo ?? t.nombre_tipoPersona })) : []
      setTypes(normalized)
      // find chofer type by name (case-insensitive 'chofer')
      const ch = normalized.find(x => (x.nombre || '').toLowerCase().includes('chofer'))
      if(ch) setChoferTypeId(ch.id)
    }catch(err){ console.error(err); showToast('Error cargando tipos','error') }
    finally{ setLoadingTypes(false) }
  }

  useEffect(()=>{ loadLoans(); loadPersons(); loadTypes() }, [])

  const submit = async (e)=>{
    e.preventDefault()
    // basic validation: chofer required
    if(!form.chofer){ showToast('El campo chofer es requerido','error'); return }
    // fecha_prestamo cannot be greater than today
    if(form.fecha_prestamo){
      const today = new Date()
      const fp = new Date(form.fecha_prestamo)
      // zero time part for comparison
      fp.setHours(0,0,0,0)
      today.setHours(0,0,0,0)
      if(fp > today){ showToast('La fecha de prestamo no puede ser mayor a la fecha actual','error'); return }
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
      const res = await fetch(`${API}/loans`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
      const out = await res.json()
      showToast('Prestamo creado','success')
      // store created loan and lock most fields; only fecha_devolucion and estado editable
      setCreatedLoan(out)
      setEditingLoanId(out.id_prestamo)
      // disable most inputs by keeping form values but using flags in rendering
      setForm(prev => ({...prev, /* keep values as-is */}))
      loadLoans()
    }catch(err){ showToast(err.message || 'Error','error') }
    finally{ setSubmitting(false) }
  }

  const submitUpdate = async (e)=>{
    e.preventDefault()
    if(!editingLoanId){ showToast('No hay préstamo seleccionado para actualizar','error'); return }
    setSubmitting(true)
    try{
      // build full payload: start from createdLoan (or fetch current loan) and merge editable fields
      let base = createdLoan
      if(!base){
        const r = await fetch(`${API}/loans/${editingLoanId}`)
        if(!r.ok) throw new Error('No se pudo recuperar el prestamo')
        base = await r.json()
      }
      const payload = {
        cantidad_envaseCaja: base.cantidad_envaseCaja,
        cantidad_prestamoBotellas: Number(form.cantidad_prestamoBotellas) || base.cantidad_prestamoBotellas,
        descripcion_envase: base.descripcion_envase,
        fecha_prestamo: base.fecha_prestamo,
        id_persona: base.id_persona,
        estado_prestamo: Number(form.estado_prestamo),
        fecha_devolucion: form.fecha_devolucion || base.fecha_devolucion,
        chofer: base.chofer
      }
      const res = await fetch(`${API}/loans/${editingLoanId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || res.statusText) }
      showToast('Prestamo actualizado','success')
      // refresh
      setCreatedLoan(null)
      setEditingLoanId(null)
      setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:''})
      setBottlesEdited(false)
      loadLoans()
    }catch(err){ showToast(err.message || 'Error','error') }
    finally{ setSubmitting(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Prestamos</h2>
      <div className="bg-white p-4 rounded shadow mb-4">
        <form onSubmit={createdLoan ? submitUpdate : submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input disabled={!!createdLoan} className="p-2 border" placeholder="Cantidad cajas" value={form.cantidad_envaseCaja} inputMode="numeric" onChange={e=>{
            const val = e.target.value
            setForm(prev => ({...prev, cantidad_envaseCaja: val}))
            // auto-calc bottles if user hasn't manually edited bottles
            if(!bottlesEdited){
              const nCajas = Number(val) || 0
              setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * (Number(multiplier) || 0))}))
            }
          }} />
          <div>
            <input disabled={!!createdLoan} className="p-2 border w-full" placeholder="Cantidad botellas" value={form.cantidad_prestamoBotellas} inputMode="numeric" onChange={e=>{ setBottlesEdited(true); setForm({...form, cantidad_prestamoBotellas: e.target.value}) }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Botellas por caja</label>
            <input type="number" min="0" step="1" className="p-2 border w-24" value={multiplier} onChange={e=>{
              const m = Number(e.target.value) || 0
              setMultiplier(m)
              if(!bottlesEdited){
                const nCajas = Number(form.cantidad_envaseCaja) || 0
                setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * m)}))
              }
            }} />
            <button type="button" className="ml-2 px-2 py-1 border rounded text-sm" onClick={()=>{ setMultiplier(1); if(!bottlesEdited){ const nCajas = Number(form.cantidad_envaseCaja)||0; setForm(prev=>({...prev, cantidad_prestamoBotellas: String(nCajas*1)})) } }}>Reset</button>
          </div>
          <input className="p-2 border col-span-1 md:col-span-2" placeholder="Descripción envase" value={form.descripcion_envase} onChange={e=>setForm({...form, descripcion_envase:e.target.value})} />
          <input disabled={!!createdLoan} type="date" className="p-2 border" value={form.fecha_prestamo} onChange={e=>setForm({...form, fecha_prestamo:e.target.value})} />
          <div>
            <label className="block text-sm text-gray-700 mb-1">Filtrar clientes por Tipo</label>
            <div className="relative">
              <select className="p-2 border w-full" value={selectedFilterTipo} onChange={e=>setSelectedFilterTipo(e.target.value)} disabled={loadingTypes}>
                <option value="">{loadingTypes ? 'Cargando tipos...' : 'Seleccionar tipo'}</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              {loadingTypes && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>

          {/* client select: only visible after selecting a tipo */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Cliente</label>
            {selectedFilterTipo ? (
              <div className="relative">
                <select disabled={!!createdLoan || loadingPersons} className="p-2 border w-full" value={form.id_persona} onChange={e=>setForm({...form, id_persona:e.target.value})}>
                  <option value="">{loadingPersons ? 'Cargando personas...' : 'Seleccionar persona (cliente)'}</option>
                  {persons.filter(p => String(p.id_tipoPersona) === String(selectedFilterTipo)).map(p => (
                    <option key={p.id_persona} value={p.id_persona}>{p.nombres_persona} {p.apellido_paternoPersona}</option>
                  ))}
                </select>
                {loadingPersons && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500">Seleccione un tipo para cargar clientes</div>
            )}
          </div>

          {/* chofer select: only persons whose tipo equals choferTypeId */}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Chofer</label>
            <div className="relative">
              <select className="p-2 border w-full" value={form.chofer} onChange={e=>setForm({...form, chofer:e.target.value})} disabled={loadingPersons || !choferTypeId}>
                <option value="">{loadingPersons ? 'Cargando choferes...' : (!choferTypeId ? 'No hay tipo chofer detectado' : 'Seleccionar chofer')}</option>
                {persons.filter(p => String(p.id_tipoPersona) === String(choferTypeId)).map(p => (
                  <option key={`chofer-${p.id_persona}`} value={p.id_persona}>{p.nombres_persona} {p.apellido_paternoPersona}</option>
                ))}
              </select>
              {loadingPersons && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>
          <select className="p-2 border" value={form.estado_prestamo} onChange={e=>setForm({...form, estado_prestamo:e.target.value})}>
            <option value={0}>Activo</option>
            <option value={1}>Devuelto</option>
          </select>
          <input type="datetime-local" className="p-2 border" value={form.fecha_devolucion} onChange={e=>setForm({...form, fecha_devolucion:e.target.value})} />
            <div className="col-span-1 md:col-span-2">
            <button disabled={submitting || !form.chofer} className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50">{submitting ? 'Procesando...' : (createdLoan ? 'Actualizar Prestamo' : 'Crear Prestamo')}</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full divide-y text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Chofer</th>
              <th className="px-4 py-2 text-left">Cantidad cajas</th>
              <th className="px-4 py-2 text-left">Botellas</th>
              <th className="px-4 py-2 text-left">Fecha prestamo</th>
              <th className="px-4 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4" colSpan={6}>Cargando...</td></tr>}
            {!loading && loans.length === 0 && <tr><td className="p-4" colSpan={6}>No hay prestamos</td></tr>}
            {loans.map(l => (
              <tr key={l.id_prestamo} className="border-t">
                <td className="px-4 py-2">{(persons.find(p => p.id_persona === l.id_persona)?.nombres_persona) || l.id_persona}</td>
                <td className="px-4 py-2">{(persons.find(p => p.id_persona === l.chofer)?.nombres_persona) || l.chofer}</td>
                <td className="px-4 py-2">{l.cantidad_envaseCaja}</td>
                <td className="px-4 py-2">{l.cantidad_prestamoBotellas}</td>
                <td className="px-4 py-2">{l.descripcion_envase}</td>
                <td className="px-4 py-2">{l.fecha_prestamo}</td>
                <td className="px-4 py-2">{l.fecha_devolucion ?? '-'}</td>
                <td className="px-4 py-2">{l.estado_prestamo ? 'Devuelto' : 'Activo'}</td>
                <td className="px-4 py-2">
                  <button onClick={()=>{
                    // load loan into form for editing fecha_devolucion and estado
                    setCreatedLoan(l)
                    setEditingLoanId(l.id_prestamo)
                    setForm(prev => ({...prev, cantidad_envaseCaja: l.cantidad_envaseCaja, cantidad_prestamoBotellas: l.cantidad_prestamoBotellas, descripcion_envase: l.descripcion_envase || '', fecha_prestamo: l.fecha_prestamo || '', id_persona: l.id_persona || '', estado_prestamo: l.estado_prestamo || 0, fecha_devolucion: l.fecha_devolucion || '', chofer: l.chofer || ''}))
                    setBottlesEdited(true)
                  }} className="mr-2 text-sm px-2 py-1 border rounded">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
