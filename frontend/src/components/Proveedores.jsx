import React, { useEffect, useState } from 'react'
import { useToast } from '../ToastContext'

export default function Proveedores({ API, userRole = 'admin', permissions = [] }) {
  const roleLower = (userRole || '').toLowerCase()
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const isAdminLike = ['admin','superadmin'].includes(roleLower)
  const canView = has('proveedores','view') || isAdminLike
  const canCreate = has('proveedores','create') || isAdminLike
  const canEdit = has('proveedores','edit') || isAdminLike
  const canDelete = has('proveedores','delete') || roleLower==='superadmin'
  const toast = useToast()
  const [proveedores, setProveedores] = useState([])
  const [filteredProveedores, setFilteredProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterTipo, setFilterTipo] = useState('')

  const [form, setForm] = useState({
    nombreComercial: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    esEmpresa: 1, // 1=empresa, 0=persona
    idPersona: '',
    idEmpresaProveedor: '', // solo superadmin al crear empresa
    estado: 1
  })

  // Cargar personas para selector (cuando esEmpresa = 0)
  const [personas, setPersonas] = useState([])
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)

  const loadPersonas = async () => {
    setLoadingPersonas(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      // Build URL via reverse proxy to avoid hard-coded ports and respect Docker networking
      const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
      const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
      const personasURL = `${proto}//${host}/api/personas/persons`

      const res = await fetch(personasURL, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (res.ok) {
        const data = await res.json()
        setPersonas(Array.isArray(data) ? data : [])
      } else {
        console.error('Error loading personas - HTTP', res.status)
      }
    } catch (err) {
      console.error('Error loading personas:', err)
    } finally {
      setLoadingPersonas(false)
    }
  }

  const loadEmpresas = async () => {
    if (roleLower !== 'superadmin') { setEmpresas([]); return }
    setLoadingEmpresas(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost'
      const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:'
      const url = `${proto}//${host}/api/personas/empresas`
      const res = await fetch(url, { method:'GET', headers, credentials:'include' })
      if (res.ok) {
        const data = await res.json()
        setEmpresas(Array.isArray(data) ? data : [])
      } else {
        console.error('Error loading empresas - HTTP', res.status)
      }
    } catch (err) { console.error('Error loading empresas:', err) }
    finally { setLoadingEmpresas(false) }
  }

  // Cargar personas cuando se selecciona tipo Persona
  React.useEffect(() => {
    if (showCreate && form.esEmpresa === 0) {
      loadPersonas()
    }
    if (showCreate && form.esEmpresa === 1 && roleLower === 'superadmin') {
      loadEmpresas()
    }
  }, [showCreate, form.esEmpresa])

  // Debug: surface role/permissions and computed abilities to help diagnose RBAC visibility
  React.useEffect(() => {
    try {
      console.debug('[Proveedores] Debug RBAC', {
        userRole,
        roleLower,
        permissionsCount: Array.isArray(permissions) ? permissions.length : 0,
        samplePerms: (permissions || []).slice(0, 5),
        canView, canCreate, canEdit, canDelete
      })
    } catch {}
  }, [userRole, roleLower, JSON.stringify(permissions)])

  // Filtrado y búsqueda
  React.useEffect(() => {
    const t = setTimeout(() => {
      const q = (searchQ || '').trim().toLowerCase()
      const list = proveedores.filter(p => {
        const inEstado = filterEstado ? String(p.estado) === String(filterEstado) : true
        const inTipo = filterTipo ? String(p.esEmpresa) === filterTipo : true
        if (!inEstado || !inTipo) return false

        if (!q) return true
        const nombre = (p.nombreComercial || '').toLowerCase()
        const contacto = (p.contacto || '').toLowerCase()
        const email = (p.email || '').toLowerCase()
        const telefono = (p.telefono || '').toLowerCase()
        
        const text = [nombre, contacto, email, telefono].join(' ')
        return text.includes(q)
      })
      setFilteredProveedores(list)
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, filterEstado, filterTipo, proveedores])

  const loadProveedores = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      // API ya es /api/proveedores -> no agregar /proveedores
      const res = await fetch(`${API}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      const data = await res.json()
      setProveedores(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading proveedores:', err)
      setError('Error cargando proveedores: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProveedores()
  }, [API, userRole])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Validación
    if (!form.nombreComercial.trim()) {
      setError('Nombre comercial es obligatorio')
      return
    }
    
    if (form.esEmpresa === 0 && !form.idPersona) {
      setError('ID de persona es obligatorio para proveedores tipo Persona')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nombreComercial: form.nombreComercial.trim(),
        contacto: form.contacto.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        direccion: form.direccion.trim() || null,
        esEmpresa: parseInt(form.esEmpresa),
        idPersona: form.esEmpresa === 0 && form.idPersona ? parseInt(form.idPersona) : null,
        // Para superadmin creando empresa, enviar idEmpresaProveedor explícito
        idEmpresaProveedor: (userRole === 'superadmin' && parseInt(form.esEmpresa) === 1 && form.idEmpresaProveedor)
          ? parseInt(form.idEmpresaProveedor) : undefined,
        estado: parseInt(form.estado)
      }

      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

  // Construir url usando base API sin duplicar segmento
  const url = editingId ? `${API}/${editingId}` : `${API}`
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

      await loadProveedores()
      resetForm()
      toast.showToast(editingId ? 'Proveedor actualizado' : 'Proveedor creado', 'success')
    } catch (err) {
      console.error('Error saving proveedor:', err)
      setError('Error guardando: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm({
      nombreComercial: '',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
      esEmpresa: 1,
      idPersona: '',
      idEmpresaProveedor: '',
      estado: 1
    })
    setEditingId(null)
    setShowCreate(false)
    setError(null)
  }

  const startEdit = (proveedor) => {
    setForm({
      nombreComercial: proveedor.nombreComercial || '',
      contacto: proveedor.contacto || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      esEmpresa: proveedor.esEmpresa || 1,
      idPersona: proveedor.idPersona ? String(proveedor.idPersona) : '',
      idEmpresaProveedor: proveedor.idEmpresaProveedor ? String(proveedor.idEmpresaProveedor) : '',
      estado: proveedor.estado
    })
    setEditingId(proveedor.idProveedor)
    setShowCreate(true)
    setError(null)
  }

  const deleteProveedor = async (id) => {
    if (!confirm('¿Eliminar este proveedor?')) return
    
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const res = await fetch(`${API}/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

      await loadProveedores()
      toast.showToast('Proveedor eliminado', 'success')
    } catch (err) {
      console.error('Error deleting proveedor:', err)
      toast.showToast('Error eliminando: ' + err.message, 'error')
    }
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

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Proveedores ({filteredProveedores.length})
        </h2>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Nuevo Proveedor
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Buscar
          </label>
          <input
            type="text"
            placeholder="Nombre, email, teléfono..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo
          </label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Todos</option>
            <option value="1">Empresa</option>
            <option value="0">Persona</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Estado
          </label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Todos</option>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          {error}
        </div>
      )}

      {/* Formulario */}
      {showCreate && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre Comercial *
              </label>
              <input
                type="text"
                value={form.nombreComercial}
                onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Proveedor *
              </label>
              <select
                value={form.esEmpresa}
                onChange={(e) => setForm({ ...form, esEmpresa: parseInt(e.target.value), idPersona: '' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                disabled={!!editingId}
              >
                <option value={1}>Empresa</option>
                <option value={0}>Persona</option>
              </select>
              {editingId && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  No se puede cambiar el tipo de proveedor al editar
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contacto
              </label>
              <input
                type="text"
                value={form.contacto}
                onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                placeholder="Nombre del contacto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                placeholder="Número de teléfono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                placeholder="correo@ejemplo.com"
              />
            </div>
            
            {/* Campo condicional: Persona solo si es tipo Persona */}
            {form.esEmpresa === 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Persona *
                </label>
                <select
                  value={form.idPersona}
                  onChange={(e) => setForm({ ...form, idPersona: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                  required={form.esEmpresa === 0}
                >
                  <option value="">Seleccione una persona...</option>
                  {loadingPersonas ? (
                    <option disabled>Cargando personas...</option>
                  ) : (
                    personas.map((p) => (
                      <option key={p.id_persona} value={p.id_persona}>
                        {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer} (CI: {p.ci_persona})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  La empresa del proveedor se heredará de la persona seleccionada
                </p>
              </div>
            )}
            
            {/* Información adicional para tipo Empresa */}
            {form.esEmpresa === 1 && (
              <div className="md:col-span-2">
                {userRole === 'superadmin' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                    <select
                      value={form.idEmpresaProveedor}
                      onChange={(e)=>setForm({...form, idEmpresaProveedor: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                    >
                      <option value="">{loadingEmpresas ? 'Cargando empresas...' : 'Seleccionar empresa'}</option>
                      {empresas.map(emp => (
                        <option key={emp.id_empresa} value={emp.id_empresa}>{emp.nombre_empresa}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Requerido para superadmin.</p>
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      ℹ️ <strong>Proveedor tipo Empresa:</strong> La empresa se asignará automáticamente según su sesión actual.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Proveedor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Estado
              </th>
              {(canEdit || canDelete) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProveedores.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No se encontraron proveedores
                </td>
              </tr>
            ) : (
              filteredProveedores.map((proveedor) => (
                <tr key={proveedor.idProveedor} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {proveedor.nombreComercial}
                      </div>
                      {proveedor.nombreEmpresa && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {proveedor.nombreEmpresa}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {proveedor.contacto && <div>{proveedor.contacto}</div>}
                      {proveedor.telefono && <div>{proveedor.telefono}</div>}
                      {proveedor.email && <div className="text-blue-600 dark:text-blue-400">{proveedor.email}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      proveedor.esEmpresa === 1 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {proveedor.esEmpresa === 1 ? 'Empresa' : 'Persona'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      proveedor.estado === 1
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {proveedor.estado === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex space-x-2">
                        {canEdit && (
                          <button
                            onClick={() => startEdit(proveedor)}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => deleteProveedor(proveedor.idProveedor)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View - Visible only on mobile */}
      <div className="md:hidden space-y-4">
        {filteredProveedores.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
            No se encontraron proveedores
          </div>
        ) : (
          filteredProveedores.map((proveedor) => (
            <div key={proveedor.idProveedor} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                    {proveedor.nombreComercial}
                  </div>
                  {proveedor.nombreEmpresa && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {proveedor.nombreEmpresa}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    proveedor.esEmpresa === 1 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  }`}>
                    {proveedor.esEmpresa === 1 ? 'Empresa' : 'Persona'}
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    proveedor.estado === 1
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {proveedor.estado === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              
              {(proveedor.contacto || proveedor.telefono || proveedor.email) && (
                <div className="space-y-1 text-sm mb-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {proveedor.contacto && (
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Contacto:</span>
                      <span className="text-gray-900 dark:text-gray-100">{proveedor.contacto}</span>
                    </div>
                  )}
                  {proveedor.telefono && (
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Teléfono:</span>
                      <span className="text-gray-900 dark:text-gray-100">{proveedor.telefono}</span>
                    </div>
                  )}
                  {proveedor.email && (
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Email:</span>
                      <span className="text-blue-600 dark:text-blue-400 break-all">{proveedor.email}</span>
                    </div>
                  )}
                </div>
              )}
              
              {(canEdit || canDelete) && (
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {canEdit && (
                    <button
                      onClick={() => startEdit(proveedor)}
                      className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => deleteProveedor(proveedor.idProveedor)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
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
