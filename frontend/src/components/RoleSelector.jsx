import React, { useState, useEffect } from 'react'
import { useToast } from '../ToastContext'

export default function RoleSelector({role, onChange, API = 'http://localhost:8002', showAdmin = false}){
  const toast = useToast();
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedRole, setSelectedRole] = useState(null)
  const [rolePermissions, setRolePermissions] = useState([])
  const [editingRole, setEditingRole] = useState(null)
  const [editForm, setEditForm] = useState({name: '', description: ''})
  const [showPermissions, setShowPermissions] = useState(false)
  const [error, setError] = useState(null)

  useEffect(()=>{
    if(showAdmin && role) {
      fetchRoles();
      fetchPermissions();
    }
  }, [showAdmin, role])

  const fetchRoles = async ()=>{
    try{
      const res = await fetch(`${API}/roles`, { credentials: 'include', headers: role ? { 'X-User-Role': role } : {} })
      if(res.ok) setRoles(await res.json())
    }catch(e){ console.error('Error cargando roles:', e) }
  }

  const fetchPermissions = async ()=>{
    try{
      const res = await fetch(`${API}/permissions`, { credentials: 'include', headers: role ? { 'X-User-Role': role } : {} })
      if(res.ok) setPermissions(await res.json())
    }catch(e){ console.error('Error cargando permisos:', e) }
  }

  const fetchRolePermissions = async (roleId)=>{
    try{
      const res = await fetch(`${API}/roles/${roleId}/permissions`, { credentials: 'include', headers: role ? { 'X-User-Role': role } : {} })
      if(res.ok) setRolePermissions(await res.json())
    }catch(e){ console.error('Error cargando permisos del rol:', e) }
  }

  const handleUpdateRole = async (roleId)=>{
    setError(null)
    try{
      const res = await fetch(`${API}/roles/${roleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {'Content-Type':'application/json', ...(role ? {'X-User-Role': role} : {})},
        body: JSON.stringify(editForm)
      })
      if(!res.ok) throw new Error('Error actualizando rol')
      setEditingRole(null)
      fetchRoles()
      try{ toast.push('Rol actualizado correctamente','success') }catch(e){}
    }catch(e){ setError(e.message) }
  }

  const handleUpdatePermissions = async (roleId, permIds)=>{
    setError(null)
    try{
      const res = await fetch(`${API}/roles/${roleId}/permissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: {'Content-Type':'application/json', ...(role ? {'X-User-Role': role} : {})},
        body: JSON.stringify({perm_ids: permIds})
      })
      if(res.status !== 204) throw new Error('Error actualizando permisos')
      fetchRolePermissions(roleId)
    }catch(e){ setError(e.message) }
  }

  const [pendingPerms, setPendingPerms] = useState([]);
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(()=>{
    setPendingPerms(rolePermissions);
  }, [rolePermissions, showPermissions]);

  const togglePermission = (permId)=>{
    setPendingPerms(prev => prev.includes(permId)
      ? prev.filter(p => p !== permId)
      : [...prev, permId]
    );
  }

  const savePermissions = async ()=>{
    if(!selectedRole) return;
    setSavingPerms(true);
    await handleUpdatePermissions(selectedRole.idrole, pendingPerms);
    setSavingPerms(false);
    toast.push('Permisos guardados correctamente','success');
  }

  if(!showAdmin){
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rol:</label>
        <select 
          value={role} 
          onChange={e=>onChange(e.target.value)} 
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
    )
  }

  if(error && (error.includes('401') || error.includes('403'))){
    return (
      <div className="bg-red-100 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded p-4">
        <strong>Acceso denegado:</strong> Debes iniciar sesión como administrador para ver y editar roles y permisos.
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Administración de Roles y Permisos</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}

      {/* Lista de roles */}
      <div className="grid gap-4">
        {roles.map(r => (
          <div key={r.idrole} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
            {editingRole === r.idrole ? (
              <div className="space-y-3">
                <input
                  value={editForm.name}
                  onChange={e=>setEditForm(f=>({...f, name: e.target.value}))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Nombre del rol"
                />
                <input
                  value={editForm.description}
                  onChange={e=>setEditForm(f=>({...f, description: e.target.value}))}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Descripción"
                />
                <div className="flex gap-2">
                  <button
                    onClick={()=>handleUpdateRole(r.idrole)}
                    className="btn btn-primary"
                  >
                    ✓ Guardar
                  </button>
                  <button
                    onClick={()=>setEditingRole(null)}
                    className="btn btn-secondary"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{r.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={()=>{setEditingRole(r.idrole); setEditForm({name: r.name, description: r.description || ''})}}
                      className="btn btn-secondary"
                    >
                      ✎ Editar Nombre
                    </button>
                    <button
                      onClick={()=>{
                        setSelectedRole(r)
                        setShowPermissions(!showPermissions || selectedRole?.idrole !== r.idrole)
                        if(!showPermissions || selectedRole?.idrole !== r.idrole) fetchRolePermissions(r.idrole)
                      }}
                      className="btn btn-primary"
                    >
                      🔐 Permisos
                    </button>
                  </div>
                </div>
                
                {/* Panel de permisos */}
                {showPermissions && selectedRole?.idrole === r.idrole && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Permisos de {r.name}:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {permissions.map(perm => (
                        <label key={perm.id_perm} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <input
                            type="checkbox"
                            checked={pendingPerms.includes(perm.id_perm)}
                            onChange={()=>togglePermission(perm.id_perm)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            <strong>{perm.resource}</strong>:{perm.action}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="btn btn-primary" disabled={savingPerms} onClick={savePermissions}>{savingPerms ? 'Guardando...' : 'Guardar cambios de permisos'}</button>
                      <button className="btn btn-secondary" onClick={()=>{setShowPermissions(false); setSelectedRole(null);}}>Cerrar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdmin && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map(roleObj => (
              <div key={roleObj.idrole} className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4 shadow">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold text-lg text-gray-800 dark:text-gray-100">{roleObj.name}</span>
                    <span className="ml-2 text-xs text-gray-500">ID: {roleObj.idrole}</span>
                  </div>
                  <button className="btn btn-blue" onClick={()=>{setSelectedRole(roleObj); fetchRolePermissions(roleObj.idrole); setShowPermissions(true)}}>Permisos</button>
                </div>
                <div className="mb-2 text-gray-700 dark:text-gray-300">{roleObj.description}</div>
                <button className="btn btn-secondary" onClick={()=>{setEditingRole(roleObj.idrole); setEditForm({name:roleObj.name, description:roleObj.description})}}>Editar Nombre</button>
                {editingRole === roleObj.idrole && (
                  <div className="mt-2">
                    <input value={editForm.name} onChange={e=>setEditForm(f=>({...f, name:e.target.value}))} className="p-2 border rounded w-full mb-1" />
                    <input value={editForm.description} onChange={e=>setEditForm(f=>({...f, description:e.target.value}))} className="p-2 border rounded w-full mb-1" />
                    <button className="btn btn-green" onClick={()=>handleUpdateRole(roleObj.idrole)}>Guardar</button>
                    <button className="btn btn-secondary" onClick={()=>setEditingRole(null)}>Cancelar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {showPermissions && selectedRole && (
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-2">Permisos para: {selectedRole.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {permissions.map(perm => (
                  <label key={perm.id_perm} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <input type="checkbox" checked={rolePermissions.includes(perm.id_perm)} onChange={()=>togglePermission(perm.id_perm)} />
                    <span>{perm.resource} - {perm.action}</span>
                  </label>
                ))}
              </div>
              <button className="btn btn-secondary mt-4" onClick={()=>setShowPermissions(false)}>Cerrar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
