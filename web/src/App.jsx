import { Route, Routes } from 'react-router'
import { lazy, Suspense } from 'react'
import PublicLayout from './landing/components/PublicLayout.jsx'
import RequireAuth from './panel/components/RequireAuth.jsx'
import Landing from './landing/pages/Landing.jsx'
import NotFound from './compartido/pages/NotFound.jsx'

const conPanel = (cargar) =>
  lazy(() =>
    Promise.all([import('./panel/rutas.jsx'), cargar()]).then(([{ conectar }, pagina]) => ({
      default: conectar(pagina.default),
    })),
  )

const Acceso = lazy(() => import('./panel/pages/Acceso.jsx'))
const Analizar = conPanel(() => import('./panel/pages/Analizar.jsx'))
const AppLayout = lazy(() => import('./panel/components/AppLayout.jsx'))
const Checkout = conPanel(() => import('./panel/pages/Checkout.jsx'))
const Comparador = conPanel(() => import('./panel/pages/Comparador.jsx'))
const Configuracion = conPanel(() => import('./panel/pages/Configuracion.jsx'))
const Dashboard = conPanel(() => import('./panel/pages/Dashboard.jsx'))
const Inicio = conPanel(() => import('./panel/pages/Inicio.jsx'))
const Jugadores = conPanel(() => import('./panel/pages/Jugadores.jsx'))
const Login = lazy(() => import('./panel/pages/Login.jsx'))
const Partidos = conPanel(() => import('./panel/pages/Partidos.jsx'))
const Precios = lazy(() => import('./landing/pages/Precios.jsx'))
const Postular = lazy(() => import('./landing/pages/Postular.jsx'))
const Privacidad = lazy(() => import('./landing/pages/Privacidad.jsx'))
const Reclutamiento = conPanel(() => import('./panel/pages/Reclutamiento.jsx'))
const Registro = lazy(() => import('./panel/pages/Registro.jsx'))
const Terminos = lazy(() => import('./landing/pages/Terminos.jsx'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/postular/:orgId/:formId" element={<Postular />} />
        </Route>

        <Route element={<Acceso />}>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
        </Route>

        <Route path="/checkout" element={<Checkout />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jugadores" element={<Jugadores />} />
            <Route path="/analizar" element={<Analizar />} />
            <Route path="/partidos" element={<Partidos />} />
            <Route path="/comparador" element={<Comparador />} />
            <Route path="/reclutamiento" element={<Reclutamiento />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
