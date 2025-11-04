/**
 * Sistema de Diseño Unificado - Ollantay Project
 * Configuración centralizada de colores, tipografías y estilos
 */

export const designSystem = {
  // Paleta de colores principal
  colors: {
    primary: {
      50: 'bg-blue-50 dark:bg-blue-950',
      100: 'bg-blue-100 dark:bg-blue-900',
      500: 'bg-blue-500 dark:bg-blue-600',
      600: 'bg-blue-600 dark:bg-blue-600',
      700: 'bg-blue-700 dark:bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      textHover: 'hover:text-blue-700 dark:hover:text-blue-300',
      border: 'border-blue-500 dark:border-blue-600',
    },
    success: {
      50: 'bg-green-50 dark:bg-green-950',
      100: 'bg-green-100 dark:bg-green-900',
      500: 'bg-green-500 dark:bg-green-600',
      600: 'bg-green-600 dark:bg-green-600',
      700: 'bg-green-700 dark:bg-green-500',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-500 dark:border-green-600',
    },
    warning: {
      50: 'bg-yellow-50 dark:bg-yellow-950',
      100: 'bg-yellow-100 dark:bg-yellow-900',
      500: 'bg-yellow-500 dark:bg-yellow-600',
      600: 'bg-yellow-600 dark:bg-yellow-600',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-500 dark:border-yellow-600',
    },
    danger: {
      50: 'bg-red-50 dark:bg-red-950',
      100: 'bg-red-100 dark:bg-red-900',
      500: 'bg-red-500 dark:bg-red-600',
      600: 'bg-red-600 dark:bg-red-600',
      700: 'bg-red-700 dark:bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-500 dark:border-red-600',
    },
    neutral: {
      50: 'bg-gray-50 dark:bg-gray-900',
      100: 'bg-gray-100 dark:bg-gray-800',
      200: 'bg-gray-200 dark:bg-gray-700',
      300: 'bg-gray-300 dark:bg-gray-600',
      500: 'bg-gray-500 dark:bg-gray-500',
      600: 'bg-gray-600 dark:bg-gray-400',
      700: 'bg-gray-700 dark:bg-gray-300',
      800: 'bg-gray-800 dark:bg-gray-200',
      900: 'bg-gray-900 dark:bg-gray-100',
      text: 'text-gray-600 dark:text-gray-400',
      textBold: 'text-gray-900 dark:text-gray-100',
      border: 'border-gray-300 dark:border-gray-600',
    },
  },

  // Botones estandarizados
  buttons: {
    primary: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
    success: 'px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
    danger: 'px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
    warning: 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-500 text-white font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'px-4 py-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1',
    outline: 'px-4 py-2 bg-transparent border-2 border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
    
    // Tamaños
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  },

  // Inputs estandarizados
  inputs: {
    base: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200',
    error: 'w-full px-3 py-2 border-2 border-red-500 dark:border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100',
    success: 'w-full px-3 py-2 border-2 border-green-500 dark:border-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100',
    disabled: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed',
  },

  // Cards y contenedores
  cards: {
    base: 'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6',
    hover: 'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300',
    section: 'bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6',
    item: 'bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-4',
  },

  // Tipografía
  typography: {
    h1: 'text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100',
    h2: 'text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100',
    h3: 'text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100',
    h4: 'text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100',
    h5: 'text-base md:text-lg font-medium text-gray-900 dark:text-gray-100',
    body: 'text-base text-gray-700 dark:text-gray-300',
    bodyBold: 'text-base font-medium text-gray-900 dark:text-gray-100',
    small: 'text-sm text-gray-600 dark:text-gray-400',
    caption: 'text-xs text-gray-500 dark:text-gray-400',
    label: 'text-sm font-medium text-gray-700 dark:text-gray-300',
  },

  // Badges
  badges: {
    primary: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    danger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    neutral: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  },

  // Alerts
  alerts: {
    info: 'p-4 mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg',
    success: 'p-4 mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg',
    warning: 'p-4 mb-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg',
    error: 'p-4 mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg',
  },

  // Espaciado
  spacing: {
    section: 'mb-6',
    card: 'mb-4',
    element: 'mb-3',
    small: 'mb-2',
  },

  // Animaciones
  transitions: {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-200',
    slow: 'transition-all duration-300',
  },

  // Sombras
  shadows: {
    sm: 'shadow-sm',
    base: 'shadow',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    hover: 'hover:shadow-lg',
  },
}

// Funciones helper para combinar clases
export const cn = (...classes) => classes.filter(Boolean).join(' ')

// Variantes de botones como función
export const getButtonClass = (variant = 'primary', size = 'md', disabled = false) => {
  const baseClasses = designSystem.buttons[variant] || designSystem.buttons.primary
  const sizeClass = designSystem.buttons[size] || ''
  return cn(baseClasses, sizeClass, disabled && 'opacity-50 cursor-not-allowed')
}

// Variantes de input como función
export const getInputClass = (state = 'base') => {
  return designSystem.inputs[state] || designSystem.inputs.base
}

// Variantes de badge como función
export const getBadgeClass = (variant = 'primary') => {
  return designSystem.badges[variant] || designSystem.badges.primary
}

export default designSystem
