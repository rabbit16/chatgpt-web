import { useRoutes } from 'react-router-dom'
import { webRouter } from '../routers'

function App() {
  return useRoutes(webRouter)
}

export default App
