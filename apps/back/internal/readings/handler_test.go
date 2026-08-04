package readings

import "testing"

func TestBuildReference(t *testing.T) {
	cases := []struct {
		name string
		ids  []string
		lang string
		want string
	}{
		{
			name: "discontinuous verses collapse into ranges",
			ids:  []string{"WIS.12.13", "WIS.12.16", "WIS.12.17", "WIS.12.18", "WIS.12.19"},
			lang: "en",
			want: "Wisdom 12:13, 16-19",
		},
		{
			name: "single verse",
			ids:  []string{"MAT.11.25"},
			lang: "en",
			want: "Matthew 11:25",
		},
		{
			name: "spans two chapters",
			ids:  []string{"MAT.26.74", "MAT.26.75", "MAT.27.1", "MAT.27.2"},
			lang: "en",
			want: "Matthew 26:74-75; 27:1-2",
		},
		{
			name: "localized book name",
			ids:  []string{"PSA.86.5", "PSA.86.6"},
			lang: "es",
			want: "Salmos 86:5-6",
		},
		{
			name: "empty",
			ids:  nil,
			want: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := buildReference(tc.ids, tc.lang); got != tc.want {
				t.Fatalf("buildReference(%v) = %q, want %q", tc.ids, got, tc.want)
			}
		})
	}
}

func TestSortReadings(t *testing.T) {
	in := []readingResponse{
		{Type: "gospel"},
		{Type: "responsorial_psalm"},
		{Type: "reading_1"},
		{Type: "sequence"},
		{Type: "reading_2"},
	}
	sortReadings(in)
	want := []string{"reading_1", "responsorial_psalm", "reading_2", "sequence", "gospel"}
	for i, r := range in {
		if r.Type != want[i] {
			t.Fatalf("position %d = %q, want %q (full: %v)", i, r.Type, want[i], in)
		}
	}
}

func TestSortVerseIDsNumeric(t *testing.T) {
	got := sortVerseIDs([]string{"WIS.12.10", "WIS.12.2", "WIS.12.9"})
	want := []string{"WIS.12.2", "WIS.12.9", "WIS.12.10"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sortVerseIDs = %v, want %v", got, want)
		}
	}
}
