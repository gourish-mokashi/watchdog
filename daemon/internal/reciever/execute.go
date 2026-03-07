package reciever

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func agentLog(format string, args ...any) {
	log.Printf("[agent-api] "+format, args...)
}

type WriteRequest struct {
	Contents string `json:"contents"`
	Path     string `json:"path"`
}

type EditRequest struct {
	OldContents string `json:"oldContents"`
	NewContents string `json:"newContents"`
	Path        string `json:"path"`
}

func resolvePath(input string) (string, error) {
	if strings.TrimSpace(input) == "" {
		return "", errors.New("empty path")
	}

	raw := strings.TrimSpace(input)
	if raw == "~" || strings.HasPrefix(raw, "~/") {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to resolve home directory: %w", err)
		}
		if raw == "~" {
			raw = homeDir
		} else {
			raw = filepath.Join(homeDir, strings.TrimPrefix(raw, "~/"))
		}
	}

	cleaned := filepath.Clean(raw)
	abs, err := filepath.Abs(cleaned)
	if err != nil {
		return "", fmt.Errorf("failed to resolve absolute path: %w", err)
	}
	return abs, nil
}

func HandleToolsRead(w http.ResponseWriter, r *http.Request) {
	path, err := resolvePath(r.URL.Query().Get("path"))

	if err != nil {
		agentLog("read rejected: invalid path: %v", err)
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	agentLog("reading file: %s", path)

	data, err := os.ReadFile(path)
	if err != nil {
		agentLog("read failed for %s: %v", path, err)
		http.Error(w, fmt.Sprintf("Error reading file: %v", err), http.StatusInternalServerError)
		return
	}

	agentLog("read complete: %s (%d bytes)", path, len(data))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"filepath": path,
		"contents": string(data),
	})
}

func HandleToolsWrite(w http.ResponseWriter, r *http.Request) {
	var req WriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		agentLog("write rejected: invalid JSON body: %v", err)
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	rawPath := r.URL.Query().Get("path")
	if strings.TrimSpace(rawPath) == "" {
		rawPath = req.Path
	}
	path, err := resolvePath(rawPath)
	if err != nil {
		agentLog("write rejected: invalid path: %v", err)
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	contents := req.Contents

	agentLog("writing file: %s (%d bytes)", path, len(contents))

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		agentLog("write failed creating parent dir for %s: %v", path, err)
		http.Error(w, fmt.Sprintf("Error creating directory: %v", err), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(path, []byte(contents), 0644); err != nil {
		agentLog("write failed for %s: %v", path, err)
		http.Error(w, fmt.Sprintf("Error writing file: %v", err), http.StatusInternalServerError)
		return
	}

	agentLog("write complete: %s", path)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleToolsValidate(w http.ResponseWriter, r *http.Request) {
	agentLog("running Falco validation")

	cmd := exec.Command("sudo", "falco", "-c", "/etc/falco/falco.yaml", "--dry-run")
	output, err := cmd.CombinedOutput()
	result := strings.TrimSpace(string(output))
	if result == "" {
		result = "validation completed with no output"
	}

	if err != nil {
		agentLog("Falco validation failed: %v | output: %s", err, result)
		http.Error(w, fmt.Sprintf("Falco validation failed: %v\n%s", err, result), http.StatusInternalServerError)
		return
	}

	agentLog("Falco validation successful")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(result))
}

func HandleToolsEdit(w http.ResponseWriter, r *http.Request) {
	var req EditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		agentLog("edit rejected: invalid JSON body: %v", err)
		http.Error(w, "Invalid JSON body", http.StatusBadRequest)
		return
	}

	rawPath := r.URL.Query().Get("path")
	if strings.TrimSpace(rawPath) == "" {
		rawPath = req.Path
	}
	path, err := resolvePath(rawPath)
	if err != nil {
		agentLog("edit rejected: invalid path: %v", err)
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	oldContent := req.OldContents
	newContent := req.NewContents
	if oldContent == "" {
		agentLog("edit rejected for %s: missing old content", path)
		http.Error(w, "Missing old content in request body", http.StatusBadRequest)
		return
	}

	agentLog("editing file: %s", path)

	// Read existing file
	data, err := os.ReadFile(path)
	if err != nil {
		agentLog("edit failed reading %s: %v", path, err)
		http.Error(w, fmt.Sprintf("Error reading file for edit: %v", err), http.StatusInternalServerError)
		return
	}

	// Perform the replace
	contentStr := string(data)
	if !strings.Contains(contentStr, oldContent) {
		agentLog("edit rejected for %s: oldContents not found", path)
		http.Error(w, "oldContents not found in file", http.StatusBadRequest)
		return
	}

	newContentStr := strings.Replace(contentStr, oldContent, newContent, 1)

	// Write it back
	if err := os.WriteFile(path, []byte(newContentStr), 0644); err != nil {
		agentLog("edit failed writing %s: %v", path, err)
		http.Error(w, fmt.Sprintf("Error saving edited file: %v", err), http.StatusInternalServerError)
		return
	}

	agentLog("edit complete: %s", path)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleToolsRestart(w http.ResponseWriter, r *http.Request) {
	toolname := r.URL.Query().Get("toolname")
	if toolname == "" {
		agentLog("restart rejected: missing toolname")
		http.Error(w, "Missing 'toolname' query parameter", http.StatusBadRequest)
		return
	}

	agentLog("restarting tool: %s", toolname)

	// Execute systemctl restart
	cmd := exec.Command("systemctl", "restart", toolname)
	if err := cmd.Run(); err != nil {
		agentLog("restart failed for %s: %v", toolname, err)
		http.Error(w, fmt.Sprintf("Failed to restart %s: %v", toolname, err), http.StatusInternalServerError)
		return
	}

	agentLog("restart complete: %s", toolname)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("success"))
}

func HandleDirEnum(w http.ResponseWriter, r *http.Request) {
	targetPath := r.URL.Query().Get("path")
	if targetPath == "" {
		targetPath = "." // Default to current directory if not provided
	}
	resolvedPath, err := resolvePath(targetPath)
	if err != nil {
		agentLog("direnum rejected: invalid path %q: %v", targetPath, err)
		http.Error(w, "Invalid 'path' query parameter", http.StatusBadRequest)
		return
	}

	levelStr := r.URL.Query().Get("level")
	maxDepth, err := strconv.Atoi(levelStr)
	if err != nil || maxDepth < 1 {
		maxDepth = 1 // Default to level 1 if invalid
	}

	agentLog("enumerating directory: %s (max depth %d)", resolvedPath, maxDepth)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Directory listing for: %s (Max Depth: %d)\n", resolvedPath, maxDepth))

	// Walk the directory tree
	filepath.Walk(resolvedPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors like permission denied
		}

		// Calculate current depth
		relPath, _ := filepath.Rel(resolvedPath, path)
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
	agentLog("directory enumeration complete: %s", resolvedPath)
}
