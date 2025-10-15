// minimal toast helper using DOM (no external lib) for emergent popups
export function showToast(message, type = 'info', timeout = 3000){
  const containerId = 'app-toast-container'
  let container = document.getElementById(containerId)
  if(!container){
    container = document.createElement('div')
    container.id = containerId
    container.style.position = 'fixed'
    container.style.zIndex = 9999
    container.style.right = '1rem'
    container.style.top = '1rem'
    document.body.appendChild(container)
  }
  const el = document.createElement('div')
  el.className = 'mb-2 px-4 py-2 rounded shadow-lg text-white'
  el.style.minWidth = '200px'
  el.style.opacity = '0.95'
  el.style.transition = 'transform 200ms, opacity 200ms'
  if(type === 'error') el.style.background = '#dc2626'
  else if(type === 'success') el.style.background = '#16a34a'
  else el.style.background = '#2563eb'
  el.textContent = message
  container.appendChild(el)
  setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(()=>el.remove(), 200) }, timeout)
}
