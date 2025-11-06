import React, { useEffect, useState, useCallback } from 'react'
import EmpresaSelector from './EmpresaSelector'

export default function Gastos({ API, userRole }){
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [form, setForm] = useState({ fecha: '', categoria: '', descripcion: '', monto: '', metodo_pago: '', estado: 1 })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async ()=>{
    setLoading(true); setError('')
    try{
      const p = new URLSearchParams()
      if(selectedEmpresa) p.append('idEmpresa', String(selectedEmpresa))
      if(fDesde) p.append('fecha_inicio', fDesde)
      if(fHasta) p.append('fecha_fin', fHasta)
      if(fCategoria) p.append('categoria', fCategoria)
      const r = await fetch(`${API}?${p.toString()}`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if(!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setGastos(Array.isArray(data) ? data : [])
    }catch(e){ setError(e?.message || 'Error'); setGastos([]) }
    finally{ setLoading(false) }
  }, [API, userRole, selectedEmpresa, fDesde, fHasta, fCategoria])

  useEffect(()=>{ load() }, [load])

  const onSubmit = async (e) => {
    e.preventDefault(); if(!form.categoria || !form.monto){ alert('Categoria y monto requeridos'); return }
    setSubmitting(true)
    try{
      const r = await fetch(`${API}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...(userRole?{'X-User-Role':userRole}:{}) }, body: JSON.stringify({ ...form, monto: Number(form.monto||0) }) })
      if(!r.ok){ const t = await r.text().catch(()=> ''); throw new Error(t || `HTTP ${r.status}`) }
      setForm({ fecha: '', categoria: '', descripcion: '', monto: '', metodo_pago: '', estado: 1 })
      load()
    }catch(e){ alert('No se pudo crear gasto: ' + (e?.message || 'Error')) }
    finally{ setSubmitting(false) }
  }

  const onDelete = async (g) => {
    if(!confirm('Eliminar gasto?')) return
    try{
      const r = await fetch(`${API}/${g.idGasto}`, { method: 'DELETE', credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      if(r.status !== 204) throw new Error(`HTTP ${r.status}`)
      load()
    }catch(e){ alert('No se pudo eliminar: ' + (e?.message || 'Error')) }
  }

  return (
    <div className="space-y-4">
      <EmpresaSelector userRole={userRole} selectedEmpresa={selectedEmpresa} onEmpresaChange={setSelectedEmpresa} />
      
      <h2 className="text-xl font-bold dark:text-white">Gastos</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f, fecha:e.target.value}))} className="input" />
          <input placeholder="Categoría" value={form.categoria} onChange={e=>setForm(f=>({...f, categoria:e.target.value}))} className="input md:col-span-2" required />
          <input placeholder="Descripción" value={form.descripcion} onChange={e=>setForm(f=>({...f, descripcion:e.target.value}))} className="input md:col-span-2" />
          <input placeholder="Monto" type="number" step="0.01" value={form.monto} onChange={e=>setForm(f=>({...f, monto:e.target.value}))} className="input" required />
          <input placeholder="Método de pago" value={form.metodo_pago} onChange={e=>setForm(f=>({...f, metodo_pago:e.target.value}))} className="input" />
          <button disabled={submitting} className="md:col-span-6 bg-emerald-600 text-white rounded px-4 py-2 hover:bg-emerald-700">{submitting ? 'Guardando...' : 'Agregar'}</button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input type="date" value={fDesde} onChange={e=>setFDesde(e.target.value)} className="input" />
          <input type="date" value={fHasta} onChange={e=>setFHasta(e.target.value)} className="input" />
          <input placeholder="Categoría" value={fCategoria} onChange={e=>setFCategoria(e.target.value)} className="input" />
          <button onClick={load} className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700">Filtrar</button>
        </div>

        {loading ? <div className="text-gray-500">Cargando...</div> : error ? <div className="text-red-600">{error}</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b dark:border-gray-700">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Categoría</th>
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 pr-2 text-right">Monto</th>
                  <th className="py-2 pr-2">Método</th>
                  <th className="py-2 pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.idGasto} className="border-b dark:border-gray-700">
                    <td className="py-2 pr-2">{g.fecha}</td>
                    <td className="py-2 pr-2">{g.categoria}</td>
                    <td className="py-2 pr-2">{g.descripcion || '-'}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{Number(g.monto||0).toFixed(2)}</td>
                    <td className="py-2 pr-2">{g.metodo_pago || '-'}</td>
                    <td className="py-2 pr-2">
                      <button onClick={()=>onDelete(g)} className="text-red-600 hover:underline">Eliminar</button>
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
