import { useState } from 'react'

function App() {
  const [status] = useState('Loading...')

  return (
    <div>
      <h1>GroundTruth Local</h1>
      <p>Status: {status}</p>
    </div>
  )
}

export default App