package main

import (
	"fmt"
	"net"
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

var backendURL = os.Getenv("WATCHDOG_BACKEND_URL")

func main() {
	if len(os.Args) > 1 && os.Args[1] == "init" {
		if err := startAgentAPIServer(); err != nil {
			fmt.Printf("Fatal error starting Agent API server: %v\n", err)
			os.Exit(1)
		}
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
		for alert := range eventQueue {
			fmt.Printf("Shiping alerts from %s...\n", alert.SourceTool)

			if backendURL == "" {
				fmt.Println("WATCHDOG_BACKEND_URL not configured; skipping alert dispatch")
				continue
			}

			err := dispatcher.SendAlerts(alert, backendURL)
			if err != nil {
				fmt.Printf("Error sending alert: %v\n", err)
			} else {
				fmt.Println("Alert sent successfully")
			}
		}
	}()

	if err := startAgentAPIServer(); err != nil {
		fmt.Printf("Fatal error starting Agent API server: %v\n", err)
		os.Exit(1)
	}

	<-signalChan

	fmt.Println("Daemon Shutting Down...")

}

func startAgentAPIServer() error {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /tools/read", reciever.HandleToolsRead)
	mux.HandleFunc("POST /tools/write", reciever.HandleToolsWrite)
	mux.HandleFunc("POST /tools/edit", reciever.HandleToolsEdit)
	mux.HandleFunc("GET /tools/validate", reciever.HandleToolsValidate)
	mux.HandleFunc("GET /tools/restart", reciever.HandleToolsRestart)
	mux.HandleFunc("GET /tools/direnum", reciever.HandleDirEnum)

	listener, err := net.Listen("tcp", ":8080")
	if err != nil {
		return err
	}

	server := &http.Server{Handler: mux}

	fmt.Println("\nAgent API listening on :8080...")
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Agent API server error: %v\n", err)
		}
	}()

	return nil
}

func RunInstallerUI() {

	// ── REGISTERED SECURITY TOOLS ───────────────────────────────────────
	// To add a new tool:
	//   1. Create a file in internal/installers/ implementing the SecurityTools interface
	//      (Name, Description, Install, Configure, Start).
	//   2. Append an instance below — it will appear in the TUI automatically.
	tools := []installers.SecurityTools{
		&installers.FalcoTool{},
		&installers.SuricataTool{},
		&installers.WazuhTool{},
	}

	p := tea.NewProgram(ui.InitialModel(tools, backendURL))
	if _, err := p.Run(); err != nil {
		fmt.Printf("Fatal error in UI: %v\n", err)
		os.Exit(1)
	}
}
