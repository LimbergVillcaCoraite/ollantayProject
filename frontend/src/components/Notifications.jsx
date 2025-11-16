import React, { useEffect, useState } from 'react'

export default function Notifications({ API, userRole = 'admin' }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [filter, setFilter] = useState('all') // all | unread | read

  const fetchNotifications = async () => {
    try {
      const params = filter === 'unread' ? '?leida=0' : filter === 'read' ? '?leida=1' : ''
      const res = await fetch(`${API}${params}`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(`${API}/unread/count`, {
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count || 0)
      } else if (res.status === 404) {
        // Endpoint no implementado, contar localmente desde notificaciones
        const unread = notifications.filter(n => !n.leida).length
        setUnreadCount(unread)
      }
    } catch (err) {
      console.error('Error loading unread count:', err)
      // Fallback: contar desde notificaciones cargadas
      const unread = notifications.filter(n => !n.leida).length
      setUnreadCount(unread)
    }
  }

  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [API, userRole, filter])

  const markRead = async (id) => {
    try {
      const res = await fetch(`${API}/${id}/read`, {
        method: 'PUT',
        headers: { 'X-User-Role': userRole },
        credentials: 'include'
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.idNotification === id ? { ...n, leida: true, read_at: new Date().toISOString() } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error marking read:', err)
    }
  }

  const getPriorityColor = (p) => {
    if (p === 'alta') return 'text-red-600 dark:text-red-400'
    if (p === 'baja') return 'text-gray-500 dark:text-gray-400'
    return 'text-blue-600 dark:text-blue-400'
  }

  const getTypeIcon = (tipo) => {
    if (tipo.includes('prestamo')) return '💰'
    if (tipo.includes('asistencia')) return '👤'
    if (tipo.includes('venta')) return '🛒'
    if (tipo.includes('compra')) return '📦'
    return '🔔'
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notificaciones"
      >
        <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div className="absolute right-0 top-12 z-50 w-96 max-h-[32rem] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h3>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setFilter('all')} className={`px-3 py-1 text-xs rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Todas</button>
              <button onClick={() => setFilter('unread')} className={`px-3 py-1 text-xs rounded ${filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>No leídas</button>
              <button onClick={() => setFilter('read')} className={`px-3 py-1 text-xs rounded ${filter === 'read' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>Leídas</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">No hay notificaciones</div>
            ) : (
              <div>
                {notifications.map(n => (
                  <div
                    key={n.idNotification}
                    className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${!n.leida ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
                    onClick={() => !n.leida && markRead(n.idNotification)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getTypeIcon(n.tipo)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-semibold ${!n.leida ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>{n.titulo}</h4>
                          {!n.leida && <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></span>}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{n.mensaje}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs ${getPriorityColor(n.prioridad)}`}>
                            {n.prioridad === 'alta' ? '⚠️ Alta' : n.prioridad === 'baja' ? 'Baja' : 'Normal'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(n.created_at).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
            <button onClick={() => setShowPanel(false)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
