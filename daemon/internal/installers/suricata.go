package installers

import (
	"fmt"
	"os"
	"os/exec"
)

type SuricataTool struct{}

func (s *SuricataTool) Name() string {
	return "Suricata"
}

func (s *SuricataTool) Description() string {
	return "High Performance Network IDS, IPS, and Network Security Monitoring Engine"
}

func (s *SuricataTool) Install() error {
	if _, err := exec.LookPath("suricata"); err == nil {
		// Suricata exists, safely skip the download step.
		return nil
	}

	if _, err := exec.LookPath("dnf"); err == nil {
		return s.InstallRPM("dnf")
	}

	if _, err := exec.LookPath("apt"); err == nil {
		return s.InstallAPT("apt")
	}

	if _, err := exec.LookPath("yum"); err == nil {
		return s.InstallRPM("yum")
	}
	return fmt.Errorf("unsupported operating system: no known package manager found")
}

func (s *SuricataTool) InstallRPM(packageManager string) error {
	if packageManager != "dnf" {
		return fmt.Errorf("rpm installation requires dnf for the OISF COPR repository")
	}

	cmds := [][]string{
		{"dnf", "install", "-y", "epel-release", "dnf-plugins-core"},
		{"dnf", "copr", "enable", "-y", "@oisf/suricata-8.0"},
		{"dnf", "install", "-y", "suricata", "jq"},
	}

	for _, cmdArgs := range cmds {
		if err := runInstallerCommand(cmdArgs[0], cmdArgs[1:]...); err != nil {
			return fmt.Errorf("failed to install suricata with rpm packages: %w", err)
		}
	}

	return nil
}

func (s *SuricataTool) InstallAPT(packageManager string) error {
	_ = packageManager

	script := `
set -e
apt-get update -y
apt-get install -y software-properties-common
add-apt-repository -y ppa:oisf/suricata-stable
apt-get update -y
apt-get install -y suricata jq
`

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install suricata with apt packages: %w", err)
	}

	return nil
}

func (s *SuricataTool) Configure() error {
	dirs := []string{
		"/etc/suricata",
		"/var/log/suricata",
		"/var/lib/suricata",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create suricata directory %s: %w", dir, err)
		}
	}

	// Fetch the default ET Open ruleset after package installation.
	if _, err := exec.LookPath("suricata-update"); err == nil {
		if err := runInstallerCommand("suricata-update"); err != nil {
			return fmt.Errorf("failed to update suricata rules: %w", err)
		}
	}

	return nil
}

func (s *SuricataTool) Start() error {
	if err := runInstallerCommand("systemctl", "daemon-reload"); err != nil {
		return fmt.Errorf("failed to reload systemd: %w", err)
	}

	if err := runInstallerCommand("systemctl", "enable", "--now", "suricata"); err != nil {
		return fmt.Errorf("failed to enable and start suricata: %w", err)
	}

	return nil
}

func runInstallerCommand(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	return cmd.Run()
}
