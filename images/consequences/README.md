# Consequences Menu Images

## Folder Structure

Images are stored in: `public/images/consequences/`

## Image Naming Convention

Images should match the `id` field from the consequences menu data:
- Format: `{item_id}.jpg` or `{item_id}.png`
- Examples:
  - `minus5.jpg` for item with id `"minus5"`
  - `deduct25.jpg` for item with id `"deduct25"`

## Current Consequences

Based on `DEFAULT_TIME_CONSEQUENCES` and `DEFAULT_MONEY_CONSEQUENCES` in `app.py`:

### Time Consequences
- `minus5` - Time -5 minutes
- `minus10` - Time -10 minutes
- `end_session` - End current session (minutes=0)
- `lock_day` - Lock screens for today
- `unlock` - Unlock screens

### Money Consequences
- `deduct25` - -$0.25
- `deduct50` - -$0.50
- `deduct100` - -$1.00
- `deduct200` - -$2.00

## Adding Images

1. Place your images in `public/images/consequences/`
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
public/images/consequences/
├── minus5.jpg
├── minus10.jpg
├── end_session.jpg
├── lock_day.jpg
├── unlock.jpg
├── deduct25.jpg
├── deduct50.jpg
├── deduct100.jpg
└── deduct200.jpg
```

Add your images and they'll automatically appear in the UI! 🎨

