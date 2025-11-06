import React, { useState } from 'react';

/**
 * Modal para registrar pagos de ventas
 * @param {Object} props
 * @param {Object} props.venta - La venta a pagar { idVenta, nombreCliente, montoTotal, montoPagado }
 * @param {boolean} props.isOpen - Si el modal está abierto
 * @param {Function} props.onClose - Callback al cerrar
 * @param {Function} props.onSuccess - Callback al registrar exitosamente
 * @param {string} props.apiUrl - URL base de la API de ventas
 * @param {string} props.userRole - Rol del usuario (para header)
 */
export default function PagoModal({ venta, isOpen, onClose, onSuccess, apiUrl, userRole }) {
  const [formPago, setFormPago] = useState({
    monto: venta ? (Number(venta.montoTotal || 0) - Number(venta.montoPagado || 0)).toFixed(2) : '',
    metodo: 'contado',
    referencia: '',
    observaciones: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const formatMoney = (amount) => {
    const num = Number(amount || 0);
    try {
      return num.toLocaleString('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 });
    } catch {
      return `Bs ${num.toFixed(2)}`;
    }
  };

  const handleSubmit = async () => {
    if (!venta) return;
    const monto = parseFloat(formPago.monto);
    if (!(monto > 0)) {
      alert('Monto debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    try {
      const body = { monto };
      if (formPago.metodo) body.metodo = formPago.metodo;
      if (formPago.referencia) body.referencia = formPago.referencia;
      if (formPago.observaciones) body.observaciones = formPago.observaciones;

      const res = await fetch(`${apiUrl}/${venta.idVenta}/registrar-pago`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(userRole ? { 'X-User-Role': userRole } : {})
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      const estadoPago = updated?.estado_pago || 'Actualizado';
      alert(`✅ Pago registrado exitosamente\n\nEstado de pago: ${estadoPago}\nMonto: ${formatMoney(monto)}`);
      
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (e) {
      console.error('Error registrando pago:', e);
      alert('No se pudo registrar el pago: ' + (e?.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !venta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold dark:text-white">💵 Registrar Pago</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Venta #{venta.idVenta} - {venta.nombreCliente}
          </p>
          <div className="mt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold dark:text-white">{formatMoney(venta.montoTotal || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Pagado:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">{formatMoney(venta.montoPagado || 0)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
              <span className="text-gray-600 dark:text-gray-400">Pendiente:</span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {formatMoney((Number(venta.montoTotal || 0) - Number(venta.montoPagado || 0)))}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Monto a pagar *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formPago.monto}
              onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })}
              className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="Ej: 100.00"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Método de pago</label>
            <select
              value={formPago.metodo}
              onChange={(e) => setFormPago({ ...formPago, metodo: e.target.value })}
              className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Seleccione...</option>
              <option value="contado">Contado (Efectivo)</option>
              <option value="transferencia">Transferencia Bancaria</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Referencia</label>
            <input
              type="text"
              value={formPago.referencia}
              onChange={(e) => setFormPago({ ...formPago, referencia: e.target.value })}
              className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="Ej: Número de transacción, recibo, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Observaciones</label>
            <textarea
              value={formPago.observaciones}
              onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })}
              rows="2"
              className="w-full border dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-white"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !formPago.monto || parseFloat(formPago.monto) <= 0}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Procesando...' : '💰 Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
