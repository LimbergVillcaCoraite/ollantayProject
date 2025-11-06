import { useEffect, useRef } from 'react';

/**
 * Componente que rastrea automáticamente la ubicación del usuario
 * y la envía al servidor cada cierto intervalo
 */
export default function AutoLocationTracker({ API_PERSONAS, loggedUser, enabled = true }) {
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const SEND_INTERVAL = 15000; // Enviar cada 15 segundos como máximo para mayor frescura

  useEffect(() => {
    if (!enabled || !loggedUser?.id_persona || !("geolocation" in navigator)) {
      return;
    }

    const sendLocation = async (position) => {
      const now = Date.now();
      // Evitar enviar muy frecuentemente
      if (now - lastSentRef.current < SEND_INTERVAL) {
        return;
      }

      try {
        // Redondear a 6 decimales para mayor precisión sin exceder tamaño
        const lat = Number(position.coords.latitude.toFixed(6))
        const lng = Number(position.coords.longitude.toFixed(6))
        const accuracy = position.coords.accuracy || 0
        const response = await fetch(`${API_PERSONAS}/persons/${loggedUser.id_persona}/ubicacion`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_persona: loggedUser.id_persona,
            lat,
            lng,
            accuracy
          })
        });

        if (response.ok) {
          lastSentRef.current = now;
          console.log('✓ Ubicación actualizada automáticamente');
        }
      } catch (error) {
        console.log('Error al enviar ubicación:', error);
      }
    };

    // Enviar ubicación inicial inmediatamente
    navigator.geolocation.getCurrentPosition(
      (position) => sendLocation(position),
      (error) => console.log('Error obteniendo ubicación inicial:', error.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    // Configurar rastreo continuo con baja frecuencia para ahorrar batería
    const options = {
      enableHighAccuracy: true, // pedir GPS para mejorar precisión
      maximumAge: 10000,
      timeout: 15000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // Si la precisión es pobre (>50m), intentar una lectura puntual de alta precisión
        if (position?.coords?.accuracy && position.coords.accuracy > 50) {
          try { navigator.geolocation.getCurrentPosition((p)=>sendLocation(p), ()=>sendLocation(position), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) } catch {}
        } else {
          sendLocation(position)
        }
      },
      (error) => {
        // Solo loguear errores que no sean de permiso denegado
        if (error.code !== error.PERMISSION_DENIED) {
          console.log('Error en rastreo de ubicación:', error.message);
        }
      },
      options
    );

    // Cleanup: detener rastreo al desmontar
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        console.log('⏹️ Rastreo de ubicación detenido');
      }
    };
  }, [enabled, loggedUser?.id_persona, API_PERSONAS]);

  // Este componente no renderiza nada
  return null;
}
