# Feature Specification: Consumption Filters with LLM Integration

**Feature Branch**: `003-consumption-filters-llm`
**Created**: 2025-01-07
**Status**: Draft
**Input**: User description: "Reengineer mediation API with consumption page filters and AskBob LLM integration"
**API Reference**: [open-api.json](../../sim-card-portal-v2/docs/open-api.json) - Analytics Service API v1.0.0

## Clarifications

### Session 2025-01-07

- Q: Where will the MCCMNC-to-carrier-name mapping come from? → A: Fetch from external MCC-MNC reference API at runtime
- Q: How should Data Volume Range filter be implemented (not supported by API)? → A: Remove from scope - Analytics API does not support volume filtering
- Q: What caching strategy should be used for Analytics API responses? → A: Session-level caching, invalidated on logout

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unified Time-Based Filtering (Priority: P1)

As a portal user viewing consumption data, I want to select a time granularity (24 hours, Daily, Weekly, Monthly) that affects all consumption panes simultaneously, so I can see consistent data across trends, carriers, and regional usage without switching contexts.

**Why this priority**: This is the foundational UX improvement that enables consistent data analysis. Currently the time toggle only affects the trends chart, creating confusion when other panes show different time ranges.

**Independent Test**: Can be fully tested by clicking each time toggle option (24h, Daily, Weekly, Monthly) and verifying that Consumption Trends, Top Carriers, and Regional Usage all display data for the selected time period.

**Acceptance Scenarios**:

1. **Given** I am on the Consumption page, **When** I click "24h" toggle, **Then** all three panes (Consumption Trends, Top Carriers, Regional Usage) display data for the last 24 hours using day-granularity API queries
2. **Given** I am viewing Weekly data, **When** I click "Monthly" toggle, **Then** all panes refresh simultaneously to show monthly data using month-granularity API queries
3. **Given** I have selected a time granularity, **When** I also apply a custom date range, **Then** the granularity applies within that custom date range using period/periodEnd parameters
4. **Given** the page is loading new data after a toggle change, **When** I look at the panes, **Then** I see a loading indicator on all affected panes

---

### User Story 2 - Advanced Filter Fields for Analytics Data (Priority: P2)

As a billing analyst, I want to filter consumption data by network (MCCMNC) and IMSI, so I can drill down into specific subsets of data for analysis and reporting.

**Why this priority**: Extends filtering beyond time to enable detailed analysis. Depends on the unified time filter being in place for consistent UX.

**Independent Test**: Can be fully tested by applying various filter combinations and verifying the data in all panes reflects only records matching the filter criteria.

**Acceptance Scenarios**:

1. **Given** I am on the Consumption page, **When** I open the filter panel, **Then** I see filter fields for: Network (MCCMNC multi-select with carrier name labels), IMSI (search/multi-select)
2. **Given** I select a network from the filter, **When** I apply the filter, **Then** all panes show only data for that MCCMNC network
3. **Given** I have multiple filters applied, **When** I click "Clear Filters", **Then** all filters reset and data shows unfiltered results
4. **Given** filters are applied, **When** I change the time granularity, **Then** the filters remain active while data refreshes for the new time period
5. **Given** I apply filters that return no results, **When** the data loads, **Then** I see a "No data matches your filters" message with option to clear filters

---

### User Story 3 - Detailed Usage Results Pane (Priority: P2)

As a billing analyst, I want to see a detailed data table showing individual IMSI usage records that match my current filters, so I can examine specific usage records with full details (IMSI, network, data volume, period).

**Why this priority**: Complements the filter fields by providing record-level visibility. Users need to see the raw data behind the aggregate charts.

**Independent Test**: Can be fully tested by applying filters and verifying the data table shows matching records with all required columns.

**Acceptance Scenarios**:

1. **Given** I have filters applied, **When** I look at the Usage Results pane, **Then** I see a data table with columns: IMSI, Network (MCCMNC with carrier label), Data Volume (bytes/GB), Period, Last Event Time
2. **Given** the results contain 100+ records, **When** I view the table, **Then** I see pagination controls allowing me to navigate through pages
3. **Given** I am viewing results, **When** I click on a column header, **Then** the table sorts by that column (ascending/descending toggle)
4. **Given** results are displayed, **When** I click "Export CSV", **Then** the filtered data exports as a CSV file with all columns

---

### User Story 4 - AskBob LLM Analytics API Integration (Priority: P3)

As a portal user, I want to ask Bob natural language questions about my consumption data and have Bob use the Analytics API to retrieve and analyze the data, so I can get insights without manually applying filters.

**Why this priority**: Enhances the existing AskBob feature with API-driven data retrieval. Depends on the filter API being available for Bob to query.

**Independent Test**: Can be fully tested by typing natural language queries into AskBob and verifying the responses contain accurate data from the API.

**Acceptance Scenarios**:

1. **Given** I open the Ask Bob panel, **When** I ask "Show me top 5 networks by data usage this month", **Then** Bob queries `/analytics/tenant/network` and responds with a chart/table showing the top 5 networks with their byte usage
2. **Given** I ask Bob "What is the total data usage for network 22288 last week?", **When** Bob processes the query, **Then** Bob uses the Analytics API with mccmnc filter to fetch and return the usage figure
3. **Given** I ask Bob "How many unique IMSIs were active in December?", **When** Bob processes the query, **Then** Bob queries `/analytics/unique/imsi/count/tenant/network` with period=2024-12
4. **Given** Bob returns data results, **When** I see the response, **Then** I can copy the data or export it as CSV (existing functionality preserved)
5. **Given** I ask a complex query like "Compare data usage trends between network A and network B", **When** Bob processes it, **Then** Bob generates a comparative chart with both networks' data using periodEnd for ranges

