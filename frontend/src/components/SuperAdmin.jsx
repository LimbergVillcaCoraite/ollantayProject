import React, { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'

export default function SuperAdmin({ API, userRole = 'admin' }) {
  const [users, setUsers] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [tipos, setTipos] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateEmpresa, setShowCreateEmpresa] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    nombres_persona: '',
    apellido_paternoPersona: '',
    apellido_maternoPer: '',
    telefono_persona: '',
    ci_persona: '',
    direccion_persona: '',
    id_tipoPersona: '',
    id_empresa: '',
    role_name: ''
  })

  const [empresaForm, setEmpresaForm] = useState({
    nombre_empresa: '',
    direccion_empresa: '',
    estado_empresa: 1
  })

  // Only allow superadmin to use this component
  if (userRole !== 'superadmin') {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="text-center text-red-600 dark:text-red-400">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p>Solo el superadmin puede acceder a esta sección.</p>
        </div>
      </div>
    )
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all users (superadmin endpoint)
      const usersRes = await fetch(`${API}/admin/users`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (usersRes.ok) {
        const userData = await usersRes.json()
        setUsers(userData.users || [])
      }

      // Load empresas
      const empresasRes = await fetch(`${API}/empresas`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (empresasRes.ok) {
        const empresaData = await empresasRes.json()
        setEmpresas(empresaData.items || [])
      }

      // Load roles
      const rolesRes = await fetch(`${API}/roles`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (rolesRes.ok) {
        const roleData = await rolesRes.json()
        setRoles(roleData || [])
      }

      // Load tipos persona
      const tiposRes = await fetch(`${API.replace('/personas', '/tipos')}/types`, {
        headers: { 'X-User-Role': userRole }
      })
      if (tiposRes.ok) {
        const tipoData = await tiposRes.json()
        setTipos(tipoData || [])
      }

    } catch (err) {
      toast.push(err.message || 'Error cargando datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [API, userRole])

  const submitUser = async (e) => {
    e.preventDefault()
    if (!userForm.username.trim() || !userForm.password || !userForm.nombres_persona.trim() || 
        !userForm.ci_persona.trim() || !userForm.direccion_persona.trim() || 
        !userForm.id_tipoPersona || !userForm.id_empresa || !userForm.role_name) {
      toast.push('Todos los campos son obligatorios', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': userRole
        },
        credentials: 'include',
        body: JSON.stringify({
          ...userForm,
          id_tipoPersona: Number(userForm.id_tipoPersona),
          id_empresa: Number(userForm.id_empresa)
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.detail || 'Error creando usuario')
      }

      const data = await res.json()
      toast.push(data.message || 'Usuario creado exitosamente', 'success')
      
      // Reset form
      setUserForm({
        username: '',
        password: '',
        nombres_persona: '',
        apellido_paternoPersona: '',
        apellido_maternoPer: '',
        telefono_persona: '',
        ci_persona: '',
        direccion_persona: '',
        id_tipoPersona: '',
        id_empresa: '',
        role_name: ''
      })
      setShowCreateUser(false)
      loadData() // Reload users

    } catch (err) {
      toast.push(err.message || 'Error creando usuario', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const submitEmpresa = async (e) => {
    e.preventDefault()
    if (!empresaForm.nombre_empresa.trim() || !empresaForm.direccion_empresa.trim()) {
      toast.push('Nombre y dirección son obligatorios', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/empresas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': userRole
        },
        credentials: 'include',
        body: JSON.stringify(empresaForm)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.detail || 'Error creando empresa')
      }

      toast.push('Empresa creada exitosamente', 'success')
      
      // Reset form
      setEmpresaForm({
        nombre_empresa: '',
        direccion_empresa: '',
        estado_empresa: 1
      })
      setShowCreateEmpresa(false)
      loadData() // Reload data

    } catch (err) {
      toast.push(err.message || 'Error creando empresa', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="text-center">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex-1">
          Administración SuperAdmin
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateEmpresa(s => !s)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showCreateEmpresa ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            {showCreateEmpresa ? 'Cancelar' : '+ Nueva Empresa'}
          </button>
          <button 
            onClick={() => setShowCreateUser(s => !s)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showCreateUser ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {showCreateUser ? 'Cancelar' : '+ Nuevo Usuario'}
          </button>
        </div>
      </div>

      {/* Create Empresa Form */}
      {showCreateEmpresa && (
        <div className="mb-6 p-4 border-2 border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Nueva Empresa</h3>
          <form onSubmit={submitEmpresa} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre de la Empresa</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Nombre de la empresa"
                value={empresaForm.nombre_empresa}
                onChange={e => setEmpresaForm({...empresaForm, nombre_empresa: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Dirección"
                value={empresaForm.direccion_empresa}
                onChange={e => setEmpresaForm({...empresaForm, direccion_empresa: e.target.value})}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button 
                disabled={submitting} 
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creando...' : 'Crear Empresa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create User Form */}
      {showCreateUser && (
        <div className="mb-6 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Nuevo Usuario Multi-Empresa</h3>
          <form onSubmit={submitUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombre de Usuario</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Username"
                value={userForm.username}
                onChange={e => setUserForm({...userForm, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
              <input 
                type="password"
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Contraseña"
                value={userForm.password}
                onChange={e => setUserForm({...userForm, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Nombres</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Nombres"
                value={userForm.nombres_persona}
                onChange={e => setUserForm({...userForm, nombres_persona: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Apellido Paterno</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Apellido paterno"
                value={userForm.apellido_paternoPersona}
                onChange={e => setUserForm({...userForm, apellido_paternoPersona: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Apellido Materno</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Apellido materno"
                value={userForm.apellido_maternoPer}
                onChange={e => setUserForm({...userForm, apellido_maternoPer: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Teléfono"
                value={userForm.telefono_persona}
                onChange={e => setUserForm({...userForm, telefono_persona: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">CI</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Carnet de identidad"
                value={userForm.ci_persona}
                onChange={e => setUserForm({...userForm, ci_persona: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
              <input 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600" 
                placeholder="Dirección"
                value={userForm.direccion_persona}
                onChange={e => setUserForm({...userForm, direccion_persona: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tipo de Persona</label>
              <select 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600"
                value={userForm.id_tipoPersona}
                onChange={e => setUserForm({...userForm, id_tipoPersona: e.target.value})}
              >
                <option value="">Seleccionar tipo</option>
                {tipos.map(tipo => (
                  <option key={tipo.id_tipoPersona || tipo.idtipoPers} value={tipo.id_tipoPersona || tipo.idtipoPers}>
                    {tipo.nombre_tipoPersona || tipo.tipo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
              <select 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600"
                value={userForm.id_empresa}
                onChange={e => setUserForm({...userForm, id_empresa: e.target.value})}
              >
                <option value="">Seleccionar empresa</option>
                {empresas.map(empresa => (
                  <option key={empresa.id_empresa} value={empresa.id_empresa}>
                    {empresa.nombre_empresa}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Rol</label>
              <select 
                className="p-2 border w-full rounded dark:bg-gray-700 dark:border-gray-600"
                value={userForm.role_name}
                onChange={e => setUserForm({...userForm, role_name: e.target.value})}
              >
                <option value="">Seleccionar rol</option>
                {roles.map(role => (
                  <option key={role.idrole} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button 
                disabled={submitting} 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-700 rounded shadow overflow-x-auto">
        <h3 className="text-lg font-semibold p-4 border-b dark:border-gray-600 text-gray-900 dark:text-gray-100">
          Usuarios de Todas las Empresas
        </h3>
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left">Usuario</th>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">CI</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id_user} className="border-b dark:border-gray-600">
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{user.username}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                  {user.nombres_persona} {user.apellido_paternoPersona}
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{user.ci_persona}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{user.nombre_empresa}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{user.role_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}