import React, { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ API_BASE, userRole }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre el sistema, ayudarte con tareas comunes o brindarte información.',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getAssistantResponse = (userMessage) => {
    const msg = userMessage.toLowerCase()
    
    // Respuestas predefinidas basadas en keywords
    if (msg.includes('hola') || msg.includes('buenos') || msg.includes('buenas')) {
      return '¡Hola! ¿En qué puedo ayudarte hoy?'
    }
    
    if (msg.includes('ayuda') || msg.includes('help')) {
      return 'Puedo ayudarte con:\n• Información sobre módulos del sistema\n• Explicación de funcionalidades\n• Guía de uso de características\n• Responder preguntas frecuentes\n\n¿Qué necesitas saber?'
    }
    
    if (msg.includes('ventas') || msg.includes('vender')) {
      return 'El módulo de Ventas te permite:\n• Registrar nuevas ventas\n• Ver historial de ventas\n• Generar comprobantes\n• Administrar créditos\n• Ver estadísticas\n\nAccede desde el menú lateral "Ventas".'
    }
    
    if (msg.includes('compras') || msg.includes('comprar')) {
      return 'El módulo de Compras te permite:\n• Registrar compras a proveedores\n• Gestionar inventario\n• Ver historial de compras\n• Subir comprobantes\n\nAccede desde el menú lateral "Compras".'
    }
    
    if (msg.includes('personas') || msg.includes('clientes')) {
      return 'El módulo de Personas te permite:\n• Registrar clientes y proveedores\n• Ver ubicaciones en mapa\n• Gestionar datos de contacto\n• Asignar tipos de persona\n\nAccede desde el menú lateral "Personas".'
    }
    
    if (msg.includes('préstamo') || msg.includes('prestamo')) {
      return 'El módulo de Préstamos te permite:\n• Registrar nuevos préstamos\n• Ver estado de préstamos\n• Gestionar cuotas y pagos\n• Ver historial\n\nAccede desde el menú lateral "Préstamos".'
    }
    
    if (msg.includes('cámara') || msg.includes('camara') || msg.includes('seguridad')) {
      return 'El módulo de Cámaras de Seguridad te permite:\n• Conectar cámaras IP\n• Ver transmisión en vivo\n• Capturar snapshots\n• Registrar eventos\n• Configurar grabaciones\n\nAccede desde el menú lateral "Cámaras".'
    }
    
    if (msg.includes('gamificación') || msg.includes('gamificacion') || msg.includes('puntos')) {
      return 'La Gamificación incluye:\n• Sistema de puntos por acciones\n• Insignias y logros\n• Rankings de usuarios\n• Niveles de progreso\n\nGana puntos realizando actividades en el sistema!'
    }
    
    if (msg.includes('dashboard') || msg.includes('inicio')) {
      return 'El Dashboard muestra:\n• Resumen de métricas clave\n• Gráficos de ventas\n• Estadísticas del mes\n• Accesos rápidos\n\nEs la pantalla principal al iniciar sesión.'
    }
    
    if (msg.includes('gracias') || msg.includes('thank')) {
      return '¡De nada! Estoy aquí para ayudarte. Si necesitas algo más, no dudes en preguntar. 😊'
    }
    
    if (msg.includes('adiós') || msg.includes('adios') || msg.includes('chao')) {
      return '¡Hasta pronto! Que tengas un excelente día. 👋'
    }
    
    // Respuesta por defecto
    return 'Entiendo tu pregunta. Por favor, sé más específico sobre qué necesitas saber. Puedo ayudarte con información sobre:\n• Ventas\n• Compras\n• Personas/Clientes\n• Préstamos\n• Cámaras de Seguridad\n• Gamificación\n• Y más...\n\n¿Sobre qué tema necesitas ayuda?'
  }

  const handleSend = async () => {
    if (!inputText.trim()) return

    const userMessage = {
      id: messages.length + 1,
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsTyping(true)

    // Simular delay de respuesta
    setTimeout(() => {
      const assistantMessage = {
        id: messages.length + 2,
        role: 'assistant',
        content: getAssistantResponse(inputText),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 500 + Math.random() * 1000)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: 1,
      role: 'assistant',
      content: 'Conversación reiniciada. ¿En qué puedo ayudarte?',
      timestamp: new Date()
    }])
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-sm sm:text-base">AI</span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Asistente Virtual</h2>
            <p className="text-xs text-gray-500 hidden sm:block">Estoy aquí para ayudarte</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="text-xs sm:text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors"
          title="Limpiar conversación"
        >
          🗑️ <span className="hidden sm:inline">Limpiar</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <div className="text-sm sm:text-base whitespace-pre-wrap break-words">{msg.content}</div>
              <div
                className={`text-xs mt-1 sm:mt-2 ${
                  msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-md border border-gray-200">
              <div className="flex gap-1 sm:gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-3 sm:p-4 shadow-lg">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta aquí..."
            rows={1}
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            <span className="hidden sm:inline">Enviar</span>
            <span className="sm:hidden">📤</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          💡 Tip: Presiona Enter para enviar (Shift+Enter para nueva línea)
        </p>
      </div>
    </div>
  )
}
