import React, { useEffect, useMemo, useState } from 'react'

export default function Caja({ API, userRole }){
  const [period, setPeriod] = useState('day')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0,10))
  const [idEmpresa, setIdEmpresa] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const url = useMemo(()=>{
    const params = new URLSearchParams()
    params.set('period', period)
    if(fecha) params.set('fecha', fecha)
    if(idEmpresa) params.set('idEmpresa', idEmpresa)
    return `${API}/caja/resumen?${params.toString()}`
  }, [API, period, fecha, idEmpresa])

  const reload = async ()=>{
    setLoading(true)
    setError('')
    try{
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      const text = await res.text()
      if(!res.ok){
        let detail = text
        try{ const j = JSON.parse(text); detail = j.detail || text }catch{}
        throw new Error(detail || `Error ${res.status}`)
      }
      const j = JSON.parse(text)
      setData(j)
    }catch(e){ setError(e?.message || 'Error desconocido') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ reload() }, [url])

  const Card = ({title, value, className=''}) => (
    <div className={`p-4 rounded-lg shadow bg-white dark:bg-gray-800 ${className}`}>
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{Number(value || 0).toFixed(2)}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Periodo</label>
          <select value={period} onChange={e=>setPeriod(e.target.value)} className="input">
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Fecha base</label>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Empresa (opcional)</label>
          <input type="number" placeholder="idEmpresa" value={idEmpresa} onChange={e=>setIdEmpresa(e.target.value)} className="input" />
        </div>
        <button onClick={reload} disabled={loading} className="btn btn-primary">{loading ? 'Cargando...' : 'Actualizar'}</button>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-100">{error}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Ingresos" value={data.ingresos} />
            <Card title="Ventas Contado" value={data.ingresosVentasContado} />
            <Card title="Cobros" value={data.ingresosCobros} />
            <Card title="Egresos" value={data.egresos} />
            <Card title="Compras Contado" value={data.egresosComprasContado} />
            <Card title="Pagos" value={data.egresosPagos} />
            <Card title="Balance" value={data.balance} className={Number(data.balance) >= 0 ? 'ring-2 ring-green-500' : 'ring-2 ring-red-500'} />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Rango: {data.desde} — {data.hasta} | Empresa: {data.idEmpresa}
          </div>
        </>
      )}
    </div>
  )
}
