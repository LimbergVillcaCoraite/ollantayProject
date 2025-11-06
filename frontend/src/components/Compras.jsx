import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { showToast } from '../toast';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Dropdown renderizado en portal para evitar clipping/overflow
function ProductDropdownPortal({ anchorEl, open, children }) {
  const [style, setStyle] = useState({ display: 'none' });

  const updatePosition = useCallback(() => {
    if (!anchorEl || !open) return;
    const rect = anchorEl.getBoundingClientRect();
    setStyle({
      position: 'absolute',
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      zIndex: 9999,
      display: 'block'
    });
  }, [anchorEl, open]);

  useEffect(() => {
    if (!open) { setStyle(s => ({ ...s, display: 'none' })); return; }
    updatePosition();
  }, [open, anchorEl, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, updatePosition]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div style={style}>{children}</div>,
    document.body
  );
}

export default function Compras({ API, userRole }) {
  // Vista/Tab state
  const [activeTab, setActiveTab] = useState('compras') // 'compras' | 'creditos'
  
  // Edit-details workflow for full purchase edit (clone-and-cancel)
  const startEditDetalles = (compra) => {
    setShowForm(true);
    setEditingCompraId(compra.idCompra);
    setEditingOriginalCompra(compra);
    setFechaCompra(compra.fechaCompra);
    setIdProveedor(compra.idProveedor);
    setIdTipoPago(compra.idTipoPago);
    setObservaciones(compra.observaciones || '');
    setDetalles(
      Array.isArray(compra.detalles)
        ? compra.detalles.map(d => ({
            idProducto: d.idProducto,
            cantidad_caja: d.cantidad_caja,
            precio_unitario: d.precio_unitario,
            botellas_por_caja: d.botellas_por_caja ?? '',
            precio_por_botella: d.precio_por_botella ?? '',
            costo_total: d.subtotal,
            fechaVencimiento: d.fechaVencimiento || '',
            precio_sugerido: false
          }))
        : [{ idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '', precio_sugerido: false }]
    );
    setFiles([]);
    setHistorialPrecios({});
  };
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
  const productInputRefs = useRef({}); // { [idx]: HTMLInputElement }
  const [tiposPago, setTiposPago] = useState([])
  const [loadingTiposPago, setLoadingTiposPago] = useState(false)
  const [validationMsg, setValidationMsg] = useState('')

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [fechaCompra, setFechaCompra] = useState(() => new Date().toISOString().slice(0,10))
  const [idProveedor, setIdProveedor] = useState('')
  const [idTipoPago, setIdTipoPago] = useState(1) // default; will be adjusted after tiposPago load
  const [observaciones, setObservaciones] = useState('')
  const [detalles, setDetalles] = useState([ { idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '', precio_sugerido: false } ])
  const [files, setFiles] = useState([])
  const [historialPrecios, setHistorialPrecios] = useState({}) // {idProducto-idProveedor: [{fecha, precio}]}
  const [editingCompraId, setEditingCompraId] = useState(null) // modo edición de detalles (clonación)
  const [editingOriginalCompra, setEditingOriginalCompra] = useState(null)

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
  const [fIdProducto, setFIdProducto] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Calendar and statistics
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [periodo, setPeriodo] = useState('') // '', 'hoy', 'semana', 'mes'
  const [isMobile, setIsMobile] = useState(false)

  // Lotes state
  const [expandedLotes, setExpandedLotes] = useState({}) // {idCompra: [lotes]}
  const [loadingLotes, setLoadingLotes] = useState({})
  const [comprasPorDia, setComprasPorDia] = useState({})
  const [estadisticas, setEstadisticas] = useState(null)
  
  // Créditos state
  const [comprasPendientes, setComprasPendientes] = useState([])
  const [loadingPendientes, setLoadingPendientes] = useState(false)
  const [pagoModal, setPagoModal] = useState(null) // {compra, pagos}
  const [loadingPagos, setLoadingPagos] = useState(false)
  const [nuevoPago, setNuevoPago] = useState({ monto: '', fecha: new Date().toISOString().slice(0,10), observaciones: '' })
  const [submittingPago, setSubmittingPago] = useState(false)

  const canManage = ['admin','editor','superadmin'].includes((userRole||'').toLowerCase())

  const totalForm = useMemo(() => {
    try {
      return detalles.reduce((acc, d) => acc + Number(d.costo_total || 0), 0)
    } catch { return 0 }
  }, [detalles])

  const loadCompras = useCallback(async () => {
    console.log('[Compras] loadCompras start', { API, userRole, page, pageSize, fDesde, fHasta, fProveedor, fTipoPago, fIdProducto })
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
      if (fIdProducto) params.set('idProducto', String(fIdProducto))
      const url = `${API}?${params.toString()}`
      console.log('[Compras] GET', url)
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${t ? ` - ${t.substring(0,120)}` : ''}`)
      }
      const data = await res.json()
      console.log('[Compras] response items', Array.isArray(data) ? data.length : 'n/a')
      const hdr = res.headers?.get('X-Total-Count')
      setTotal(Number(hdr || (Array.isArray(data) ? data.length : 0)))
      setCompras(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Error cargando compras:', e)
      setError('No se pudieron cargar las compras. ' + (e?.message || 'Error desconocido'))
    } finally {
      console.log('[Compras] loadCompras end')
      setLoading(false)
    }
  }, [API, userRole, page, pageSize, fDesde, fHasta, fProveedor, fTipoPago, fIdProducto])

   // Funciones de cálculo y agrupación
  const calcularEstadisticas = useCallback(() => {
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
  }, [compras])

  const agruparComprasPorDia = useCallback(() => {
    const porDia = {}
    compras.forEach(c => {
      const fecha = c.fechaCompra ? c.fechaCompra.split('T')[0] : null
      if (!fecha) return
      if (!porDia[fecha]) porDia[fecha] = []
      porDia[fecha].push(c)
    })
    setComprasPorDia(porDia)
  }, [compras])

  // Cargar compras (paginadas) cuando cambian dependencias base
  useEffect(() => {
    loadCompras()
  }, [loadCompras])

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    // Verificar al montar
    checkMobile()
    // Escuchar cambios de tamaño
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Re-apply when filters change but reset to first page
  useEffect(() => {
    setPage(1)
    }, [fDesde, fHasta, fProveedor, fTipoPago, fIdProducto])

  // Calcular estadísticas y agrupar compras por día cuando cambien
  useEffect(() => {
    calcularEstadisticas()
    agruparComprasPorDia()
  }, [calcularEstadisticas, agruparComprasPorDia])

  // Cuando se selecciona una fecha del calendario, actualizar filtros
  useEffect(() => {
    if (selectedDate) {
      setFDesde(selectedDate)
      setFHasta(selectedDate)
    }
  }, [selectedDate])

  // Cargar todas las compras de un mes específico para el calendario
  const loadComprasDelMes = useCallback(async (year, month) => {
    try {
      const primerDia = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const ultimoDia = new Date(year, month + 1, 0)
      const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`
      
      const params = new URLSearchParams()
      params.set('fecha_inicio', primerDia)
      params.set('fecha_fin', ultimoDiaStr)
      params.set('limit', '1000') // Cargar todas las compras del mes
      
      const url = `${API}?${params.toString()}`
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) return
      
      const data = await res.json()
      const comprasDelMes = Array.isArray(data) ? data : []
      
      // Agrupar por día
      const porDia = {}
      comprasDelMes.forEach(c => {
        const fecha = c.fechaCompra ? c.fechaCompra.split('T')[0] : null
        if (!fecha) return
        if (!porDia[fecha]) porDia[fecha] = []
        porDia[fecha].push(c)
      })
      setComprasPorDia(porDia)
    } catch (e) {
      console.error('Error cargando compras del mes:', e)
    }
  }, [API, userRole])

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
      // console.log('Loading tipos de pago from:', `${API}/tipos-pago`)
      const res = await fetch(`${API}/tipos-pago`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        console.error('Error loading tipos de pago:', res.status, errorText)
        throw new Error(`No se pudieron cargar tipos de pago (HTTP ${res.status})`)
      }
      const data = await res.json()
      // console.log('Tipos de pago loaded:', data)
      const arr = Array.isArray(data) ? data : []
      setTiposPago(arr)
      // Ajustar default del formulario si aplica
      if (arr.length > 0) {
        // Preferir Contado si existe (o Crédito si no hay Contado)
        const contado = arr.find(tp => /contado/i.test(tp.tipoPago))
        const credito = arr.find(tp => /cr[eé]dito/i.test(tp.tipoPago))
        setIdTipoPago(prev => prev || (contado ? contado.idPago : (credito ? credito.idPago : arr[0].idPago)))
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
  
  // Cargar compras pendientes de pago (crédito)
  const loadComprasPendientes = useCallback(async () => {
    setLoadingPendientes(true)
    try {
      const res = await fetch(`${API}/pendientes`, { 
        credentials: 'include', 
        headers: userRole ? { 'X-User-Role': userRole } : {} 
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setComprasPendientes(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Error al cargar compras pendientes:', e)
      showToast('Error al cargar compras pendientes', 'error')
    } finally {
      setLoadingPendientes(false)
    }
  }, [API, userRole])
  
  // Abrir modal de pagos para una compra
  const openPagoModal = async (compra) => {
    setLoadingPagos(true)
    setPagoModal({ compra, pagos: [] })
    setNuevoPago({ monto: '', fecha: new Date().toISOString().slice(0,10), observaciones: '' })
    
    try {
      const res = await fetch(`${API}/${compra.idCompra}/pagos`, {
        credentials: 'include',
        headers: userRole ? { 'X-User-Role': userRole } : {}
      })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const pagos = await res.json()
      setPagoModal(prev => ({ ...prev, pagos: Array.isArray(pagos) ? pagos : [] }))
    } catch (e) {
      console.error('Error al cargar pagos:', e)
      showToast('Error al cargar historial de pagos', 'error')
    } finally {
      setLoadingPagos(false)
    }
  }
  
  // Registrar un nuevo pago
  const handleRegistrarPago = async () => {
    if (!pagoModal) return
    
    const monto = parseFloat(nuevoPago.monto)
    if (isNaN(monto) || monto <= 0) {
      showToast('Ingresa un monto válido', 'error')
      return
    }
    
    const saldoPendiente = pagoModal.compra.total - (pagoModal.compra.montoPagado || 0)
    if (monto > saldoPendiente) {
      showToast(`El monto no puede exceder el saldo pendiente (Bs. ${saldoPendiente.toFixed(2)})`, 'error')
      return
    }
    
    setSubmittingPago(true)
    try {
      const res = await fetch(`${API}/${pagoModal.compra.idCompra}/pagos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(userRole ? { 'X-User-Role': userRole } : {})
        },
        body: JSON.stringify({
          monto: monto,
          fecha: nuevoPago.fecha,
          observaciones: nuevoPago.observaciones
        })
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      
      showToast('Pago registrado correctamente', 'success')
      
      // Recargar pagos
      const resPagos = await fetch(`${API}/${pagoModal.compra.idCompra}/pagos`, {
        credentials: 'include',
        headers: userRole ? { 'X-User-Role': userRole } : {}
      })
      const pagosActualizados = await resPagos.json()
      
      // Actualizar modal
      setPagoModal(prev => ({
        ...prev,
        pagos: Array.isArray(pagosActualizados) ? pagosActualizados : []
      }))
      
      // Limpiar form
      setNuevoPago({ monto: '', fecha: new Date().toISOString().slice(0,10), observaciones: '' })
      
      // Recargar lista de pendientes
      loadComprasPendientes()
      
    } catch (e) {
      console.error('Error al registrar pago:', e)
      showToast(e.message || 'Error al registrar el pago', 'error')
    } finally {
      setSubmittingPago(false)
    }
  }
  
  // Cargar pendientes cuando se cambia a tab de créditos
  useEffect(() => {
    if (activeTab === 'creditos') {
      loadComprasPendientes()
    }
  }, [activeTab, loadComprasPendientes])

  const resetForm = () => {
    setFechaCompra(new Date().toISOString().slice(0,10))
    setIdProveedor('')
    setIdTipoPago(() => {
      const contado = tiposPago.find(tp => /contado/i.test(tp.tipoPago))
      return contado ? contado.idPago : (tiposPago[0]?.idPago || 1)
    })
    setObservaciones('')
    setDetalles([{ idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '', precio_sugerido: false }])
    setFiles([])
    setHistorialPrecios({})
    setEditingCompraId(null)
    setEditingOriginalCompra(null)
  }

  const addDetalle = () => setDetalles(d => [...d, { idProducto: '', cantidad_caja: 0, precio_unitario: 0, botellas_por_caja: '', precio_por_botella: '', costo_total: 0, fechaVencimiento: '', precio_sugerido: false }])
  const removeDetalle = (idx) => setDetalles(d => d.filter((_, i) => i !== idx))
  const updateDetalle = (idx, patch) => setDetalles(d => d.map((row, i) => {
    if (i !== idx) return row
    const next = { ...row, ...patch }
    const nCant = Number(next.cantidad_caja || 0)
    const nBot = Number(next.botellas_por_caja || 0)
    
    // PRIORIDAD 1: Si cambia precio_unitario (Precio/Caja), recalcular costo_total y precio_por_botella
    if (patch.precio_unitario !== undefined) {
      const pu = Number(next.precio_unitario || 0)
      next.costo_total = (pu * nCant).toFixed(2)
      if (nBot > 0) {
        next.precio_por_botella = (pu / nBot).toFixed(4)
      }
    }
    // PRIORIDAD 2: Si cambia cantidad_caja, recalcular costo_total basado en precio_unitario
    else if (patch.cantidad_caja !== undefined) {
      const pu = Number(next.precio_unitario || 0)
      next.costo_total = (pu * nCant).toFixed(2)
      // Mantener precio_por_botella si ya existe
      if (nBot > 0 && pu > 0) {
        next.precio_por_botella = (pu / nBot).toFixed(4)
      }
    }
    // PRIORIDAD 3: Si cambia precio_por_botella, recalcular precio_unitario y costo_total
    else if (patch.precio_por_botella !== undefined) {
      const pb = Number(next.precio_por_botella || 0)
      if (nBot > 0) {
        next.precio_unitario = (pb * nBot).toFixed(2)
        next.costo_total = (Number(next.precio_unitario) * nCant).toFixed(2)
      }
    }
    // PRIORIDAD 4: Si cambia botellas_por_caja, recalcular precio_por_botella basado en precio_unitario
    else if (patch.botellas_por_caja !== undefined) {
      if (nBot > 0 && next.precio_unitario > 0) {
        const pu = Number(next.precio_unitario || 0)
        next.precio_por_botella = (pu / nBot).toFixed(4)
      }
    }
    // PRIORIDAD 5 (Baja): Si cambia costo_total manualmente (fallback), recalcular precio_unitario
    else if (patch.costo_total !== undefined) {
      const total = Number(next.costo_total || 0)
      if (nCant > 0) {
        next.precio_unitario = (total / nCant).toFixed(2)
        if (nBot > 0) {
          next.precio_por_botella = (total / (nCant * nBot)).toFixed(4)
        }
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
    // Si hay proveedor seleccionado, intentar sugerir precio del proveedor para este producto
    try {
      const provId = Number(idProveedor)
      if (provId && producto?.idProducto) {
        const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
        const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
        const url = `${proto}//${host}/api/prestamos/productos/${producto.idProducto}/precios-proveedor?idProveedor=${provId}`
        fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
          .then(r => r.ok ? r.json() : [])
          .then(list => {
            const item = Array.isArray(list) && list[0]
            const precio = item?.precioCompra
            if (precio && !Number.isNaN(Number(precio))) {
              updateDetalle(idx, { precio_unitario: Number(precio).toFixed(2), precio_sugerido: true })
              showToast(`💡 Precio sugerido del proveedor: Bs ${Number(precio).toFixed(2)}`, 'info')
            }
          }).catch(()=>{})
      }
    } catch {}
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
    setValidationMsg('')
    if (!idProveedor) { setValidationMsg('Seleccione un proveedor.'); showToast('Seleccione un proveedor', 'error'); return false }
    if (!idTipoPago) { setValidationMsg('Seleccione un tipo de pago.'); showToast('Seleccione un tipo de pago', 'error'); return false }
    const validRows = detalles.filter(d => Number(d.idProducto) && Number(d.cantidad_caja) > 0 && Number(d.costo_total) > 0)
    if (validRows.length === 0) { setValidationMsg('Agregue al menos un producto con cantidad (>0) y costo total (>0).'); showToast('Agregue al menos un producto con cantidad y costo total', 'error'); return false }
    // Validaciones por fila (primera falla visible)
    for (let i=0; i<detalles.length; i++){
      const d = detalles[i]
      if (!Number(d.idProducto)) { showToast(`Fila ${i+1}: seleccione un producto`, 'error'); return false }
      if (!(Number(d.cantidad_caja) > 0)) { showToast(`Fila ${i+1}: cantidad de cajas debe ser > 0`, 'error'); return false }
      if (!(Number(d.costo_total) > 0)) { showToast(`Fila ${i+1}: costo total debe ser > 0`, 'error'); return false }
      if (d.botellas_por_caja !== '' && d.botellas_por_caja !== null && !(Number(d.botellas_por_caja) > 0)) { showToast(`Fila ${i+1}: botellas por caja debe ser > 0 si se indica`, 'error'); return false }
    }
    for (const f of files) {
      if (!['application/pdf'].includes(f.type) && !f.type.startsWith('image/')) {
        showToast('Solo se permiten imágenes o PDF como comprobantes', 'error')
        return false
      }
    }
    return true
  }

  const handleCreate = async (e) => {
    e?.preventDefault?.()
    if (submitting) return
    if (!validateForm()) {
      return
    }
    setSubmitting(true)
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
            const botellas = d.botellas_por_caja ? Number(d.botellas_por_caja) : null
            const precioBot = d.precio_por_botella
              ? Number(Number(d.precio_por_botella).toFixed(4))
              : (botellas && botellas > 0 ? Number((precioUnit / botellas).toFixed(4)) : null)
          return {
            idProducto: Number(d.idProducto),
            cantidad_caja: cantidad,
            precio_unitario: Number(precioUnit.toFixed(2)),
            subtotal: Number(costoTotal.toFixed(2)),
            fechaVencimiento: d.fechaVencimiento || null,
              botellas_por_caja: botellas,
              precio_por_botella: precioBot
          }
        })
    }
    try {
      if (editingCompraId) {
        // Crear nueva compra y anular la anterior
        const resNew = await fetch(`${API}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
          body: JSON.stringify(payload)
        })
        if (!resNew.ok) {
          const j = await resNew.json().catch(async () => ({ raw: await resNew.text() }))
          throw new Error(j?.detail || j?.raw || `Status ${resNew.status}`)
        }
        const created = await resNew.json()
        const newId = created?.idCompra || created?.id
        if (editingOriginalCompra) {
          const bodyCancel = {
            fechaCompra: editingOriginalCompra.fechaCompra,
            idProveedor: editingOriginalCompra.idProveedor,
            idTipoPago: editingOriginalCompra.idTipoPago,
            montoTotal: 0,
            estado: 0,
            observaciones: `Anulada por edición (reemplazada por compra #${newId})`,
            detalles: []
          }
          await fetch(`${API}/${editingCompraId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
            body: JSON.stringify(bodyCancel)
          }).catch(()=>{})
        }
        await loadCompras()
        resetForm()
        setShowForm(false)
        showToast('Compra editada (nueva compra creada y anterior anulada)', 'success')
        return
      }

      const res = await fetch(`${API}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(userRole ? { 'X-User-Role': userRole } : {}) },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ raw: await res.text() }))
        throw new Error(j?.detail || j?.raw || `Status ${res.status}`)
      }
      const created = await res.json()
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
    } finally {
      setSubmitting(false)
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
      
      {/* Pestañas */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('compras')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'compras'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📦 Compras
          </button>
          <button
            onClick={() => setActiveTab('creditos')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'creditos'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            💳 Créditos Pendientes
            {comprasPendientes.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full">
                {comprasPendientes.length}
              </span>
            )}
          </button>
        </nav>
      </div>
      
      {/* Contenido según tab activa */}
      {activeTab === 'compras' && (<>
      {showForm && (
        <div className="mb-6 p-4 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Fecha</label>
                <input type="date" value={fechaCompra} onChange={e=>setFechaCompra(e.target.value)} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Proveedor</label>
                <select value={idProveedor} onChange={e=>{
                  const val = e.target.value; setIdProveedor(val);
                  // Al cambiar proveedor, si hay producto seleccionado en filas, sugerir precio
                  try {
                    const provId = Number(val)
                    if (provId) {
                      detalles.forEach((d, idx) => {
                        const pid = Number(d.idProducto || 0)
                        if (pid) {
                          const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
                          const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
                          const url = `${proto}//${host}/api/prestamos/productos/${pid}/precios-proveedor?idProveedor=${provId}`
                          fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
                            .then(r => r.ok ? r.json() : [])
                            .then(list => {
                              const item = Array.isArray(list) && list[0]
                              const precio = item?.precioCompra
                              if (precio && !Number.isNaN(Number(precio))) {
                                updateDetalle(idx, { precio_unitario: Number(precio).toFixed(2), precio_sugerido: true })
                              }
                            }).catch(()=>{})
                        }
                      })
                    }
                  } catch {}
                }} className="w-full border rounded px-3 py-2 dark:bg-gray-900 dark:border-gray-700">
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
            {validationMsg && (
              <div className="text-sm text-red-600 dark:text-red-400">{validationMsg}</div>
            )}
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
              {idProveedor && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">💡</span>
                    <div>
                      <div className="font-medium text-blue-900 dark:text-blue-200">Precios por Proveedor</div>
                      <div className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                        Al seleccionar un producto, se sugerirá automáticamente el último precio de compra registrado con este proveedor. 
                        Puede editarlo manualmente según su negociación actual.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto overflow-y-visible">
                <table className="min-w-full text-sm border dark:border-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-left">Cantidad (cajas)</th>
                      <th className="p-2 text-left">Bot/Caja</th>
                      <th className="p-2 text-left">
                        <div>Precio/Caja (Bs)</div>
                        <div className="text-[10px] font-normal text-gray-500">Campo principal</div>
                      </th>
                      <th className="p-2 text-left">Precio/Botella (Bs)</th>
                      <th className="p-2 text-left">
                        <div>Costo Total (Bs)</div>
                        <div className="text-[10px] font-normal text-gray-500">Auto-calculado</div>
                      </th>
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
                          <td className="p-2 min-w-[220px]">
                            <input
                              ref={(el) => { productInputRefs.current[idx] = el }}
                              type="text"
                              value={searchText || (selectedProd ? selectedProd.nombreProducto : '')}
                              onChange={(e) => handleProductSearchChange(idx, e.target.value)}
                              onFocus={() => setShowProductDropdown(prev => ({ ...prev, [idx]: true }))}
                              onBlur={() => setTimeout(() => setShowProductDropdown(prev => ({ ...prev, [idx]: false })), 200)}
                              placeholder="Buscar producto..."
                              className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700"
                            />
                            <ProductDropdownPortal anchorEl={productInputRefs.current[idx]} open={!!showDropdown}>
                              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                                {loadingProductos ? (
                                  <div className="p-2 text-gray-500">Cargando...</div>
                                ) : filteredProds.length > 0 ? (
                                  filteredProds.map(p => (
                                    <div
                                      key={p.idProducto}
                                      onMouseDown={(e) => e.preventDefault()}
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
                                      onMouseDown={(e) => e.preventDefault()}
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
                            </ProductDropdownPortal>
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" step="1" value={d.cantidad_caja} onChange={(e)=>updateDetalle(idx, { cantidad_caja: e.target.value })} className="w-24 border rounded px-2 py-1 text-right dark:bg-gray-900 dark:border-gray-700" placeholder="0" />
                          </td>
                          <td className="p-2">
                            <input type="number" min="1" step="1" placeholder="Bot/caja" value={d.botellas_por_caja} onChange={(e)=>updateDetalle(idx, { botellas_por_caja: e.target.value })} className="w-24 border rounded px-2 py-1 text-right dark:bg-gray-900 dark:border-gray-700" />
                            <div className="text-xs text-gray-500 mt-1">Opcional</div>
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={d.precio_unitario} 
                                onChange={(e)=>updateDetalle(idx, { precio_unitario: e.target.value, precio_sugerido: false })} 
                                className={`w-28 border-2 rounded px-2 py-1 text-right font-semibold ${d.precio_sugerido ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-600' : 'border-blue-500 bg-white dark:bg-gray-900 dark:border-blue-600'}`}
                                placeholder="0.00"
                              />
                              {d.precio_sugerido && (
                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1 rounded-full" title="Precio sugerido del proveedor">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-xs mt-1">
                              {d.precio_sugerido ? (
                                <span className="text-green-600 dark:text-green-400">✓ Sugerido</span>
                              ) : <span className="text-blue-600 dark:text-blue-400">Ingrese aquí</span>}
                            </div>
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
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={d.costo_total} 
                              onChange={(e)=>updateDetalle(idx, { costo_total: e.target.value })} 
                              className="w-32 border rounded px-2 py-1 text-right bg-gray-100 dark:bg-gray-800 dark:border-gray-700" 
                              placeholder="0.00"
                              title="Se calcula automáticamente, pero puede editarse"
                            />
                            <div className="text-xs text-gray-500 mt-1">Auto-calc</div>
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
              <button type="submit" disabled={submitting} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300">{submitting ? 'Guardando...' : 'Guardar compra'}</button>
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
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">ID Producto</label>
              <input
                type="text"
                value={fIdProducto}
                onChange={e=>setFIdProducto(e.target.value)}
                placeholder="ID del producto..."
                className="w-full border rounded px-2 py-1 dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={()=>{ setFDesde(''); setFHasta(''); setFProveedor(''); setFTipoPago(''); setFIdProducto(''); }} className="px-2 py-1 text-sm rounded border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">Limpiar</button>
              <button onClick={()=> setShowCalendar(!showCalendar)} className="px-2 py-1 text-sm rounded border dark:border-gray-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300">
                📅 {showCalendar ? 'Ocultar' : 'Calendario'}
              </button>
            </div>
          </div>

          {/* Calendario de compras */}
          {showCalendar && <CalendarioCompras comprasPorDia={comprasPorDia} onSelectDate={setSelectedDate} selectedDate={selectedDate} loadComprasDelMes={loadComprasDelMes} />}

          {/* Estadísticas resumen con gráficos */}
          {estadisticas && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  Resumen {selectedDate ? `del ${selectedDate}` : (fDesde || fHasta) ? 'del rango seleccionado' : 'general'}
                </h3>
                {/* Botones de periodo rápido */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-600 dark:text-gray-300 mr-1">Periodo:</span>
                  {[
                    {k:'hoy', label:'Hoy'},
                    {k:'semana', label:'Esta semana'},
                    {k:'mes', label:'Este mes'},
                    {k:'', label:'Todo'}
                  ].map(p => (
                    <button key={p.k}
                      onClick={() => {
                        setPeriodo(p.k)
                        const now = new Date()
                        if(p.k==='hoy'){
                          const ds = now.toISOString().slice(0,10)
                          setFDesde(ds); setFHasta(ds)
                        } else if(p.k==='semana'){
                          const day = now.getDay() // 0 dom ... 6 sab
                          const diffToMonday = (day === 0 ? 6 : day-1)
                          const monday = new Date(now); monday.setDate(now.getDate()-diffToMonday)
                          const sunday = new Date(monday); sunday.setDate(monday.getDate()+6)
                          const ds = monday.toISOString().slice(0,10)
                          const hs = sunday.toISOString().slice(0,10)
                          setFDesde(ds); setFHasta(hs)
                        } else if(p.k==='mes'){
                          const y = now.getFullYear(); const m = now.getMonth()
                          const first = new Date(y, m, 1)
                          const last = new Date(y, m+1, 0)
                          const ds = first.toISOString().slice(0,10)
                          const hs = new Date(y, m, last.getDate()).toISOString().slice(0,10)
                          setFDesde(ds); setFHasta(hs)
                        } else {
                          setFDesde(''); setFHasta('')
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${periodo===p.k ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Compras</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatMoney(estadisticas.totalCompras)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Número de Compras</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{estadisticas.numeroCompras}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Promedio por Compra</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatMoney(estadisticas.promedioCompra)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Producto Más Comprado</div>
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

              {/* Gráficos estadísticos */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Gráfico de barras: Compras por día */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">📊</span>
                    Compras por Día
                  </h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={(() => {
                      const grouped = {}
                      compras.forEach(c => {
                        const fecha = c.fechaCompra ? c.fechaCompra.split('T')[0] : 'Sin fecha'
                        if (!grouped[fecha]) grouped[fecha] = { fecha, total: 0, cantidad: 0 }
                        grouped[fecha].total += Number(c.montoTotal || 0)
                        grouped[fecha].cantidad += 1
                      })
                      return Object.values(grouped).sort((a,b) => a.fecha.localeCompare(b.fecha)).slice(-10) // últimos 10 días
                    })()} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.2} />
                      <XAxis 
                        dataKey="fecha" 
                        tick={{fontSize:10, fill:'currentColor'}} 
                        stroke="#6B7280"
                        tickFormatter={(value) => {
                          const [y, m, d] = value.split('-')
                          return `${d}/${m}`
                        }}
                      />
                      <YAxis 
                        tick={{fontSize:10, fill:'currentColor'}} 
                        stroke="#6B7280"
                        width={50}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor:'rgba(31, 41, 55, 0.95)', 
                          border:'1px solid #4B5563', 
                          borderRadius:'8px',
                          color: '#F9FAFB'
                        }}
                        labelStyle={{color:'#F9FAFB', fontWeight: 'bold'}}
                        formatter={(value, name) => {
                          if (name === 'total') return ['Bs ' + Number(value).toFixed(2), 'Monto Total']
                          if (name === 'cantidad') return [value, 'N° Compras']
                          return [value, name]
                        }}
                      />
                      <Legend 
                        wrapperStyle={{fontSize:'11px', paddingTop: '10px'}}
                        iconType="circle"
                      />
                      <Bar dataKey="total" fill="#3B82F6" name="Monto (Bs)" radius={[6,6,0,0]} />
                      <Bar dataKey="cantidad" fill="#10B981" name="Cantidad" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico de pastel: Compras por tipo de pago */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="text-purple-600 dark:text-purple-400">💳</span>
                    Por Tipo de Pago
                  </h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          const grouped = {}
                          compras.forEach(c => {
                            const tipo = c.tipoPago || 'Sin tipo'
                            if (!grouped[tipo]) grouped[tipo] = { name: tipo, value: 0, count: 0 }
                            grouped[tipo].value += Number(c.montoTotal || 0)
                            grouped[tipo].count += 1
                          })
                          return Object.values(grouped).sort((a,b) => b.value - a.value)
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({name, percent}) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={isMobile ? 70 : 90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(() => {
                          // Colores del sistema acordes al tema
                          const COLORS = {
                            'Pago al crédito': '#F59E0B', // amber-500
                            'Pago al credito': '#F59E0B',
                            'Pago al contado': '#10B981', // green-500
                            'Transferencia Bancaria': '#3B82F6', // blue-500
                            'Sin tipo': '#6B7280' // gray-500
                          }
                          const FALLBACK_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316']
                          
                          const grouped = {}
                          compras.forEach(c => {
                            const tipo = c.tipoPago || 'Sin tipo'
                            if (!grouped[tipo]) grouped[tipo] = { name: tipo, value: 0 }
                            grouped[tipo].value += Number(c.montoTotal || 0)
                          })
                          return Object.values(grouped).sort((a,b) => b.value - a.value).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} 
                            />
                          ))
                        })()}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor:'rgba(31, 41, 55, 0.95)', 
                          border:'1px solid #4B5563', 
                          borderRadius:'8px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value, name, props) => {
                          const count = props.payload.count || 0
                          return [`Bs ${Number(value).toFixed(2)} (${count} compras)`, name]
                        }}
                      />
                      <Legend 
                        wrapperStyle={{fontSize:'11px', paddingTop: '10px'}}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico de productos más comprados */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="text-orange-600 dark:text-orange-400">🏆</span>
                    Productos Más Comprados
                  </h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart 
                      data={(() => {
                        const productosMap = {}
                        compras.forEach(c => {
                          if (Array.isArray(c.detalles)) {
                            c.detalles.forEach(d => {
                              const nombre = d.nombreProducto || `Producto ${d.idProducto}`
                              if (!productosMap[nombre]) {
                                productosMap[nombre] = { 
                                  nombre, 
                                  cantidad: 0, 
                                  monto: 0 
                                }
                              }
                              productosMap[nombre].cantidad += Number(d.cantidad_caja || 0)
                              productosMap[nombre].monto += Number(d.subtotal || 0)
                            })
                          }
                        })
                        return Object.values(productosMap)
                          .sort((a,b) => b.cantidad - a.cantidad)
                          .slice(0, 8) // Top 8
                      })()} 
                      layout="vertical"
                      margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.2} />
                      <XAxis type="number" tick={{fontSize:10, fill:'currentColor'}} stroke="#6B7280" />
                      <YAxis 
                        type="category" 
                        dataKey="nombre" 
                        tick={{fontSize:9, fill:'currentColor'}} 
                        stroke="#6B7280"
                        width={100}
                        tickFormatter={(value) => value.length > 15 ? value.slice(0,15) + '...' : value}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor:'rgba(31, 41, 55, 0.95)', 
                          border:'1px solid #4B5563', 
                          borderRadius:'8px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value, name, props) => {
                          if (name === 'cantidad') {
                            const monto = props.payload.monto
                            return [`${value} cajas (Bs ${Number(monto).toFixed(2)})`, 'Cantidad']
                          }
                          return [value, name]
                        }}
                      />
                      <Legend 
                        wrapperStyle={{fontSize:'11px', paddingTop: '10px'}}
                        iconType="circle"
                      />
                      <Bar 
                        dataKey="cantidad" 
                        fill="#F97316" 
                        name="Cajas compradas" 
                        radius={[0,6,6,0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico de proveedores */}
                <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">🏢</span>
                    Por Proveedor
                  </h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          const grouped = {}
                          compras.forEach(c => {
                            const prov = c.nombreProveedor || 'Sin proveedor'
                            if (!grouped[prov]) grouped[prov] = { name: prov, value: 0, count: 0 }
                            grouped[prov].value += Number(c.montoTotal || 0)
                            grouped[prov].count += 1
                          })
                          return Object.values(grouped).sort((a,b) => b.value - a.value).slice(0, 6) // Top 6
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({name, percent}) => percent > 0.08 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={isMobile ? 60 : 80}
                        innerRadius={isMobile ? 30 : 40}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(() => {
                          const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
                          const grouped = {}
                          compras.forEach(c => {
                            const prov = c.nombreProveedor || 'Sin proveedor'
                            if (!grouped[prov]) grouped[prov] = { name: prov, value: 0 }
                            grouped[prov].value += Number(c.montoTotal || 0)
                          })
                          return Object.values(grouped).sort((a,b) => b.value - a.value).slice(0, 6).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))
                        })()}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor:'rgba(31, 41, 55, 0.95)', 
                          border:'1px solid #4B5563', 
                          borderRadius:'8px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value, name, props) => {
                          const count = props.payload.count || 0
                          return [`Bs ${Number(value).toFixed(2)} (${count} compras)`, props.payload.name]
                        }}
                      />
                      <Legend 
                        wrapperStyle={{fontSize:'10px', paddingTop: '10px'}}
                        iconType="circle"
                        formatter={(value) => value.length > 20 ? value.slice(0,20) + '...' : value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border dark:border-gray-700 text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
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
                        <span className={`px-2 py-1 rounded text-xs ${
                          c.estado === 0
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            : (c.idTipoPago === 1
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200')
                        }`}>
                          {c.estado === 0 ? 'Cancelado' : (c.idTipoPago === 1 ? 'Pendiente de pago' : 'Finalizado')}
                        </span>
                      </td>
                      <td className="p-2 align-top text-right whitespace-nowrap">
                        <details className="inline-block mr-2">
                          <summary className="cursor-pointer text-blue-600 hover:underline">Detalles</summary>
                          <div className="mt-2 p-3 rounded border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-left">
                            {Array.isArray(c.detalles) && c.detalles.length > 0 ? (
                              <table className="min-w-[520px] text-xs">
                                <thead>
                                  <tr className="text-gray-600 dark:text-gray-400">
                                    <th className="p-1 text-left">Producto</th>
                                    <th className="p-1 text-right">Cant.</th>
                                    <th className="p-1 text-right">Bot/Caja</th>
                                    <th className="p-1 text-right">C/Botella</th>
                                    <th className="p-1 text-right">C/Caja</th>
                                    <th className="p-1 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.detalles.map(d => (
                                    <tr key={d.idDetalleCompra}>
                                      <td className="p-1">{d.nombreProducto || d.idProducto}</td>
                                      <td className="p-1 text-right">{d.cantidad_caja}</td>
                                      <td className="p-1 text-right">{d.botellas_por_caja ?? '—'}</td>
                                      <td className="p-1 text-right">
                                        {(() => {
                                          const bot = Number(d.botellas_por_caja || 0)
                                          let pb = d?.precio_por_botella
                                          if ((pb === null || pb === undefined) && bot > 0) {
                                            pb = Number(d.precio_unitario || 0) / bot
                                          }
                                          return pb !== null && pb !== undefined && !Number.isNaN(Number(pb))
                                            ? `Bs ${Number(pb).toFixed(4)}`
                                            : '—'
                                        })()}
                                      </td>
                                      <td className="p-1 text-right">{formatMoney(d.precio_paquete ?? d.precio_unitario)}</td>
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
                            <button onClick={()=>openEdit(c)} className="px-2 py-1 text-xs rounded border dark:border-gray-700 mr-2">Editar estado/obs</button>
                            <button onClick={()=>startEditDetalles(c)} className="px-2 py-1 text-xs rounded border dark:border-gray-700 mr-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/50">Editar detalles</button>
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
                                    <th className="p-2 text-left">Código</th>
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
                                      <td className="p-2"><span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">{lote.codigoLote || `#${lote.idLote}`}</span></td>
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
                    <span className={`px-2 py-1 rounded text-xs ${
                      c.estado === 0
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                        : (c.idTipoPago === 1
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200')
                    }`}>
                      {c.estado === 0 ? 'Cancelado' : (c.idTipoPago === 1 ? 'Pendiente de pago' : 'Finalizado')}
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
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <span>Cant.: {d.cantidad_caja}</span>
                            <span>C/Caja: {formatMoney(d.precio_paquete ?? d.precio_unitario)}</span>
                            <span>Bot/Caja: {d.botellas_por_caja ?? '—'}</span>
                            <span>
                              C/Botella: {(() => {
                                const bot = Number(d.botellas_por_caja || 0)
                                let pb = d?.precio_por_botella
                                if ((pb === null || pb === undefined) && bot > 0) {
                                  pb = Number(d.precio_unitario || 0) / bot
                                }
                                return pb !== null && pb !== undefined && !Number.isNaN(Number(pb))
                                  ? `Bs ${Number(pb).toFixed(4)}`
                                  : '—'
                              })()}
                            </span>
                            <span className="col-span-2 font-bold">Subtotal: {formatMoney(d.subtotal)}</span>
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
                            <div className="font-semibold text-indigo-900 dark:text-indigo-200">{lote.codigoLote || `Lote #${lote.idLote}`}</div>
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
                  <option value={1}>Finalizado</option>
                  <option value={0}>Cancelado</option>
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
      </>)}
      
      {/* Tab de Créditos Pendientes */}
      {activeTab === 'creditos' && (
        <div className="space-y-4">
          {loadingPendientes ? (
            <div className="text-center py-8 text-gray-500">Cargando compras pendientes...</div>
          ) : comprasPendientes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">No hay compras pendientes de pago</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comprasPendientes.map(compra => {
                const total = Number(compra.total || 0)
                const pagado = Number(compra.montoPagado || 0)
                const pendiente = total - pagado
                const progreso = total > 0 ? (pagado / total) * 100 : 0
                
                return (
                  <div key={compra.idCompra} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            Compra #{compra.idCompra}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            compra.estado_pago === 'Pagado' 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : compra.estado_pago === 'Parcial'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                          }`}>
                            {compra.estado_pago || 'Pendiente'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div><strong>Proveedor:</strong> {compra.nombreProveedor}</div>
                          <div><strong>Fecha:</strong> {compra.fechaCompra}</div>
                          <div><strong>Empresa:</strong> {compra.nombreEmpresa}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => openPagoModal(compra)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm transition-colors"
                      >
                        💳 Registrar Pago
                      </button>
                    </div>
                    
                    {/* Barra de progreso */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-gray-600 dark:text-gray-400">Pagado: Bs. {pagado.toFixed(2)}</span>
                        <span className="text-orange-600 dark:text-orange-400">Pendiente: Bs. {pendiente.toFixed(2)}</span>
                      </div>
                      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>0%</span>
                        <span className="font-bold">{progreso.toFixed(1)}% pagado</span>
                        <span>100%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          Total: Bs. {total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Modal de Registro de Pago */}
      {pagoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Pagos de Compra #{pagoModal.compra.idCompra}
              </h3>
              <button
                onClick={() => setPagoModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Información de la compra */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Proveedor:</strong> {pagoModal.compra.nombreProveedor}</div>
                  <div><strong>Fecha:</strong> {pagoModal.compra.fechaCompra}</div>
                  <div><strong>Total:</strong> Bs. {Number(pagoModal.compra.total).toFixed(2)}</div>
                  <div><strong>Pagado:</strong> Bs. {Number(pagoModal.compra.montoPagado || 0).toFixed(2)}</div>
                </div>
                <div className="pt-2 border-t dark:border-gray-700">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    Saldo Pendiente: Bs. {(Number(pagoModal.compra.total) - Number(pagoModal.compra.montoPagado || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
              
              {/* Formulario de nuevo pago */}
              <div className="border dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Registrar Nuevo Pago</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Monto (Bs.)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={Number(pagoModal.compra.total) - Number(pagoModal.compra.montoPagado || 0)}
                      value={nuevoPago.monto}
                      onChange={e => setNuevoPago(p => ({ ...p, monto: e.target.value }))}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={nuevoPago.fecha}
                      onChange={e => setNuevoPago(p => ({ ...p, fecha: e.target.value }))}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Observaciones (Opcional)
                    </label>
                    <textarea
                      value={nuevoPago.observaciones}
                      onChange={e => setNuevoPago(p => ({ ...p, observaciones: e.target.value }))}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-900"
                      rows="2"
                      placeholder="Detalles del pago..."
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setNuevoPago({ monto: '', fecha: new Date().toISOString().slice(0,10), observaciones: '' })}
                    className="px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleRegistrarPago}
                    disabled={submittingPago}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 font-medium"
                  >
                    {submittingPago ? 'Guardando...' : '✓ Registrar Pago'}
                  </button>
                </div>
              </div>
              
              {/* Historial de pagos */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Historial de Pagos</h4>
                {loadingPagos ? (
                  <div className="text-center py-4 text-gray-500">Cargando...</div>
                ) : pagoModal.pagos.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No hay pagos registrados</div>
                ) : (
                  <div className="space-y-2">
                    {pagoModal.pagos.map((pago, idx) => (
                      <div key={idx} className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            Bs. {Number(pago.monto).toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {pago.fecha}
                          </div>
                          {pago.observaciones && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {pago.observaciones}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(pago.created_at).toLocaleString('es-BO')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Calendario
function CalendarioCompras({ comprasPorDia, onSelectDate, selectedDate, loadComprasDelMes }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  // Cargar compras del mes cuando cambie el mes o al montar el componente
  useEffect(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    if (loadComprasDelMes) {
      loadComprasDelMes(year, month)
    }
  }, [currentMonth, loadComprasDelMes])
  
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


