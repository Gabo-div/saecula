package scrape

import "testing"

func TestParseCatechismParagraphs(t *testing.T) {
	// Shape mirrors scborromeo.org: numeric NAME anchors delimit paragraphs,
	// a bold self-link repeats the number, a section heading sits between two
	// paragraphs, and a footnote superscript must be dropped.
	page := `
<P><A NAME=I></A><B>I. THE DESIRE FOR GOD</B><P>
<A NAME=27></A><B><A HREF="javascript:openWindow('cr/27.htm');">27</a></B> The desire for God is written in the human heart.<A HREF="x"><SUP>1</SUP></A>
<P><A NAME=II></A><B>II. WAYS</B><P>
<A NAME=28></A><B><A HREF="javascript:openWindow('cr/28.htm');">28</a></B> In many ways man has given expression to his quest for God.
`
	got := parseCatechismParagraphs(page)
	if len(got) != 2 {
		t.Fatalf("got %d paragraphs, want 2: %+v", len(got), got)
	}
	if got[0].OfficialNumber != 27 ||
		got[0].Text != "The desire for God is written in the human heart." {
		t.Fatalf("paragraph 27 = %+v", got[0])
	}
	if got[1].OfficialNumber != 28 ||
		got[1].Text != "In many ways man has given expression to his quest for God." {
		t.Fatalf("paragraph 28 = %+v", got[1])
	}
}
