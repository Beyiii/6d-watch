import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WatchProvider } from './context/WatchContext.jsx'
import MainApp from './MainApp.jsx'
import LovableDemo from './LovableDemo.jsx'
import { V2Layout } from './lovable/V2Layout.jsx'
import DiaPage from './lovable/pages/DiaPage.jsx'
import CalendarioPage from './lovable/pages/CalendarioPage.jsx'
import MapaPage from './lovable/pages/MapaPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <WatchProvider>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/v2" element={<V2Layout />}>
            <Route index element={<LovableDemo />} />
            <Route path="dia" element={<DiaPage />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="mapa" element={<MapaPage />} />
          </Route>
        </Routes>
      </WatchProvider>
    </BrowserRouter>
  )
}
