package images

import "testing"

func TestLoadManifestRequiresLicenseAndAttribution(t *testing.T) {
	assets, err := parseManifest([]byte(`[
	  {"id":"x","title":"T","license":"Public Domain","attribution":"A, PD",
	   "variants":{"1200":"https://img/x-1200.jpg"},"is_background":true}
	]`))
	if err != nil {
		t.Fatalf("valid manifest: %v", err)
	}
	if len(assets) != 1 || assets[0].ID != "x" || !assets[0].IsBackground {
		t.Fatalf("unexpected parse: %+v", assets)
	}

	if _, err := parseManifest([]byte(`[{"id":"y","title":"T","attribution":"A","variants":{}}]`)); err == nil {
		t.Fatal("expected error: missing license")
	}
	if _, err := parseManifest([]byte(`[{"id":"z","title":"T","license":"PD","variants":{}}]`)); err == nil {
		t.Fatal("expected error: missing attribution")
	}
}
