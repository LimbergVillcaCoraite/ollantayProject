import React, {useEffect, useState} from 'react'

export default function App(){
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(()=>{
    fetch('http://localhost:8001/types')
      .then(res => {
        if(!res.ok) throw new Error('Network response was not ok')
        return res.json()
      })
      .then(data => {
        setTypes(data.data || [])
      })
      .catch(err => setError(err.message))
      .finally(()=> setLoading(false))
  },[])

  return (
    <div style={{padding:20}}>
      <h1>Ollantay Frontend</h1>
      <p>React + Vite minimal app</p>

      <h2>Tipos de persona</h2>
      {loading && <p>Cargando...</p>}
      {error && <p style={{color:'red'}}>Error: {error}</p>}
      {!loading && !error && (
        <ul>
          {types.map(t => (
            <li key={t.id}>{t.tipo}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
