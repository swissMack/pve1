/**
 * Seed script to insert 3 months of asset tracker location history
 *
 * Usage:
 *   npx ts-node scripts/seed-asset-tracker-history.ts
 *
 * Required environment variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *
 * Or set API_BASE_URL to use the deployed API endpoint:
 *   API_BASE_URL=https://your-app.vercel.app npx ts-node scripts/seed-asset-tracker-history.ts
 */

import { createClient } from '@supabase/supabase-js'

interface LocationRecord {
  device_id: string
  latitude: number
  longitude: number
  altitude: number
  accuracy: number
  speed: number
  heading: number
  recorded_at: string
  location_source: string
  battery_level: number
  signal_strength: number
}

// Swiss cities coordinates for realistic routes
const SWISS_LOCATIONS = {
  zurich: { lat: 47.3769, lng: 8.5417, alt: 408 },
  basel: { lat: 47.5596, lng: 7.5886, alt: 260 },
  bern: { lat: 46.9480, lng: 7.4474, alt: 542 },
  geneva: { lat: 46.2044, lng: 6.1432, alt: 375 },
  lausanne: { lat: 46.5197, lng: 6.6323, alt: 495 },
  stGallen: { lat: 47.4245, lng: 9.3767, alt: 675 },
  winterthur: { lat: 47.5000, lng: 8.7500, alt: 439 },
  lucerne: { lat: 47.0502, lng: 8.3093, alt: 436 },
  schaffhausen: { lat: 47.6967, lng: 8.6350, alt: 400 },
  zug: { lat: 47.1663, lng: 8.5156, alt: 425 },
}

// Generate intermediate points between two locations
function interpolatePoints(
  start: { lat: number; lng: number; alt: number },
  end: { lat: number; lng: number; alt: number },
  numPoints: number
): { lat: number; lng: number; alt: number }[] {
  const points: { lat: number; lng: number; alt: number }[] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    // Add slight random variation for realism
    const jitter = () => (Math.random() - 0.5) * 0.005
    points.push({
      lat: start.lat + (end.lat - start.lat) * t + jitter(),
      lng: start.lng + (end.lng - start.lng) * t + jitter(),
      alt: Math.round(start.alt + (end.alt - start.alt) * t + (Math.random() - 0.5) * 20),
    })
  }
  return points
}

// Calculate heading between two points
function calculateHeading(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLng = to.lng - from.lng
  const y = Math.sin(dLng * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180)
  const x = Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
    Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLng * Math.PI / 180)
  const heading = Math.atan2(y, x) * 180 / Math.PI
  return (heading + 360) % 360
}

// Generate route data for DEV003 (Vehicle Tracker Gamma) - Fleet delivery vehicle
function generateDEV003Data(startDate: Date): LocationRecord[] {
  const records: LocationRecord[] = []

  // Weekly delivery route: Basel -> Zurich -> St. Gallen -> Winterthur -> Basel
  const weeklyRoute = [
    SWISS_LOCATIONS.basel,
    SWISS_LOCATIONS.zurich,
    SWISS_LOCATIONS.stGallen,
    SWISS_LOCATIONS.winterthur,
    SWISS_LOCATIONS.schaffhausen,
    SWISS_LOCATIONS.basel,
  ]

  // Extended route every 2 weeks: Basel -> Bern -> Geneva -> Lausanne -> Lucerne -> Basel
  const extendedRoute = [
    SWISS_LOCATIONS.basel,
    SWISS_LOCATIONS.bern,
    SWISS_LOCATIONS.geneva,
    SWISS_LOCATIONS.lausanne,
    SWISS_LOCATIONS.lucerne,
    SWISS_LOCATIONS.basel,
  ]

  let currentDate = new Date(startDate)
  let battery = 100
  let weekCount = 0

  // Generate 3 months of data (~12 weeks)
  while (weekCount < 12) {
    const isExtendedWeek = weekCount % 2 === 1
    const route = isExtendedWeek ? extendedRoute : weeklyRoute

    // Each route takes about 2-3 days with stops
    for (let dayOffset = 0; dayOffset < route.length - 1; dayOffset++) {
      const from = route[dayOffset]
      const to = route[dayOffset + 1]

      // Generate points for this leg
      const numPoints = Math.floor(Math.random() * 3) + 4 // 4-6 points per leg
      const points = interpolatePoints(from, to, numPoints)

      // Morning departure (6-9 AM)
      const departureHour = 6 + Math.floor(Math.random() * 3)
      currentDate.setHours(departureHour, Math.floor(Math.random() * 60), 0, 0)

      for (let i = 0; i < points.length; i++) {
        const point = points[i]
        const isMoving = i > 0 && i < points.length - 1
        const speed = isMoving ? 60 + Math.floor(Math.random() * 50) : 0

        let heading = 0
        if (i < points.length - 1) {
          heading = Math.round(calculateHeading(point, points[i + 1]))
        }

        // Battery drains ~2-5% per leg
        if (i === 0) {
          battery = Math.max(20, battery - Math.floor(Math.random() * 4) - 2)
        }
        // Recharge overnight at depot
        if (dayOffset === 0 && i === 0 && currentDate.getHours() < 10) {
          battery = Math.min(100, battery + 30 + Math.floor(Math.random() * 20))
        }

        records.push({
          device_id: 'DEV003',
          latitude: Math.round(point.lat * 10000) / 10000,
          longitude: Math.round(point.lng * 10000) / 10000,
          altitude: point.alt,
          accuracy: 5 + Math.floor(Math.random() * 10),
          speed,
          heading,
          recorded_at: currentDate.toISOString(),
          location_source: 'gps',
          battery_level: battery,
          signal_strength: 70 + Math.floor(Math.random() * 25),
        })

        // Time between points: 20-45 minutes for moving, 1-3 hours for stops
        const minutesElapsed = isMoving
          ? 20 + Math.floor(Math.random() * 25)
          : 60 + Math.floor(Math.random() * 120)
        currentDate = new Date(currentDate.getTime() + minutesElapsed * 60 * 1000)
      }

      // Add a stop/rest period at destination
      currentDate = new Date(currentDate.getTime() + (4 + Math.floor(Math.random() * 8)) * 60 * 60 * 1000)
    }

    // Weekend rest (2 days at depot)
    currentDate = new Date(currentDate.getTime() + 2 * 24 * 60 * 60 * 1000)
    weekCount++
  }

  return records
}

