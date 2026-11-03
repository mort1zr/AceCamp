import CierreFinal from './landing/CierreFinal.jsx'
import Comparacion from './landing/Comparacion.jsx'
import Hero from './landing/Hero.jsx'
import Modulos from './landing/Modulos.jsx'
import ParaQuien from './landing/ParaQuien.jsx'
import Problema from './landing/Problema.jsx'
import QueMide from './landing/QueMide.jsx'
import RallyThread from './landing/RallyThread.jsx'

export default function Landing() {
  return (
    <div className="relative">
      <RallyThread />
      <Hero />
      <Problema />
      <QueMide />
      <Modulos />
      <ParaQuien />
      <Comparacion />
      <CierreFinal />
    </div>
  )
}
