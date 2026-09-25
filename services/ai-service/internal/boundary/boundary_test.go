package boundary

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestModuleStaysAppNeutralAndPinned(t *testing.T) {
	root := moduleRoot(t)
	forbidden := []string{
		"ql" + "tbyt",
		"don" + "_vi",
		"dia" + "_ban",
		"ai" + "_quota",
		"ai" + "_readonly",
		"supa" + "base",
		"assistant" + "_query_database",
	}
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			parent := filepath.Base(filepath.Dir(path))
			if parent == "internal" && entry.Name() == "ql"+"tbyt" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		lower := strings.ToLower(string(body))
		for _, term := range forbidden {
			if strings.Contains(lower, term) {
				t.Errorf("%s contains %s", path, term)
			}
		}
		if !strings.Contains(path, string(filepath.Separator)+"provider"+string(filepath.Separator)) {
			sdkImports := []string{"eino-ext/components/" + "model", "google.golang.org/" + "genai"}
			for _, sdkImport := range sdkImports {
				if strings.Contains(lower, sdkImport) {
					t.Errorf("%s imports a provider SDK", path)
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	mod, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(mod)
	for _, needle := range []string{
		"go 1.24.0",
		"toolchain go1.26.5",
		"github.com/cloudwego/eino v0.9.21",
		"github.com/cloudwego/eino-ext/components/" + "model/openai v0.1.13",
		"github.com/cloudwego/eino-ext/components/" + "model/gemini v0.1.36",
		"google.golang.org/" + "genai v1.70.0",
	} {
		if !strings.Contains(text, needle) {
			t.Errorf("go.mod missing %s", needle)
		}
	}
	repoRoot := filepath.Dir(filepath.Dir(root))
	for _, relative := range []string{"vercel.json", "package.json"} {
		body, err := os.ReadFile(filepath.Join(repoRoot, relative))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(body), "services/ai-service") || strings.Contains(string(body), "go build") {
			t.Errorf("%s builds the Go module", relative)
		}
	}
	workflowDir := filepath.Join(repoRoot, ".github", "workflows")
	entries, err := os.ReadDir(workflowDir)
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}
	for _, entry := range entries {
		body, err := os.ReadFile(filepath.Join(workflowDir, entry.Name()))
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(body), "services/ai-service") {
			t.Errorf("%s builds the Go module", entry.Name())
		}
	}
}

func moduleRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("caller unavailable")
	}
	dir := filepath.Dir(file)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}
