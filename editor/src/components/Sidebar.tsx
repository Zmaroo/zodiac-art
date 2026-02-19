import AccountSection from './sidebar/AccountSection'
import ChartsSection from './sidebar/ChartsSection'
import CreateChartSection from './sidebar/CreateChartSection'
import FramesSection from './sidebar/FramesSection'
import UploadFrameSection from './sidebar/UploadFrameSection'
import DebugSection from './sidebar/DebugSection'
import SelectionSection from './sidebar/SelectionSection'
import type { ChartListItem, FrameEntry, User } from '../types'

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
  selectedElement: string
  selectableGroups: { label: string; items: { id: string; label: string }[] }[]
  onSelectedElementChange: (value: string) => void
  selectionColor: string
  selectionColorMixed: boolean
  selectionEnabled: boolean
  onColorChange: (color: string) => void
  onClearColor: () => void
  showFrameCircleDebug: boolean
  onShowFrameCircleDebugChange: (value: boolean) => void
  autoFitEnabled: boolean
  onAutoFit: () => void
  onResetToSavedFit: () => void
  resetToSavedEnabled: boolean
  debugItems: { label: string; value: string }[]
  onSaveAll: () => void
  onAutoFix: () => void
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
  selectedElement,
  selectableGroups,
  onSelectedElementChange,
  selectionColor,
  selectionColorMixed,
  selectionEnabled,
  onColorChange,
  onClearColor,
  showFrameCircleDebug,
  onShowFrameCircleDebugChange,
  autoFitEnabled,
  onAutoFit,
  onResetToSavedFit,
  resetToSavedEnabled,
  debugItems,
  onSaveAll,
  onAutoFix,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>Frame Alignment + Layout</h1>
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
      <SelectionSection
        selectedElement={selectedElement}
        selectableGroups={selectableGroups}
        onSelectedElementChange={onSelectedElementChange}
        selectionColor={selectionColor}
        selectionColorMixed={selectionColorMixed}
        selectionEnabled={selectionEnabled}
        onColorChange={onColorChange}
        onClearColor={onClearColor}
      />
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
        <button className="secondary" onClick={onAutoFit} disabled={!autoFitEnabled}>
          Re-auto-fit
        </button>
        <button
          className="secondary"
          onClick={onResetToSavedFit}
          disabled={!resetToSavedEnabled}
          title={resetToSavedEnabled ? '' : 'No saved fit available yet.'}
        >
          Reset to saved fit
        </button>
        <button onClick={onSaveAll}>Save all</button>
        <button onClick={onAutoFix}>Auto-fix overlaps</button>
      </div>
    </aside>
  )
}

export default Sidebar
