import React, { useEffect, useState } from 'react'
import TableWrapper from './TableWrapper'

const formatMoney = (v) => `Bs ${(Number(v)||0).toFixed(2)}`

export default function Creditos({ API, API_PERSONAS, userRole }){
  const [credits, setCredits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cliente, setCliente] = useState('')
  const [clientes, setClientes] = useState([])

  const loadClientes = async() => {
    try{
  const res = await fetch(`${API_PERSONAS}/personas?tipo=cliente`, { credentials: 'include' })
      if(!res.ok) throw new Error('Error listando clientes')
      const json = await res.json()
      setClientes(json || [])
    }catch(e){ console.error(e) }
  }

  const fetchCredits = async () => {
    setLoading(true); setError('')
    try{
      const params = new URLSearchParams()
      if (cliente) params.set('idCliente', cliente)
  const res = await fetch(`${API}/creditos?${params.toString()}`, { credentials: 'include' })
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setCredits(j)
    }catch(e){ setError(e.message || 'Error') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ loadClientes() }, [])
  useEffect(()=>{ fetchCredits() }, [cliente])

  const totalSaldo = credits.reduce((acc, c) => acc + (c.saldo || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold dark:text-white">Créditos por Cliente</h2>
        <div className="flex items-center gap-2">
          <select value={cliente} onChange={e=>setCliente(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800">
            <option value=''>Todos los clientes</option>
            {clientes.map(c => (
              <option key={c.id_persona || c.idPersona || c.id} value={c.id_persona || c.idPersona || c.id}>
                {c.nombres_persona || c.nombre}
              </option>
            ))}
          </select>
          <button onClick={fetchCredits} className="px-3 py-2 bg-blue-600 text-white rounded">Actualizar</button>
        </div>
      </div>

  {loading && <div className="text-gray-600 dark:text-gray-400">Cargando...</div>}
  {error && <div className="text-red-600 dark:text-red-400">{error}</div>}

      {!loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">Resultados: <b>{credits.length}</b></div>
            <div className="text-sm">Saldo total: <b className="text-emerald-600 dark:text-emerald-400">{formatMoney(totalSaldo)}</b></div>
          </div>
          <div className="overflow-auto">
              <TableWrapper>
                <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 dark:bg-gray-900">
                  <th className="p-2 font-semibold text-gray-700 dark:text-gray-200">Fecha</th>
                  <th className="p-2 font-semibold text-gray-700 dark:text-gray-200">Cliente</th>
                  <th className="p-2 font-semibold text-gray-700 dark:text-gray-200">Empresa</th>
                  <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Total</th>
                  <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Pagado</th>
                  <th className="p-2 text-right font-semibold text-gray-700 dark:text-gray-200">Saldo</th>
                  <th className="p-2 font-semibold text-gray-700 dark:text-gray-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {credits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-gray-500 dark:text-gray-400">No se encontraron créditos para el filtro seleccionado</td>
                  </tr>
                )}
                {credits.map((c) => (
                  <tr key={c.idVenta} className="border-t dark:border-gray-700">
                    <td className="p-2">{c.fechaVenta}</td>
                    <td className="p-2">{c.nombreCliente}</td>
                    <td className="p-2">{c.nombreEmpresa}</td>
                    <td className="p-2 text-right">{formatMoney(c.montoTotal)}</td>
                    <td className="p-2 text-right">{formatMoney(c.montoPagado)}</td>
                    <td className={`p-2 text-right font-semibold ${(Number(c.saldo)||0) === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{formatMoney(c.saldo)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <a href={`#/ventas?id=${c.idVenta}`} className="text-blue-600 hover:underline">Ver</a>
                        {/* Placeholder para cobrar o imprimir */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableWrapper>
          </div>
        </div>
      )}
    </div>
  )
}
