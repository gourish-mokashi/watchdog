package installers

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type WazuhTool struct{}

func (w *WazuhTool) Name() string {
	return "Wazuh"
}

func (w *WazuhTool) Description() string {
	return "Unified XDR and SIEM platform with manager, indexer, and dashboard"
}

func (w *WazuhTool) Install() error {
	if w.isInstalled() {
		return nil
	}

	if _, err := exec.LookPath("apt"); err == nil {
		return w.InstallAPT()
	}

	if _, err := exec.LookPath("dnf"); err == nil {
		return w.InstallRPM("dnf")
	}

	if _, err := exec.LookPath("yum"); err == nil {
		return w.InstallRPM("yum")
	}

	return fmt.Errorf("unsupported operating system: no known package manager found")
}

func (w *WazuhTool) InstallAPT() error {
	script := `
set -e
apt-get update -y
apt-get install -y curl coreutils libcap2-bin tar
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"
curl -sS -O https://packages.wazuh.com/4.14/wazuh-install.sh
bash ./wazuh-install.sh -a
`

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to run Wazuh assisted installer on apt-based system: %w", err)
	}

	return nil
}

func (w *WazuhTool) InstallRPM(packageManager string) error {
	script := fmt.Sprintf(`
set -e
%s install -y curl coreutils libcap tar
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"
curl -sS -O https://packages.wazuh.com/4.14/wazuh-install.sh
bash ./wazuh-install.sh -a
`, packageManager)

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to run Wazuh assisted installer on rpm-based system: %w", err)
	}

	return nil
}

func (w *WazuhTool) Configure() error {
	return nil
}

func (w *WazuhTool) Start() error {
	if err := runInstallerCommand("systemctl", "daemon-reload"); err != nil {
		return fmt.Errorf("failed to reload systemd: %w", err)
	}

	services := []string{
		"wazuh-indexer",
		"wazuh-manager",
		"filebeat",
		"wazuh-dashboard",
	}

	for _, service := range services {
		if !systemdUnitExists(service) {
			continue
		}
		if err := runInstallerCommand("systemctl", "enable", "--now", service); err != nil {
			return fmt.Errorf("failed to enable/start %s: %w", service, err)
		}
	}

	return nil
}

func (w *WazuhTool) isInstalled() bool {
	paths := []string{
		"/var/ossec",
		"/etc/wazuh-indexer",
		"/etc/wazuh-dashboard",
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err != nil {
			return false
		}
	}

	return true
}

func systemdUnitExists(name string) bool {
	cmd := exec.Command("systemctl", "list-unit-files", name+".service", "--no-legend")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return false
	}
	return strings.Contains(string(output), name+".service")
}
