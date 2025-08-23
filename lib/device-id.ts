export function getDeviceId(): string {
  if (typeof window === "undefined") {
    // Server-side fallback
    return "server-fallback"
  }

  const DEVICE_ID_KEY = "retrospective-device-id"

  // Try to get existing device ID from localStorage
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    // Generate new UUID for this device
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}
