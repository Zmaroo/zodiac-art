import { useEffect, useState } from 'react'
import AccountSection from './sidebar/AccountSection'
import ChartsSection from './sidebar/ChartsSection'
import CreateChartSection from './sidebar/CreateChartSection'
import FramesSection from './sidebar/FramesSection'
import UploadFrameSection from './sidebar/UploadFrameSection'
import DebugSection from './sidebar/DebugSection'
import DesignSection, { type DesignSectionProps } from './sidebar/DesignSection'
import type { ChartListItem, FrameEntry, User } from '../types'

export type SidebarProps = {
  messages: {
    accountError: string
    accountStatus: string
    chartsError: string
    chartsStatus: string
    createChartError: string
    createChartStatus: string
    framesError: string
    framesStatus: string
    uploadError: string
    uploadStatus: string
    actionsError: string
    actionsStatus: string
    draftStatus: string
    syncStatus: string
  }
  clears: {
    onClearAccountMessages: () => void
    onClearChartsMessages: () => void
    onClearCreateChartMessages: () => void
    onClearFramesMessages: () => void
    onClearUploadMessages: () => void
  }
  account: {
    user: User | null
    authEmail: string
    authPassword: string
    onAuthEmailChange: (value: string) => void
    onAuthPasswordChange: (value: string) => void
    onLogin: () => void
    onRegister: () => void
    onLogout: () => void
  }
  charts: {
    charts: ChartListItem[]
    chartId: string
    onSelectChart: (chartId: string) => void
    onChartIdChange: (value: string) => void
    chartName: string
    birthDate: string
    birthTime: string
    latitude: number
    longitude: number
    onChartNameChange: (value: string) => void
    onBirthDateChange: (value: string) => void
    onBirthTimeChange: (value: string) => void
    onLatitudeChange: (value: number) => void
    onLongitudeChange: (value: number) => void
    onCreateChart: () => void
    onResetSession: () => void
    onFactoryReset: () => void
    onResetView: () => void
    onAutoFit: () => void
    onResetToSavedFit: () => void
    resetToSavedEnabled: boolean
    autoFitEnabled: boolean
  }
  frames: {
    frameSearch: string
    onFrameSearchChange: (value: string) => void
    selectedId: string
    onSelectedIdChange: (value: string) => void
    filteredFrames: FrameEntry[]
    chartOnlyId: string
  }
  upload: {
    uploadName: string
    uploadTags: string
    uploadGlobal: boolean
    uploading: boolean
    userIsAdmin: boolean
    onUploadNameChange: (value: string) => void
    onUploadTagsChange: (value: string) => void
    onUploadFileChange: (file: File | null) => void
    onUploadGlobalChange: (value: boolean) => void
    onUploadFrame: () => void
  }
  design: {
    sectionProps: DesignSectionProps
  }
  actions: {
    onSaveAll: () => void
    onUndo: () => void
    onRedo: () => void
    canUndo: boolean
    canRedo: boolean
    onSyncNow: () => void
    syncEnabled: boolean
    syncInFlight: boolean
    onExport: () => void
    exportFormat: 'png' | 'svg'
    onExportFormatChange: (value: 'png' | 'svg') => void
    exportEnabled: boolean
    exportDisabledTitle: string
  }
  debug: {
    debugItems: { label: string; value: string }[]
    showFrameCircleDebug: boolean
    onShowFrameCircleDebugChange: (value: boolean) => void
  }
}

