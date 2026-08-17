import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom'
import { WatchProvider } from './context/WatchContext.jsx'
import MainApp from './MainApp.jsx'
import WatchUiHome from './WatchUiHome.jsx'
import { V2Layout } from './watch-ui/V2Layout.jsx'
import DiaPage from './watch-ui/pages/DiaPage.jsx'
import CalendarioPage from './watch-ui/pages/CalendarioPage.jsx'
import MapaPage from './watch-ui/pages/MapaPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <WatchProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/v2" replace />} />
          <Route path="/legacy" element={<MainApp />} />
          <Route path="/v2" element={<V2Layout />}>
            <Route index element={<WatchUiHome />} />
            <Route path="dia" element={<DiaPage />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="mapa" element={<MapaPage />} />
          </Route>
        </Routes>
      </WatchProvider>
    </BrowserRouter>
  )
}
