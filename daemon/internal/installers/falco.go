package installers

import (
	"fmt"
	"os"
	"os/exec"
)

type FalcoTool struct{}

func (f *FalcoTool) Name() string {
	return "Falco"
}

func (f *FalcoTool) Description() string {
	return "Cloud Native Runtime Security"
}

func (f *FalcoTool) Install() error {
	if _, err := exec.LookPath("falco"); err == nil {
		// Falco exists, safely skip the download step.
		return nil
	}

	if _, err := exec.LookPath("dnf"); err == nil {
		return f.InstallRPM("dnf")
	}

	if _, err := exec.LookPath("apt"); err == nil {
		return f.InstallAPT("apt")
	}

	if _, err := exec.LookPath("yum"); err == nil {
		return f.InstallRPM("yum")
	}
	return fmt.Errorf("unsupported operating system: no known package manager found")
}

func (f *FalcoTool) InstallRPM(packageManager string) error {
	cmds := [][]string{
		{"rpm", "--import", "https://falco.org/repo/falcosecurity-packages.asc"},
		{"curl", "-s", "-o", "/etc/yum.repos.d/falcosecurity.repo", "https://falco.org/repo/falcosecurity-rpm.repo"},
		{"yum", "update", "-y"},
		{packageManager, "install", "-y", "falco"},
	}

	for _, cmdArgs := range cmds {
		cmd := exec.Command(cmdArgs[0], cmdArgs[1:]...)
		cmd.Stdout = getCommandOutput()
		cmd.Stderr = getCommandOutput()
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to run %s: %w", cmdArgs[0], err)
		}
	}
	return nil
}

func (f *FalcoTool) InstallAPT(packageManager string) error {

	script := `
set -e
curl -fsSL https://falco.org/repo/falcosecurity-packages.asc | gpg --dearmor --yes -o /usr/share/keyrings/falco-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/falco-archive-keyring.gpg] https://download.falco.org/packages/deb stable main" | tee /etc/apt/sources.list.d/falcosecurity.list
apt-get update -y
apt-get install -y falco
`

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	return cmd.Run()
}

func (f *FalcoTool) Configure() error {
	// Using the config.d directory is the safest way to inject settings
	configDir := "/etc/falco/config.d"
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	watchdogConfig := []byte(`
# Watchdog Auto-Generated Override Config
json_output: true
json_include_output_property: true
json_include_output_fields_property: true
json_include_tags_property: true

http_output:
  enabled: true
  url: "http://localhost:8081/falco"
`)

	filePath := configDir + "/watchdog.yaml"
	if err := os.WriteFile(filePath, watchdogConfig, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

func (f *FalcoTool) Start() error {
	if err := exec.Command("systemctl", "daemon-reload").Run(); err != nil {
		return fmt.Errorf("failed to reload daemon: %w", err)
	}

	cmd := exec.Command("systemctl", "restart", "falco")
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to start falco: %w", err)
	}

	return nil

}
