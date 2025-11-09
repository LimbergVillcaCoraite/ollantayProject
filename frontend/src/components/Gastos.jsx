import React, { useEffect, useState, useCallback } from 'react'
import EmpresaSelector from './EmpresaSelector'

const money = v => `Bs ${(Number(v)||0).toFixed(2)}`

export default function Gastos({ API, userRole }){
  const [gastos, setGastos] = useState([])
  const [stats, setStats] = useState(null)
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
      // Stats
      try{
        const rs = await fetch(`${API}/stats?${p.toString()}`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
        if(rs.ok){ const js = await rs.json(); setStats(js) } else setStats(null)
      }catch{ setStats(null) }
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

      {/* Resumen */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow flex flex-col">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{money(stats.total)}</div>
            <div className="mt-auto text-xs text-gray-500 dark:text-gray-400">{stats.desde || '...'} → {stats.hasta || '...'}</div>
          </div>
          {stats.categorias?.slice(0,3).map(c => (
            <div key={c.categoria} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow flex flex-col">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">{c.categoria}</div>
              <div className="mt-1 text-xl font-semibold text-blue-600 dark:text-blue-400">{money(c.total)}</div>
              <div className="mt-auto text-xs text-gray-500 dark:text-gray-400">{c.count} mov.</div>
            </div>
          ))}
        </div>
      )}

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
        {loading && <div className="text-gray-500 dark:text-gray-400">Cargando...</div>}
        {error && !loading && <div className="text-red-600 dark:text-red-400">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left border-b dark:border-gray-700">
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200">Fecha</th>
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200">Categoría</th>
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200">Descripción</th>
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200 text-right">Monto</th>
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200">Método</th>
                  <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-500 dark:text-gray-400">No se encontraron gastos</td></tr>
                )}
                {gastos.map(g => (
                  <tr key={g.idGasto} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-2 px-2 whitespace-nowrap text-gray-800 dark:text-gray-100">{g.fecha}</td>
                    <td className="py-2 px-2 text-gray-800 dark:text-gray-100">{g.categoria}</td>
                    <td className="py-2 px-2 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={g.descripcion || ''}>{g.descripcion || '-'}</td>
                    <td className="py-2 px-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{Number(g.monto||0).toFixed(2)}</td>
                    <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{g.metodo_pago || '-'}</td>
                    <td className="py-2 px-2">
                      <button onClick={()=>onDelete(g)} className="text-red-600 dark:text-red-400 hover:underline">Eliminar</button>
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
