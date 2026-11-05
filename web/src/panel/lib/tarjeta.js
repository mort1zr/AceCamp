export function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function formatearNumero(valor) {
  return soloDigitos(valor)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function formatearVencimiento(valor) {
  const digitos = soloDigitos(valor).slice(0, 4)
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos
}

export function pasaLuhn(numero) {
  const digitos = soloDigitos(numero)
  let suma = 0
  for (let i = 0; i < digitos.length; i += 1) {
    let digito = Number(digitos[digitos.length - 1 - i])
    if (i % 2 === 1) {
      digito *= 2
      if (digito > 9) digito -= 9
    }
    suma += digito
  }
  return digitos.length > 0 && suma % 10 === 0
}

export function marcaTarjeta(numero) {
  const digitos = soloDigitos(numero)
  if (/^4/.test(digitos)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digitos)) return 'mastercard'
  if (/^3[47]/.test(digitos)) return 'amex'
  return null
}

export function validarTarjeta({ nombre, numero, vencimiento, cvc }, ahora = new Date()) {
  const errores = {}
  if (String(nombre ?? '').trim().length < 2) errores.nombre = 'nombre'
  const digitos = soloDigitos(numero)
  if (digitos.length < 13 || digitos.length > 19 || !pasaLuhn(digitos)) errores.numero = 'numero'
  const [mes, anio] = String(vencimiento ?? '').split('/')
  const mesNumero = Number(mes)
  const anioNumero = 2000 + Number(anio)
  const vencida =
    !/^\d{2}$/.test(mes ?? '') ||
    !/^\d{2}$/.test(anio ?? '') ||
    mesNumero < 1 ||
    mesNumero > 12 ||
    new Date(anioNumero, mesNumero, 1) <= new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  if (vencida) errores.vencimiento = 'vencimiento'
  const largoCvc = marcaTarjeta(digitos) === 'amex' ? 4 : 3
  if (soloDigitos(cvc).length !== largoCvc) errores.cvc = 'cvc'
  return errores
}
