const SAMPLE_STEP = 3
const CURVE_DETAIL = 6

export function createTrack(x, y) {
  const xs = [x]
  const ys = [y]
  const lengths = [0]
  let d = `M${x} ${y}`
  let cursor = { x, y }

  const push = (px, py, jump = false) => {
    const last = lengths.length - 1
    const step = jump ? 0 : Math.hypot(px - xs[last], py - ys[last])
    xs.push(px)
    ys.push(py)
    lengths.push(lengths[last] + step)
  }

  const flatten = (point, chord) => {
    const steps = Math.max(2, Math.ceil(chord / CURVE_DETAIL))
    for (let index = 1; index <= steps; index += 1) {
      const p = point(index / steps)
      push(p.x, p.y)
    }
  }

  const track = {
    get length() {
      return lengths[lengths.length - 1]
    },
    move(px, py) {
      d += ` M${px} ${py}`
      push(px, py, true)
      cursor = { x: px, y: py }
      return track
    },
    line(px, py) {
      d += ` L${px} ${py}`
      push(px, py)
      cursor = { x: px, y: py }
      return track
    },
    quad(cx, cy, px, py) {
      const from = cursor
      d += ` Q${cx} ${cy} ${px} ${py}`
      flatten(
        (t) => ({
          x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * px,
          y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * py,
        }),
        Math.hypot(cx - from.x, cy - from.y) + Math.hypot(px - cx, py - cy),
      )
      cursor = { x: px, y: py }
      return track
    },
    cubic(c1x, c1y, c2x, c2y, px, py) {
      const from = cursor
      d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${px} ${py}`
      flatten(
        (t) => {
          const u = 1 - t
          return {
            x: u ** 3 * from.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * px,
            y: u ** 3 * from.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * py,
          }
        },
        Math.hypot(c1x - from.x, c1y - from.y) +
          Math.hypot(c2x - c1x, c2y - c1y) +
          Math.hypot(px - c2x, py - c2y),
      )
      cursor = { x: px, y: py }
      return track
    },
    finish() {
      return sample(xs, ys, lengths, d)
    },
  }

  return track
}

function sample(xs, ys, lengths, d) {
  const total = lengths[lengths.length - 1]
  const count = Math.ceil(total / SAMPLE_STEP) + 1
  const sx = new Float32Array(count)
  const sy = new Float32Array(count)
  let segment = 1

  for (let index = 0; index < count; index += 1) {
    const at = Math.min(index * SAMPLE_STEP, total)
    while (segment < lengths.length - 1 && lengths[segment] < at) segment += 1
    const start = lengths[segment - 1]
    const span = lengths[segment] - start
    const mix = span > 0 ? (at - start) / span : 1
    sx[index] = xs[segment - 1] + (xs[segment] - xs[segment - 1]) * mix
    sy[index] = ys[segment - 1] + (ys[segment] - ys[segment - 1]) * mix
  }

  const pointAt = (length) => {
    const position = Math.min(Math.max(length, 0), total) / SAMPLE_STEP
    const index = Math.min(Math.floor(position), count - 2)
    const mix = position - index
    return {
      x: sx[index] + (sx[index + 1] - sx[index]) * mix,
      y: sy[index] + (sy[index + 1] - sy[index]) * mix,
    }
  }

  const lengthAtY = (targetY) => {
    let low = 0
    let high = count - 1
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (sy[middle] < targetY) low = middle
      else high = middle
    }
    const span = sy[high] - sy[low]
    const mix = span > 0 ? Math.min(Math.max((targetY - sy[low]) / span, 0), 1) : 0
    return Math.min((low + mix) * SAMPLE_STEP, total)
  }

  return { d, total, pointAt, lengthAtY }
}
