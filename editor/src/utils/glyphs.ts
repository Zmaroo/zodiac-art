const PLANET_GLYPHS: Record<string, string> = {
  sun: '☉',
  moon: '☾',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
}

const SIGN_GLYPHS: Record<string, string> = {
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
}

export function formatSelectionLabel(id: string): string {
  if (id === 'chartRoot') {
    return 'Chart'
  }
  if (id === 'chart.background') {
    return 'Chart background'
  }
  if (id === 'chart.background_image') {
    return 'Background image'
  }
  if (id === 'asc.marker') {
    return 'Ascendant marker ↑'
  }
  if (id.startsWith('planet.')) {
    const parts = id.split('.')
    const name = parts[1] || 'Planet'
    const subtype = parts[2]
    const glyph = PLANET_GLYPHS[name.toLowerCase()]
    if (subtype === 'glyph') {
      return glyph ? `Planet ${name} glyph ${glyph}` : `Planet ${name} glyph`
    }
    if (subtype === 'label') {
      return `Planet ${name} label`
    }
    return glyph ? `Planet ${name} ${glyph}` : `Planet ${name}`
  }
  if (id.startsWith('sign.')) {
    const parts = id.split('.')
    const name = parts[1] || 'Sign'
    const glyph = SIGN_GLYPHS[name.toLowerCase()]
    return glyph ? `Sign ${name} ${glyph}` : `Sign ${name}`
  }
  return id
}
