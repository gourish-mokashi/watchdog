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

func StartFalcoHTTP(socketPath string, eventQueue chan<- models.SecEvent) {

	http.HandleFunc("/falco", func(w http.ResponseWriter, r *http.Request) {
		var payload FalcoPayload

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			fmt.Printf("Error decoding falco event: %v", err)
			http.Error(w, "Invalid payload", http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		parsedTime, _ := time.Parse(time.RFC3339, payload.Time)
		rawBytes, _ := json.Marshal(payload)

		alert := models.SecEvent{
			SourceTool:  "Falco",
			Timestamp:   parsedTime,
			Severity:    payload.Priority,
			Description: payload.Output,
			RawPayload:  string(rawBytes),
		}

		eventQueue <- alert

		w.WriteHeader(http.StatusOK)
	})

	fmt.Printf("Connection to falco socket at %s", socketPath)

	if err := http.ListenAndServe(":"+socketPath, nil); err != nil {
		fmt.Printf("HTTP Server crashed: %v\n", err)
	}

}
