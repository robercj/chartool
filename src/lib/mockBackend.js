const MOCK_MODE = true;

export const mockAnalyzeReferenceImage = async (imageUrl) => {
  await new Promise((r) => setTimeout(r, 800));
  return {
    consistencyPrompt:
      "A pixel art character with teal hair, blue eyes, light skin, round face, small nose, rosy cheeks, wearing a white shirt with a small heart emblem.",
    identityLock: {
      baseDescription:
        "A pixel art character with teal hair, blue eyes, light skin, round face, small nose, rosy cheeks, wearing a white shirt with a small heart emblem.",
      style: "pixel art, 16-bit, sprite sheet friendly",
      hairColor: "teal",
      eyeColor: "blue",
      skinTone: "light",
      hairStyle: "medium-length, slightly messy",
      outfit: "white shirt with small heart emblem",
      distinctiveFeatures: ["small nose", "rosy cheeks", "round face"],
      accessories: [],
      colorPalette: {
        primary: "teal (#2dd4bf)",
        secondary: "blue (#60a5fa)",
        accent: "white (#ffffff)",
        skin: "light (#fcd9b6)",
      },
    },
  };
};

export const mockGenerateSprites = async (prompt, seed) => {
  await new Promise((r) => setTimeout(r, 1500));
  return {
    imageUrl: `https://picsum.photos/seed/${seed || Math.floor(Math.random() * 99999)}/512/512`,
    seed: seed || Math.floor(Math.random() * 999999),
  };
};

export const mockImageEdit = async (originalUrl, maskUrl, prompt, seed) => {
  await new Promise((r) => setTimeout(r, 2000));
  return {
    imageUrl: `https://picsum.photos/seed/${seed || Math.floor(Math.random() * 99999)}/512/512?blur=2`,
    seed: seed || Math.floor(Math.random() * 999999),
  };
};
