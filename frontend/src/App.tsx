import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <h1>Профком</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          хуёвы счетчик {count}
        </button>
        <p>
          хуй хуй пизда
        </p>
      </div>
    </>
  )
}

export default App
