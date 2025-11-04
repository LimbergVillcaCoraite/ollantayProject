import React, { useEffect, useState } from 'react'

export default function Tipocajas({ API, userRole, permissions }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nombretipo_caja: '', cantidadBotellasCaja: 0 })
  const has = (res, act) => permissions.includes(`${res}:${act}`)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/tipocajas`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message || 'Error'); }
    finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [API, userRole])

  const submit = async (e) => {
    e.preventDefault()
    try{
      const payload = { ...form, cantidadBotellasCaja: Number(form.cantidadBotellasCaja||0) }
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `${API}/tipocajas/${editing.idTipocaja}` : `${API}/tipocajas`
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole }, credentials: 'include', body: JSON.stringify(payload) })
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || `HTTP ${res.status}`) }
      setShowForm(false); setEditing(null); setForm({ nombretipo_caja: '', cantidadBotellasCaja: 0 });
      load()
    }catch(err){ alert(err.message || 'Error') }
  }

  const startEdit = (it)=>{ setEditing(it); setShowForm(true); setForm({nombretipo_caja: it.nombretipo_caja, cantidadBotellasCaja: it.cantidadBotellasCaja}) }
  const deleteItem = async (id)=>{
    if(!confirm('Eliminar tipo de caja?')) return
    const res = await fetch(`${API}/tipocajas/${id}`, { method:'DELETE', headers: { 'X-User-Role': userRole }, credentials: 'include' })
    if(res.status !== 204){ alert('No se pudo eliminar') } else { load() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Tipos de Caja</h2>
        {has('prestamos','manage') || has('tipocajas','manage') || has('prestamos','create') ? (
          <button onClick={()=> setShowForm(s=>!s)} className="btn btn-primary">{showForm ? 'Cancelar' : 'Nuevo tipo de caja'}</button>
        ) : null}
      </div>
      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-panel p-4 rounded shadow mb-4">
          <input className="p-2 border" placeholder="Nombre" value={form.nombretipo_caja} onChange={e=>setForm({...form, nombretipo_caja: e.target.value})} required />
          <input type="number" min="0" className="p-2 border" placeholder="Botellas por caja" value={form.cantidadBotellasCaja} onChange={e=>setForm({...form, cantidadBotellasCaja: e.target.value})} required />
          <div>
            <button className="btn btn-primary mr-2">{editing ? 'Guardar cambios' : 'Crear'}</button>
            {editing && <button type="button" className="btn btn-secondary" onClick={()=>{ setEditing(null); setForm({nombretipo_caja:'', cantidadBotellasCaja:0}); }}>Limpiar</button>}
          </div>
        </form>
      )}
      <div className="bg-panel rounded shadow">
        {/* Desktop table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Botellas por caja</th>
                <th className="px-4 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td className="p-4" colSpan={4}>Cargando...</td></tr>}
              {!loading && items.length===0 && <tr><td className="p-4" colSpan={4}>Sin datos</td></tr>}
              {items.map(it => (
                <tr key={it.idTipocaja} className="border-b dark:border-gray-700">
                  <td className="px-4 py-2">{it.idTipocaja}</td>
                  <td className="px-4 py-2">{it.nombretipo_caja}</td>
                  <td className="px-4 py-2">{it.cantidadBotellasCaja}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={()=>startEdit(it)} className="btn btn-blue">Editar</button>
                      <button onClick={()=>deleteItem(it.idTipocaja)} className="btn btn-danger">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards (visible on mobile only) */}
        <div className="md:hidden space-y-3 p-3">
          {loading && <div className="p-4 rounded bg-white dark:bg-gray-800">Cargando...</div>}
          {!loading && items.length===0 && <div className="p-4 rounded bg-white dark:bg-gray-800">Sin datos</div>}
          {items.map(it => (
            <div key={it.idTipocaja} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">ID: {it.idTipocaja}</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white">{it.nombretipo_caja}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">{it.cantidadBotellasCaja} botellas/caja</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>startEdit(it)} className="btn btn-blue">Editar</button>
                  <button onClick={()=>deleteItem(it.idTipocaja)} className="btn btn-danger">Borrar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
