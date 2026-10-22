import { SITE_NAME } from '../site-config'

export const Logo = () => <img src="/branding/logo.svg" alt={SITE_NAME} width={168} height={32} />

// Outside the dashboard, the icon is the only content of the link to the
// dashboard, so its alt text names that link.
export const Icon = () => <img src="/branding/icon.svg" alt={SITE_NAME} width={32} height={32} />
