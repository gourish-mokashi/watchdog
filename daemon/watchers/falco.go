package watchers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gourish-mokashi/watchdog/daemon/pkg/models"
)

type FalcoPayload struct {
	Time         string                 `json:"time"`
	Rule         string                 `json:"rule"`
	Priority     string                 `json:"priority"`
	Output       string                 `json:"output"`
	OutputFields map[string]interface{} `json:"output_fields"`
}

func StartFalcoHTTP(socketPath string, eventQueue chan<- models.SecEvent) error {
	mux := http.NewServeMux()

	mux.HandleFunc("/falco", func(w http.ResponseWriter, r *http.Request) {
		var payload FalcoPayload

		fmt.Println("Recived Request from Falco")

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			fmt.Printf("Error decoding falco event: %v", err)
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		parsedTime, _ := time.Parse(time.RFC3339, payload.Time)
		rawBytes, _ := json.Marshal(payload)

		alert := models.SecEvent{
			SourceTool:  models.FALCO,
			Timestamp:   parsedTime,
			Priority:    payload.Priority,
			Description: payload.Output,
			RawPayload:  json.RawMessage(rawBytes),
		}

		eventQueue <- alert

		w.WriteHeader(http.StatusOK)
	})

	fmt.Printf("Connection to falco socket at %s\n", socketPath)

	if err := http.ListenAndServe(":"+socketPath, mux); err != nil {
		return fmt.Errorf("falco watcher server crashed: %w", err)
	}

	return nil
}
