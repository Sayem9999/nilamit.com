import os
from PIL import Image

def resize_and_convert():
    master_path = "public/icon-512.png"
    if not os.path.exists(master_path):
        print(f"Error: Master icon not found at {master_path}")
        return

    # Load master image
    img = Image.open(master_path)
    print(f"Loaded master image: {img.size} {img.format}")

    # 1. Create standard size PNGs
    sizes_to_create = {
        "public/icon-32.png": (32, 32),
        "public/icon-48.png": (48, 48),
        "public/icon.png": (48, 48),       # Set primary public icon to 48x48
        "src/app/icon.png": (48, 48),      # Set primary app icon to 48x48
        "public/icon-192.png": (192, 192),  # Actual 192x192 PWA size
        "src/app/apple-icon.png": (180, 180) # Standard Apple Touch Icon size
    }

    for path, size in sizes_to_create.items():
        # Ensure directory exists
        os.makedirs(os.path.dirname(path), exist_ok=True)
        resized = img.resize(size, Image.Resampling.LANCZOS)
        resized.save(path, "PNG")
        print(f"Saved {path} with size {size}")

    # 2. Generate multi-resolution real favicon.ico
    # A true .ico contains multiple sizes: 16x16, 32x32, 48x48
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_images = [img.resize(size, Image.Resampling.LANCZOS) for size in ico_sizes]
    
    ico_paths = ["public/favicon.ico", "src/app/favicon.ico"]
    for path in ico_paths:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # Save first image and append the others
        ico_images[0].save(
            path,
            format="ICO",
            sizes=ico_sizes,
            append_images=ico_images[1:]
        )
        print(f"Saved real multi-res ICO to {path}")

if __name__ == "__main__":
    resize_and_convert()
