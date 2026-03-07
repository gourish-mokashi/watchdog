package models

import "time"

type SecEvent struct {
	SourceTool  string    `json:"source_tool"`
	Timestamp   time.Time `json:"time_stamp"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	RawPayload  string    `json:"raw_payload"`
}
