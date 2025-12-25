/**
 * Exchange Rate Service
 * Fetches and caches daily exchange rates from the European Central Bank
 * Base currency: EUR
 */

import { supabase, isSupabaseConfigured } from './supabase.js';

// ECB exchange rate feed URL
const ECB_RATES_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

// In-memory cache for rates
interface RateCache {
  rates: Map<string, number>;
  fetchedAt: Date | null;
  rateDate: string | null;
}

const rateCache: RateCache = {
  rates: new Map(),
  fetchedAt: null,
  rateDate: null
};

// Supported currencies (must match useAppSettings.ts)
export const SUPPORTED_CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP', 'DKK', 'ZAR', 'JPY', 'CNY', 'INR', 'AUD', 'CAD', 'SGD'];

/**
 * Parse ECB XML response to extract exchange rates
 */
function parseECBXml(xmlText: string): { rates: Map<string, number>; rateDate: string } {
  const rates = new Map<string, number>();

  // EUR to EUR is always 1
  rates.set('EUR', 1.0);

  // Extract the date from the XML (format: <Cube time='2024-12-20'>)
  const dateMatch = xmlText.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);
  const rateDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // Extract currency rates (format: <Cube currency='USD' rate='1.0432'/>)
  const rateRegex = /currency=['"]([A-Z]{3})['"].*?rate=['"]([0-9.]+)['"]/g;
  let match;

  while ((match = rateRegex.exec(xmlText)) !== null) {
    const currency = match[1];
    const rate = parseFloat(match[2]);
    if (!isNaN(rate) && rate > 0) {
      rates.set(currency, rate);
    }
  }

  return { rates, rateDate };
}

/**
 * Fetch exchange rates from ECB and store in database
 */
