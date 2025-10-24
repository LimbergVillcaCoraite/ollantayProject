import React, {useState, useEffect, useMemo} from 'react'
import { useToast } from '../ToastContext'

function t(str) { return str; }
export default function Prestamos({API, API_PERSONAS, API_TYPES, userRole='admin', loggedUser=null, permissions=[]}){
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const [loans, setLoans] = useState([])
  const [filteredLoans, setFilteredLoans] = useState([])
  const [loading, setLoading] = useState(true)
  // persons: current list used for cliente select (may be filtered by tipo)
  const [persons, setPersons] = useState([])
  // allPersons: full list used to derive chofer options regardless of cliente filter
  const [allPersons, setAllPersons] = useState([])
  const [types, setTypes] = useState([])
  const [choferTypeId, setChoferTypeId] = useState(null)
  const [selectedFilterTipo, setSelectedFilterTipo] = useState('')
  const [loadingPersons, setLoadingPersons] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [form, setForm] = useState({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:'', idTipocaja:'', idProducto:''})
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
  const [showCreate, setShowCreate] = useState(false)
  const [tipocajas, setTipocajas] = useState([])
  const [productos, setProductos] = useState([])
  const [loadingTipocajas, setLoadingTipocajas] = useState(true)
  const [loadingProductos, setLoadingProductos] = useState(true)
  const [showAdminSummary, setShowAdminSummary] = useState(false)
  const [adminQ, setAdminQ] = useState('')
  const [expandedClient, setExpandedClient] = useState(null)
  // company filter for clients
  const [selectedCompanyId, setSelectedCompanyId] = useState('')

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
      // If user role is 'cliente', filter by their id_persona
      const isCliente = userRole === 'cliente' && loggedUser?.id_persona
      let url
      if(isCliente){
        const params = new URLSearchParams({ id_persona: String(loggedUser.id_persona) })
        if(selectedCompanyId){ params.set('company_id', String(selectedCompanyId)) }
        url = `${API}/loans?${params.toString()}`
      }else{
        url = `${API}/loans`
      }
  const res = await fetch(url, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
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
  const res = await fetch(`${API_PERSONAS}/persons`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      const data = await res.json()
      setAllPersons(Array.isArray(data) ? data : [])
      setPersons(Array.isArray(data) ? data : [])
    }catch(err){ /* ignore */ }
    finally{ setLoadingPersons(false) }
  }

  const loadTypes = async ()=>{
    if(!API_TYPES) return
    try{
  const res = await fetch(`${API_TYPES}/types`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
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

  const loadTipocajas = async ()=>{
    if(!API) return
    try{
  const res = await fetch(`${API}/tipocajas`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if(!res.ok) throw new Error('Error fetching tipocajas')
      const data = await res.json()
      setTipocajas(Array.isArray(data) ? data : [])
    }catch(err){ console.error(err); toast.push('Error cargando tipos de caja','error') }
    finally{ setLoadingTipocajas(false) }
  }

  const loadProductos = async ()=>{
    if(!API) return
    try{
  const res = await fetch(`${API}/productos`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if(!res.ok) throw new Error('Error fetching productos')
      const data = await res.json()
      setProductos(Array.isArray(data) ? data : [])
    }catch(err){ console.error(err); toast.push('Error cargando productos','error') }
    finally{ setLoadingProductos(false) }
  }

  const toast = useToast()

  useEffect(()=>{ loadLoans(); loadPersons(); loadTypes(); loadTipocajas(); loadProductos() }, [])

  // Reload loans when client switches company filter
  useEffect(()=>{
    if(userRole === 'cliente'){
      loadLoans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId])

  // derive company options from current loan list (for client)
  const companyOptions = useMemo(()=>{
    const opts = []
    const seen = new Set()
    for(const l of loans){
      const id = l.chofer_empresa ?? l.empresaChofer ?? l.empresa_chofer ?? null
      const name = l.nombreEmpresaChofer || (id ? `Empresa ${id}` : null)
      if(id && !seen.has(String(id))){
        seen.add(String(id))
        opts.push({ id, name })
      }
    }
    // sort by name asc
    return opts.sort((a,b)=> String(a.name).localeCompare(String(b.name)))
  }, [loans])

  // Auto-set multiplier from tipo de caja selection (madera=40, plástico=12)
  useEffect(()=>{
    if(!form.idTipocaja) return
    const tc = tipocajas.find(t => String(t.idTipocaja) === String(form.idTipocaja))
    if(!tc) return
    const name = (tc.nombretipo_caja || '').toLowerCase()
    let auto = multiplier
    if(name.includes('madera')) auto = 40
    else if(name.includes('plast')) auto = 12
    else return // keep current if no match
    // apply only if user no edit on bottles, or always update multiplier
    setMultiplier(auto)
    if(!bottlesEdited){
      const nCajas = Number(form.cantidad_envaseCaja) || 0
      setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * auto)}))
    }
  }, [form.idTipocaja, tipocajas])

  // when selectedFilterTipo changes, fetch persons filtered by tipo from server
  useEffect(()=>{
    const loadByTipo = async ()=>{
      if(!selectedFilterTipo){
        // restore full list for client selection, but do not affect chofer options
        setPersons(allPersons)
        return
      }
      setLoadingPersons(true)
      try{
  const res = await fetch(`${API_PERSONAS}/persons?tipo=${selectedFilterTipo}`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
        if(!res.ok) throw new Error('Error fetching persons by tipo')
        const data = await res.json()
        setPersons(Array.isArray(data) ? data : [])
      }catch(err){ console.error(err) }
      finally{ setLoadingPersons(false) }
    }
    loadByTipo()
  }, [selectedFilterTipo, allPersons])

  // helper: today's date in YYYY-MM-DD for max attribute
  const todayISO = new Date().toISOString().slice(0,10)

  const getPersonName = (id) => {
    if(!id && id !== 0) return '-'
    const p = (allPersons.length ? allPersons : persons).find(p => String(p.id_persona) === String(id))
    if(!p) return String(id)
    const names = [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer].filter(Boolean).join(' ')
    return names || String(id)
  }

  // Admin summary grouping (active loans per client)
  const adminGroups = useMemo(()=>{
    const active = loans.filter(l => Number(l.estado_prestamo) === 0)
    const map = new Map()
    for(const l of active){
      const key = String(l.id_persona)
      if(!map.has(key)) map.set(key, { id_persona: l.id_persona, cajas:0, botellas:0, productos:new Map(), items:[] })
      const g = map.get(key)
      g.cajas += Number(l.cantidad_envaseCaja)||0
      g.botellas += Number(l.cantidad_prestamoBotellas)||0
      const prod = l.nombreProducto || '-'
      g.productos.set(prod, (g.productos.get(prod)||0) + (Number(l.cantidad_prestamoBotellas)||0))
      g.items.push(l)
    }
    let arr = Array.from(map.values()).map(g=>({
      ...g,
      cliente: getPersonName(g.id_persona),
      productosArr: Array.from(g.productos.entries()).map(([nombre, bot])=>({nombre, bot}))
    }))
    if(adminQ){
      const q = adminQ.toLowerCase()
      arr = arr.filter(x => x.cliente.toLowerCase().includes(q))
    }
    arr.sort((a,b)=> b.botellas - a.botellas)
    return arr
  }, [loans, adminQ, allPersons, persons])

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
    // validate idTipocaja is required
    if(!form.idTipocaja){ toast.push('El campo tipo de caja es requerido','error'); return }
    setSubmitting(true)
    try{
      const payload = {
        cantidad_envaseCaja: form.cantidad_envaseCaja && form.cantidad_envaseCaja !== '' ? Number(form.cantidad_envaseCaja) : null,
        cantidad_prestamoBotellas: form.cantidad_prestamoBotellas && form.cantidad_prestamoBotellas !== '' ? Number(form.cantidad_prestamoBotellas) : null,
        descripcion_envase: form.descripcion_envase && form.descripcion_envase.trim() !== '' ? form.descripcion_envase : null,
        fecha_prestamo: form.fecha_prestamo && form.fecha_prestamo.trim() !== '' ? form.fecha_prestamo : null,
        id_persona: form.id_persona && form.id_persona !== '' ? Number(form.id_persona) : null,
        estado_prestamo: Number(form.estado_prestamo) || 0,
        fecha_devolucion: form.fecha_devolucion && form.fecha_devolucion.trim() !== '' ? form.fecha_devolucion : null,
        chofer: Number(form.chofer),
        idTipocaja: Number(form.idTipocaja),
        idProducto: form.idProducto && form.idProducto !== '' ? Number(form.idProducto) : null
      }
  const res = await fetch(`${API}/loans`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(payload)})
      if(!res.ok){ 
        const j = await res.json().catch(()=>null)
        let errMsg = res.statusText
        if(j?.detail){
          // If detail is an array (validation errors), extract messages
          if(Array.isArray(j.detail)){
            errMsg = j.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
          } else if(typeof j.detail === 'string'){
            errMsg = j.detail
          } else {
            errMsg = JSON.stringify(j.detail)
          }
        }
        throw new Error(errMsg)
      }
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
      let payload
      if (userRole === 'admin') {
        // Admin can edit all fields
        payload = {
          cantidad_envaseCaja: form.cantidad_envaseCaja ? Number(form.cantidad_envaseCaja) : null,
          cantidad_prestamoBotellas: form.cantidad_prestamoBotellas ? Number(form.cantidad_prestamoBotellas) : null,
          descripcion_envase: form.descripcion_envase || null,
          fecha_prestamo: form.fecha_prestamo || null,
          id_persona: form.id_persona ? Number(form.id_persona) : null,
          estado_prestamo: Number(form.estado_prestamo),
          fecha_devolucion: form.fecha_devolucion || null,
          chofer: Number(form.chofer),
          idTipocaja: Number(form.idTipocaja),
          idProducto: form.idProducto ? Number(form.idProducto) : null
        }
      } else {
        // Editor: only editable fields (estado_prestamo and fecha_devolucion)
        payload = {
          estado_prestamo: Number(form.estado_prestamo),
          fecha_devolucion: form.fecha_devolucion || null
        }
      }
  const res = await fetch(`${API}/loans/${editingLoanId}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, credentials: 'include', body: JSON.stringify(payload)})
  if(!res.ok){ 
    const j = await res.json().catch(()=>null)
    let errMsg = res.statusText
    if(j?.detail){
      if(Array.isArray(j.detail)){
        errMsg = j.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
      } else if(typeof j.detail === 'string'){
        errMsg = j.detail
      } else {
        errMsg = JSON.stringify(j.detail)
      }
    }
    throw new Error(errMsg)
  }
  toast.push('Prestamo actualizado','success')
      // refresh
      setCreatedLoan(null)
      setEditingLoanId(null)
      setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:'', idTipocaja:'', idProducto:''})
      setBottlesEdited(false)
      loadLoans()
    }catch(err){ toast.push(err.message || 'Error','error') }
    finally{ setSubmitting(false) }
  }

  const startEditLoan = (loan) => {
    setEditingLoanId(loan.id_prestamo)
    setForm({
      cantidad_envaseCaja: loan.cantidad_envaseCaja,
      cantidad_prestamoBotellas: loan.cantidad_prestamoBotellas,
      descripcion_envase: loan.descripcion_envase,
      fecha_prestamo: loan.fecha_prestamo,
      id_persona: loan.id_persona,
      estado_prestamo: loan.estado_prestamo,
      fecha_devolucion: loan.fecha_devolucion,
      chofer: loan.chofer,
      idTipocaja: loan.idTipocaja || '',
      idProducto: loan.idProducto || ''
    })
  }

  const deleteLoan = async (id) => {
    if(!confirm('¿Eliminar préstamo?')) return
    try {
      const res = await fetch(`${API}/loans/${id}`, { method: 'DELETE', credentials: 'include' })
      if(res.status !== 204) throw new Error('No se pudo eliminar')
      loadLoans()
    } catch (err) {
      toast.push('Error eliminando préstamo','error')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Prestamos</h2>
      
      {/* Resumen para clientes */}
      {userRole === 'cliente' && (
        <div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-lg shadow mb-4 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-300">Resumen de Préstamos Pendientes</h3>
          {companyOptions.length > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-gray-700 dark:text-gray-300">{t('Empresa')}</label>
              <select className="p-2 border rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" value={selectedCompanyId} onChange={e=>setSelectedCompanyId(e.target.value)}>
                <option value="">Todas</option>
                {companyOptions.map(c => (
                  <option key={`emp-${c.id}`} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-700 p-3 rounded shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Cajas Prestadas</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {filteredLoans.filter(l => l.estado_prestamo === 0).reduce((sum, l) => sum + (l.cantidad_envaseCaja || 0), 0)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-3 rounded shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Botellas Prestadas</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {filteredLoans.filter(l => l.estado_prestamo === 0).reduce((sum, l) => sum + (l.cantidad_prestamoBotellas || 0), 0)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-700 p-3 rounded shadow">
              <div className="text-sm text-gray-600 dark:text-gray-400">Productos Activos</div>
              <div className="text-sm mt-1">
                {[...new Set(filteredLoans.filter(l => l.estado_prestamo === 0 && l.nombreProducto).map(l => l.nombreProducto))].join(', ') || 'Ninguno'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel admin: Resumen por cliente (diseño mejorado) */}
      {has('roles','manage') && (
        <div className="bg-gradient-to-br from-yellow-100 via-white to-yellow-200 dark:from-gray-900 dark:via-gray-800 dark:to-yellow-900 p-6 rounded-2xl shadow-xl mb-8 border border-yellow-300 dark:border-yellow-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-yellow-900 dark:text-yellow-200 tracking-tight">Resumen de Deudas por Cliente</h3>
            <button onClick={()=>setShowAdminSummary(s=>!s)} className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors ${showAdminSummary ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900'}`}>
              {showAdminSummary ? 'Ocultar' : 'Ver resumen'}
            </button>
          </div>
          {showAdminSummary && (
            <div className="transition-all duration-300">
              <div className="mb-6 flex flex-col md:flex-row items-center gap-4">
                <input className="p-3 border border-yellow-300 dark:border-yellow-700 rounded-lg flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow focus:ring-2 focus:ring-yellow-400" placeholder="Buscar cliente..." value={adminQ} onChange={e=>setAdminQ(e.target.value)} />
                <div className="text-sm text-gray-700 dark:text-gray-300">Clientes: <span className="font-bold">{adminGroups.length}</span></div>
              </div>
              <div className="grid gap-6">
                {adminGroups.length === 0 && (
                  <div className="p-6 text-center text-lg text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-xl shadow">No hay deudas activas</div>
                )}
                {adminGroups.map(g => (
                  <div key={`g-${g.id_persona}`} className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border border-yellow-200 dark:border-yellow-700 transition hover:scale-[1.01]">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-400 dark:bg-yellow-700 flex items-center justify-center text-xl font-bold text-white shadow">{g.cliente[0]}</div>
                        <div>
                          <div className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">{g.cliente}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">ID: {g.id_persona}</div>
                        </div>
                      </div>
                      <div className="flex gap-6 md:gap-10">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Cajas activas</div>
                          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{g.cajas}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Botellas activas</div>
                          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{g.botellas}</div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Productos</div>
                        <div className="flex flex-wrap gap-2">
                          {g.productosArr.map(p => (
                            <span key={`${g.id_persona}-${p.nombre}`} className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 text-xs font-medium shadow">{p.nombre}: <span className="font-bold">{p.bot}</span></span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <button onClick={()=> setExpandedClient(c=> c===g.id_persona ? null : g.id_persona)} className={`btn btn-secondary text-xs px-3 py-1.5 ${expandedClient===g.id_persona ? 'bg-yellow-200 dark:bg-yellow-900' : ''}`}>{expandedClient===g.id_persona ? 'Ocultar detalle' : 'Ver detalle'}</button>
                      </div>
                    </div>
                    {expandedClient===g.id_persona && (
                      <div className="mt-4 bg-yellow-50 dark:bg-gray-800 rounded-xl p-4 border border-yellow-200 dark:border-yellow-700 shadow-inner animate-fade-in">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs rounded-lg">
                            <thead>
                              <tr className="text-gray-700 dark:text-gray-300">
                                <th className="px-2 py-1 text-left">ID</th>
                                <th className="px-2 py-1 text-left">Fecha</th>
                                <th className="px-2 py-1 text-left">Tipo Caja</th>
                                <th className="px-2 py-1 text-left">Producto</th>
                                <th className="px-2 py-1 text-right">Cajas</th>
                                <th className="px-2 py-1 text-right">Botellas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map(it => (
                                <tr key={`gi-${it.id_prestamo}`} className="hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors">
                                  <td className="px-2 py-1">{it.id_prestamo}</td>
                                  <td className="px-2 py-1">{it.fecha_prestamo}</td>
                                  <td className="px-2 py-1">{it.nombretipo_caja || '-'}</td>
                                  <td className="px-2 py-1">{it.nombreProducto || '-'}</td>
                                  <td className="px-2 py-1 text-right">{it.cantidad_envaseCaja}</td>
                                  <td className="px-2 py-1 text-right">{it.cantidad_prestamoBotellas}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

  <div className="bg-panel p-4 rounded shadow mb-4 text-panel">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <input className="p-2 border" placeholder="Buscar por cliente, chofer, descripción" value={loanSearchQ} onChange={e=>setLoanSearchQ(e.target.value)} />
          <select className="p-2 border" value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="1">Devuelto</option>
            <option value="0">Activo</option>
          </select>
          <input type="date" className="p-2 border" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
          <input type="date" className="p-2 border" value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
        </div>

  {/* Toggle button for create form - need permisos prestamos:create */}
  {has('prestamos','create') && !isEditing && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`mb-4 px-4 py-2 rounded font-semibold transition-colors ${
              showCreate ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {showCreate ? '− Cancelar' : '+ Nuevo Prestamo'}
          </button>
        )}

  {has('prestamos','create') && (showCreate || isEditing) ? (
              <div className="mb-4 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 shadow-md transition-all">
                <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-300">
                  {isEditing ? 'Editar Prestamo' : 'Crear Nuevo Prestamo'}
                </h3>
                <form onSubmit={isEditing ? submitUpdate : submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} className="p-2 border" placeholder="Cantidad cajas" value={form.cantidad_envaseCaja} inputMode="numeric" onChange={e=>{
            const val = e.target.value
            setForm(prev => ({...prev, cantidad_envaseCaja: val}))
            // auto-calc bottles if user hasn't manually edited bottles
            if(!bottlesEdited){
              const nCajas = Number(val) || 0
              setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * (Number(multiplier) || 0))}))
            }
          }} />
          <div>
            <input disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} className="p-2 border w-full" placeholder="Cantidad botellas" value={form.cantidad_prestamoBotellas} inputMode="numeric" onChange={e=>{ setBottlesEdited(true); setForm({...form, cantidad_prestamoBotellas: e.target.value}) }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">{t('Botellas por caja')}</label>
            <input disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} type="number" min="0" step="1" className="p-2 border w-24" value={multiplier} onChange={e=>{
              const m = Number(e.target.value) || 0
              setMultiplier(m)
              if(!bottlesEdited){
                const nCajas = Number(form.cantidad_envaseCaja) || 0
                setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * m)}))
              }
            }} />
            <button disabled={(isEditing && !has('prestamos','update'))} type="button" className="ml-2 px-2 py-1 border rounded text-sm" onClick={()=>{ setMultiplier(1); if(!bottlesEdited){ const nCajas = Number(form.cantidad_envaseCaja)||0; setForm(prev=>({...prev, cantidad_prestamoBotellas: String(nCajas*1)})) } }}>Reset</button>
          </div>
          <input disabled={(isEditing && !has('prestamos','update'))} className="p-2 border col-span-1 md:grid-cols-2" placeholder="Descripción envase" value={form.descripcion_envase} onChange={e=>setForm({...form, descripcion_envase:e.target.value})} />
          
          {/* Tipo de caja dropdown (required) */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t('Tipo de Caja')} <span className="text-red-500">*</span></label>
            <div className="relative">
              <select disabled={(isEditing && !has('prestamos','update')) || loadingTipocajas} className="p-2 border w-full" value={form.idTipocaja} onChange={e=>setForm({...form, idTipocaja:e.target.value})} required>
                <option value="">{loadingTipocajas ? 'Cargando tipos de caja...' : 'Seleccionar tipo de caja'}</option>
                {tipocajas.map(tc => <option key={tc.idTipocaja} value={tc.idTipocaja}>{tc.nombretipo_caja}</option>)}
              </select>
              {loadingTipocajas && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>

          {/* Producto dropdown (optional) */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{t('Producto')}</label>
            <div className="relative">
              <select disabled={(isEditing && !has('prestamos','update')) || loadingProductos} className="p-2 border w-full" value={form.idProducto} onChange={e=>setForm({...form, idProducto:e.target.value})}>
                <option value="">{loadingProductos ? 'Cargando productos...' : 'Seleccionar producto (opcional)'}</option>
                {productos.map(p => <option key={p.idProducto} value={p.idProducto}>{p.nombreProducto}</option>)}
              </select>
              {loadingProductos && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('Fecha de préstamo')}</label>
            <input disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} type="date" max={todayISO} className="p-2 border w-full" value={form.fecha_prestamo} onChange={e=>setForm({...form, fecha_prestamo:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">{t('Filtrar clientes por Tipo')}</label>
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
            <label className="block text-sm text-gray-700 mb-1">{t('Cliente')}</label>
            <div className="relative">
              {/* Build the options: filtered by selectedFilterTipo, but always include the currently selected client so it shows when editing */}
              {loadingPersons && <div className="p-2">Cargando personas...</div>}
              <select disabled={(isEditing && userRole !== 'admin') || loadingPersons || userRole === 'viewer'} className="p-2 border w-full" value={form.id_persona} onChange={e=>setForm({...form, id_persona:e.target.value})}>
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
            <label className="block text-sm text-gray-700 mb-1">{t('Chofer')}</label>
              <div className="relative">
              <select className="p-2 border w-full" value={form.chofer} onChange={e=>setForm({...form, chofer:e.target.value})} disabled={loadingPersons || !choferTypeId || (isEditing && !has('prestamos','update'))}>
                <option value="">{loadingPersons ? 'Cargando choferes...' : (!choferTypeId ? 'No hay tipo chofer detectado' : 'Seleccionar chofer')}</option>
                {(allPersons.length ? allPersons : persons).filter(p => String(p.id_tipoPersona) === String(choferTypeId)).map(p => (
                  <option key={`chofer-${p.id_persona}`} value={p.id_persona}>{p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}</option>
                ))}
              </select>
              {loadingPersons && <div className="absolute right-2 top-2 animate-spin">⏳</div>}
            </div>
          </div>
          <select className="p-2 border" value={form.estado_prestamo} onChange={e=>setForm({...form, estado_prestamo:e.target.value})} disabled={!has('prestamos','update') && !has('prestamos','create')}>
            <option value={0}>Activo</option>
            <option value={1}>Devuelto</option>
          </select>
          <input type="datetime-local" className="p-2 border" value={form.fecha_devolucion} onChange={e=>setForm({...form, fecha_devolucion:e.target.value})} />
            <div className="col-span-1 md:col-span-2">
            {(has('prestamos','create') || has('prestamos','update')) && <button disabled={submitting || (!isEditing && !form.chofer)} className="btn btn-primary disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V8.414A2 2 0 0016.586 7L12 2.414A2 2 0 0010.586 2H5z"/></svg>
              {submitting ? 'Procesando...' : (isEditing ? 'Actualizar Prestamo' : 'Crear Prestamo')}
            </button>}
            {isEditing && (has('prestamos','update')) && <button type="button" onClick={()=>{ setEditingLoanId(null); setCreatedLoan(null); setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:'', idTipocaja:'', idProducto:''}); setBottlesEdited(false) }} className="ml-2 btn btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L10 8.586 7.707 6.293A1 1 0 006.293 7.707L8.586 10l-2.293 2.293a1 1 0 101.414 1.414L10 11.414l2.293 2.293a1 1 0 001.414-1.414L11.414 10l2.293-2.293z" clipRule="evenodd"/></svg>
              Cancelar
            </button>}
          </div>
        </form>
              </div>
        ) : null}
      </div>

  <div className="bg-panel rounded shadow overflow-x-auto text-panel">
        <table className="min-w-full table-auto text-sm rounded-lg overflow-hidden shadow">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Chofer</th>
              <th className="px-4 py-2">Tipo Caja</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Cantidad cajas</th>
              <th className="px-4 py-2">Botellas</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Fecha préstamo</th>
              <th className="px-4 py-2">Fecha devolución</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4" colSpan={12}>Cargando...</td></tr>}
            {!loading && filteredLoans.length === 0 && <tr><td className="p-4" colSpan={12}>No hay prestamos</td></tr>}
            {filteredLoans.map(l => (
              <tr key={l.id_prestamo} className="border-b dark:border-gray-700">
                <td className="px-4 py-2">{l.id_prestamo}</td>
                <td className="px-4 py-2">{getPersonName(l.id_persona)}</td>
                <td className="px-4 py-2">{getPersonName(l.chofer)}</td>
                <td className="px-4 py-2">{l.nombretipo_caja || '-'}</td>
                <td className="px-4 py-2">{l.nombreProducto || '-'}</td>
                <td className="px-4 py-2">{l.cantidad_envaseCaja}</td>
                <td className="px-4 py-2">{l.cantidad_prestamoBotellas}</td>
                <td className="px-4 py-2">{l.descripcion_envase}</td>
                <td className="px-4 py-2">{l.fecha_prestamo}</td>
                <td className="px-4 py-2">{l.fecha_devolucion}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${l.estado_prestamo === 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{l.estado_prestamo === 0 ? 'Activo' : 'Devuelto'}</span>
                </td>
                <td className="px-4 py-2">
                  {(has('prestamos','update') || has('prestamos','delete')) ? (
                    <div className="flex gap-2">
                      {has('prestamos','update') && <button onClick={()=>startEditLoan(l)} className="btn btn-blue"><span className="mr-1">✎</span>Editar</button>}
                      {has('prestamos','delete') && <button onClick={()=>deleteLoan(l.id_prestamo)} className="btn btn-danger"><span className="mr-1">🗑️</span>Borrar</button>}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">Solo lectura</span>
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
