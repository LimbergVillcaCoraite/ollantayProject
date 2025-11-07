import React, { useEffect, useState } from 'react';
import { useToast } from '../ToastContext';

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMovimientosModal, setShowMovimientosModal] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [tiposPago, setTiposPago] = useState([]);
  
  // Filtros
  const [filterTipo, setFilterTipo] = useState('');
  const [filterPersona, setFilterPersona] = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  
  // Form pago rápido
  const [pagoForm, setPagoForm] = useState({
    idPersona: '',
    monto: '',
    idTipoPago: '',
    fechaPago: new Date().toISOString().slice(0, 10),
    numeroReferencia: '',
    observaciones: ''
  });
  
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
    fetchTiposPago();
  }, []);

  const fetchCuentas = async () => {
    try {
      const response = await fetch('/api/cuentas', {
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

  const fetchTiposPago = async () => {
    try {
      const response = await fetch('/api/ventas/tipos-pago', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTiposPago(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al cargar tipos de pago:', error);
    }
  };

  const fetchMovimientos = async (idCuenta) => {
    try {
      // idCuenta es virtual y corresponde a idPersona en el backend
      const response = await fetch(`/api/cuentas/persona/${idCuenta}/movimientos`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const rows = (data.movimientos || []).map((m) => {
          const haber = Number(m.haber || 0);
          const debe = Number(m.debe || 0);
          return {
            fecha: m.fechaMovimiento,
            tipo: haber > 0 ? 'ingreso' : 'cargo',
            descripcion: m.descripcion,
            monto: haber > 0 ? haber : debe,
            saldo_resultante: Number(m.saldoAcumulado || 0),
          };
        });
        setMovimientos(rows);
      } else {
        showToast('Error al cargar movimientos', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  // La creación/edición de cuentas ya no aplica (las cuentas se derivan de movimientos)
  const handleOpenModal = () => {};

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

  const handleSubmit = async (e) => { e.preventDefault(); };

  const handleDelete = async (cuenta) => {
    if (!confirm(`¿Eliminar la cuenta de "${cuenta.nombrePersona}"?`)) return;

    try {
      const response = await fetch(`/api/cuentas/${cuenta.idCuenta}`, {
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

  const handleOpenPagoModal = (cuenta) => {
    setPagoForm({
      idPersona: cuenta.idPersona,
      monto: '',
      idTipoPago: '',
      fechaPago: new Date().toISOString().slice(0, 10),
      numeroReferencia: '',
      observaciones: ''
    });
    setSelectedCuenta(cuenta);
    setShowPagoModal(true);
  };

  const handleClosePagoModal = () => {
    setShowPagoModal(false);
    setPagoForm({
      idPersona: '',
      monto: '',
      idTipoPago: '',
      fechaPago: new Date().toISOString().slice(0, 10),
      numeroReferencia: '',
      observaciones: ''
    });
    setSelectedCuenta(null);
  };

  const handleSubmitPago = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/cuentas/pagos-cobros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tipo: 'cobro',
          idPersona: parseInt(pagoForm.idPersona),
          monto: parseFloat(pagoForm.monto),
          idTipoPago: parseInt(pagoForm.idTipoPago),
          fechaPago: pagoForm.fechaPago,
          numeroReferencia: pagoForm.numeroReferencia,
          observaciones: pagoForm.observaciones
        }),
      });

      if (response.ok) {
        showToast('Cobro registrado exitosamente', 'success');
        handleClosePagoModal();
        fetchCuentas();
      } else {
        const error = await response.json();
        showToast(error.detail || 'Error al registrar cobro', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
      console.error(error);
    }
  };

  // Filtrar cuentas
  const filteredCuentas = cuentas.filter(c => {
    if (filterTipo && c.tipoCuenta !== filterTipo) return false;
    if (filterPersona && !c.nombrePersona?.toLowerCase().includes(filterPersona.toLowerCase())) return false;
    return true;
  });

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
        {/* La creación manual de cuentas ya no está disponible */}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Cuenta
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos</option>
              <option value="corriente">Corriente</option>
              <option value="ahorros">Ahorros</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar Persona
            </label>
            <input
              type="text"
              value={filterPersona}
              onChange={(e) => setFilterPersona(e.target.value)}
              placeholder="Nombre de persona..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <button
              onClick={() => { setFilterTipo(''); setFilterPersona(''); }}
              className="mt-6 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded w-full"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Cuentas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
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
            {filteredCuentas.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay cuentas registradas
                </td>
              </tr>
            ) : (
              filteredCuentas.map((c) => (
                <tr key={c.idCuenta} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {c.idCuenta}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {c.tipoCuenta === 'C' ? 'Cliente' : 'Proveedor'}
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
                      onClick={() => handleOpenPagoModal(c)}
                      className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                      title="Registrar pago/cobro"
                    >
                      💵 Pago
                    </button>
                    {/* Edición y eliminación deshabilitadas en el nuevo modelo basado en movimientos */}
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
                  <span className="ml-2 font-semibold dark:text-white">{selectedCuenta.tipoCuenta === 'C' ? 'Cliente' : 'Proveedor'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Saldo Actual:</span>
                  <span className={`ml-2 font-bold ${Number(selectedCuenta.saldo) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Bs {Number(selectedCuenta.saldo || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border rounded dark:border-gray-600 overflow-x-auto">
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

      {/* Modal Registrar Pago/Cobro */}
      {showPagoModal && selectedCuenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Registrar Pago/Cobro</h2>
              <button onClick={handleClosePagoModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="mb-4 p-3 rounded bg-gray-50 dark:bg-gray-700">
              <div className="text-sm dark:text-gray-200">Persona: <span className="font-semibold">{selectedCuenta.nombrePersona}</span></div>
              <div className="text-sm dark:text-gray-200">Saldo actual: <span className={`font-semibold ${Number(selectedCuenta.saldo) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Bs {Number(selectedCuenta.saldo || 0).toFixed(2)}</span></div>
            </div>
            <form onSubmit={handleSubmitPago}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Monto *</label>
                <input type="number" step="0.01" value={pagoForm.monto} onChange={(e)=>setPagoForm({...pagoForm, monto: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo de Pago *</label>
                <select value={pagoForm.idTipoPago} onChange={(e)=>setPagoForm({...pagoForm, idTipoPago: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                  <option value="">Seleccione...</option>
                  {tiposPago.map(tp => (
                    <option key={tp.idPago || tp.id_pago || tp.id} value={tp.idPago || tp.id_pago || tp.id}>{tp.nombrePago || tp.nombre || tp.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Fecha *</label>
                <input type="date" value={pagoForm.fechaPago} onChange={(e)=>setPagoForm({...pagoForm, fechaPago: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" required />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">N° Referencia</label>
                <input type="text" value={pagoForm.numeroReferencia} onChange={(e)=>setPagoForm({...pagoForm, numeroReferencia: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Observaciones</label>
                <textarea value={pagoForm.observaciones} onChange={(e)=>setPagoForm({...pagoForm, observaciones: e.target.value})} className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows="3" />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={handleClosePagoModal} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded dark:bg-gray-600 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
