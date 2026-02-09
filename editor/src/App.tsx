import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import './App.css'

type FrameEntry = {
  id: string
  name: string
  tags: string[]
  width: number
  height: number
  thumb_url: string
}

type FrameDetail = FrameEntry & {
  image_url: string
  template_metadata_json: ChartMeta
}

type ChartListItem = {
  chart_id: string
  name?: string
  created_at?: string
  default_frame_id?: string | null
}

type ChartDetail = {
  chart_id: string
  name?: string
  birth_date: string
  birth_time: string
  latitude: number
  longitude: number
  default_frame_id?: string | null
}

type ChartMeta = {
  canvas: { width: number; height: number }
  chart: {
    center: { x: number; y: number }
    ring_outer: number
    ring_inner: number
    rotation_deg?: number
  }
  chart_fit?: {
    dx?: number
    dy?: number
    scale?: number
    rotation_deg?: number
  }
}

type ChartFit = {
  dx: number
  dy: number
  scale: number
  rotation_deg: number
}

type Offset = { dx?: number; dy?: number; dr?: number; dt?: number }

type LayoutFile = {
  overrides?: Record<string, Offset>
}

type DragState = {
  mode: 'chart-move' | 'chart-scale' | 'chart-rotate' | 'label'
  startPoint: { x: number; y: number }
  startFit: ChartFit
  labelId?: string
  startOffset?: Offset
}

const defaultChartFit: ChartFit = { dx: 0, dy: 0, scale: 1, rotation_deg: 0 }
const CHART_ONLY_ID = '__chart_only__'

