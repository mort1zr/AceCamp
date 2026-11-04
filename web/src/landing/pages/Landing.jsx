import CierreFinal from '../secciones/CierreFinal.jsx'
import Comparacion from '../secciones/Comparacion.jsx'
import Demo from '../secciones/Demo.jsx'
import Hero from '../secciones/Hero.jsx'
import ParaQuien from '../secciones/ParaQuien.jsx'
import Problema from '../secciones/Problema.jsx'
import QueMide from '../secciones/QueMide.jsx'
import RallyThread from '../secciones/RallyThread.jsx'

export default function Landing() {
  return (
    <div className="relative">
      <RallyThread />
      <Hero />
      <Problema />
      <QueMide />
      <Demo />
      <ParaQuien />
      <Comparacion />
      <CierreFinal />
    </div>
  )
}
