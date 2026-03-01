import CollapsibleSection from '../CollapsibleSection'
import type { Blueprint, PrintProvider, ProductVariant } from '../../hooks/useShopStore'

export type PrintSectionProps = {
    blueprints: Blueprint[]
    providers: PrintProvider[]
    variants: ProductVariant[]
    loading: boolean
    error: string
    selectedBlueprintId: number | null
    selectedProviderId: number | null
    selectedVariantId: number | null
    onSelectBlueprint: (id: number) => void
    onSelectProvider: (id: number) => void
    onSelectVariant: (id: number) => void
    onCheckout: () => void
    mockupScale: number
    mockupX: number
    mockupY: number
    setMockupScale: (scale: number) => void
    setMockupX: (x: number) => void
    setMockupY: (y: number) => void
}

function PrintSection({
    blueprints,
    providers,
    variants,
    loading,
    error,
    selectedBlueprintId,
    selectedProviderId,
    selectedVariantId,
    onSelectBlueprint,
    onSelectProvider,
    onSelectVariant,
    onCheckout,
}: PrintSectionProps) {
    return (
        <>
            <CollapsibleSection title="Print & Shop" persistKey="print-shop">
                <div className="description" style={{ marginBottom: '16px', fontSize: '0.9em', opacity: 0.8 }}>
                    Turn your custom zodiac chart into a beautiful physical print.
                </div>

                {error && <div className="error-message">{error}</div>}
                {loading && <div className="status-message">Loading catalog...</div>}

                <label className="field" htmlFor="blueprint-select">
                    Select Product
                    <select
                        id="blueprint-select"
                        value={selectedBlueprintId || ''}
                        onChange={(e) => onSelectBlueprint(Number(e.target.value))}
                        disabled={loading || blueprints.length === 0}
                    >
                        <option value="">-- Choose a Product --</option>
                        {blueprints.map((bp) => (
                            <option key={bp.id} value={bp.id}>
                                {bp.title}
                            </option>
                        ))}
                    </select>
                </label>

                {providers.length > 0 && (
                    <label className="field" htmlFor="provider-select">
                        Select Print Provider
                        <select
                            id="provider-select"
                            value={selectedProviderId || ''}
                            onChange={(e) => onSelectProvider(Number(e.target.value))}
                            disabled={loading}
                        >
                            <option value="">-- Choose a Provider --</option>
                            {providers.map((provider) => (
                                <option key={provider.id} value={provider.id}>
                                    {provider.title}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {variants.length > 0 && (
                    <label className="field" htmlFor="variant-select">
                        Select Variant
                        <select
                            id="variant-select"
                            value={selectedVariantId || ''}
                            onChange={(e) => onSelectVariant(Number(e.target.value))}
                            disabled={loading}
                        >
                            <option value="">-- Choose a Size / Color --</option>
                            {variants.map((variant) => (
                                <option key={variant.id} value={variant.id}>
                                    {variant.title}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <div className="actions" style={{ marginTop: '24px' }}>
                    <button
                        className="primary-action"
                        onClick={onCheckout}
                        disabled={loading || !selectedBlueprintId || !selectedProviderId || !selectedVariantId}
                        style={{ width: '100%', padding: '12px' }}
                    >
                        Proceed to Checkout
                    </button>
                </div>
            </CollapsibleSection>
        </>
    )
}

export default PrintSection
