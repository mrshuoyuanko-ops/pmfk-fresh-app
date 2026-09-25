export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function insideSafeZone(userLat: number, userLon: number, hubLat: number, hubLon: number, radiusM = 50): boolean {
  return haversineMeters(userLat, userLon, hubLat, hubLon) <= radiusM
}
