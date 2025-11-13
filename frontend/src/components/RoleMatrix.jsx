import React, { useEffect, useState, useMemo } from 'react'

// Granular Role Matrix UI
// Fetches roles, permissions and assignments then allows bulk updates.
export default function RoleMatrix({ API, userRole }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [assignments, setAssignments] = useState({})
  const [companyId, setCompanyId] = useState(null)
  const [companies, setCompanies] = useState([])
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grouped') // grouped | flat

  const canAdmin = ['admin','superadmin'].includes(userRole)
  const isSuperAdmin = userRole === 'superadmin'

  const loadCompanies = async () => {
    if(!isSuperAdmin) return
    try {
      const res = await fetch(`${API}/empresas?limit=500`, { credentials: 'include' })
      if(!res.ok) return
      const data = await res.json()
      setCompanies(data?.items || [])
    } catch(e) { console.error(e) }
  }

  const [inherited, setInherited] = useState({})
  const loadMatrix = async () => {
    if(!canAdmin) return
    setLoading(true); setError(null)
    try {
      const qs = companyId ? `?company_id=${companyId}` : ''
      const res = await fetch(`${API}/roles/matrix${qs}`, { credentials: 'include' })
      if(!res.ok) throw new Error(`Error matrix ${res.status}`)
      const data = await res.json()
      setRoles(data.roles || [])
      setPermissions(data.permissions || [])
      setAssignments(data.assignments || {})
      // Calcular permisos heredados: para cada rol de empresa, si el permiso está asignado en global pero no en empresa
      const inh = {}
      if(companyId){
        for(const r of data.roles||[]){
          if(r.id_empresa === companyId){
            // buscar global role con mismo nombre
            const globalRole = (data.roles||[]).find(gr => gr.name === r.name && gr.id_empresa == null)
            if(globalRole){
              const globalPerms = new Set(data.assignments[globalRole.idrole]||[])
              const ownPerms = new Set(data.assignments[r.idrole]||[])
              inh[r.idrole] = Array.from(globalPerms).filter(pid => !ownPerms.has(pid))
            }
          }
        }
      }
      setInherited(inh)
    } catch(e){ setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(()=>{ loadCompanies() }, [isSuperAdmin])
  useEffect(()=>{ loadMatrix() }, [companyId])

  const toggle = (roleId, permId) => {
    setAssignments(prev => {
      const current = new Set(prev[roleId] || [])
      if(current.has(permId)) current.delete(permId); else current.add(permId)
      return { ...prev, [roleId]: Array.from(current) }
    })
  }

  const groupedPermissions = useMemo(()=>{
    const list = permissions.filter(p => {
      if(!search.trim()) return true
      const q = search.toLowerCase()
      return p.resource.toLowerCase().includes(q) || p.action.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)
    })
    const map = {}
    for(const p of list){
      map[p.resource] = map[p.resource] || []
      map[p.resource].push(p)
    }
    return map
  }, [permissions, search])

  const saveChanges = async () => {
    setSaving(true)
    try {
      // Build minimal change list by comparing to server snapshot? For simplicity send all current states.
      const changes = []
      roles.forEach(r => {
        const assignedSet = new Set(assignments[r.idrole] || [])
        permissions.forEach(p => {
          const assigned = assignedSet.has(p.id_perm)
          changes.push({ role_id: r.idrole, perm_id: p.id_perm, assigned })
        })
      })
      const res = await fetch(`${API}/roles/matrix/update`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, changes })
      })
      if(!res.ok) throw new Error(`Error guardando ${res.status}`)
      const data = await res.json()
      alert(`Actualizado: ${data.updated} cambios aplicados`)
      // Reload to reflect true state (especially global inherited)
      loadMatrix()
    } catch(e){ alert(e.message) }
    finally { setSaving(false) }
  }

  if(!canAdmin) return <div>No autorizado</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Matriz de Roles y Permisos</h2>
          {loading && <span className="text-xs text-gray-500">Cargando...</span>}
          {saving && <span className="text-xs text-blue-600">Guardando...</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isSuperAdmin && (
            <select value={companyId || ''} onChange={e=> setCompanyId(e.target.value ? parseInt(e.target.value) : null)} className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600">
              <option value="">Global (NULL)</option>
              {companies.map(c => <option key={c.id_empresa} value={c.id_empresa}>{c.nombre_empresa}</option>)}
            </select>
          )}
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Buscar permiso" className="text-sm px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
          <select value={viewMode} onChange={e=> setViewMode(e.target.value)} className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600">
            <option value="grouped">Agrupado</option>
            <option value="flat">Plano</option>
          </select>
          <button onClick={saveChanges} disabled={saving} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded disabled:opacity-50">Guardar Cambios</button>
          <button onClick={loadMatrix} className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600">↻ Refrescar</button>
        </div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {!loading && (
        <div className="overflow-auto border rounded dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="p-2 text-left">Recurso / Permiso</th>
                {roles.map(r => (
                  <th key={r.idrole} className="p-2 text-left whitespace-nowrap">{r.name}{r.id_empresa ? '' : ' (global)'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewMode === 'grouped' ? (
                Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <React.Fragment key={resource}>
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td colSpan={roles.length + 1} className="px-2 py-1 font-semibold text-gray-700 dark:text-gray-300">{resource}</td>
                    </tr>
                    {perms.map(p => (
                      <tr key={p.id_perm} className="border-t dark:border-gray-800">
                        <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{p.action} <span className="text-gray-400">- {p.description}</span></td>
                        {roles.map(r => {
                          const checked = (assignments[r.idrole] || []).includes(p.id_perm)
                          const isInherited = (inherited[r.idrole]||[]).includes(p.id_perm)
                          return (
                            <td key={r.idrole + '_' + p.id_perm} className="px-2 py-1">
                              <input type="checkbox" checked={checked} onChange={()=> toggle(r.idrole, p.id_perm)} disabled={isInherited} />
                              {isInherited && <span title="Permiso heredado global" className="ml-1 text-xs text-gray-400">⬆️</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                permissions.filter(p => {
                  if(!search.trim()) return true
                  const q = search.toLowerCase()
                  return p.resource.toLowerCase().includes(q) || p.action.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)
                }).map(p => (
                  <tr key={p.id_perm} className="border-t dark:border-gray-800">
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{p.resource}:{p.action} <span className="text-gray-400">- {p.description}</span></td>
                    {roles.map(r => {
                      const checked = (assignments[r.idrole] || []).includes(p.id_perm)
                      const isInherited = (inherited[r.idrole]||[]).includes(p.id_perm)
                      return (
                        <td key={r.idrole + '_' + p.id_perm} className="px-2 py-1">
                          <input type="checkbox" checked={checked} onChange={()=> toggle(r.idrole, p.id_perm)} disabled={isInherited} />
                          {isInherited && <span title="Permiso heredado global" className="ml-1 text-xs text-gray-400">⬆️</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
