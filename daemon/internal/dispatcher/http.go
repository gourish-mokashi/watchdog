package dispatcher

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gourish-mokashi/watchdog/daemon/pkg/models"
)

type BackendEventPayload struct {
	SourceTool  string          `json:"sourceTool"`
	Timestamp   time.Time       `json:"timestamp"`
	Priority    string          `json:"priority"`
	Description string          `json:"description"`
	RawPayload  json.RawMessage `json:"rawPayload"`
}

type RulePayload struct {
	Contents string `json:"contents"`
}

func SendAlerts(alerts models.SecEvent, backendURL string) error {

	payload := BackendEventPayload{
		SourceTool:  alerts.SourceTool,
		Timestamp:   time.Now(),
		Priority:    alerts.Priority,
		Description: alerts.Description,
		RawPayload:  alerts.RawPayload,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to pack JSON: %w", err)
	}

	req, err := http.NewRequest("POST", backendURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("backend rejected payload with status: %d", resp.StatusCode)
	}

	return nil
}


func SendRule(toolname string, markdownContents string, backendBaseURL string) error {
	payload := RulePayload{Contents: markdownContents}
	jsonData, _ := json.Marshal(payload)

	targetURL := fmt.Sprintf("%s/generate/rules?toolname=%s", backendBaseURL, toolname)
	
	req, _ := http.NewRequest("POST", targetURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("backend rejected rule with status %d", resp.StatusCode)
	}
	return nil
}
