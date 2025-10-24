import React, { useEffect, useState } from 'react'

export default function Productos({ API, userRole, permissions }){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [tipos, setTipos] = useState([])
  const [form, setForm] = useState({ nombreProducto: '', stockCaja: 0, idEmpresa: '', idTipoBotella: '' })
  const has = (res, act) => permissions.includes(`${res}:${act}`)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/productos`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message || 'Error'); }
    finally { setLoading(false) }
  }
  const loadTipoBotellas = async () => {
    try{
      const res = await fetch(`${API}/tipobotellas`, { headers: { 'X-User-Role': userRole }, credentials: 'include' })
      if(res.ok){ setTipos(await res.json()) }
    }catch {}
  }
  useEffect(()=>{ load(); loadTipoBotellas() }, [API, userRole])

  const submit = async (e) => {
    e.preventDefault()
    try{
      const payload = { ...form, stockCaja: Number(form.stockCaja||0), idEmpresa: form.idEmpresa ? Number(form.idEmpresa) : undefined, idTipoBotella: Number(form.idTipoBotella) }
      const method = editing ? 'PUT' : 'POST'
      const url = editing ? `${API}/productos/${editing.idProducto}` : `${API}/productos`
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-User-Role': userRole }, credentials: 'include', body: JSON.stringify(payload) })
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || `HTTP ${res.status}`) }
      setShowForm(false); setEditing(null); setForm({ nombreProducto: '', stockCaja: 0, idEmpresa: '', idTipoBotella: '' });
      load()
    }catch(err){ alert(err.message || 'Error') }
  }

  const startEdit = (it)=>{ setEditing(it); setShowForm(true); setForm({nombreProducto: it.nombreProducto, stockCaja: it.stockCaja||0, idEmpresa: it.idEmpresa||'', idTipoBotella: it.idTipoBotella||''}) }
  const deleteItem = async (id)=>{
    if(!confirm('Eliminar producto?')) return
    const res = await fetch(`${API}/productos/${id}`, { method:'DELETE', headers: { 'X-User-Role': userRole }, credentials: 'include' })
    if(res.status !== 204){ alert('No se pudo eliminar') } else { load() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Productos</h2>
        {(has('prestamos','manage') || has('productos','manage') || has('prestamos','create')) && (
          <button onClick={()=> setShowForm(s=>!s)} className="btn btn-primary">{showForm ? 'Cancelar' : 'Nuevo producto'}</button>
        )}
      </div>
      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-panel p-4 rounded shadow mb-4">
          <input className="p-2 border" placeholder="Nombre" value={form.nombreProducto} onChange={e=>setForm({...form, nombreProducto: e.target.value})} required />
          <input type="number" min="0" className="p-2 border" placeholder="Stock (cajas)" value={form.stockCaja} onChange={e=>setForm({...form, stockCaja: e.target.value})} />
          <select className="p-2 border" value={form.idTipoBotella} onChange={e=>setForm({...form, idTipoBotella: e.target.value})} required>
            <option value="">Seleccione tipo botella</option>
            {tipos.map(t => <option key={t.idTipoBotella} value={t.idTipoBotella}>{t.tipoBotella}</option>)}
          </select>
          {/* Solo superadmin puede elegir empresa; admin/editor usan su empresa del JWT en backend */}
          {userRole === 'superadmin' && (
            <input className="p-2 border" placeholder="ID Empresa" value={form.idEmpresa} onChange={e=>setForm({...form, idEmpresa: e.target.value})} />
          )}
          <div className="md:col-span-4">
            <button className="btn btn-primary mr-2">{editing ? 'Guardar cambios' : 'Crear'}</button>
            {editing && <button type="button" className="btn btn-secondary" onClick={()=>{ setEditing(null); setForm({ nombreProducto:'', stockCaja:0, idEmpresa:'', idTipoBotella:'' }) }}>Limpiar</button>}
          </div>
        </form>
      )}
      <div className="bg-panel rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Stock (cajas)</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Tipo Botella</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4" colSpan={6}>Cargando...</td></tr>}
            {!loading && items.length===0 && <tr><td className="p-4" colSpan={6}>Sin datos</td></tr>}
            {items.map(it => (
              <tr key={it.idProducto} className="border-b dark:border-gray-700">
                <td className="px-4 py-2">{it.idProducto}</td>
                <td className="px-4 py-2">{it.nombreProducto}</td>
                <td className="px-4 py-2">{it.stockCaja}</td>
                <td className="px-4 py-2">{it.idEmpresa}</td>
                <td className="px-4 py-2">{it.idTipoBotella}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={()=>startEdit(it)} className="btn btn-blue">Editar</button>
                    <button onClick={()=>deleteItem(it.idProducto)} className="btn btn-danger">Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
