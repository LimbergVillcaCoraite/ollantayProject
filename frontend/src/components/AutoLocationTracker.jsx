import { useEffect, useRef } from 'react';

/**
 * Componente que rastrea automáticamente la ubicación del usuario
 * y la envía al servidor cada cierto intervalo
 */
export default function AutoLocationTracker({ API_PERSONAS, loggedUser, enabled = true }) {
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);
  const SEND_INTERVAL = 30000; // Enviar cada 30 segundos como máximo

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
        const response = await fetch(`${API_PERSONAS}/persons/${loggedUser.id_persona}/ubicacion`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_persona: loggedUser.id_persona,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || 0
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
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    // Configurar rastreo continuo con baja frecuencia para ahorrar batería
    const options = {
      enableHighAccuracy: false, // Usar GPS solo cuando sea necesario
      maximumAge: 30000, // Aceptar ubicaciones hasta 30 segundos antiguas
      timeout: 10000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => sendLocation(position),
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
