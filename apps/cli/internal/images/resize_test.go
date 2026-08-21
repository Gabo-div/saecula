package images

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func sampleJPEG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 128, 255})
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, nil)
	return buf.Bytes()
}

func TestResizeJPEGWidth(t *testing.T) {
	out, err := resizeJPEG(sampleJPEG(2000, 1000), 600)
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 600 {
		t.Fatalf("width = %d, want 600", cfg.Width)
	}
	if cfg.Height != 300 { // aspect preserved
		t.Fatalf("height = %d, want 300", cfg.Height)
	}
}

func TestObjectKey(t *testing.T) {
	if got := objectKey("backgrounds", "velazquez-coronation", 1200); got != "backgrounds/velazquez-coronation-1200.jpg" {
		t.Fatalf("objectKey = %q", got)
	}
}
