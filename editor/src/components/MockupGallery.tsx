import { useEffect, useState } from 'react'
import type { PrintSectionProps } from './sidebar/PrintSection'
import type { Blueprint } from '../hooks/useShopStore'
import { ImageOff } from 'lucide-react'

type MockupGalleryProps = {
    shop: PrintSectionProps
}

export default function MockupGallery({ shop }: MockupGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    const selectedBlueprint = shop.blueprints.find((bp: Blueprint) => bp.id === shop.selectedBlueprintId)

    // Auto-select the first image when blueprint changes
    useEffect(() => {
        if (selectedBlueprint?.images && selectedBlueprint.images.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedImage(selectedBlueprint.images[0])
        } else {
            setSelectedImage(null)
        }
    }, [selectedBlueprint])

    if (!selectedBlueprint) {
        return (
            <div className="canvas-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', color: '#666' }}>
                <ImageOff size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <h2 style={{ margin: 0, fontWeight: 500 }}>No Product Selected</h2>
                <p style={{ marginTop: '8px' }}>Select a product from the sidebar to view mockups.</p>
            </div>
        )
    }

    const { images } = selectedBlueprint

    return (
        <div className="canvas-container" style={{ backgroundColor: '#f0f0f0', display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Main large display */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    aspectRatio: '1',
                    width: '100%',
                    position: 'relative'
                }}>
                    {selectedImage ? (
                        <img
                            src={selectedImage}
                            alt={selectedBlueprint.title}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            loading="lazy"
                        />
                    ) : (
                        <div style={{ color: '#aaa' }}>No mockups available</div>
                    )}

                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        right: '16px',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '0.85em',
                        fontWeight: 500,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                    }}>
                        Product Preview
                    </div>
                </div>

                {/* Thumbnails */}
                {images && images.length > 1 && (
                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {images.map((imgUrl: string, index: number) => (
                            <button
                                key={index}
                                onClick={() => setSelectedImage(imgUrl)}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    flexShrink: 0,
                                    border: selectedImage === imgUrl ? '2px solid #3b82f6' : '2px solid transparent',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    padding: 0,
                                    cursor: 'pointer',
                                    backgroundColor: 'white',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <img
                                    src={imgUrl}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    loading="lazy"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
