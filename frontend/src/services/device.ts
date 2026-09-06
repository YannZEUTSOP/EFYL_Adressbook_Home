import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

export type Fingerprint = { hash: string; label: string };

let cached: Fingerprint | null = null;

/** Hardware-level installation id. Deliberately NOT read from AsyncStorage:
 *  the fingerprint must survive a storage wipe, that is its whole purpose. */
async function installationId(): Promise<string> {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId() || '';
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) || '';
  } catch {
    // permission-less APIs, but never let this break the login screen
  }
  if (typeof navigator !== 'undefined' && typeof window !== 'undefined') {
    // Web preview: browser signature (stable enough to recognise a returning
    // browser, and it survives a localStorage clear).
    return [
      navigator.userAgent,
      navigator.language,
      window.screen?.width ?? 0,
      window.screen?.height ?? 0,
      new Date().getTimezoneOffset(),
      (navigator as any).hardwareConcurrency ?? 0,
    ].join('|');
  }
  return '';
}

export async function getDeviceFingerprint(): Promise<Fingerprint> {
  if (cached) return cached;
  const raw = [
    await installationId(),
    Device.modelName || '',
    Device.brand || '',
    Device.osName || Platform.OS,
  ].join('|');
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `efyl-device|${raw}`
  );
  const label =
    Platform.OS === 'web'
      ? 'Navigateur web'
      : `${Device.brand || ''} ${Device.modelName || Platform.OS} · ${Device.osName || ''} ${Device.osVersion || ''}`
          .replace(/\s+/g, ' ')
          .trim();
  cached = { hash, label };
  return cached;
}
