package scrape

import (
	"fmt"
	"reflect"
	"testing"
)

func TestExpandReference(t *testing.T) {
	lengths := ChapterLengths{
		"GEN": {1: 31, 2: 25},
		"MAT": {26: 75, 27: 66},
	}

	cases := []struct {
		name string
		raw  string
		slug string
		want []string
	}{
		{
			name: "discontinuous verses with letter suffixes",
			raw:  "Wisdom 12:13, 16-19",
			want: []string{"WIS.12.13", "WIS.12.16", "WIS.12.17", "WIS.12.18", "WIS.12.19"},
		},
		{
			name: "psalm singular alias",
			raw:  "Psalm 86:5-6, 9-10",
			want: []string{"PSA.86.5", "PSA.86.6", "PSA.86.9", "PSA.86.10"},
		},
		{
			name: "cf prefix and single verse",
			raw:  "Cf. Matthew 11:25",
			want: []string{"MAT.11.25"},
		},
		{
			name: "numbered book",
			raw:  "2 Corinthians 4:7-9",
			want: []string{"2CO.4.7", "2CO.4.8", "2CO.4.9"},
		},
		{
			name: "letter suffixes stripped",
			raw:  "Genesis 18:1-3a",
			want: []string{"GEN.18.1", "GEN.18.2", "GEN.18.3"},
		},
		{
			name: "single-chapter book without chapter",
			raw:  "Jude 20-21",
			want: []string{"JUD.1.20", "JUD.1.21"},
		},
		{
			name: "usccb abbreviation",
			raw:  "Gn 1:1-2",
			want: []string{"GEN.1.1", "GEN.1.2"},
		},
		{
			name: "cross-chapter em dash",
			raw:  "Genesis 1:29—2:3",
			want: []string{"GEN.1.29", "GEN.1.30", "GEN.1.31", "GEN.2.1", "GEN.2.2", "GEN.2.3"},
		},
		{
			name: "chapter switch after semicolon",
			raw:  "Matthew 26:74-75; 27:1-2",
			want: []string{"MAT.26.74", "MAT.26.75", "MAT.27.1", "MAT.27.2"},
		},
		{
			name: "book resolved from href slug",
			raw:  "Sacred Text 3:16",
			slug: "john",
			want: []string{"JHN.3.16"},
		},
		{
			name: "psalm 'and' separator",
			raw:  "Psalm 33:12-13, 20 and 22",
			want: []string{"PSA.33.12", "PSA.33.13", "PSA.33.20", "PSA.33.22"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ExpandReference(tc.raw, tc.slug, lengths)
			if err != nil {
				t.Fatalf("ExpandReference(%q): %v", tc.raw, err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("ExpandReference(%q) = %v, want %v", tc.raw, got, tc.want)
			}
		})
	}
}

func TestExpandReferenceES(t *testing.T) {
	lengths := ChapterLengths{
		"MAT": {26: 75, 27: 66},
	}

	cases := []struct {
		name string
		raw  string
		want []string
	}{
		{
			name: "verse groups with period separator",
			raw:  "Sabiduría 12, 13. 16-19",
			want: []string{"WIS.12.13", "WIS.12.16", "WIS.12.17", "WIS.12.18", "WIS.12.19"},
		},
		{
			name: "greek iota lookalike in book name",
			raw:  "Sabidurίa 12, 13",
			want: []string{"WIS.12.13"},
		},
		{
			name: "multi-chapter with semicolon",
			raw:  "Apocalipsis 11, 19; 12, 1-6. 10",
			want: []string{"REV.11.19", "REV.12.1", "REV.12.2", "REV.12.3", "REV.12.4", "REV.12.5", "REV.12.6", "REV.12.10"},
		},
		{
			name: "numbered book",
			raw:  "1 Corintios 15, 20-22",
			want: []string{"1CO.15.20", "1CO.15.21", "1CO.15.22"},
		},
		{
			name: "out-of-order lectionary groups",
			raw:  "Isaías 38, 1-3. 21-22. 7-8",
			want: []string{"ISA.38.1", "ISA.38.2", "ISA.38.3", "ISA.38.21", "ISA.38.22", "ISA.38.7", "ISA.38.8"},
		},
		{
			name: "cross-chapter dash",
			raw:  "Mateo 26, 14 – 27, 66",
			want: append(idRange("MAT", 26, 14, 75), idRange("MAT", 27, 1, 66)...),
		},
		{
			name: "single-chapter book",
			raw:  "Judas 17. 20-21",
			want: []string{"JUD.1.17", "JUD.1.20", "JUD.1.21"},
		},
		{
			name: "verse letter suffixes",
			raw:  "Miqueas 5, 1-4a",
			want: []string{"MIC.5.1", "MIC.5.2", "MIC.5.3", "MIC.5.4"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ExpandReferenceES(tc.raw, lengths)
			if err != nil {
				t.Fatalf("ExpandReferenceES(%q): %v", tc.raw, err)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("ExpandReferenceES(%q) = %v, want %v", tc.raw, got, tc.want)
			}
		})
	}
}

func idRange(code string, ch, from, to int) []string {
	var ids []string
	for v := from; v <= to; v++ {
		ids = append(ids, fmt.Sprintf("%s.%d.%d", code, ch, v))
	}
	return ids
}

func TestExpandReferenceErrors(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{name: "unknown book", raw: "Enoch 3:1"},
		{name: "non-numeric chapter", raw: "Esther C:12, 14-16"},
		{name: "chapter-only citation", raw: "Psalm 23"},
		{name: "cross-chapter without lengths", raw: "Genesis 1:29—2:3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, err := ExpandReference(tc.raw, "", nil); err == nil {
				t.Fatalf("ExpandReference(%q) = %v, want error", tc.raw, got)
			}
		})
	}
}
