import { Route, Routes } from 'react-router'
import { useMemo } from 'react'
import AppLayout from './panel/components/AppLayout.jsx'
import PublicLayout from './landing/components/PublicLayout.jsx'
import RequireAuth from './panel/components/RequireAuth.jsx'
import { useAuth } from './panel/context/AuthContext.js'
import { auth, db, storage } from './panel/lib/firebase.js'
import { createHttpVideoImporter } from './panel/lib/services/httpVideoImportService.js'
import { createVideoUploadService, MAX_VIDEO_BYTES } from './panel/lib/videoUpload.js'
import Acceso from './panel/pages/Acceso.jsx'
import Analizar from './panel/pages/Analizar.jsx'
import Comparador from './panel/pages/Comparador.jsx'
import Configuracion from './panel/pages/Configuracion.jsx'
import Dashboard from './panel/pages/Dashboard.jsx'
import Inicio from './panel/pages/Inicio.jsx'
import Jugadores from './panel/pages/Jugadores.jsx'
import Landing from './landing/pages/Landing.jsx'
import Login from './panel/pages/Login.jsx'
import NotFound from './compartido/pages/NotFound.jsx'
import Partidos from './panel/pages/Partidos.jsx'
import Precios from './landing/pages/Precios.jsx'
import Privacidad from './landing/pages/Privacidad.jsx'
import Reclutamiento from './panel/pages/Reclutamiento.jsx'
import Registro from './panel/pages/Registro.jsx'
import Terminos from './landing/pages/Terminos.jsx'

const { uploadVideo } = createVideoUploadService({ storage })

export default function App() {
  const { user, profile } = useAuth()
  const session = user && profile ? { uid: user.uid, orgId: profile.orgId, role: profile.role } : undefined
  const importVideo = useMemo(() => createHttpVideoImporter({
    enabled: import.meta.env.DEV && import.meta.env.MODE === 'demo' && Boolean(user && profile),
    supportsYouTube: true,
    endpoint: '/api/video-import',
    getSession: async () => ({ orgId: profile.orgId, actorId: user.uid, token: await user.getIdToken() }),
  }), [user, profile])

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/privacidad" element={<Privacidad />} />
      </Route>

      <Route element={<Acceso />}>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/dashboard" element={<Dashboard db={db} session={session} />} />
          <Route path="/jugadores" element={<Jugadores db={db} session={session} />} />
          <Route path="/analizar" element={<Analizar db={db} session={session} uploadVideo={uploadVideo} importVideo={importVideo} maxBytes={MAX_VIDEO_BYTES} />} />
          <Route path="/partidos" element={<Partidos db={db} storage={storage} session={session} />} />
          <Route path="/comparador" element={<Comparador db={db} session={session} />} />
          <Route path="/reclutamiento" element={<Reclutamiento />} />
          <Route path="/configuracion" element={<Configuracion db={db} auth={auth} session={session} />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
