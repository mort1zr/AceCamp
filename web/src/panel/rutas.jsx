import { useCallback, useMemo } from 'react'
import { useAuth } from './context/AuthContext.js'
import { contratarPlan } from './lib/contratarPlan.js'
import { auth, db, storage } from './lib/firebase.js'
import { createHttpVideoImporter } from './lib/services/httpVideoImportService.js'
import { createAzureVideoClient, createAzureVideoUploadService } from './lib/azureVideos.js'
import { createVideoUploadService, MAX_VIDEO_BYTES } from './lib/videoUpload.js'

// PCIT-225: con VITE_VIDEO_API_URL los videos se guardan en Azure Blob (PCIT-222);
// sin ella, en Firebase Storage (emuladores y desarrollo local).
const videoApiUrl = import.meta.env.VITE_VIDEO_API_URL
const videoApi = videoApiUrl
  ? createAzureVideoClient({ apiUrl: videoApiUrl, getToken: () => auth.currentUser?.getIdToken() })
  : null
const { uploadVideo } = videoApi ? createAzureVideoUploadService({ client: videoApi }) : createVideoUploadService({ storage })

function usePropsPanel() {
  const { user, profile } = useAuth()
  const session =
    user && profile ? { uid: user.uid, orgId: profile.orgId, role: profile.role } : undefined
  const importVideo = useMemo(
    () =>
      createHttpVideoImporter({
        enabled: import.meta.env.DEV && import.meta.env.MODE === 'demo' && Boolean(user && profile),
        supportsYouTube: true,
        endpoint: '/api/video-import',
        getSession: async () => ({
          orgId: profile.orgId,
          actorId: user.uid,
          token: await user.getIdToken(),
        }),
      }),
    [user, profile],
  )
  const orgId = profile?.orgId
  const contratar = useCallback(
    ({ plan, periodo }) => contratarPlan({ db, orgId, plan, periodo }),
    [orgId],
  )
  return {
    db,
    storage,
    auth,
    session,
    videoApi,
    uploadVideo,
    importVideo,
    maxBytes: MAX_VIDEO_BYTES,
    contratar,
  }
}

export function conectar(Pagina) {
  return function Ruta() {
    return <Pagina {...usePropsPanel()} />
  }
}
