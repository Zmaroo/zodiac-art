import type { PrintSectionProps } from './sidebar/PrintSection'
import type { CanvasProps } from './Canvas'
import Canvas from './Canvas'
import MockupGallery from './MockupGallery'
import { ImageOff } from 'lucide-react'

type MockupPlacementCanvasProps = {
    shop: PrintSectionProps
    canvasProps: CanvasProps
}

export default function MockupPlacementCanvas({ shop, canvasProps }: MockupPlacementCanvasProps) {
    const variantId = shop.selectedVariantId

    // If they haven't picked a variant yet (sizes, colors, etc), fall back to the gallery
    if (!variantId) {
        return <MockupGallery shop={shop} />
    }

    // @ts-ignore - variants is any or specific type without placeholders? Let's treat it safely.
    const variant = shop.variants.find((v: any) => v.id === variantId)
    const placeholder = variant?.placeholders?.[0]
    const selectedBlueprint = shop.blueprints.find((bp: any) => bp.id === shop.selectedBlueprintId)
    const bgImage = selectedBlueprint?.images?.[0]

    // If no placeholders from the API, we can't show a bounding box accurately.
    if (!placeholder) {
        return (
            <div className="canvas-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', color: '#666' }}>
                <ImageOff size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h2 style={{ margin: 0, fontWeight: 500 }}>No Print Area Defined</h2>
                <p style={{ marginTop: '8px' }}>This specific product variant does not define a printable area.</p>
            </div>
        )
    }

    const printWidth = placeholder.width || 2000
    const printHeight = placeholder.height || 2000
    const aspectRatio = printWidth / printHeight

    // Scale controls the size of the chart relative to the bounding box.
    // X, Y control the center of the chart relative to the bounding box.
    const scale = shop.mockupScale || 1.0
    const posX = shop.mockupX ?? 0.5
    const posY = shop.mockupY ?? 0.5

    // Ensure the bounding box fits nicely on screen
    const MAXX = 500
    const MAXY = 450
    let boxWidth = MAXX
    let boxHeight = boxWidth / aspectRatio

    if (boxHeight > MAXY) {
        boxHeight = MAXY
        boxWidth = boxHeight * aspectRatio
    }

    return (
        <div className="canvas-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0', padding: '24px', overflowY: 'auto' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', paddingBottom: '32px' }}>
                {/* The main printable area bounds */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: `${boxWidth}px`,
                    aspectRatio: aspectRatio,
                    backgroundColor: 'white',
                    backgroundImage: bgImage ? `url(${bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: '2px dashed #94a3b8',
                    borderRadius: '8px'
                }}>
                    {/* The Chart Container */}
                    <div style={{
                        position: 'absolute',
                        left: `${posX * 100}%`,
                        top: `${posY * 100}%`,
                        width: `${scale * 100}%`,
                        height: `${scale * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none', // Ignore pointer events so you can't accidentally pan the SVG instead of using sliders
                        transition: 'all 0.1s ease-out'
                    }} className="mockup-canvas-wrapper">
                        <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                            <Canvas {...canvasProps} />
                        </div>
                    </div>

                    <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        color: '#475569',
                        fontWeight: 500,
                        pointerEvents: 'none'
                    }}>
                        Printable Area Boundary
                    </div>
                </div>
            </div>

            {/* Sizing Controls */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.2rem', color: '#1e293b' }}>Adjust Print Placement</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
                            <span>Size (Scale)</span>
                            <span>{(scale * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1" max="2.0" step="0.01"
                            value={scale}
                            onChange={e => shop.setMockupScale?.(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
                            <span>Horizontal Position (X)</span>
                            <span>{(posX * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1.0" step="0.01"
                            value={posX}
                            onChange={e => shop.setMockupX?.(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>
                            <span>Vertical Position (Y)</span>
                            <span>{(posY * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1.0" step="0.01"
                            value={posY}
                            onChange={e => shop.setMockupY?.(parseFloat(e.target.value))}
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </label>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '24px', textAlign: 'center' }}>
                    Ensure your design fits perfectly inside the dashed border before checking out.
                </p>
            </div>
        </div>
    )
}
