import React, { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'

export default function RoleManagement({ API, userRole = 'admin', onPermissionsUpdate }) {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [rolePermissions, setRolePermissions] = useState({})
  const [empresas, setEmpresas] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmpresa, setSelectedEmpresa] = useState('all') // 'all' para ver todos
  const [editingRole, setEditingRole] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('users') // 'users' or 'roles'
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedUsers, setExpandedUsers] = useState(new Set())
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all')
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRoleEmpresa, setNewRoleEmpresa] = useState('all')
  const toast = useToast()

  // Cargar roles (excluyendo superadmin para no-superadmin)
  const loadRoles = async () => {
    try {
      const res = await fetch(`${API}/roles`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (!res.ok) {
        if (res.status === 401) {
          window.location.reload()
          return
        }
        throw new Error(`Error cargando roles: HTTP ${res.status}`)
      }
      const data = await res.json()
      // Filtrar superadmin si no es superadmin
      const filteredRoles = Array.isArray(data) 
        ? data.filter(role => userRole === 'superadmin' || role.name !== 'superadmin')
        : []
      setRoles(filteredRoles)
    } catch (err) {
      console.error('Error loading roles:', err)
      setError(err.message)
    }
  }

  // Cargar permisos disponibles
  const loadPermissions = async () => {
    try {
      const res = await fetch(`${API}/permissions`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setPermissions(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading permissions:', err)
    }
  }

  // Cargar permisos por rol
  const loadRolePermissions = async () => {
    try {
      const res = await fetch(`${API}/role-permissions`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        // Convertir a formato { roleId: [permissionIds] }
        const rolePermsMap = {}
        if (Array.isArray(data)) {
          data.forEach(rp => {
            if (!rolePermsMap[rp.role_id]) {
              rolePermsMap[rp.role_id] = []
            }
            rolePermsMap[rp.role_id].push(rp.perm_id)
          })
        }
        setRolePermissions(rolePermsMap)
      }
    } catch (err) {
      console.error('Error loading role permissions:', err)
    }
  }

  // Cargar empresas
  const loadEmpresas = async () => {
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
        // Backend devuelve {items: [...], total: N} o array directo
        const empresasList = data.items || (Array.isArray(data) ? data : [])
        setEmpresas(empresasList)
        
        // Superadmin: no tiene empresa (id_empresa = NULL), ve todas
        // Admin: tiene empresa, auto-seleccionar su única empresa
        if (userRole !== 'superadmin' && empresasList.length > 0) {
          setSelectedEmpresa(empresasList[0].id_empresa.toString())
        }
      }
    } catch (err) {
      console.error('Error loading empresas:', err)
    }
  }

  // Cargar usuarios con sus roles (respetando jerarquía multiempresa)
  const loadUsers = async () => {
    try {
      // Superadmin: ve todos (incluidos otros superadmins) - sin id_empresa
      // Admin: solo ve usuarios de su empresa (backend excluye superadmins automáticamente)
      const res = await fetch(`${API}/users`, {
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (res.ok) {
        let data = await res.json()
        
        if (Array.isArray(data)) {
          // Backend ya filtra: admin no recibe superadmins
          // Superadmin recibe todo (incluidos otros superadmins)
          setUsers(data)
        }
      }
    } catch (err) {
      console.error('Error loading users:', err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          loadRoles(),
          loadPermissions(),
          loadRolePermissions(),
          loadEmpresas(),
          loadUsers()
        ])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Crear rol (multiempresa)
  const createRole = async () => {
    if (!newRoleName || newRoleName.trim().length < 3) {
      toast.push('El nombre del rol debe tener al menos 3 caracteres', 'error')
      return
    }
    try {
      const payload = {
        name: newRoleName.trim(),
        description: newRoleDesc?.trim() || null
      }
      if (userRole === 'superadmin') {
        // superadmin: puede crear global (id_empresa=null) o para una empresa específica
        payload.id_empresa = (newRoleEmpresa && newRoleEmpresa !== 'all') ? Number(newRoleEmpresa) : null
      }
      const res = await fetch(`${API}/roles`, {
        method: 'POST',
        headers: {
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.detail || `HTTP ${res.status}`)
      }
      toast.push('Rol creado', 'success')
      setShowCreateRole(false)
      setNewRoleName(''); setNewRoleDesc(''); setNewRoleEmpresa('all')
      await loadRoles()
    } catch (err) {
      console.error('Error creando rol:', err)
      toast.push(err.message || 'Error creando rol', 'error')
    }
  }

  // Guardar permisos de un rol
  const saveRolePermissions = async (roleId, permissionIds) => {
    setSaving(true)
    try {
      // Build payload with multiempresa awareness
      const body = { perm_ids: permissionIds.map(Number).filter(n => Number.isInteger(n)) }
      if (userRole === 'superadmin') {
        body.target_company_id = (selectedEmpresa && selectedEmpresa !== 'all') ? Number(selectedEmpresa) : null
      }

      const res = await fetch(`${API}/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: { 
          'X-User-Role': userRole,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
      })
      
      if (!res.ok) {
        throw new Error(`Error guardando permisos: HTTP ${res.status}`)
      }
      
      // Actualizar estado local
      setRolePermissions(prev => ({
        ...prev,
        [roleId]: permissionIds
      }))
      
  try { toast.push('Permisos actualizados correctamente', 'success') } catch (e) { try { (await import('../toast')).showToast('Permisos actualizados correctamente', 'success') } catch(_){} }
      setEditingRole(null)
      
      // Refrescar permisos del usuario si está disponible la función
      if (onPermissionsUpdate) {
        console.log('🔄 Triggering permissions update for role:', roleId)
        console.log('👤 Current user role check - updating role permissions may affect current session')
        setTimeout(() => {
          console.log('📞 Calling onPermissionsUpdate callback to refresh user session')
          onPermissionsUpdate()
        }, 500) // Pequeño delay para asegurar que el backend se actualice
      } else {
        console.log('⚠️ onPermissionsUpdate callback not available - permissions may not refresh immediately')
      }
    } catch (err) {
  console.error('Error saving role permissions:', err)
  try { toast.push('Error guardando permisos: ' + err.message, 'error') } catch (e) { try { (await import('../toast')).showToast('Error guardando permisos: ' + err.message, 'error') } catch(_){} }
    } finally {
      setSaving(false)
    }
  }

  // Toggle permiso para un rol
  const togglePermission = (roleId, permissionId) => {
    const currentPerms = rolePermissions[roleId] || []
    const newPerms = currentPerms.includes(permissionId)
      ? currentPerms.filter(id => id !== permissionId)
      : [...currentPerms, permissionId]
    
    setRolePermissions(prev => ({
      ...prev,
      [roleId]: newPerms
    }))
  }

  // Agrupar permisos por recurso
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = []
    }
    acc[perm.resource].push(perm)
    return acc
  }, {})

  // Filtrar usuarios según empresa seleccionada, rol y término de búsqueda
  const filteredUsers = users.filter(user => {
    // Filtrar por empresa
    if (userRole === 'superadmin') {
      // Si es superadmin y seleccionó una empresa específica
      if (selectedEmpresa !== 'all' && user.id_empresa !== parseInt(selectedEmpresa)) {
        return false
      }
    }
    
    // Filtrar por rol seleccionado
    if (selectedRoleFilter !== 'all' && user.role_name !== selectedRoleFilter) {
      return false
    }
    
    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return user.username?.toLowerCase().includes(term) || 
             user.role_name?.toLowerCase().includes(term) ||
             user.nombres_persona?.toLowerCase().includes(term) ||
             user.nombre_empresa?.toLowerCase().includes(term)
    }
    
    return true
  })

  // Agrupar usuarios por empresa y rol
  const groupedUsers = filteredUsers.reduce((acc, user) => {
    // Superadmin users (sin empresa) van a clave 'superadmin_group'
    // Usuarios con empresa van agrupados por id_empresa
    const empresaKey = user.role_name === 'superadmin' ? 'superadmin_group' : (user.id_empresa || 'sin_empresa')
    const roleKey = user.role_name || 'sin_role'
    
    if (!acc[empresaKey]) {
      acc[empresaKey] = {
        empresa: empresaKey === 'superadmin_group' 
          ? { nombre_empresa: '🔐 Super Administradores', id_empresa: null }
          : (empresas.find(e => e.id_empresa === user.id_empresa) || { nombre_empresa: user.nombre_empresa || 'Sin Empresa' }),
        roles: {}
      }
    }
    
    if (!acc[empresaKey].roles[roleKey]) {
      acc[empresaKey].roles[roleKey] = {
        role: roles.find(r => r.name === roleKey) || { name: roleKey, idrole: null },
        users: []
      }
    }
    
    acc[empresaKey].roles[roleKey].users.push(user)
    return acc
  }, {})

  const toggleUserExpansion = (userId) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="m22 21-3-3m0 0a5.5 5.5 0 1 0-7.78 0L15 18l3 3Z"/>
              </svg>
              Administración de Roles y Permisos
            </h1>
            <p className="text-blue-100 mt-2">
              {userRole === 'superadmin' 
                ? 'Gestión completa de usuarios, roles y permisos por empresa' 
                : 'Administrar permisos de usuarios en tu empresa'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-100">Rol actual</div>
            <div className="text-lg font-semibold capitalize">{userRole}</div>
          </div>
        </div>
      </div>

      {/* Controles y Filtros */}
      <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Selector de modo de vista */}
          <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setViewMode('users')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                viewMode === 'users' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              👥 Por Usuarios
            </button>
            <button
              onClick={() => setViewMode('roles')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                viewMode === 'roles' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              🔑 Por Roles
            </button>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar usuarios, roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Filtro por empresa */}
          {userRole === 'superadmin' ? (
            <select
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 min-w-[200px]"
            >
              <option value="all">🏢 Todas las empresas</option>
              {empresas.map((empresa) => (
                <option key={empresa.id_empresa} value={empresa.id_empresa}>
                  {empresa.nombre_empresa}
                </option>
              ))}
            </select>
          ) : empresas.length > 0 && (
            <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-800 dark:text-blue-200 font-medium min-w-[200px]">
              🏢 {empresas[0].nombre_empresa}
            </div>
          )}
          
          {/* Filtro por rol */}
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 min-w-[180px]"
          >
            <option value="all">🔑 Todos los roles</option>
            {roles.map((role) => (
              <option key={role.idrole} value={role.name}>
                {role.display_name || role.name}
              </option>
            ))}
          </select>

          {/* Botón crear rol */}
          <button
            onClick={() => setShowCreateRole(v => !v)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${showCreateRole ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
          >
            {showCreateRole ? 'Cancelar' : '➕ Nuevo rol'}
          </button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Usuarios</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{filteredUsers.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-600 dark:text-gray-400">Roles Activos</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{roles.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-600 dark:text-gray-400">Permisos</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{permissions.length}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-600 dark:text-gray-400">Empresas</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{userRole === 'superadmin' ? empresas.length : 1}</div>
          </div>
        </div>

        {/* Panel creación de rol */}
        {showCreateRole && (
          <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Crear nuevo rol
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Ej: cajero, vendedor, auditor"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Breve descripción del rol"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {userRole === 'superadmin' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Empresa</label>
                  <select
                    value={newRoleEmpresa}
                    onChange={(e) => setNewRoleEmpresa(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">🌐 Global (todas)</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id_empresa} value={empresa.id_empresa}>
                        {empresa.nombre_empresa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateRole(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={createRole}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Crear rol
              </button>
            </div>
          </div>
        )}
      </div>

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

      {/* Contenido Principal */}
      <div className="p-6">
        {viewMode === 'users' ? (
          /* Vista por Usuarios */
          <div className="space-y-6">
            {Object.entries(groupedUsers).map(([empresaKey, empresaData]) => (
              <div key={empresaKey} className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                {/* Header de Empresa */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/>
                      <rect x="3" y="8" width="18" height="13" rx="2"/>
                    </svg>
                    <h3 className="text-xl font-bold">{empresaData.empresa.nombre_empresa}</h3>
                    <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-sm">
                      {Object.values(empresaData.roles).reduce((sum, roleData) => sum + roleData.users.length, 0)} usuarios
                    </span>
                  </div>
                </div>

                {/* Roles dentro de la empresa */}
                <div className="p-4 space-y-4">
                  {Object.entries(empresaData.roles).map(([roleKey, roleData]) => (
                    <div key={roleKey} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                      {/* Header del rol */}
                      <div className="bg-gray-100 dark:bg-gray-700 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            roleKey === 'superadmin' ? 'bg-red-500' :
                            roleKey === 'admin' ? 'bg-orange-500' :
                            roleKey === 'editor' ? 'bg-blue-500' :
                            'bg-green-500'
                          }`}></div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
                            {roleKey}
                          </h4>
                          <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full text-xs text-gray-600 dark:text-gray-300">
                            {roleData.users.length} usuario{roleData.users.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {roleData.role.idrole && (
                          <button
                            onClick={() => setEditingRole(editingRole === roleData.role.idrole ? null : roleData.role.idrole)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                            </svg>
                            {editingRole === roleData.role.idrole ? 'Cerrar' : 'Permisos'}
                          </button>
                        )}
                      </div>

                      {/* Lista de usuarios */}
                      <div className="p-3">
                        <div className="grid gap-2">
                          {roleData.users.map((user) => (
                            <div key={user.id_user} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-sm transition-shadow">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  {user.fotoPersona ? (
                                    <img 
                                      src={`${API}${user.fotoPersona}`} 
                                      alt={user.nombres_persona}
                                      className="w-10 h-10 rounded-full object-cover border-2 border-blue-200 dark:border-blue-700"
                                      onError={(e) => {
                                        e.target.style.display = 'none'
                                        e.target.nextElementSibling.style.display = 'flex'
                                      }}
                                    />
                                  ) : null}
                                  <div 
                                    className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                    style={{ display: user.fotoPersona ? 'none' : 'flex' }}
                                  >
                                    {user.nombres_persona?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {user.nombres_persona} {user.apellido_paternoPersona}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    @{user.username} • CI: {user.ci_persona}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                                  Empresa: {user.nombre_empresa || 'N/A'}
                                </span>
                                <button
                                  onClick={() => toggleUserExpansion(user.id_user)}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                  <svg className={`w-4 h-4 transition-transform ${expandedUsers.has(user.id_user) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="m6 9 6 6 6-6"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Editor de permisos para el rol */}
                      {editingRole === roleData.role.idrole && (
                        <div className="border-t bg-gray-50 dark:bg-gray-700 p-4">
                          <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                            Configurar permisos para rol: {roleKey}
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {Object.entries(groupedPermissions).map(([resource, perms]) => (
                              <div key={resource} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-3 capitalize flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  {resource}
                                </h6>
                                <div className="space-y-2">
                                  {perms.map((perm) => (
                                    <label key={perm.id_perm} className="flex items-center space-x-3 cursor-pointer group">
                                      <input
                                        type="checkbox"
                                        checked={(rolePermissions[roleData.role.idrole] || []).includes(perm.id_perm)}
                                        onChange={() => togglePermission(roleData.role.idrole, perm.id_perm)}
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                      />
                                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {perm.action}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <button
                              onClick={() => setEditingRole(null)}
                              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                              Cancelar
                            </button>
                            <button
                              onClick={() => saveRolePermissions(roleData.role.idrole, rolePermissions[roleData.role.idrole] || [])}
                              disabled={saving}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                              {saving ? (
                                <>
                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M5 13l4 4L19 7"/>
                                  </svg>
                                  Guardar Cambios
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(groupedUsers).length === 0 && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-8xl mb-4">👥</div>
                <h3 className="text-xl font-semibold mb-2">No se encontraron usuarios</h3>
                <p className="text-gray-400">
                  {searchTerm ? 'Intenta con un término de búsqueda diferente' : 'No hay usuarios para mostrar'}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Vista por Roles (Vista clásica mejorada) */
          <div className="space-y-6">
            {roles.map((role) => (
              <div key={role.idrole} className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      role.name === 'superadmin' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                      role.name === 'admin' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                      role.name === 'editor' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                      'bg-gradient-to-br from-green-500 to-green-600'
                    }`}>
                      {role.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                        {role.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {(rolePermissions[role.idrole] || []).length} permisos asignados
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingRole(editingRole === role.idrole ? null : role.idrole)}
                    className={`px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 ${
                      editingRole === role.idrole 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {editingRole === role.idrole ? '✕ Cerrar' : '⚙️ Editar Permisos'}
                  </button>
                </div>

                {editingRole === role.idrole && (
                  <div className="border-t bg-gray-50 dark:bg-gray-700 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                      {Object.entries(groupedPermissions).map(([resource, perms]) => (
                        <div key={resource} className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 capitalize flex items-center gap-2">
                            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                            {resource}
                          </h4>
                          <div className="space-y-3">
                            {perms.map((perm) => (
                              <label key={perm.id_perm} className="flex items-center space-x-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={(rolePermissions[role.idrole] || []).includes(perm.id_perm)}
                                  onChange={() => togglePermission(role.idrole, perm.id_perm)}
                                  className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">
                                  {perm.action}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={() => setEditingRole(null)}
                        className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveRolePermissions(role.idrole, rolePermissions[role.idrole] || [])}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        {saving ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7"/>
                            </svg>
                            Guardar Cambios
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {roles.length === 0 && (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <div className="text-8xl mb-4">🔒</div>
                <h3 className="text-xl font-semibold mb-2">No se encontraron roles</h3>
                <p className="text-gray-400">No hay roles disponibles para administrar</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}