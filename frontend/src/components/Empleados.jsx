import React, { useEffect, useState, useRef } from 'react'
import { useToast } from '../ToastContext'
import SignaturePad from './SignaturePad'
import FaceCapture from './FaceCapture'

// Simple scanner using native BarcodeDetector when available
function QRScanner({ API, userRole, onClose, onResult }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [support, setSupport] = useState(false)

  useEffect(() => {
    let stream
    const start = async () => {
      try {
        if ('BarcodeDetector' in window) {
          const formats = await window.BarcodeDetector?.getSupportedFormats?.() || []
          setSupport(formats.includes('qr_code'))
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setScanning(true)
          loop()
        }
      } catch (e) {
        setError(e.message || 'No se pudo acceder a la cámara')
      }
    }
    const loop = async () => {
      if (!scanning) return
      try {
        if ('BarcodeDetector' in window && support) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
          const codes = await detector.detect(videoRef.current)
          if (codes && codes.length > 0) {
            const raw = codes[0].rawValue
            setScanning(false)
            onResult(raw)
            return
          }
        }
      } catch (e) {
        // ignore intermittent detection errors
      }
      requestAnimationFrame(loop)
    }
    start()
    return () => {
      setScanning(false)
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [support])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-lg shadow-xl p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Escanear QR Asistencia</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
        </div>
        {!support && (
          <div className="p-3 text-sm rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            El navegador no soporta BarcodeDetector para QR. Pruebe en Chrome/Edge moderno o ingrese token manual.
          </div>
        )}
        {error && <div className="p-3 text-sm rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
        <video ref={videoRef} className="w-full rounded bg-black aspect-square" playsInline muted />
        <ManualTokenEntry API={API} userRole={userRole} onResult={onResult} />
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function ManualTokenEntry({ API, userRole, onResult }) {
  const [manual, setManual] = useState('')
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Token manual (fallback)</label>
      <input value={manual} onChange={e=>setManual(e.target.value)} placeholder="Pegar token aquí" className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-100" />
      <button disabled={!manual} onClick={()=>onResult(manual)} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-40">Usar Token</button>
    </div>
  )
}

export default function Empleados({ API, userRole = 'admin', permissions = [] }) {
  const roleLower = (userRole || '').toLowerCase()
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const isAdminLike = ['admin','superadmin'].includes(roleLower)
  const canView = has('personas','view') || isAdminLike
  const canCreate = has('personas','create') || isAdminLike
  const canEdit = has('personas','edit') || isAdminLike
  const canDelete = has('personas','delete') || roleLower==='superadmin'
  const toast = useToast()
  
  const [empleados, setEmpleados] = useState([])
  const [filteredEmpleados, setFilteredEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [filterEstado, setFilterEstado] = useState('1') // Por defecto solo activos

  const [form, setForm] = useState({
    cargo: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    salario: '',
    estado: 1
  })

  const [personas, setPersonas] = useState([])
  const [personasLoading, setPersonasLoading] = useState(false)
  const [selectedPersonaId, setSelectedPersonaId] = useState(null)

  const [empresas, setEmpresas] = useState([])
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)

  const loadEmpresas = async () => {
    if (roleLower !== 'superadmin') return setEmpresas([])
    setLoadingEmpresas(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      const res = await fetch(`${API}/empresas`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setEmpresas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading empresas:', err)
    } finally {
      setLoadingEmpresas(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const q = (searchQ || '').trim().toLowerCase()
      const list = empleados.filter(e => {
        const inEstado = filterEstado ? String(e.estado) === String(filterEstado) : true
        if (!inEstado) return false
        if (!q) return true
        const nombre = `${e.nombres_persona || ''} ${e.apellido_paternoPersona || ''} ${e.apellido_maternoPer || ''}`.toLowerCase()
        const ci = String(e.ci_persona || '').toLowerCase()
        const cargo = String(e.cargo || '').toLowerCase()
        const text = [nombre, ci, cargo].join(' ')
        return text.includes(q)
      })
      setFilteredEmpleados(list)
    }, 180)
    return () => clearTimeout(t)
  }, [searchQ, filterEstado, empleados])

  const loadEmpleados = async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      // Obtener empleados desde nuevo endpoint que combina persona + info empleado
      const res = await fetch(`${API}/empleados`, {
        method: 'GET',
        headers,
        credentials: 'include'
      })
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      
      const data = await res.json()
      setEmpleados(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading empleados:', err)
      setError('Error cargando empleados: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmpleados()
    loadEmpresas()
  }, [API, userRole])

  const loadPersonas = async () => {
    setPersonasLoading(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      const res = await fetch(`${API}/persons`, { method: 'GET', headers, credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPersonas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading personas:', err)
    } finally {
      setPersonasLoading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validación básica
    if (!selectedPersonaId) {
      setError('Debe seleccionar una persona existente')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        cargo: form.cargo.trim() || null,
        fecha_ingreso: form.fecha_ingreso || null,
        salario: form.salario ? parseFloat(form.salario) : null,
        estado: parseInt(form.estado),
        set_as_empleado: true
      }

      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole

      const personaId = editingId || selectedPersonaId
      const url = `${API}/empleados/${personaId}/info`
      const method = 'PUT'

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }

      await loadEmpleados()
      resetForm()
      toast.push(editingId ? 'Empleado actualizado' : 'Empleado asignado', 'success')
    } catch (err) {
      console.error('Error saving empleado:', err)
      setError('Error guardando: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm({
      cargo: '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      salario: '',
      estado: 1
    })
    setSelectedPersonaId(null)
    setEditingId(null)
    setShowCreate(false)
    setError(null)
  }

  const startEdit = (empleado) => {
    setForm({
      cargo: empleado.cargo || '',
      fecha_ingreso: empleado.fecha_ingreso || new Date().toISOString().split('T')[0],
      salario: empleado.salario ? String(empleado.salario) : '',
      estado: empleado.estado
    })
    setSelectedPersonaId(empleado.id_persona)
    setEditingId(empleado.id_persona)
    setShowCreate(true)
    setError(null)
  }

  const deleteEmpleado = async (id) => {
    if (!confirm('¿Desactivar a este empleado? La persona no será eliminada.')) return
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      const res = await fetch(`${API}/empleados/${id}/info`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ estado: 0 })
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }
      await loadEmpleados()
      toast.push('Empleado desactivado', 'success')
    } catch (err) {
      console.error('Error desactivando empleado:', err)
      toast.push('Error desactivando: ' + err.message, 'error')
    }
  }

  const personaLabel = (p) => {
    const nombre = `${p.nombres_persona || ''} ${p.apellido_paternoPersona || ''} ${p.apellido_maternoPer || ''}`.trim()
    return `${nombre} — CI ${p.ci_persona || 's/n'}`
  }

  const [geoBusy, setGeoBusy] = useState(false)
  const [showQRForId, setShowQRForId] = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrData, setQrData] = useState(null) // { svg, token, expires_in }
  const [qrCountdown, setQrCountdown] = useState(0)
  const [showScanner, setShowScanner] = useState(false)
  const [showFirmaForId, setShowFirmaForId] = useState(null)
  const [savingFirma, setSavingFirma] = useState(false)
  const [showFaceForId, setShowFaceForId] = useState(null)
  const [savingFace, setSavingFace] = useState(false)

  useEffect(()=>{
    if(qrCountdown <= 0) return
    const t = setTimeout(()=> setQrCountdown(qrCountdown - 1), 1000)
    return ()=> clearTimeout(t)
  }, [qrCountdown])

  const fetchQR = async (id_persona) => {
    setQrLoading(true); setQrData(null)
    try {
      const headers = { }
      if(userRole) headers['X-User-Role'] = userRole
      const res = await fetch(`${API}/asistencia/qr/${id_persona}?ttl=60`, { headers, credentials:'include' })
      if(!res.ok){
        const j = await res.json().catch(()=>({detail:`HTTP ${res.status}`}))
        throw new Error(j.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setQrData(data)
      setQrCountdown(data.expires_in || 60)
      toast.push('QR generado', 'success')
    } catch(e){
      toast.push('Error generando QR: ' + e.message, 'error')
    } finally { setQrLoading(false) }
  }

  const refreshQR = ()=> { if(showQRForId) fetchQR(showQRForId) }

  const handleScanResult = async (token) => {
    // Llama al endpoint /asistencia/scan con geolocalización
    try {
      const coords = await new Promise((resolve) => {
        if(!navigator.geolocation) return resolve(null)
        navigator.geolocation.getCurrentPosition(pos=>resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}), ()=>resolve(null), {enableHighAccuracy:true, timeout:4000})
      })
      const body = { token, geo_lat: coords?.lat || null, geo_lng: coords?.lng || null }
      const headers = { 'Content-Type':'application/json' }
      if(userRole) headers['X-User-Role'] = userRole
      const res = await fetch(`${API}/asistencia/scan`, { method:'POST', headers, credentials:'include', body: JSON.stringify(body) })
      if(!res.ok){
        const j = await res.json().catch(()=>({detail:`HTTP ${res.status}`}))
        throw new Error(j.detail || `HTTP ${res.status}`)
      }
      const j = await res.json()
      toast.push(`Asistencia registrada (${j.accion})`, 'success')
      setShowScanner(false)
    } catch(e){
      toast.push('Error al procesar QR: ' + e.message, 'error')
    }
  }
  const handleAsistencia = async (id_persona, tipo) => {
    try {
      setGeoBusy(true)
      const coords = await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 5000 }
        )
      })
      const headers = { 'Content-Type': 'application/json' }
      if (userRole) headers['X-User-Role'] = userRole
      const url = `${API}/asistencia/${tipo === 'entrada' ? 'checkin' : 'checkout'}`
      const res = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ id_persona, geo_lat: coords?.lat || null, geo_lng: coords?.lng || null })
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }))
        throw new Error(errorData.detail || `HTTP ${res.status}`)
      }
      toast.push(tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada', 'success')
    } catch (err) {
      console.error('Asistencia error:', err)
      toast.push('Error registrando asistencia: ' + err.message, 'error')
    } finally {
      setGeoBusy(false)
    }
  }
  const saveFirma = async (dataUrl, meta) => {
    if(!showFirmaForId) return
    setSavingFirma(true)
    try {
      const headers = { 'Content-Type':'application/json' }
      if(userRole) headers['X-User-Role'] = userRole
      const body = {
        id_persona: showFirmaForId,
        tipo_documento: 'asistencia',
        id_referencia: `empleado-${showFirmaForId}`,
        data_url: dataUrl,
        width: meta?.width || null,
        height: meta?.height || null
      }
      const res = await fetch(`${API}/firmas`, { method:'POST', headers, credentials:'include', body: JSON.stringify(body) })
      if(!res.ok){
        const j = await res.json().catch(()=>({detail:`HTTP ${res.status}`}))
        throw new Error(j.detail || `HTTP ${res.status}`)
      }
      toast.push('Firma registrada','success')
      setShowFirmaForId(null)
    } catch(e){
      toast.push('Error guardando firma: '+ e.message,'error')
    } finally { setSavingFirma(false) }
  }

  const saveFace = async (dataUrl) => {
    if(!showFaceForId) return
    setSavingFace(true)
    try {
      const headers = { 'Content-Type':'application/json' }
      if(userRole) headers['X-User-Role'] = userRole
      const body = {
        id_persona: showFaceForId,
        data_url: dataUrl,
        tipo_documento: 'rostro',
        id_referencia: `face-${showFaceForId}`
      }
      const res = await fetch(`${API}/faces`, { method:'POST', headers, credentials:'include', body: JSON.stringify(body) })
      if(!res.ok){
        const j = await res.json().catch(()=>({detail:`HTTP ${res.status}`}))
        throw new Error(j.detail || `HTTP ${res.status}`)
      }
      toast.push('Rostro capturado','success')
      setShowFaceForId(null)
    } catch(e){
      toast.push('Error guardando rostro: '+ e.message,'error')
    } finally { setSavingFace(false) }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          👷 Gestión de Empleados ({filteredEmpleados.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={()=> setShowScanner(true)}
            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Escanear QR de asistencia con cámara"
          >
            📱 Escanear QR
          </button>
        {canCreate && (
          <button
            onClick={() => { setShowCreate(true); setEditingId(null); setSelectedPersonaId(null); loadPersonas() }}
            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Asignar información laboral a una persona existente"
          >
            ➕ Nuevo Empleado
          </button>
        )}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Buscar
          </label>
          <input
            type="text"
            placeholder="Nombre, CI, cargo..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Estado
          </label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">Todos</option>
            <option value="1">Activos</option>
            <option value="0">Inactivos</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          {error}
        </div>
      )}

      {/* Formulario: asignar/editar info laboral a una persona existente */}
      {showCreate && (
        <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            {editingId ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!editingId && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Persona existente *
                </label>
                <select
                  disabled={personasLoading}
                  value={selectedPersonaId || ''}
                  onChange={(e) => setSelectedPersonaId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
                >
                  <option value="">{personasLoading ? 'Cargando personas...' : 'Seleccione una persona'}</option>
                  {personas.map(p => (
                    <option key={p.id_persona} value={p.id_persona}>{personaLabel(p)}</option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">La persona no se eliminará ni duplicará; solo se le asignará info laboral.</div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cargo
              </label>
              <input
                type="text"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ej: Vendedor, Almacenero, Contador"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha de Ingreso
              </label>
              <input
                type="date"
                value={form.fecha_ingreso}
                onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Salario (Bs)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.salario}
                onChange={(e) => setForm({ ...form, salario: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              />
            </div>

      {/* Modal QR */}
      {showQRForId && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button onClick={()=>{setShowQRForId(null); setQrData(null)}} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">QR Asistencia Empleado #{showQRForId}</h3>
            {qrLoading && <div className="text-sm text-gray-600 dark:text-gray-300">Generando...</div>}
            {qrData && (
              <div className="space-y-4">
                <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: qrData.svg }} />
                <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                  <span>Expira en: {qrCountdown}s</span>
                  <button onClick={refreshQR} className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs">Refrescar</button>
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600 dark:text-blue-400">Mostrar token (debug)</summary>
                  <div className="mt-2 break-all font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded max-h-32 overflow-y-auto">{qrData.token}</div>
                  <button onClick={()=>{ navigator.clipboard?.writeText(qrData.token); toast.push('Token copiado','success') }} className="mt-2 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs">Copiar</button>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {showScanner && (
        <QRScanner API={API} userRole={userRole} onClose={()=> setShowScanner(false)} onResult={handleScanResult} />
      )}
      {showFirmaForId && (
        <SignaturePad
          loading={savingFirma}
          onSave={saveFirma}
          onCancel={()=> setShowFirmaForId(null)}
        />
      )}
      {showFaceForId && (
        <FaceCapture
          loading={savingFace}
          onSave={saveFace}
          onCancel={()=> setShowFaceForId(null)}
        />
      )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado
              </label>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-gray-100"
              >
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>Guardando...</span>
                  </>
                ) : editingId ? (
                  <>
                    <span>✅</span>
                    <span>Actualizar</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Asignar Empleado</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Empleado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Cargo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Contacto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Salario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Estado
              </th>
              {(canEdit || canDelete) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmpleados.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No se encontraron empleados
                </td>
              </tr>
            ) : (
              filteredEmpleados.map((emp) => (
                <tr key={emp.id_persona} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {emp.nombres_persona} {emp.apellido_paternoPersona || ''} {emp.apellido_maternoPer || ''}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        CI: {emp.ci_persona}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {emp.cargo || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {emp.celular_persona && <div>📱 {emp.celular_persona}</div>}
                      {emp.email_persona && <div className="text-blue-600 dark:text-blue-400">📧 {emp.email_persona}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {emp.salario ? `Bs ${Number(emp.salario).toFixed(2)}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      emp.estado === 1
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {emp.estado === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex space-x-2">
                        {canEdit && (
                          <button
                            onClick={() => startEdit(emp)}
                            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Editar información del empleado"
                          >
                            ✏️ Editar
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={()=> setShowFirmaForId(emp.id_persona)}
                            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Capturar firma digital"
                          >
                            {savingFirma && showFirmaForId === emp.id_persona ? '⏳' : '✍️'} Firma
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={()=> setShowFaceForId(emp.id_persona)}
                            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
                            className="text-pink-600 hover:text-pink-900 dark:text-pink-400 dark:hover:text-pink-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Capturar foto del rostro"
                          >
                            {savingFace && showFaceForId === emp.id_persona ? '⏳' : '📷'} Rostro
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => { setShowQRForId(emp.id_persona); fetchQR(emp.id_persona); }}
                              disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
                              className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Generar QR para asistencia"
                            >
                              {qrLoading && showQRForId === emp.id_persona ? '⏳' : '📱'} QR
                            </button>
                            <button
                              disabled={geoBusy || submitting || qrLoading || savingFirma || savingFace}
                              onClick={() => handleAsistencia(emp.id_persona, 'entrada')}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Registrar entrada de asistencia"
                            >
                              {geoBusy ? '⏳' : '🟢'} Entrada
                            </button>
                            <button
                              disabled={geoBusy || submitting || qrLoading || savingFirma || savingFace}
                              onClick={() => handleAsistencia(emp.id_persona, 'salida')}
                              className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Registrar salida de asistencia"
                            >
                              {geoBusy ? '⏳' : '🟡'} Salida
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => deleteEmpleado(emp.id_persona)}
                            disabled={submitting || geoBusy || qrLoading || savingFirma || savingFace}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Desactivar empleado (no elimina la persona)"
                          >
                            ❌ Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
