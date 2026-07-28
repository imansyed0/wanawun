export const Colors = {
  // Kashmir-inspired palette — "Dal Lake Morning"
  // Soft, misty tones: muted lake green + dawn blue + warm saffron accent.
  primary: '#6E9285',       // Muted lake green (Dal Lake at dawn)
  primaryLight: '#8EAEA2',  // Misty reed green
  primaryDark: '#547568',   // Pine forest shadow
  secondary: '#C89B6A',     // Soft saffron / dawn gold
  secondaryLight: '#DBB68C', // Pale saffron
  accent: '#8FA3B2',        // Dawn blue (sky on the lake)
  accentLight: '#B0BFCB',   // Light dawn blue

  // Walnut wood tones (Kashmiri woodcraft) — softened
  walnut: '#6B5A4A',        // Soft walnut
  walnutLight: '#9B8976',   // Aged walnut

  // Game colors
  correct: '#6E9285',       // Lake green
  wrong: '#B86159',         // Muted chinar red (not harsh)
  timer: '#C89B6A',         // Saffron
  streak: '#D9B469',        // Soft pashmina gold

  // Neutral — misty ivory tones
  background: '#F5F3EC',    // Misty ivory (morning mist on the lake)
  surface: '#FFFFFF',
  surfaceLight: '#EFECE2',  // Warm off-white
  surfaceWarm: '#E7E4D8',   // Stone/hairline for tab bars and chips
  text: '#2F3A35',          // Deep pine
  textSecondary: '#5A645F', // Muted forest
  textLight: '#7D8882',     // Faded reed
  border: '#E4E1D4',        // Soft stone border

  // Dark mode — deep misty lake at dusk
  dark: {
    background: '#1F2A2D',
    surface: '#283639',
    surfaceLight: '#324349',
    text: '#E8E6DE',
    textSecondary: '#A8B0AA',
    border: '#3A4A4F',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  title: 40,
};

// Font families — Space Grotesk for body/UI, Rozha One for headings/display,
// and Amiri (Perso-Arabic Naskh-style serif) for rendering Kashmiri word text.
export const FontFamily = {
  body: 'SpaceGrotesk_400Regular',
  bodySemi: 'SpaceGrotesk_500Medium',
  bodyBold: 'SpaceGrotesk_700Bold',
  bodyHeavy: 'SpaceGrotesk_700Bold',
  heading: 'RozhaOne_400Regular',
  headingBold: 'RozhaOne_400Regular',
  display: 'RozhaOne_400Regular',
  kashmiri: 'Amiri_700Bold',
  kashmiriRegular: 'Amiri_400Regular',
};

// Minimum line-height multipliers, taken from each family's own metrics.
// Text set tighter than these gets its ascenders and descenders clipped by the
// line box. It matters most for Kashmiri: Amiri reports a natural line height
// of 1.76em, and vowelled Kashmiri actually inks 1.16em above the baseline and
// 0.58em below it, so anything under ~1.75em cuts off the vowel diacritics —
// the marks that tell the reader which word it is.
const LineHeightRatio = {
  body: 1.35,      // Space Grotesk: 1.275 natural
  heading: 1.45,   // Rozha One: 1.42 natural
  kashmiri: 1.85,  // Amiri: 1.76 natural, 1.74 of ink for vowelled Kashmiri
};

export const LineHeight = {
  body: (fontSize: number) => Math.round(fontSize * LineHeightRatio.body),
  heading: (fontSize: number) => Math.round(fontSize * LineHeightRatio.heading),
  kashmiri: (fontSize: number) => Math.round(fontSize * LineHeightRatio.kashmiri),
};

// The tab bar's own content height, before the bottom safe-area inset is added.
// Anything that has to float clear of the tab bar reads it from here.
export const TabBarContentHeight = 60;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
