const ADMIN_PHONES = (import.meta.env.VITE_ADMIN_PHONES || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

function userTelephone(userInfo: any) {
  return String(
    userInfo?.data?.bodyMessage?.telephone ||
      userInfo?.bodyMessage?.telephone ||
      ''
  ).trim()
}

export function isAdmin(userInfo: any) {
  return Boolean(
    userInfo?.role === 'administrator' ||
      userInfo?.data?.bodyMessage?.is_staff ||
      userInfo?.bodyMessage?.is_staff ||
      ADMIN_PHONES.includes(userTelephone(userInfo))
  )
}
