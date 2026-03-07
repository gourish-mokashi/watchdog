package reciever

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

type WriteRequest struct{
	Contents string `json:"content"`
}

type EditRequest struct{
	OldContents string `json:"oldContent"`
	NewContents string `json:"newContent"`
}



func HandleToolsRead(w http.ResponseWriter, r *http.Request){
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