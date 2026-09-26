import { Capacitor, registerPlugin } from '@capacitor/core'

interface AppSettingsPlugin {
  openSettings(): Promise<void>
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings')

/**
 * Abre a tela de permissões/configurações do aplicativo no celular Android.
 * Retorna true se abriu com sucesso ou false caso não seja uma plataforma nativa.
 */
export async function openDeviceSettings(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AppSettings.openSettings()
      return true
    } catch (err) {
      console.warn('Falha ao abrir configurações nativas:', err)
      return false
    }
  }
  return false
}
