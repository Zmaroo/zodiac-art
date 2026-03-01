import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export type Blueprint = {
    id: number
    title: string
    description: string
    images: string[]
}

export type PrintProvider = {
    id: number
    title: string
}

export type PrintAreaPlaceholder = {
    position: string
    width: number
    height: number
}

export type ProductVariant = {
    id: number
    title: string
    placeholders?: PrintAreaPlaceholder[]
}

export function useShopStore(chartId: string | null) {
    const [blueprints, setBlueprints] = useState<Blueprint[]>([])
    const [providers, setProviders] = useState<PrintProvider[]>([])
    const [variants, setVariants] = useState<ProductVariant[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [selectedBlueprintId, setSelectedBlueprintId] = useState<number | null>(null)
    const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null)
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
    const [mockupScale, setMockupScale] = useState(1.0)
    const [mockupX, setMockupX] = useState(0.5)
    const [mockupY, setMockupY] = useState(0.5)

    useEffect(() => {
        // Fetch blueprints on mount
        const fetchBlueprints = async () => {
            setLoading(true)
            try {
                const response = await fetch(`${API_BASE}/shop/blueprints`)
                if (!response.ok) throw new Error('Failed to fetch catalog')
                const data = await response.json()
                setBlueprints(Array.isArray(data) ? data : data.data || [])
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError(String(err))
                }
            } finally {
                setLoading(false)
            }
        }
        fetchBlueprints()
    }, [])

    useEffect(() => {
        if (!selectedBlueprintId) {
            setProviders([])
            setSelectedProviderId(null)
            setVariants([])
            setSelectedVariantId(null)
            return
        }
        const fetchProviders = async () => {
            setLoading(true)
            try {
                const response = await fetch(`${API_BASE}/shop/blueprints/${selectedBlueprintId}/providers`)
                if (!response.ok) throw new Error('Failed to fetch providers')
                const data = await response.json()
                setProviders(Array.isArray(data) ? data : data.data || [])
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError(String(err))
                }
            } finally {
                setLoading(false)
            }
        }
        fetchProviders()
    }, [selectedBlueprintId])

    useEffect(() => {
        if (!selectedBlueprintId || !selectedProviderId) {
            setVariants([])
            setSelectedVariantId(null)
            return
        }
        const fetchVariants = async () => {
            setLoading(true)
            try {
                const response = await fetch(`${API_BASE}/shop/blueprints/${selectedBlueprintId}/providers/${selectedProviderId}/variants`)
                if (!response.ok) throw new Error('Failed to fetch variants')
                const data = await response.json()
                setVariants(data.variants || data.data || [])
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message)
                } else {
                    setError(String(err))
                }
            } finally {
                setLoading(false)
            }
        }
        fetchVariants()
    }, [selectedBlueprintId, selectedProviderId])

    const onSelectBlueprint = (id: number) => {
        setSelectedBlueprintId(id)
    }

    const onSelectProvider = (id: number) => {
        setSelectedProviderId(id)
    }

    const onSelectVariant = (id: number) => {
        setSelectedVariantId(id)
    }

    const onCheckout = async () => {
        if (!selectedBlueprintId || !selectedProviderId || !selectedVariantId) return
        setLoading(true)
        try {
            const finalChartId = chartId || 'pending_save'
            // Stub checkout action
            const response = await fetch(`${API_BASE}/shop/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_name: "Custom Zodiac Art",
                    amount_cents: 2500,
                    success_url: window.location.href.split('?')[0] + '?success=true',
                    cancel_url: window.location.href.split('?')[0],
                    metadata: {
                        chartId: finalChartId,
                        blueprintId: selectedBlueprintId.toString(),
                        variantId: selectedVariantId.toString(),
                        scale: mockupScale.toString(),
                        x: mockupX.toString(),
                        y: mockupY.toString(),
                    }
                })
            })
            if (!response.ok) throw new Error('Checkout failed')
            const data = await response.json()
            if (data.checkout_url) {
                window.location.href = data.checkout_url
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError(String(err))
            }
        } finally {
            setLoading(false)
        }
    }

    return {
        blueprints,
        providers,
        variants,
        loading,
        error,
        selectedBlueprintId,
        selectedProviderId,
        selectedVariantId,
        mockupScale,
        mockupX,
        mockupY,
        setMockupScale,
        setMockupX,
        setMockupY,
        onSelectBlueprint,
        onSelectProvider,
        onSelectVariant,
        onCheckout,
    }
}