function Sidebar({ messages, clears, account, charts, frames, upload, design, actions, debug }: SidebarProps) {
  const {
    accountError,
    accountStatus,
    chartsError,
    chartsStatus,
    createChartError,
    createChartStatus,
    framesError,
    framesStatus,
    uploadError,
    uploadStatus,
    actionsError,
    actionsStatus,
    draftStatus,
    syncStatus,
  } = messages
  const {
    onClearAccountMessages,
    onClearChartsMessages,
    onClearCreateChartMessages,
    onClearFramesMessages,
    onClearUploadMessages,
  } = clears
  const {
    user,
    authEmail,
    authPassword,
    onAuthEmailChange,
    onAuthPasswordChange,
    onLogin,
    onRegister,
    onLogout,
  } = account
  const {
    charts: chartItems,
    chartId,
    onSelectChart,
    onChartIdChange,
    chartName,
    birthDate,
    birthTime,
    latitude,
    longitude,
    onChartNameChange,
    onBirthDateChange,
    onBirthTimeChange,
    onLatitudeChange,
    onLongitudeChange,
    onCreateChart,
    onResetSession,
    onFactoryReset,
    onResetView,
    onAutoFit,
    onResetToSavedFit,
    resetToSavedEnabled,
    autoFitEnabled,
  } = charts
  const { frameSearch, onFrameSearchChange, selectedId, onSelectedIdChange, filteredFrames, chartOnlyId } = frames
  const {
    uploadName,
    uploadTags,
    uploadGlobal,
    uploading,
    userIsAdmin,
    onUploadNameChange,
    onUploadTagsChange,
    onUploadFileChange,
    onUploadGlobalChange,
    onUploadFrame,
  } = upload
  const { sectionProps } = design
  const {
    onSaveAll,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onSyncNow,
    syncEnabled,
    syncInFlight,
    onExport,
    exportFormat,
    onExportFormatChange,
    exportEnabled,
    exportDisabledTitle,
  } = actions
  const { debugItems, showFrameCircleDebug, onShowFrameCircleDebugChange } = debug
  const [activeTab, setActiveTab] = useState<'main' | 'design'>(() => {
    const stored = localStorage.getItem('zodiac_editor.sidebarTab')
    return stored === 'design' ? 'design' : 'main'
  })

  useEffect(() => {
    localStorage.setItem('zodiac_editor.sidebarTab', activeTab)
  }, [activeTab])
  return (
    <aside className="sidebar">
      <h1>Frame Alignment + Layout</h1>
      <div className="sidebar-tabs">
        <button
          className={activeTab === 'main' ? 'active' : ''}
          onClick={() => setActiveTab('main')}
          type="button"
        >
          Main
        </button>
        <button
          className={activeTab === 'design' ? 'active' : ''}
          onClick={() => setActiveTab('design')}
          type="button"
        >
          Design
        </button>
      </div>
      {activeTab === 'main' ? (
        <>
          <AccountSection
            user={user}
            authEmail={authEmail}
            authPassword={authPassword}
            onAuthEmailChange={onAuthEmailChange}
            onAuthPasswordChange={onAuthPasswordChange}
            onLogin={onLogin}
            onRegister={onRegister}
            onLogout={onLogout}
            onClearMessages={onClearAccountMessages}
          />
          {accountError ? <div className="inline-error">{accountError}</div> : null}
          {accountStatus ? <div className="inline-status">{accountStatus}</div> : null}
          <ChartsSection
            charts={chartItems}
            chartId={chartId}
            onSelectChart={onSelectChart}
            onChartIdChange={onChartIdChange}
            onClearMessages={onClearChartsMessages}
          />
          {chartsError ? <div className="inline-error">{chartsError}</div> : null}
          {chartsStatus ? <div className="inline-status">{chartsStatus}</div> : null}
          <CreateChartSection
            chartName={chartName}
            birthDate={birthDate}
            birthTime={birthTime}
            latitude={latitude}
            longitude={longitude}
            onChartNameChange={onChartNameChange}
            onBirthDateChange={onBirthDateChange}
            onBirthTimeChange={onBirthTimeChange}
            onLatitudeChange={onLatitudeChange}
            onLongitudeChange={onLongitudeChange}
            onCreateChart={onCreateChart}
            onResetSession={onResetSession}
            onFactoryReset={onFactoryReset}
            onResetView={onResetView}
            onAutoFit={onAutoFit}
            onResetToSavedFit={onResetToSavedFit}
            autoFitEnabled={autoFitEnabled}
            resetToSavedEnabled={resetToSavedEnabled}
            onClearMessages={onClearCreateChartMessages}
          />
          {createChartError ? <div className="inline-error">{createChartError}</div> : null}
          {createChartStatus ? <div className="inline-status">{createChartStatus}</div> : null}
          <FramesSection
            frameSearch={frameSearch}
            onFrameSearchChange={onFrameSearchChange}
            selectedId={selectedId}
            onSelectedIdChange={onSelectedIdChange}
            filteredFrames={filteredFrames}
            chartOnlyId={chartOnlyId}
            onClearMessages={onClearFramesMessages}
          />
          {framesError ? <div className="inline-error">{framesError}</div> : null}
          {framesStatus ? <div className="inline-status">{framesStatus}</div> : null}
          <UploadFrameSection
            uploadName={uploadName}
            uploadTags={uploadTags}
            uploadGlobal={uploadGlobal}
            uploading={uploading}
            userIsAdmin={userIsAdmin}
            onUploadNameChange={onUploadNameChange}
            onUploadTagsChange={onUploadTagsChange}
            onUploadFileChange={onUploadFileChange}
            onUploadGlobalChange={onUploadGlobalChange}
            onUploadFrame={onUploadFrame}
            onClearMessages={onClearUploadMessages}
          />
          {uploadError ? <div className="inline-error">{uploadError}</div> : null}
          {uploadStatus ? <div className="inline-status">{uploadStatus}</div> : null}
          {import.meta.env.DEV ? (
            <DebugSection
              showFrameCircle={showFrameCircleDebug}
              onShowFrameCircleChange={onShowFrameCircleDebugChange}
              debugItems={debugItems}
            />
          ) : null}
          {actionsError ? <div className="inline-error">{actionsError}</div> : null}
          {actionsStatus ? <div className="inline-status">{actionsStatus}</div> : null}
          {(draftStatus || syncStatus) && (
            <div className="sync-status">
              {draftStatus ? <div>{draftStatus}</div> : null}
              {syncStatus ? <div>{syncStatus}</div> : null}
            </div>
          )}
          <div className="actions">
            <div className="undo-row">
              <button type="button" className="secondary" onClick={onUndo} disabled={!canUndo}>
                Undo
              </button>
              <button type="button" className="secondary" onClick={onRedo} disabled={!canRedo}>
                Redo
              </button>
            </div>
            <button
              onClick={onSaveAll}
              title="Saves layout + metadata (or chart-only fit) to the server."
            >
              Save changes
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onSyncNow}
              disabled={!syncEnabled || syncInFlight}
            >
              {syncInFlight ? 'Syncing...' : 'Sync now'}
            </button>
            <div className="export-row">
              <select
                value={exportFormat}
                onChange={(event) => onExportFormatChange(event.target.value as 'png' | 'svg')}
                disabled={!exportEnabled}
                aria-label="Export format"
              >
                <option value="png">Download PNG</option>
                <option value="svg">Download SVG</option>
              </select>
              <button
                className="secondary"
                onClick={onExport}
                disabled={!exportEnabled}
                title={exportDisabledTitle}
              >
                Download
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <DesignSection {...sectionProps} />
        </>
      )}
    </aside>
  )
}

export default Sidebar
