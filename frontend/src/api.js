// Talks to the backend. The base address comes from VITE_API_URL (no trailing slash or dot).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim().replace(/[./]+$/, '')

export class ApiError extends Error {}

async function post(path, body, signal) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not reach the server. Check your connection and try again. The server may be waking up, which can take a minute.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Something went wrong. Please try again.'
    throw new ApiError(detail)
  }
  return data
}

export const createRoadmap = (body) => post('/api/roadmap', body)
export const replan = (body, signal) => post('/api/plan', body, signal)
export const getAdvice = (body) => post('/api/node-advice', body)
export const analyzeCertificates = (body) => post('/api/certificates', body)
export const getPaths = (body) => post('/api/paths', body)
