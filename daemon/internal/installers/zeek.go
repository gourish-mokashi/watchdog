package installers

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type ZeekTool struct{}

func (z *ZeekTool) Name() string {
	return "Zeek"
}

func (z *ZeekTool) Description() string {
	return "Network security monitor installed from official Zeek binary packages"
}

func (z *ZeekTool) Install() error {
	if z.isInstalled() {
		return nil
	}

	osRelease, err := readOSRelease()
	if err != nil {
		return fmt.Errorf("failed to detect operating system for Zeek install: %w", err)
	}

	if _, err := exec.LookPath("apt"); err == nil {
		return z.InstallAPT(osRelease)
	}

	if _, err := exec.LookPath("dnf"); err == nil {
		return z.InstallRPM("dnf", osRelease)
	}

	if _, err := exec.LookPath("yum"); err == nil {
		return z.InstallRPM("yum", osRelease)
	}

	return fmt.Errorf("unsupported operating system: no known package manager found")
}

func (z *ZeekTool) InstallAPT(info osReleaseInfo) error {
	repoTarget, err := zeekAPTRepoTarget(info)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`
set -e
apt-get update -y
apt-get install -y curl gpg
echo 'deb https://download.opensuse.org/repositories/security:/zeek/%s/ /' | tee /etc/apt/sources.list.d/security:zeek.list
curl -fsSL https://download.opensuse.org/repositories/security:/zeek/%s/Release.key | gpg --dearmor --yes -o /etc/apt/trusted.gpg.d/security_zeek.gpg
apt-get update -y
apt-get install -y zeek
`, repoTarget, repoTarget)

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install Zeek on apt-based system: %w", err)
	}

	return nil
}

func (z *ZeekTool) InstallRPM(packageManager string, info osReleaseInfo) error {
	repoTarget, err := zeekRPMRepoTarget(info)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`
set -e
curl -fsSL -o /etc/yum.repos.d/security:zeek.repo https://download.opensuse.org/repositories/security:/zeek/%s/security:zeek.repo
%s makecache
%s install -y zeek
`, repoTarget, packageManager, packageManager)

	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout = getCommandOutput()
	cmd.Stderr = getCommandOutput()
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install Zeek on rpm-based system: %w", err)
	}

	return nil
}

func (z *ZeekTool) Configure() error {
	if _, err := os.Stat("/opt/zeek"); err != nil {
		return fmt.Errorf("Zeek installation not found at /opt/zeek")
	}
	return nil
}

func (z *ZeekTool) Start() error {
	if systemdUnitExists("zeek") {
		if err := runInstallerCommand("systemctl", "enable", "--now", "zeek"); err != nil {
			return fmt.Errorf("failed to enable/start zeek service: %w", err)
		}
	}
	return nil
}

func (z *ZeekTool) isInstalled() bool {
	paths := []string{
		"/opt/zeek",
		"/usr/bin/zeek",
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return true
		}
	}

	return false
}

type osReleaseInfo struct {
	ID        string
	VersionID string
}

func readOSRelease() (osReleaseInfo, error) {
	file, err := os.Open("/etc/os-release")
	if err != nil {
		return osReleaseInfo{}, err
	}
	defer file.Close()

	var info osReleaseInfo
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		value = strings.Trim(value, `"`)
		switch key {
		case "ID":
			info.ID = value
		case "VERSION_ID":
			info.VersionID = value
		}
	}

	if err := scanner.Err(); err != nil {
		return osReleaseInfo{}, err
	}

	if info.ID == "" || info.VersionID == "" {
		return osReleaseInfo{}, fmt.Errorf("missing ID or VERSION_ID in /etc/os-release")
	}

	return info, nil
}

func zeekAPTRepoTarget(info osReleaseInfo) (string, error) {
	switch info.ID {
	case "ubuntu":
		return "xUbuntu_" + info.VersionID, nil
	case "debian":
		return "Debian_" + info.VersionID, nil
	default:
		return "", fmt.Errorf("unsupported apt-based distro for Zeek OBS packages: %s %s", info.ID, info.VersionID)
	}
}

func zeekRPMRepoTarget(info osReleaseInfo) (string, error) {
	major := strings.SplitN(info.VersionID, ".", 2)[0]

	switch info.ID {
	case "fedora":
		return "Fedora_" + major, nil
	case "rhel":
		return "RHEL_" + major, nil
	case "centos":
		if strings.Contains(strings.ToLower(info.VersionID), "stream") {
			return "CentOS_" + major + "_Stream", nil
		}
		return "CentOS_" + major, nil
	case "rocky":
		return "RockyLinux_" + major, nil
	case "almalinux":
		return "AlmaLinux_" + major, nil
	case "ol", "oracle":
		return "OracleLinux_" + major, nil
	default:
		return "", fmt.Errorf("unsupported rpm-based distro for Zeek OBS packages: %s %s", info.ID, info.VersionID)
	}
}
