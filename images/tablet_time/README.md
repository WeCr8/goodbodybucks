# Tablet Time Menu Images

## Folder Structure

Images are stored in: `public/images/tablet_time/`

## Image Naming Convention

Images should match the `id` field from the screen packages menu data:
- Format: `{item_id}.jpg` or `{item_id}.png`
- Examples:
  - `tab10.jpg` for item with id `"tab10"`
  - `tab20.jpg` for item with id `"tab20"`
  - `game15.jpg` for item with id `"game15"`

## Current Screen Packages

Based on `DEFAULT_SCREEN_PACKAGES` in `app.py`:

### Tablet Packages
- `tab10` - Tablet 10 min
- `tab20` - Tablet 20 min
- `tab30` - Tablet 30 min
- `tab45` - Tablet 45 min
- `tab60` - Tablet 60 min

### Game Packages
- `game15` - Game 15 min
- `game30` - Game 30 min
- `game45` - Game 45 min
- `game60` - Game 60 min

## Adding Images

1. Place your images in `public/images/tablet_time/`
2. Name them according to the item `id`
3. Recommended format: JPG or PNG
4. Recommended size: 400x400px or similar square format

## Image Requirements

- **Format**: JPG, PNG, or WebP
- **Size**: 400x400px recommended (square)
- **File size**: < 200KB per image (for fast loading)
- **Naming**: Must match item `id` exactly

## Example Image List

```
public/images/tablet_time/
├── tab10.jpg
├── tab20.jpg
├── tab30.jpg
├── tab45.jpg
├── tab60.jpg
├── game15.jpg
├── game30.jpg
├── game45.jpg
└── game60.jpg
```

Add your images and they'll automatically appear in the UI! 🎨

