import React, { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'

export default function Usuarios({ API, userRole = 'admin' }) {
  const [users, setUsers] = useState([])
  const [personas, setPersonas] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPersonas, setLoadingPersonas] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', id_persona: '', id_role: '' })
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/users`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Error cargando usuarios')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
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

  useEffect(() => {
    loadUsers()
    loadPersonas()
    loadRoles()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password || !form.id_persona) {
      toast.push('Usuario, contraseña y persona son requeridos', 'error')
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
      setForm({ username: '', password: '', id_persona: '', id_role: '' })
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
      id_role: user.id_role || ''
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

  if (userRole !== 'admin') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
        <p className="text-red-600 dark:text-red-400">Solo administradores pueden gestionar usuarios</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
        <button
          onClick={() => {
            setShowCreate(!showCreate)
            if (showCreate) {
              setEditingId(null)
              setForm({ username: '', password: '', id_persona: '', id_role: '' })
            }
          }}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            showCreate ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {showCreate ? '− Cancelar' : '+ Nuevo Usuario'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-gray-800 shadow-md">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-300">
            {editingId ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Usuario <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="Nombre de usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contraseña {editingId && <span className="text-xs text-gray-500">(dejar vacío para mantener)</span>}
                {!editingId && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                required={!editingId}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="Contraseña"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Persona <span className="text-red-500">*</span>
                </label>
              <select
                value={form.id_persona}
                onChange={e => setForm({ ...form, id_persona: e.target.value })}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                disabled={loadingPersonas}
                required
              >
                <option value="">{loadingPersonas ? 'Cargando...' : 'Seleccione persona'}</option>
                {personas.map(p => (
                  <option key={p.id_persona} value={p.id_persona}>
                    {p.nombres_persona} {p.apellido_paternoPersona} {p.apellido_maternoPer || ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rol
              </label>
              <select
                value={form.id_role}
                onChange={e => setForm({ ...form, id_role: e.target.value })}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                disabled={loadingRoles}
              >
                <option value="">{loadingRoles ? 'Cargando...' : 'Seleccionar rol'}</option>
                {roles.map(r => (
                  <option key={r.idrole} value={r.idrole}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : (editingId ? 'Actualizar Usuario' : 'Crear Usuario')}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setForm({ username: '', password: '', id_persona: '', id_role: '' })
                    setShowCreate(false)
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-4 text-center">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No hay usuarios registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                  <th className="px-4 py-2 text-left">Persona</th>
                  <th className="px-4 py-2 text-left">Rol</th>
                  <th className="px-4 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id_user} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2">{user.id_user}</td>
                    <td className="px-4 py-2 font-medium">{user.username}</td>
                    <td className="px-4 py-2">{getPersonaName(user.id_persona)}</td>
                    <td className="px-4 py-2">{getRoleName(user.id_role)}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-3"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(user.id_user)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
