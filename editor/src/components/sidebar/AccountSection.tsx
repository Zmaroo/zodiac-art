import CollapsibleSection from '../CollapsibleSection'
import type { User } from '../../types'

type AccountSectionProps = {
  user: User | null
  authEmail: string
  authPassword: string
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: () => void
  onRegister: () => void
  onLogout: () => void
  onClearMessages: () => void
}

function AccountSection({
  user,
  authEmail,
  authPassword,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLogin,
  onRegister,
  onLogout,
  onClearMessages,
}: AccountSectionProps) {
  return (
    <CollapsibleSection title="Account" persistKey="account" onToggle={onClearMessages}>
      {user ? (
        <div className="auth-status">
          <div className="selection">{user.email}</div>
          <button className="secondary" onClick={onLogout}>
            Log out
          </button>
        </div>
      ) : (
        <>
          <label className="field" htmlFor="auth-email">
            Email
            <input
              type="email"
              id="auth-email"
              name="auth-email"
              value={authEmail}
              onChange={(event) => onAuthEmailChange(event.target.value)}
            />
          </label>
          <label className="field" htmlFor="auth-password">
            Password
            <input
              type="password"
              id="auth-password"
              name="auth-password"
              value={authPassword}
              onChange={(event) => onAuthPasswordChange(event.target.value)}
            />
          </label>
          <div className="actions">
            <button onClick={onLogin}>Log in</button>
            <button className="secondary" onClick={onRegister}>
              Register
            </button>
          </div>
        </>
      )}
    </CollapsibleSection>
  )
}

export default AccountSection
