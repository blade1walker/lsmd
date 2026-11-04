#!/usr/bin/env bash
# LSMD Oracle VM Service Manager
# Controls the website (Next.js), backup bot, and Caddy reverse proxy.
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_status() {
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}            LSMD Oracle VM System Status              ${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo -e "Time (IST): $(date)"
    echo -e "Uptime:     $(uptime -p)"
    echo -e "Memory:     $(free -h | awk '/^Mem:/ {print $3 " / " $2}')"
    echo -e "Disk (/):   $(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 " used)"}')"
    echo ""
    echo -e "${BLUE}Services:${NC}"
    
    # Website status
    if systemctl is-active --quiet lsmd; then
        echo -e "  [Website]    ${GREEN}● RUNNING${NC} (https://lsmd.tech)"
    else
        echo -e "  [Website]    ${RED}○ STOPPED${NC}"
    fi

    # Bot status
    if systemctl is-active --quiet lsmd-bot; then
        echo -e "  [Backup Bot] ${GREEN}● RUNNING${NC} (Active on Oracle VM)"
    else
        echo -e "  [Backup Bot] ${YELLOW}○ STOPPED & DISABLED${NC} (Standby mode)"
    fi

    # Caddy status
    if systemctl is-active --quiet caddy; then
        echo -e "  [Proxy/SSL]  ${GREEN}● RUNNING${NC} (Caddy HTTP/3)"
    else
        echo -e "  [Proxy/SSL]  ${RED}○ STOPPED${NC}"
    fi
    echo -e "${CYAN}======================================================${NC}"
}

website_cmd() {
    local action="$1"
    case "$action" in
        start)
            echo -e "${GREEN}Starting LSMD website...${NC}"
            sudo systemctl start lsmd
            sleep 2
            show_status
            ;;
        stop)
            echo -e "${YELLOW}Stopping LSMD website...${NC}"
            sudo systemctl stop lsmd
            sleep 1
            show_status
            ;;
        restart)
            echo -e "${CYAN}Restarting LSMD website...${NC}"
            sudo systemctl restart lsmd
            sleep 3
            show_status
            ;;
        logs)
            local lines="${2:-50}"
            sudo journalctl -u lsmd -n "$lines" --no-pager
            ;;
        *)
            echo "Usage: manage website {start|stop|restart|logs [lines]}"
            ;;
    esac
}

bot_cmd() {
    local action="$1"
    case "$action" in
        start)
            echo -e "${GREEN}Activating Backup Bot on Oracle VM...${NC}"
            sudo systemctl enable --now lsmd-bot
            sleep 2
            show_status
            ;;
        stop)
            echo -e "${YELLOW}Stopping and disabling Backup Bot on Oracle VM...${NC}"
            sudo systemctl stop lsmd-bot
            sudo systemctl disable lsmd-bot
            sleep 1
            show_status
            ;;
        restart)
            echo -e "${CYAN}Restarting Backup Bot on Oracle VM...${NC}"
            sudo systemctl restart lsmd-bot
            sleep 2
            show_status
            ;;
        deploy)
            echo -e "${CYAN}Deploying latest bot version from GitHub...${NC}"
            sudo bash /opt/lsmd/update-bot.sh
            ;;
        logs)
            local lines="${2:-50}"
            sudo journalctl -u lsmd-bot -n "$lines" --no-pager
            ;;
        *)
            echo "Usage: manage bot {start|stop|restart|deploy|logs [lines]}"
            ;;
    esac
}

interactive_menu() {
    while true; do
        clear
        show_status
        echo ""
        echo "Choose an action:"
        echo "  [1] Website: Start"
        echo "  [2] Website: Stop"
        echo "  [3] Website: Restart"
        echo "  [4] Website: View live logs"
        echo "  ------------------------------------"
        echo "  [5] Backup Bot: Start (Enable & Run on VM)"
        echo "  [6] Backup Bot: Stop (Safe disable for CloudLaag)"
        echo "  [7] Backup Bot: Restart"
        echo "  [8] Backup Bot: Pull & deploy latest from GitHub"
        echo "  [9] Backup Bot: View live logs"
        echo "  ------------------------------------"
        echo "  [0] Exit"
        echo ""
        read -rp "Enter choice [0-9]: " choice
        case "$choice" in
            1) website_cmd start; read -rp "Press Enter to continue..." ;;
            2) website_cmd stop; read -rp "Press Enter to continue..." ;;
            3) website_cmd restart; read -rp "Press Enter to continue..." ;;
            4) sudo journalctl -u lsmd -f ;;
            5) bot_cmd start; read -rp "Press Enter to continue..." ;;
            6) bot_cmd stop; read -rp "Press Enter to continue..." ;;
            7) bot_cmd restart; read -rp "Press Enter to continue..." ;;
            8) bot_cmd deploy; read -rp "Press Enter to continue..." ;;
            9) sudo journalctl -u lsmd-bot -f ;;
            0) exit 0 ;;
            *) echo "Invalid choice"; sleep 1 ;;
        esac
    done
}

case "$1" in
    status) show_status ;;
    website) shift; website_cmd "$@" ;;
    bot) shift; bot_cmd "$@" ;;
    *) interactive_menu ;;
esac
