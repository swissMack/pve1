import { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== TEST API CALLED ===')
  
  return res.status(200).json({
    success: true,
    message: 'Test API working',
    method: req.method,
    timestamp: new Date().toISOString()
  })
}