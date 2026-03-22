import { createContext, useContext, useState, useEffect } from 'react';

// Color palette
// space_indigo:   #2b2d42 (100–900: #08090d → #ced0df)
// lavender_grey:  #8d99ae (100–900: #1a1e25 → #e8ebef)
// platinum:       #edf2f4 (100–900: #24353b → #fbfcfd)
// punch_red:      #ef233c (100–900: #330409 → #fcd3d8)
// classic_crimson:#d80032 (100–900: #2b000a → #ffc4d2)

// eslint-disable-next-line react-refresh/only-export-components
export const GENRES = {
  default: {
    label: 'Default',
    emoji: '✨',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 40%, #08090d 100%)',
    orbs: [
      { color: '#ef233c', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#8d99ae', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#d80032', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#ef233c',
    primaryGlow: 'rgba(239,35,60,0.35)',
    accent: '#8d99ae',
    navBg: 'rgba(8,9,13,0.92)',
    navBorder: 'rgba(239,35,60,0.25)',
    cardBg: 'rgba(17,18,26,0.80)',
    cardBorder: 'rgba(141,153,174,0.20)',
    fieldBg: 'rgba(239,35,60,0.08)',
    fieldBorder: 'rgba(141,153,174,0.22)',
    labelColor: 'rgba(237,242,244,0.70)',
    textMuted: 'rgba(141,153,174,0.75)',
    textBody: 'rgba(206,208,223,0.90)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #8d99ae, #ef233c)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #8d99ae 50%, #ef233c 100%)',
    buttonGradient: 'linear-gradient(135deg, #d80032, #ef233c, #f25063)',
    buttonHover: 'linear-gradient(135deg, #ab0028, #d80032, #ef233c)',
    configBorderGradient: 'linear-gradient(135deg, rgba(239,35,60,0.5), rgba(141,153,174,0.3), rgba(216,0,50,0.3))',
    fontFamily: 'inherit',
    description: 'Crimson and steel on deep indigo nights',
  },
  noir: {
    label: 'Noir / Crime',
    emoji: '🕵️',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 40%, #191b27 100%)',
    orbs: [
      { color: '#4a4d72', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#1a1e25', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#343c4a', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#8d99ae',
    primaryGlow: 'rgba(141,153,174,0.30)',
    accent: '#ef233c',
    navBg: 'rgba(8,9,13,0.95)',
    navBorder: 'rgba(141,153,174,0.15)',
    cardBg: 'rgba(11,12,18,0.88)',
    cardBorder: 'rgba(141,153,174,0.18)',
    fieldBg: 'rgba(141,153,174,0.05)',
    fieldBorder: 'rgba(141,153,174,0.15)',
    labelColor: 'rgba(206,208,223,0.60)',
    textMuted: 'rgba(141,153,174,0.50)',
    textBody: 'rgba(187,194,207,0.60)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #8d99ae, #ef233c)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #ced0df 50%, #ef233c 100%)',
    buttonGradient: 'linear-gradient(135deg, #191b27, #2b2d42, #11121a)',
    buttonHover: 'linear-gradient(135deg, #11121a, #191b27, #08090d)',
    configBorderGradient: 'linear-gradient(135deg, rgba(141,153,174,0.4), rgba(239,35,60,0.2), rgba(74,77,114,0.3))',
    fontFamily: '"Georgia", serif',
    description: 'Dark, gritty shadows and cold steel',
  },
  fantasy: {
    label: 'Fantasy / Magic',
    emoji: '🧙',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 35%, #191b27 70%, #08090d 100%)',
    orbs: [
      { color: '#6d71a0', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#ef233c', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#8d99ae', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#9da0bf',
    primaryGlow: 'rgba(157,160,191,0.35)',
    accent: '#ef233c',
    navBg: 'rgba(8,9,13,0.90)',
    navBorder: 'rgba(157,160,191,0.20)',
    cardBg: 'rgba(17,18,26,0.78)',
    cardBorder: 'rgba(157,160,191,0.22)',
    fieldBg: 'rgba(157,160,191,0.07)',
    fieldBorder: 'rgba(157,160,191,0.20)',
    labelColor: 'rgba(206,208,223,0.72)',
    textMuted: 'rgba(157,160,191,0.55)',
    textBody: 'rgba(206,208,223,0.68)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #9da0bf, #ef233c)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #9da0bf 50%, #ef233c 100%)',
    buttonGradient: 'linear-gradient(135deg, #2b2d42, #4a4d72, #d80032)',
    buttonHover: 'linear-gradient(135deg, #191b27, #2b2d42, #ab0028)',
    configBorderGradient: 'linear-gradient(135deg, rgba(157,160,191,0.5), rgba(239,35,60,0.3), rgba(109,113,160,0.4))',
    fontFamily: '"Palatino Linotype", "Palatino", serif',
    description: 'Enchanted dusk and ancient arcane power',
  },
  cyberpunk: {
    label: 'Cyberpunk / Sci-Fi',
    emoji: '🤖',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 40%, #08090d 100%)',
    orbs: [
      { color: '#ef233c', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#4a4d72', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#d80032', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#ef233c',
    primaryGlow: 'rgba(239,35,60,0.40)',
    accent: '#6d71a0',
    navBg: 'rgba(8,9,13,0.95)',
    navBorder: 'rgba(239,35,60,0.22)',
    cardBg: 'rgba(8,9,13,0.85)',
    cardBorder: 'rgba(239,35,60,0.25)',
    fieldBg: 'rgba(239,35,60,0.07)',
    fieldBorder: 'rgba(239,35,60,0.20)',
    labelColor: 'rgba(237,242,244,0.70)',
    textMuted: 'rgba(157,160,191,0.55)',
    textBody: 'rgba(206,208,223,0.65)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #ef233c, #6d71a0)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #ef233c 50%, #6d71a0 100%)',
    buttonGradient: 'linear-gradient(135deg, #ab0028, #ef233c, #4a4d72)',
    buttonHover: 'linear-gradient(135deg, #81001e, #d80032, #2b2d42)',
    configBorderGradient: 'linear-gradient(135deg, rgba(239,35,60,0.5), rgba(109,113,160,0.3), rgba(216,0,50,0.4))',
    fontFamily: '"Courier New", monospace',
    description: 'Neon crimson grids in chrome catacombs',
  },
  romance: {
    label: 'Romance / Drama',
    emoji: '💕',
    bg: 'linear-gradient(135deg, #11121a 0%, #191b27 40%, #11121a 100%)',
    orbs: [
      { color: '#ef233c', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#9da0bf', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#d80032', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#ef233c',
    primaryGlow: 'rgba(239,35,60,0.38)',
    accent: '#9da0bf',
    navBg: 'rgba(17,18,26,0.90)',
    navBorder: 'rgba(239,35,60,0.22)',
    cardBg: 'rgba(17,18,26,0.80)',
    cardBorder: 'rgba(239,35,60,0.22)',
    fieldBg: 'rgba(239,35,60,0.07)',
    fieldBorder: 'rgba(239,35,60,0.20)',
    labelColor: 'rgba(252,211,216,0.72)',
    textMuted: 'rgba(157,160,191,0.55)',
    textBody: 'rgba(206,208,223,0.68)',
    logoGradient: 'linear-gradient(90deg, #fcd3d8, #ef233c, #9da0bf)',
    titleGradient: 'linear-gradient(135deg, #fcd3d8 0%, #ef233c 50%, #9da0bf 100%)',
    buttonGradient: 'linear-gradient(135deg, #9a0c1c, #ef233c, #6d71a0)',
    buttonHover: 'linear-gradient(135deg, #660813, #d80032, #4a4d72)',
    configBorderGradient: 'linear-gradient(135deg, rgba(239,35,60,0.5), rgba(157,160,191,0.3), rgba(216,0,50,0.4))',
    fontFamily: '"Garamond", "Georgia", serif',
    description: 'Heartfelt passion on twilight horizons',
  },
  horror: {
    label: 'Horror / Gothic',
    emoji: '💀',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 40%, #08090d 100%)',
    orbs: [
      { color: '#330409', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#191b27', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#660813', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#d80032',
    primaryGlow: 'rgba(216,0,50,0.30)',
    accent: '#4a4d72',
    navBg: 'rgba(8,9,13,0.98)',
    navBorder: 'rgba(216,0,50,0.15)',
    cardBg: 'rgba(8,9,13,0.90)',
    cardBorder: 'rgba(216,0,50,0.18)',
    fieldBg: 'rgba(216,0,50,0.05)',
    fieldBorder: 'rgba(216,0,50,0.15)',
    labelColor: 'rgba(252,168,177,0.60)',
    textMuted: 'rgba(141,153,174,0.40)',
    textBody: 'rgba(206,208,223,0.50)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #f57c8a, #4a4d72)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #ef233c 50%, #2b2d42 100%)',
    buttonGradient: 'linear-gradient(135deg, #2b000a, #560014, #08090d)',
    buttonHover: 'linear-gradient(135deg, #1a0008, #330409, #08090d)',
    configBorderGradient: 'linear-gradient(135deg, rgba(216,0,50,0.4), rgba(74,77,114,0.2), rgba(102,8,19,0.35))',
    fontFamily: '"Palatino Linotype", serif',
    description: 'Shadows lurk where crimson dares not fade',
  },
  anime: {
    label: 'Anime / Manga',
    emoji: '🌸',
    bg: 'linear-gradient(135deg, #11121a 0%, #191b27 40%, #11121a 100%)',
    orbs: [
      { color: '#ef233c', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#6d71a0', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#9da0bf', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#f25063',
    primaryGlow: 'rgba(242,80,99,0.38)',
    accent: '#6d71a0',
    navBg: 'rgba(17,18,26,0.90)',
    navBorder: 'rgba(242,80,99,0.22)',
    cardBg: 'rgba(17,18,26,0.80)',
    cardBorder: 'rgba(242,80,99,0.22)',
    fieldBg: 'rgba(242,80,99,0.07)',
    fieldBorder: 'rgba(242,80,99,0.20)',
    labelColor: 'rgba(252,211,216,0.72)',
    textMuted: 'rgba(157,160,191,0.55)',
    textBody: 'rgba(206,208,223,0.65)',
    logoGradient: 'linear-gradient(90deg, #fcd3d8, #f25063, #6d71a0)',
    titleGradient: 'linear-gradient(135deg, #fcd3d8 0%, #f25063 50%, #6d71a0 100%)',
    buttonGradient: 'linear-gradient(135deg, #9a0c1c, #f25063, #4a4d72)',
    buttonHover: 'linear-gradient(135deg, #660813, #ef233c, #2b2d42)',
    configBorderGradient: 'linear-gradient(135deg, rgba(242,80,99,0.5), rgba(109,113,160,0.3), rgba(157,160,191,0.3))',
    fontFamily: 'inherit',
    description: 'Vibrant cel-shaded drama in indigo ink',
  },
  adventure: {
    label: 'Adventure / Action',
    emoji: '⚔️',
    bg: 'linear-gradient(135deg, #08090d 0%, #11121a 40%, #191b27 100%)',
    orbs: [
      { color: '#ef233c', size: 500, top: '-10%',  left: '-5%', opacity: 0.15 },
      { color: '#d80032', size: 700, bottom: '-10%',             opacity: 0.12 },
      { color: '#6d71a0', size: 900, top: '30%',   left: '60%', right: '-10%', opacity: 0.09 },
    ],
    primary: '#ef233c',
    primaryGlow: 'rgba(239,35,60,0.40)',
    accent: '#d80032',
    navBg: 'rgba(8,9,13,0.92)',
    navBorder: 'rgba(239,35,60,0.22)',
    cardBg: 'rgba(17,18,26,0.80)',
    cardBorder: 'rgba(239,35,60,0.25)',
    fieldBg: 'rgba(239,35,60,0.07)',
    fieldBorder: 'rgba(239,35,60,0.20)',
    labelColor: 'rgba(252,211,216,0.72)',
    textMuted: 'rgba(157,160,191,0.55)',
    textBody: 'rgba(237,242,244,0.68)',
    logoGradient: 'linear-gradient(90deg, #edf2f4, #ef233c, #d80032)',
    titleGradient: 'linear-gradient(135deg, #edf2f4 0%, #ef233c 50%, #d80032 100%)',
    buttonGradient: 'linear-gradient(135deg, #9a0c1c, #ef233c, #d80032)',
    buttonHover: 'linear-gradient(135deg, #660813, #d80032, #81001e)',
    configBorderGradient: 'linear-gradient(135deg, rgba(239,35,60,0.5), rgba(216,0,50,0.3), rgba(109,113,160,0.3))',
    fontFamily: 'inherit',
    description: 'Bold quests and heroic crimson clashes',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [genreKey, setGenreKey] = useState(() => {
    return localStorage.getItem('cf_genre') || 'default';
  });

  useEffect(() => {
    localStorage.setItem('cf_genre', genreKey);
  }, [genreKey]);

  const theme = GENRES[genreKey] || GENRES.default;

  return (
    <ThemeContext.Provider value={{ theme, genreKey, setGenreKey, GENRES }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
