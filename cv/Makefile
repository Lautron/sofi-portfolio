# Build from cv/ so each document's relative \input and \documentclass paths
# resolve to the checked-in shared sources.  No copy of Awesome-CV is made.
XELATEX ?= xelatex
DOCKER_IMAGE ?= texlive/texlive:latest

PDFS := \
	game-qa/Sofia_Arauz_Game_QA.pdf \
	environment-art/Sofia_Arauz_3D_Environment_Artist.pdf

COMMON_TEX := common/layout.tex common/identity.tex common/education-languages.tex
CLASS := Awesome-CV/awesome-cv.cls

.PHONY: all docker clean verify preview

all: $(PDFS)

# Build both CVs in the official TeX Live container. Fonts required by
# Awesome-CV are installed in the disposable container before compilation.
docker:
	@command -v docker >/dev/null 2>&1 || { printf '%s\n' 'error: Docker is required; install Docker and retry.' >&2; exit 127; }
	docker run --rm \
		-v "$(CURDIR):/work" \
		-w /work \
		"$(DOCKER_IMAGE)" \
		bash -lc 'apt-get update && apt-get install --yes fonts-roboto fonts-adobe-sourcesans3 && fc-cache -f && make XELATEX=lualatex all'

# Compile twice in a disposable directory so auxiliary files never enter the
# repository. XeLaTeX output (including warnings) is deliberately retained on
# stdout/stderr for the build log.
define build_pdf
	@command -v "$(XELATEX)" >/dev/null 2>&1 || { \
		printf '%s\n' "error: XeLaTeX is required; install it or invoke make XELATEX=/path/to/xelatex" >&2; \
		exit 127; \
	}
	@build_dir="$$(mktemp -d)"; trap 'rm -rf "$$build_dir"' 0 1 2 3 15; \
	cd "$(@D)" && \
	"$(XELATEX)" -interaction=nonstopmode -halt-on-error -output-directory="$$build_dir" "$(<F)" && \
	"$(XELATEX)" -interaction=nonstopmode -halt-on-error -output-directory="$$build_dir" "$(<F)" && \
	install -m 0644 "$$build_dir/$(@F)" "$(@F)"
endef

game-qa/Sofia_Arauz_Game_QA.pdf: game-qa/Sofia_Arauz_Game_QA.tex $(COMMON_TEX) $(CLASS)
	$(build_pdf)

environment-art/Sofia_Arauz_3D_Environment_Artist.pdf: environment-art/Sofia_Arauz_3D_Environment_Artist.tex $(COMMON_TEX) $(CLASS)
	$(build_pdf)

# Checks machine-verifiable requirements. The emitted pdftotext stream is the
# reading-order evidence for review; it is not silently discarded.
verify: all
	@command -v pdfinfo >/dev/null 2>&1 || { printf '%s\n' 'error: verify requires pdfinfo (Poppler).' >&2; exit 127; }
	@command -v pdftotext >/dev/null 2>&1 || { printf '%s\n' 'error: verify requires pdftotext (Poppler).' >&2; exit 127; }
	@command -v mutool >/dev/null 2>&1 || { printf '%s\n' 'error: verify requires mutool (MuPDF) to inspect link annotations.' >&2; exit 127; }
	@for pdf in $(PDFS); do \
		pages="$$(pdfinfo "$$pdf" | awk '/^Pages:/ { print $$2 }')"; \
		test "$$pages" = 1 || { printf '%s\n' "error: $$pdf has $$pages pages (expected 1)" >&2; exit 1; }; \
		page_object="$$(mutool show "$$pdf" pages | awk '/^page 1 =/ { print $$4; exit }')"; \
		test -n "$$page_object" && mutool show "$$pdf" "$$page_object" | grep -q '/Annots' || { printf '%s\n' "error: $$pdf has no link annotations" >&2; exit 1; }; \
		printf '%s\n' "--- $$pdf: one page; link annotations present; pdftotext reading order ---"; \
		pdftotext -layout "$$pdf" -; \
	done

# Optional visual-inspection aid: produces temporary PNGs only when requested.
preview: all
	@command -v pdftoppm >/dev/null 2>&1 || { printf '%s\n' 'error: preview requires pdftoppm (Poppler).' >&2; exit 127; }
	@out="$$(mktemp -d)"; printf '%s\n' "Rendered previews: $$out"; \
	for pdf in $(PDFS); do pdftoppm -png -r 144 -singlefile "$$pdf" "$$out/$${pdf%.pdf}"; done

clean:
	rm -f $(PDFS)
