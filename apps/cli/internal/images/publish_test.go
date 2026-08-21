package images

import "testing"

func TestNeedsPublish(t *testing.T) {
	cases := []struct {
		name string
		a    Asset
		want bool
	}{
		{"all widths present", Asset{Variants: map[string]string{"1200": "u", "600": "u"}}, false},
		{"missing one width", Asset{Variants: map[string]string{"1200": "u"}}, true},
		{"nil variants", Asset{}, true},
		{"empty variants", Asset{Variants: map[string]string{}}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := needsPublish(&c.a); got != c.want {
				t.Fatalf("needsPublish(%+v) = %v, want %v", c.a, got, c.want)
			}
		})
	}
}
