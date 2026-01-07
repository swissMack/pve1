import { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

/**
 * LLM Chart API: POST /api/llm/chart
 * Processes natural language queries about consumption data
 * Uses Claude to understand intent and generate chart/table configurations
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:9010'

// Chart color palette
const CHART_COLORS = [
  '#137fec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
]

interface DateRange {
  start: string
  end: string
}

interface ChartResponse {
  type: 'chart' | 'table' | 'text'
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut'
  title?: string
  content?: string
  data?: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string
    }>
  }
  columns?: string[]
  rows?: string[][]
}

interface ToolResult {
  type: string
  data: unknown
}

// Analytics tool definitions for Claude
const ANALYTICS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_usage_by_carrier',
    description: 'Get data usage breakdown by carrier/network (MCCMNC). Use this when the user asks about carrier usage, network breakdown, or which carriers are used.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period in format yyyy-MM (month) or yyyy-MM-dd (day). Use current month if not specified.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of carriers to return. Default 10.'
        }
      },
      required: ['period']
    }
  },
  {
    name: 'get_usage_trends',
    description: 'Get usage trends over time. Use this when the user asks about trends, patterns over time, monthly/daily comparisons.',
    input_schema: {
      type: 'object' as const,
      properties: {
        granularity: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Time granularity for the trend data'
        },
        periods: {
          type: 'number',
          description: 'Number of periods to include. Default 6 for monthly, 7 for daily, 5 for weekly.'
        }
      },
      required: ['granularity']
    }
  },
  {
    name: 'get_top_imsis',
    description: 'Get top IMSIs by data usage. Use this when the user asks about which SIMs or IMSIs have highest usage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period in format yyyy-MM (month) or yyyy-MM-dd (day)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of IMSIs to return. Default 10.'
        }
      },
      required: ['period']
    }
  },
  {
    name: 'get_cost_summary',
    description: 'Get cost summary and breakdown. Use this when the user asks about costs, spending, or billing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period in format yyyy-MM (month)'
        }
      },
      required: ['period']
    }
  }
]

/**
 * Execute analytics tool calls
 */
async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  dateRange: DateRange
): Promise<ToolResult> {
  const baseUrl = ANALYTICS_API_URL.replace(/\/$/, '')

  try {
    switch (toolName) {
      case 'get_usage_by_carrier': {
        const period = (toolInput.period as string) || dateRange.start.substring(0, 7)
        const response = await fetch(`${baseUrl}/analytics/tenant/network?period=${period}&tenant=default-tenant`)
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()
        return { type: 'carrier_usage', data }
      }

      case 'get_usage_trends': {
        const granularity = (toolInput.granularity as string) || 'monthly'
        const periods = (toolInput.periods as number) || (granularity === 'monthly' ? 6 : granularity === 'weekly' ? 5 : 7)

        // Generate period dates
        const periodData: Array<{ period: string; bytes: number }> = []
        const now = new Date()

        for (let i = periods - 1; i >= 0; i--) {
          let periodStr: string
          const d = new Date(now)

          if (granularity === 'monthly') {
            d.setMonth(d.getMonth() - i)
            periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          } else if (granularity === 'weekly') {
            d.setDate(d.getDate() - (i * 7))
            periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          } else {
            d.setDate(d.getDate() - i)
            periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          }

          try {
            const response = await fetch(`${baseUrl}/analytics/tenant/network?period=${periodStr}&tenant=default-tenant`)
            if (response.ok) {
              const result = await response.json()
              const totalBytes = Array.isArray(result) ? result.reduce((sum: number, r: { bytes?: number }) => sum + (r.bytes || 0), 0) : 0
              periodData.push({ period: periodStr, bytes: totalBytes })
            } else {
              periodData.push({ period: periodStr, bytes: 0 })
            }
          } catch {
            periodData.push({ period: periodStr, bytes: 0 })
          }
        }

        return { type: 'usage_trends', data: periodData }
      }

      case 'get_top_imsis': {
        const period = (toolInput.period as string) || dateRange.start.substring(0, 7)
        const limit = (toolInput.limit as number) || 10
        const response = await fetch(`${baseUrl}/analytics/imsi?period=${period}&customer=default-customer&tenant=default-tenant`)
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()
        const sorted = Array.isArray(data)
          ? data.sort((a: { bytes?: number }, b: { bytes?: number }) => (b.bytes || 0) - (a.bytes || 0)).slice(0, limit)
          : []
        return { type: 'top_imsis', data: sorted }
      }

      case 'get_cost_summary': {
        // For now, estimate costs based on usage (0.001 CHF per MB as example rate)
        const period = (toolInput.period as string) || dateRange.start.substring(0, 7)
        const response = await fetch(`${baseUrl}/analytics/tenant/network?period=${period}&tenant=default-tenant`)
        if (!response.ok) throw new Error(`API error: ${response.status}`)
        const data = await response.json()
        const costs = Array.isArray(data) ? data.map((r: { mccmnc?: string; bytes?: number }) => ({
          carrier: r.mccmnc || 'Unknown',
          bytes: r.bytes || 0,
          cost: ((r.bytes || 0) / (1024 * 1024)) * 0.001 // Example rate
        })) : []
        return { type: 'cost_summary', data: costs }
      }

      default:
        return { type: 'error', data: { error: `Unknown tool: ${toolName}` } }
    }
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error)
    return { type: 'error', data: { error: String(error) } }
  }
}

