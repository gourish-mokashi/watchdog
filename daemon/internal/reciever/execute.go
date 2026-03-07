package reciever

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type ReadRequest struct {
	Path string `json:"path"`
}

// Check WriteRequest while you are at it too!
type WriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func HandleReadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	fmt.Printf("AI Agent requested to READ: %s\n", req.Path)

	content, err := os.ReadFile(req.Path)
	if err != nil {
		fmt.Printf("Read Failed %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"file_path": req.Path,
		"content":   string(content),
	})
}

func HandleWriteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	var req WriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	fmt.Printf("AI Agent requested to WRITE: %s\n", req.Path)

	err := os.WriteFile(req.Path, []byte(req.Content), 0644)
	if err != nil {
		fmt.Printf("Write Failed %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Successfully wrote to %s", req.Path),
	})
}
