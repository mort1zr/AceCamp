import CierreFinal from './landing/CierreFinal.jsx'
import Comparacion from './landing/Comparacion.jsx'
import Demo from './landing/Demo.jsx'
import Hero from './landing/Hero.jsx'
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
      <Demo />
      <ParaQuien />
      <Comparacion />
      <CierreFinal />
    </div>
  )
}
