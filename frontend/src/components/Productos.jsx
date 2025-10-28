import React, { useEffect, useState } from 'react'
import { useToast } from '../ToastContext'

export default function Productos({ API, userRole = 'admin', permissions = [], clienteInfo = null }) {
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const toast = useToast()
  const [productos, setProductos] = useState([])
  const [filteredProductos, setFilteredProductos] = useState([])
  const [tipos, setTipos] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showPrecios, setShowPrecios] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const [previewImage, setPreviewImage] = useState(null)

  const [form, setForm] = useState({
    nombreProducto: '',
    imagen_producto: null,
    stockCaja: 0,
    idEmpresa: '',
    idTipoBotella: '',
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
      errors.nombreProducto = 'El nombre no puede tener más de 100 caracteres'
    } else if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ0-9\s\-_.,()]+$/.test(form.nombreProducto.trim())) {
      errors.nombreProducto = 'El nombre contiene caracteres no válidos'
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
          errors[`precio_${tipo}`] = `El precio ${tipo} debe ser un número válido mayor o igual a 0`
        } else if (num > 999999.99) {
          errors[`precio_${tipo}`] = `El precio ${tipo} es demasiado alto`
        } else {
          preciosNumericos[tipo] = num
        }
      }
    })
    
    // Validar lógica de precios (mayorista < minorista)
    if (preciosNumericos.mayorista && preciosNumericos.minorista && 
        preciosNumericos.mayorista >= preciosNumericos.minorista) {
      errors.precio_mayorista = 'El precio mayorista debe ser menor al precio minorista'
    }
    
    // Validar imagen (si se proporciona)
    if (form.imagen_producto) {
      const file = form.imagen_producto
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        errors.imagen_producto = 'Solo se permiten imágenes (JPG, PNG, GIF, WebP)'
      } else if (file.size > 5 * 1024 * 1024) { // 5MB
        errors.imagen_producto = 'La imagen no puede ser mayor a 5MB'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Limpiar errores de validación cuando cambie el campo
  const clearFieldError = (fieldName) => {
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  // Filtrado y búsqueda
  React.useEffect(() => {
    const t = setTimeout(() => {
      const q = (searchQ || '').trim().toLowerCase()
      const list = productos.filter(p => {
        const inTipo = filterTipo ? String(p.idTipoBotella) === filterTipo : true
        if (!inTipo) return false

        if (!q) return true
        const nombre = (p.nombreProducto || '').toLowerCase()
        const tipoNombre = (p.tipoBotella || '').toLowerCase()
        
        const text = [nombre, tipoNombre].join(' ')
        return text.includes(q)
      })
      setFilteredProductos(list)
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, filterTipo, productos])

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
          // Sesión expirada, recargar página para ir al login
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

  useEffect(() => {
    loadProductos()
    loadTipos()
    loadEmpresas()
  }, [API, userRole])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Validación avanzada
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

      const url = editingId ? `${API}/productos/${editingId}` : `${API}/productos`
      const method = editingId ? 'PUT' : 'POST'

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
      toast.showToast(editingId ? 'Producto actualizado' : 'Producto creado', 'success')
    } catch (err) {
      console.error('Error saving producto:', err)
      setError('Error guardando: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Manejar cambio de imagen con previsualización
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

  const resetForm = () => {
    setForm({
      nombreProducto: '',
      imagen_producto: null,
      stockCaja: 0,
      idEmpresa: '',
      idTipoBotella: '',
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
    setForm({
      nombreProducto: producto.nombreProducto || '',
      imagen_producto: null,
      stockCaja: producto.stockCaja || 0,
      idEmpresa: producto.idEmpresa ? String(producto.idEmpresa) : '',
      idTipoBotella: producto.idTipoBotella ? String(producto.idTipoBotella) : '',
      precios: {
        minorista: producto.precio_minorista || '',
        mayorista: producto.precio_mayorista || '',
        especial: producto.precio_especial || ''
      }
    })
    setEditingId(producto.idProducto)
    setShowCreate(true)
    setError(null)
  }

  const deleteProducto = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch(`${API}/productos/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

      await loadProductos()
      toast.showToast('Producto eliminado', 'success')
    } catch (err) {
      console.error('Error deleting producto:', err)
      toast.showToast('Error eliminando: ' + err.message, 'error')
    }
  }

  const togglePrecios = (productoId) => {
    setShowPrecios(showPrecios === productoId ? null : productoId)
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
            Catálogo de Productos
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

        {/* Catálogo de productos para clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProductos.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">🛍️</div>
              <p>No se encontraron productos</p>
            </div>
          ) : (
            filteredProductos.map((producto) => {
              // Determinar precio según tipo de cliente
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
                  <div className="h-48 bg-gray-100 dark:bg-gray-600 overflow-hidden">
                    {producto.imagen_producto ? (
                      <img
                        src={producto.imagen_producto}
                        alt={producto.nombreProducto}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📦</div>
                          <div className="text-sm">Sin imagen</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Información del producto */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {producto.nombreProducto}
                    </h3>
                    
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full text-gray-600 dark:text-gray-300">
                        {producto.tipoBotella || 'Sin tipo'}
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Stock: {producto.stockCaja} cajas
                      </span>
                    </div>

                    {/* Precio */}
                    {precio ? (
                      <div className="mb-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                            Bs. {parseFloat(precio).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {tipoPrecio}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Precio no disponible
                        </span>
                      </div>
                    )}

                    {/* Botón de acción */}
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
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Productos ({filteredProductos.length})
        </h2>
        {has('productos', 'create') && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Nuevo Producto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Buscar
          </label>
          <input
            type="text"
            placeholder="Nombre del producto..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo de Botella
          </label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Todos</option>
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
              ✕
            </button>
          </div>
          
          <form onSubmit={submit} className="space-y-6">
            {/* Información básica */}
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
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleImageChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100 ${
                      validationErrors.imagen_producto 
                        ? 'border-red-500 dark:border-red-400' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Formatos: JPG, PNG, GIF, WebP. Máximo 5MB
                  </p>
                  {validationErrors.imagen_producto && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.imagen_producto}</p>
                  )}
                </div>
                
                {/* Previsualización */}
                {previewImage && (
                  <div className="w-20 h-20 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                    <img 
                      src={previewImage} 
                      alt="Vista previa" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Configuración de precios con validaciones */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-2">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                  Configuración de Precios
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  (Opcionales - Mayorista debe ser menor que Minorista)
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    💰 Precio Minorista
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
                    🏢 Precio Mayorista
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
                    ⭐ Precio Especial
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
                    💡 <strong>Resumen de precios:</strong>
                    {form.precios.minorista && ` Minorista: Bs. ${form.precios.minorista}`}
                    {form.precios.mayorista && ` | Mayorista: Bs. ${form.precios.mayorista}`}
                    {form.precios.especial && ` | Especial: Bs. ${form.precios.especial}`}
                  </p>
                </div>
              )}
            </div>

            {/* Botones de acción */}
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
                    <span>{editingId ? '✏️ Actualizar Producto' : '➕ Crear Producto'}</span>
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
            <div key={producto.idProducto} className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
              {/* Imagen del producto */}
              {producto.imagen_producto && (
                <div className="mb-3">
                  <img
                    src={producto.imagen_producto}
                    alt={producto.nombreProducto}
                    className="w-full h-32 object-cover rounded-lg"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                </div>
              )}
              
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {producto.nombreProducto}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stock: {producto.stockCaja} cajas
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tipo: {producto.tipoBotella}
                </p>
              </div>

              {/* Precios */}
              <div className="mb-3">
                <button
                  onClick={() => togglePrecios(producto.idProducto)}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  {showPrecios === producto.idProducto ? 'Ocultar precios' : 'Ver precios'}
                </button>
                
                {showPrecios === producto.idProducto && (
                  <div className="mt-2 space-y-1 text-sm">
                    {producto.precio_minorista && (
                      <div>Minorista: S/ {parseFloat(producto.precio_minorista).toFixed(2)}</div>
                    )}
                    {producto.precio_mayorista && (
                      <div>Mayorista: S/ {parseFloat(producto.precio_mayorista).toFixed(2)}</div>
                    )}
                    {producto.precio_especial && (
                      <div>Especial: S/ {parseFloat(producto.precio_especial).toFixed(2)}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Acciones */}
              {(has('productos', 'edit') || has('productos', 'delete')) && (
                <div className="flex space-x-2">
                  {has('productos', 'edit') && (
                    <button
                      onClick={() => startEdit(producto)}
                      className="flex-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded font-medium transition-colors"
                    >
                      Editar
                    </button>
                  )}
                  {has('productos', 'delete') && (
                    <button
                      onClick={() => deleteProducto(producto.idProducto)}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded font-medium transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
