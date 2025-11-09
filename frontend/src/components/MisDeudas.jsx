import React, { useEffect, useState } from 'react'
import TableWrapper from './TableWrapper'

const formatMoney = (v) => `Bs ${(Number(v)||0).toFixed(2)}`

export default function MisDeudas({ API }){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDebts = async ()=>{
    setLoading(true); setError('')
    try{
      let res = await fetch(`${API}/../mis-deudas`, { credentials: 'include' })
      if (res.status === 422) {
        console.warn('422 al listar mis deudas. Reintentando...')
        // No query params to strip, but we retry once in case of transient validation
        res = await fetch(`${API}/../mis-deudas`, { credentials: 'include' })
      }
      if(!res.ok){
        let detail = ''
        try { const je = await res.json(); detail = je?.detail ? `: ${JSON.stringify(je.detail)}` : '' } catch {}
        throw new Error(`HTTP ${res.status}${detail}`)
      }
      const j = await res.json()
      setData(j)
    }catch(e){
      console.error('Error cargando mis deudas:', e)
      setError(e.message || 'Error')
      setData(null)
    }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchDebts() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold dark:text-white">Mis Deudas</h2>
        <button onClick={fetchDebts} className="px-3 py-2 bg-blue-600 text-white rounded">Actualizar</button>
      </div>

  {loading && <div className="text-gray-600 dark:text-gray-400">Cargando...</div>}
  {error && <div className="text-red-600 dark:text-red-400">{error}</div>}

      {data && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total de deuda</div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatMoney(data.total_deuda)}</div>
            </div>
            <button onClick={fetchDebts} className="px-4 py-2 text-sm font-medium rounded bg-emerald-600 hover:bg-emerald-700 text-white dark:shadow-inner">
              Actualizar
            </button>
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
                      <th className="p-2 font-semibold text-gray-700 dark:text-gray-200">Fecha</th>
                      <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Total</th>
                      <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Pagado</th>
                      <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ventas?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No tienes ventas a crédito pendientes</td>
                      </tr>
                    )}
                    {data.ventas?.map(v => {
                      const saldo = (v.saldo || ((v.montoTotal||0) - (v.montoPagado||0)))
                      return (
                        <tr key={v.idVenta} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                          <td className="p-2 whitespace-nowrap">{v.fechaVenta}</td>
                          <td className="p-2 text-right">{formatMoney(v.montoTotal)}</td>
                          <td className="p-2 text-right">{formatMoney(v.montoPagado)}</td>
                          <td className={`p-2 text-right font-semibold ${saldo === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{formatMoney(saldo)}</td>
                        </tr>
                      )
                    })}
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
