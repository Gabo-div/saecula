package images

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif" // register decoders so any Commons source format is accepted
	"image/jpeg"
	_ "image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
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
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
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

// imageWidth returns the pixel width of an encoded image without fully
// decoding the pixels.
func imageWidth(src []byte) (int, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(src))
	if err != nil {
		return 0, fmt.Errorf("decode image config: %w", err)
	}
	return cfg.Width, nil
}

// maxVariantWidth is the largest width we generate. A source narrower than
// this would have to be upscaled, so publish rejects it — every published
// asset must be large enough to serve both the 1200w hero and the 1080w
// share render without upscaling.
func maxVariantWidth() int {
	m := 0
	for _, w := range variantWidths {
		if w > m {
			m = w
		}
	}
	return m
}

// smallestVariantWidth is the narrowest variant we generate; a source must be
// at least this wide to yield any variant without upscaling.
func smallestVariantWidth() int {
	m := variantWidths[0]
	for _, w := range variantWidths {
		if w < m {
			m = w
		}
	}
	return m
}