function App() {
  const defaultApiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  const [jwt, setJwt] = useState(() => localStorage.getItem('zodiac_editor.jwt') ?? '')
  const [user, setUser] = useState<{ id: string; email: string; is_admin?: boolean } | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [apiBase, setApiBase] = useState(
    () => localStorage.getItem('zodiac_editor.apiBaseUrl') ?? defaultApiBase
  )
  const [frames, setFrames] = useState<FrameEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>(
    () => localStorage.getItem('zodiac_editor.frameId') ?? ''
  )
  const [selectedFrameDetail, setSelectedFrameDetail] = useState<FrameDetail | null>(null)
  const [chartId, setChartId] = useState<string>(
    () => localStorage.getItem('zodiac_editor.chartId') ?? ''
  )
  const [meta, setMeta] = useState<ChartMeta | null>(null)
  const [chartSvgBase, setChartSvgBase] = useState<string>('')
  const [chartSvg, setChartSvg] = useState<string>('')
  const [chartFit, setChartFit] = useState<ChartFit>(defaultChartFit)
  const [overrides, setOverrides] = useState<Record<string, Offset>>({})
  const [initialFit, setInitialFit] = useState<ChartFit>(defaultChartFit)
  const [initialOverrides, setInitialOverrides] = useState<Record<string, Offset>>({})
  const [selectedElement, setSelectedElement] = useState<string>('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [error, setError] = useState<string>('')
  const [showLabels, setShowLabels] = useState(true)
  const [status, setStatus] = useState<string>('')
  const [frameSearch, setFrameSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadGlobal, setUploadGlobal] = useState(false)
  const [chartName, setChartName] = useState('')
  const [charts, setCharts] = useState<ChartListItem[]>([])
  const [birthDate, setBirthDate] = useState(
    () => localStorage.getItem('zodiac_editor.birthDate') ?? '1990-04-12'
  )
  const [birthTime, setBirthTime] = useState(
    () => localStorage.getItem('zodiac_editor.birthTime') ?? '08:45'
  )
  const [latitude, setLatitude] = useState(
    () => Number(localStorage.getItem('zodiac_editor.latitude') ?? 40.7128)
  )
  const [longitude, setLongitude] = useState(
    () => Number(localStorage.getItem('zodiac_editor.longitude') ?? -74.006)
  )

  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartRootRef = useRef<SVGGElement | null>(null)

  const isChartOnly = selectedId === CHART_ONLY_ID

  const apiFetch = (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {})
    if (jwt) {
      headers.set('Authorization', `Bearer ${jwt}`)
    }
    return fetch(url, { ...init, headers })
  }

  const fetchJsonAuth = async (url: string) => {
    const response = await apiFetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${response.statusText}`)
    }
    return response.json()
  }

  const fetchJsonIfOkAuth = async (url: string) => {
    const response = await apiFetch(url)
    if (!response.ok) {
      return null
    }
    return response.json()
  }

  const fetchTextIfOkAuth = async (url: string) => {
    const response = await apiFetch(url)
    if (!response.ok) {
      return ''
    }
    return response.text()
  }

  const loadFrames = () => {
    fetchJsonAuth(`${apiBase}/api/frames`)
      .then((data: FrameEntry[]) => {
        setFrames(data)
        if (data.length > 0) {
          const saved = localStorage.getItem('zodiac_editor.frameId')
          if (saved === CHART_ONLY_ID) {
            setSelectedId(saved)
            return
          }
          const exists = saved && data.some((frame) => frame.id === saved)
          setSelectedId(exists ? (saved as string) : data[0].id)
        }
      })
      .catch((err) => setError(String(err)))
  }

  const loadCharts = () => {
    if (!jwt) {
      setCharts([])
      return
    }
    apiFetch(`${apiBase}/api/charts`)
      .then((response) => response.json())
      .then((data: ChartListItem[]) => setCharts(data))
      .catch((err) => setError(String(err)))
  }

  useEffect(() => {
    loadFrames()
  }, [apiBase])

  useEffect(() => {
    if (!jwt) {
      setUser(null)
      setCharts([])
      return
    }
    apiFetch(`${apiBase}/api/auth/me`)
      .then((response) => response.json())
      .then((data: { id: string; email: string; is_admin?: boolean }) => setUser(data))
      .then(() => loadCharts())
      .catch((err) => setError(String(err)))
  }, [apiBase, jwt])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.apiBaseUrl', apiBase)
  }, [apiBase])

  useEffect(() => {
    if (jwt) {
      localStorage.setItem('zodiac_editor.jwt', jwt)
    } else {
      localStorage.removeItem('zodiac_editor.jwt')
    }
  }, [jwt])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.chartId', chartId)
  }, [chartId])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.frameId', selectedId)
  }, [selectedId])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.birthDate', birthDate)
    localStorage.setItem('zodiac_editor.birthTime', birthTime)
    localStorage.setItem('zodiac_editor.latitude', String(latitude))
    localStorage.setItem('zodiac_editor.longitude', String(longitude))
  }, [birthDate, birthTime, latitude, longitude])

  const filteredFrames = useMemo(() => {
    const search = frameSearch.trim().toLowerCase()
    const tag = tagFilter.trim().toLowerCase()
    return frames.filter((frame) => {
      if (search && !frame.name.toLowerCase().includes(search)) {
        return false
      }
      if (tag && !frame.tags.some((entry) => entry.toLowerCase().includes(tag))) {
        return false
      }
      return true
    })
  }, [frames, frameSearch, tagFilter])

  useEffect(() => {
    if (!selectedId) {
      setSelectedFrameDetail(null)
      return
    }
    setError('')
    setStatus('')
    if (isChartOnly) {
      if (!chartId) {
        setSelectedFrameDetail(null)
        setMeta(null)
        setChartSvgBase('')
        setChartFit(defaultChartFit)
        setInitialFit(defaultChartFit)
        setOverrides({})
        setInitialOverrides({})
        return
      }
      const chartMetaUrl = `${apiBase}/api/charts/${chartId}/chart_only/meta`
      const layoutUrl = `${apiBase}/api/charts/${chartId}/layout`
      const svgUrl = `${apiBase}/api/charts/${chartId}/render_chart.svg`
      Promise.all([
        fetchJsonAuth(chartMetaUrl),
        fetchJsonIfOkAuth(layoutUrl),
        fetchTextIfOkAuth(svgUrl),
      ])
        .then(([chartMeta, layoutData, svgText]) => {
          setSelectedFrameDetail(null)
          const metaData = chartMeta as ChartMeta
          setMeta(metaData)
          const fit = {
            dx: metaData.chart_fit?.dx ?? 0,
            dy: metaData.chart_fit?.dy ?? 0,
            scale: metaData.chart_fit?.scale ?? 1,
            rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
          }
          setChartFit(fit)
          setInitialFit(fit)
          const nextOverrides = (layoutData as LayoutFile | null)?.overrides || {}
          setOverrides(nextOverrides)
          setInitialOverrides(nextOverrides)
          const inner = svgText ? extractChartInner(svgText as string) : ''
          setChartSvgBase(stripOverrideTransforms(inner, nextOverrides))
        })
        .catch((err) => setError(String(err)))
      return
    }
    const frameDetailUrl = `${apiBase}/api/frames/${selectedId}`
    const chartMetaUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/frames/${selectedId}/metadata`
      : null
    const layoutUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/frames/${selectedId}/layout`
      : null
    const svgUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/render.svg?frame_id=${selectedId}`
      : null

    Promise.all([
      fetchJsonAuth(frameDetailUrl),
      chartMetaUrl ? fetchJsonIfOkAuth(chartMetaUrl) : Promise.resolve(null),
      layoutUrl ? fetchJsonIfOkAuth(layoutUrl) : Promise.resolve({ overrides: {} }),
      svgUrl ? fetchTextIfOkAuth(svgUrl) : Promise.resolve(''),
      ])
        .then(([frameDetail, chartMeta, layoutData, svgText]) => {
          const detail = frameDetail as FrameDetail
          setSelectedFrameDetail(detail)
          const templateMeta = detail.template_metadata_json
        const metaData = (chartMeta as ChartMeta) || (templateMeta as ChartMeta)
        setMeta(metaData)
        const fit = {
          dx: metaData.chart_fit?.dx ?? 0,
          dy: metaData.chart_fit?.dy ?? 0,
          scale: metaData.chart_fit?.scale ?? 1,
          rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
        }
        setChartFit(fit)
        setInitialFit(fit)
        const nextOverrides = (layoutData as LayoutFile | null)?.overrides || {}
        setOverrides(nextOverrides)
        setInitialOverrides(nextOverrides)
        const inner = svgText ? extractChartInner(svgText as string) : ''
        setChartSvgBase(stripOverrideTransforms(inner, nextOverrides))
      })
      .catch((err) => setError(String(err)))
  }, [apiBase, chartId, selectedId])

  useEffect(() => {
    if (!chartSvgBase) {
      setChartSvg('')
      return
    }
    setChartSvg(applyOverrides(chartSvgBase, overrides, showLabels))
  }, [chartSvgBase, overrides, showLabels])

  useEffect(() => {
    if (!chartRootRef.current || !meta) {
      return
    }
    const { x, y } = meta.chart.center
    const transform = [
      `translate(${chartFit.dx.toFixed(3)} ${chartFit.dy.toFixed(3)})`,
      `translate(${x.toFixed(3)} ${y.toFixed(3)})`,
      `rotate(${chartFit.rotation_deg.toFixed(3)})`,
      `scale(${chartFit.scale.toFixed(6)})`,
      `translate(${-x.toFixed(3)} ${-y.toFixed(3)})`,
    ].join(' ')
    chartRootRef.current.setAttribute('transform', transform)
  }, [chartFit, meta, chartSvg])

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartRootRef.current) {
      return
    }
    const target = event.target as Element | null
    const labelElement = target?.closest('[id]') as Element | null
    const chartElement = target?.closest('#chartRoot') as Element | null

    const point = labelElement && chartRootRef.current
      ? toNodePoint(event, chartRootRef.current)
      : toSvgPoint(event, svgRef.current)
    if (labelElement) {
      const id = labelElement.getAttribute('id') || ''
      if (isDraggableElement(id)) {
        const current = overrides[id] || { dx: 0, dy: 0 }
        setSelectedElement(id)
        setDrag({
          mode: 'label',
          startPoint: point,
          startFit: chartFit,
          labelId: id,
          startOffset: current,
        })
        svgRef.current.setPointerCapture(event.pointerId)
        return
      }
    }

    if (chartElement) {
      const mode = event.shiftKey
        ? 'chart-scale'
        : event.altKey
          ? 'chart-rotate'
          : 'chart-move'
      setSelectedElement('chartRoot')
      setDrag({ mode, startPoint: point, startFit: chartFit })
      svgRef.current.setPointerCapture(event.pointerId)
    }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || !svgRef.current) {
      return
    }
    const point =
      drag.mode === 'label' && chartRootRef.current
        ? toNodePoint(event, chartRootRef.current)
        : toSvgPoint(event, svgRef.current)
    const dx = point.x - drag.startPoint.x
    const dy = point.y - drag.startPoint.y

    if (drag.mode === 'chart-move') {
      setChartFit({
        ...drag.startFit,
        dx: drag.startFit.dx + dx,
        dy: drag.startFit.dy + dy,
      })
      return
    }
    if (drag.mode === 'chart-scale') {
      const nextScale = Math.max(0.1, drag.startFit.scale * (1 + dx / 300))
      setChartFit({ ...drag.startFit, scale: nextScale })
      return
    }
    if (drag.mode === 'chart-rotate') {
      setChartFit({
        ...drag.startFit,
        rotation_deg: drag.startFit.rotation_deg + dx,
      })
      return
    }
    if (drag.mode === 'label' && drag.labelId && drag.startOffset) {
        setOverrides((current) => ({
          ...current,
          [drag.labelId as string]: {
            dx: (drag.startOffset?.dx ?? 0) + dx,
            dy: (drag.startOffset?.dy ?? 0) + dy,
          },
        }))
    }
  }

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) {
      return
    }
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    setDrag(null)
  }

  const handleSaveAll = async () => {
    if (!jwt) {
      setError('Login required to save changes.')
      return
    }
    if (!chartId) {
      setError('Chart ID is required to save changes.')
      return
    }
    if (isChartOnly) {
      const chartFitPayload = {
        dx: round(chartFit.dx),
        dy: round(chartFit.dy),
        scale: round(chartFit.scale),
        rotation_deg: round(chartFit.rotation_deg),
      }
      const layoutPayload = {
        overrides: Object.fromEntries(
          Object.entries(overrides).map(([key, value]) => [
            key,
            normalizeOverride(value),
          ])
        ),
      }
      const fitResponse = await apiFetch(`${apiBase}/api/charts/${chartId}/chart_fit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartFitPayload),
      })
      if (!fitResponse.ok) {
        const detail = await readApiError(fitResponse)
        setError(detail ?? 'Failed to save chart-only fit.')
        setStatus('')
        return
      }
      const layoutResponse = await apiFetch(`${apiBase}/api/charts/${chartId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutPayload),
      })
      if (!layoutResponse.ok) {
        const detail = await readApiError(layoutResponse)
        setError(detail ?? 'Failed to save chart-only layout.')
        setStatus('')
        return
      }
      setError('')
      setStatus('Saved chart-only layout.')
      return
    }
    if (!meta || !selectedId) {
      return
    }
    const metaPayload = {
      ...meta,
      chart_fit: {
        dx: round(chartFit.dx),
        dy: round(chartFit.dy),
        scale: round(chartFit.scale),
        rotation_deg: round(chartFit.rotation_deg),
      },
    }
    const layoutPayload = {
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key,
          normalizeOverride(value),
        ])
      ),
    }
    const metaResponse = await apiFetch(
      `${apiBase}/api/charts/${chartId}/frames/${selectedId}/metadata`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload),
      }
    )
    if (!metaResponse.ok) {
      const detail = await readApiError(metaResponse)
      setError(detail ?? 'Failed to save metadata.')
      setStatus('')
      return
    }
    const layoutResponse = await apiFetch(
      `${apiBase}/api/charts/${chartId}/frames/${selectedId}/layout`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutPayload),
      }
    )
    if (!layoutResponse.ok) {
      const detail = await readApiError(layoutResponse)
      setError(detail ?? 'Failed to save layout.')
      setStatus('')
      return
    }
    setError('')
    setStatus('Saved metadata and layout.')
  }

  const handleAutoFix = async () => {
    if (!jwt) {
      setError('Login required for auto-fix.')
      return
    }
    if (isChartOnly) {
      setError('Auto-fix requires a frame selection.')
      return
    }
    if (!selectedId) {
      setError('Select a frame before auto-fix.')
      return
    }
    if (!chartId) {
      setError('Chart ID is required for auto-fix.')
      return
    }
    const response = await apiFetch(
      `${apiBase}/api/charts/${chartId}/frames/${selectedId}/auto_layout`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'labels', min_gap_px: 10, max_iter: 240 }),
      }
    )
    if (!response.ok) {
      setError('Failed to auto-fix overlaps.')
      setStatus('')
      return
    }
    const data = (await response.json()) as { overrides: Record<string, Offset> }
    setOverrides((current) => ({ ...current, ...data.overrides }))
    setError('')
    setStatus('Auto-fix applied.')
  }

  const handleReset = () => {
    setChartFit(initialFit)
    setOverrides(initialOverrides)
    setSelectedElement('')
    setStatus('')
  }

  const handleCreateChart = async () => {
    if (!jwt) {
      setError('Login required to create charts.')
      return
    }
    if (!selectedId) {
      setError('Select a frame before creating a chart.')
      return
    }
    const payload = {
      name: chartName.trim() || undefined,
      birth_date: birthDate,
      birth_time: birthTime,
      latitude,
      longitude,
      default_frame_id: selectedId === CHART_ONLY_ID ? undefined : selectedId,
    }
    const response = await apiFetch(`${apiBase}/api/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setError('Failed to create chart.')
      setStatus('')
      return
    }
    const data = (await response.json()) as { chart_id: string }
    setChartId(data.chart_id)
    setError('')
    setStatus(`Created chart ${data.chart_id}`)
    loadCharts()
  }

  const handleUploadFrame = async () => {
    if (!jwt) {
      setError('Login required to upload frames.')
      return
    }
    if (!uploadFile) {
      setError('Select an image to upload.')
      return
    }
    if (!uploadName.trim()) {
      setError('Frame name is required.')
      return
    }
    setUploading(true)
    setError('')
    setStatus('Uploading frame...')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadName.trim())
      if (uploadTags.trim()) {
        formData.append('tags', uploadTags.trim())
      }
      if (uploadGlobal && !user?.is_admin) {
        setError('Admin required to publish globally.')
        setStatus('')
        return
      }
      if (uploadGlobal && user?.is_admin) {
        formData.append('global_frame', 'true')
      }
      const response = await apiFetch(`${apiBase}/api/frames`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const detail = await readApiError(response)
        setError(detail ?? 'Failed to upload frame.')
        setStatus('')
        return
      }
      const data = (await response.json()) as { id: string; name: string }
      setStatus(`Uploaded frame ${data.name}`)
      setUploadFile(null)
      setUploadName('')
      setUploadTags('')
      setUploadGlobal(false)
      loadFrames()
      setSelectedId(data.id)
    } finally {
      setUploading(false)
    }
  }

  const handleLogin = async () => {
    setError('')
    setStatus('')
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    })
    if (!response.ok) {
      const detail = await readApiError(response)
      setError(detail ?? 'Login failed.')
      return
    }
    const data = (await response.json()) as {
      token: string
      user: { id: string; email: string; is_admin?: boolean }
    }
    setJwt(data.token)
    setUser(data.user)
    setStatus('Logged in.')
    setAuthPassword('')
  }

  const handleRegister = async () => {
    setError('')
    setStatus('')
    const response = await fetch(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    })
    if (!response.ok) {
      const detail = await readApiError(response)
      setError(detail ?? 'Registration failed.')
      return
    }
    const data = (await response.json()) as {
      token: string
      user: { id: string; email: string; is_admin?: boolean }
    }
    setJwt(data.token)
    setUser(data.user)
    setStatus('Account created.')
    setAuthPassword('')
  }

  const handleLogout = () => {
    setJwt('')
    setUser(null)
    setCharts([])
    setChartId('')
    localStorage.removeItem('zodiac_editor.chartId')
    setStatus('Logged out.')
  }

  const handleSelectChart = async (chartIdToLoad: string) => {
    if (!jwt) {
      setError('Login required to load charts.')
      return
    }
    setError('')
    const response = await apiFetch(`${apiBase}/api/charts/${chartIdToLoad}`)
    if (!response.ok) {
      const detail = await readApiError(response)
      setError(detail ?? 'Failed to load chart.')
      return
    }
    const data = (await response.json()) as ChartDetail
    setChartId(data.chart_id)
    setBirthDate(data.birth_date)
    setBirthTime(data.birth_time)
    setLatitude(data.latitude)
    setLongitude(data.longitude)
    setChartName(data.name ?? '')
    setLatitude(data.latitude)
    setLongitude(data.longitude)
    if (data.default_frame_id && selectedId !== CHART_ONLY_ID) {
      setSelectedId(data.default_frame_id)
    }
  }

  const handleResetSession = () => {
    localStorage.removeItem('zodiac_editor.chartId')
    localStorage.removeItem('zodiac_editor.birthDate')
    localStorage.removeItem('zodiac_editor.birthTime')
    localStorage.removeItem('zodiac_editor.latitude')
    localStorage.removeItem('zodiac_editor.longitude')
    setBirthDate('1990-04-12')
    setBirthTime('08:45')
    setLatitude(40.7128)
    setLongitude(-74.006)
    setChartId('')
    setChartName('')
    setChartFit(defaultChartFit)
    setInitialFit(defaultChartFit)
    setOverrides({})
    setInitialOverrides({})
    setSelectedElement('')
    setStatus('')
    setError('')
  }

  const handleFactoryReset = () => {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('zodiac_editor.'))
      .forEach((key) => localStorage.removeItem(key))
    setApiBase(defaultApiBase)
    setJwt('')
    setUser(null)
    setBirthDate('1990-04-12')
    setBirthTime('08:45')
    setLatitude(40.7128)
    setLongitude(-74.006)
    setChartId('')
    setChartName('')
    setChartFit(defaultChartFit)
    setInitialFit(defaultChartFit)
    setOverrides({})
    setInitialOverrides({})
    setSelectedElement('')
    setStatus('')
    setError('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Frame Alignment + Layout</h1>
        {error ? <div className="error">{error}</div> : null}
        {status ? <div className="status">{status}</div> : null}
        <div className="section">
          <h2>Account</h2>
          {user ? (
            <div className="auth-status">
              <div className="selection">{user.email}</div>
              <button className="secondary" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <>
              <label className="field">
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
              </label>
              <div className="actions">
                <button onClick={handleLogin}>Log in</button>
                <button className="secondary" onClick={handleRegister}>
                  Register
                </button>
              </div>
            </>
          )}
        </div>
        <div className="section">
          <h2>My Charts</h2>
          {charts.length === 0 ? (
            <div className="hint">No charts yet.</div>
          ) : (
            <div className="chart-list">
              {charts.map((chart) => (
                <button
                  key={chart.chart_id}
                  type="button"
                  className={`chart-item ${chart.chart_id === chartId ? 'active' : ''}`}
                  onClick={() => handleSelectChart(chart.chart_id)}
                >
                  <div className="chart-name">{chart.name || chart.chart_id}</div>
                  <div className="chart-meta">{chart.created_at || ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="field">
          Chart ID
          <input
            type="text"
            value={chartId}
            onChange={(event) => setChartId(event.target.value)}
            placeholder="Paste chart id"
          />
        </label>
        <div className="section">
          <h2>Create Chart</h2>
          <label className="field">
            Name
            <input
              type="text"
              value={chartName}
              onChange={(event) => setChartName(event.target.value)}
              placeholder="Chart name"
            />
          </label>
          <label className="field">
            Birth date
            <input
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </label>
          <label className="field">
            Birth time
            <input
              type="time"
              value={birthTime}
              onChange={(event) => setBirthTime(event.target.value)}
            />
          </label>
          <NumberField
            label="Latitude"
            value={latitude}
            step={0.0001}
            onChange={setLatitude}
          />
          <NumberField
            label="Longitude"
            value={longitude}
            step={0.0001}
            onChange={setLongitude}
          />
          <button className="secondary" onClick={handleCreateChart}>
            Create chart
          </button>
          <button
            className="secondary"
            onClick={handleResetSession}
            title="Clears chart ID and birth inputs; resets fit/overrides for this session."
          >
            Reset chart session
          </button>
          <button
            className="secondary"
            onClick={handleFactoryReset}
            title="Clears all editor local storage and restores defaults."
          >
            Factory reset
          </button>
        </div>
        <div className="section">
          <h2>Frames</h2>
          <label className="field">
            Search
            <input
              type="text"
              value={frameSearch}
              onChange={(event) => setFrameSearch(event.target.value)}
              placeholder="Find by name"
            />
          </label>
          <label className="field">
            Tag filter
            <input
              type="text"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="e.g. art"
            />
          </label>
          <div className="frame-grid">
            <button
              type="button"
              className={`frame-card ${isChartOnly ? 'active' : ''} frame-card--chart-only`}
              onClick={() => setSelectedId(CHART_ONLY_ID)}
            >
              <div className="frame-placeholder">Chart only</div>
              <div className="frame-name">Chart only</div>
            </button>
            {filteredFrames.map((frame) => (
              <button
                key={frame.id}
                type="button"
                className={`frame-card ${frame.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(frame.id)}
              >
                <img src={`${apiBase}${frame.thumb_url}`} alt={frame.name} />
                <div className="frame-name">{frame.name}</div>
              </button>
            ))}
            {filteredFrames.length === 0 ? (
              <div className="hint">No frames match the current filters.</div>
            ) : null}
          </div>
        </div>

        <div className="section">
          <h2>Chart Fit</h2>
          <NumberField label="dx" value={chartFit.dx} onChange={(value) =>
            setChartFit((current) => ({ ...current, dx: value }))
          } />
          <NumberField label="dy" value={chartFit.dy} onChange={(value) =>
            setChartFit((current) => ({ ...current, dy: value }))
          } />
          <NumberField label="scale" value={chartFit.scale} step={0.01} onChange={(value) =>
            setChartFit((current) => ({ ...current, scale: value }))
          } />
          <NumberField label="rotation" value={chartFit.rotation_deg} step={0.5} onChange={(value) =>
            setChartFit((current) => ({ ...current, rotation_deg: value }))
          } />
          <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
        </div>

        <div className="section">
          <h2>Upload Frame</h2>
          <label className="field">
            Name
            <input
              type="text"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="Frame name"
            />
          </label>
          <label className="field">
            Tags
            <input
              type="text"
              value={uploadTags}
              onChange={(event) => setUploadTags(event.target.value)}
              placeholder="comma-separated"
            />
          </label>
          <label className="field">
            Image
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {user?.is_admin ? (
            <label className="field checkbox">
              Publish globally
              <input
                type="checkbox"
                checked={uploadGlobal}
                onChange={(event) => setUploadGlobal(event.target.checked)}
              />
            </label>
          ) : null}
          <button className="secondary" onClick={handleUploadFrame} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload frame'}
          </button>
        </div>

        <div className="section">
          <h2>Visibility</h2>
          <label className="field checkbox">
            <span>Show labels</span>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
            />
          </label>
        </div>

        <div className="section">
          <h2>Selection</h2>
          <div className="selection">{selectedElement || 'None'}</div>
        </div>

        <div className="actions">
          <button onClick={handleSaveAll}>Save all</button>
          <button onClick={handleAutoFix}>Auto-fix overlaps</button>
          <button
            onClick={handleReset}
            title="Reverts fit and label overrides to the initial loaded state."
          >
            Reset
          </button>
        </div>
      </aside>

      <main className="canvas">
        {meta ? (
          <svg
            ref={svgRef}
            width={meta.canvas.width}
            height={meta.canvas.height}
            viewBox={`0 0 ${meta.canvas.width} ${meta.canvas.height}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {selectedFrameDetail ? (
              <image
                href={`${apiBase}${selectedFrameDetail.image_url}`}
                x={0}
                y={0}
                width={meta.canvas.width}
                height={meta.canvas.height}
              />
            ) : null}
            <circle
              cx={meta.chart.center.x}
              cy={meta.chart.center.y}
              r={meta.chart.ring_outer}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={2}
            />
            <circle
              cx={meta.chart.center.x}
              cy={meta.chart.center.y}
              r={meta.chart.ring_inner}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={2}
            />
            <g ref={chartRootRef} id="chartRoot">
              <g className="crosshair">
                <line
                  x1={meta.chart.center.x - 20}
                  y1={meta.chart.center.y}
                  x2={meta.chart.center.x + 20}
                  y2={meta.chart.center.y}
                />
                <line
                  x1={meta.chart.center.x}
                  y1={meta.chart.center.y - 20}
                  x2={meta.chart.center.x}
                  y2={meta.chart.center.y + 20}
                />
              </g>
              <g dangerouslySetInnerHTML={{ __html: chartSvg }} />
            </g>
            {!chartId ? (
              <text
                x={meta.chart.center.x}
                y={meta.chart.center.y}
                textAnchor="middle"
                fill="rgba(20, 20, 20, 0.6)"
                fontSize={18}
              >
                Set chart ID to load overlay
              </text>
            ) : null}
          </svg>
        ) : (
          <div className="placeholder">Select a frame to begin.</div>
        )}
      </main>
    </div>
  )
}

function extractChartInner(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const chartRoot = doc.querySelector('#chartRoot')
  if (chartRoot) {
    return chartRoot.innerHTML
  }
  return doc.documentElement.innerHTML
}

function stripOverrideTransforms(svgInner: string, overrides: Record<string, Offset>) {
  if (!svgInner) {
    return svgInner
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`,
    'image/svg+xml'
  )
  const keys = Object.keys(overrides)
  if (keys.length === 0) {
    return svgInner
  }
  keys.forEach((key) => {
    const node = doc.querySelector(`[id="${CSS.escape(key)}"]`)
    if (node) {
      node.removeAttribute('transform')
    }
  })
  return doc.documentElement.innerHTML
}

function applyOverrides(
  svgInner: string,
  overrides: Record<string, Offset>,
  showLabels: boolean
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`,
    'image/svg+xml'
  )
  if (!showLabels) {
    const labelNodes = doc.querySelectorAll('[id$=".label"]')
    labelNodes.forEach((node) => node.remove())
  }
  const nodes = doc.querySelectorAll('[id]')
  nodes.forEach((node) => {
    const id = node.getAttribute('id') || ''
    const override = overrides[id]
    if (!override) {
      return
    }
    const theta = Number(node.getAttribute('data-theta'))
    let dx = override.dx ?? 0
    let dy = override.dy ?? 0
    if ((override.dr !== undefined || override.dt !== undefined) && Number.isFinite(theta)) {
      const offset = polarOffsetToXY(override.dr ?? 0, override.dt ?? 0, theta)
      dx = offset.dx
      dy = offset.dy
    }
    const translate = `translate(${dx.toFixed(3)} ${dy.toFixed(3)})`
    const existing = node.getAttribute('transform')
    node.setAttribute('transform', existing ? `${existing} ${translate}` : translate)
  })
  return doc.documentElement.innerHTML
}

function toSvgPoint(event: PointerEvent, svg: SVGSVGElement) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    return { x: event.clientX, y: event.clientY }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

function toNodePoint(event: PointerEvent, node: SVGGElement) {
  const point = node.ownerSVGElement?.createSVGPoint()
  if (!point) {
    return { x: event.clientX, y: event.clientY }
  }
  point.x = event.clientX
  point.y = event.clientY
  const ctm = node.getScreenCTM()
  if (!ctm) {
    return { x: event.clientX, y: event.clientY }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}

function normalizeOverride(value: Offset) {
  const dx = Number.isFinite(value.dx) ? round(value.dx as number) : 0
  const dy = Number.isFinite(value.dy) ? round(value.dy as number) : 0
  const override: Record<string, number> = { dx, dy }
  if (Number.isFinite(value.dr)) {
    override.dr = round(value.dr as number)
  }
  if (Number.isFinite(value.dt)) {
    override.dt = round(value.dt as number)
  }
  return override
}

async function readApiError(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { detail?: string }
    if (data?.detail) {
      return `Error: ${data.detail}`
    }
  } catch (err) {
    return null
  }
  return null
}

function polarOffsetToXY(dr: number, dt: number, thetaDeg: number) {
  const angle = (Math.PI / 180) * thetaDeg
  return {
    dx: dr * Math.cos(angle) - dt * Math.sin(angle),
    dy: dr * Math.sin(angle) + dt * Math.cos(angle),
  }
}

function isDraggableElement(id: string) {
  return (
    (id.startsWith('planet.') && id.endsWith('.label')) ||
    (id.startsWith('planet.') && id.endsWith('.glyph')) ||
    id.startsWith('sign.') ||
    id === 'asc.marker'
  )
}

export default App
