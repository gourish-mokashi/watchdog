package installers

import (
	"io"
	"os"
	"sync"
)

type SecurityTools interface {
	Name() string
	Description() string
	Install() error   //package manager commands
	Configure() error //YAML config modifications
	Start() error     //installation entry point(systemctl)
}

var (
	commandOutputMu sync.RWMutex
	commandOutput   io.Writer = os.Stdout
)

func SetCommandOutput(w io.Writer) {
	commandOutputMu.Lock()
	defer commandOutputMu.Unlock()

	if w == nil {
		commandOutput = os.Stdout
		return
	}

	commandOutput = w
}

func getCommandOutput() io.Writer {
	commandOutputMu.RLock()
	defer commandOutputMu.RUnlock()
	return commandOutput
}
