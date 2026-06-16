import { SAMPLE_INTERVAL_MS, VELOCITY_SPEED_TIERS } from './constants'
import type { DragDirection, MotionSample, MotionSpeed } from './types'

export function getDirectionFromVelocity(velocity: number): DragDirection {
  if (velocity === 0) {
    return 'neutral'
  }
  return velocity > 0 ? 'right' : 'left'
}

export function directionLabel(direction: DragDirection): string {
  switch (direction) {
    case 'left':
      return '←'
    case 'right':
      return '→'
    case 'neutral':
      return '-'
  }
}

export function updateMotionSample(
  sample: MotionSample | null,
  x: number,
  t: number,
): {
  sample: MotionSample
  velocity: number | null
} {
  if (!sample) {
    return { sample: { x, t }, velocity: null }
  }

  const dt = t - sample.t
  if (dt < SAMPLE_INTERVAL_MS) {
    return { sample, velocity: null }
  }

  const velocity = (x - sample.x) / (dt / 1000)
  return { sample: { x, t }, velocity }
}

export function getVelocitySpeed(velocity: number): MotionSpeed {
  const absVelocity = Math.abs(velocity)
  for (const tier of VELOCITY_SPEED_TIERS) {
    if (absVelocity >= tier.minAbs && absVelocity < tier.maxAbs) {
      return tier.speed
    }
  }
  return 'fast'
}

export function formatVelocityValue(velocity: number): string {
  return `${velocity.toFixed(2)} px/s`
}
