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
      <label className="field" htmlFor="upload-frame-name">
        Name
        <input
          type="text"
          id="upload-frame-name"
          name="upload-frame-name"
          value={uploadName}
          onChange={(event) => onUploadNameChange(event.target.value)}
          placeholder="Frame name"
        />
      </label>
      <label className="field" htmlFor="upload-frame-tags">
        Tags
        <input
          type="text"
          id="upload-frame-tags"
          name="upload-frame-tags"
          value={uploadTags}
          onChange={(event) => onUploadTagsChange(event.target.value)}
          placeholder="comma-separated"
        />
      </label>
      <label className="field" htmlFor="upload-frame-image">
        Image
        <input
          type="file"
          id="upload-frame-image"
          name="upload-frame-image"
          accept="image/*"
          onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {userIsAdmin ? (
        <label className="field checkbox" htmlFor="upload-frame-publish">
          Publish globally
          <input
            type="checkbox"
            id="upload-frame-publish"
            name="upload-frame-publish"
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
