# Route Tracking Feature - Deployment Checklist

This checklist ensures the GPS route tracking feature is properly deployed and functional.

## ✅ Pre-Deployment Checklist

### 1. Database Setup
- [ ] Execute `migrations/001_create_device_location_history.sql` in Supabase SQL Editor
- [ ] Verify table creation: `SELECT * FROM "sim-card-portal-v2".device_location_history LIMIT 1;`
- [ ] Execute `migrations/002_insert_mock_location_history.sql` for test data
- [ ] Verify data insertion: `SELECT device_id, COUNT(*) FROM "sim-card-portal-v2".device_location_history GROUP BY device_id;`

Expected result: ~90 total records across DEV001, DEV002, DEV003, DEV007

### 2. Environment Variables
- [ ] Set `SUPABASE_URL` in Vercel environment
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment
- [ ] Set `VITE_GOOGLE_MAPS_API_KEY` in Vercel environment
- [ ] (Optional) Set `VITE_GOOGLE_MAPS_MAP_ID` for vector maps

### 3. Google Maps API Configuration
- [ ] Enable Maps JavaScript API in Google Cloud Console
- [ ] Enable Places API (if using autocomplete features)
- [ ] Verify API key restrictions (HTTP referrers for production domain)
- [ ] Test API key is not restricted for development

### 4. Code Review
- [ ] All TypeScript compilation errors resolved (`npx vue-tsc -b`)
- [ ] Production build successful (`npm run build`)
- [ ] No console errors in browser DevTools
- [ ] All files committed and pushed to repository

## 🚀 Deployment Steps

### Step 1: Deploy to Vercel
```bash
# Vercel will automatically deploy on push to main branch
git checkout main
git merge copilot/track-gps-coordinates-sensors
git push origin main
```

Or deploy manually:
```bash
vercel deploy --prod
```

### Step 2: Verify API Endpoints
```bash
# Test device location history API
curl "https://your-domain.vercel.app/api/device-location-history?device_id=DEV003"
```

Expected: JSON response with location history data

### Step 3: Test Frontend
1. Navigate to https://your-domain.vercel.app
2. Login with admin/1234567
3. Go to Devices tab
4. Click Details on "Vehicle Tracker Gamma" (DEV003)
5. Click "Route History" tab
6. Verify map loads and displays route
7. Check route statistics panel shows data
8. Test date range selector (24h, 7d, 30d)

## 🧪 Post-Deployment Verification

### Functional Tests
- [ ] Device list loads successfully
- [ ] Device details dialog opens
- [ ] Both tabs (Device Info, Route History) are visible
- [ ] Route History tab displays loading state
- [ ] Map loads without errors (check browser console)
- [ ] Route polyline appears on map
- [ ] Start and end markers are visible
- [ ] Clicking markers shows info windows
- [ ] Route statistics calculate correctly
- [ ] Date range selector works
- [ ] No console errors in browser DevTools

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] Map rendering smooth (no lag)
- [ ] Tab switching instant

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Map Doesn't Load
**Symptoms**: Gray box where map should be, or error message about API key

**Solutions**:
1. Check `VITE_GOOGLE_MAPS_API_KEY` is set in environment
2. Verify API key is valid in Google Cloud Console
3. Check Maps JavaScript API is enabled
4. Review browser console for specific error messages
5. Clear browser cache and reload

### No Route Data Displayed
**Symptoms**: "No route history available" message

**Solutions**:
1. Verify database table exists: 
   ```sql
   SELECT COUNT(*) FROM "sim-card-portal-v2".device_location_history;
   ```
2. Check API endpoint returns data:
   ```bash
   curl "https://your-domain.vercel.app/api/device-location-history?device_id=DEV003"
   ```
3. Verify Supabase credentials are correct in Vercel environment
4. Check date range includes actual data (mock data uses relative dates)

### API Errors
**Symptoms**: Error messages in console, failed fetch requests

**Solutions**:
1. Check Vercel function logs for backend errors
2. Verify Supabase connection:
   ```bash
   curl "https://your-domain.vercel.app/api/devices"
   ```
3. Ensure CORS is enabled (already configured in API code)
4. Check Supabase service role key has proper permissions

### Build Failures
**Symptoms**: Vercel deployment fails

**Solutions**:
1. Run locally: `npm run build`
2. Check TypeScript errors: `npx vue-tsc -b`
3. Verify all dependencies installed: `npm install`
4. Check Vercel build logs for specific errors

## 📊 Monitoring

### Metrics to Track
- API response times (device-location-history endpoint)
- Page load performance (Devices page with map)
- Error rates in Vercel function logs
- Google Maps API quota usage

### Recommended Tools
- Vercel Analytics for frontend performance
- Vercel Function Logs for API monitoring
- Google Cloud Console for Maps API usage
- Supabase Dashboard for database queries

## 🔄 Rollback Plan

If issues arise after deployment:

### Quick Rollback
```bash
# Revert to previous deployment in Vercel dashboard
# Or redeploy previous commit
git revert HEAD
git push origin main
```

### Feature Flag (Alternative)
Add a feature flag to disable route history tab:
```typescript
// In DeviceDetail.vue, wrap Route History tab with condition
<Tab v-if="enableRouteHistory" value="1">Route History</Tab>
```

## 📝 Success Criteria

Deployment is considered successful when:
- [x] All database tables created and populated
- [x] API endpoints return data without errors
- [x] Frontend loads and displays correctly
- [x] Map visualization works on all supported browsers
- [x] Route statistics calculate accurately
- [x] No critical errors in logs
- [x] Performance within acceptable limits
- [x] User can complete full workflow (login → devices → details → route history)

## 🎉 Post-Deployment Tasks

- [ ] Notify team of new feature availability
- [ ] Update user documentation/help center
- [ ] Monitor error rates for 24 hours
- [ ] Gather user feedback
- [ ] Plan next iteration improvements

## 📞 Support Contacts

- **Database Issues**: Check Supabase dashboard and logs
- **API Issues**: Check Vercel function logs
- **Frontend Issues**: Check browser console and Vercel Analytics
- **Maps Issues**: Check Google Cloud Console Maps API usage

---

**Last Updated**: 2025-10-13  
**Feature Version**: 1.0.0  
**Status**: Ready for Deployment
