import { CheckCircle2 } from 'lucide-react'

export default function CheckoutSuccess() {
    const handleReturn = () => {
        // Clear the query string and reload the page
        window.location.href = window.location.pathname
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            zIndex: 9999,
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '48px',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                textAlign: 'center',
                maxWidth: '480px',
                width: '100%',
            }}>
                <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 24px' }} />
                <h1 style={{ margin: '0 0 16px', fontSize: '24px', color: '#0f172a' }}>
                    Order Confirmed!
                </h1>
                <p style={{ margin: '0 0 32px', color: '#64748b', lineHeight: 1.6 }}>
                    Thank you for your purchase. We've received your order and are preparing your custom Zodiac art for fulfillment. You'll receive a confirmation email shortly.
                </p>
                <button
                    onClick={handleReturn}
                    className="primary-action"
                    style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 500 }}
                >
                    Return to Editor
                </button>
            </div>
        </div>
    )
}
