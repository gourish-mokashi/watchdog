package reciever

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type WriteRequest struct {
	Contents string `json:"content"`
}

type EditRequest struct {
	OldContents string `json:"oldContent"`
	NewContents string `json:"newContent"`
}

func HandleToolsRead(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")

	if path == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	fmt.Printf("Agent Readign File ....")

	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error reading file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"filepath": path,
		"contents": string(data),
	})
}

func HandleToolsWrite(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	var req WriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	fmt.Printf("Agent writing to file: %s\n", path)

	if err := os.WriteFile(path, []byte(req.Contents), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Error writing file: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleToolsEdit(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	var req EditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	fmt.Printf("AI Agent editing file: %s\n", path)

	// Read existing file
	data, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error reading file for edit: %v", err), http.StatusInternalServerError)
		return
	}

	// Perform the replace
	contentStr := string(data)
	if !strings.Contains(contentStr, req.OldContents) {
		http.Error(w, "oldContents not found in file", http.StatusBadRequest)
		return
	}

	newContentStr := strings.Replace(contentStr, req.OldContents, req.NewContents, 1)

	// Write it back
	if err := os.WriteFile(path, []byte(newContentStr), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Error saving edited file: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleToolsRestart(w http.ResponseWriter, r *http.Request) {
	toolname := r.URL.Query().Get("toolname")
	if toolname == "" {
		http.Error(w, "Missing 'toolname' query parameter", http.StatusBadRequest)
		return
	}

	fmt.Printf("Agent restarting tool: %s\n", toolname)

	// Execute systemctl restart
	cmd := exec.Command("systemctl", "restart", toolname)
	if err := cmd.Run(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to restart %s: %v", toolname, err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleDirEnum(w http.ResponseWriter, r *http.Request) {
	targetPath := r.URL.Query().Get("path")
	if targetPath == "" {
		targetPath = "." // Default to current directory if not provided
	}

	levelStr := r.URL.Query().Get("level")
	maxDepth, err := strconv.Atoi(levelStr)
	if err != nil || maxDepth < 1 {
		maxDepth = 1 // Default to level 1 if invalid
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Directory listing for: %s (Max Depth: %d)\n", targetPath, maxDepth))

	// Walk the directory tree
	filepath.Walk(targetPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors like permission denied
		}

		// Calculate current depth
		relPath, _ := filepath.Rel(targetPath, path)
		depth := strings.Count(relPath, string(os.PathSeparator))
		if relPath == "." {
			depth = 0
		}

		// Stop going deeper if we hit the level limit
		if depth > maxDepth {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Formatting the tree output
		indent := strings.Repeat("  ", depth)
		if info.IsDir() {
			fmt.Fprintf(&sb, "%s📁 %s/\n", indent, info.Name())
		} else {
			fmt.Fprintf(&sb, "%s📄 %s\n", indent, info.Name())
		}
		return nil
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"contents": sb.String(),
	})
}
