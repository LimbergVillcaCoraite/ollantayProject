import React, { useEffect, useState } from 'react';

/**
 * Componente selector de empresa para superadmin
 * Solo se muestra si el usuario es superadmin
 * Permite filtrar datos por empresa en todas las interfaces
 */
export default function EmpresaSelector({ userRole, selectedEmpresa, onEmpresaChange }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);

  // Solo mostrar para superadmin
  if (userRole !== 'superadmin') {
    return null;
  }

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    setLoading(true);
    try {
      const host = window.location.hostname;
      const proto = window.location.protocol;
      const res = await fetch(`${proto}//${host}/api/personas/empresas`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error cargando empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b-2 border-purple-200 dark:border-purple-700">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Filtrar por Empresa:
        </span>
        <select
          value={selectedEmpresa || ''}
          onChange={(e) => onEmpresaChange(e.target.value ? parseInt(e.target.value) : null)}
          disabled={loading}
          className="flex-1 max-w-xs px-3 py-1.5 border-2 border-purple-300 dark:border-purple-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-purple-500 focus:border-purple-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-sm hover:border-purple-400 transition-colors"
        >
          <option value="">🌐 Todas las Empresas</option>
          {empresas.map(emp => (
            <option key={emp.idEmpresa} value={emp.idEmpresa}>
              {emp.nombreComercial || emp.razonSocial || `Empresa #${emp.idEmpresa}`}
            </option>
          ))}
        </select>
        {selectedEmpresa && (
          <button
            onClick={() => onEmpresaChange(null)}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg 
                       shadow-sm transition-colors flex items-center gap-1"
            title="Limpiar filtro"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar
          </button>
        )}
      </div>
      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Cargando...</div>
      )}
    </div>
  );
}
