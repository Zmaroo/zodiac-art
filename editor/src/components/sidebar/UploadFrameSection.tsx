import CollapsibleSection from '../CollapsibleSection'

type UploadFrameSectionProps = {
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
  onClearMessages: () => void
}

function UploadFrameSection({
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
  onClearMessages,
}: UploadFrameSectionProps) {
  return (
    <CollapsibleSection title="Upload Frame" persistKey="upload-frame" onToggle={onClearMessages}>
      <label className="field">
        Name
        <input
          type="text"
          value={uploadName}
          onChange={(event) => onUploadNameChange(event.target.value)}
          placeholder="Frame name"
        />
      </label>
      <label className="field">
        Tags
        <input
          type="text"
          value={uploadTags}
          onChange={(event) => onUploadTagsChange(event.target.value)}
          placeholder="comma-separated"
        />
      </label>
      <label className="field">
        Image
        <input
          type="file"
          accept="image/*"
          onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {userIsAdmin ? (
        <label className="field checkbox">
          Publish globally
          <input
            type="checkbox"
            checked={uploadGlobal}
            onChange={(event) => onUploadGlobalChange(event.target.checked)}
          />
        </label>
      ) : null}
      <button className="secondary" onClick={onUploadFrame} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload frame'}
      </button>
    </CollapsibleSection>
  )
}

export default UploadFrameSection
