import { Route, Routes } from 'react-router'
import AppLayout from './components/AppLayout.jsx'
import PublicLayout from './components/PublicLayout.jsx'
import Analizar from './pages/Analizar.jsx'
import Comparador from './pages/Comparador.jsx'
import Configuracion from './pages/Configuracion.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inicio from './pages/Inicio.jsx'
import Jugadores from './pages/Jugadores.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'
import Partidos from './pages/Partidos.jsx'
import Precios from './pages/Precios.jsx'
import Privacidad from './pages/Privacidad.jsx'
import Reclutamiento from './pages/Reclutamiento.jsx'
import Registro from './pages/Registro.jsx'
import Terminos from './pages/Terminos.jsx'
import { serviciosDemo } from './lib/serviciosDemo.js'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/privacidad" element={<Privacidad />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      <Route element={<AppLayout />}>
        <Route path="/inicio" element={<Inicio />} />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              playersService={serviciosDemo.jugadores}
              overviewService={serviciosDemo.resumen}
            />
          }
        />
        <Route path="/jugadores" element={<Jugadores service={serviciosDemo.jugadores} />} />
        <Route
          path="/analizar"
          element={
            <Analizar service={serviciosDemo.analisis} playersService={serviciosDemo.jugadores} />
          }
        />
        <Route path="/partidos" element={<Partidos />} />
        <Route path="/comparador" element={<Comparador />} />
        <Route path="/reclutamiento" element={<Reclutamiento />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