---

### Edge Cases

- What happens when the Analytics API is unavailable? System displays an error message and falls back to session-cached data if available, otherwise shows "Data temporarily unavailable"
- How does system handle time zone differences in data? All timestamps displayed in user's local timezone; API returns UTC timestamps in latestEventAt field
- What if a filter combination returns excessive results (>10,000 records)? System paginates results and displays warning about large dataset, suggesting more specific filters
- How does AskBob handle ambiguous queries? Bob asks clarifying questions before executing the query
- How are MCCMNC codes displayed to users? System maintains a mapping of MCCMNC codes to human-readable carrier/network names

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide unified time granularity controls (24h, Daily, Weekly, Monthly) that affect Consumption Trends, Top Carriers, and Regional Usage panes simultaneously
- **FR-002**: System MUST translate time granularity selections to Analytics API period format: 24h/Daily uses `yyyy-MM-dd`, Weekly uses date range with periodEnd, Monthly uses `yyyy-MM`
- **FR-003**: System MUST provide filter fields for: Network (MCCMNC multi-select with carrier name labels), IMSI (search/autocomplete multi-select)
- **FR-004**: System MUST display a Usage Results pane showing records matching current filters with columns: IMSI, Network (MCCMNC + name), Data Volume (bytes), Period, Last Event Time
- **FR-005**: System MUST integrate Analytics API capabilities with AskBob to enable natural language queries that retrieve filtered data
- **FR-006**: System MUST persist filter selections during the session and reset on page reload
- **FR-007**: System MUST show loading states when data is being fetched after filter/granularity changes
- **FR-008**: System MUST support CSV export of filter results from both the data table and AskBob responses
- **FR-009**: Usage Results table MUST support pagination (default 25 rows per page) and column sorting
- **FR-010**: AskBob MUST be able to interpret natural language queries and translate them into appropriate Analytics API parameters (period, periodEnd, mccmnc, imsi, tenant, customer)
- **FR-011**: System MUST validate filter inputs (e.g., periodEnd must not be earlier than period)
- **FR-012**: System MUST fetch MCCMNC-to-carrier-name mappings from an external MCC-MNC reference API at runtime, with local caching for performance
- **FR-013**: System MUST support querying unique IMSI counts via `/analytics/unique/imsi/count/*` endpoints
- **FR-014**: System MUST cache Analytics API responses at session level, invalidating cache on user logout; cached data MUST be used as fallback when API is unavailable

### Analytics API Endpoints (from OpenAPI spec)

| Endpoint | Purpose | Key Filters |
|----------|---------|-------------|
| `/analytics/tenant/network` | Usage per network for tenant | tenant, mccmnc[], period, periodEnd |
| `/analytics/customer/network` | Usage per network for customer | tenant, customer, mccmnc[], period, periodEnd |
| `/analytics/imsi` | Usage per IMSI | tenant, customer, imsi[], period, periodEnd |
| `/analytics/imsi/network` | Usage per IMSI per network | tenant, customer, imsi[], mccmnc[], period, periodEnd |
| `/analytics/unique/imsi/count/tenant/network` | Unique IMSI count per network | tenant, mccmnc[], period, periodEnd |
| `/analytics/unique/imsi/count/customer/network` | Unique IMSI count per customer | tenant, customer, mccmnc[], period, periodEnd |

### Key Entities *(include if feature involves data)*

- **Usage**: Analytics record with year, month, day (period buckets), mccmnc, imsi, bytes, latestEventAt
- **UniqueImsi**: Count record with year, month, day, mccmnc, uniqueImsiCount, latestEventAt
- **FilterCriteria**: User-selected filter parameters including time granularity, period range, networks (mccmnc[]), IMSIs
- **NetworkMapping**: MCCMNC code to human-readable carrier/network name mapping for UI display

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can apply time granularity filters and see all three consumption panes update within 3 seconds
- **SC-002**: Filter combinations return results within 5 seconds for datasets up to 50,000 records
- **SC-003**: AskBob correctly interprets and responds to 80%+ of common consumption queries (tested against a predefined query set covering period, network, and IMSI queries)
- **SC-004**: Users can export filtered data to CSV within 10 seconds for up to 10,000 records
- **SC-005**: 90% of users successfully complete filtering workflows on first attempt (usability benchmark)
- **SC-006**: Usage Results pane displays accurate record counts matching the applied filter criteria

## Assumptions

- The Analytics Service API (localhost:9010) will be accessible from the portal backend or proxied through the portal API
- Tenant and customer identifiers will be derived from the authenticated user's session/context
- MCCMNC-to-carrier-name mapping will be fetched from an external MCC-MNC reference API (e.g., mcc-mnc.com or similar) with results cached locally to minimize latency
- Cost calculations are not provided by this API; if cost display is needed, it will require a separate pricing service or calculation layer
- The existing AskBob `/api/llm/chart` endpoint pattern will be extended to support the Analytics API query translation
- PrimeVue components will be used for all new UI elements to maintain design consistency
- OAuth2 authentication (Keycloak) will be handled by the portal backend when calling the Analytics API
