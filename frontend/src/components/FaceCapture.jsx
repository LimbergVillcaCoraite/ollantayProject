import React, { useEffect, useRef, useState } from 'react'

export default function FaceCapture({ onSave, onCancel, loading }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [captured, setCaptured] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stream
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (e) {
        setError(e.message || 'No se pudo acceder a la cámara')
      }
    }
    start()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return
    const w = videoRef.current.videoWidth || 480
    const h = videoRef.current.videoHeight || 360
    canvasRef.current.width = w
    canvasRef.current.height = h
    const ctx = canvasRef.current.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, w, h)
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
  }

  const clearCapture = () => setCaptured(null)

  const save = async () => {
    if (!captured || loading) return
    setBusy(true)
    try {
      await onSave(captured)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-5 relative space-y-4">
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >✕</button>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Capturar Rostro</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">Solo se almacena la imagen y un hash para verificación simple (placeholder). No se hace reconocimiento avanzado.</p>
        {error && <div className="p-2 text-sm rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
        {!captured && (
          <video ref={videoRef} className="w-full rounded bg-black aspect-video" playsInline muted />
        )}
        <canvas ref={canvasRef} className="hidden" />
        {captured && (
          <div className="space-y-2">
            <img src={captured} alt="captura" className="rounded w-full" />
            <div className="flex gap-2">
              <button onClick={clearCapture} className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded">Repetir</button>
              <button disabled={busy || loading} onClick={save} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50">
                {busy || loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
        {!captured && (
          <div className="flex justify-end">
            <button onClick={captureFrame} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Capturar</button>
          </div>
        )}
      </div>
    </div>
  )
}
