/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

// Augment Window interface to include google namespace
declare global {
  interface Window {
    google: typeof google
    deviceMapViewDetails: (deviceId: string) => void
  }
}
