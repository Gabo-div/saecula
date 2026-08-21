package images

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"

	"golang.org/x/image/draw"
)

var variantWidths = []int{1200, 600}

// objectKey is the deterministic R2 key for one variant. Deterministic keys
// make PutObject idempotent (same key overwrites, never duplicates).
func objectKey(category, slug string, width int) string {
	return fmt.Sprintf("%s/%s-%d.jpg", category, slug, width)
}

// resizeJPEG decodes a JPEG, scales it to width (aspect preserved) with a
// high-quality CatmullRom kernel, and re-encodes JPEG. No native dependency.
func resizeJPEG(src []byte, width int) ([]byte, error) {
	img, err := jpeg.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, fmt.Errorf("decode jpeg: %w", err)
	}
	b := img.Bounds()
	if b.Dx() == 0 {
		return nil, fmt.Errorf("zero-width source")
	}
	height := b.Dy() * width / b.Dx()
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, b, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 85}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}
