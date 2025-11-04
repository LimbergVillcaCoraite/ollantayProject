import React from 'react'
import { useToast } from '../ToastContext'

export default function Tipos({types, loading, error, onEdit, onDelete, onRefresh, API, userRole='admin', permissions=[]}){
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const [showNew, setShowNew] = React.useState(false)
  const [newTipo, setNewTipo] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [editingId, setEditingId] = React.useState(null)
  const [editingTipo, setEditingTipo] = React.useState('')
  const [editingSaving, setEditingSaving] = React.useState(false)
  const toast = useToast()

  const handleCreate = async ()=>{
    if(!newTipo.trim()) return
    setSaving(true)
    try{
      const api = API || (import.meta.env.VITE_API_TYPES || 'http://localhost:8001')
  const res = await fetch(`${api}/types`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify({tipo: newTipo})})
      if(!res.ok) throw new Error('Error creando tipo')
      setNewTipo('')
      setShowNew(false)
      if(onRefresh) await onRefresh()
    }catch(err){ console.error(err); toast.push('Error creando tipo: '+err.message,'error') }
    finally{ setSaving(false) }
  }

  const startEdit = (t)=>{
    setEditingId(t.id)
    setEditingTipo(t.tipo)
  }

  const cancelEdit = ()=>{
    setEditingId(null)
    setEditingTipo('')
    setEditingSaving(false)
  }

  const saveEdit = async (id)=>{
    if(!editingTipo.trim()) return
    setEditingSaving(true)
    try{
      const api = API || (import.meta.env.VITE_API_TYPES || 'http://localhost:8001')
  const res = await fetch(`${api}/types/${id}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify({tipo: editingTipo})})
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || 'Error updating') }
      toast.push('Tipo actualizado','success')
      if(onRefresh) await onRefresh()
      cancelEdit()
    }catch(err){ console.error(err); toast.push('Error actualizando tipo: '+err.message,'error') }
    finally{ setEditingSaving(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Tipos</h2>
      {loading && <p>Cargando tipos...</p>}
      {error && <p className="text-red-600">{error}</p>}
  <div className="bg-panel rounded shadow text-panel p-4">
  <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Listado de Tipos</h3>
          <p className="text-sm text-gray-600">Gestiona los tipos de persona aquí</p>
        </div>
        <div>
          {has('tipos','create') && !showNew && <button onClick={()=>setShowNew(true)} className="btn btn-primary">Nuevo Tipo</button>}
        </div>
      </div>
      {showNew && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <input className="p-2 border col-span-2" placeholder="Nombre del tipo" value={newTipo} onChange={e=>setNewTipo(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={saving} onClick={handleCreate} className="btn btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button disabled={saving} onClick={()=>{ setShowNew(false); setNewTipo('') }} className="btn btn-secondary">Cancelar</button>
          </div>
        </div>
      )}
        {/* Desktop table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto rounded-lg">
          <table className="min-w-full table-auto text-sm rounded-lg overflow-hidden shadow">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 && <tr><td className="p-4" colSpan={3}>No hay tipos</td></tr>}
              {types.map(t => (
                <tr key={t.id} className="border-b dark:border-gray-700">
                  <td className="px-4 py-2">{t.id}</td>
                  <td className="px-4 py-2">{editingId === t.id ? (
                    <input className="p-2 border w-full" value={editingTipo} onChange={e=>setEditingTipo(e.target.value)} />
                  ) : (
                    t.tipo
                  )}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 justify-end">
                      {editingId === t.id ? (
                        <>
                          <button disabled={editingSaving} onClick={()=>saveEdit(t.id)} className="btn btn-primary"><span className="mr-1">✓</span>Guardar</button>
                          <button disabled={editingSaving} onClick={cancelEdit} className="btn btn-secondary"><span className="mr-1">✕</span>Cancelar</button>
                        </>
                      ) : (
                        <>
                          {has('tipos','update') && <button onClick={()=>startEdit(t)} className="btn btn-blue" title="Editar"><span className="mr-1">✎</span>Editar</button>}
                          {has('tipos','delete') && <button onClick={()=>onDelete(t.id)} className="btn btn-danger" title="Eliminar"><span className="mr-1">🗑️</span>Borrar</button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards (visible on mobile only) */}
        <div className="md:hidden space-y-3">
          {types.length === 0 && (
            <div className="p-4 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-center">No hay tipos</div>
          )}
          {types.map(t => (
            <div key={t.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-300">Tipo</label>
                  <input className="p-2 border w-full dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" value={editingTipo} onChange={e=>setEditingTipo(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button disabled={editingSaving} onClick={()=>saveEdit(t.id)} className="btn btn-primary">Guardar</button>
                    <button disabled={editingSaving} onClick={cancelEdit} className="btn btn-secondary">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {t.id}</div>
                    <div className="text-base font-semibold text-gray-900 dark:text-white">{t.tipo}</div>
                  </div>
                  <div className="flex gap-2">
                    {has('tipos','update') && <button onClick={()=>startEdit(t)} className="btn btn-blue">Editar</button>}
                    {has('tipos','delete') && <button onClick={()=>onDelete(t.id)} className="btn btn-danger">Borrar</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
