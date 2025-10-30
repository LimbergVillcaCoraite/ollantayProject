import React, { useEffect, useMemo, useState } from 'react';
import { showToast } from '../toast';

export default function Compras({ API, userRole }) {
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Derived API roots for related services
  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
  const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
  const BASE_URL = `${proto}//${host}`
  const API_PROVEEDORES = `${proto}//${host}/api/proveedores`
  const API_PRESTAMOS = `${proto}//${host}/api/prestamos`

  // Data for form selects
  const [proveedores, setProveedores] = useState([])
  const [loadingProveedores, setLoadingProveedores] = useState(false)
  const [productos, setProductos] = useState([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [productSearch, setProductSearch] = useState({}) // { [idx]: "search text" }
  const [showProductDropdown, setShowProductDropdown] = useState({}) // { [idx]: true/false }
  const [tiposPago, setTiposPago] = useState([])
  const [loadingTiposPago, setLoadingTiposPago] = useState(false)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [fechaCompra, setFechaCompra] = useState(() => new Date().toISOString().slice(0,10))
  const [idProveedor, setIdProveedor] = useState('')
  const [idTipoPago, setIdTipoPago] = useState(1) // default; will be adjusted after tiposPago load
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState([ { idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '' } ])
  const [files, setFiles] = useState([])

  // Inline edit state for update (estado/observaciones)
  const [editing, setEditing] = useState(null) // compra object
  const [editEstado, setEditEstado] = useState(1)
  const [editObs, setEditObs] = useState('')
  const [editFiles, setEditFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  // Filters and pagination
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fProveedor, setFProveedor] = useState('')
  const [fTipoPago, setFTipoPago] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Calendar and statistics
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  // Lotes state
  const [expandedLotes, setExpandedLotes] = useState({}) // {idCompra: [lotes]}
  const [loadingLotes, setLoadingLotes] = useState({})
  const [comprasPorDia, setComprasPorDia] = useState({})
  const [estadisticas, setEstadisticas] = useState(null)

  const canManage = ['admin','editor','superadmin'].includes((userRole||'').toLowerCase())

  const totalForm = useMemo(() => {
    try {
      return detalles.reduce((acc, d) => acc + Number(d.costo_total || 0), 0)
    } catch { return 0 }
  }, [detalles])

  const loadCompras = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      const offset = (page - 1) * pageSize
      params.set('offset', String(offset))
      params.set('limit', String(pageSize))
      if (fDesde) params.set('fecha_inicio', fDesde)
      if (fHasta) params.set('fecha_fin', fHasta)
      if (fProveedor) params.set('idProveedor', String(fProveedor))
      if (fTipoPago) params.set('idTipoPago', String(fTipoPago))
      const url = `${API}?${params.toString()}`
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${t ? ` - ${t.substring(0,120)}` : ''}`)
      }
      const data = await res.json()
      const hdr = res.headers?.get('X-Total-Count')
      setTotal(Number(hdr || (Array.isArray(data) ? data.length : 0)))
      setCompras(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Error cargando compras:', e)
      setError('No se pudieron cargar las compras. ' + (e?.message || 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompras()
  }, [API, userRole, page, pageSize])

  // Re-apply when filters change but reset to first page
  useEffect(() => {
    setPage(1)
    // debounce small
    const t = setTimeout(() => { loadCompras() }, 150)
    return () => clearTimeout(t)
  }, [fDesde, fHasta, fProveedor, fTipoPago])

  // Calcular estadísticas cuando cambian las compras o los filtros
  useEffect(() => {
    calcularEstadisticas()
    agruparComprasPorDia()
  }, [compras, fDesde, fHasta])

  // Cuando se selecciona una fecha del calendario, actualizar los filtros
  useEffect(() => {
    if (selectedDate) {
      setFDesde(selectedDate)
      setFHasta(selectedDate)
    }
  }, [selectedDate])

  const calcularEstadisticas = () => {
    if (!compras || compras.length === 0) {
      setEstadisticas(null)
      return
    }

    const totalCompras = compras.reduce((sum, c) => sum + Number(c.montoTotal || 0), 0)
    const numeroCompras = compras.length
    const promedioCompra = totalCompras / numeroCompras

    // Contar productos más comprados (necesitamos los detalles)
    const productosCount = {}
    compras.forEach(c => {
      if (c.detalles && Array.isArray(c.detalles)) {
        c.detalles.forEach(d => {
          const nombre = d.nombreProducto || `Producto ${d.idProducto}`
          productosCount[nombre] = (productosCount[nombre] || 0) + Number(d.cantidad_caja || 0)
        })
      }
    })

    const productoMasComprado = Object.entries(productosCount).sort((a, b) => b[1] - a[1])[0]

    setEstadisticas({
      totalCompras,
      numeroCompras,
      promedioCompra,
      productoMasComprado: productoMasComprado ? {
        nombre: productoMasComprado[0],
        cantidad: productoMasComprado[1]
      } : null
    })
  }

  const agruparComprasPorDia = () => {
    const porDia = {}
    compras.forEach(c => {
      const fecha = c.fechaCompra ? c.fechaCompra.split('T')[0] : null
      if (!fecha) return
      if (!porDia[fecha]) porDia[fecha] = []
      porDia[fecha].push(c)
    })
    setComprasPorDia(porDia)
  }

  const loadProveedores = async () => {
    setLoadingProveedores(true)
    try {
      const res = await fetch(`${API_PROVEEDORES}`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) throw new Error('No se pudieron cargar proveedores')
      const data = await res.json()
      setProveedores(Array.isArray(data) ? data.filter(p => p.estado === 1) : [])
    } catch (e) { console.error(e) } finally { setLoadingProveedores(false) }
  }

  const loadProductos = async () => {
    setLoadingProductos(true)
    try {
      const res = await fetch(`${API_PRESTAMOS}/productos`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) throw new Error('No se pudieron cargar productos')
      const data = await res.json()
      setProductos(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) } finally { setLoadingProductos(false) }
  }

  const loadTiposPago = async () => {
    setLoadingTiposPago(true)
    try {
      console.log('Loading tipos de pago from:', `${API}/tipos-pago`)
      const res = await fetch(`${API}/tipos-pago`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error('Error loading tipos de pago:', res.status, errorText)
        throw new Error(`No se pudieron cargar tipos de pago (HTTP ${res.status})`)
      }
      const data = await res.json()
      console.log('Tipos de pago loaded:', data)
      const arr = Array.isArray(data) ? data : []
      setTiposPago(arr)
      // Ajustar default del formulario si aplica
      if (arr.length > 0) {
        // Preferir Contado si existe
        const contado = arr.find(tp => /contado/i.test(tp.tipoPago))
        setIdTipoPago(prev => prev || (contado ? contado.idPago : arr[0].idPago))
      } else {
        console.warn('No se encontraron tipos de pago')
      }
    } catch (e) { 
      console.error('Exception loading tipos de pago:', e)
      showToast('Error al cargar tipos de pago: ' + e.message, 'error')
    } finally { 
      setLoadingTiposPago(false) 
    }
  }

  const loadLotesForCompra = async (idCompra) => {
    if (expandedLotes[idCompra]) {
      // Ya están cargados, solo colapsar
      setExpandedLotes(prev => {
        const next = { ...prev }
        delete next[idCompra]
        return next
      })
      return
    }

    setLoadingLotes(prev => ({ ...prev, [idCompra]: true }))
    try {
      const res = await fetch(`${API}/${idCompra}/lotes`, { 
        credentials: 'include', 
        headers: userRole ? { 'X-User-Role': userRole } : {} 
      })
      if (!res.ok) throw new Error('No se pudieron cargar los lotes')
      const data = await res.json()
      setExpandedLotes(prev => ({ ...prev, [idCompra]: Array.isArray(data) ? data : [] }))
    } catch (e) {
      console.error(e)
      showToast('Error al cargar lotes: ' + e.message, 'error')
    } finally {
      setLoadingLotes(prev => ({ ...prev, [idCompra]: false }))
    }
  }

  useEffect(() => {
    // Preload selects when opening form
    if (showForm) {
      loadProveedores()
      loadProductos()
    }
  }, [showForm])

  useEffect(() => { loadProveedores(); loadTiposPago() }, [])

  const resetForm = () => {
    setFechaCompra(new Date().toISOString().slice(0,10))
    setIdProveedor('')
    setIdTipoPago(() => {
      const contado = tiposPago.find(tp => /contado/i.test(tp.tipoPago))
      return contado ? contado.idPago : (tiposPago[0]?.idPago || 1)
    })
    setObservaciones('')
    setDetalles([{ idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '' }])
    setFiles([])
  }

  const addDetalle = () => setDetalles(d => [...d, { idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '' }])
  const removeDetalle = (idx) => setDetalles(d => d.filter((_, i) => i !== idx))
  const updateDetalle = (idx, patch) => setDetalles(d => d.map((row, i) => {
    if (i !== idx) return row
    const next = { ...row, ...patch }
    const nCant = Number(next.cantidad_caja || 0)
    const nBot = Number(next.botellas_por_caja || 0)
    
    // Prioridad: Si cambia costo_total, recalcular precio_unitario y precio_por_botella
    if (patch.costo_total !== undefined) {
      const total = Number(next.costo_total || 0)
      if (nCant > 0) {
        next.precio_unitario = (total / nCant).toFixed(2)
        if (nBot > 0) {
          next.precio_por_botella = (total / (nCant * nBot)).toFixed(4)
        }
      }
    }
    // Si cambia cantidad_caja y existe costo_total, recalcular
    else if (patch.cantidad_caja !== undefined && next.costo_total > 0) {
      const total = Number(next.costo_total || 0)
      if (nCant > 0) {
        next.precio_unitario = (total / nCant).toFixed(2)
        if (nBot > 0) {
          next.precio_por_botella = (total / (nCant * nBot)).toFixed(4)
        }
      }
    }
    // Si cambia precio_unitario (edición manual), recalcular costo_total
    else if (patch.precio_unitario !== undefined) {
      const pu = Number(next.precio_unitario || 0)
      next.costo_total = (pu * nCant).toFixed(2)
      if (nBot > 0) {
        next.precio_por_botella = (pu / nBot).toFixed(4)
      }
    }
    // Si cambia botellas_por_caja, recalcular precio_por_botella
    else if (patch.botellas_por_caja !== undefined) {
      if (nBot > 0 && next.precio_unitario > 0) {
        const pu = Number(next.precio_unitario || 0)
        next.precio_por_botella = (pu / nBot).toFixed(4)
      }
    }
    // Si cambia precio_por_botella (edición manual), recalcular precio_unitario y costo_total
    else if (patch.precio_por_botella !== undefined) {
      const pb = Number(next.precio_por_botella || 0)
      if (nBot > 0) {
        next.precio_unitario = (pb * nBot).toFixed(2)
        next.costo_total = (next.precio_unitario * nCant).toFixed(2)
      }
    }
    
    return next
  }))

  const getFilteredProductos = (searchText) => {
    if (!searchText) return productos
    const term = searchText.toLowerCase()
    return productos.filter(p => 
      p.nombreProducto.toLowerCase().includes(term)
    )
  }

  const selectProducto = (idx, producto) => {
    updateDetalle(idx, { idProducto: producto.idProducto })
    setProductSearch(prev => ({ ...prev, [idx]: producto.nombreProducto }))
    setShowProductDropdown(prev => ({ ...prev, [idx]: false }))
  }

  const handleProductSearchChange = (idx, value) => {
    setProductSearch(prev => ({ ...prev, [idx]: value }))
    setShowProductDropdown(prev => ({ ...prev, [idx]: true }))
    // Limpiar selección si el texto no coincide
    const currentDetail = detalles[idx]
    if (currentDetail?.idProducto) {
      const selectedProd = productos.find(p => p.idProducto === Number(currentDetail.idProducto))
      if (!selectedProd || !selectedProd.nombreProducto.toLowerCase().includes(value.toLowerCase())) {
        updateDetalle(idx, { idProducto: '' })
      }
    }
  }

  const validateForm = () => {
    console.log('DEBUG: validateForm called')
    console.log('DEBUG: idProveedor:', idProveedor)
    console.log('DEBUG: detalles:', detalles)
    if (!idProveedor) { showToast('Seleccione un proveedor', 'error'); return false }
    const validRows = detalles.filter(d => Number(d.idProducto) && Number(d.cantidad_caja) > 0 && Number(d.costo_total) > 0)
    console.log('DEBUG: validRows:', validRows)
    if (validRows.length === 0) { showToast('Agregue al menos un producto con cantidad y costo total', 'error'); return false }
    for (const f of files) {
      if (!['application/pdf'].includes(f.type) && !f.type.startsWith('image/')) {
        showToast('Solo se permiten imágenes o PDF como comprobantes', 'error')
        return false
      }
    }
    console.log('DEBUG: validateForm returning true')
    return true
  }

  const handleCreate = async (e) => {
    e?.preventDefault?.()
    console.log('DEBUG: handleCreate called')
    console.log('DEBUG: Form values - idProveedor:', idProveedor, 'detalles:', detalles)
    if (!validateForm()) {
      console.log('DEBUG: validateForm returned false')
      return
    }
    console.log('DEBUG: validateForm passed')
    const payload = {
      fechaCompra,
      idProveedor: Number(idProveedor),
      idTipoPago: Number(idTipoPago),
  montoTotal: Number(totalForm.toFixed(2)),
      estado: 1,
      observaciones: observaciones || null,
      detalles: detalles
        .filter(d => Number(d.idProducto) && Number(d.cantidad_caja) > 0 && Number(d.costo_total) > 0)
        .map(d => {
          const cantidad = Number(d.cantidad_caja)
          const costoTotal = Number(d.costo_total)
          const precioUnit = cantidad > 0 ? (costoTotal / cantidad) : 0
          return {
            idProducto: Number(d.idProducto),
            cantidad_caja: cantidad,
            precio_unitario: Number(precioUnit.toFixed(2)),
            subtotal: Number(costoTotal.toFixed(2)),
            fechaVencimiento: d.fechaVencimiento || null
          }
        })
    }
    console.log('DEBUG: Payload to send:', JSON.stringify(payload, null, 2))
    console.log('DEBUG: API endpoint:', API)
    try {
      console.log('DEBUG: About to fetch...')
      const res = await fetch(`${API}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
        body: JSON.stringify(payload)
      })
      console.log('DEBUG: Response status:', res.status, res.statusText)
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ raw: await res.text() }))
        console.log('DEBUG: Error response:', j)
        throw new Error(j?.detail || j?.raw || `Status ${res.status}`)
      }
      const created = await res.json()
      console.log('DEBUG: Created response:', created)
      const newId = created?.idCompra || created?.id
      if (newId && files.length > 0) {
        const fd = new FormData()
        files.forEach(f => fd.append('files', f))
        const up = await fetch(`${API}/${newId}/comprobantes`, {
          method: 'POST',
          credentials: 'include',
          headers: { ...(userRole ? { 'X-User-Role': userRole } : {}) },
          body: fd
        })
        if (!up.ok) {
          const t = await up.text().catch(()=> '')
          console.warn('Fallo subiendo comprobantes:', t)
        }
      }
      await loadCompras()
      resetForm()
      setShowForm(false)
      showToast('Compra registrada', 'success')
    } catch (err) {
      console.error('Error creando compra:', err)
      showToast('No se pudo crear la compra: ' + (err?.message || 'Error'), 'error')
    }
  }

  const openEdit = (c) => { setEditing(c); setEditEstado(c.estado ?? 1); setEditObs(c.observaciones || ''); setEditFiles([]) }
  const closeEdit = () => { setEditing(null); setEditObs(''); setEditEstado(1); setEditFiles([]); setUploading(false) }
  const handleUpdate = async () => {
    if (!editing) return
    const body = {
      fechaCompra: editing.fechaCompra,
      idProveedor: editing.idProveedor,
      idTipoPago: editing.idTipoPago,
      montoTotal: editing.montoTotal,
      estado: Number(editEstado),
      observaciones: editObs || null,
      detalles: []
    }
    try {
      const res = await fetch(`${API}/${editing.idCompra}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ raw: await res.text() }))
        throw new Error(j?.detail || j?.raw || `Status ${res.status}`)
      }
      // Subir comprobantes si se seleccionaron
      if (editFiles.length > 0) {
        setUploading(true)
        const fd = new FormData()
        editFiles.forEach(f => fd.append('files', f))
        const up = await fetch(`${API}/${editing.idCompra}/comprobantes`, {
          method: 'POST',
          credentials: 'include',
          headers: { ...(userRole ? { 'X-User-Role': userRole } : {}) },
          body: fd
        })
        if (!up.ok) {
          const t = await up.text().catch(()=> '')
          console.warn('Fallo subiendo comprobantes (edición):', t)
        }
      }
      showToast('Compra actualizada', 'success')
      closeEdit()
      loadCompras()
    } catch (err) {
      console.error('Error actualizando compra:', err)
      showToast('No se pudo actualizar', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (c) => {
    if (!c) return
    const msg = userRole === 'superadmin' ? 'Eliminar permanentemente esta compra?' : 'Anular esta compra?'
    if (!confirm(msg)) return
    try {
      const res = await fetch(`${API}/${c.idCompra}`, { method: 'DELETE', credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (res.status !== 204) {
        const t = await res.text().catch(()=> '')
        throw new Error(`Status ${res.status} ${t}`)
      }
      showToast(userRole === 'superadmin' ? 'Compra eliminada' : 'Compra anulada', 'success')
      loadCompras()
    } catch (err) {
      console.error('Error eliminando/anulando compra:', err)
      showToast('No se pudo procesar la solicitud', 'error')
    }
  }

  const formatMoney = (n) => {
    const x = Number(n||0)
    // Mostrar en Bolivianos (Bs)
    try {
      return x.toLocaleString('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 })
    } catch {
      return `Bs ${x.toFixed(2)}`
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold dark:text-white">Compras</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-full sm:w-auto px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
          >{showForm ? 'Cerrar' : 'Nueva compra'}</button>
        )}
      </div>
      {showForm && (
        <div className="mb-6 p-4 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Fecha</label>
                <input type="date" value={fechaCompra} onChange={e=>setFechaCompra(e.target.value)} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Proveedor</label>
                <select value={idProveedor} onChange={e=>setIdProveedor(e.target.value)} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700">
                  <option value="">Seleccione...</option>
                  {loadingProveedores ? <option>Cargando...</option> : proveedores.map(p => (
                    <option key={p.idProveedor} value={p.idProveedor}>
                      {p.nombreComercial} {p.esEmpresa ? '(Empresa)' : '(Persona)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Tipo de pago</label>
                <select value={idTipoPago} onChange={e=>setIdTipoPago(Number(e.target.value))} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700">
                  {loadingTiposPago && <option>Cargando...</option>}
                  {!loadingTiposPago && tiposPago.length === 0 && <option value="">No hay tipos de pago disponibles</option>}
                  {!loadingTiposPago && tiposPago.length > 0 && tiposPago.map(tp => (
                    <option key={tp.idPago} value={tp.idPago}>{tp.tipoPago}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Comprobantes (imagen/PDF)</label>
              <input type="file" accept="image/*,application/pdf" multiple onChange={(e)=> setFiles(Array.from(e.target.files||[]))} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
              {files.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {files.map((f,i)=> (
                    <div key={i}>• {f.name} ({Math.round(f.size/1024)} KB)</div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Observaciones</label>
              <textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" rows={2} placeholder="Notas opcionales" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold dark:text-gray-200">Detalles</h3>
                <button type="button" onClick={addDetalle} className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Agregar producto</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border dark:border-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-left">Cantidad (cajas)</th>
                      <th className="p-2 text-left">Bot/Caja</th>
                      <th className="p-2 text-left">Costo Total (Bs)</th>
                      <th className="p-2 text-left">Costo/Caja (Bs)</th>
                      <th className="p-2 text-left">Costo/Botella (Bs)</th>
                      <th className="p-2 text-left">Fecha Vencimiento</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d, idx) => {
                      const subtotal = Number(d.costo_total || 0)
                      const searchText = productSearch[idx] || ''
                      const filteredProds = getFilteredProductos(searchText)
                      const selectedProd = d.idProducto ? productos.find(p => p.idProducto === Number(d.idProducto)) : null
                      const showDropdown = showProductDropdown[idx] && searchText.length > 0
                      
                      return (
                        <tr key={idx} className="border-t dark:border-gray-700">
                          <td className="p-2 min-w-[220px] relative">
                            <input 
                              type="text"
                              value={searchText || (selectedProd ? selectedProd.nombreProducto : '')}
                              onChange={(e) => handleProductSearchChange(idx, e.target.value)}
                              onFocus={() => setShowProductDropdown(prev => ({ ...prev, [idx]: true }))}
                              onBlur={() => setTimeout(() => setShowProductDropdown(prev => ({ ...prev, [idx]: false })), 200)}
                              placeholder="Buscar producto..."
                              className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700"
                            />
                            {showDropdown && (
                              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                                {loadingProductos ? (
                                  <div className="p-2 text-gray-500">Cargando...</div>
                                ) : filteredProds.length > 0 ? (
                                  filteredProds.map(p => (
                                    <div
                                      key={p.idProducto}
                                      onClick={() => selectProducto(idx, p)}
                                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="font-medium">{p.nombreProducto}</div>
                                      <div className="text-xs text-gray-500">Stock: {p.stockCaja || 0} cajas</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3">
                                    <div className="text-gray-500 mb-2">No se encontraron productos</div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowProductDropdown(prev => ({ ...prev, [idx]: false }))
                                        showToast('Funcionalidad de crear producto en desarrollo', 'info')
                                      }}
                                      className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                    >
                                      + Crear producto "{searchText}"
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" step="1" value={d.cantidad_caja} onChange={(e)=>updateDetalle(idx, { cantidad_caja: e.target.value })} className="w-24 border rounded px-2 py-1 text-right dark:bg-gray-900 dark:border-gray-700" placeholder="0" />
                          </td>
                          <td className="p-2">
                            <input type="number" min="1" step="1" placeholder="Bot/caja" value={d.botellas_por_caja} onChange={(e)=>updateDetalle(idx, { botellas_por_caja: e.target.value })} className="w-24 border rounded px-2 py-1 text-right dark:bg-gray-900 dark:border-gray-700" />
                            <div className="text-xs text-gray-500 mt-1">Opcional</div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={d.costo_total} 
                              onChange={(e)=>updateDetalle(idx, { costo_total: e.target.value })} 
                              className="w-32 border-2 border-blue-500 rounded px-2 py-1 text-right font-semibold dark:bg-gray-900 dark:border-blue-600" 
                              placeholder="0.00"
                            />
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Ingrese aquí</div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={d.precio_unitario} 
                              onChange={(e)=>updateDetalle(idx, { precio_unitario: e.target.value })} 
                              className="w-28 border rounded px-2 py-1 text-right bg-gray-50 dark:bg-gray-800 dark:border-gray-700" 
                              placeholder="Auto"
                            />
                            <div className="text-xs text-gray-500 mt-1">Editable</div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="0" 
                              step="0.0001" 
                              placeholder="Auto" 
                              value={d.precio_por_botella} 
                              onChange={(e)=>updateDetalle(idx, { precio_por_botella: e.target.value })} 
                              className="w-28 border rounded px-2 py-1 text-right bg-gray-50 dark:bg-gray-800 dark:border-gray-700" 
                            />
                            <div className="text-xs text-gray-500 mt-1">Editable</div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="date" 
                              value={d.fechaVencimiento || ''} 
                              onChange={(e)=>updateDetalle(idx, { fechaVencimiento: e.target.value })} 
                              className="w-40 border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700" 
                              placeholder="Opcional"
                            />
                            <div className="text-xs text-gray-500 mt-1">Opcional</div>
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={()=>removeDetalle(idx)} className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700">Quitar</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-4 mt-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">Total:</div>
                <div className="text-lg font-semibold dark:text-white">{formatMoney(totalForm)}</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={()=>{ resetForm(); setShowForm(false) }} className="px-3 py-2 rounded border dark:border-gray-700">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Guardar compra</button>
            </div>
          </form>
        </div>
      )}
      {loading && <div className="dark:text-gray-300">Cargando...</div>}
      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      {!loading && !error && (
        <div className="overflow-x-auto">
          {/* Filters */}
          <div className="mb-3 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Desde</label>
              <input type="date" value={fDesde} onChange={e=>setFDesde(e.target.value)} className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Hasta</label>
              <input type="date" value={fHasta} onChange={e=>setFHasta(e.target.value)} className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Proveedor</label>
              <select value={fProveedor} onChange={e=>setFProveedor(e.target.value)} className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700">
                <option value="">Todos</option>
                {proveedores.map(p => (
                  <option key={p.idProveedor} value={p.idProveedor}>{p.nombreComercial}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Tipo de pago</label>
              <select value={fTipoPago} onChange={e=>setFTipoPago(e.target.value)} className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700">
                <option value="">Todos</option>
                {tiposPago.map(tp => (<option key={tp.idPago} value={tp.idPago}>{tp.tipoPago}</option>))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={()=>{ setFDesde(''); setFHasta(''); setFProveedor(''); setFTipoPago(''); }} className="px-2 py-1 text-sm rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">Limpiar</button>
              <button onClick={()=> setShowCalendar(!showCalendar)} className="px-2 py-1 text-sm rounded border dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300">
                📅 {showCalendar ? 'Ocultar' : 'Calendario'}
              </button>
            </div>
          </div>

          {/* Calendario de compras */}
          {showCalendar && <CalendarioCompras comprasPorDia={comprasPorDia} onSelectDate={setSelectedDate} selectedDate={selectedDate} />}

          {/* Estadísticas resumen */}
          {estadisticas && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-semibold mb-3 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                Resumen {selectedDate ? `del ${selectedDate}` : (fDesde || fHasta) ? 'del rango seleccionado' : 'general'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Compras</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatMoney(estadisticas.totalCompras)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Número de Compras</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{estadisticas.numeroCompras}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Promedio por Compra</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatMoney(estadisticas.promedioCompra)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Producto Más Comprado</div>
                  <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {estadisticas.productoMasComprado ? (
                      <>
                        {estadisticas.productoMasComprado.nombre}
                        <div className="text-xs text-gray-600 dark:text-gray-400">{estadisticas.productoMasComprado.cantidad} cajas</div>
                      </>
                    ) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border dark:border-gray-700 text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-2 text-left dark:text-gray-200">Nº Compra</th>
                  <th className="p-2 text-left dark:text-gray-200">Fecha</th>
                  <th className="p-2 text-left dark:text-gray-200">Proveedor</th>
                  <th className="p-2 text-left dark:text-gray-200">Empresa</th>
                  <th className="p-2 text-left dark:text-gray-200">Monto</th>
                  <th className="p-2 text-left dark:text-gray-200">Estado</th>
                  <th className="p-2 text-right dark:text-gray-200">Acciones</th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-300">
                {compras.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-4 text-center text-gray-500 dark:text-gray-400">Sin registros</td>
                  </tr>
                ) : compras.map(c => (
                  <React.Fragment key={c.idCompra}>
                    <tr className="border-t dark:border-gray-700">
                      <td className="p-2 align-top">
                        <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">{c.numeroCompra || `#${c.idCompra}`}</span>
                      </td>
                      <td className="p-2 align-top">{c.fechaCompra}</td>
                      <td className="p-2 align-top">{c.nombreProveedor}</td>
                      <td className="p-2 align-top">{c.nombreEmpresa}</td>
                      <td className="p-2 align-top">{formatMoney(c.montoTotal)}</td>
                      <td className="p-2 align-top">
                        <span className={`px-2 py-1 rounded text-xs ${c.estado === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                          {c.estado === 1 ? 'Activa' : 'Anulada'}
                        </span>
                      </td>
                      <td className="p-2 align-top text-right whitespace-nowrap">
                        <details className="inline-block mr-2">
                          <summary className="cursor-pointer text-blue-600 hover:underline">Detalles</summary>
                          <div className="mt-2 p-3 rounded border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left">
                            {Array.isArray(c.detalles) && c.detalles.length > 0 ? (
                              <table className="min-w-[420px] text-xs">
                                <thead>
                                  <tr className="text-gray-600 dark:text-gray-400">
                                    <th className="p-1 text-left">Producto</th>
                                    <th className="p-1 text-right">Cant.</th>
                                    <th className="p-1 text-right">Costo</th>
                                    <th className="p-1 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.detalles.map(d => (
                                    <tr key={d.idDetalleCompra}>
                                      <td className="p-1">{d.nombreProducto || d.idProducto}</td>
                                      <td className="p-1 text-right">{d.cantidad_caja}</td>
                                      <td className="p-1 text-right">{formatMoney(d.precio_unitario)}</td>
                                      <td className="p-1 text-right">{formatMoney(d.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="text-xs text-gray-500">Sin detalles</div>
                            )}
                            {/* Comprobantes */}
                            <div className="mt-3">
                              <div className="text-xs font-semibold mb-1">Comprobantes</div>
                              {Array.isArray(c.comprobantes) && c.comprobantes.length > 0 ? (
                                <ul className="text-xs list-disc pl-5">
                                  {c.comprobantes.map((cb) => (
                                    <li key={cb.idComprobante}>
                                      <a href={`${BASE_URL}/api/compras${cb.rutaArchivo}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                        {cb.nombreArchivo}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-gray-500">Sin archivos</div>
                              )}
                            </div>
                          </div>
                        </details>
                        <button 
                          onClick={() => loadLotesForCompra(c.idCompra)} 
                          className="px-2 py-1 text-xs rounded border dark:border-gray-700 mr-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                          disabled={loadingLotes[c.idCompra]}
                        >
                          {loadingLotes[c.idCompra] ? 'Cargando...' : expandedLotes[c.idCompra] ? 'Ocultar Lotes' : 'Ver Lotes'}
                        </button>
                        {canManage && (
                          <>
                            <button onClick={()=>openEdit(c)} className="px-2 py-1 text-xs rounded border dark:border-gray-700 mr-2">Editar</button>
                            <button onClick={()=>handleDelete(c)} className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700">{userRole === 'superadmin' ? 'Eliminar' : 'Anular'}</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {/* Fila expandida para mostrar lotes */}
                    {expandedLotes[c.idCompra] && (
                      <tr className="border-t dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/10">
                        <td colSpan="7" className="p-4">
                          <h4 className="font-semibold mb-2 text-indigo-900 dark:text-indigo-200">Lotes de esta compra</h4>
                          {expandedLotes[c.idCompra].length === 0 ? (
                            <div className="text-sm text-gray-500">No hay lotes registrados</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs border dark:border-gray-700">
                                <thead className="bg-indigo-100 dark:bg-indigo-900/40">
                                  <tr>
                                    <th className="p-2 text-left">ID Lote</th>
                                    <th className="p-2 text-left">Producto</th>
                                    <th className="p-2 text-right">Cant. Cajas</th>
                                    <th className="p-2 text-right">Stock Actual</th>
                                    <th className="p-2 text-right">Precio Compra</th>
                                    <th className="p-2 text-left">Fecha Compra</th>
                                    <th className="p-2 text-left">Fecha Venc.</th>
                                    <th className="p-2 text-left">Proveedor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedLotes[c.idCompra].map(lote => (
                                    <tr key={lote.idLote} className="border-t dark:border-gray-700">
                                      <td className="p-2">{lote.idLote}</td>
                                      <td className="p-2">{lote.nombreProducto || `Producto ${lote.idProducto}`}</td>
                                      <td className="p-2 text-right">{lote.cantidadCajas}</td>
                                      <td className="p-2 text-right">{lote.stockActual}</td>
                                      <td className="p-2 text-right">{formatMoney(lote.precioCompra)}</td>
                                      <td className="p-2">{lote.fechaCompra}</td>
                                      <td className="p-2">{lote.fechaVencimiento || 'N/A'}</td>
                                      <td className="p-2">{lote.nombreProveedor || 'N/A'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile */}
          <div className="md:hidden space-y-4">
            {compras.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Sin registros</div>
            ) : compras.map(c => (
              <div key={c.idCompra} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">
                      {c.numeroCompra || `#${c.idCompra}`}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${c.estado === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                      {c.estado === 1 ? 'Activa' : 'Anulada'}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatMoney(c.montoTotal)}</div>
                </div>
                
                <div className="space-y-2 text-sm mb-3">
                  <div className="flex items-start">
                    <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Fecha:</span>
                    <span className="text-gray-900 dark:text-gray-100">{c.fechaCompra}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Proveedor:</span>
                    <span className="text-gray-900 dark:text-gray-100">{c.nombreProveedor}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Empresa:</span>
                    <span className="text-gray-900 dark:text-gray-100">{c.nombreEmpresa}</span>
                  </div>
                </div>

                {/* Detalles expandibles */}
                <details className="mb-3">
                  <summary className="cursor-pointer text-blue-600 hover:underline text-sm font-medium">Ver productos</summary>
                  <div className="mt-2 space-y-2">
                    {Array.isArray(c.detalles) && c.detalles.length > 0 ? (
                      c.detalles.map(d => (
                        <div key={d.idDetalleCompra} className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-xs">
                          <div className="font-semibold">{d.nombreProducto || d.idProducto}</div>
                          <div className="flex justify-between mt-1">
                            <span>Cantidad: {d.cantidad_caja}</span>
                            <span>Costo: {formatMoney(d.precio_unitario)}</span>
                            <span className="font-bold">Subtotal: {formatMoney(d.subtotal)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">Sin detalles</div>
                    )}
                  </div>
                </details>

                {/* Comprobantes */}
                {Array.isArray(c.comprobantes) && c.comprobantes.length > 0 && (
                  <details className="mb-3">
                    <summary className="cursor-pointer text-blue-600 hover:underline text-sm font-medium">Ver comprobantes</summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {c.comprobantes.map((cb) => (
                        <li key={cb.idComprobante}>
                          <a href={`${BASE_URL}/api/compras${cb.rutaArchivo}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            📎 {cb.nombreArchivo}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Lotes */}
                <div className="mb-3">
                  <button 
                    onClick={() => loadLotesForCompra(c.idCompra)} 
                    className="w-full text-left px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    disabled={loadingLotes[c.idCompra]}
                  >
                    {loadingLotes[c.idCompra] ? 'Cargando lotes...' : expandedLotes[c.idCompra] ? '📦 Ocultar Lotes' : '📦 Ver Lotes'}
                  </button>
                  {expandedLotes[c.idCompra] && (
                    <div className="mt-2 space-y-2">
                      {expandedLotes[c.idCompra].length === 0 ? (
                        <div className="text-xs text-gray-500">No hay lotes registrados</div>
                      ) : (
                        expandedLotes[c.idCompra].map(lote => (
                          <div key={lote.idLote} className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded text-xs">
                            <div className="font-semibold text-indigo-900 dark:text-indigo-200">Lote #{lote.idLote}</div>
                            <div className="text-gray-700 dark:text-gray-300">{lote.nombreProducto || `Producto ${lote.idProducto}`}</div>
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <span>Cant.: {lote.cantidadCajas} cajas</span>
                              <span>Stock: {lote.stockActual}</span>
                              <span>Precio: {formatMoney(lote.precioCompra)}</span>
                              <span>Fecha: {lote.fechaCompra}</span>
                            </div>
                            {lote.fechaVencimiento && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Venc: {lote.fechaVencimiento}</div>
                            )}
                            {lote.nombreProveedor && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">Prov: {lote.nombreProveedor}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={()=>openEdit(c)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                      Editar
                    </button>
                    <button onClick={()=>handleDelete(c)} className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">
                      {userRole === 'superadmin' ? 'Eliminar' : 'Anular'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs dark:text-gray-300">
            <div>
              Mostrando {compras.length > 0 ? ( (page - 1) * pageSize + 1 ) : 0} - {Math.min(page * pageSize, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700">
                {[10,20,50,100].map(n => (<option key={n} value={n}>{n}/pág</option>))}
              </select>
              <button onClick={()=> setPage(p => Math.max(1, p-1))} disabled={page<=1} className="px-2 py-1 rounded border dark:border-gray-700 disabled:opacity-50">Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button onClick={()=> setPage(p => Math.min(totalPages, p+1))} disabled={page>=totalPages} className="px-2 py-1 rounded border dark:border-gray-700 disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">
              Editar compra <span className="font-mono text-blue-600 dark:text-blue-400">{editing.numeroCompra || `#${editing.idCompra}`}</span>
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Estado</label>
                <select value={editEstado} onChange={e=>setEditEstado(e.target.value)} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700">
                  <option value={1}>Activa</option>
                  <option value={0}>Anulada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Observaciones</label>
                <textarea value={editObs} onChange={e=>setEditObs(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
              </div>
              {/* Adjuntar comprobantes en edición */}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Agregar comprobantes (imagen/PDF)</label>
                <input type="file" accept="image/*,application/pdf" multiple onChange={(e)=> setEditFiles(Array.from(e.target.files||[]))} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
                {editFiles.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {editFiles.map((f,i)=> (
                      <div key={i}>• {f.name} ({Math.round(f.size/1024)} KB)</div>
                    ))}
                  </div>
                )}
                {/* Mostrar existentes */}
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-1">Comprobantes actuales</div>
                  {Array.isArray(editing.comprobantes) && editing.comprobantes.length > 0 ? (
                    <ul className="text-xs list-disc pl-5">
                      {editing.comprobantes.map((cb) => (
                        <li key={cb.idComprobante} className="flex items-center gap-2">
                          <a href={`${BASE_URL}/api/compras${cb.rutaArchivo}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {cb.nombreArchivo}
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              onClick={async ()=>{
                                if (!confirm('Eliminar este comprobante?')) return
                                try {
                                  const res = await fetch(`${API}/compras/${editing.idCompra}/comprobantes/${cb.idComprobante}`, {
                                    method: 'DELETE', credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {}
                                  })
                                  if (res.status !== 204) {
                                    const t = await res.text().catch(()=> '')
                                    throw new Error(`Status ${res.status} ${t}`)
                                  }
                                  // actualizar estado local
                                  setEditing(prev => ({ ...prev, comprobantes: (prev.comprobantes||[]).filter(x => x.idComprobante !== cb.idComprobante) }))
                                  showToast('Comprobante eliminado', 'success')
                                } catch (e) {
                                  console.error(e)
                                  showToast('No se pudo eliminar el comprobante', 'error')
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                            >Eliminar</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-500">Sin archivos</div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={closeEdit} className="px-3 py-2 rounded border dark:border-gray-700">Cancelar</button>
              <button onClick={handleUpdate} disabled={uploading} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-500">
                {uploading ? 'Subiendo...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Calendario
function CalendarioCompras({ comprasPorDia, onSelectDate, selectedDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const getDateString = (day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getComprasCount = (dateStr) => {
    return comprasPorDia[dateStr]?.length || 0
  }

  const getComprasTotal = (dateStr) => {
    const compras = comprasPorDia[dateStr] || []
    return compras.reduce((sum, c) => sum + Number(c.montoTotal || 0), 0)
  }

  return (
    <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          ← Anterior
        </button>
        <h3 className="text-lg font-semibold dark:text-white">
          {monthNames[month]} {year}
        </h3>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          Siguiente →
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 p-2">
            {day}
          </div>
        ))}
        
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2"></div>
        ))}
        
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = getDateString(day)
          const count = getComprasCount(dateStr)
          const total = getComprasTotal(dateStr)
          const isSelected = selectedDate === dateStr
          const hasCompras = count > 0
          
          return (
            <button
              key={day}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`
                p-2 rounded text-center transition-all relative
                ${hasCompras ? 'font-bold' : ''}
                ${isSelected ? 'bg-blue-500 text-white ring-2 ring-blue-600' : 
                  hasCompras ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/60' :
                  'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}
              `}
              title={hasCompras ? `${count} compra(s) - Total: Bs ${total.toFixed(2)}` : 'Sin compras'}
            >
              <div className="text-sm">{day}</div>
              {hasCompras && (
                <div className="text-xs mt-1">
                  <div className="font-bold">{count}</div>
                  <div className="text-[10px] leading-none">Bs {total.toFixed(0)}</div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && comprasPorDia[selectedDate] && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
            Compras del {selectedDate}
          </h4>
          <div className="space-y-2">
            {comprasPorDia[selectedDate].map(c => (
              <div key={c.idCompra} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700 text-sm">
                <div>
                  <div className="font-medium dark:text-gray-200">#{c.idCompra} - {c.nombreProveedor}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{c.nombreEmpresa}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    Bs {Number(c.montoTotal || 0).toFixed(2)}
                  </div>
                  <div className={`text-xs ${c.estado === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {c.estado === 1 ? 'Activa' : 'Anulada'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
            <div className="flex justify-between text-sm font-semibold dark:text-gray-200">
              <span>Total del día:</span>
              <span className="text-green-600 dark:text-green-400">
                Bs {comprasPorDia[selectedDate].reduce((sum, c) => sum + Number(c.montoTotal || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
