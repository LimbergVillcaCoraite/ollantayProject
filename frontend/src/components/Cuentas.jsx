import React, { useEffect, useState } from 'react';
import { useToast } from '../ToastContext';

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMovimientosModal, setShowMovimientosModal] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [formData, setFormData] = useState({
    idPersona: '',
    tipoCuenta: 'corriente',
    saldo: '0.00',
    estado: 1
  });
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchCuentas();
    fetchPersonas();
  }, []);

  const fetchCuentas = async () => {
    try {
      const response = await fetch('/api/cuentas/cuentas', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCuentas(data);
      } else {
        showToast('Error al cargar cuentas', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonas = async () => {
    try {
      const response = await fetch('/api/personas/persons', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPersonas(data);
      }
    } catch (error) {
      console.error('Error al cargar personas:', error);
    }
  };

  const fetchMovimientos = async (idCuenta) => {
    try {
      const response = await fetch(`/api/cuentas/cuentas/${idCuenta}/movimientos`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMovimientos(data);
      } else {
        showToast('Error al cargar movimientos', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleOpenModal = (cuenta = null) => {
    if (cuenta) {
      setEditingCuenta(cuenta);
      setFormData({
        idPersona: cuenta.idPersona,
        tipoCuenta: cuenta.tipoCuenta,
        saldo: cuenta.saldo,
        estado: cuenta.estado
      });
    } else {
      setEditingCuenta(null);
      setFormData({
        idPersona: '',
        tipoCuenta: 'corriente',
        saldo: '0.00',
        estado: 1
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCuenta(null);
    setFormData({
      idPersona: '',
      tipoCuenta: 'corriente',
      saldo: '0.00',
      estado: 1
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const url = editingCuenta
      ? `/api/cuentas/cuentas/${editingCuenta.idCuenta}`
      : '/api/cuentas/cuentas';
    const method = editingCuenta ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          idPersona: parseInt(formData.idPersona),
          saldo: parseFloat(formData.saldo),
          estado: parseInt(formData.estado)
        }),
      });

      if (response.ok) {
        showToast(
          editingCuenta ? 'Cuenta actualizada exitosamente' : 'Cuenta creada exitosamente',
          'success'
        );
        handleCloseModal();
        fetchCuentas();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al guardar cuenta', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleDelete = async (cuenta) => {
    if (!confirm(`¿Eliminar la cuenta de "${cuenta.nombrePersona}"?`)) return;

    try {
      const response = await fetch(`/api/cuentas/cuentas/${cuenta.idCuenta}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        showToast('Cuenta eliminada exitosamente', 'success');
        fetchCuentas();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al eliminar cuenta', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  const handleOpenMovimientos = async (cuenta) => {
    setSelectedCuenta(cuenta);
    await fetchMovimientos(cuenta.idCuenta);
    setShowMovimientosModal(true);
  };

  const handleCloseMovimientosModal = () => {
    setShowMovimientosModal(false);
    setSelectedCuenta(null);
    setMovimientos([]);
  };

  if (loading) {
    return <div className="p-6 text-center">Cargando cuentas...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Gestión de Cuentas Corrientes</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Nueva Cuenta
        </button>
      </div>
      {/* Tabla de Cuentas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Persona
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Empresa
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Saldo
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {cuentas.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay cuentas registradas
                </td>
              </tr>
            ) : (
              cuentas.map((c) => (
                <tr key={c.idCuenta} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {c.idCuenta}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {c.tipoCuenta}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {c.nombrePersona}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {c.nombreEmpresa || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span className={Number(c.saldo) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      Bs {Number(c.saldo || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      c.estado === 1
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {c.estado === 1 ? 'Activa' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleOpenMovimientos(c)}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      title="Ver movimientos"
                    >
                      📋 Movimientos
                    </button>
                    <button
                      onClick={() => handleOpenModal(c)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar Cuenta */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 dark:text-white">
              {editingCuenta ? 'Editar Cuenta' : 'Nueva Cuenta'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Persona *
                </label>
                <select
                  value={formData.idPersona}
                  onChange={(e) => setFormData({ ...formData, idPersona: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  disabled={editingCuenta} // No permitir cambiar persona en edición
                >
                  <option value="">Seleccione una persona...</option>
                  {personas.map((p) => (
                    <option key={p.id_persona} value={p.id_persona}>
                      {p.nombres_persona} {p.apellido_paternoPersona}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Tipo de Cuenta *
                </label>
                <select
                  value={formData.tipoCuenta}
                  onChange={(e) => setFormData({ ...formData, tipoCuenta: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="corriente">Corriente</option>
                  <option value="ahorro">Ahorro</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Saldo Inicial *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.saldo}
                  onChange={(e) => setFormData({ ...formData, saldo: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  disabled={editingCuenta} // No permitir cambiar saldo directamente en edición
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                  Estado *
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value={1}>Activa</option>
                  <option value={0}>Cerrada</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded dark:bg-gray-600 dark:hover:bg-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  {editingCuenta ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movimientos */}
      {showMovimientosModal && selectedCuenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">
                Movimientos - {selectedCuenta.nombrePersona}
              </h2>
              <button
                onClick={handleCloseMovimientosModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tipo:</span>
                  <span className="ml-2 font-semibold dark:text-white">{selectedCuenta.tipoCuenta}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Saldo Actual:</span>
                  <span className={`ml-2 font-bold ${Number(selectedCuenta.saldo) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Bs {Number(selectedCuenta.saldo || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border rounded dark:border-gray-600">
              <table className="min-w-full">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">Fecha</th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">Tipo</th>
                    <th className="px-4 py-2 text-left text-sm font-medium dark:text-gray-300">Descripción</th>
                    <th className="px-4 py-2 text-right text-sm font-medium dark:text-gray-300">Monto</th>
                    <th className="px-4 py-2 text-right text-sm font-medium dark:text-gray-300">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {movimientos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                        No hay movimientos registrados
                      </td>
                    </tr>
                  ) : (
                    movimientos.map((mov, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm dark:text-gray-200">
                          {new Date(mov.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm dark:text-gray-200">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            mov.tipo === 'ingreso' || mov.tipo === 'cargo'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {mov.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm dark:text-gray-300">
                          {mov.descripcion || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <span className={mov.tipo === 'ingreso' || mov.tipo === 'cargo' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {mov.tipo === 'ingreso' || mov.tipo === 'cargo' ? '+' : '-'}
                            Bs {Number(mov.monto || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold dark:text-gray-100">
                          Bs {Number(mov.saldo_resultante || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
