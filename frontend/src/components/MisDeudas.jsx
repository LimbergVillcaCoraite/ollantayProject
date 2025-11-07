import React, { useEffect, useState } from 'react'
import TableWrapper from './TableWrapper'

export default function MisDeudas({ API }){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDebts = async ()=>{
    setLoading(true); setError('')
    try{
      const res = await fetch(`${API}/mis-deudas`, { credentials: 'include' })
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setData(j)
    }catch(e){ setError(e.message || 'Error') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchDebts() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold dark:text-white">Mis Deudas</h2>
        <button onClick={fetchDebts} className="px-3 py-2 bg-blue-600 text-white rounded">Actualizar</button>
      </div>

      {loading && <div className="text-gray-500">Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {data && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-300">Total de deuda</div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">Bs {(data.total_deuda || 0).toFixed(2)}</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-300">Ventas a crédito con saldo</div>
            </div>
            <div className="overflow-auto">
              <TableWrapper>
                <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-50 dark:bg-gray-900">
                    <th className="p-2">Fecha</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Pagado</th>
                    <th className="p-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ventas?.map(v => (
                    <tr key={v.idVenta} className="border-t dark:border-gray-700">
                      <td className="p-2">{v.fechaVenta}</td>
                      <td className="p-2 text-right">{(v.montoTotal || 0).toFixed(2)}</td>
                      <td className="p-2 text-right">{(v.montoPagado || 0).toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">{(v.saldo || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </TableWrapper>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
