// Push notification utilities

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return false
  }
  
  if (Notification.permission === 'granted') {
    return true
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  
  return false
}

export async function subscribeToPush(apiBase, userRole) {
  try {
    // Check service worker
    const registration = await navigator.serviceWorker.ready
    
    if (!registration.pushManager) {
      console.warn('Push manager not available')
      return null
    }
    
    // Get existing subscription or create new
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // VAPID public key (generate with: openssl ecparam -genkey -name prime256v1 -out private_key.pem)
      // For demo, use a placeholder - in production, generate and use real keys
      const vapidPublicKey = 'BMxcP-b7XqKvXZvJLwgzGkrF3YoHM8fqQZqM5xGc8vJ9ZqIzXQRLm5VhRqPyQZxM8VqFYkQz'
      
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })
      } catch (err) {
        console.error('Failed to subscribe:', err)
        return null
      }
    }
    
    // Register token with backend
    const token = JSON.stringify(subscription)
    const response = await fetch(`${apiBase}/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': userRole || 'admin'
      },
      credentials: 'include',
      body: JSON.stringify({
        token,
        platform: 'web'
      })
    })
    
    if (response.ok) {
      console.log('✅ Push subscription registered')
      return subscription
    } else {
      console.error('Failed to register token:', response.status)
      return null
    }
  } catch (err) {
    console.error('Error subscribing to push:', err)
    return null
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
      console.log('✅ Unsubscribed from push')
      return true
    }
    
    return false
  } catch (err) {
    console.error('Error unsubscribing:', err)
    return false
  }
}

// Test notification (local only, not from server)
export function showTestNotification() {
  if (Notification.permission === 'granted') {
    new Notification('Ollantay - Prueba', {
      body: 'Las notificaciones están funcionando correctamente',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100]
    })
  }
}
