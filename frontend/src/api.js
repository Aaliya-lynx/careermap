// Talks to the backend. The base address comes from VITE_API_URL (no trailing slash or dot).
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').trim().replace(/[./]+$/, '')

export class ApiError extends Error {}

// If the connection fails (often the free server waking up or restarting), wait a few seconds and try once more before giving up.
const RETRY_AFTER_MS = 5000
async function send(url, options) {
  try {
    return await fetch(url, options)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS))
    return fetch(url, options)
  }
}

async function post(path, body, signal) {
  let response
  try {
    response = await send(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Could not connect. Check your connection and try again. If the app has been idle, it can take up to a minute to wake up.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Something went wrong. Please try again.'
    throw new ApiError(detail)
  }
  return data
}

async function get(path) {
  let response
  try {
    response = await send(`${BASE}${path}`, {})
  } catch {
    throw new ApiError('Could not connect. Check your connection and try again. If the app has been idle, it can take up to a minute to wake up.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Something went wrong. Please try again.')
  return data
}

export const createRoadmap = (body) => post('/api/roadmap', body)
export const replan = (body, signal) => post('/api/plan', body, signal)
export const getAdvice = (body) => post('/api/node-advice', body)
export const analyzeCertificates = (body) => post('/api/certificates', body)
export const getPaths = (body) => post('/api/paths', body)
export const compareRoles = (body) => post('/api/compare', body)
export const createShare = (body) => post('/api/share', body)
export const getShare = (id) => get(`/api/share/${encodeURIComponent(id)}`)
