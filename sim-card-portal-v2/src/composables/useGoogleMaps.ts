import { ref, onUnmounted } from 'vue'

export interface GoogleMapsConfig {
  apiKey: string
  version?: string
  libraries?: string[]
}

// Track if Google Maps script has been loaded
let isScriptLoading = false
let isScriptLoaded = false
let scriptLoadPromise: Promise<void> | null = null

/**
 * Load Google Maps JavaScript API by injecting a script tag with the API key
 * This is more reliable than @googlemaps/js-api-loader which has issues with API key recognition
 */
function loadGoogleMapsScript(apiKey: string, libraries: string[] = ['maps', 'marker'], version: string = 'weekly'): Promise<void> {
  // If already loaded, return immediately
  if (isScriptLoaded && window.google?.maps) {
    console.log('✅ Google Maps already loaded')
    return Promise.resolve()
  }

  // If currently loading, return existing promise
  if (isScriptLoading && scriptLoadPromise) {
    console.log('⏳ Google Maps loading in progress...')
    return scriptLoadPromise
  }

  console.log('🔄 Loading Google Maps script with API key:', {
    keyPreview: apiKey.substring(0, 20) + '...',
    libraries,
    version
  })

  isScriptLoading = true

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      console.warn('⚠️ Found existing Google Maps script tag - removing it')
      existingScript.remove()
    }

    // Create script element
    const script = document.createElement('script')
    const librariesParam = libraries.join(',')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${librariesParam}&v=${version}`
    script.async = true
    script.defer = true

    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully')
      isScriptLoaded = true
      isScriptLoading = false
      resolve()
    }

    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps script:', error)
      isScriptLoading = false
      reject(new Error('Failed to load Google Maps script'))
    }

    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

export function useGoogleMaps(config: GoogleMapsConfig) {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Detect if a Google Maps script was already injected (potential rogue script tag)
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    console.warn('Google Maps appears to be already present on window. If you see NoApiKeys warnings, check for legacy <script src=...maps.googleapis.com/maps/api/js> tags or duplicate loaders.')
  }

  // Debug: Log composable initialization
  console.log('🔧 useGoogleMaps initialized:', {
    apiKeyProvided: !!config.apiKey,
    apiKeyLength: config.apiKey?.length || 0,
    apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 15)}...` : 'EMPTY',
    libraries: config.libraries,
    version: config.version || 'weekly'
  })

  // Validate API key
  if (!config.apiKey || config.apiKey.trim() === '') {
    error.value = 'Google Maps API key is required. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file'
    console.error('❌ Google Maps API key missing:', {
      apiKey: config.apiKey,
      envCheck: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    })
    return {
      isLoaded,
      isLoading,
      error,
      loadGoogleMaps: async () => null,
      initMap: async () => null
    }
  }

  const loadGoogleMaps = async () => {
    if (isLoaded.value || isLoading.value) {
      return window.google
    }

    isLoading.value = true
    error.value = null

    try {
      const libraries = config.libraries || ['maps', 'marker']
      const version = config.version || 'weekly'

      // Load Google Maps script with API key in URL
      await loadGoogleMapsScript(config.apiKey, libraries, version)

      isLoaded.value = true
      return window.google
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Google Maps'
      error.value = errorMessage
      console.error('❌ Error loading Google Maps:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const initMap = async (
    element: HTMLElement,
    options: google.maps.MapOptions
  ): Promise<google.maps.Map | null> => {
    const loadedGoogle = await loadGoogleMaps()

    if (!loadedGoogle || !loadedGoogle.maps) {
      return null
    }

    try {
      // Google Maps is loaded via script tag, use it directly
      const map = new loadedGoogle.maps.Map(element, options)
      return map
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize map'
      error.value = errorMessage
      console.error('Error initializing map:', err)
      return null
    }
  }

  onUnmounted(() => {
    // Cleanup if needed
  })

  return {
    isLoaded,
    isLoading,
    error,
    loadGoogleMaps,
    initMap
  }
}
