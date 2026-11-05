import { useTextos } from '../../compartido/lib/idioma.jsx'
import PaginaLegal from '../components/PaginaLegal.jsx'
import { correo } from '../lib/pie.js'

const textos = {
  es: {
    titulo: 'Política de privacidad',
    borrador: 'Borrador en revisión',
    actualizado: 'Última actualización: 5 de noviembre de 2026',
    intro:
      'Aquí explicamos qué datos guarda AceCam, para qué los usamos, cuánto tiempo los conservamos y cómo puedes pedir que se corrijan o se borren. Seguimos la Ley N.° 29733, Ley de Protección de Datos Personales del Perú, y su reglamento.',
    indice: 'En esta página',
    secciones: [
      {
        id: 'responsable',
        titulo: 'Quién es responsable',
        contenido: [
          `AceCam es el responsable del tratamiento de los datos que se registran en la plataforma. Puedes escribirnos a ${correo} para cualquier consulta sobre tus datos.`,
        ],
      },
      {
        id: 'datos',
        titulo: 'Qué datos guardamos',
        contenido: [
          [
            'Datos de la cuenta: nombre, correo, cargo y organización de quien se registra.',
            'Datos de los jugadores: nombre, fecha de nacimiento, mano hábil, nivel (UTR) y notas del entrenador.',
            'Videos de partidos que subes o enlazas desde YouTube.',
            'Estadísticas que AceCam calcula a partir de esos videos.',
            'Datos del apoderado (nombre, teléfono y correo) cuando el jugador es menor de 18 años.',
            'Postulaciones que envían los jugadores, con sus datos y su video.',
          ],
          'No guardamos los datos completos de tu tarjeta. El pago lo procesa el proveedor de pagos.',
        ],
      },
      {
        id: 'finalidad',
        titulo: 'Para qué los usamos',
        contenido: [
          [
            'Analizar los videos y mostrar las estadísticas de cada jugador.',
            'Administrar tu cuenta, tu organización y tu plan.',
            'Avisarte sobre el estado de tus análisis y cambios importantes del servicio.',
          ],
          'No vendemos tus datos ni los usamos para publicidad.',
        ],
      },
      {
        id: 'menores',
        titulo: 'Jugadores menores de edad',
        contenido: [
          'Muchos jugadores son menores. Si el jugador tiene menos de 18 años, guardamos los datos de su apoderado. Para los menores de 14 años, la ley exige el consentimiento de su padre, madre o tutor; al registrar al jugador, el entrenador declara que cuenta con esa autorización.',
          'Los datos de contacto del apoderado solo los ven las personas autorizadas de la organización. El apoderado puede pedir en cualquier momento que se borren los datos y los videos del menor.',
        ],
      },
      {
        id: 'conservacion',
        titulo: 'Cuánto tiempo los conservamos',
        contenido: [
          'Guardamos los datos mientras la cuenta de la organización esté activa. Si la organización cierra su cuenta o pide la eliminación, borramos sus datos y videos en un plazo máximo de 30 días, salvo lo que la ley nos obligue a conservar.',
        ],
      },
      {
        id: 'terceros',
        titulo: 'Con quién los compartimos',
        contenido: [
          'Usamos servicios de Google (Firebase) para guardar la información y los videos. Sus servidores pueden estar fuera del Perú, por lo que hay una transferencia internacional de datos con garantías de seguridad adecuadas.',
          'Si analizas un video de YouTube, AceCam lo procesa según los términos de YouTube. Fuera de estos casos, solo compartimos datos cuando una autoridad lo exige por ley.',
        ],
      },
      {
        id: 'derechos',
        titulo: 'Tus derechos',
        contenido: [
          'Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (derechos ARCO).',
          [
            'Acceso: saber qué datos tuyos tenemos.',
            'Rectificación: corregir datos incorrectos.',
            'Cancelación: pedir que se borren.',
            'Oposición: pedir que dejemos de usarlos para un fin concreto.',
          ],
          `Escríbenos a ${correo} desde el correo de tu cuenta. Responderemos dentro de los plazos de la ley. Si no estás conforme, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.`,
        ],
      },
      {
        id: 'seguridad',
        titulo: 'Seguridad',
        contenido: [
          'Cada organización solo puede ver sus propios jugadores, partidos y videos. El acceso se controla por cuenta y por rol, y la información viaja cifrada.',
        ],
      },
      {
        id: 'cambios',
        titulo: 'Cambios en esta política',
        contenido: [
          'Si cambiamos algo importante, lo publicaremos aquí con su fecha y te avisaremos por correo antes de que entre en vigencia.',
        ],
      },
    ],
    otra: { texto: 'Lee también los', enlace: 'Términos de uso', to: '/terminos' },
  },
  en: {
    titulo: 'Privacy policy',
    borrador: 'Draft under review',
    actualizado: 'Last updated: November 5, 2026',
    intro:
      'This page explains what data AceCam stores, what we use it for, how long we keep it and how you can ask us to correct or delete it. We follow Peru’s Personal Data Protection Law No. 29733 and its regulations.',
    indice: 'On this page',
    secciones: [
      {
        id: 'responsable',
        titulo: 'Who is responsible',
        contenido: [
          `AceCam is responsible for the data stored on the platform. Write to ${correo} with any question about your data.`,
        ],
      },
      {
        id: 'datos',
        titulo: 'What data we store',
        contenido: [
          [
            'Account data: name, email, role and organization of the person who signs up.',
            'Player data: name, date of birth, dominant hand, level (UTR) and coach notes.',
            'Match videos you upload or link from YouTube.',
            'Statistics AceCam calculates from those videos.',
            'Guardian details (name, phone and email) when the player is under 18.',
            'Applications sent by players, with their details and video.',
          ],
          'We do not store your full card details. Payments are handled by the payment provider.',
        ],
      },
      {
        id: 'finalidad',
        titulo: 'What we use it for',
        contenido: [
          [
            'Analyzing videos and showing each player’s statistics.',
            'Managing your account, your organization and your plan.',
            'Letting you know about your analyses and important changes to the service.',
          ],
          'We do not sell your data or use it for advertising.',
        ],
      },
      {
        id: 'menores',
        titulo: 'Players who are minors',
        contenido: [
          'Many players are minors. If a player is under 18, we store their guardian’s details. For players under 14, the law requires consent from their parent or guardian; when registering the player, the coach declares they have that authorization.',
          'Guardian contact details are only visible to authorized members of the organization. The guardian can ask at any time for the minor’s data and videos to be deleted.',
        ],
      },
      {
        id: 'conservacion',
        titulo: 'How long we keep it',
        contenido: [
          'We keep data while the organization’s account is active. If the organization closes its account or asks for deletion, we delete its data and videos within 30 days, except what the law requires us to keep.',
        ],
      },
      {
        id: 'terceros',
        titulo: 'Who we share it with',
        contenido: [
          'We use Google services (Firebase) to store information and videos. Their servers may be outside Peru, so data is transferred internationally with adequate security safeguards.',
          'If you analyze a YouTube video, AceCam processes it under YouTube’s terms. Beyond this, we only share data when an authority requires it by law.',
        ],
      },
      {
        id: 'derechos',
        titulo: 'Your rights',
        contenido: [
          'You can exercise your rights of access, rectification, cancellation and objection (ARCO rights).',
          [
            'Access: know what data we hold about you.',
            'Rectification: correct inaccurate data.',
            'Cancellation: ask for it to be deleted.',
            'Objection: ask us to stop using it for a specific purpose.',
          ],
          `Write to ${correo} from your account email. We will reply within the legal deadlines. If you are not satisfied, you can contact Peru’s National Authority for Personal Data Protection.`,
        ],
      },
      {
        id: 'seguridad',
        titulo: 'Security',
        contenido: [
          'Each organization can only see its own players, matches and videos. Access is controlled by account and role, and data travels encrypted.',
        ],
      },
      {
        id: 'cambios',
        titulo: 'Changes to this policy',
        contenido: [
          'If we change anything important, we will publish it here with its date and email you before it takes effect.',
        ],
      },
    ],
    otra: { texto: 'Also read the', enlace: 'Terms of use', to: '/terminos' },
  },
}

export default function Privacidad() {
  return <PaginaLegal t={useTextos(textos)} />
}
