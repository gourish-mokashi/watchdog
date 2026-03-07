package dispatcher

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
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
	targetURL, err := backendEndpointURL(backendURL, "/events/new")

	if err != nil {
		return err
	}

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

	req, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 1200 * time.Second}
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

	targetURL, err := backendEndpointURL(backendBaseURL, "/generate/rules")
	if err != nil {
		return err
	}
	targetURL = fmt.Sprintf("%s?toolname=%s", targetURL, url.QueryEscape(toolname))

	req, _ := http.NewRequest("POST", targetURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 1200 * time.Second}
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

func GenerateSummary(projectPath string, backendBaseURL string) (string, error) {
	targetURL, err := backendEndpointURL(backendBaseURL, "/generate/summary")
	if err != nil {
		return "", err
	}
	targetURL = fmt.Sprintf("%s?path=%s", targetURL, url.QueryEscape(projectPath))

	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 1200 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("backend rejected summary request with status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return strings.TrimSpace(string(body)), nil
}

func backendEndpointURL(baseURL, endpointPath string) (string, error) {
	trimmed := strings.TrimSpace(baseURL)
	if trimmed == "" {
		return "", fmt.Errorf("WATCHDOG_BACKEND_URL is not configured")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid WATCHDOG_BACKEND_URL: %w", err)
	}

	parsed.Path = path.Join(parsed.Path, endpointPath)
	return parsed.String(), nil
}
