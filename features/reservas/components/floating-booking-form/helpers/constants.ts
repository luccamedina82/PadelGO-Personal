export const BLOCK_REASON_PRESETS = [
  'Entrenamiento',
  'Torneo',
  'Evento',
  'Mantenimiento',
] as const

export type BlockReasonPreset = (typeof BLOCK_REASON_PRESETS)[number]
