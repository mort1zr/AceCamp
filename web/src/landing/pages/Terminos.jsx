import { useTextos } from '../../compartido/lib/idioma.jsx'
import PaginaLegal from '../components/PaginaLegal.jsx'
import { correo } from '../lib/pie.js'

const textos = {
  es: {
    titulo: 'Términos de uso',
    borrador: 'Borrador en revisión',
    actualizado: 'Última actualización: 5 de noviembre de 2026',
    intro:
      'Estas son las reglas para usar AceCam. Al crear una cuenta o usar el servicio, aceptas estos términos y la Política de privacidad.',
    indice: 'En esta página',
    secciones: [
      {
        id: 'servicio',
        titulo: 'El servicio',
        contenido: [
          'AceCam analiza videos de partidos de tenis y entrega estadísticas por jugador: saques, golpes, movimiento y más. Funciona con un archivo de video o un enlace de YouTube, sin cámaras ni equipos especiales.',
        ],
      },
      {
        id: 'cuenta',
        titulo: 'Tu cuenta',
        contenido: [
          [
            'Debes dar datos reales al registrarte y mantenerlos al día.',
            'Eres responsable de lo que pase con tu cuenta. No compartas tu contraseña.',
            'Quien crea la organización es su entrenador principal y decide quién más entra al equipo.',
          ],
        ],
      },
      {
        id: 'videos',
        titulo: 'Tus videos y datos',
        contenido: [
          'Los videos y los datos que subes siguen siendo tuyos o de tu organización. Nos das permiso solo para guardarlos y procesarlos con el fin de darte el servicio.',
          'Solo puedes subir videos que tengas derecho a usar y de personas que hayan dado su consentimiento. Si el jugador es menor de edad, necesitas el consentimiento de su padre, madre o tutor.',
        ],
      },
      {
        id: 'uso',
        titulo: 'Uso permitido',
        contenido: [
          'No puedes usar AceCam para:',
          [
            'Subir contenido ilegal, ofensivo o de terceros sin permiso.',
            'Intentar entrar a datos de otras organizaciones.',
            'Copiar, revender o desarmar el servicio.',
            'Sobrecargar la plataforma de forma intencional.',
          ],
          'Si no se cumplen estas reglas, podemos suspender la cuenta.',
        ],
      },
      {
        id: 'estadisticas',
        titulo: 'Sobre las estadísticas',
        contenido: [
          'Las estadísticas se calculan con inteligencia artificial a partir del video. Las velocidades son estimaciones, no mediciones de radar. La precisión depende de la calidad del video, el ángulo de la cámara y la luz.',
          'Úsalas como apoyo para entrenar y evaluar, no como la única base para decisiones importantes.',
        ],
      },
      {
        id: 'planes',
        titulo: 'Planes y pagos',
        contenido: [
          'El plan Básico incluye un mes de prueba gratis. Los precios, los límites de análisis y el periodo de cobro de cada plan se muestran en la página de precios antes de contratar.',
          'Puedes cambiar de plan desde Configuración.',
        ],
      },
      {
        id: 'responsabilidad',
        titulo: 'Responsabilidad',
        contenido: [
          'Trabajamos para que AceCam esté disponible y funcione bien, pero puede haber interrupciones o errores. No respondemos por decisiones tomadas solo a partir de las estadísticas ni por daños indirectos derivados del uso del servicio.',
        ],
      },
      {
        id: 'cambios',
        titulo: 'Cambios y ley aplicable',
        contenido: [
          'Si cambiamos estos términos, publicaremos la nueva versión aquí con su fecha y te avisaremos por correo. Estos términos se rigen por las leyes del Perú.',
          `Para cualquier consulta, escríbenos a ${correo}.`,
        ],
      },
    ],
    otra: { texto: 'Lee también la', enlace: 'Política de privacidad', to: '/privacidad' },
  },
  en: {
    titulo: 'Terms of use',
    borrador: 'Draft under review',
    actualizado: 'Last updated: November 5, 2026',
    intro:
      'These are the rules for using AceCam. By creating an account or using the service, you accept these terms and the Privacy policy.',
    indice: 'On this page',
    secciones: [
      {
        id: 'servicio',
        titulo: 'The service',
        contenido: [
          'AceCam analyzes tennis match videos and delivers statistics per player: serves, shots, movement and more. It works with a video file or a YouTube link, with no special cameras or hardware.',
        ],
      },
      {
        id: 'cuenta',
        titulo: 'Your account',
        contenido: [
          [
            'You must give real details when you sign up and keep them up to date.',
            'You are responsible for what happens with your account. Do not share your password.',
            'Whoever creates the organization is its head coach and decides who else joins the team.',
          ],
        ],
      },
      {
        id: 'videos',
        titulo: 'Your videos and data',
        contenido: [
          'The videos and data you upload remain yours or your organization’s. You only give us permission to store and process them to provide the service.',
          'You may only upload videos you have the right to use, of people who have given their consent. If the player is a minor, you need consent from their parent or guardian.',
        ],
      },
      {
        id: 'uso',
        titulo: 'Acceptable use',
        contenido: [
          'You may not use AceCam to:',
          [
            'Upload illegal or offensive content, or third-party content without permission.',
            'Try to access other organizations’ data.',
            'Copy, resell or reverse engineer the service.',
            'Intentionally overload the platform.',
          ],
          'If these rules are broken, we may suspend the account.',
        ],
      },
      {
        id: 'estadisticas',
        titulo: 'About the statistics',
        contenido: [
          'Statistics are calculated with artificial intelligence from the video. Speeds are estimates, not radar measurements. Accuracy depends on video quality, camera angle and lighting.',
          'Use them to support training and evaluation, not as the only basis for important decisions.',
        ],
      },
      {
        id: 'planes',
        titulo: 'Plans and payments',
        contenido: [
          'The Basic plan includes a free first month. Each plan’s price, analysis limits and billing period are shown on the pricing page before you subscribe.',
          'You can change plans from Settings.',
        ],
      },
      {
        id: 'responsabilidad',
        titulo: 'Liability',
        contenido: [
          'We work to keep AceCam available and working well, but there may be interruptions or errors. We are not liable for decisions based solely on the statistics or for indirect damages arising from use of the service.',
        ],
      },
      {
        id: 'cambios',
        titulo: 'Changes and governing law',
        contenido: [
          'If we change these terms, we will publish the new version here with its date and email you. These terms are governed by the laws of Peru.',
          `For any question, write to ${correo}.`,
        ],
      },
    ],
    otra: { texto: 'Also read the', enlace: 'Privacy policy', to: '/privacidad' },
  },
}

export default function Terminos() {
  return <PaginaLegal t={useTextos(textos)} />
}
