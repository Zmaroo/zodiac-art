import { useEffect, useState } from 'react'
import { Undo2, Redo2, Save, Download, SlidersHorizontal, Settings, ShoppingBag } from 'lucide-react'
import AccountSection from './sidebar/AccountSection'
import ChartsSection from './sidebar/ChartsSection'
import CreateChartSection from './sidebar/CreateChartSection'
import FramesSection from './sidebar/FramesSection'
import UploadFrameSection from './sidebar/UploadFrameSection'
import DebugSection from './sidebar/DebugSection'
import DesignSection, { type DesignSectionProps } from './sidebar/DesignSection'
import PrintSection, { type PrintSectionProps } from './sidebar/PrintSection'
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
    onCreateChart: (payload?: {
      birthDate: string
      birthTime: string
      latitude: number
      longitude: number
    }) => void
    onDeleteChart: (chartIdToDelete: string) => void
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
    selectedFrameSizeLabel: string
    onDeleteFrame: (frameIdToDelete: string) => void
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
    isDirty?: boolean
    onUndo: () => void
    onRedo: () => void
    canUndo: boolean
    canRedo: boolean
    onExport: () => void
    exportFormat: 'png' | 'svg'
    onExportFormatChange: (value: 'png' | 'svg') => void
    exportEnabled: boolean
    exportDisabledTitle: string
  }
  draftPrompt: {
    visible: boolean
    onRestore: () => void
    onDiscard: () => void
  }
  debug: {
    debugItems: { label: string; value: string }[]
    showFrameCircleDebug: boolean
    onShowFrameCircleDebugChange: (value: boolean) => void
  }
  shop: PrintSectionProps
}

function Sidebar({ messages, clears, account, charts, frames, upload, design, actions, draftPrompt, debug, shop }: SidebarProps) {
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
    onDeleteChart,
    onResetSession,
    onFactoryReset,
    onResetView,
    onAutoFit,
    onResetToSavedFit,
    resetToSavedEnabled,
    autoFitEnabled,
  } = charts
  const {
    frameSearch,
    onFrameSearchChange,
    selectedId,
    onSelectedIdChange,
    filteredFrames,
    chartOnlyId,
    selectedFrameSizeLabel,
    onDeleteFrame,
  } = frames
  const {
    uploadName,
    uploadTags,
    uploadGlobal,
    uploading,
    onUploadNameChange,
    onUploadTagsChange,
    onUploadFileChange,
    onUploadGlobalChange,
    onUploadFrame,
  } = upload
  const {
    onSaveAll,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    isDirty,
    onExport,
    exportFormat,
    onExportFormatChange,
    exportEnabled,
    exportDisabledTitle,
  } = actions
  const {
    visible: draftPromptVisible,
    onRestore: onDraftRestore,
    onDiscard: onDraftDiscard,
  } = draftPrompt
  const { debugItems, showFrameCircleDebug, onShowFrameCircleDebugChange } = debug
  const [activeTab, setActiveTab] = useState<'main' | 'design' | 'print'>(() => {
    const stored = localStorage.getItem('zodiac_editor.sidebarTab')
    return (stored === 'design' || stored === 'print') ? stored : 'main'
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
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Settings size={16} /> Main
        </button>
        <button
          className={activeTab === 'design' ? 'active' : ''}
          onClick={() => setActiveTab('design')}
          type="button"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <SlidersHorizontal size={16} /> Design
        </button>
        <button
          className={activeTab === 'print' ? 'active' : ''}
          onClick={() => setActiveTab('print')}
          type="button"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <ShoppingBag size={16} /> Print
        </button>
      </div>
      {draftPromptVisible ? (
        <div className="draft-prompt">
          <div className="draft-prompt-title">Unsaved local changes found.</div>
          <div className="draft-prompt-actions">
            <button type="button" onClick={onDraftRestore}>
              Restore draft
            </button>
            <button type="button" className="secondary" onClick={onDraftDiscard}>
              Discard draft
            </button>
          </div>
        </div>
      ) : null}
      <div className="toolbar-actions">
        <div className="actions">
          <div className="undo-row">
            <button type="button" className="secondary" onClick={onUndo} disabled={!canUndo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Undo2 size={16} /> Undo
            </button>
            <button type="button" className="secondary" onClick={onRedo} disabled={!canRedo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Redo2 size={16} /> Redo
            </button>
          </div>
          <button className={isDirty ? 'primary-action' : 'secondary'} onClick={onSaveAll} title="Saves layout + metadata (or chart-only fit) to the server." style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Save size={16} /> Save changes
          </button>
          <div className="export-row">
            <select
              name="export-format"
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Download size={16} /> Download
            </button>
          </div>
          {actionsError ? <div className="inline-error">{actionsError}</div> : null}
          {actionsStatus ? <div className="inline-status">{actionsStatus}</div> : null}
          {(draftStatus || syncStatus) && (
            <div className="sync-status">
              {draftStatus ? <div>{draftStatus}</div> : null}
              {syncStatus ? <div>{syncStatus}</div> : null}
            </div>
          )}
        </div>
      </div>
      {activeTab === 'main' && (
        <div className="sidebar-sections-wrapper">
          <div className="sections">
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
              onDeleteChart={onDeleteChart}
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
              selectedFrameSizeLabel={selectedFrameSizeLabel}
              onDeleteFrame={onDeleteFrame}
              onClearMessages={onClearFramesMessages}
            />
            {framesError ? <div className="inline-error">{framesError}</div> : null}
            {framesStatus ? <div className="inline-status">{framesStatus}</div> : null}

            <UploadFrameSection
              uploadName={uploadName}
              uploadTags={uploadTags}
              uploadGlobal={uploadGlobal}
              uploading={uploading}
              onUploadNameChange={onUploadNameChange}
              onUploadTagsChange={onUploadTagsChange}
              onUploadFileChange={onUploadFileChange}
              onUploadGlobalChange={onUploadGlobalChange}
              onUploadFrame={onUploadFrame}
              onClearMessages={onClearUploadMessages}
              userIsAdmin={upload.userIsAdmin}
            />
            {uploadError ? <div className="inline-error">{uploadError}</div> : null}
            {uploadStatus ? <div className="inline-status">{uploadStatus}</div> : null}

            {import.meta.env.DEV ? (
              <DebugSection
                debugItems={debugItems}
                showFrameCircle={showFrameCircleDebug}
                onShowFrameCircleChange={onShowFrameCircleDebugChange}
              />
            ) : null}
          </div>
        </div>
      )}

      {activeTab === 'design' && (
        <div className="sidebar-sections-wrapper">
          <div className="sections">
            <DesignSection {...design.sectionProps} />
          </div>
        </div>
      )}

      {activeTab === 'print' && (
        <div className="sidebar-sections-wrapper">
          <div className="sections">
            <PrintSection {...shop} />
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
