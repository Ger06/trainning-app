import { randomUUID } from 'node:crypto'
import type { Clock, IdGenerator } from '@/domain/auth/ports'

/** Adaptadores triviales de los puertos de tiempo e identidad (constitución P4). */

export const systemClock: Clock = {
  now: () => new Date(),
}

export const uuidIdGenerator: IdGenerator = {
  newId: () => randomUUID(),
}
