import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const config = loadEnv('production', root, 'VITE_')
let api
try { api = new URL(config.VITE_API_URL) } catch {
  throw new Error('Configure VITE_API_URL no .env.local com a API pública antes de gerar o Android.')
}
if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
  throw new Error('VITE_API_URL deve apontar para uma API pública HTTPS, sem credenciais, query ou fragmento.')
}
if (!existsSync(new URL('../android/keystore.properties', import.meta.url))) {
  throw new Error('Configure android/keystore.properties. Veja docs/android-release.md.')
}
const env = { ...process.env }
const studioJava = '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
if (!env.JAVA_HOME && existsSync(`${studioJava}/bin/java`)) env.JAVA_HOME = studioJava
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
console.log(`API do aplicativo: ${api.origin}${api.pathname}`)
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'android:sync'], root)
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['assembleRelease', 'bundleRelease'], `${root}/android`)
console.log('APK: android/app/build/outputs/apk/release/app-release.apk')
console.log('AAB: android/app/build/outputs/bundle/release/app-release.aab')
