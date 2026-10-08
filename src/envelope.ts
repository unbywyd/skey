/**
 * Тот же код шифрования, что и на странице, — для CLI.
 *
 * Выполняем строку из envelope-js.ts, а не переписываем её на TypeScript:
 * так браузер и Node гарантированно шифруют одинаково.
 */

import { webcrypto } from 'node:crypto'
import { ENVELOPE_JS } from './envelope-js.js'

export interface Box {
  iv: string
  ct: string
}

export interface AnswerEnvelope extends Box {
  v: 1
  id: string
  epk: string
}

export interface Envelope {
  b64u(bytes: Uint8Array): string
  unb64u(text: string): Uint8Array
  newSecret(): string
  keypair(): Promise<{ pub: string; priv: string }>
  sha256(text: string): Promise<string>
  submitToken(secret: string): Promise<string>
  sealMeta(secret: string, meta: unknown): Promise<Box>
  openMeta<T>(secret: string, box: Box): Promise<T>
  sealAnswer(secret: string, id: string, pub: string, answer: unknown): Promise<AnswerEnvelope>
  openAnswer<T>(secret: string, priv: string, envelope: AnswerEnvelope): Promise<T>
  toBlob(envelope: AnswerEnvelope): string
  fromBlob(text: string): AnswerEnvelope
}

export const envelope: Envelope = new Function(`return ${ENVELOPE_JS}`)()(webcrypto)
