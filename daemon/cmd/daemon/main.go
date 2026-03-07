package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/gourish-mokashi/watchdog/daemon/internal/dispatcher"
	"github.com/gourish-mokashi/watchdog/daemon/internal/installers"
	"github.com/gourish-mokashi/watchdog/daemon/internal/reciever"
	"github.com/gourish-mokashi/watchdog/daemon/internal/ui"
	"github.com/gourish-mokashi/watchdog/daemon/pkg/models"
	"github.com/gourish-mokashi/watchdog/daemon/watchers"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "init" {
		RunInstallerUI()
		return
	}

	fmt.Println("Daemon Starting Up...")

	//alert holding queue
	eventQueue := make(chan models.SecEvent, 100)

	//graceful shutdown handling
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)

	go watchers.StartFalcoHTTP("8081", eventQueue)

	go func() {

		targetURL := "https://webhook.site/29e9869b-01ca-461f-b3ae-fabe5755b0d8"

		for alert := range eventQueue {
			fmt.Printf("Shiping alerts from %s...\n", alert.SourceTool)

			err := dispatcher.SendAlerts(alert, targetURL)
			if err != nil {
				fmt.Printf("Error sending alert: %v\n", err)
			} else {
				fmt.Println("Alert sent successfully")
			}
		}
	}()

	go func() {
		mux := http.NewServeMux()

		mux.HandleFunc("POST /agent/read", reciever.HandleReadFile)
		mux.HandleFunc("POST /agent/write", reciever.HandleWriteFile)

		fmt.Println("Agent API listening on :8080...")

		if err := http.ListenAndServe(":8080", mux); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Agent API server error: %v\n", err)
		}
	}()

	<-signalChan

	fmt.Println("Daemon Shutting Down...")

}

func RunInstallerUI() {

	tools := []installers.SecurityTools{
		&installers.FalcoTool{},
		// &installers.Suricata...... ese add karlena
	}

	p := tea.NewProgram(ui.InitialModel(tools))
	if _, err := p.Run(); err != nil {
		fmt.Printf("Fatal error in UI: %v\n", err)
		os.Exit(1)
	}
}
