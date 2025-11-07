import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { useToast } from '../ToastContext'
import { designSystem, getButtonClass, getInputClass, getBadgeClass } from '../design-system'

export default function Productos({ API, userRole = 'admin', permissions = [], clienteInfo = null }) {
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const toast = useToast()
  const [productos, setProductos] = useState([])
  const [filteredProductos, setFilteredProductos] = useState([])
  const [tipos, setTipos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterIdProducto, setFilterIdProducto] = useState('')
  const [filterProveedor, setFilterProveedor] = useState('')
  const [showPrecios, setShowPrecios] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [previewImage, setPreviewImage] = useState(null)
  const [showUSD, setShowUSD] = useState(false) // Toggle para mostrar USD
  const TASA_CAMBIO = 6.96 // 1 USD = 6.96 Bs (Bolivia)
  const [tasaCambio, setTasaCambio] = useState(6.96) // Tasa dinámica desde API
  const [removeBg, setRemoveBg] = useState(false) // Opción para remover fondo localmente
  const [lotesPorProducto, setLotesPorProducto] = useState({});
  const [showCreateLote, setShowCreateLote] = useState({}); // { [idProducto]: true/false }
  const [createLoteForm, setCreateLoteForm] = useState({}); // { [idProducto]: { idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas } }
  const [lotesModalProductId, setLotesModalProductId] = useState(null); // producto para modal
  const [editingLoteId, setEditingLoteId] = useState(null) // ID del lote siendo editado
  const [editLotePrices, setEditLotePrices] = useState({}) // { minorista, mayorista, especial }
  const [selectedLoteId, setSelectedLoteId] = useState({}) // { [idProducto]: idLote } - lote seleccionado por producto
  // Cargar/alternar lotes para un producto
  const loadLotesForProducto = async (idProducto) => {
    // Alternar: si ya están cargados, ocultar
    if (lotesPorProducto[idProducto]) {
      setLotesPorProducto(prev => {
        const next = { ...prev }
        delete next[idProducto]
        return next
      })
      return
    }
    try {
      const url = `${API}/lotes?idProducto=${encodeURIComponent(idProducto)}`
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} });
      if (!res.ok) throw new Error('No se pudieron cargar los lotes');
      const data = await res.json();
      setLotesPorProducto(prev => ({ ...prev, [idProducto]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      toast.push('Error al cargar lotes: ' + e.message, 'error');
    }
  };

  // Abrir modal (cargar si no está cargado)
  const openLotesModal = async (idProducto) => {
    if (!lotesPorProducto[idProducto]) {
      await loadLotesForProducto(idProducto)
    }
    setLotesModalProductId(idProducto)
  }
  const closeLotesModal = () => setLotesModalProductId(null)

  // Crear lote para un producto
  const handleCreateLote = async (idProducto) => {
    const f = createLoteForm[idProducto] || {}
    // Validación mínima
    if (!f || !f.fechaCompra || !f.precioCompra || !f.cantidadCajas) {
      toast.push('Complete fecha de compra, precio y cantidad', 'error')
      return
    }
    try {
      const fd = new FormData()
      fd.append('idProducto', String(idProducto))
      if (f.idProveedor) fd.append('idProveedor', String(f.idProveedor))
      fd.append('fechaCompra', f.fechaCompra)
      if (f.fechaVencimiento) fd.append('fechaVencimiento', f.fechaVencimiento)
      fd.append('precioCompra', String(f.precioCompra))
      fd.append('cantidadCajas', String(f.cantidadCajas))
      
      // Agregar precios de venta si fueron proporcionados
      if (f.precio_minorista) fd.append('precio_minorista', String(f.precio_minorista))
      if (f.precio_mayorista) fd.append('precio_mayorista', String(f.precio_mayorista))
      if (f.precio_especial) fd.append('precio_especial', String(f.precio_especial))
      
      const res = await fetch(`${API}/lotes`, {
        method: 'POST',
        credentials: 'include',
        headers: userRole ? { 'X-User-Role': userRole } : {},
        body: fd
      })
      if (!res.ok) {
        const t = await res.text().catch(()=> '')
        throw new Error(t || `HTTP ${res.status}`)
      }
      toast.push('Lote creado', 'success')
      // Refrescar lista de lotes
      await loadLotesForProducto(idProducto)
      // Limpiar formulario y ocultar
      setCreateLoteForm(prev => ({ ...prev, [idProducto]: undefined }))
      setShowCreateLote(prev => ({ ...prev, [idProducto]: false }))
    } catch (e) {
      console.error(e)
      toast.push('No se pudo crear el lote: ' + e.message, 'error')
    }
  }

  // Guardar precios editados de un lote
  const handleSaveLotePrices = async (idLote) => {
    try {
      const prices = editLotePrices
      if (!prices.minorista && !prices.mayorista && !prices.especial) {
        toast.push('Ingrese al menos un precio', 'error')
        return
      }
      const fd = new FormData()
      if (prices.minorista) fd.append('precio_minorista', String(prices.minorista))
      if (prices.mayorista) fd.append('precio_mayorista', String(prices.mayorista))
      if (prices.especial) fd.append('precio_especial', String(prices.especial))
      
      const res = await fetch(`${API}/lotes/${idLote}`, {
        method: 'PUT',
        credentials: 'include',
        headers: userRole ? { 'X-User-Role': userRole } : {},
        body: fd
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.push('Precios del lote actualizados', 'success')
      setEditingLoteId(null)
      setEditLotePrices({})
      
      // Refrescar lotes: buscar el idProducto del lote editado
      const loteEditado = Object.values(lotesPorProducto)
        .flat()
        .find(l => l.idLote === idLote)
      
      if (loteEditado && loteEditado.idProducto) {
        const url = `${API}/lotes?idProducto=${encodeURIComponent(loteEditado.idProducto)}`
        const r2 = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
        if (r2.ok) {
          const data = await r2.json()
          setLotesPorProducto(prev => ({ ...prev, [loteEditado.idProducto]: Array.isArray(data) ? data : [] }))
        }
      }
      
      // Tambi�n refrescar si hay modal abierto
      if (lotesModalProductId) {
        const url = `${API}/lotes?idProducto=${encodeURIComponent(lotesModalProductId)}`
        const r2 = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
        if (r2.ok) {
          const data = await r2.json()
          setLotesPorProducto(prev => ({ ...prev, [lotesModalProductId]: Array.isArray(data) ? data : [] }))
        }
      }
    } catch (e) {
      console.error(e)
      toast.push('No se pudo actualizar: ' + e.message, 'error')
    }
  }

  const [form, setForm] = useState({
    nombreProducto: '',
    imagen_producto: null,
    stockCaja: 0,
    idEmpresa: '',
    idTipoBotella: '',
    idProveedor: '',
    precios: {
      minorista: '',
      mayorista: '',
      especial: ''
    }
  })

  // Validaciones avanzadas
  const validateForm = () => {
    const errors = {}
    
    // Validar nombre del producto
    if (!form.nombreProducto.trim()) {
      errors.nombreProducto = 'El nombre del producto es obligatorio'
    } else if (form.nombreProducto.trim().length < 2) {
      errors.nombreProducto = 'El nombre debe tener al menos 2 caracteres'
    } else if (form.nombreProducto.trim().length > 100) {
      errors.nombreProducto = 'El nombre no puede tener m�s de 100 caracteres'
    } else if (!/^[a-zA-Z������������0-9\s\-_.,()]+$/.test(form.nombreProducto.trim())) {
      errors.nombreProducto = 'El nombre contiene caracteres no v�lidos'
    }
    
    // Validar duplicados de nombre (solo si no estamos editando)
    if (!editingId) {
      const nombreExistente = productos.find(p => 
        p.nombreProducto.toLowerCase() === form.nombreProducto.trim().toLowerCase()
      )
      if (nombreExistente) {
        errors.nombreProducto = 'Ya existe un producto con este nombre'
      }
    }
    
    // Validar stock
    if (form.stockCaja < 0) {
      errors.stockCaja = 'El stock no puede ser negativo'
    } else if (form.stockCaja > 999999) {
      errors.stockCaja = 'El stock es demasiado alto'
    }
    
    // Validar tipo de botella
    if (!form.idTipoBotella) {
      errors.idTipoBotella = 'Debe seleccionar un tipo de botella'
    }
    
    // Validar empresa (solo para superadmin)
    if (userRole === 'superadmin' && !form.idEmpresa) {
      errors.idEmpresa = 'Debe seleccionar una empresa'
    }
    
    // Validar precios
    const precios = ['minorista', 'mayorista', 'especial']
    const preciosNumericos = {}
    
    precios.forEach(tipo => {
      const precio = form.precios[tipo]
      if (precio && precio.trim()) {
        const num = parseFloat(precio)
        if (isNaN(num) || num < 0) {
          errors[`precio_${tipo}`] = `El precio ${tipo} debe ser un n�mero v�lido mayor o igual a 0`
        } else if (num > 999999.99) {
          errors[`precio_${tipo}`] = `El precio ${tipo} es demasiado alto`
        } else {
          preciosNumericos[tipo] = num
        }
      }
    })
    
    // Validar l�gica de precios (mayorista < minorista)
    if (preciosNumericos.mayorista && preciosNumericos.minorista && 
        preciosNumericos.mayorista >= preciosNumericos.minorista) {
      errors.precio_mayorista = 'El precio mayorista debe ser menor al precio minorista'
    }
    
    // Validar imagen (si se proporciona)
    if (form.imagen_producto) {
      const file = form.imagen_producto
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        errors.imagen_producto = 'Solo se permiten im�genes (JPG, PNG, GIF, WebP)'
      } else if (file.size > 5 * 1024 * 1024) { // 5MB
        errors.imagen_producto = 'La imagen no puede ser mayor a 5MB'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Limpiar errores de validaci�n cuando cambie el campo
  const clearFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  // Filtrado y b�squeda
  React.useEffect(() => {
    const t = setTimeout(() => {
      const q = (searchQ || '').trim().toLowerCase()
      const idQ = (filterIdProducto || '').trim()
      const list = productos.filter(p => {
        const inTipo = filterTipo ? String(p.idTipoBotella) === filterTipo : true
        if (!inTipo) return false

        // Filtro por ID de producto (coincidencia exacta o parcial)
        if (idQ && !String(p.idProducto).includes(idQ)) return false

        // Filtro por proveedor
        if (filterProveedor && String(p.idProveedor) !== filterProveedor) return false

        if (!q) return true
        const nombre = (p.nombreProducto || '').toLowerCase()
        const tipoNombre = (p.tipoBotella || '').toLowerCase()
        
        const text = [nombre, tipoNombre].join(' ')
        return text.includes(q)
      })
      setFilteredProductos(list)
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, filterTipo, filterIdProducto, filterProveedor, productos])

  const loadProductos = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch(`${API}/productos`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          // Sesi�n expirada, recargar p�gina para ir al login
          window.location.reload()
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      
      const data = await res.json()
      setProductos(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading productos:', err)
      setError('Error cargando productos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTipos = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch(`${API}/tipobotellas`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (res.ok) {
        const data = await res.json()
        setTipos(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading tipos:', err)
    }
  }

  const loadEmpresas = async () => {
    if (userRole !== 'superadmin') return setEmpresas([])
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch(`${API}/empresas`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (res.ok) {
        const data = await res.json()
        setEmpresas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading empresas:', err)
    }
  }

  const loadProveedores = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch('http://localhost:8001/api/proveedores', {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (res.ok) {
        const data = await res.json()
        setProveedores(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading proveedores:', err)
      setProveedores([])
    }
  }

  const loadTasaCambio = async () => {
    try {
      // Intentar primero con exchangerate.host (m�s actualizado y confiable)
      let res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=BOB')
      if (res.ok) {
        const data = await res.json()
        if (data.rates && data.rates.BOB) {
          setTasaCambio(data.rates.BOB)
          console.log(`💵 Tasa de cambio USD/BOB actualizada: 1 USD = ${data.rates.BOB} BOB (exchangerate.host)`)
          return
        }
      }
      
      // Fallback a exchangerate-api.com
      res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      if (res.ok) {
        const data = await res.json()
        if (data.rates && data.rates.BOB) {
          setTasaCambio(data.rates.BOB)
          console.log(`💵 Tasa de cambio USD/BOB actualizada: 1 USD = ${data.rates.BOB} BOB (exchangerate-api.com)`)
          return
        }
      }
      
      // Si ambas fallan, usar tasa fija
      console.warn('⚠️ No se pudo obtener tasa de cambio de APIs externas, usando tasa fija 6.96')
      setTasaCambio(6.96)
    } catch (err) {
      console.error('Error loading tasa de cambio:', err)
      setTasaCambio(6.96) // Fallback
    }
  }

  useEffect(() => {
    loadProductos()
    loadTipos()
    loadEmpresas()
    loadProveedores()
    loadTasaCambio()
  }, [API, userRole])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Validaci�n avanzada
    if (!validateForm()) {
      setError('Por favor corrige los errores en el formulario')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('nombreProducto', form.nombreProducto.trim())
      formData.append('stockCaja', parseInt(form.stockCaja) || 0)
      formData.append('idTipoBotella', parseInt(form.idTipoBotella))
      
      if (userRole === 'superadmin' && form.idEmpresa) {
        formData.append('idEmpresa', parseInt(form.idEmpresa))
      }
      
      if (form.imagen_producto) {
        formData.append('imagen_producto', form.imagen_producto)
      }

      // Agregar precios
      if (form.precios.minorista) formData.append('precio_minorista', parseFloat(form.precios.minorista))
      if (form.precios.mayorista) formData.append('precio_mayorista', parseFloat(form.precios.mayorista))
      if (form.precios.especial) formData.append('precio_especial', parseFloat(form.precios.especial))

      const headers = {}
      if (userRole) headers['X-User-Role'] = userRole
      // No establecer Content-Type para FormData - el navegador lo hace autom�ticamente

      const url = editingId ? `${API}/productos/${editingId}` : `${API}/productos`
      const method = editingId ? 'PUT' : 'POST'

      console.log(`${method} ${url}`, { editingId, formData: Object.fromEntries(formData) }) // Debug

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: formData
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

  await loadProductos()
  resetForm()
  toast.push(editingId ? 'Producto actualizado' : 'Producto creado', 'success')
    } catch (err) {
      console.error('Error saving producto:', err)
      setError('Error guardando: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Manejar cambio de imagen con previsualizaci�n
  const handleImageChange = (e) => {
    const file = e.target.files[0]
    setForm({ ...form, imagen_producto: file })
    clearFieldError('imagen_producto')
    
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setPreviewImage(e.target.result)
      reader.readAsDataURL(file)
    } else {
      setPreviewImage(null)
    }
  }

  // Funci�n simple para hacer el fondo m�s transparente (simulaci�n b�sica)
  const removeBackground = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // Algoritmo simple: hacer p�xeles blancos/claros transparentes
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          
          // Si el p�xel es muy claro (cercano a blanco), hacerlo transparente
          const brightness = (r + g + b) / 3
          if (brightness > 240) {
            data[i + 3] = 0 // Alpha = 0 (transparente)
          } else if (brightness > 200) {
            data[i + 3] = Math.floor(data[i + 3] * 0.3) // Semi-transparente
          }
        }
        
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = imageDataUrl
    })
  }

  const handleImageChangeWithBgRemoval = async (e) => {
    const file = e.target.files[0]
    if (!file) {
      setForm({ ...form, imagen_producto: null })
      setPreviewImage(null)
      return
    }

    clearFieldError('imagen_producto')
    
    if (removeBg) {
      // Leer archivo y procesar
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          // Remover fondo (algoritmo simple)
          const processedDataUrl = await removeBackground(event.target.result)
          setPreviewImage(processedDataUrl)
          
          // Convertir dataURL a File
          const response = await fetch(processedDataUrl)
          const blob = await response.blob()
          const processedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.png'), { type: 'image/png' })
          setForm({ ...form, imagen_producto: processedFile })
        } catch (err) {
          console.error('Error procesando imagen:', err)
          setPreviewImage(event.target.result)
          setForm({ ...form, imagen_producto: file })
        }
      }
      reader.readAsDataURL(file)
    } else {
      // Sin remover fondo
      setForm({ ...form, imagen_producto: file })
      const reader = new FileReader()
      reader.onload = (e) => setPreviewImage(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  const resetForm = () => {
    setForm({
      nombreProducto: '',
      imagen_producto: null,
      stockCaja: 0,
      idEmpresa: '',
      idTipoBotella: '',
      idProveedor: '',
      precios: {
        minorista: '',
        mayorista: '',
        especial: ''
      }
    })
    setEditingId(null)
    setShowCreate(false)
    setError(null)
    setValidationErrors({})
    setPreviewImage(null)
  }

  const startEdit = (producto) => {
    // Permiso: admin, editor o superadmin (el backend valida empresa)
    if (!(['admin','editor','superadmin'].includes(userRole))) {
      toast.push('Solo administradores o editores pueden editar productos', 'error')
      return
    }
    
    setForm({
      nombreProducto: producto.nombreProducto || '',
      imagen_producto: null,
      stockCaja: producto.stockCaja || 0,
      idEmpresa: producto.idEmpresa ? String(producto.idEmpresa) : '',
      idTipoBotella: producto.idTipoBotella ? String(producto.idTipoBotella) : '',
      idProveedor: producto.idProveedor ? String(producto.idProveedor) : '',
      precios: {
        minorista: (producto.precio_minorista ?? ''),
        mayorista: (producto.precio_mayorista ?? ''),
        especial: (producto.precio_especial ?? '')
      }
    })
    setEditingId(producto.idProducto)
    setShowCreate(true)
    setError(null)
    setPreviewImage(producto.imagen_producto ? `${API}${producto.imagen_producto}` : null)
  }

  const deleteProducto = async (id) => {
    if (!confirm('�Est� seguro de eliminar este producto? Esta acci�n no se puede deshacer.')) return
    
    try {
      const headers = {}
      if (userRole) headers['X-User-Role'] = userRole

      console.log(`🗑️ Eliminando producto ${id} con rol: ${userRole}`) // Debug

      const res = await fetch(`${API}/productos/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        console.error('Error del servidor:', errorData)
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

      const result = await res.json()
      console.log('? Producto eliminado:', result)
      
  await loadProductos()
  toast.push('Producto eliminado correctamente', 'success')
    } catch (err) {
  console.error('Error deleting producto:', err)
  toast.push('Error al eliminar: ' + err.message, 'error')
    }
  }

  const togglePrecios = (productoId) => {
    setShowPrecios(showPrecios === productoId ? null : productoId)
  }

  // Funci�n para formatear precios con conversi�n a USD
  const formatPrecio = (precio) => {
    if (!precio) return 'N/A'
    const precioNum = parseFloat(precio)
    if (showUSD) {
      const precioUSD = precioNum / tasaCambio
      return `$us ${precioUSD.toFixed(2)}`
    }
    return `Bs ${precioNum.toFixed(2)}`
  }

  const toggleMoneda = () => {
    setShowUSD(!showUSD)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Vista especial para clientes
  if (userRole === 'cliente') {
    const tipoCliente = clienteInfo?.tipo_cliente || 'minorista'
    
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Cat�logo de Productos
          </h2>
          <div className="flex items-center mt-2 space-x-4">
            <span className="text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full">
              Cliente {tipoCliente.charAt(0).toUpperCase() + tipoCliente.slice(1)}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {filteredProductos.length} productos disponibles
            </span>
          </div>
        </div>

        {/* Filtros simples para clientes */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">Todos los tipos</option>
              {tipos.map((tipo) => (
                <option key={tipo.idTipoBotella} value={tipo.idTipoBotella}>
                  {tipo.tipoBotella}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
            {error}
          </div>
        )}

        {/* Cat�logo de productos para clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProductos.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">📦</div>
              <p>No se encontraron productos</p>
            </div>
          ) : (
            filteredProductos.map((producto) => {
              // Determinar precio seg�n tipo de cliente
              let precio = null
              let tipoPrecio = ''
              
              if (tipoCliente === 'mayorista' && producto.precio_mayorista) {
                precio = producto.precio_mayorista
                tipoPrecio = 'Mayorista'
              } else if (tipoCliente === 'especial' && producto.precio_especial) {
                precio = producto.precio_especial
                tipoPrecio = 'Especial'
              } else if (producto.precio_minorista) {
                precio = producto.precio_minorista
                tipoPrecio = 'Minorista'
              }

              return (
                <div key={producto.idProducto} className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  {/* Imagen del producto */}
                  <div className="h-64 bg-white dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                    {producto.imagen_producto ? (
                      <img
                        src={`${API}${producto.imagen_producto}`}
                        alt={producto.nombreProducto}
                        className="max-h-full w-auto object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextElementSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500"
                      style={{ display: producto.imagen_producto ? 'none' : 'flex' }}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-2">🖼️</div>
                        <div className="text-sm">Sin imagen</div>
                      </div>
                    </div>
                  </div>

                  {/* Informaci�n del producto */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                      {producto.nombreProducto}
                    </h3>
                    
                    {/* Proveedor y Stock */}
                    <div className="space-y-2 mb-3">
                      {producto.nombreProveedor && (
                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="truncate">Prov: {producto.nombreProveedor}</span>
                        </div>
                      )}
                      
                      {producto.fecha_vencimiento_proxima && (
                        <div className={`flex items-center text-xs ${
                          new Date(producto.fecha_vencimiento_proxima) < new Date(Date.now() + 30*24*60*60*1000)
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Vence: {new Date(producto.fecha_vencimiento_proxima).toLocaleDateString('es-BO')}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span>Stock: {producto.stockCaja || 0} cajas</span>
                      </div>
                      
                      <div className="flex items-center text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300 w-fit">
                        {producto.tipoBotella || 'Sin tipo'}
                      </div>
                    </div>

                    {/* Precio */}
                    {precio ? (
                      <div className="mb-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatPrecio(precio)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {tipoPrecio}
                          </span>
                        </div>
                        {showUSD && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            � Bs {parseFloat(precio).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Precio no disponible
                        </span>
                      </div>
                    )}

                    {/* Bot�n de acci�n */}
                    <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 hover:shadow-md">
                      Ver Detalles
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Productos ({filteredProductos.length})
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
          {/* Toggle de moneda */}
          <button
            onClick={toggleMoneda}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            title={showUSD ? 'Mostrar en Bolivianos' : 'Mostrar en D�lares'}
          >
            <span className="text-lg">{showUSD ? '$us' : 'Bs'}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
            {showUSD && (
              <span className="text-xs opacity-90">1$ = {tasaCambio.toFixed(2)} Bs</span>
            )}
          </button>
          {has('productos', 'create') && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className={designSystem.typography.label + ' block mb-1'}>
            Buscar
          </label>
          <input
            type="text"
            placeholder="Nombre del producto..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className={getInputClass()}
          />
        </div>
        <div>
          <label className={designSystem.typography.label + ' block mb-1'}>
            ID Producto
          </label>
          <input
            type="text"
            placeholder="Buscar por ID..."
            value={filterIdProducto}
            onChange={(e) => setFilterIdProducto(e.target.value)}
            className={getInputClass()}
          />
        </div>
        <div>
          <label className={designSystem.typography.label + ' block mb-1'}>
            Tipo de Botella
          </label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className={getInputClass()}
          >
            <option value="">Todos</option>
            {tipos.map((tipo) => (
              <option key={tipo.idTipoBotella} value={tipo.idTipoBotella}>
                {tipo.tipoBotella}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={designSystem.typography.label + ' block mb-1'}>
            Proveedor
          </label>
          <select
            value={filterProveedor}
            onChange={(e) => setFilterProveedor(e.target.value)}
            className={getInputClass()}
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((prov) => (
              <option key={prov.idProveedor} value={prov.idProveedor}>
                {prov.nombreProveedor || prov.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          {error}
        </div>
      )}

      {/* Formulario Avanzado */}
      {showCreate && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ?
            </button>
          </div>
          
          <form onSubmit={submit} className="space-y-6">
            {/* Informaci�n b�sica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={form.nombreProducto}
                  onChange={(e) => {
                    setForm({ ...form, nombreProducto: e.target.value })
                    clearFieldError('nombreProducto')
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                    validationErrors.nombreProducto 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Ej: Coca Cola 500ml"
                />
                {validationErrors.nombreProducto && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.nombreProducto}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stock Inicial (Cajas)
                </label>
                <input
                  type="number"
                  min="0"
                  max="999999"
                  value={form.stockCaja}
                  onChange={(e) => {
                    setForm({ ...form, stockCaja: e.target.value })
                    clearFieldError('stockCaja')
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                    validationErrors.stockCaja 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="0"
                />
                {validationErrors.stockCaja && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.stockCaja}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Botella *
                </label>
                <select
                  value={form.idTipoBotella}
                  onChange={(e) => {
                    setForm({ ...form, idTipoBotella: e.target.value })
                    clearFieldError('idTipoBotella')
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                    validationErrors.idTipoBotella 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Seleccionar tipo de botella</option>
                  {tipos.map((tipo) => (
                    <option key={tipo.idTipoBotella} value={tipo.idTipoBotella}>
                      {tipo.tipoBotella}
                    </option>
                  ))}
                </select>
                {validationErrors.idTipoBotella && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.idTipoBotella}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proveedor
                </label>
                <select
                  value={form.idProveedor}
                  onChange={(e) => {
                    setForm({ ...form, idProveedor: e.target.value })
                    clearFieldError('idProveedor')
                  }}
                  disabled
                  title="El proveedor se define por lote de compra"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                    validationErrors.idProveedor 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  } opacity-70 cursor-not-allowed`}
                >
                  <option value="">El proveedor se asigna al crear un lote</option>
                  {proveedores.map((prov) => (
                    <option key={prov.idProveedor} value={prov.idProveedor}>
                      {prov.nombreProveedor || prov.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Nota: el proveedor est� ligado a cada lote de compra, no al producto en s�.
                </p>
              </div>
              
              {userRole === 'superadmin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Empresa *
                  </label>
                  <select
                    value={form.idEmpresa}
                    onChange={(e) => {
                      setForm({ ...form, idEmpresa: e.target.value })
                      clearFieldError('idEmpresa')
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                      validationErrors.idEmpresa 
                        ? 'border-red-500 dark:border-red-400' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">Seleccionar empresa</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id_empresa} value={empresa.id_empresa}>
                        {empresa.nombre_empresa}
                      </option>
                    ))}
                  </select>
                  {validationErrors.idEmpresa && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.idEmpresa}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* Imagen del producto */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Imagen del Producto
              </label>
              
              {/* Checkbox para remover fondo */}
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  id="removeBg"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="removeBg" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  ✂️ Remover fondo autom�ticamente (solo fondos blancos/claros)
                </label>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageChangeWithBgRemoval}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                      validationErrors.imagen_producto 
                        ? 'border-red-500 dark:border-red-400' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Formatos: JPG, PNG, GIF, WebP. M�ximo 5MB
                    {removeBg && <span className="text-blue-600 dark:text-blue-400"> � Procesando con remoci�n de fondo</span>}
                  </p>
                  {validationErrors.imagen_producto && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.imagen_producto}</p>
                  )}
                </div>
                
                {/* Previsualizaci�n */}
                {previewImage && (
                  <div className="w-24 h-24 border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-700 bg-checkered">
                    <img 
                      src={previewImage} 
                      alt="Vista previa" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Configuraci�n de precios con validaciones */
            }
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                  Configuraci�n de Precios
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  (Opcionales - Mayorista debe ser menor que Minorista)
                </span>
              </div>
              {editingId && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-3 py-2 rounded">
                  Puede configurar precios manuales aqu�. Si los deja en blanco, el sistema usar� los precios calculados a partir de los lotes y m�rgenes.
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    🛒 Precio Minorista
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      Bs.
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="999999.99"
                      value={form.precios.minorista}
                      onChange={(e) => {
                        setForm({ ...form, precios: { ...form.precios, minorista: e.target.value } })
                        clearFieldError('precio_minorista')
                      }}
                      className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                        validationErrors.precio_minorista 
                          ? 'border-red-500 dark:border-red-400' 
                          : 'border-gray-300 dark:border-gray-600'
                        }`}
                      placeholder="0.00"
                    />
                  </div>
                  {validationErrors.precio_minorista && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.precio_minorista}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    🏪 Precio Mayorista
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      Bs.
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="999999.99"
                      value={form.precios.mayorista}
                      onChange={(e) => {
                        setForm({ ...form, precios: { ...form.precios, mayorista: e.target.value } })
                        clearFieldError('precio_mayorista')
                      }}
                      className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                        validationErrors.precio_mayorista 
                          ? 'border-red-500 dark:border-red-400' 
                          : 'border-gray-300 dark:border-gray-600'
                        }`}
                      placeholder="0.00"
                    />
                  </div>
                  {validationErrors.precio_mayorista && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.precio_mayorista}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ? Precio Especial
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                      Bs.
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="999999.99"
                      value={form.precios.especial}
                      onChange={(e) => {
                        setForm({ ...form, precios: { ...form.precios, especial: e.target.value } })
                        clearFieldError('precio_especial')
                      }}
                      className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                        validationErrors.precio_especial 
                          ? 'border-red-500 dark:border-red-400' 
                          : 'border-gray-300 dark:border-gray-600'
                        }`}
                      placeholder="0.00"
                    />
                  </div>
                  {validationErrors.precio_especial && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.precio_especial}</p>
                  )}
                </div>
              </div>
              
              {/* Indicador visual de precios */}
              {(form.precios.minorista || form.precios.mayorista || form.precios.especial) && (
                <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💰 <strong>Resumen de precios:</strong>
                    {form.precios.minorista && ` Minorista: Bs. ${form.precios.minorista}`}
                    {form.precios.mayorista && ` | Mayorista: Bs. ${form.precios.mayorista}`}
                    {form.precios.especial && ` | Especial: Bs. ${form.precios.especial}`}
                  </p>
                </div>
              )}
            </div>

            {/* Botones de acci�n */}
            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Los campos marcados con * son obligatorios
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || Object.keys(validationErrors).length > 0}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 hover:shadow-md flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingId ? '✏️ Actualizar Producto' : '✅ Crear Producto'}</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Lista de productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProductos.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            No se encontraron productos
          </div>
        ) : (
          filteredProductos.map((producto) => (
            <div key={producto.idProducto} className={designSystem.cards.item}>
              {/* Imagen del producto */}
              <div className="mb-3 h-40 bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                {producto.imagen_producto ? (
                  <img
                    src={`${API}${producto.imagen_producto}`}
                    alt={producto.nombreProducto}
                    className="max-h-full w-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextElementSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full flex items-center justify-center text-gray-400"
                  style={{ display: producto.imagen_producto ? 'none' : 'flex' }}
                >
                  <span className="text-4xl">🖼️</span>
                </div>
              </div>
              <div className="mb-3">
                {/* ID del producto destacado */}
                <div className="flex items-center justify-between mb-2">
                  <span className={getBadgeClass('primary') + ' font-mono'}>
                    ID: {producto.idProducto}
                  </span>
                  {producto.nombreProveedor && (
                    <span className={designSystem.typography.caption}>
                      {producto.nombreProveedor}
                    </span>
                  )}
                </div>
                <h3 className={designSystem.typography.h4 + ' mb-1'}>
                  {producto.nombreProducto}
                </h3>
                <p className={designSystem.typography.small}>
                  Stock: {producto.stockCaja} cajas
                </p>
                <p className={designSystem.typography.small}>
                  Tipo: {producto.tipoBotella}
                </p>
                {producto.fecha_vencimiento_proxima && (
                  <p className={`${designSystem.typography.caption} ${
                    new Date(producto.fecha_vencimiento_proxima) < new Date(Date.now() + 30*24*60*60*1000)
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    📅 Vence: {new Date(producto.fecha_vencimiento_proxima).toLocaleDateString('es-BO')}
                  </p>
                )}
              </div>
              {/* Precios - expandibles con clic */}
              <div className="mb-3">
                <button
                  onClick={() => {
                    togglePrecios(producto.idProducto)
                    // Cargar lotes autom�ticamente si no est�n cargados
                    if (showPrecios !== producto.idProducto && !lotesPorProducto[producto.idProducto]) {
                      loadLotesForProducto(producto.idProducto)
                    }
                  }}
                  className={getButtonClass('ghost', 'sm') + ' w-full justify-between flex items-center'}
                >
                  <span>💰 {showPrecios === producto.idProducto ? 'Ocultar precios' : 'Ver precios'}</span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${showPrecios === producto.idProducto ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPrecios === producto.idProducto && (
                  <div className="mt-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 space-y-2 animate-fadeIn">
                    {showUSD && (
                      <div className={designSystem.typography.caption + ' text-center pb-2 border-b border-gray-200 dark:border-gray-600'}>
                        💵 Tasa: 1$ = {tasaCambio.toFixed(2)} Bs
                      </div>
                    )}
                    
                    {/* Selector de Lote */}
                    {lotesPorProducto[producto.idProducto] && lotesPorProducto[producto.idProducto].length > 0 && (
                      <div className="pb-2 mb-2 border-b border-gray-200 dark:border-gray-600">
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                          📦 Seleccionar Lote:
                        </label>
                        <select
                          value={selectedLoteId[producto.idProducto] || ''}
                          onChange={(e) => {
                            const loteId = e.target.value
                            setSelectedLoteId(prev => ({
                              ...prev,
                              [producto.idProducto]: loteId ? parseInt(loteId) : null
                            }))
                          }}
                          className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700"
                        >
                          <option value="">Precios generales del producto</option>
                          {lotesPorProducto[producto.idProducto].map(lote => (
                            <option key={lote.idLote} value={lote.idLote}>
                              {lote.codigoLote || `Lote #${lote.idLote}`} - 
                              Stock: {lote.stockActual} - 
                              {lote.fechaVencimiento ? ` Vence: ${lote.fechaVencimiento}` : ' Sin vencimiento'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(() => {
                      // Si hay un lote seleccionado, mostrar sus precios
                      const loteSeleccionado = selectedLoteId[producto.idProducto] && lotesPorProducto[producto.idProducto]
                        ? lotesPorProducto[producto.idProducto].find(l => l.idLote === selectedLoteId[producto.idProducto])
                        : null
                      
                      // Usar precios del lote seleccionado o del producto
                      const precioMinorista = loteSeleccionado?.precio_minorista || producto.precio_minorista
                      const precioMayorista = loteSeleccionado?.precio_mayorista || producto.precio_mayorista
                      const precioEspecial = loteSeleccionado?.precio_especial || producto.precio_especial
                      
                      return (
                        <>
                          {loteSeleccionado && (
                            <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded mb-2">
                              <strong>Lote seleccionado:</strong> {loteSeleccionado.codigoLote || `#${loteSeleccionado.idLote}`}
                              {loteSeleccionado.nombreProveedor && ` - ${loteSeleccionado.nombreProveedor}`}
                            </div>
                          )}
                          
                          {precioMinorista ? (
                            <div className="flex justify-between items-center">
                              <span className={designSystem.typography.small}>🛒 Minorista:</span>
                              <span className={designSystem.typography.bodyBold + ' text-green-600 dark:text-green-400'}>
                                {formatPrecio(precioMinorista)}
                              </span>
                            </div>
                          ) : (
                            <div className={designSystem.typography.caption + ' text-center'}>
                              Sin precio minorista configurado
                            </div>
                          )}
                          
                          {precioMayorista ? (
                            <div className="flex justify-between items-center">
                              <span className={designSystem.typography.small}>🏪 Mayorista:</span>
                              <span className={designSystem.typography.bodyBold + ' text-blue-600 dark:text-blue-400'}>
                                {formatPrecio(precioMayorista)}
                              </span>
                            </div>
                          ) : (
                            <div className={designSystem.typography.caption + ' text-center'}>
                              Sin precio mayorista configurado
                            </div>
                          )}
                          
                          {precioEspecial && (
                            <div className="flex justify-between items-center">
                              <span className={designSystem.typography.small}>? Especial:</span>
                              <span className={designSystem.typography.bodyBold + ' text-purple-600 dark:text-purple-400'}>
                                {formatPrecio(precioEspecial)}
                              </span>
                            </div>
                          )}
                        </>
                      )
                    })()}
                    
                    {producto.fecha_vencimiento_proxima && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className={`flex items-center justify-between text-xs ${
                          new Date(producto.fecha_vencimiento_proxima) < new Date(Date.now() + 30*24*60*60*1000)
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          <span>📅 Vencimiento:</span>
                          <span>{new Date(producto.fecha_vencimiento_proxima).toLocaleDateString('es-BO')}</span>
                        </div>
                      </div>
                    )}
                    {/* Lotes visualization */}
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          type="button"
                          className={getButtonClass('primary', 'xs')}
                          onClick={() => openLotesModal(producto.idProducto)}
                        >
                          📦 Ver lotes del producto
                        </button>
                      </div>
                      <button
                        type="button"
                        className={getButtonClass('ghost', 'xs') + ' mb-2 ml-2'}
                        onClick={() => {
                          setShowCreateLote(prev => {
                            const nextOpen = !prev[producto.idProducto]
                            // Pre-cargar valores por defecto al abrir
                            if (nextOpen) {
                              setCreateLoteForm(curr => ({
                                ...curr,
                                [producto.idProducto]: {
                                  idProveedor: (curr[producto.idProducto]?.idProveedor) || '',
                                  fechaCompra: (curr[producto.idProducto]?.fechaCompra) || new Date().toISOString().slice(0,10),
                                  fechaVencimiento: curr[producto.idProducto]?.fechaVencimiento || '',
                                  precioCompra: curr[producto.idProducto]?.precioCompra || '',
                                  cantidadCajas: curr[producto.idProducto]?.cantidadCajas || ''
                                }
                              }))
                            }
                            return { ...prev, [producto.idProducto]: nextOpen }
                          })
                        }}
                      >
                        {showCreateLote[producto.idProducto] ? 'Cancelar nuevo lote' : 'Agregar lote'}
                      </button>
                      {showCreateLote[producto.idProducto] && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700 mt-2">
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Proveedor</label>
                              <select
                                value={(createLoteForm[producto.idProducto]?.idProveedor) || ''}
                                onChange={(e)=> setCreateLoteForm(prev => ({
                                  ...prev,
                                  [producto.idProducto]: { ...(prev[producto.idProducto]||{}), idProveedor: e.target.value }
                                }))}
                                className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700"
                              >
                                <option value="">Sin proveedor</option>
                                {proveedores.map(p => (
                                  <option key={p.idProveedor} value={p.idProveedor}>{p.nombreProveedor || p.nombre || p.nombreComercial}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Fecha compra</label>
                              <input
                                type="date"
                                value={(createLoteForm[producto.idProducto]?.fechaCompra) || new Date().toISOString().slice(0,10)}
                                onChange={(e)=> setCreateLoteForm(prev => ({
                                  ...prev,
                                  [producto.idProducto]: { ...(prev[producto.idProducto]||{}), fechaCompra: e.target.value }
                                }))}
                                className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Fecha venc.</label>
                              <input
                                type="date"
                                value={(createLoteForm[producto.idProducto]?.fechaVencimiento) || ''}
                                onChange={(e)=> setCreateLoteForm(prev => ({
                                  ...prev,
                                  [producto.idProducto]: { ...(prev[producto.idProducto]||{}), fechaVencimiento: e.target.value }
                                }))}
                                className="w-full border rounded px-2 py-1 text-sm dark:bg-gray-900 dark:border-gray-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Precio compra (Bs)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={(createLoteForm[producto.idProducto]?.precioCompra) || ''}
                                onChange={(e)=> setCreateLoteForm(prev => ({
                                  ...prev,
                                  [producto.idProducto]: { ...(prev[producto.idProducto]||{}), precioCompra: e.target.value }
                                }))}
                                className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Cantidad (cajas)</label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={(createLoteForm[producto.idProducto]?.cantidadCajas) || ''}
                                onChange={(e)=> setCreateLoteForm(prev => ({
                                  ...prev,
                                  [producto.idProducto]: { ...(prev[producto.idProducto]||{}), cantidadCajas: e.target.value }
                                }))}
                                className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                placeholder="1"
                              />
                            </div>
                          </div>
                          
                          {/* Precios de venta (opcional) */}
                          <div className="mt-3 pt-3 border-t border-yellow-300 dark:border-yellow-700">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              💰 Precios de venta (opcional - dejar vac�o para usar precios del producto)
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Precio Minorista (Bs)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={(createLoteForm[producto.idProducto]?.precio_minorista) || ''}
                                  onChange={(e)=> setCreateLoteForm(prev => ({
                                    ...prev,
                                    [producto.idProducto]: { ...(prev[producto.idProducto]||{}), precio_minorista: e.target.value }
                                  }))}
                                  className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                  placeholder="Opcional"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Precio Mayorista (Bs)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={(createLoteForm[producto.idProducto]?.precio_mayorista) || ''}
                                  onChange={(e)=> setCreateLoteForm(prev => ({
                                    ...prev,
                                    [producto.idProducto]: { ...(prev[producto.idProducto]||{}), precio_mayorista: e.target.value }
                                  }))}
                                  className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                  placeholder="Opcional"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-gray-600 dark:text-gray-300 mb-1">Precio Especial (Bs)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={(createLoteForm[producto.idProducto]?.precio_especial) || ''}
                                  onChange={(e)=> setCreateLoteForm(prev => ({
                                    ...prev,
                                    [producto.idProducto]: { ...(prev[producto.idProducto]||{}), precio_especial: e.target.value }
                                  }))}
                                  className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                  placeholder="Opcional"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleCreateLote(producto.idProducto)}
                              className={getButtonClass('primary', 'xs')}
                            >
                              Guardar lote
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Acciones */}
              {['admin','editor','superadmin'].includes(userRole) && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEdit(producto)}
                    className={getButtonClass('primary', 'sm') + ' flex-1'}
                    title={'Editar producto'}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => deleteProducto(producto.idProducto)}
                    className={getButtonClass('danger', 'sm') + ' flex-1'}
                    title={'Eliminar producto'}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de lotes ampliado */}
      {lotesModalProductId && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeLotesModal} />
          <div className="relative bg-white dark:bg-gray-800 w-[95vw] max-w-5xl max-h-[85vh] rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm sm:text-base font-semibold text-indigo-900 dark:text-indigo-200">
                Lotes del producto #{lotesModalProductId}
              </h3>
              <button onClick={closeLotesModal} className="px-2 py-1 text-sm rounded border dark:border-gray-600">Cerrar</button>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(85vh - 52px)' }}>
              {(() => {
                const rows = lotesPorProducto[lotesModalProductId] || []
                if (rows.length === 0) {
                  return <div className="text-sm text-gray-600 dark:text-gray-300">No hay lotes registrados</div>
                }
                return (
                  <table className="min-w-full text-xs sm:text-sm border dark:border-gray-700">
                    <thead className="sticky top-0 bg-indigo-100 dark:bg-indigo-900/60">
                      <tr>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2 text-left">Proveedor</th>
                        <th className="p-2 text-right">Precio Compra</th>
                        <th className="p-2 text-right">Cant. Inicial</th>
                        <th className="p-2 text-right">Stock Actual</th>
                        <th className="p-2 text-left">Fecha Compra</th>
                        <th className="p-2 text-left">Fecha Venc.</th>
                        <th className="p-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(lote => (
                        <React.Fragment key={lote.idLote}>
                          <tr className="border-t dark:border-gray-700">
                            <td className="p-2 font-mono">{lote.codigoLote || `#${lote.idLote}`}</td>
                            <td className="p-2">{lote.nombreProducto}</td>
                            <td className="p-2">{lote.nombreProveedor || `Proveedor ${lote.idProveedor || 'N/A'}`}</td>
                            <td className="p-2 text-right">{Number(lote.precioCompra || 0).toFixed(2)}</td>
                            <td className="p-2 text-right">{lote.cantidadCajas || 0}</td>
                            <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">{lote.stockActual || 0}</td>
                            <td className="p-2">{lote.fechaCompra}</td>
                            <td className="p-2 text-sm">
                              {lote.fechaVencimiento ? (
                                <span className={
                                  new Date(lote.fechaVencimiento) < new Date(Date.now() + 30*24*60*60*1000)
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : ''
                                }>
                                  {lote.fechaVencimiento}
                                </span>
                              ) : 'N/A'}
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => setEditingLoteId(editingLoteId === lote.idLote ? null : lote.idLote)}
                                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                              >
                                {editingLoteId === lote.idLote ? 'Cancelar' : 'Editar precios'}
                              </button>
                            </td>
                          </tr>
                          {editingLoteId === lote.idLote && (
                            <tr className="bg-yellow-50 dark:bg-yellow-900/10">
                              <td colSpan="9" className="p-3">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-xs mb-1">Precio Minorista (Bs)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={lote.precio_minorista || 'N/A'}
                                      value={editLotePrices.minorista || ''}
                                      onChange={(e)=> setEditLotePrices(prev => ({ ...prev, minorista: e.target.value }))}
                                      className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs mb-1">Precio Mayorista (Bs)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={lote.precio_mayorista || 'N/A'}
                                      value={editLotePrices.mayorista || ''}
                                      onChange={(e)=> setEditLotePrices(prev => ({ ...prev, mayorista: e.target.value }))}
                                      className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs mb-1">Precio Especial (Bs)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={lote.precio_especial || 'N/A'}
                                      value={editLotePrices.especial || ''}
                                      onChange={(e)=> setEditLotePrices(prev => ({ ...prev, especial: e.target.value }))}
                                      className="w-full border rounded px-2 py-1 text-sm text-right dark:bg-gray-900 dark:border-gray-700"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveLotePrices(lote.idLote)}
                                      className={getButtonClass('primary', 'sm')}
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

