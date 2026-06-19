import type { FrameCaptureResult } from '../../frameflow'

export type FrameCaptureRegistration = {
  canExtract: () => boolean
  capture: () => Promise<FrameCaptureResult | null>
}
