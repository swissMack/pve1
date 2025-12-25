# Consumption Data Flow Diagram

## Overview

This document shows how consumption/usage data flows through the SIM Card Portal system.

## Data Flow Diagram

```mermaid
flowchart TB
    subgraph Sources["DATA SOURCES"]
        MQTT["MQTT Simulator<br/>(every 5 mins)"]
        ExtAPI["External Systems<br/>(Mediation/Provisioning)"]
    end

    subgraph Ingestion["DATA INGESTION APIs"]
        V1Usage["POST /api/v1/usage<br/>POST /api/v1/usage/batch"]
        MQTTBridge["MQTT Bridge Service<br/>(Port 1883)"]
    end

    subgraph Database["DATABASE TABLES"]
        UR["usage_records<br/>(raw CDR records)"]
        UC["usage_cycles<br/>(billing cycle totals)"]
        DU["daily_usage<br/>(daily aggregates)"]
        UA["usage_aggregations<br/>(monthly aggregates)"]
        INV["invoices"]
    end

    subgraph ReadAPIs["READ APIs (Dashboard)"]
        Trends["/api/consumption/trends"]
        KPIs["/api/consumption/kpis"]
        Carriers["/api/consumption/carriers"]
        Regional["/api/consumption/regional"]
        Invoices["/api/consumption/invoices"]
    end

    subgraph Frontend["FRONTEND COMPONENTS"]
        TrendsChart["ConsumptionTrendsChart.vue<br/>(24h/Daily/Weekly/Monthly)"]
        KPICards["KPICards.vue"]
        CarrierPie["TopCarriersBreakdown.vue"]
        Map["RegionalUsageMap.vue"]
        InvTable["InvoiceHistoryTable.vue"]
    end

    %% Data flow connections
    MQTT -->|"Usage JSON"| V1Usage
    ExtAPI -->|"Usage Records"| V1Usage

    V1Usage -->|"INSERT"| UR
    V1Usage -->|"UPDATE/ACCUMULATE"| UC

    MQTTBridge -->|"Sensor Data"| Database

    %% Read connections - CURRENT STATE
    Trends -->|"hourly: usage_records<br/>daily/weekly/monthly: daily_usage"| UR
    Trends -->|"daily/weekly/monthly"| DU
    KPIs --> UA
    Carriers --> UA
    Regional --> Database
    Invoices --> INV

    %% Frontend connections
    TrendsChart --> Trends
    KPICards --> KPIs
    CarrierPie --> Carriers
    Map --> Regional
    InvTable --> Invoices

    %% Styling
    classDef source fill:#e1f5fe,stroke:#01579b
    classDef api fill:#fff3e0,stroke:#e65100
    classDef db fill:#f3e5f5,stroke:#7b1fa2
    classDef read fill:#e8f5e9,stroke:#2e7d32
    classDef frontend fill:#fce4ec,stroke:#c2185b

    class MQTT,ExtAPI source
    class V1Usage,MQTTBridge api
    class UR,UC,DU,UA,INV db
    class Trends,KPIs,Carriers,Regional,Invoices read
    class TrendsChart,KPICards,CarrierPie,Map,InvTable frontend
```

## Current Data Flow Status

### WRITE PATH (Working)
```
MQTT Simulator (every 5 mins)
    ↓
POST /api/v1/usage
    ↓
usage_records table ✅ (88 records today, ~1.2GB)
    ↓
usage_cycles table ✅ (accumulated totals)
```

### READ PATH for 24hr View (Fixed)
```
ConsumptionTrendsChart.vue (24h mode)
    ↓
GET /api/consumption/trends?granularity=hourly
    ↓
Docker API queries: usage_records ✅
    ↓
Groups by hour using date_trunc('hour', period_start)
    ↓
Returns actual MQTT data per hour
```

### READ PATH for Daily/Weekly/Monthly (Uses Seeded Data)
```
ConsumptionTrendsChart.vue (daily/weekly/monthly mode)
    ↓
GET /api/consumption/trends?granularity=daily|weekly|monthly
    ↓
Docker API queries: daily_usage table
    ↓
Returns seeded sample data (not real MQTT data)
```

## Table Details

| Table | Purpose | Data Source | Used By |
|-------|---------|-------------|---------|
| `usage_records` | Raw usage records from MQTT | POST /api/v1/usage | 24hr trends chart |
| `usage_cycles` | Accumulated per-SIM billing totals | Auto-updated on usage submit | KPIs (partially) |
| `daily_usage` | Daily aggregated data | Seeded sample data | Daily/Weekly/Monthly charts |
| `usage_aggregations` | Monthly carrier aggregates | Seeded sample data | KPIs, Carriers chart |
| `invoices` | Billing records | Manual/seeded | Invoice table |

## Gap Identified

**Problem**: Real-time MQTT data goes to `usage_records` but the `daily_usage` table is not automatically populated from it.

**Current Workaround**:
- 24hr view now queries `usage_records` directly (fixed)
- Daily/Weekly/Monthly views use seeded sample data in `daily_usage`

**Recommended Fix**: Create a scheduled job or trigger to aggregate `usage_records` into `daily_usage` daily.
