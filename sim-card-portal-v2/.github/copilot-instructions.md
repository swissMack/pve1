# SIM Card Portal v2 - GitHub Copilot Instructions

**ALWAYS follow these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap, Build, and Test the Repository
- **Install dependencies**: `npm install` -- Takes 15 seconds. NEVER CANCEL.
- **Build for production**: `npm run build` -- Takes 5 seconds. NEVER CANCEL. 
- **TypeScript compilation check**: `npx vue-tsc -b` -- Takes 4 seconds. NEVER CANCEL.
- **Start development server**: `npm run dev` -- Starts in 1 second. Runs on http://localhost:5173
- **Preview production build**: `npm run preview` -- Starts immediately. Runs on http://localhost:4173

### Development Server and Application Testing
- **ALWAYS run the bootstrapping steps first**: `npm install` then `npm run dev`
- **Authentication**: Use hardcoded credentials `admin` / `1234567` to access the portal
- **Application URL**: http://localhost:5173 for development, http://localhost:4173 for preview
- **Build output**: Production files are generated in `dist/` directory

### Validation Requirements
- **ALWAYS manually validate any new code by testing the complete authentication flow**
- **MANDATORY user workflow test**: 
  1. Navigate to http://localhost:5173
  2. Login with admin/1234567 credentials
  3. Test dashboard navigation (Dashboard, Devices, SIMs tabs)
  4. Verify device list displays correctly with mock data
  5. Verify SIM card management displays correctly with usage statistics
- **No existing test infrastructure** - manual validation only
- **No linting tools configured** - TypeScript compilation via `vue-tsc -b` is the only validation

## Repository Architecture

### Tech Stack
- **Vue 3** with Composition API and `<script setup>` syntax
- **TypeScript** with strict type checking
- **Vite** build tool and development server
- **CSS3** with modern features (no UI framework)
- **localStorage** for authentication persistence
- **Vercel** for deployment

### Project Structure
```
sim-card-portal-v2/
├── src/
│   ├── components/          # Vue components
│   │   ├── App.vue         # Main app with auth routing
│   │   ├── LoginPage.vue   # Authentication interface
│   │   ├── Dashboard.vue   # Main container after login
│   │   ├── Navigation.vue  # Top navigation bar
│   │   ├── WelcomePage.vue # Dashboard home with statistics
│   │   ├── DeviceList.vue  # Device management table
│   │   └── SIMCardManagement.vue # SIM card management
│   ├── data/
│   │   └── mockData.ts     # Device and SIM interfaces & mock data
│   ├── assets/             # Static assets (images, icons)
│   ├── main.ts            # Application entry point
│   └── style.css          # Global styles
├── docs/
│   └── PROJECT_DOCUMENTATION.md # Complete project documentation
├── public/                 # Static public assets
├── vite.config.ts         # Vite configuration
├── tsconfig.*.json        # TypeScript configurations
├── vercel.json            # Vercel deployment settings
└── package.json           # Dependencies and scripts
```

### Key Files to Edit After Making Changes
- **Always check App.vue** when modifying authentication flow
- **Always check mockData.ts** when adding new device or SIM attributes
- **Always check Navigation.vue** when adding new pages or navigation items
- **Always check style.css** when modifying global styles or design system

## Application Features

### Authentication System
- **Hardcoded credentials**: username `admin`, password `1234567`
- **Session persistence**: Uses localStorage with key `sim-portal-auth`
- **Login flow**: LoginPage.vue -> Dashboard.vue (authenticated area)
- **Logout**: Clears localStorage and returns to login

### Main Application Areas
1. **Dashboard/Home**: Statistics overview with device/SIM counts and quick actions
2. **Device Management**: Table with device list, status, IMEI, SIM association, data usage
3. **SIM Card Management**: SIM list with status, ICCID, carrier, data usage visualization
4. **Navigation**: Professional header with brand, tabs, search, and profile dropdown

### Mock Data Structure
```typescript
interface Device {
  id: string              // Unique device identifier
  name: string           // Human-readable device name
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Offline'
  simCard: string        // Associated SIM card ID
  deviceType: string     // Device type classification
  location: string       // Physical location
  lastSeen: string       // Last communication timestamp
  signalStrength: number // Signal strength (0-100)
  dataUsage: string      // Current data usage
  connectionType: '4G' | '5G' | '3G' | 'WiFi'
}

interface SIMCard {
  id: string            // Unique SIM identifier
  iccid: string         // 19-digit ICCID number
  msisdn: string        // Mobile phone number
  status: 'Active' | 'Inactive' | 'Suspended' | 'Terminated'
  carrier: string       // Network operator name
  plan: string          // Service plan name
  dataUsed: string      // Current usage
  dataLimit: string     // Plan limit
  activationDate: string // Service start date
  expiryDate: string    // Service end date
}
```

## Common Development Tasks

### Adding New Components
- Create new `.vue` files in `src/components/`
- Use `<script setup lang="ts">` syntax
- Import and reference in `Dashboard.vue` for navigation routing
- Follow existing design patterns from other components

### Modifying Data Models
- Edit interfaces in `src/data/mockData.ts`
- Update mock data arrays to match new interface fields
- Update component templates to display new fields
- Always use TypeScript interfaces for type safety

