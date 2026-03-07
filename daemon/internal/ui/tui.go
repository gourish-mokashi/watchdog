package ui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/gourish-mokashi/watchdog/daemon/internal/installers"
)

// Define our styling using Lipgloss
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00FF00")).
			MarginBottom(1)

	itemStyle = lipgloss.NewStyle().
			PaddingLeft(2)

	selectedItemStyle = lipgloss.NewStyle().
				PaddingLeft(2).
				Foreground(lipgloss.Color("#00FF00")).
				Bold(true)

	statusStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888")).
			MarginTop(1)
)

// UI States
const (
	StateSelecting = iota
	StateInstalling
	StateDone
)

type model struct {
	tools    []installers.SecurityTools
	cursor   int
	selected map[int]struct{}
	state    int
	logs     []string // To show installation progress
}

type installResultMsg struct {
	err error
}

// InitialModel configures the starting state of the TUI
func InitialModel(availableTools []installers.SecurityTools) model {
	return model{
		tools:    availableTools,
		selected: make(map[int]struct{}),
		state:    StateSelecting,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case installResultMsg:
		if msg.err != nil {
			m.logs = append(m.logs, fmt.Sprintf("❌ ERROR: %v", msg.err))
		} else {
			m.logs = append(m.logs, "✅ SUCCESS: All modules deployed and running!")
		}
		m.state = StateDone
		return m, tea.Quit
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "up", "k":
			if m.state == StateSelecting && m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.state == StateSelecting && m.cursor < len(m.tools)-1 {
				m.cursor++
			}

		case " ": // Space to toggle selection
			if m.state == StateSelecting {
				_, ok := m.selected[m.cursor]
				if ok {
					delete(m.selected, m.cursor)
				} else {
					m.selected[m.cursor] = struct{}{}
				}
			}

		case "enter":
			if m.state == StateSelecting && len(m.selected) > 0 {
				m.state = StateInstalling
				m.logs = append(m.logs, "Initializing installation sequence...")
				m.logs = append(m.logs, "Executing package managers in background. Please wait...")
				var selectedTools []installers.SecurityTools
				for i := range m.selected {
					selectedTools = append(selectedTools, m.tools[i])
				}
				return m, startInstallCmd(selectedTools)
			}
		}
	}

	return m, nil
}

func (m model) View() string {
	switch m.state {
	case StateSelecting:
		return m.renderSelection()
	case StateInstalling:
		return m.renderInstallation()
	case StateDone:
		var b strings.Builder
		b.WriteString(titleStyle.Render("WATCHDOG INSTALLATION COMPLETE"))
		b.WriteString("\n\n")
		for _, log := range m.logs {
			b.WriteString("  " + log + "\n")
		}
		return b.String()
	default:
		return "Unknown state."
	}
}

func (m model) renderSelection() string {
	var b strings.Builder

	b.WriteString(titleStyle.Render("WATCHDOG INIT: SELECT SECURITY MODULES"))
	b.WriteString("\n")

	for i, tool := range m.tools {
		cursor := " " // no cursor
		if m.cursor == i {
			cursor = ">" // cursor present
		}

		checked := " " // not selected
		if _, ok := m.selected[i]; ok {
			checked = "x" // selected
		}

		row := fmt.Sprintf("%s [%s] %s - %s", cursor, checked, tool.Name(), tool.Description())

		if m.cursor == i {
			b.WriteString(selectedItemStyle.Render(row) + "\n")
		} else {
			b.WriteString(itemStyle.Render(row) + "\n")
		}
	}

	b.WriteString(statusStyle.Render("Use ↑/↓ to navigate • Space to toggle • Enter to install • q to quit"))
	return b.String()
}

func (m model) renderInstallation() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("DEPLOYING watchdog MODULES..."))
	b.WriteString("\n\n")

	for _, log := range m.logs {
		b.WriteString("  " + log + "\n")
	}

	return b.String()
}

func startInstallCmd(tools []installers.SecurityTools) tea.Cmd {
	return func() tea.Msg {
		for _, tool := range tools {
			// 1. Install
			if err := tool.Install(); err != nil {
				return installResultMsg{err: fmt.Errorf("[%s] Install failed: %v", tool.Name(), err)}
			}

			// 2. Configure
			if err := tool.Configure(); err != nil {
				return installResultMsg{err: fmt.Errorf("[%s] Configure failed: %v", tool.Name(), err)}
			}

			// 3. Start
			if err := tool.Start(); err != nil {
				return installResultMsg{err: fmt.Errorf("[%s] Start failed: %v", tool.Name(), err)}
			}
		}

		// If we get here, everything worked perfectly
		return installResultMsg{err: nil}
	}
}
