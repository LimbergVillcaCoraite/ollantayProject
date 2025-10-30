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
  const [validPrestamisteTypes, setValidPrestamisteTypes] = useState([])
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
  const [tipoBotellas, setTipoBotellas] = useState([])
  const [productos, setProductos] = useState([])
  const [loadingTipocajas, setLoadingTipocajas] = useState(true)
  const [loadingTipoBotellas, setLoadingTipoBotellas] = useState(true)
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
      // find valid prestamista types: chofer, admin, and propietario
      const validPrestamistas = normalized.filter(x => {
        const nombre = (x.nombre || '').toLowerCase()
        return nombre.includes('chofer') || 
               nombre.includes('admin') || 
               nombre.includes('propietario') ||
               nombre.includes('administrador')
      })
      
      // For backwards compatibility, set choferTypeId to the first found type
      // but we'll use validPrestamistas for the actual filtering
      const ch = validPrestamistas.find(x => (x.nombre || '').toLowerCase().includes('chofer')) || validPrestamistas[0]
      if(ch) setChoferTypeId(ch.id)
      
      // Store all valid prestamista type IDs for filtering
      const prestamisteTypeIds = validPrestamistas.map(x => x.id)
      setValidPrestamisteTypes(prestamisteTypeIds)
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

  const loadTipoBotellas = async ()=>{
    if(!API) return
    try{
  const res = await fetch(`${API}/tipobotellas`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if(!res.ok) throw new Error('Error fetching tipobotellas')
      const data = await res.json()
      setTipoBotellas(Array.isArray(data) ? data : [])
    }catch(err){ console.error(err); toast.push('Error cargando tipos de botella','error') }
    finally{ setLoadingTipoBotellas(false) }
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

  useEffect(()=>{ loadLoans(); loadPersons(); loadTypes(); loadTipocajas(); loadTipoBotellas(); loadProductos() }, [])

  // Productos filtrados por tipo de caja seleccionado
  const filteredProductosByTipo = useMemo(() => {
    if (!form.idTipocaja) return productos
    return productos.filter(p => String(p.idTipoBotella) === String(form.idTipocaja))
  }, [productos, form.idTipocaja])

  // Si cambia el tipo de caja y el producto seleccionado no coincide, limpiar selección
  useEffect(() => {
    if (!form.idTipocaja || !form.idProducto) return
    const stillValid = filteredProductosByTipo.some(p => String(p.idProducto) === String(form.idProducto))
    if (!stillValid) {
      setForm(prev => ({ ...prev, idProducto: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.idTipocaja, productos])

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

  // Auto-set multiplier from tipo de botella selection
  useEffect(()=>{
    if(!form.idTipocaja) return
    const tb = tipoBotellas.find(t => String(t.idTipoBotella) === String(form.idTipocaja))
    if(!tb) return
    const name = (tb.tipoBotella || '').toLowerCase()
    let auto = multiplier
    // Determinar multiplicador por nombre de tipo
    if(name.includes('madera')) auto = 40
    else if(name.includes('plast')) auto = 12
    else return // keep current if no match
    // apply only if user no edit on bottles, or always update multiplier
    setMultiplier(auto)
    if(!bottlesEdited){
      const nCajas = Number(form.cantidad_envaseCaja) || 0
      setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * auto)}))
    }
  }, [form.idTipocaja, tipoBotellas])

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
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <input className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="Buscar..." value={loanSearchQ} onChange={e=>setLoanSearchQ(e.target.value)} />
          <select className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="1">Devuelto</option>
            <option value="0">Activo</option>
          </select>
          <input type="date" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} placeholder="Fecha desde" />
          <input type="date" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" value={filterTo} onChange={e=>setFilterTo(e.target.value)} placeholder="Fecha hasta" />
        </div>

  {/* Toggle button for create form - need permisos prestamos:create */}
        {has('prestamos','create') && !isEditing && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={`mb-4 w-full sm:w-auto px-4 py-2 rounded font-semibold transition-colors ${
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
                <form onSubmit={isEditing ? submitUpdate : submit} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 shadow-lg border border-blue-200 dark:border-gray-600">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 -mx-6 -mt-6 mb-6 p-4 text-white rounded-t-xl">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      {isEditing ? 'Editar Préstamo' : 'Nuevo Préstamo'}
                    </h3>
                    <p className="text-blue-100 mt-1">
                      {isEditing ? 'Modifica los detalles del préstamo existente' : 'Registra un nuevo préstamo de envases'}
                    </p>
                  </div>

                  {/* Sección 1: Información del Prestamo */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      Información General del Préstamo
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Fecha */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          Fecha de Préstamo <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input 
                          disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} 
                          type="date" 
                          max={todayISO} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.fecha_prestamo} 
                          onChange={e=>setForm({...form, fecha_prestamo:e.target.value})} 
                          required
                        />
                      </div>

                      {/* Estado */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                          </svg>
                          Estado del Préstamo
                        </label>
                        <select 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.estado_prestamo} 
                          onChange={e=>setForm({...form, estado_prestamo:e.target.value})} 
                          disabled={!has('prestamos','update') && !has('prestamos','create')}
                        >
                          <option value={0}>🔄 Activo (Pendiente)</option>
                          <option value={1}>✅ Devuelto (Completado)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Personas Involucradas */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      Personas Involucradas
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Filtro de tipo de cliente */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                          </svg>
                          Filtrar Clientes por Tipo
                        </label>
                        <select 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={selectedFilterTipo} 
                          onChange={e=>setSelectedFilterTipo(e.target.value)} 
                          disabled={loadingTypes || isEditing || userRole === 'viewer'}
                        >
                          <option value="">{loadingTypes ? '⏳ Cargando tipos...' : '📋 Todos los tipos de cliente'}</option>
                          {types.map(t => <option key={t.id} value={t.id}>🏷️ {t.nombre}</option>)}
                        </select>
                      </div>

                      {/* Cliente */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          Cliente <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select 
                          disabled={(isEditing && userRole !== 'admin') || loadingPersons || userRole === 'viewer'} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.id_persona} 
                          onChange={e=>setForm({...form, id_persona:e.target.value})}
                          required
                        >
                          <option value="">{loadingPersons ? '⏳ Cargando personas...' : (selectedFilterTipo ? '👤 Seleccionar cliente' : '📋 Seleccione un tipo para cargar clientes')}</option>
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
                                <option key={p.id_persona} value={p.id_persona}>
                                  👤 {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}
                                </option>
                              ))
                            })()
                          }
                        </select>
                      </div>

                      {/* Prestamista - Persona que presta */}
                      <div className="space-y-2 lg:col-span-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <path d="M20 8v6M23 11h-6"/>
                          </svg>
                          Persona que Presta (Chofer/Admin/Propietario) <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.chofer} 
                          onChange={e=>setForm({...form, chofer:e.target.value})} 
                          disabled={loadingPersons || validPrestamisteTypes.length === 0 || (isEditing && !has('prestamos','update'))}
                          required
                        >
                          <option value="">{loadingPersons ? '⏳ Cargando prestamistas...' : (validPrestamisteTypes.length === 0 ? '❌ No hay tipos prestamistas detectados' : '🚛 Seleccionar quien presta')}</option>
                          {(allPersons.length ? allPersons : persons).filter(p => 
                            validPrestamisteTypes.includes(String(p.id_tipoPersona)) || validPrestamisteTypes.includes(Number(p.id_tipoPersona))
                          ).map(p => {
                            // Get the tipo name for display
                            const tipoPersona = types.find(t => t.id === p.id_tipoPersona)
                            const tipoNombre = tipoPersona ? ` (${tipoPersona.nombre})` : ''
                            const icon = tipoPersona?.nombre?.toLowerCase().includes('chofer') ? '🚛' :
                                        tipoPersona?.nombre?.toLowerCase().includes('admin') ? '👨‍💼' :
                                        tipoPersona?.nombre?.toLowerCase().includes('propietario') ? '🏢' : '👤'
                            return (
                              <option key={`prestamista-${p.id_persona}`} value={p.id_persona}>
                                {icon} {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}{tipoNombre}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: Detalles del Envase */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 12l1-1v6l-1 1-4-2V8l4-2 1 1"/>
                      </svg>
                      Detalles del Envase
                    </h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Tipo de caja */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          </svg>
                          Tipo de Botella <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select 
                          disabled={(isEditing && !has('prestamos','update')) || loadingTipoBotellas} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.idTipocaja} 
                          onChange={e=>setForm({...form, idTipocaja:e.target.value})} 
                          required
                        >
                          <option value="">{loadingTipoBotellas ? '⏳ Cargando tipos...' : '🍾 Seleccionar tipo de botella'}</option>
                          {tipoBotellas.map(tb => <option key={tb.idTipoBotella} value={tb.idTipoBotella}>🍾 {tb.tipoBotella}</option>)}
                        </select>
                      </div>

                      {/* Producto (filtrado por Tipo de Caja) */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="9" cy="21" r="1"/>
                            <circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                          Producto (Opcional)
                        </label>
                        <select 
                          disabled={(isEditing && !has('prestamos','update')) || loadingProductos} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          value={form.idProducto} 
                          onChange={e=>setForm({...form, idProducto:e.target.value})}
                        >
                          <option value="">{
                            loadingProductos
                              ? '⏳ Cargando productos...'
                              : (!form.idTipocaja
                                  ? '📦 Seleccione un tipo de caja para ver productos'
                                  : (filteredProductosByTipo.length === 0
                                      ? '❌ No hay productos para este tipo de caja'
                                      : '🍺 Seleccionar producto (opcional)'))
                          }</option>
                          {filteredProductosByTipo.map(p => (
                            <option key={p.idProducto} value={p.idProducto}>🍺 {p.nombreProducto}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          La lista de productos se filtra por el Tipo de Caja seleccionado.
                        </p>
                      </div>

                      {/* Cantidad de cajas */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                            <line x1="12" y1="22.08" x2="12" y2="12"/>
                          </svg>
                          Cantidad de Cajas <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input 
                          disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          placeholder="Ej: 10" 
                          value={form.cantidad_envaseCaja} 
                          inputMode="numeric" 
                          type="number"
                          min="0"
                          step="1"
                          required
                          onChange={e=>{
                            const val = e.target.value
                            setForm(prev => ({...prev, cantidad_envaseCaja: val}))
                            // auto-calc bottles if user hasn't manually edited bottles
                            if(!bottlesEdited){
                              const nCajas = Number(val) || 0
                              setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * (Number(multiplier) || 0))}))
                            }
                          }} 
                        />
                      </div>

                      {/* Cantidad de botellas */}
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M5 12V7a1 1 0 011-1h4a1 1 0 011 1v5M5 12l1.5 6h3l1.5-6M5 12h6"/>
                          </svg>
                          Cantidad de Botellas <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input 
                          disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                          placeholder="Ej: 240" 
                          value={form.cantidad_prestamoBotellas} 
                          inputMode="numeric" 
                          type="number"
                          min="0"
                          step="1"
                          required
                          onChange={e=>{ setBottlesEdited(true); setForm({...form, cantidad_prestamoBotellas: e.target.value}) }} 
                        />
                      </div>

                      {/* Calculadora de botellas */}
                      <div className="lg:col-span-2 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
                        <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                          Calculadora Automática
                        </h5>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-blue-700 dark:text-blue-300">Botellas por caja:</label>
                            <input 
                              disabled={(isEditing && !has('prestamos','update')) || !has('prestamos','create')} 
                              type="number" 
                              min="0" 
                              step="1" 
                              className="w-20 px-2 py-1 border border-blue-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 text-sm" 
                              value={multiplier} 
                              onChange={e=>{
                                const m = Number(e.target.value) || 0
                                setMultiplier(m)
                                if(!bottlesEdited){
                                  const nCajas = Number(form.cantidad_envaseCaja) || 0
                                  setForm(prev => ({...prev, cantidad_prestamoBotellas: String(nCajas * m)}))
                                }
                              }} 
                            />
                          </div>
                          <button 
                            disabled={(isEditing && !has('prestamos','update'))} 
                            type="button" 
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:bg-gray-400" 
                            onClick={()=>{ setMultiplier(24); if(!bottlesEdited){ const nCajas = Number(form.cantidad_envaseCaja)||0; setForm(prev=>({...prev, cantidad_prestamoBotellas: String(nCajas*24)})) } }}
                          >
                            24 bot/caja
                          </button>
                          <button 
                            disabled={(isEditing && !has('prestamos','update'))} 
                            type="button" 
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:bg-gray-400" 
                            onClick={()=>{ setMultiplier(12); if(!bottlesEdited){ const nCajas = Number(form.cantidad_envaseCaja)||0; setForm(prev=>({...prev, cantidad_prestamoBotellas: String(nCajas*12)})) } }}
                          >
                            12 bot/caja
                          </button>
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            = <strong>{(Number(form.cantidad_envaseCaja) || 0) * (Number(multiplier) || 0)} botellas</strong>
                          </div>
                        </div>
                      </div>

                      {/* Descripción del envase */}
                      <div className="space-y-2 lg:col-span-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10,9 9,9 8,9"/>
                          </svg>
                          Descripción del Envase
                        </label>
                        <textarea 
                          disabled={(isEditing && !has('prestamos','update'))} 
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all resize-none" 
                          rows="3"
                          placeholder="Ej: Cajas de cerveza Pilsen de 650ml, color verde..." 
                          value={form.descripcion_envase} 
                          onChange={e=>setForm({...form, descripcion_envase:e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección 4: Devolución */}
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.67 0 3.23.46 4.57 1.25"/>
                      </svg>
                      Información de Devolución {form.estado_prestamo == 0 && <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Opcional)</span>}
                    </h4>
                    
                    <div className="space-y-2">
                      <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        Fecha y Hora de Devolución
                      </label>
                      <input 
                        type="datetime-local" 
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all" 
                        value={form.fecha_devolucion} 
                        onChange={e=>setForm({...form, fecha_devolucion:e.target.value})} 
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {form.estado_prestamo == 0 ? 'Puede dejar vacío si no se ha devuelto aún' : 'Indique la fecha y hora en que fue devuelto'}
                      </p>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-600">
                    {(has('prestamos','create') || has('prestamos','update')) && (
                      <button 
                        type="submit"
                        disabled={submitting || (!isEditing && !form.chofer)} 
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg"
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Procesando...
                          </>
                        ) : isEditing ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7"/>
                            </svg>
                            Actualizar Préstamo
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 5v14m7-7H5"/>
                            </svg>
                            Crear Préstamo
                          </>
                        )}
                      </button>
                    )}
                    
                    {isEditing && has('prestamos','update') && (
                      <button 
                        type="button" 
                        onClick={()=>{ 
                          setEditingLoanId(null); 
                          setCreatedLoan(null); 
                          setForm({cantidad_envaseCaja:'', cantidad_prestamoBotellas:'', descripcion_envase:'', fecha_prestamo:'', id_persona:'', estado_prestamo:0, fecha_devolucion:'', chofer:'', idTipocaja:'', idProducto:''}); 
                          setBottlesEdited(false) 
                        }} 
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Cancelar Edición
                      </button>
                    )}
                  </div>
                </form>
              </div>
        ) : null}
      </div>

  {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden md:block bg-panel rounded shadow overflow-x-auto text-panel">
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
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${l.estado_prestamo === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>{l.estado_prestamo === 0 ? 'Activo' : 'Devuelto'}</span>
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

      {/* Mobile Card View - Visible only on mobile */}
      <div className="md:hidden space-y-4">
        {loading && <div className="p-4 text-center text-gray-500 dark:text-gray-400">Cargando...</div>}
        {!loading && filteredLoans.length === 0 && <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay préstamos</div>}
        {filteredLoans.map(l => (
          <div key={l.id_prestamo} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white">#{l.id_prestamo}</span>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${l.estado_prestamo === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                  {l.estado_prestamo === 0 ? 'Activo' : 'Devuelto'}
                </span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Cliente:</span>
                <span className="text-gray-900 dark:text-gray-100">{getPersonName(l.id_persona)}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Chofer:</span>
                <span className="text-gray-900 dark:text-gray-100">{getPersonName(l.chofer)}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Tipo Caja:</span>
                <span className="text-gray-900 dark:text-gray-100">{l.nombretipo_caja || '-'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Producto:</span>
                <span className="text-gray-900 dark:text-gray-100">{l.nombreProducto || '-'}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Cantidad:</span>
                <span className="text-gray-900 dark:text-gray-100">{l.cantidad_envaseCaja} cajas / {l.cantidad_prestamoBotellas} botellas</span>
              </div>
              {l.descripcion_envase && (
                <div className="flex items-start">
                  <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Descripción:</span>
                  <span className="text-gray-900 dark:text-gray-100">{l.descripcion_envase}</span>
                </div>
              )}
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Fecha préstamo:</span>
                <span className="text-gray-900 dark:text-gray-100">{l.fecha_prestamo}</span>
              </div>
              {l.fecha_devolucion && (
                <div className="flex items-start">
                  <span className="font-semibold text-gray-600 dark:text-gray-400 w-32 flex-shrink-0">Fecha devolución:</span>
                  <span className="text-gray-900 dark:text-gray-100">{l.fecha_devolucion}</span>
                </div>
              )}
            </div>
            
            {(has('prestamos','update') || has('prestamos','delete')) && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {has('prestamos','update') && (
                  <button onClick={()=>startEditLoan(l)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    ✎ Editar
                  </button>
                )}
                {has('prestamos','delete') && (
                  <button onClick={()=>deleteLoan(l.id_prestamo)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                    🗑️ Borrar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