### Styling Guidelines
- **Design System**: Gray-based professional color palette
- **Typography**: Roboto font family with proper hierarchy
- **Layout**: Modern CSS Grid and Flexbox
- **Colors**: Primary (#1f2937), Secondary (#6b7280), Background (#f8f9fa)
- **Monospace fonts**: Use for technical data (IMEI, ICCID)

## Build and Deployment

### Local Development Process
1. **Clone repository**: `git clone https://github.com/tsavenkov/sim-card-portal-v2.git`
2. **Navigate to project**: `cd sim-card-portal-v2`
3. **Install dependencies**: `npm install` (15 seconds)
4. **Start development**: `npm run dev` (1 second startup)
5. **Access application**: http://localhost:5173
6. **Login**: admin / 1234567
7. **Test functionality**: Navigate through all main sections

### Production Build Process
1. **Build**: `npm run build` (5 seconds)
2. **Preview**: `npm run preview` (immediate startup)
3. **Deploy**: Push to main branch triggers Vercel deployment
4. **Build artifacts**: Generated in `dist/` directory

### Timing Expectations - NEVER CANCEL
- **npm install**: ~15 seconds - NEVER CANCEL
- **npm run build**: ~5 seconds - NEVER CANCEL
- **npx vue-tsc -b**: ~4 seconds - NEVER CANCEL
- **npm run dev**: ~1 second startup - NEVER CANCEL
- **npm run preview**: Immediate startup - NEVER CANCEL

## Validation Scenarios

### Essential Testing Workflow
**MANDATORY after any changes:**
1. **Build validation**: Run `npm run build` to ensure TypeScript compilation succeeds
2. **Development server**: Start `npm run dev` and verify no console errors
3. **Authentication test**: Login with admin/1234567 and verify redirect to dashboard
4. **Navigation test**: Click through Dashboard, Devices, SIMs tabs and verify content loads
5. **Data display test**: Verify device table and SIM table show mock data correctly
6. **UI responsiveness**: Check that the application works on different screen sizes

### Component-Specific Testing
- **After modifying LoginPage.vue**: Test login flow with correct and incorrect credentials
- **After modifying Dashboard.vue**: Test tab navigation and page routing
- **After modifying DeviceList.vue**: Verify device table displays, search works, status pills show correctly
- **After modifying SIMCardManagement.vue**: Verify SIM table, statistics cards, and usage bars display
- **After modifying mockData.ts**: Verify all data displays correctly across all components

## Configuration Details

### TypeScript Configuration
- **Strict mode enabled**: All TypeScript must pass strict type checking
- **Build info**: Stored in `./node_modules/.tmp/tsconfig.app.tsbuildinfo`
- **Vue files**: Fully typed with `<script setup lang="ts">`

### Vite Configuration
- **Plugin**: `@vitejs/plugin-vue` for Vue 3 support
- **Development server**: Hot module replacement enabled
- **Build output**: Optimized production bundle with tree shaking

### Vercel Deployment
- **Framework**: Vite detection automatic
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Install command**: `npm install`
- **Auto-deployment**: Enabled for main branch

## Common Command Outputs

### Repository Root Files
```
.git/                    # Git repository
.gitignore              # Git ignore rules
.vscode/                # VS Code settings
CLAUDE.md               # Claude assistant instructions
README.md               # Project documentation
docs/                   # Additional documentation
index.html              # HTML entry point
package-lock.json       # npm lock file
package.json            # Dependencies and scripts
public/                 # Static public assets
src/                    # Source code
tsconfig.*.json         # TypeScript configurations
ui/                     # UI related files
vercel.json             # Vercel deployment config
vite.config.ts          # Vite build configuration
```

### npm run build Output
```
> vue-tsc -b && vite build

vite v7.0.0 building for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
dist/index.html                  0.46 kB │ gzip:  0.30 kB
dist/assets/index-DiVvskx4.css  18.55 kB │ gzip:  3.59 kB  
dist/assets/index-LHSukGYU.js   82.36 kB │ gzip: 30.44 kB
✓ built in 1.22s
```

### npm run dev Output
```
VITE v7.0.0  ready in 519 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Troubleshooting

### Build Issues
- **TypeScript errors**: Run `npx vue-tsc -b` to see detailed compilation errors
- **Missing dependencies**: Run `npm install` to ensure all packages are installed
- **Build cache issues**: Delete `node_modules/.tmp/` directory and rebuild

### Development Server Issues
- **Port conflicts**: Vite will automatically use next available port if 5173 is busy
- **Hot reload not working**: Check that file watching is enabled and files are saved
- **Authentication not persisting**: Check browser localStorage for `sim-portal-auth` key

### Application Issues
- **Login fails**: Verify exact credentials `admin` / `1234567` (case sensitive)
- **Navigation broken**: Check Dashboard.vue component routing logic
- **Data not displaying**: Verify mockData.ts imports are working correctly
- **Styling issues**: Check that style.css is being loaded and CSS syntax is valid

## Important Notes

- **No test framework**: This project has no unit tests or test scripts configured
- **No linting tools**: No ESLint, Prettier, or other code formatting tools configured
- **Authentication is hardcoded**: Real authentication system would need backend integration
- **Mock data only**: All device and SIM data is static mock data in TypeScript files
- **Single page application**: All routing is client-side within Vue components
- **Mobile responsive**: Application works on mobile devices with responsive design