/**
 * Format tool results into chart configuration
 */
function formatToolResultAsChart(toolResult: ToolResult, currency: string): ChartResponse {
  const { type, data } = toolResult

  if (type === 'error') {
    return {
      type: 'text',
      content: 'Sorry, I was unable to retrieve the data. Please try again later.'
    }
  }

  switch (type) {
    case 'carrier_usage': {
      const records = Array.isArray(data) ? data : []
      if (records.length === 0) {
        return { type: 'text', content: 'No carrier usage data found for the selected period.' }
      }

      const sorted = records
        .filter((r: { bytes?: number }) => (r.bytes || 0) > 0)
        .sort((a: { bytes?: number }, b: { bytes?: number }) => (b.bytes || 0) - (a.bytes || 0))
        .slice(0, 10)

      const labels = sorted.map((r: { mccmnc?: string }) => r.mccmnc || 'Unknown')
      const values = sorted.map((r: { bytes?: number }) => ((r.bytes || 0) / (1024 * 1024 * 1024))) // Convert to GB

      return {
        type: 'chart',
        chartType: 'bar',
        title: 'Data Usage by Carrier (GB)',
        data: {
          labels,
          datasets: [{
            label: 'Usage (GB)',
            data: values,
            backgroundColor: CHART_COLORS.slice(0, labels.length),
            borderColor: '#137fec'
          }]
        },
        content: `Top ${labels.length} carriers by data usage. Total: ${values.reduce((a, b) => a + b, 0).toFixed(2)} GB`
      }
    }

    case 'usage_trends': {
      const records = Array.isArray(data) ? data : []
      if (records.length === 0) {
        return { type: 'text', content: 'No trend data available.' }
      }

      const labels = records.map((r: { period: string }) => r.period)
      const values = records.map((r: { bytes: number }) => (r.bytes / (1024 * 1024 * 1024))) // GB

      return {
        type: 'chart',
        chartType: 'line',
        title: 'Data Usage Trend (GB)',
        data: {
          labels,
          datasets: [{
            label: 'Usage (GB)',
            data: values,
            backgroundColor: 'rgba(19, 127, 236, 0.2)',
            borderColor: '#137fec'
          }]
        },
        content: `Usage trend over ${labels.length} periods. Average: ${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)} GB`
      }
    }

    case 'top_imsis': {
      const records = Array.isArray(data) ? data : []
      if (records.length === 0) {
        return { type: 'text', content: 'No IMSI usage data found.' }
      }

      const columns = ['IMSI', 'Network', 'Usage (GB)']
      const rows = records.map((r: { imsi?: string; mccmnc?: string; bytes?: number }) => [
        r.imsi || 'N/A',
        r.mccmnc || 'N/A',
        ((r.bytes || 0) / (1024 * 1024 * 1024)).toFixed(2)
      ])

      return {
        type: 'table',
        title: `Top ${records.length} IMSIs by Usage`,
        columns,
        rows,
        content: `Showing top ${records.length} IMSIs with highest data usage.`
      }
    }

    case 'cost_summary': {
      const records = Array.isArray(data) ? data : []
      if (records.length === 0) {
        return { type: 'text', content: 'No cost data available.' }
      }

      const sorted = records
        .filter((r: { cost?: number }) => (r.cost || 0) > 0)
        .sort((a: { cost?: number }, b: { cost?: number }) => (b.cost || 0) - (a.cost || 0))
        .slice(0, 8)

      const labels = sorted.map((r: { carrier: string }) => r.carrier)
      const values = sorted.map((r: { cost: number }) => r.cost)
      const totalCost = values.reduce((a, b) => a + b, 0)

      return {
        type: 'chart',
        chartType: 'doughnut',
        title: `Cost Breakdown (${currency})`,
        data: {
          labels,
          datasets: [{
            label: `Cost (${currency})`,
            data: values,
            backgroundColor: CHART_COLORS.slice(0, labels.length)
          }]
        },
        content: `Total estimated cost: ${currency} ${totalCost.toFixed(2)}. Based on usage data.`
      }
    }

    default:
      return { type: 'text', content: 'Data retrieved successfully.' }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { query, dateRange, currency = 'CHF' } = req.body as {
    query: string
    dateRange: DateRange
    currency?: string
  }

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, error: 'Query is required' })
  }

  // Check if API key is configured
  if (!ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not configured, using fallback response')
    return res.status(200).json({
      success: true,
      data: {
        type: 'text',
        content: 'I apologize, but the AI service is not configured. Please contact your administrator to set up the ANTHROPIC_API_KEY environment variable.'
      }
    })
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    // System prompt for Bob
    const systemPrompt = `You are Bob, a helpful AI assistant for the IoTo SIM Card Portal. You help users understand their SIM card consumption data.

You have access to tools that can query the Analytics API to get:
- Data usage by carrier/network
- Usage trends over time
- Top IMSIs by usage
- Cost summaries

When users ask about their data, use the appropriate tool to fetch the data and provide insights.

Current date range context: ${dateRange.start} to ${dateRange.end}
Currency: ${currency}

Be concise and helpful. If you can't answer a question, suggest what data might help.`

    // Initial message to Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: ANALYTICS_TOOLS,
      messages: [{ role: 'user', content: query }]
    })

    // Handle tool use
    let finalResponse: ChartResponse | null = null

    if (response.stop_reason === 'tool_use') {
      // Find tool use block
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      if (toolUseBlock) {
        // Execute the tool
        const toolResult = await executeToolCall(
          toolUseBlock.name,
          toolUseBlock.input as Record<string, unknown>,
          dateRange
        )

        // Format as chart
        finalResponse = formatToolResultAsChart(toolResult, currency)

        // Get Claude's commentary on the results
        const followUpResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          system: systemPrompt,
          messages: [
            { role: 'user', content: query },
            { role: 'assistant', content: response.content },
            {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: JSON.stringify(toolResult.data)
              }]
            }
          ]
        })

        // Extract text from follow-up response
        const textBlock = followUpResponse.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        )

        if (textBlock && finalResponse) {
          finalResponse.content = textBlock.text
        }
      }
    } else {
      // No tool use, just text response
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )

      finalResponse = {
        type: 'text',
        content: textBlock?.text || 'I understood your question but couldn\'t generate a response.'
      }
    }

    return res.status(200).json({
      success: true,
      data: finalResponse
    })
  } catch (error) {
    console.error('LLM API error:', error)

    // Return a friendly error response
    return res.status(200).json({
      success: true,
      data: {
        type: 'text',
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.'
      }
    })
  }
}
