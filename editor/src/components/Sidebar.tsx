import { useState } from 'react'
import AccountSection from './sidebar/AccountSection'
import ChartsSection from './sidebar/ChartsSection'
import CreateChartSection from './sidebar/CreateChartSection'
import FramesSection from './sidebar/FramesSection'
import UploadFrameSection from './sidebar/UploadFrameSection'
import DebugSection from './sidebar/DebugSection'
import DesignSection from './sidebar/DesignSection'
import type { ChartFit, ChartListItem, DesignSettings, FrameEntry, LayerOrderKey, User } from '../types'

type SidebarProps = {
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
  onClearAccountMessages: () => void
  onClearChartsMessages: () => void
  onClearCreateChartMessages: () => void
  onClearFramesMessages: () => void
  onClearUploadMessages: () => void
  user: User | null
  authEmail: string
  authPassword: string
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: () => void
  onRegister: () => void
  onLogout: () => void
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
  frameSearch: string
  onFrameSearchChange: (value: string) => void
  selectedId: string
  onSelectedIdChange: (value: string) => void
  filteredFrames: FrameEntry[]
  chartOnlyId: string
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
  chartFit: ChartFit
  onChartFitChange: (value: ChartFit) => void
  design: DesignSettings
  onLayerOrderChange: (value: LayerOrderKey[]) => void
  onLayerOpacityChange: (layer: LayerOrderKey, value: number) => void
  backgroundImagePath: string | null
  backgroundImageUrl: string
  backgroundImageError: string
  backgroundImageStatus: string
  backgroundImageUploading: boolean
  onBackgroundImageUpload: (file: File | null) => void
  onBackgroundImageClear: () => void
  backgroundImageScale: number
  backgroundImageDx: number
  backgroundImageDy: number
  onBackgroundImageScaleChange: (value: number) => void
  onBackgroundImageDxChange: (value: number) => void
  onBackgroundImageDyChange: (value: number) => void
  onSignGlyphScaleChange: (value: number) => void
  onPlanetGlyphScaleChange: (value: number) => void
  onInnerRingScaleChange: (value: number) => void
  selectedElement: string
  selectableGroups: { label: string; items: { id: string; label: string }[] }[]
  onSelectedElementChange: (value: string) => void
  selectionColor: string
  selectionColorMixed: boolean
  selectionEnabled: boolean
  onColorChange: (color: string) => void
  onClearColor: () => void
  chartLinesColor: string
  onChartLinesColorChange: (value: string) => void
  onClearChartLinesColor: () => void
  chartBackgroundColor: string
  onChartBackgroundColorChange: (value: string) => void
  onClearChartBackgroundColor: () => void
  radialMoveEnabled: boolean
  onRadialMoveEnabledChange: (value: boolean) => void
  outlineColor: string
  onOutlineColorChange: (value: string) => void
  frameMaskCutoff: number
  onFrameMaskCutoffChange: (value: number) => void
  showFrameCircleDebug: boolean
  onShowFrameCircleDebugChange: (value: boolean) => void
  debugItems: { label: string; value: string }[]
  onSaveAll: () => void
  onExport: () => void
  exportFormat: 'png' | 'svg'
  onExportFormatChange: (value: 'png' | 'svg') => void
  exportEnabled: boolean
  exportDisabledTitle: string
}

function Sidebar({
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
  onClearAccountMessages,
  onClearChartsMessages,
  onClearCreateChartMessages,
  onClearFramesMessages,
  onClearUploadMessages,
  user,
  authEmail,
  authPassword,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLogin,
  onRegister,
  onLogout,
  charts,
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
  frameSearch,
  onFrameSearchChange,
  selectedId,
  onSelectedIdChange,
  filteredFrames,
  chartOnlyId,
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
  chartFit,
  onChartFitChange,
  design,
  onLayerOrderChange,
  onLayerOpacityChange,
  backgroundImagePath,
  backgroundImageUrl,
  backgroundImageError,
  backgroundImageStatus,
  backgroundImageUploading,
  onBackgroundImageUpload,
  onBackgroundImageClear,
  backgroundImageScale,
  backgroundImageDx,
  backgroundImageDy,
  onBackgroundImageScaleChange,
  onBackgroundImageDxChange,
  onBackgroundImageDyChange,
  onSignGlyphScaleChange,
  onPlanetGlyphScaleChange,
  onInnerRingScaleChange,
  selectedElement,
  selectableGroups,
  onSelectedElementChange,
  selectionColor,
  selectionColorMixed,
  selectionEnabled,
  onColorChange,
  onClearColor,
  chartLinesColor,
  onChartLinesColorChange,
  onClearChartLinesColor,
  chartBackgroundColor,
  onChartBackgroundColorChange,
  onClearChartBackgroundColor,
  radialMoveEnabled,
  onRadialMoveEnabledChange,
  outlineColor,
  onOutlineColorChange,
  frameMaskCutoff,
  onFrameMaskCutoffChange,
  showFrameCircleDebug,
  onShowFrameCircleDebugChange,
  debugItems,
  onSaveAll,
  onExport,
  exportFormat,
  onExportFormatChange,
  exportEnabled,
  exportDisabledTitle,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'main' | 'design'>('main')
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
            charts={charts}
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
          <div className="actions">
            <button
              onClick={onSaveAll}
              title="Saves layout + metadata (or chart-only fit) to the server."
            >
              Save changes
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
          <DesignSection
            chartFit={chartFit}
            onChartFitChange={onChartFitChange}
            design={design}
            onLayerOrderChange={onLayerOrderChange}
            onLayerOpacityChange={onLayerOpacityChange}
            backgroundImagePath={backgroundImagePath}
            backgroundImageUrl={backgroundImageUrl}
            backgroundImageError={backgroundImageError}
            backgroundImageStatus={backgroundImageStatus}
            backgroundImageUploading={backgroundImageUploading}
            onBackgroundImageUpload={onBackgroundImageUpload}
            onBackgroundImageClear={onBackgroundImageClear}
            backgroundImageScale={backgroundImageScale}
            backgroundImageDx={backgroundImageDx}
            backgroundImageDy={backgroundImageDy}
            onBackgroundImageScaleChange={onBackgroundImageScaleChange}
            onBackgroundImageDxChange={onBackgroundImageDxChange}
            onBackgroundImageDyChange={onBackgroundImageDyChange}
            onSignGlyphScaleChange={onSignGlyphScaleChange}
            onPlanetGlyphScaleChange={onPlanetGlyphScaleChange}
            onInnerRingScaleChange={onInnerRingScaleChange}
            selectedElement={selectedElement}
            selectableGroups={selectableGroups}
            onSelectedElementChange={onSelectedElementChange}
            selectionColor={selectionColor}
            selectionColorMixed={selectionColorMixed}
            selectionEnabled={selectionEnabled}
            onColorChange={onColorChange}
            onClearColor={onClearColor}
            chartLinesColor={chartLinesColor}
            onChartLinesColorChange={onChartLinesColorChange}
            onClearChartLinesColor={onClearChartLinesColor}
            chartBackgroundColor={chartBackgroundColor}
            onChartBackgroundColorChange={onChartBackgroundColorChange}
            onClearChartBackgroundColor={onClearChartBackgroundColor}
            radialMoveEnabled={radialMoveEnabled}
            onRadialMoveEnabledChange={onRadialMoveEnabledChange}
            outlineColor={outlineColor}
            onOutlineColorChange={onOutlineColorChange}
            frameMaskCutoff={frameMaskCutoff}
            onFrameMaskCutoffChange={onFrameMaskCutoffChange}
          />
        </>
      )}
    </aside>
  )
}

export default Sidebar
