export const apiFetch = (url: string, jwt: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers || {})
  if (jwt) {
    headers.set('Authorization', `Bearer ${jwt}`)
  }
  return fetch(url, { ...init, headers })
}

export const fetchJsonAuth = async (url: string, jwt: string, init: RequestInit = {}) => {
  const response = await apiFetch(url, jwt, init)
  if (!response.ok) {
    throw new Error(`Failed to load JSON: ${response.statusText}`)
  }
  return response.json()
}

export const fetchJsonIfOkAuth = async (url: string, jwt: string, init: RequestInit = {}) => {
  const response = await apiFetch(url, jwt, init)
  if (!response.ok) {
    return null
  }
  return response.json()
}

export const fetchTextIfOkAuth = async (url: string, jwt: string, init: RequestInit = {}) => {
  const response = await apiFetch(url, jwt, init)
  if (!response.ok) {
    return ''
  }
  return response.text()
}

export async function readApiError(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { detail?: string }
    if (data?.detail) {
      return `Error: ${data.detail}`
    }
  } catch {
    return null
  }
  return null
}
