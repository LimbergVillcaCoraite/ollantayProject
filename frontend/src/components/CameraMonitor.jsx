import React, { useState, useEffect } from 'react'

const CameraMonitor = ({ loggedUser }) => {
  const [cameras, setCameras] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCamera, setSelectedCamera] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCamera, setEditingCamera] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const API_BASE_URL = `${window.location.protocol}//${window.location.host}`

  const [formData, setFormData] = useState({
    nombre_camera: '',
    descripcion: '',
    tipo_camera: 'ip',
    ip_address: '',
    puerto: '554',
    usuario: '',
    password: '',
    rtsp_url: '',
    ubicacion: '',
    estado: 'inactiva'
  })

  useEffect(() => {
    loadCameras()
    loadEvents()
  }, [])

  const loadCameras = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/cameras`, {
        headers: {
          'Authorization': `Bearer ${loggedUser.token}`
        }
      })
      const data = await response.json()
      setCameras(data.cameras || [])
    } catch (err) {
      console.error('Error loading cameras:', err)
      setError('Error al cargar cámaras')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async (idCamera = null) => {
    try {
      const url = idCamera 
        ? `${API_BASE_URL}/api/cameras/events?id_camera=${idCamera}&limit=20`
        : `${API_BASE_URL}/api/cameras/events?limit=20`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${loggedUser.token}`
        }
      })
      const data = await response.json()
      setEvents(data.events || [])
    } catch (err) {
      console.error('Error loading events:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/cameras`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loggedUser.token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Cámara agregada exitosamente')
        setShowAddModal(false)
        resetForm()
        loadCameras()
      } else {
        setError(data.message || 'Error al agregar cámara')
      }
    } catch (err) {
      setError('Error de conexión al agregar cámara')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/cameras/${editingCamera.id_camera}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loggedUser.token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Cámara actualizada exitosamente')
        setShowEditModal(false)
        setEditingCamera(null)
        resetForm()
        loadCameras()
      } else {
        setError(data.message || 'Error al actualizar cámara')
      }
    } catch (err) {
      setError('Error de conexión al actualizar cámara')
    }
  }

  const handleDelete = async (idCamera) => {
    if (!confirm('¿Está seguro de eliminar esta cámara?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/cameras/${idCamera}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${loggedUser.token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Cámara eliminada exitosamente')
        loadCameras()
      } else {
        setError(data.message || 'Error al eliminar cámara')
      }
    } catch (err) {
      setError('Error de conexión al eliminar cámara')
    }
  }

  const testConnection = async (idCamera) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cameras/cameras/${idCamera}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loggedUser.token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('✅ Conexión exitosa con la cámara')
        loadCameras()
      } else {
        setError(`❌ ${data.message}`)
      }
    } catch (err) {
      setError('Error al probar conexión')
    }
  }

  const openEditModal = (camera) => {
    setEditingCamera(camera)
    setFormData({
      nombre_camera: camera.nombre_camera,
      descripcion: camera.descripcion || '',
      tipo_camera: camera.tipo_camera,
      ip_address: camera.ip_address || '',
      puerto: camera.puerto?.toString() || '554',
      usuario: camera.usuario || '',
      password: camera.password || '',
      rtsp_url: camera.rtsp_url || '',
      ubicacion: camera.ubicacion || '',
      estado: camera.estado
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      nombre_camera: '',
      descripcion: '',
      tipo_camera: 'ip',
      ip_address: '',
      puerto: '554',
      usuario: '',
      password: '',
      rtsp_url: '',
      ubicacion: '',
      estado: 'inactiva'
    })
  }

  const getSnapshotUrl = (idCamera) => {
    return `${API_BASE_URL}/api/cameras/cameras/${idCamera}/snapshot?token=${loggedUser.token}`
  }

  if (loading) {
    return <div className="p-6 text-center">Cargando cámaras...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">📹 Cámaras de Seguridad</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          ➕ Agregar Cámara
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Grid de Cámaras - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {cameras.map(camera => (
          <div key={camera.id_camera} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Vista previa */}
            <div className="bg-gray-900 h-48 flex items-center justify-center relative">
              {camera.estado === 'activa' ? (
                <img 
                  src={getSnapshotUrl(camera.id_camera)} 
                  alt={camera.nombre_camera}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                📹
              </div>
              <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${
                camera.estado === 'activa' ? 'bg-green-500 text-white' :
                camera.estado === 'error' ? 'bg-red-500 text-white' :
                'bg-gray-500 text-white'
              }`}>
                {camera.estado.toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-bold text-lg text-gray-800 mb-1">{camera.nombre_camera}</h3>
              <p className="text-sm text-gray-600 mb-2">{camera.ubicacion}</p>
              <p className="text-xs text-gray-500 mb-3">{camera.descripcion}</p>

              <div className="text-xs text-gray-600 space-y-1 mb-3">
                <div>📍 {camera.ip_address}:{camera.puerto}</div>
                <div>🎥 {camera.tipo_camera.toUpperCase()}</div>
                {camera.ultimo_check && (
                  <div>🕐 Último check: {new Date(camera.ultimo_check).toLocaleString()}</div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  onClick={() => testConnection(camera.id_camera)}
                  className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
                  title="Probar conexión"
                >
                  🔌 Probar
                </button>
                <button
                  onClick={() => openEditModal(camera)}
                  className="flex-1 px-3 py-1.5 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition"
                  title="Editar"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleDelete(camera.id_camera)}
                  className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}

        {cameras.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No hay cámaras registradas. Haz clic en "Agregar Cámara" para comenzar.
          </div>
        )}
      </div>

      {/* Eventos Recientes */}
      <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">📋 Eventos Recientes</h2>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Cámara</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Descripción</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.map(event => (
                <tr key={event.id_event} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{event.nombre_camera}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {event.tipo_evento}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">{event.descripcion}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {new Date(event.fecha_evento).toLocaleString()}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                    No hay eventos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar Cámara */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">➕ Agregar Cámara</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_camera}
                      onChange={(e) => setFormData({...formData, nombre_camera: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.tipo_camera}
                      onChange={(e) => setFormData({...formData, tipo_camera: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ip">IP</option>
                      <option value="rtsp">RTSP</option>
                      <option value="onvif">ONVIF</option>
                      <option value="usb">USB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({...formData, estado: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="activa">Activa</option>
                      <option value="inactiva">Inactiva</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                    <input
                      type="text"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                      placeholder="192.168.1.100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
                    <input
                      type="number"
                      value={formData.puerto}
                      onChange={(e) => setFormData({...formData, puerto: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={formData.usuario}
                      onChange={(e) => setFormData({...formData, usuario: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL RTSP (Opcional)</label>
                  <input
                    type="text"
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({...formData, rtsp_url: e.target.value})}
                    placeholder="rtsp://usuario:password@192.168.1.100:554/stream"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cámara */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">✏️ Editar Cámara</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                {/* Same form fields as Add Modal */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_camera}
                      onChange={(e) => setFormData({...formData, nombre_camera: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.tipo_camera}
                      onChange={(e) => setFormData({...formData, tipo_camera: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ip">IP</option>
                      <option value="rtsp">RTSP</option>
                      <option value="onvif">ONVIF</option>
                      <option value="usb">USB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({...formData, estado: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="activa">Activa</option>
                      <option value="inactiva">Inactiva</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                    <input
                      type="text"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                      placeholder="192.168.1.100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Puerto</label>
                    <input
                      type="number"
                      value={formData.puerto}
                      onChange={(e) => setFormData({...formData, puerto: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={formData.usuario}
                      onChange={(e) => setFormData({...formData, usuario: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL RTSP (Opcional)</label>
                  <input
                    type="text"
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({...formData, rtsp_url: e.target.value})}
                    placeholder="rtsp://usuario:password@192.168.1.100:554/stream"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Actualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingCamera(null)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CameraMonitor