export async function fetchECBRates(): Promise<{ success: boolean; rateDate: string | null; error?: string }> {
  try {
    console.log('[ExchangeRate] Fetching rates from ECB...');

    const response = await fetch(ECB_RATES_URL);
    if (!response.ok) {
      throw new Error(`ECB API returned ${response.status}`);
    }

    const xmlText = await response.text();
    const { rates, rateDate } = parseECBXml(xmlText);

    if (rates.size <= 1) {
      throw new Error('No rates parsed from ECB response');
    }

    console.log(`[ExchangeRate] Parsed ${rates.size} rates for date ${rateDate}`);

    // Store rates in database
    if (isSupabaseConfigured() && supabase) {
      const ratesToInsert = Array.from(rates.entries())
        .filter(([currency]) => currency !== 'EUR')
        .map(([currency, rate]) => ({
          base_currency: 'EUR',
          target_currency: currency,
          rate: rate,
          rate_date: rateDate
        }));

      // Upsert rates (update if exists for same date)
      // Cast to any because exchange_rates table is not in generated types
      const { error } = await (supabase as any)
        .from('exchange_rates')
        .upsert(ratesToInsert, {
          onConflict: 'base_currency,target_currency,rate_date',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[ExchangeRate] Failed to store rates:', error);
      } else {
        // Update last fetched timestamp in app_settings
        await (supabase as any)
          .from('app_settings')
          .upsert({
            key: 'exchange_rates_last_fetched',
            value: JSON.stringify(new Date().toISOString()),
            updated_at: new Date().toISOString()
          });
      }
    }

    // Update in-memory cache
    rateCache.rates = rates;
    rateCache.fetchedAt = new Date();
    rateCache.rateDate = rateDate;

    console.log(`[ExchangeRate] Rates cached successfully. Date: ${rateDate}`);

    return { success: true, rateDate };
  } catch (error) {
    console.error('[ExchangeRate] Error fetching rates:', error);
    return {
      success: false,
      rateDate: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if rates need to be refreshed (older than 24 hours)
 */
function needsRefresh(): boolean {
  if (!rateCache.fetchedAt) return true;

  const now = new Date();
  const hoursSinceFetch = (now.getTime() - rateCache.fetchedAt.getTime()) / (1000 * 60 * 60);

  return hoursSinceFetch >= 24;
}

/**
 * Load rates from database into memory cache
 */
async function loadRatesFromDatabase(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    // Get the most recent rates for each currency
    // Cast to any because exchange_rates table is not in generated types
    const { data, error } = await (supabase as any)
      .from('exchange_rates')
      .select('target_currency, rate, rate_date')
      .order('rate_date', { ascending: false });

    if (error || !data || data.length === 0) {
      return false;
    }

    // Build rate map with most recent rate for each currency
    const rates = new Map<string, number>();
    rates.set('EUR', 1.0);

    const seenCurrencies = new Set<string>();
    for (const row of data as any[]) {
      if (!seenCurrencies.has(row.target_currency)) {
        rates.set(row.target_currency, parseFloat(row.rate));
        seenCurrencies.add(row.target_currency);
      }
    }

    // Update cache
    rateCache.rates = rates;
    rateCache.rateDate = data[0]?.rate_date || null;
    rateCache.fetchedAt = new Date();

    console.log(`[ExchangeRate] Loaded ${rates.size} rates from database (date: ${rateCache.rateDate})`);
    return true;
  } catch (error) {
    console.error('[ExchangeRate] Error loading rates from database:', error);
    return false;
  }
}

/**
 * Ensure rates are loaded and fresh
 */
async function ensureRates(): Promise<void> {
  // If cache is empty, try loading from database first
  if (rateCache.rates.size === 0) {
    const loaded = await loadRatesFromDatabase();
    if (loaded && !needsRefresh()) {
      return; // Rates loaded from DB and still fresh
    }
  }

  // If rates need refresh, fetch from ECB
  if (needsRefresh()) {
    await fetchECBRates();
  }
}

/**
 * Get exchange rate for a currency (EUR to target)
 */
export async function getExchangeRate(targetCurrency: string): Promise<number> {
  if (targetCurrency === 'EUR') {
    return 1.0;
  }

  await ensureRates();

  const rate = rateCache.rates.get(targetCurrency);
  if (rate !== undefined) {
    return rate;
  }

  // Currency not found - return 1.0 as fallback (no conversion)
  console.warn(`[ExchangeRate] Rate not found for ${targetCurrency}, using 1.0`);
  return 1.0;
}

/**
 * Convert amount from EUR to target currency
 */
export async function convertFromEUR(amount: number, targetCurrency: string): Promise<number> {
  const rate = await getExchangeRate(targetCurrency);
  return amount * rate;
}

/**
 * Get current display currency from app settings
 */
export async function getDisplayCurrency(): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    return 'EUR';
  }

  try {
    // Cast to any because app_settings table is not in generated types
    const { data, error } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', 'display_currency')
      .single();

    if (error || !data) {
      return 'EUR';
    }

    // Value is stored as JSON string, e.g., "\"USD\""
    const currency = typeof data.value === 'string'
      ? data.value.replace(/"/g, '')
      : String(data.value);

    return SUPPORTED_CURRENCIES.includes(currency) ? currency : 'EUR';
  } catch (error) {
    console.error('[ExchangeRate] Error getting display currency:', error);
    return 'EUR';
  }
}

/**
 * Set display currency in app settings
 */
export async function setDisplayCurrency(currency: string): Promise<{ success: boolean; error?: string }> {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return { success: false, error: `Unsupported currency: ${currency}` };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Cast to any because app_settings table is not in generated types
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({
        key: 'display_currency',
        value: JSON.stringify(currency),
        updated_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[ExchangeRate] Error setting display currency:', error);
    return { success: false, error: 'Failed to save currency setting' };
  }
}

/**
 * Get all current exchange rates (for admin display)
 */
export async function getAllRates(): Promise<{ rates: Record<string, number>; rateDate: string | null }> {
  await ensureRates();

  const rates: Record<string, number> = {};
  for (const [currency, rate] of rateCache.rates.entries()) {
    rates[currency] = rate;
  }

  return { rates, rateDate: rateCache.rateDate };
}

/**
 * Initialize exchange rate service (call on server start)
 */
export async function initExchangeRateService(): Promise<void> {
  console.log('[ExchangeRate] Initializing exchange rate service...');
  await ensureRates();
  console.log('[ExchangeRate] Service initialized');
}
