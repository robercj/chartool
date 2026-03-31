// ─── ART_STYLES.js ───────────────────────────────────────────────────────────
// 19 art style presets across 4 categories for the sprite generation workflow.
// Each style includes:
//   - id:         unique identifier used in generation params
//   - label:      human-readable display name
//   - desc:       short description shown in the UI tooltip
//   - nanoPrompt: prompt fragment optimized for fal.ai nano-banana-2
//
// Categories: Anime & Manga, Manhwa / Light Novel, Western Comics, VN / Game
//
// Used by: ArtStyleSelector component, GenerateSprites page, promptCompiler
// ─────────────────────────────────────────────────────────────────────────────
export const ART_STYLES = [
  {
    category: 'Anime & Manga',
    options: [
      {
        id: 'shonen',
        label: 'Shōnen Anime',
        desc: 'Bold lines, vibrant, energetic shading',
        nanoPrompt: 'shōnen anime style with bold black linework, vibrant saturated colors, dynamic cell shading, action-oriented composition with sharp angles and dramatic impact',
      },
      {
        id: 'shoujo',
        label: 'Shōjo Anime',
        desc: 'Soft pastels, sparkly eyes, delicate linework',
        nanoPrompt: 'shōjo manga style with delicate fine linework, soft pastel color palette, sparkly expressive eyes with star highlights, ethereal glowing effects and gentle bokeh',
      },
      {
        id: 'seinen',
        label: 'Seinen Anime',
        desc: 'Detailed, mature, gritty realism',
        nanoPrompt: 'seinen anime style with detailed realistic proportions, muted earthy color palette, complex shading with subtle gradients, mature character design',
      },
      {
        id: 'josei',
        label: 'Josei Anime',
        desc: 'Elegant, refined, subtle palette',
        nanoPrompt: 'josei anime style with elegant refined linework, sophisticated subtle color palette, delicate skin textures, mature fashion-forward character design',
      },
      {
        id: 'dark_fantasy_anime',
        label: 'Dark Fantasy Anime',
        desc: 'High-contrast, dramatic lighting',
        nanoPrompt: 'dark fantasy anime style with high contrast dramatic lighting, deep shadows, gothic aesthetics, mystical atmospheric effects with rich jewel tones',
      },
      {
        id: 'retro_80s',
        label: 'Retro 80s Anime',
        desc: 'Cel-shading, limited palette, vintage',
        nanoPrompt: 'retro 80s anime style with cel-shaded rendering, limited color palette, vintage aesthetic, bright neon accents, classic anime film grain',
      },
      {
        id: 'mecha',
        label: 'Mecha Anime',
        desc: 'Sharp geometry, metallic sheen, sci-fi proportions',
        nanoPrompt: 'mecha anime style with sharp geometric mechanical designs, metallic sheen and chrome highlights, intricate panel lines, sci-fi proportions and engineering detail',
      },
    ],
  },
  {
    category: 'Manhwa & Light Novel',
    options: [
      {
        id: 'manhwa',
        label: 'Korean Manhwa',
        desc: 'Crisp linework, full color, elongated proportions',
        nanoPrompt: 'Korean manhwa style with crisp clean linework, full vibrant color rendering, elongated elegant proportions, glossy premium illustration quality',
      },
      {
        id: 'isekai_ln',
        label: 'Isekai Light Novel',
        desc: 'Soft gradients, glossy shading, fantasy palette',
        nanoPrompt: 'isekai light novel illustration style with soft smooth gradients, glossy cel-shading, magical fantasy color palette with ethereal glowing effects',
      },
      {
        id: 'manhua',
        label: 'Chinese Manhua',
        desc: 'Flowing robes, wuxia aesthetic, ink-influenced',
        nanoPrompt: 'Chinese manhua style with flowing traditional robes, wuxia martial arts aesthetic, ink wash influenced linework with dramatic brush strokes',
      },
      {
        id: 'ln_cover',
        label: 'Light Novel Cover',
        desc: 'Polished anime CG, dynamic poses, vibrant cover art',
        nanoPrompt: 'polished light novel cover art with high-quality anime CG rendering, dynamic action pose, vibrant saturated colors, dramatic marketing illustration style',
      },
      {
        id: 'graphic_noir',
        label: 'Graphic Novel Noir',
        desc: 'High contrast, deep shadows, muted palette',
        nanoPrompt: 'graphic noir style with high contrast lighting, deep absolute shadows, muted desaturated color palette, dramatic film noir atmosphere',
      },
    ],
  },
  {
    category: 'Western Comics',
    options: [
      {
        id: 'western_comic',
        label: 'Western Comic Book',
        desc: 'Heavy inks, halftone dots, heroic proportions',
        nanoPrompt: 'western comic book style with heavy bold ink work, halftone dot screening patterns, heroic heroic proportions, classic american superhero aesthetic',
      },
      {
        id: 'indie_comic',
        label: 'Indie Comic',
        desc: 'Expressive loose inks, hand-crafted texture',
        nanoPrompt: 'indie comic style with expressive loose ink strokes, hand-crafted organic texture, alternative comic aesthetic with raw authentic illustration',
      },
      {
        id: 'bd',
        label: 'Bande Dessinée',
        desc: 'European album style, clean color fills',
        nanoPrompt: 'bande dessinée European comic style with clean precise linework, smooth color fills, ligne claire clear illustration, sophisticated narrative art',
      },
    ],
  },
  {
    category: 'Visual Novel & Game',
    options: [
      {
        id: 'vn_cg',
        label: 'Visual Novel CG',
        desc: 'Clean anime lineart, soft cell shading, glossy',
        nanoPrompt: 'visual novel computer graphics style with clean crisp anime lineart, soft cell shading, glossy skin highlights, premium game CG rendering',
      },
      {
        id: 'pixel_16bit',
        label: 'Pixel Art 16-bit',
        desc: 'SNES-era pixels, limited palette, dithering',
        nanoPrompt: '16-bit pixel art style with SNES-era pixel grid, limited color palette with deliberate dithering, retro game sprite aesthetic',
      },
      {
        id: 'fantasy_card',
        label: 'Fantasy Card Art',
        desc: 'Hyper-detailed anime illustration, dramatic lighting',
        nanoPrompt: 'hyper-detailed fantasy card illustration with intricate ornate details, dramatic cinematic lighting, collectible card game premium art quality',
      },
      {
        id: 'gacha',
        label: 'Gacha Game Art',
        desc: 'Sparkly over-designed outfits, high-saturation anime',
        nanoPrompt: 'gacha game style with sparkly high-saturation colors, over-designed elaborate outfits with excessive accessories, flashy anime illustration',
      },
    ],
  },
];

export function getArtStyleById(id) {
  for (const category of ART_STYLES) {
    const found = category.options.find(opt => opt.id === id);
    if (found) return found;
  }
  return null;
}

export function getAllArtStyleIds() {
  return ART_STYLES.flatMap(c => c.options).map(o => o.id);
}
