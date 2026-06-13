import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import MainApp from './MainApp.jsx'
import LovableDemo from './LovableDemo.jsx'

export default function App() {
  return (
    <BrowserRouter>
      {/* Nav link oculto, visible solo en desarrollo para cambiar entre rutas */}
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/v2" element={<LovableDemo />} />
      </Routes>
    </BrowserRouter>
  )
}