// Generate route data for DEV007 (Asset Tracker Eta) - Equipment moving between warehouses
function generateDEV007Data(startDate: Date): LocationRecord[] {
  const records: LocationRecord[] = []

  // Warehouse locations
  const warehouses = [
    SWISS_LOCATIONS.stGallen,
    SWISS_LOCATIONS.zurich,
    SWISS_LOCATIONS.winterthur,
    SWISS_LOCATIONS.zug,
  ]

  let currentDate = new Date(startDate)
  let battery = 95
  let currentWarehouseIndex = 0

  // Asset trackers move less frequently - maybe once a week
  for (let week = 0; week < 12; week++) {
    // Asset stays at current warehouse for most of the week
    // Generate stationary pings every 4-6 hours
    const daysAtWarehouse = 5 + Math.floor(Math.random() * 2) // 5-6 days stationary

    for (let day = 0; day < daysAtWarehouse; day++) {
      // 3-4 location pings per day
      const pingsPerDay = 3 + Math.floor(Math.random() * 2)

      for (let ping = 0; ping < pingsPerDay; ping++) {
        const warehouse = warehouses[currentWarehouseIndex]

        // Small jitter for warehouse location (equipment moving within warehouse)
        const jitter = () => (Math.random() - 0.5) * 0.001

        // Battery drains slowly for asset trackers (~1-2% per day)
        battery = Math.max(10, battery - (0.3 + Math.random() * 0.5))

        records.push({
          device_id: 'DEV007',
          latitude: Math.round((warehouse.lat + jitter()) * 10000) / 10000,
          longitude: Math.round((warehouse.lng + jitter()) * 10000) / 10000,
          altitude: warehouse.alt + Math.floor(Math.random() * 5),
          accuracy: 3 + Math.floor(Math.random() * 5),
          speed: 0,
          heading: Math.floor(Math.random() * 360),
          recorded_at: currentDate.toISOString(),
          location_source: 'gps',
          battery_level: Math.round(battery),
          signal_strength: 75 + Math.floor(Math.random() * 20),
        })

        // Next ping in 4-8 hours
        currentDate = new Date(currentDate.getTime() + (4 + Math.random() * 4) * 60 * 60 * 1000)
      }
    }

    // Transfer day - move to next warehouse
    const nextWarehouseIndex = (currentWarehouseIndex + 1) % warehouses.length
    const from = warehouses[currentWarehouseIndex]
    const to = warehouses[nextWarehouseIndex]

    // Generate transit points
    const transitPoints = interpolatePoints(from, to, 3 + Math.floor(Math.random() * 3))

    for (let i = 0; i < transitPoints.length; i++) {
      const point = transitPoints[i]
      const isMoving = i > 0 && i < transitPoints.length - 1

      let heading = 0
      if (i < transitPoints.length - 1) {
        heading = Math.round(calculateHeading(point, transitPoints[i + 1]))
      }

      records.push({
        device_id: 'DEV007',
        latitude: Math.round(point.lat * 10000) / 10000,
        longitude: Math.round(point.lng * 10000) / 10000,
        altitude: point.alt,
        accuracy: 8 + Math.floor(Math.random() * 10),
        speed: isMoving ? 40 + Math.floor(Math.random() * 30) : 0,
        heading,
        recorded_at: currentDate.toISOString(),
        location_source: 'gps',
        battery_level: Math.round(battery),
        signal_strength: 65 + Math.floor(Math.random() * 25),
      })

      currentDate = new Date(currentDate.getTime() + (15 + Math.random() * 20) * 60 * 1000)
    }

    currentWarehouseIndex = nextWarehouseIndex

    // Recharge battery at new warehouse
    battery = Math.min(100, battery + 15 + Math.random() * 10)
  }

  return records
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Schema name - 'public' for Supabase deployment, 'sim-card-portal-v2' for local
  const schemaName = (process.env.USE_PUBLIC_SCHEMA === 'true' ? 'public' : 'sim-card-portal-v2') as 'public' | 'sim-card-portal-v2'

  // Start date: 3 months ago
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 3)
  startDate.setHours(6, 0, 0, 0)

  console.log('Generating location history data...')
  console.log(`Start date: ${startDate.toISOString()}`)

  // Generate data for both devices
  const dev003Data = generateDEV003Data(new Date(startDate))
  const dev007Data = generateDEV007Data(new Date(startDate))

  console.log(`Generated ${dev003Data.length} records for DEV003`)
  console.log(`Generated ${dev007Data.length} records for DEV007`)

  const allRecords = [...dev003Data, ...dev007Data]

  // Insert in batches of 100
  const batchSize = 100
  let inserted = 0

  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize)

    const { error } = await supabase
      .schema(schemaName)
      .from('device_location_history')
      .insert(batch)

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
      continue
    }

    inserted += batch.length
    console.log(`Inserted ${inserted}/${allRecords.length} records`)
  }

  console.log(`Done! Inserted ${inserted} location history records.`)
}

main().catch(console.error)
