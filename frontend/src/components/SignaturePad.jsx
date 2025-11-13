import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

/**
 * SignaturePad component
 * Props:
 *  - onSave(dataUrl, meta)
 *  - onCancel()
 *  - loading (bool)
 */
export default function SignaturePad({ onSave, onCancel, loading }) {
  const sigRef = useRef(null)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [penSize, setPenSize] = useState(2)
  const [error, setError] = useState(null)

  const clear = () => {
    sigRef.current?.clear()
  }

  const handleSave = () => {
    if (!sigRef.current) return
    if (sigRef.current.isEmpty()) {
      setError('La firma está vacía')
      return
    }
    try {
      const canvas = sigRef.current.getTrimmedCanvas()
      const dataUrl = canvas.toDataURL('image/png')
      onSave(dataUrl, { width: canvas.width, height: canvas.height })
    } catch (e) {
      setError(e.message || 'No se pudo generar la imagen')
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Firma digital</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="space-y-2">
          <SignatureCanvas
            penColor={strokeColor}
            throttle={16}
            minWidth={penSize}
            maxWidth={penSize + 1}
            ref={sigRef}
            canvasProps={{
              className: 'bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 w-full h-56'
            }}
          />
          {error && <div className="text-xs text-red-600 dark:text-red-300">{error}</div>}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300">Color:</label>
            <input type="color" value={strokeColor} onChange={e=>setStrokeColor(e.target.value)} />
            <label className="text-xs text-gray-600 dark:text-gray-300 ml-2">Grosor:</label>
            <input type="range" min={1} max={6} value={penSize} onChange={e=>setPenSize(Number(e.target.value))} />
          </div>
          <div className="flex gap-2">
            <button onClick={clear} type="button" className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded">Limpiar</button>
            <button onClick={handleSave} disabled={loading} className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
