export const demoEnabled = import.meta.env.DEV && import.meta.env.MODE === 'rabbitj-demo' &&
  typeof window !== 'undefined' && ['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)

export const demoRole = () => {
  if (!demoEnabled) return 'guest'
  const role = sessionStorage.getItem('rabbitj.demo.role')
  return role === 'administrator' || role === 'user' ? role : 'guest'
}

export const demoScenario = () => demoEnabled ? sessionStorage.getItem('rabbitj.demo.scenario') || 'normal' : 'normal'
