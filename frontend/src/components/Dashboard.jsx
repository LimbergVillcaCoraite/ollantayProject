import React, { useEffect, useState, useMemo } from 'react'

export default function Dashboard({ API_ANALYTICS, userRole }){
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const truthy = useMemo(()=> new Set(['1','true','yes','y','si','sí']), [])

  useEffect(()=>{
    let alive = true
    const load = async ()=>{
      try{
        setLoading(true); setError('')
        const [s, t] = await Promise.all([
          fetch(`${API_ANALYTICS}/stats/realtime`, { credentials: 'include' }),
          fetch(`${API_ANALYTICS}/stats/trends`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 30 }) })
        ])
        if(!s.ok) throw new Error(`stats ${s.status}`)
        if(!t.ok) throw new Error(`trends ${t.status}`)
        const sj = await s.json(); const tj = await t.json()
        if(!alive) return
        setStats(sj); setTrends(tj)
      }catch(e){ if(alive){ setError(e.message || 'Error'); }}
      finally{ if(alive) setLoading(false) }
    }
    load();
    const id = setInterval(load, 15000) // refresco cada 15s
    return ()=>{ alive = false; clearInterval(id) }
  }, [API_ANALYTICS])

  if(loading) return <div className="text-gray-500">Cargando dashboard...</div>
  if(error) return <div className="text-red-600">Error: {error}</div>
  if(!stats) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Prestamos activos" value={stats.prestamos_activos} color="bg-blue-50" />
        <Card title="En mora" value={stats.prestamos_mora} color="bg-rose-50" />
        <Card title="Monto vigente" value={`Bs ${stats.monto_prestamos_vigentes.toFixed(2)}`} color="bg-amber-50" />
        <Card title="Asistencias hoy" value={stats.asistencias_hoy} color="bg-emerald-50" />
        <Card title="Empleados activos" value={stats.empleados_activos} color="bg-purple-50" />
        <Card title="Ventas hoy" value={`Bs ${stats.ventas_hoy.toFixed(2)}`} color="bg-green-50" />
        <Card title="Compras hoy" value={`Bs ${stats.compras_hoy.toFixed(2)}`} color="bg-sky-50" />
        <Card title="Gastos hoy" value={`Bs ${stats.gastos_hoy.toFixed(2)}`} color="bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Trend title="Ventas 30d" data={trends?.ventas||[]} color="#10b981" />
        <Trend title="Compras 30d" data={trends?.compras||[]} color="#3b82f6" />
        <Trend title="Prestamos 30d" data={trends?.prestamos||[]} color="#f59e0b" />
        <Trend title="Gastos 30d" data={trends?.gastos||[]} color="#ef4444" />
      </div>
    </div>
  )
}

function Card({ title, value, color }){
  return (
    <div className={`${color} rounded-lg p-4 border`}
      style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function Trend({ title, data, color }){
  // Render simple SVG line chart
  const width = 400, height = 120, pad = 24
  const points = data?.map((d,i)=>({ x:i, y: Number(d.total||0) })) || []
  const maxY = Math.max(1, ...points.map(p=>p.y))
  const maxX = Math.max(1, points.length-1)
  const path = points.map((p,i)=>{
    const x = pad + (width-2*pad) * (p.x/maxX)
    const y = height - pad - (height-2*pad) * (p.y/maxY)
    return `${i===0? 'M':'L'} ${x} ${y}`
  }).join(' ')
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow border border-gray-100 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  )
}
