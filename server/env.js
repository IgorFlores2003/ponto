import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
const path = fileURLToPath(new URL('../.env', import.meta.url))
if (!process.env.VERCEL && existsSync(path)) loadEnvFile(path)
