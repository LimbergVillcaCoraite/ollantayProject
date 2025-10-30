import React, { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'

export default function Usuarios({ API, userRole = 'admin' }) {
  const [users, setUsers] = useState([])
  const [personas, setPersonas] = useState([])
  const [roles, setRoles] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPersonas, setLoadingPersonas] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [loadingEmpresas, setLoadingEmpresas] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', id_persona: '', id_role: '', estado: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [filterEmpresa, setFilterEmpresa] = useState('')
  const [filterEstado, setFilterEstado] = useState('') // '' todos, '1' activos, '0' inactivos
  const [error, setError] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const toast = useToast()

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/users`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (!res.ok) {
        if (res.status === 401) {
          window.location.reload() // Redirigir al login
          return
        }
        throw new Error(`Error cargando usuarios: HTTP ${res.status}`)
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading users:', err)
      toast.push(err.message || 'Error cargando usuarios', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPersonas = async () => {
    setLoadingPersonas(true)
    try {
      const res = await fetch(`${API}/persons`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      const data = await res.json()
      setPersonas(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando personas:', err)
    } finally {
      setLoadingPersonas(false)
    }
  }

  const loadRoles = async () => {
    setLoadingRoles(true)
    try {
      const res = await fetch(`${API}/roles`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      const data = await res.json()
      setRoles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error cargando roles:', err)
    } finally {
      setLoadingRoles(false)
    }
  }

  const loadEmpresas = async () => {
    if (userRole !== 'superadmin') return // Solo superadmin necesita lista de empresas
    
    setLoadingEmpresas(true)
    try {
      const res = await fetch(`${API}/empresas`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setEmpresas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error cargando empresas:', err)
    } finally {
      setLoadingEmpresas(false)
    }
  }

  useEffect(() => {
    loadUsers()
    loadPersonas()
    loadRoles()
    loadEmpresas()
  }, [])

  // Validación mejorada
  const validateForm = () => {
    const errors = []
    
    // Validar username
    if (!form.username || form.username.trim().length === 0) {
      errors.push('El nombre de usuario es requerido')
    } else if (form.username.trim().length < 3) {
      errors.push('El nombre de usuario debe tener al menos 3 caracteres')
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username.trim())) {
      errors.push('El nombre de usuario solo puede contener letras, números, guiones y puntos')
    }
    
    // Validar contraseña (solo para nuevos usuarios o si se proporciona para editar)
    if (!editingId && (!form.password || form.password.length === 0)) {
      errors.push('La contraseña es requerida para nuevos usuarios')
    } else if (form.password && form.password.length > 0) {
      if (form.password.length < 6) {
        errors.push('La contraseña debe tener al menos 6 caracteres')
      }
      if (!/(?=.*[a-zA-Z])/.test(form.password)) {
        errors.push('La contraseña debe contener al menos una letra')
      }
    }
    
    // Validar persona
    if (!form.id_persona || form.id_persona === '') {
      errors.push('Debe seleccionar una persona para vincular al usuario')
    }
    
    // Verificar si el username ya existe (solo para nuevos o si cambió)
    if (!editingId || (editingId && users.find(u => u.id_user === editingId)?.username !== form.username)) {
      const existingUser = users.find(u => u.username.toLowerCase() === form.username.toLowerCase())
      if (existingUser && existingUser.id_user !== editingId) {
        errors.push('Ya existe un usuario con ese nombre')
      }
    }
    
    // Verificar si la persona ya tiene un usuario (solo para nuevos o si cambió)
    if (!editingId || (editingId && users.find(u => u.id_user === editingId)?.id_persona !== Number(form.id_persona))) {
      const existingPersonaUser = users.find(u => u.id_persona === Number(form.id_persona))
      if (existingPersonaUser && existingPersonaUser.id_user !== editingId) {
        const personaName = getPersonaName(Number(form.id_persona))
        errors.push(`La persona "${personaName}" ya tiene un usuario asignado`)
      }
    }
    
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validaciones mejoradas
    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      toast.push(`Errores de validación:\n${validationErrors.join('\n')}`, 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        username: form.username,
        password: form.password,
        id_persona: form.id_persona ? Number(form.id_persona) : null,
        id_role: form.id_role ? Number(form.id_role) : null
      }
      if (userRole === 'admin' || userRole === 'superadmin') {
        payload.estado = form.estado !== undefined ? Number(form.estado) : 1
      }

      if (editingId) {
        // Update user
        const res = await fetch(`${API}/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error(j?.detail || res.statusText)
        }
        toast.push('Usuario actualizado', 'success')
      } else {
        // Create user
        const res = await fetch(`${API}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error(j?.detail || res.statusText)
        }
        toast.push('Usuario creado', 'success')
      }

      // Reset form and reload
  setForm({ username: '', password: '', id_persona: '', id_role: '', estado: 1 })
      setEditingId(null)
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      toast.push(err.message || 'Error', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (user) => {
    setEditingId(user.id_user)
    setForm({
      username: user.username,
      password: '',
      id_persona: user.id_persona || '',
  id_role: user.id_role || '',
  estado: user.estado !== undefined ? user.estado : 1
    })
    setShowCreate(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      const res = await fetch(`${API}/users/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Error eliminando usuario')
      toast.push('Usuario eliminado', 'success')
      loadUsers()
    } catch (err) {
      toast.push(err.message || 'Error eliminando usuario', 'error')
    }
  }

  const getPersonaName = (id) => {
    if (!id) return '-'
    const p = personas.find(p => p.id_persona === id)
    if (!p) return String(id)
    return [p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer].filter(Boolean).join(' ')
  }

  const getRoleName = (id) => {
    if (!id) return '-'
    const r = roles.find(r => r.idrole === id)
    return r ? r.name : String(id)
  }

  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
        <p className="text-red-600 dark:text-red-400">Solo administradores pueden gestionar usuarios</p>
      </div>
    )
  }

  // Validación en tiempo real del formulario
  const validateField = (field, value) => {
    const errors = { ...formErrors }
    
    switch (field) {
      case 'username':
        if (!value || value.trim().length === 0) {
          errors.username = 'El nombre de usuario es requerido'
        } else if (value.trim().length < 3) {
          errors.username = 'Debe tener al menos 3 caracteres'
        } else if (!/^[a-zA-Z0-9_.-]+$/.test(value.trim())) {
          errors.username = 'Solo letras, números, guiones y puntos'
        } else {
          const existing = users.find(u => u.username.toLowerCase() === value.toLowerCase() && u.id_user !== editingId)
          if (existing) {
            errors.username = 'Este nombre de usuario ya existe'
          } else {
            delete errors.username
          }
        }
        break
      case 'password':
        if (!editingId && (!value || value.length === 0)) {
          errors.password = 'La contraseña es requerida'
        } else if (value && value.length > 0) {
          if (value.length < 6) {
            errors.password = 'Mínimo 6 caracteres'
          } else if (!/(?=.*[a-zA-Z])/.test(value)) {
            errors.password = 'Debe contener al menos una letra'
          } else {
            delete errors.password
          }
        } else {
          delete errors.password
        }
        break
      case 'id_persona':
        if (!value || value === '') {
          errors.id_persona = 'Debe seleccionar una persona'
        } else {
          const existing = users.find(u => u.id_persona === Number(value) && u.id_user !== editingId)
          if (existing) {
            errors.id_persona = 'Esta persona ya tiene un usuario'
          } else {
            delete errors.id_persona
          }
        }
        break
      default:
        break
    }
    
    setFormErrors(errors)
  }

  // Filtrar usuarios según el rol y búsqueda
  const filteredUsers = users.filter(user => {
    // Superadmin puede filtrar por empresa; admin confía en backend para el alcance
    const passesEmpresa = userRole === 'superadmin' && filterEmpresa
      ? String(user.company_id ?? '') === String(filterEmpresa)
      : true

    const passesEstado = filterEstado !== ''
      ? String(user.estado ?? '') === String(filterEstado)
      : true

    // Búsqueda
    const term = searchTerm.toLowerCase()
    const passesSearch = term
      ? ((user.username || '').toLowerCase().includes(term)
         || getPersonaName(user.id_persona).toLowerCase().includes(term)
         || getRoleName(user.id_role).toLowerCase().includes(term))
      : true

    return passesEmpresa && passesEstado && passesSearch
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Gestión de Usuarios
              </h1>
              <p className="text-indigo-100 mt-1">
                {userRole === 'superadmin' 
                  ? 'Administrar usuarios de todas las empresas' 
                  : 'Administrar usuarios de tu empresa'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Estadística de usuarios */}
            <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg text-center">
              <div className="text-2xl font-bold">{filteredUsers.length}</div>
              <div className="text-sm text-indigo-100">Usuario{filteredUsers.length !== 1 ? 's' : ''}</div>
            </div>
            
            <button
              onClick={() => {
                setShowCreate(!showCreate)
                if (showCreate) {
                  setEditingId(null)
                  setForm({ username: '', password: '', id_persona: '', id_role: '' })
                }
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                showCreate 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg' 
                  : 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg hover:shadow-xl'
              }`}
            >
              {showCreate ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Cancelar
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14m7-7H5"/>
                  </svg>
                  Nuevo Usuario
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel de Filtros y Controles */}
      <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {userRole === 'superadmin' && (
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🏢 Filtrar por Empresa
                </label>
                <select
                  value={filterEmpresa}
                  onChange={(e) => setFilterEmpresa(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100 shadow-sm"
                >
                  <option value="">Todas las empresas</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id_empresa} value={empresa.id_empresa}>
                      {empresa.nombre_empresa}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro por Estado (oculto en móvil, allí se muestran chips) */}
            <div className="min-w-[200px] hidden sm:block">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ⚙️ Estado
              </label>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100 shadow-sm"
              >
                <option value="">Todos</option>
                <option value="1">Activos</option>
                <option value="0">Inactivos</option>
              </select>
            </div>

            {/* Buscador */}
            <div className="flex-1 max-w-md">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔍 Buscar Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100 shadow-sm"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
            </div>
            {/* Chips de estado en móvil */}
            <div className="sm:hidden flex items-center gap-2 mt-2">
              {[
                {label: 'Todos', val: ''},
                {label: 'Activos', val: '1'},
                {label: 'Inactivos', val: '0'}
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setFilterEstado(opt.val)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    filterEstado === opt.val
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-fit">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm text-center">
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{users.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{filteredUsers.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Mostrados</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm text-center">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{roles.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Roles</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{userRole === 'superadmin' ? empresas.length : 1}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Empresa{empresas.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Formulario de Creación/Edición */}
      {showCreate && (
        <div className="m-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 rounded-xl shadow-lg border border-blue-200 dark:border-gray-600 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              {editingId ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Campo Usuario */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Nombre de Usuario <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={e => {
                    const value = e.target.value
                    setForm({ ...form, username: value })
                    validateField('username', value)
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 ${
                    formErrors.username 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="Ej: jdoe, admin123"
                />
                {formErrors.username && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {formErrors.username}
                  </p>
                )}
              </div>

              {/* Campo Contraseña */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  Contraseña 
                  {editingId ? (
                    <span className="text-xs text-gray-500 ml-2">(dejar vacío para mantener actual)</span>
                  ) : (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingId}
                  value={form.password}
                  onChange={e => {
                    const value = e.target.value
                    setForm({ ...form, password: value })
                    validateField('password', value)
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 ${
                    formErrors.password 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  placeholder="Contraseña segura"
                />
                {formErrors.password && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {formErrors.password}
                  </p>
                )}
              </div>

              {/* Campo Persona */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Persona Vinculada <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  value={form.id_persona}
                  onChange={e => {
                    const value = e.target.value
                    setForm({ ...form, id_persona: value })
                    validateField('id_persona', value)
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 ${
                    formErrors.id_persona 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  disabled={loadingPersonas}
                  required
                >
                  <option value="">{loadingPersonas ? '⏳ Cargando personas...' : '👤 Seleccione una persona'}</option>
                  {personas.map(p => (
                    <option key={p.id_persona} value={p.id_persona}>
                      {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''} (ID: {p.id_persona})
                    </option>
                  ))}
                </select>
                {formErrors.id_persona && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {formErrors.id_persona}
                  </p>
                )}
              </div>

              {/* Campo Rol */}
              <div className="space-y-2">
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Rol del Sistema
                </label>
                <select
                  value={form.id_role}
                  onChange={e => {
                    const value = e.target.value
                    setForm({ ...form, id_role: value })
                    validateField('id_role', value)
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 ${
                    formErrors.id_role 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                  }`}
                  disabled={loadingRoles}
                >
                  <option value="">{loadingRoles ? '⏳ Cargando roles...' : '🔑 Seleccione un rol (opcional)'}</option>
                  {roles.map(r => (
                    <option key={r.idrole} value={r.idrole}>
                      🔹 {r.name}
                    </option>
                  ))}
                </select>
                {formErrors.id_role && (
                  <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    {formErrors.id_role}
                  </p>
                )}
              </div>

              {/* Campo Estado: visible para admin y superadmin */}
              {(userRole === 'admin' || userRole === 'superadmin') && (
                <div className="space-y-2">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    Estado del Usuario
                  </label>
                  <select
                    value={form.estado}
                    onChange={e => setForm({ ...form, estado: Number(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100 transition-all duration-200"
                  >
                    <option value={1}>✅ Activo (puede ingresar al sistema)</option>
                    <option value={0}>🚫 Inactivo (bloqueado)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Los usuarios inactivos no podrán iniciar sesión
                  </p>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-600">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : editingId ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                    Actualizar Usuario
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 5v14m7-7H5"/>
                    </svg>
                    Crear Usuario
                  </>
                )}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setForm({ username: '', password: '', id_persona: '', id_role: '' })
                    setShowCreate(false)
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
      )}

      {/* Lista de Usuarios */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-8xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No hay usuarios disponibles
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {users.length === 0 
                ? "Aún no se han registrado usuarios en el sistema." 
                : "No hay usuarios que coincidan con los filtros actuales."}
            </p>
            {users.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 5v14m7-7H5"/>
                </svg>
                Crear Primer Usuario
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Vista Desktop - Tabla */}
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Persona Vinculada
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Rol del Sistema
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id_user} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="relative mr-3">
                              {user.fotoPersona ? (
                                <img 
                                  src={`${API}${user.fotoPersona}`} 
                                  alt={user.username}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextElementSibling.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div 
                                className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                style={{ display: user.fotoPersona ? 'none' : 'flex' }}
                              >
                                {user.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {user.username}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                ID: {user.id_user}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {getPersonaName(user.id_persona)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Persona ID: {user.id_persona || 'Sin asignar'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            getRoleName(user.id_role) === 'superadmin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            getRoleName(user.id_role) === 'admin' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            getRoleName(user.id_role) === 'editor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {getRoleName(user.id_role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              user.estado === 1 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              <div className={`w-2 h-2 rounded-full mr-1 ${user.estado === 1 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                              {user.estado === 1 ? 'Activo' : 'Inactivo'}
                            </span>
                            {(userRole === 'admin' || userRole === 'superadmin') && (
                              <EstadoQuickSelect user={user} API={API} userRole={userRole} onUpdated={loadUsers} />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="inline-flex items-center p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                              title="Editar usuario"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(user.id_user)}
                              className="inline-flex items-center p-2 text-red-600 hover:text-red-900 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900 rounded-lg transition-colors"
                              title="Eliminar usuario"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vista Mobile - Cards */}
            <div className="lg:hidden space-y-4">
              {filteredUsers.map((user, index) => (
                <div key={user.id_user} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="relative mr-3">
                          {user.fotoPersona ? (
                            <img 
                              src={`${API}${user.fotoPersona}`} 
                              alt={user.username}
                              className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextElementSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ display: user.fotoPersona ? 'none' : 'flex' }}
                          >
                            {user.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {user.username}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {user.id_user}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        getRoleName(user.id_role) === 'superadmin' ? 'bg-red-100 text-red-800' :
                        getRoleName(user.id_role) === 'admin' ? 'bg-orange-100 text-orange-800' :
                        getRoleName(user.id_role) === 'editor' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getRoleName(user.id_role)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span className="text-gray-900 dark:text-gray-100">
                          {getPersonaName(user.id_persona)}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M12 1v6m0 6v6"/>
                        </svg>
                        <span className={`text-xs ${user.estado === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {user.estado === 1 ? '● Activo' : '● Inactivo'}
                        </span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={() => handleEdit(user)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                        </svg>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(user.id_user)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Eliminar
                      </button>
                      {(userRole === 'admin' || userRole === 'superadmin') && (
                        <div className="flex-1">
                          <EstadoQuickSelect user={user} API={API} userRole={userRole} onUpdated={loadUsers} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Pequeño selector inline para cambiar estado rápidamente sin abrir el formulario
function EstadoQuickSelect({ user, API, userRole, onUpdated }){
  const toast = useToast()
  const [saving, setSaving] = React.useState(false)
  const [value, setValue] = React.useState(user?.estado ?? 1)

  const update = async (newVal) => {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        username: user.username,
        password: undefined,
        id_persona: user.id_persona ?? null,
        id_role: user.id_role ?? null,
        estado: Number(newVal)
      }
      const res = await fetch(`${API}/users/${user.id_user}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.detail || `Error HTTP ${res.status}`)
      }
      toast.push('Estado actualizado', 'success')
      onUpdated && onUpdated()
    } catch (e) {
      console.error('Error cambiando estado:', e)
      toast.push(e?.message || 'No se pudo actualizar el estado', 'error')
      // revert local select
      setValue(user.estado ?? 1)
    } finally {
      setSaving(false)
    }
  }

  // Toggle switch UI
  return (
    <label className={`inline-flex items-center cursor-pointer select-none ${saving ? 'opacity-60 pointer-events-none' : ''}`} title="Cambiar estado">
      <input
        type="checkbox"
        className="sr-only"
        checked={Number(value) === 1}
        onChange={e => {
          const newVal = e.target.checked ? 1 : 0
          setValue(newVal)
          update(newVal)
        }}
        disabled={saving}
      />
      <span className={`w-9 h-5 flex items-center bg-gray-300 rounded-full p-0.5 transition-colors ${Number(value) === 1 ? 'bg-green-500' : 'bg-gray-400'} dark:bg-gray-700`}>
        <span className={`bg-white dark:bg-gray-200 w-4 h-4 rounded-full transform transition-transform ${Number(value) === 1 ? 'translate-x-4' : ''}`}></span>
      </span>
      <span className={`ml-2 text-xs ${Number(value) === 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {Number(value) === 1 ? 'Activo' : 'Inactivo'}
      </span>
    </label>
  )
}
