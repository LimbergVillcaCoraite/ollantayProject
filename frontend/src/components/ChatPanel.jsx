import React, { useEffect, useState, useRef } from 'react'

export default function ChatPanel({ API_BASE, userRole }) {
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [channelError, setChannelError] = useState(null)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [wsStatus, setWsStatus] = useState('disconnected')
  const wsRef = useRef(null)
  const reconnectAttempts = useRef(0)

  const canCreateChannel = ['superadmin','admin','editor'].includes(userRole)

  const loadChannels = async ()=>{
    setLoadingChannels(true); setChannelError(null)
    try {
      const res = await fetch(`${API_BASE}/channels`, { credentials: 'include' })
      if(!res.ok) throw new Error(`Error canales ${res.status}`)
      const data = await res.json()
      setChannels(data)
      if(!activeChannelId && data.length) setActiveChannelId(data[0].id_channel)
    } catch(e){ setChannelError(e.message) }
    finally { setLoadingChannels(false) }
  }

  useEffect(()=>{ loadChannels() }, [API_BASE])

  const createChannel = async ()=>{
    if(!newChannelName.trim()) return
    setCreatingChannel(true)
    try {
      const res = await fetch(`${API_BASE}/channels`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newChannelName.trim() })
      })
      if(!res.ok) throw new Error(`Error crear canal ${res.status}`)
      await loadChannels()
      setNewChannelName('')
    } catch(e){ alert(e.message) }
    finally { setCreatingChannel(false) }
  }

  const loadMessages = async (id)=>{
    if(!id) return
    setLoadingMessages(true)
    try {
      const res = await fetch(`${API_BASE}/channels/${id}/messages`, { credentials: 'include' })
      if(!res.ok) throw new Error('Error cargar mensajes')
      const data = await res.json()
      setMessages(data)
    } catch(e){ console.error(e) }
    finally { setLoadingMessages(false) }
  }

  useEffect(()=>{ loadMessages(activeChannelId) }, [activeChannelId])

  const sendMessage = async ()=>{
    if(!messageText.trim() || !activeChannelId) return
    const content = messageText.trim()
    setMessageText('')
    try {
      const res = await fetch(`${API_BASE}/channels/${activeChannelId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if(!res.ok){ console.warn('Fallo al enviar, estado', res.status); return }
      // Mensaje será recibido también por websocket broadcast
    } catch(e){ console.error('Error enviando mensaje', e) }
  }

  // WebSocket setup
  useEffect(()=>{
    if(!activeChannelId) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${proto}//${host}/api/chat/ws/chat/${activeChannelId}`
    let ws
    function connect(){
      setWsStatus('connecting')
      ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = ()=>{ setWsStatus('connected'); reconnectAttempts.current = 0 }
      ws.onmessage = (evt)=>{
        try {
          const payload = JSON.parse(evt.data)
          if(payload.type === 'chat_message' && payload.message.channel_id === activeChannelId){
            setMessages(m => {
              // avoid duplicates if already loaded
              if(m.find(x => x.id_message === payload.message.id_message)) return m
              return [...m, payload.message]
            })
          }
        } catch(e){ console.error('WS parse error', e) }
      }
      ws.onerror = ()=>{ setWsStatus('error') }
      ws.onclose = ()=>{
        setWsStatus('disconnected')
        if(reconnectAttempts.current < 5){
          const timeout = 1000 * Math.pow(2, reconnectAttempts.current)
          reconnectAttempts.current += 1
          setTimeout(connect, timeout)
        }
      }
    }
    connect()
    return ()=>{ if(wsRef.current) wsRef.current.close() }
  }, [activeChannelId])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Canales</h2>
          <button onClick={loadChannels} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">↻</button>
        </div>
        {loadingChannels && <p className="text-sm text-gray-500">Cargando canales...</p>}
        {channelError && <p className="text-sm text-red-600">{channelError}</p>}
        <ul className="space-y-1 overflow-y-auto max-h-64">
          {channels.map(c => (
            <li key={c.id_channel}>
              <button
                onClick={()=> setActiveChannelId(c.id_channel)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${activeChannelId === c.id_channel ? 'bg-blue-100 dark:bg-blue-700 text-blue-800 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                #{c.nombre || c.id_channel}
              </button>
            </li>
          ))}
          {!channels.length && !loadingChannels && (
            <li className="text-xs text-gray-500">No hay canales</li>
          )}
        </ul>
        {canCreateChannel && (
          <div className="mt-4">
            <input
              value={newChannelName}
              onChange={e=> setNewChannelName(e.target.value)}
              placeholder="Nuevo canal"
              className="w-full text-sm px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={createChannel}
              disabled={creatingChannel}
              className="mt-2 w-full text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-3 py-2"
            >{creatingChannel ? 'Creando...' : 'Crear Canal'}</button>
          </div>
        )}
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">WS: {wsStatus}</div>
      </div>
      <div className="md:col-span-2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Chat</h2>
        {!activeChannelId && <p className="text-sm text-gray-500">Selecciona un canal para comenzar</p>}
        {activeChannelId && (
          <>
            <div className="flex-1 overflow-y-auto border rounded p-3 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mb-3 max-h-96">
              {loadingMessages && <p className="text-sm text-gray-500">Cargando mensajes...</p>}
              {!loadingMessages && !messages.length && <p className="text-sm text-gray-500">No hay mensajes aún</p>}
              {messages.map(msg => (
                <div key={msg.id_message} className="mb-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">{msg.username || msg.sender_id}</div>
                  <div className="px-2 py-1 inline-block bg-blue-100 dark:bg-blue-700 rounded text-sm text-blue-800 dark:text-blue-100">{msg.content}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(msg.created_at).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
            <form onSubmit={e=>{ e.preventDefault(); sendMessage() }} className="flex gap-2">
              <input
                value={messageText}
                onChange={e=> setMessageText(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <button type="submit" disabled={!messageText.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50">Enviar</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
