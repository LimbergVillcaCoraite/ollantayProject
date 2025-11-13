import React, { useState, useEffect } from 'react';
import offlineQueue from '../utils/offlineQueue';

const OfflineStatus = ({ dark }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState({ total: 0, pending: 0, failed: 0 });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Actualizar estado de conexión
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cargar estadísticas cada 5 segundos
    const interval = setInterval(loadStats, 5000);
    loadStats(); // Carga inicial

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadStats = async () => {
    try {
      const queueStats = await offlineQueue.getQueueStats();
      setStats(queueStats);
    } catch (error) {
      console.error('Error cargando stats de cola:', error);
    }
  };

  const handleSync = async () => {
    try {
      await offlineQueue.syncQueue();
      await loadStats();
    } catch (error) {
      console.error('Error sincronizando:', error);
    }
  };

  const handleClearFailed = async () => {
    if (confirm('¿Eliminar todas las acciones fallidas?')) {
      await offlineQueue.clearFailedActions();
      await loadStats();
    }
  };

  if (stats.total === 0 && isOnline) {
    // No mostrar nada si no hay acciones pendientes y estamos online
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${dark ? 'text-white' : 'text-gray-900'}`}>
      {/* Badge de estado */}
      <div
        onClick={() => setShowDetails(!showDetails)}
        className={`cursor-pointer px-4 py-2 rounded-full shadow-xl flex items-center gap-2 transition-all ${
          isOnline
            ? stats.pending > 0
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-green-500 hover:bg-green-600'
            : 'bg-red-500 hover:bg-red-600 animate-pulse'
        } text-white font-semibold`}
      >
        {isOnline ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
            </svg>
            En Línea
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
            Sin Conexión
          </>
        )}
        {stats.total > 0 && (
          <span className="bg-white/30 px-2 py-0.5 rounded-full text-xs">
            {stats.total}
          </span>
        )}
      </div>

      {/* Panel de detalles */}
      {showDetails && (
        <div
          className={`mt-2 w-80 rounded-2xl shadow-2xl p-4 ${
            dark ? 'bg-gray-800' : 'bg-white'
          } border ${dark ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Estado de Sincronización</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Estadísticas */}
          <div className="space-y-3 mb-4">
            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm">Acciones pendientes</span>
                <span className="font-bold text-yellow-500">{stats.pending}</span>
              </div>
            </div>

            {stats.failed > 0 && (
              <div className={`p-3 rounded-lg ${dark ? 'bg-red-900/20' : 'bg-red-100'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Acciones fallidas</span>
                  <span className="font-bold text-red-500">{stats.failed}</span>
                </div>
              </div>
            )}

            <div className={`p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm">Total en cola</span>
                <span className="font-bold">{stats.total}</span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="space-y-2">
            {isOnline && stats.pending > 0 && (
              <button
                onClick={handleSync}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/>
                </svg>
                Sincronizar Ahora
              </button>
            )}

            {stats.failed > 0 && (
              <button
                onClick={handleClearFailed}
                className={`w-full ${
                  dark ? 'bg-red-900/50 hover:bg-red-900/70' : 'bg-red-100 hover:bg-red-200'
                } text-red-600 dark:text-red-400 font-semibold py-2 px-4 rounded-lg transition-all`}
              >
                Limpiar Fallidas
              </button>
            )}

            {!isOnline && (
              <div className={`text-sm p-3 rounded-lg ${dark ? 'bg-orange-900/20' : 'bg-orange-100'} text-orange-600`}>
                ⚠️ Modo offline activo. Las acciones se sincronizarán automáticamente cuando vuelva la conexión.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineStatus;
